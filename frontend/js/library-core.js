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
    const types = (v) => {
      if (v === undefined) return [];
      if (!Array.isArray(v) || !v.every((t) => t && typeof t === 'object' && t.id)) throw new Error('not a backup file');
      return v;
    };
    return { layouts, deviceTypes: types(data.device_types), portTypes: types(data.port_types) };
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
