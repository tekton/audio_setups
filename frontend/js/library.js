/**
 * Library page: ready-made example layouts, device-type packs and port types, all served as static JSON
 * from library/ (listed in library/index.json). Everything is copied into this browser's localStorage.
 * Also the place to back up, restore and reset what this browser holds.
 */
import {
  mergeById, normalizeDeviceTypes, copyLayout, pageForLayout, importLayouts, installState, removeById,
  buildBackup, parseImportFile, validateDeviceTypes, validatePortTypes, storageSummary, formatChars, backupNudge,
} from './library-core.js';

const LAYOUTS_KEY = 'audio_gear_layouts';
const DEVICE_TYPES_KEY = 'audio_gear_device_types';
const PORT_TYPES_KEY = 'audio_gear_port_types';
const LAST_BACKUP_KEY = 'audio_gear_last_backup';

const statusEl = document.getElementById('library-status');
const say = (text) => { statusEl.textContent = text; };
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function readList(key) {
  try {
    const raw = localStorage.getItem(key);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeList(key, list) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
    return true;
  } catch {
    say('Could not save to this browser (storage is blocked or full). Private tabs and some privacy settings disable it.');
    return false;
  }
}

async function fetchJson(file) {
  const res = await fetch(file);
  if (!res.ok) throw new Error(`${file}: ${res.status}`);
  return res.json();
}

function newLayoutId() {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function download(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// What this browser holds, how big it is, and whether it is time to back up
function refreshStorage() {
  let entries = [];
  let lastBackup = null;
  try {
    entries = Object.keys(localStorage).filter((k) => k.startsWith('audio_gear_')).map((k) => [k, localStorage.getItem(k)]);
    lastBackup = localStorage.getItem(LAST_BACKUP_KEY);
  } catch { /* storage blocked: show zeros */ }
  const { chars } = storageSummary(entries);
  const layouts = readList(LAYOUTS_KEY).length;
  const last = Date.parse(lastBackup);
  document.getElementById('library-storage').textContent =
    `${plural(layouts, 'saved layout')}, ${plural(readList(DEVICE_TYPES_KEY).length, 'custom device type')}, ${plural(readList(PORT_TYPES_KEY).length, 'custom port type')}. `
    + `Using about ${formatChars(chars)} of the roughly 5 MB this browser allows. `
    + `Last backup: ${Number.isNaN(last) ? 'never' : new Date(last).toLocaleDateString()}.`;
  const nudge = document.getElementById('library-nudge');
  nudge.textContent = backupNudge(lastBackup, layouts);
  nudge.hidden = !nudge.textContent;
}

function markBackedUp() {
  try { localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString()); } catch { /* not fatal */ }
}

// One list row. `refresh` (set by the row) updates its status text and buttons after storage changes.
const refreshers = [];

function addRow(listId, { title, description, status, buttons }) {
  const li = document.createElement('li');
  const info = document.createElement('span');
  info.className = 'type-info';
  const strong = document.createElement('strong');
  strong.textContent = title;
  const badge = document.createElement('em');
  badge.className = 'install-state';
  info.append(strong, document.createTextNode(description), badge);
  const actions = document.createElement('span');
  actions.className = 'type-actions';
  const made = buttons.map(({ label, onClick }) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        await onClick();
      } catch (e) {
        say(`Could not update ${title}: ${e.message}`);
      }
      btn.disabled = false;
      refreshAll();
    });
    actions.append(btn);
    return btn;
  });
  li.append(info, actions);
  document.getElementById(listId).append(li);
  if (status) {
    const refresh = () => {
      const s = status();
      badge.textContent = s.text;
      badge.hidden = !s.text;
      made.forEach((btn, i) => { btn.hidden = s.hide.includes(i); });
    };
    refreshers.push(refresh);
    refresh();
  }
}

function refreshAll() {
  refreshers.forEach((r) => r());
  refreshStorage();
}

async function openLayout(entry) {
  const layout = await fetchJson(entry.file);
  const saved = readList(LAYOUTS_KEY);
  const copy = copyLayout(layout, newLayoutId(), saved.map((l) => l.name));
  if (!writeList(LAYOUTS_KEY, [...saved, copy])) return;
  window.location.href = `${pageForLayout(copy)}?layout=${encodeURIComponent(copy.id)}`;
}

// A pack row: Add / Remove, with an "Installed" badge from how many of the pack's ids are already stored
function packRow(listId, entry, { key, addLabel, load, noun }) {
  let items = [];
  const ready = fetchJson(entry.file).then((data) => { items = load(data); }).catch((e) => say(`Could not load ${entry.name}: ${e.message}`));
  const state = () => installState(items, readList(key));
  addRow(listId, {
    title: entry.name,
    description: ` — ${entry.description}`,
    status: () => {
      const s = state();
      return { text: s === 'all' ? ' Installed' : s === 'some' ? ' Partly installed' : '', hide: [s === 'all' ? 0 : -1, s === 'none' ? 1 : -1] };
    },
    buttons: [
      { label: addLabel, onClick: async () => {
        await ready;
        if (writeList(key, mergeById(readList(key), items))) say(`Added ${plural(items.length, noun)} from “${entry.name}”.`);
      } },
      { label: 'Remove', onClick: async () => {
        await ready;
        if (writeList(key, removeById(readList(key), items))) say(`Removed “${entry.name}” (${plural(items.length, noun)}). Layouts that use them keep their devices.`);
      } },
    ],
  });
  ready.then(refreshAll);
}

