/**
 * Library page: ready-made example layouts, device-type packs and port types, all served as static JSON
 * from library/ (listed in library/index.json). Everything is copied into this browser's localStorage.
 */
import { mergeById, normalizeDeviceTypes, copyLayout, pageForLayout } from './library-core.js';

const LAYOUTS_KEY = 'audio_gear_layouts';
const DEVICE_TYPES_KEY = 'audio_gear_device_types';
const PORT_TYPES_KEY = 'audio_gear_port_types';

const statusEl = document.getElementById('library-status');
const say = (text) => { statusEl.textContent = text; };

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

function addRow(listId, { title, description, button, onClick }) {
  const li = document.createElement('li');
  const info = document.createElement('span');
  info.className = 'type-info';
  const strong = document.createElement('strong');
  strong.textContent = title;
  info.append(strong, document.createTextNode(description));
  const actions = document.createElement('span');
  actions.className = 'type-actions';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = button;
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      await onClick();
    } catch (e) {
      say(`Could not add ${title}: ${e.message}`);
    }
    btn.disabled = false;
  });
  actions.append(btn);
  li.append(info, actions);
  document.getElementById(listId).append(li);
}

function newLayoutId() {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

async function openLayout(entry) {
  const layout = await fetchJson(entry.file);
  const saved = readList(LAYOUTS_KEY);
  const copy = copyLayout(layout, newLayoutId(), saved.map((l) => l.name));
  if (!writeList(LAYOUTS_KEY, [...saved, copy])) return;
  window.location.href = `${pageForLayout(copy)}?layout=${encodeURIComponent(copy.id)}`;
}

async function addDeviceTypes(entry) {
  const types = normalizeDeviceTypes(await fetchJson(entry.file));
  if (writeList(DEVICE_TYPES_KEY, mergeById(readList(DEVICE_TYPES_KEY), types))) {
    say(`Added ${types.length} device types from “${entry.name}”. They're in the Add device dropdown.`);
  }
}

async function addPortTypes(entry) {
  const types = await fetchJson(entry.file);
  if (writeList(PORT_TYPES_KEY, mergeById(readList(PORT_TYPES_KEY), types))) {
    say(`Added ${types.length} port types from “${entry.name}”.`);
  }
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
}

function exportAllLayouts() {
  const layouts = readList(LAYOUTS_KEY);
  if (!layouts.length) { say('No saved layouts to export.'); return; }
  const blob = new Blob([JSON.stringify(layouts, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'audio_gear_all_layouts.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  say(`Exported ${layouts.length} layout${layouts.length === 1 ? '' : 's'}.`);
}

function clearLayouts() {
  const count = readList(LAYOUTS_KEY).length;
  if (!count) { say('No saved layouts to clear.'); return; }
  if (!window.confirm(`Delete all ${count} saved layout${count === 1 ? '' : 's'} from this browser?\n\nDevice types and port types are kept. This cannot be undone.`)) return;
  try {
    localStorage.removeItem(LAYOUTS_KEY);
    say(`Cleared ${count} layout${count === 1 ? '' : 's'}. Device types and port types are untouched.`);
  } catch {
    say('Could not clear layouts (storage is blocked in this browser).');
  }
}

document.getElementById('library-export-layouts').addEventListener('click', exportAllLayouts);
document.getElementById('library-clear-layouts').addEventListener('click', clearLayouts);
document.getElementById('library-reset').addEventListener('click', systemReset);

async function init() {
  try {
    const manifest = await fetchJson('library/index.json');
    (manifest.layouts || []).forEach((e) => addRow('library-layouts', { title: e.name, description: ` — ${e.description}`, button: 'Open a copy', onClick: () => openLayout(e) }));
    (manifest.device_types || []).forEach((e) => addRow('library-device-types', { title: e.name, description: ` — ${e.description}`, button: 'Add to my devices', onClick: () => addDeviceTypes(e) }));
    (manifest.port_types || []).forEach((e) => addRow('library-port-types', { title: e.name, description: ` — ${e.description}`, button: 'Add to my ports', onClick: () => addPortTypes(e) }));
    say('');
  } catch (e) {
    say(`Could not load the library: ${e.message}`);
  }
}

init();
