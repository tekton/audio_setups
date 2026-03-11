/**
 * Device types page: create and manage custom device templates.
 * Saves to localStorage (works offline), optional API sync, and JSON export/import.
 */

const API_BASE = 'http://localhost:7001';
const LOCAL_KEY = 'audio_gear_device_types';

function getLocalTypes() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setLocalTypes(list) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
}

async function getApiTypes() {
  try {
    const res = await fetch(`${API_BASE}/device-types`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

async function loadMergedTypes() {
  const local = getLocalTypes();
  const api = await getApiTypes();
  const byId = new Map();
  api.forEach((t) => byId.set(t.id, { ...t, source: 'api' }));
  local.forEach((t) => byId.set(t.id, { ...t, source: 'local' }));
  return Array.from(byId.values());
}

function renderPortRows(containerId, ports, onUpdate) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  (ports || []).forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'port-row';
    const name = document.createElement('input');
    name.type = 'text';
    name.className = 'port-name';
    name.placeholder = 'Port name';
    name.value = typeof p === 'string' ? p : (p.name || '');
    const type = document.createElement('input');
    type.type = 'text';
    type.className = 'port-type';
    type.placeholder = 'Type (e.g. audio)';
    type.value = typeof p === 'string' ? '' : (p.type || 'audio');
    const rm = document.createElement('button');
    rm.type = 'button';
    rm.textContent = 'Remove';
    rm.className = 'btn-secondary';
    rm.addEventListener('click', () => {
      ports.splice(i, 1);
      renderPortRows(containerId, ports, onUpdate);
      onUpdate?.();
    });
    name.addEventListener('input', () => { ports[i] = { name: name.value.trim(), type: type.value.trim() || 'audio' }; onUpdate?.(); });
    type.addEventListener('input', () => { ports[i] = { name: name.value.trim(), type: type.value.trim() || 'audio' }; onUpdate?.(); });
    row.append(name, type, rm);
    container.appendChild(row);
  });
}

function getPortsFromContainer(containerId) {
  const container = document.getElementById(containerId);
  const rows = container.querySelectorAll('.port-row');
  return Array.from(rows).map((row) => {
    const nameEl = row.querySelector('.port-name');
    const typeEl = row.querySelector('.port-type');
    return { name: (nameEl?.value || '').trim(), type: (typeEl?.value || '').trim() || 'audio' };
  }).filter((p) => p.name);
}

let editingId = null;
let inputPorts = [];
let outputPorts = [];