function exportAllLayouts() {
  const layouts = readList(LAYOUTS_KEY);
  if (!layouts.length) { say('No saved layouts to export.'); return; }
  download(layouts, 'audio_gear_all_layouts.json');
  markBackedUp();
  say(`Exported ${plural(layouts.length, 'layout')}.`);
  refreshStorage();
}

function fullBackup() {
  const layouts = readList(LAYOUTS_KEY);
  const deviceTypes = readList(DEVICE_TYPES_KEY);
  const portTypes = readList(PORT_TYPES_KEY);
  if (!layouts.length && !deviceTypes.length && !portTypes.length) { say('Nothing to back up yet.'); return; }
  download(buildBackup(layouts, deviceTypes, portTypes), 'audio_gear_backup.json');
  markBackedUp();
  say(`Backed up ${plural(layouts.length, 'layout')}, ${plural(deviceTypes.length, 'device type')} and ${plural(portTypes.length, 'port type')}.`);
  refreshStorage();
}

function clearLayouts() {
  const count = readList(LAYOUTS_KEY).length;
  if (!count) { say('No saved layouts to clear.'); return; }
  if (!window.confirm(`Delete all ${plural(count, 'saved layout')} from this browser?\n\nDevice types and port types are kept. This cannot be undone.`)) return;
  try {
    localStorage.removeItem(LAYOUTS_KEY);
    say(`Cleared ${plural(count, 'layout')}. Device types and port types are untouched.`);
  } catch {
    say('Could not clear layouts (storage is blocked in this browser).');
  }
  refreshAll();
}

async function importFile(evt) {
  const file = evt.target.files[0];
  evt.target.value = '';
  if (!file) return;
  try {
    const { layouts, deviceTypes, portTypes } = parseImportFile(await file.text());
    const parts = [];
    if (layouts.length && writeList(LAYOUTS_KEY, importLayouts(layouts, readList(LAYOUTS_KEY), newLayoutId))) parts.push(`${plural(layouts.length, 'layout')} as new copies`);
    if (deviceTypes.length && writeList(DEVICE_TYPES_KEY, mergeById(readList(DEVICE_TYPES_KEY), normalizeDeviceTypes(deviceTypes)))) parts.push(plural(deviceTypes.length, 'device type'));
    if (portTypes.length && writeList(PORT_TYPES_KEY, mergeById(readList(PORT_TYPES_KEY), portTypes))) parts.push(plural(portTypes.length, 'port type'));
    say(parts.length ? `Imported ${parts.join(', ')}. Find layouts under Load on the layout pages.` : 'The file had nothing to import.');
  } catch (e) {
    say(`Import failed: ${e.message}`);
  }
  refreshAll();
}

function systemReset() {
  if (!window.confirm('Remove all custom device types and port types and go back to the built-in defaults?\n\nYour saved layouts are kept. This cannot be undone.')) return;
  try {
    localStorage.removeItem(DEVICE_TYPES_KEY);
    localStorage.removeItem(PORT_TYPES_KEY);
    say('System reset: custom device types and port types cleared. Your layouts are untouched.');
  } catch {
    say('Could not reset (storage is blocked in this browser).');
  }
  refreshAll();
}

document.getElementById('library-import-layouts').addEventListener('click', () => document.getElementById('library-import-file').click());
document.getElementById('library-import-file').addEventListener('change', importFile);
document.getElementById('library-export-layouts').addEventListener('click', exportAllLayouts);
document.getElementById('library-full-backup').addEventListener('click', fullBackup);
document.getElementById('library-clear-layouts').addEventListener('click', clearLayouts);
document.getElementById('library-reset').addEventListener('click', systemReset);

async function init() {
  refreshStorage();
  try {
    const manifest = await fetchJson('library/index.json');
    (manifest.layouts || []).forEach((e) => addRow('library-layouts', { title: e.name, description: ` — ${e.description}`, buttons: [{ label: 'Open a copy', onClick: () => openLayout(e) }] }));
    (manifest.device_types || []).forEach((e) => packRow('library-device-types', e, { key: DEVICE_TYPES_KEY, addLabel: 'Add to my devices', load: (d) => normalizeDeviceTypes(validateDeviceTypes(d)), noun: 'device type' }));
    (manifest.port_types || []).forEach((e) => packRow('library-port-types', e, { key: PORT_TYPES_KEY, addLabel: 'Add to my ports', load: validatePortTypes, noun: 'port type' }));
    say('');
  } catch (e) {
    say(`Could not load the library: ${e.message}`);
  }
}

init();
