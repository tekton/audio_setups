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