function renderTypeList(types) {
  const ul = document.getElementById('type-list');
  ul.innerHTML = '';
  types.forEach((t) => {
    const li = document.createElement('li');
    const inp = (t.input_ports || []).length;
    const out = (t.output_ports || []).length;
    li.innerHTML = `
      <span class="type-info"><strong>${escapeHtml(t.label || t.name || t.id)}</strong> <code>${escapeHtml(t.name || t.id)}</code> — ${inp} in, ${out} out</span>
      <span class="type-actions">
        <button type="button" data-edit="${escapeHtml(t.id)}">Edit</button>
        <button type="button" data-delete="${escapeHtml(t.id)}">Delete</button>
      </span>
    `;
    li.querySelector('[data-edit]').addEventListener('click', () => fillForm(t));
    li.querySelector('[data-delete]').addEventListener('click', () => deleteType(t.id));
    ul.appendChild(li);
  });
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function fillForm(t) {
  editingId = t.id;
  document.getElementById('form-title').textContent = 'Edit device type';
  document.getElementById('template-id').value = t.id || '';
  document.getElementById('template-name').value = t.name || '';
  document.getElementById('template-name').disabled = !!t.id;
  document.getElementById('template-label').value = t.label || '';
  inputPorts = (t.input_ports || []).map((p) => ({ name: typeof p === 'string' ? p : p.name, type: typeof p === 'string' ? 'audio' : (p.type || 'audio') }));
  outputPorts = (t.output_ports || []).map((p) => ({ name: typeof p === 'string' ? p : p.name, type: typeof p === 'string' ? 'audio' : (p.type || 'audio') }));
  renderPortRows('input-ports-container', inputPorts);
  renderPortRows('output-ports-container', outputPorts);
}

function clearForm() {
  editingId = null;
  document.getElementById('form-title').textContent = 'Add device type';
  document.getElementById('template-id').value = '';
  document.getElementById('template-name').value = '';
  document.getElementById('template-name').disabled = false;
  document.getElementById('template-label').value = '';
  inputPorts = [];
  outputPorts = [];
  renderPortRows('input-ports-container', inputPorts);
  renderPortRows('output-ports-container', outputPorts);
}

function getFormData() {
  const name = document.getElementById('template-name').value.trim() || undefined;
  const label = document.getElementById('template-label').value.trim() || name;
  const inputs = getPortsFromContainer('input-ports-container');
  const outputs = getPortsFromContainer('output-ports-container');
  if (inputPorts.length) {
    inputPorts.length = 0;
    inputPorts.push(...inputs);
  }
  if (outputPorts.length) {
    outputPorts.length = 0;
    outputPorts.push(...outputs);
  }
  return {
    id: document.getElementById('template-id').value.trim() || undefined,
    name,
    label,
    input_ports: inputs.length ? inputs : inputPorts.slice(),
    output_ports: outputs.length ? outputs : outputPorts.slice(),
  };
}

function saveLocal() {
  const data = getFormData();
  if (!data.name) {
    alert('Name is required.');
    return;
  }
  const list = getLocalTypes();
  const idx = list.findIndex((t) => t.id === data.id || t.name === data.name);
  const payload = { ...data, id: data.id || `dt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}` };
  if (idx >= 0) list[idx] = payload;
  else list.push(payload);
  setLocalTypes(list);
  alert('Saved locally.');
  clearForm();
  loadMergedTypes().then(renderTypeList);
}

async function saveServer() {
  const data = getFormData();
  if (!data.name) {
    alert('Name is required.');
    return;
  }
  const payload = { ...data, id: data.id || undefined };
  try {
    const url = payload.id ? `${API_BASE}/device-types/${payload.id}` : `${API_BASE}/device-types`;
    const method = payload.id ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error(await res.text());
    alert('Saved to server.');
    clearForm();
    loadMergedTypes().then(renderTypeList);
  } catch (e) {
    alert('Save to server failed: ' + e.message);
  }
}

function exportJson() {
  loadMergedTypes().then((types) => {
    const json = JSON.stringify(types.map((t) => ({ id: t.id, name: t.name, label: t.label, input_ports: t.input_ports || [], output_ports: t.output_ports || [] })), null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'audio-gear-device-types.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });
}

function importJson(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      const list = Array.isArray(data) ? data : (data.device_types || [data]);
      const local = getLocalTypes();
      const byId = new Map(local.map((t) => [t.id, t]));
      list.forEach((t) => {
        const id = t.id || `dt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        byId.set(id, { id, name: t.name || id, label: t.label || t.name, input_ports: t.input_ports || [], output_ports: t.output_ports || [] });
      });
      setLocalTypes(Array.from(byId.values()));
      alert('Imported.');
      loadMergedTypes().then(renderTypeList);
    } catch (e) {
      alert('Import failed: ' + e.message);
    }
  };
  reader.readAsText(file);
}

async function deleteType(id) {
  if (!confirm('Delete this device type?')) return;
  const local = getLocalTypes().filter((t) => t.id !== id);
  setLocalTypes(local);
  try {
    await fetch(`${API_BASE}/device-types/${id}`, { method: 'DELETE' });
  } catch (_) {}
  if (editingId === id) clearForm();
  loadMergedTypes().then(renderTypeList);
}

document.getElementById('device-type-form').addEventListener('submit', (e) => {
  e.preventDefault();
  saveLocal();
});

document.getElementById('btn-save-local').addEventListener('click', () => saveLocal());
document.getElementById('btn-save-server').addEventListener('click', () => saveServer());
document.getElementById('btn-export-json').addEventListener('click', () => exportJson());
document.getElementById('btn-clear-form').addEventListener('click', () => clearForm());

document.getElementById('import-file').addEventListener('change', (evt) => {
  const file = evt.target.files?.[0];
  if (file) importJson(file);
  evt.target.value = '';
});

document.getElementById('btn-add-input-port').addEventListener('click', () => {
  inputPorts.push({ name: '', type: 'audio' });
  renderPortRows('input-ports-container', inputPorts);
});

document.getElementById('btn-add-output-port').addEventListener('click', () => {
  outputPorts.push({ name: '', type: 'audio' });
  renderPortRows('output-ports-container', outputPorts);
});

loadMergedTypes().then(renderTypeList);
