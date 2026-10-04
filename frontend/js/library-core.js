// Pure helpers for the library page (no DOM, no storage): merging imported types and copying example layouts.

// Merges `incoming` into `existing` by id; an incoming item replaces one with the same id.
export function mergeById(existing, incoming) {
  const byId = new Map(existing.map((t) => [t.id, t]));
  incoming.forEach((t) => byId.set(t.id, t));
  return Array.from(byId.values());
}

// Normalises device types from a library pack or an exported file the way the Device types page imports them.
export function normalizeDeviceTypes(list) {
  return list.map((t) => {
    const id = t.id || `dt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    return { id, name: t.name || id, label: t.label || t.name, width_in: t.width_in || 19, height_u: t.height_u || 1, input_ports: t.input_ports || [], output_ports: t.output_ports || [] };
  });
}

// "Name", "Name (2)", "Name (3)"...: the first that isn't already taken.
export function uniqueName(name, taken) {
  if (!taken.includes(name)) return name;
  let n = 2;
  while (taken.includes(`${name} (${n})`)) n += 1;
  return `${name} (${n})`;
}

// "Desk (2)" -> "Desk", so copying a copy numbers on from the original name instead of stacking suffixes.
export function baseName(name) {
  return name.replace(/ \(\d+\)$/, '') || name;
}

// A library layout becomes the user's own copy: fresh id, a name that doesn't clash with their saved layouts.
export function copyLayout(layout, id, takenNames) {
  return { ...layout, id, name: uniqueName(layout.name || 'Untitled layout', takenNames) };
}

// The page that shows a layout (rack layouts on index.html, classic ones on classic.html)
export function pageForLayout(layout) {
  return layout.mode === 'classic' ? 'classic.html' : 'index.html';
}

// Reads an exported layouts file: one layout object, or the array that "Export all layouts" writes.
// Throws if it isn't JSON or any entry isn't a layout (an object with a devices array).
export function parseLayoutsFile(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('not a JSON file');
  }
  const list = Array.isArray(data) ? data : [data];
  if (!list.length || !list.every((l) => l && typeof l === 'object' && Array.isArray(l.devices))) throw new Error('not a layouts file');
  return list;
}

// Gives each imported layout a fresh id and a name that doesn't clash with saved ones or earlier imports.
export function importLayouts(layouts, saved, newId) {
  const names = saved.map((l) => l.name);
  const added = layouts.map((l) => {
    const copy = copyLayout(l, newId(), names);
    names.push(copy.name);
    return copy;
  });
  return [...saved, ...added];
}

// How much of a library pack is already in the user's list: 'all', 'some' or 'none' (matched by id).
export function installState(packItems, existing) {
  const have = new Set(existing.map((t) => t.id));
  const present = packItems.filter((t) => have.has(t.id)).length;
  if (!packItems.length || present === 0) return 'none';
  return present === packItems.length ? 'all' : 'some';
}

// `existing` without the items that are in `packItems` (matched by id).
export function removeById(existing, packItems) {
  const drop = new Set(packItems.map((t) => t.id));
  return existing.filter((t) => !drop.has(t.id));
}

// A whole-browser backup: layouts plus the custom device and port types, in one file.
export function buildBackup(layouts, deviceTypes, portTypes, now = new Date()) {
  return { app: 'audio_gear_layout', backup_version: 1, exported_at: now.toISOString(), layouts, device_types: deviceTypes, port_types: portTypes };
}

// Reads any file the Import button accepts: a full backup, an "Export all layouts" array, or one layout.
// Returns { layouts, deviceTypes, portTypes }; throws if the file isn't one of those.
export function parseImportFile(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('not a JSON file');
  }
  if (data && !Array.isArray(data) && data.app === 'audio_gear_layout' && Array.isArray(data.layouts)) {
    const layouts = data.layouts.length ? parseLayoutsFile(JSON.stringify(data.layouts)) : [];
    const check = (fn, v) => {
      if (v === undefined) return [];
      try {
        return fn(v);
      } catch (e) {
        throw new Error(`not a backup file (${e.message})`);
      }
    };
    return { layouts, deviceTypes: check(validateDeviceTypes, data.device_types), portTypes: check(validatePortTypes, data.port_types) };
  }
  return { layouts: parseLayoutsFile(text), deviceTypes: [], portTypes: [] };
}

// Size of everything this site keeps in localStorage: { keys, chars }. `entries` is [[key, value], ...].
export function storageSummary(entries) {
  return { keys: entries.length, chars: entries.reduce((n, [k, v]) => n + k.length + (v || '').length, 0) };
}

// "12 KB" style size for a character count (localStorage counts UTF-16 characters; browsers allow ~5 million).
export function formatChars(chars) {
  if (chars < 1000) return `${chars} B`;
  if (chars < 1000 * 1000) return `${Math.round(chars / 1000)} KB`;
  return `${(chars / 1e6).toFixed(1)} MB`;
}

const NUDGE_AFTER_DAYS = 30;

// Message about backing up, or '' when none is needed. Layouts only live in this browser, so remind people.
export function backupNudge(lastBackupIso, layoutCount, now = new Date()) {
  if (!layoutCount) return '';
  const last = Date.parse(lastBackupIso);
  if (Number.isNaN(last)) return `You have ${layoutCount} saved layout${layoutCount === 1 ? '' : 's'} that exist only in this browser and have never been backed up. Use Full backup to keep a copy.`;
  const days = Math.floor((now.getTime() - last) / 86400000);
  return days >= NUDGE_AFTER_DAYS ? `Your last backup was ${days} days ago. Use Full backup to refresh it.` : '';
}

// Imported types are stored and shown on other pages, so check their shape before accepting them.
// Both return the list unchanged, or throw an Error saying which entry is wrong.
const isText = (v, max) => typeof v === 'string' && v.length > 0 && v.length <= max;
const COLOR = /^#[0-9a-f]{3,8}$/i;

function validatePorts(ports, where) {
  if (ports === undefined) return;
  if (!Array.isArray(ports) || ports.length > 200) throw new Error(`${where}: ports must be a list of at most 200`);
  ports.forEach((p) => {
    if (!p || typeof p !== 'object' || !isText(p.name, 100) || !isText(p.type, 64)) throw new Error(`${where}: each port needs a name and a type`);
  });
}

export function validateDeviceTypes(list) {
  if (!Array.isArray(list)) throw new Error('device types must be a list');
  list.forEach((t, i) => {
    const where = `device type ${i + 1}`;
    if (!t || typeof t !== 'object' || !isText(t.id, 100)) throw new Error(`${where}: needs an id`);
    ['name', 'label'].forEach((k) => { if (t[k] !== undefined && !isText(t[k], 200)) throw new Error(`${where}: ${k} must be text`); });
    if (t.width_in !== undefined && ![6, 10, 19].includes(t.width_in)) throw new Error(`${where}: width must be 6, 10 or 19`);
    if (t.height_u !== undefined && !(Number.isInteger(t.height_u) && t.height_u >= 1 && t.height_u <= 60)) throw new Error(`${where}: height must be 1 to 60 U`);
    validatePorts(t.input_ports, where);
    validatePorts(t.output_ports, where);
  });
  return list;
}

export function validatePortTypes(list) {
  if (!Array.isArray(list)) throw new Error('port types must be a list');
  list.forEach((t, i) => {
    const where = `port type ${i + 1}`;
    if (!t || typeof t !== 'object' || !isText(t.id, 100) || !isText(t.type, 64)) throw new Error(`${where}: needs an id and a type`);
    if (t.name !== undefined && !isText(t.name, 200)) throw new Error(`${where}: name must be text`);
    if (t.color !== undefined && !COLOR.test(t.color)) throw new Error(`${where}: color must look like #rrggbb`);
  });
  return list;
}
