/**
 * Audio gear layout — vanilla JS. Devices on SVG canvas; drag from one device
 * to another to create a cable (connection). State synced to backend.
 */

const API_BASE = 'http://localhost:7001';
const DEVICE_W = 120;
const DEVICE_H = 56;
const PORT_R = 5;

let state = {
  layoutId: null,
  name: 'Untitled layout',
  devices: [],
  connections: [],
  selectedDeviceId: null,
  selectedConnectionId: null,
};

let dragState = null; // { type: 'cable', ... } | { type: 'move', deviceId, offsetX, offsetY, startX, startY }

const canvas = document.getElementById('canvas');
const devicesLayer = document.getElementById('devices-layer');
const cablesLayer = document.getElementById('cables-layer');
const rubberBand = document.getElementById('rubber-band');

function genId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function getDeviceById(id) {
  return state.devices.find((d) => d.id === id);
}

function getDeviceCenter(device) {
  return {
    x: device.position.x + DEVICE_W / 2,
    y: device.position.y + DEVICE_H / 2,
  };
}

function getPortPosition(device, portName, io) {
  const ports = io === 'input' ? (device.input_ports || []) : (device.output_ports || []);
  const idx = ports.indexOf(portName);
  if (idx < 0) return getDeviceCenter(device);
  const n = ports.length;
  const x = io === 'input' ? device.position.x : device.position.x + DEVICE_W;
  const y = device.position.y + (n === 1 ? DEVICE_H / 2 : (idx + 1) * (DEVICE_H / (n + 1)));
  return { x, y };
}

function getConnectionEndpoints(c) {
  const from = getDeviceById(c.from_device_id);
  const to = getDeviceById(c.to_device_id);
  if (!from || !to) return null;
  const a = c.from_port && (from.output_ports || []).includes(c.from_port)
    ? getPortPosition(from, c.from_port, 'output')
    : getDeviceCenter(from);
  const b = c.to_port && (to.input_ports || []).includes(c.to_port)
    ? getPortPosition(to, c.to_port, 'input')
    : getDeviceCenter(to);
  return { a, b };
}

function renderDevices() {
  devicesLayer.innerHTML = '';
  state.devices.forEach((d) => {
    const inputs = d.input_ports || [];
    const outputs = d.output_ports || [];
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.dataset.deviceId = d.id;
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('class', 'device-block' + (d.id === state.selectedDeviceId ? ' selected' : ''));
    rect.setAttribute('x', d.position.x);
    rect.setAttribute('y', d.position.y);
    rect.setAttribute('width', DEVICE_W);
    rect.setAttribute('height', DEVICE_H);
    g.append(rect);
    inputs.forEach((name, i) => {
      const n = inputs.length;
      const x = d.position.x;
      const y = d.position.y + (n === 1 ? DEVICE_H / 2 : (i + 1) * (DEVICE_H / (n + 1)));
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('class', 'device-port port-input');
      circle.setAttribute('cx', x);
      circle.setAttribute('cy', y);
      circle.setAttribute('r', PORT_R);
      circle.dataset.port = name;
      circle.dataset.portIo = 'input';
      g.append(circle);
    });
    outputs.forEach((name, i) => {
      const n = outputs.length;
      const x = d.position.x + DEVICE_W;
      const y = d.position.y + (n === 1 ? DEVICE_H / 2 : (i + 1) * (DEVICE_H / (n + 1)));
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('class', 'device-port port-output');
      circle.setAttribute('cx', x);
      circle.setAttribute('cy', y);
      circle.setAttribute('r', PORT_R);
      circle.dataset.port = name;
      circle.dataset.portIo = 'output';
      g.append(circle);
    });
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('class', 'device-label');
    label.setAttribute('x', d.position.x + DEVICE_W / 2);
    label.setAttribute('y', d.position.y + DEVICE_H / 2 + 4);
    label.textContent = d.label || d.type || d.id;
    g.append(label);
    devicesLayer.appendChild(g);
  });
}

function renderCables() {
  cablesLayer.innerHTML = '';
  state.connections.forEach((c) => {
    const endpoints = getConnectionEndpoints(c);
    if (!endpoints) return;
    const { a, b } = endpoints;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('class', 'cable' + (c.id === state.selectedConnectionId ? ' selected' : ''));
    line.dataset.connectionId = c.id;
    line.setAttribute('x1', a.x);
    line.setAttribute('y1', a.y);
    line.setAttribute('x2', b.x);
    line.setAttribute('y2', b.y);
    line.setAttribute('marker-end', 'url(#arrowhead)');
    cablesLayer.appendChild(line);
  });
}

function showRubberBand(x1, y1, x2, y2) {
  rubberBand.setAttribute('x1', x1);
  rubberBand.setAttribute('y1', y1);
  rubberBand.setAttribute('x2', x2);
  rubberBand.setAttribute('y2', y2);
  rubberBand.style.display = '';
}

function hideRubberBand() {
  rubberBand.style.display = 'none';
}

function svgPoint(evt) {
  const pt = canvas.createSVGPoint();
  pt.x = evt.clientX;
  pt.y = evt.clientY;
  return pt.matrixTransform(canvas.getScreenCTM().inverse());
}

function startCableDrag(deviceId, portName, pt) {
  const dev = getDeviceById(deviceId);
  if (!dev) return;
  const start = portName ? getPortPosition(dev, portName, 'output') : getDeviceCenter(dev);
  dragState = { type: 'cable', fromDeviceId: deviceId, fromPort: portName || '', fromX: start.x, fromY: start.y };
  rubberBand.setAttribute('x1', start.x);
  rubberBand.setAttribute('y1', start.y);
  rubberBand.setAttribute('x2', start.x);
  rubberBand.setAttribute('y2', start.y);
  rubberBand.style.display = '';
  canvas.classList.add('drawing');
  document.querySelector(`[data-device-id="${deviceId}"] rect`)?.classList.add('drag-source');
}

function startDeviceMove(deviceId, pt) {
  const dev = getDeviceById(deviceId);
  if (!dev) return;
  const offsetX = pt.x - dev.position.x;
  const offsetY = pt.y - dev.position.y;
  dragState = { type: 'move', deviceId, offsetX, offsetY, startX: dev.position.x, startY: dev.position.y };
  canvas.classList.add('moving');
}

function updateDeviceMove(pt) {
  if (!dragState || dragState.type !== 'move') return;
  const dev = getDeviceById(dragState.deviceId);
  if (!dev) return;
  dev.position.x = pt.x - dragState.offsetX;
  dev.position.y = pt.y - dragState.offsetY;
  renderDevices();
  renderCables();
}

function updateRubberBand(pt) {
  if (!dragState || dragState.type !== 'cable') return;
  rubberBand.setAttribute('x2', pt.x);
  rubberBand.setAttribute('y2', pt.y);
}

function endCableDrag(toDeviceId, toPortName) {
  if (!dragState || dragState.type !== 'cable' || !toDeviceId || toDeviceId === dragState.fromDeviceId) {
    dragState = null;
    hideRubberBand();
    canvas.classList.remove('drawing');
    document.querySelectorAll('.device-block.drag-source').forEach((el) => el.classList.remove('drag-source'));
    return;
  }
  state.connections.push({
    id: genId(),
    from_device_id: dragState.fromDeviceId,
    to_device_id: toDeviceId,
    from_port: dragState.fromPort || '',
    to_port: toPortName || '',
  });
  dragState = null;
  hideRubberBand();
  canvas.classList.remove('drawing');
  document.querySelectorAll('.device-block.drag-source').forEach((el) => el.classList.remove('drag-source'));
  renderCables();
}

const DRAG_THRESHOLD_PX = 5;

function endDeviceMove() {
  if (!dragState || dragState.type !== 'move') {
    canvas.classList.remove('moving');
    return;
  }
  const dev = getDeviceById(dragState.deviceId);
  const dx = dev ? dev.position.x - dragState.startX : 0;
  const dy = dev ? dev.position.y - dragState.startY : 0;
  const moved = Math.hypot(dx, dy);
  if (moved < DRAG_THRESHOLD_PX && dev) {
    dev.position.x = dragState.startX;
    dev.position.y = dragState.startY;
  }
  state.selectedDeviceId = dragState.deviceId;
  state.selectedConnectionId = null;
  dragState = null;
  canvas.classList.remove('moving');
  renderDevices();
  renderCables();
  renderPortsEditor();
  updateRemoveCableButton();
}

function deleteSelectedDevice() {
  if (!state.selectedDeviceId) return;
  const id = state.selectedDeviceId;
  state.devices = state.devices.filter((d) => d.id !== id);
  state.connections = state.connections.filter((c) => c.from_device_id !== id && c.to_device_id !== id);
  state.selectedDeviceId = null;
  state.selectedConnectionId = null;
  renderDevices();
  renderCables();
  renderPortsEditor();
}

function deleteSelectedConnection() {
  if (!state.selectedConnectionId) return;
  state.connections = state.connections.filter((c) => c.id !== state.selectedConnectionId);
  state.selectedConnectionId = null;
  renderCables();
  updateRemoveCableButton();
}

function updateRemoveCableButton() {
  const btn = document.getElementById('btn-remove-cable');
  if (btn) btn.disabled = !state.selectedConnectionId;
}

function onPointerMove(evt) {
  if (!dragState) return;
  const pt = svgPoint(evt);
  if (dragState.type === 'cable') updateRubberBand(pt);
  else if (dragState.type === 'move') updateDeviceMove(pt);
}

function onPointerUp(evt) {
  if (!dragState) return;
  const inCanvas = evt.target instanceof Node && canvas.contains(evt.target);
  if (dragState.type === 'cable') {
    const inputPort = inCanvas ? evt.target.closest('.port-input') : null;
    const g = inCanvas ? evt.target.closest('[data-device-id]') : null;
    if (inputPort && g) {
      endCableDrag(g.dataset.deviceId, inputPort.dataset.port || '');
    } else {
      dragState = null;
      hideRubberBand();
      canvas.classList.remove('drawing');
      document.querySelectorAll('.device-block.drag-source').forEach((el) => el.classList.remove('drag-source'));
    }
  } else if (dragState.type === 'move') {
    endDeviceMove();
  }
  document.removeEventListener('mousemove', onPointerMove);
  document.removeEventListener('mouseup', onPointerUp);
}

function setupCanvasListeners() {
  canvas.addEventListener('mousedown', (evt) => {
    const connectionId = evt.target.dataset?.connectionId;
    const port = evt.target.closest('.device-port');
    const g = evt.target.closest('[data-device-id]');
    if (connectionId) {
      state.selectedConnectionId = connectionId;
      state.selectedDeviceId = null;
      renderDevices();
      renderCables();
      renderPortsEditor();
      updateRemoveCableButton();
      return;
    }
    if (!g) {
      state.selectedDeviceId = null;
      state.selectedConnectionId = null;
      renderDevices();
      renderCables();
      renderPortsEditor();
      updateRemoveCableButton();
      return;
    }
    evt.preventDefault();
    const pt = svgPoint(evt);
    state.selectedConnectionId = null;
    updateRemoveCableButton();
    if (evt.shiftKey && port && port.dataset.portIo === 'output') {
      startCableDrag(g.dataset.deviceId, port.dataset.port || '', pt);
    } else if (!port || port.dataset.portIo !== 'output') {
      startDeviceMove(g.dataset.deviceId, pt);
    }
    document.addEventListener('mousemove', onPointerMove);
    document.addEventListener('mouseup', onPointerUp);
  });

  canvas.addEventListener('mouseleave', () => {
    if (dragState?.type === 'cable') updateRubberBand(svgPoint({ clientX: 0, clientY: 0 }));
  });
}

const DEVICE_LABELS = { dac: 'DAC', turntable: 'Turntable', phono: 'Phono pre-amp', headphone_amp: 'Headphone amp', eq: 'EQ', speaker: 'Speaker' };

const DEFAULT_PORTS = {
  dac: { input_ports: [], output_ports: ['Out'] },
  turntable: { input_ports: [], output_ports: ['Phono'] },
  phono: { input_ports: ['Phono'], output_ports: ['Out'] },
  headphone_amp: { input_ports: ['In'], output_ports: ['Phones'] },
  eq: { input_ports: ['In'], output_ports: ['Out'] },
  speaker: { input_ports: ['In'], output_ports: [] },
};

function renderPortsEditor() {
  const panel = document.getElementById('ports-editor');
  const dev = state.selectedDeviceId ? getDeviceById(state.selectedDeviceId) : null;
  if (!panel) return;
  if (!dev) {
    panel.classList.add('hidden');
    return;
  }
  panel.classList.remove('hidden');
  panel.querySelector('.ports-editor-label').textContent = dev.label || dev.type;
  const inp = panel.querySelector('#ports-inputs');
  const out = panel.querySelector('#ports-outputs');
  inp.value = (dev.input_ports || []).join(', ');
  out.value = (dev.output_ports || []).join(', ');
}

function applyPortsFromEditor() {
  const dev = state.selectedDeviceId ? getDeviceById(state.selectedDeviceId) : null;
  if (!dev) return;
  const inp = document.getElementById('ports-inputs');
  const out = document.getElementById('ports-outputs');
  if (!inp || !out) return;
  dev.input_ports = inp.value.split(',').map((s) => s.trim()).filter(Boolean);
  dev.output_ports = out.value.split(',').map((s) => s.trim()).filter(Boolean);
  renderDevices();
  renderCables();
}

document.addEventListener('keydown', (evt) => {
  if ((evt.key === 'Delete' || evt.key === 'Backspace') && !evt.target.matches('input, select, textarea')) {
    evt.preventDefault();
    if (state.selectedConnectionId) {
      deleteSelectedConnection();
    } else {
      deleteSelectedDevice();
    }
  }
});

document.getElementById('btn-delete').addEventListener('click', () => {
  deleteSelectedDevice();
  renderPortsEditor();
});

document.getElementById('btn-remove-cable').addEventListener('click', () => {
  deleteSelectedConnection();
});

document.getElementById('btn-apply-ports').addEventListener('click', () => {
  applyPortsFromEditor();
});

document.getElementById('add-device-select').addEventListener('change', (evt) => {
  const type = evt.target.value;
  if (!type) return;
  const defaults = DEFAULT_PORTS[type] || { input_ports: [], output_ports: [] };
  state.devices.push({
    id: genId(),
    type,
    label: DEVICE_LABELS[type] || type,
    position: { x: 80 + state.devices.length * 20, y: 80 + state.devices.length * 20 },
    input_ports: [...(defaults.input_ports || [])],
    output_ports: [...(defaults.output_ports || [])],
  });
  renderDevices();
  renderPortsEditor();
  evt.target.value = '';
});

function setStateFromLayout(layout) {
  state.layoutId = layout.id;
  state.name = layout.name || 'Untitled layout';
  state.devices = (layout.devices || []).map((d) => ({
    ...d,
    input_ports: d.input_ports || [],
    output_ports: d.output_ports || [],
  }));
  state.connections = layout.connections || [];
  state.selectedDeviceId = null;
  state.selectedConnectionId = null;
  const nameEl = document.getElementById('layout-name');
  if (nameEl) nameEl.value = state.name;
  renderDevices();
  renderCables();
  renderPortsEditor();
  updateRemoveCableButton();
  updateDeleteLayoutButton();
}

function newLayout() {
  state.layoutId = null;
  state.name = 'Untitled layout';
  state.devices = [];
  state.connections = [];
  state.selectedDeviceId = null;
  state.selectedConnectionId = null;
  const nameEl = document.getElementById('layout-name');
  if (nameEl) nameEl.value = state.name;
  const loadEl = document.getElementById('load-layout-select');
  if (loadEl) loadEl.selectedIndex = 0;
  renderDevices();
  renderCables();
  renderPortsEditor();
  updateRemoveCableButton();
  updateDeleteLayoutButton();
}

async function refreshLoadLayoutOptions() {
  const sel = document.getElementById('load-layout-select');
  if (!sel) return;
  try {
    const res = await fetch(`${API_BASE}/layouts`);
    if (!res.ok) return;
    const layouts = await res.json();
    if (!Array.isArray(layouts)) return;
    sel.innerHTML = '';
    const place = document.createElement('option');
    place.value = '';
    place.textContent = '— Select to load —';
    sel.appendChild(place);
    layouts.forEach((l) => {
      const opt = document.createElement('option');
      opt.value = l.id;
      opt.textContent = l.name || l.id;
      sel.appendChild(opt);
    });
  } catch (_) {
    // Leave existing options unchanged if fetch fails (e.g. backend not ready)
  }
}

document.getElementById('layout-name').addEventListener('input', (evt) => {
  state.name = evt.target.value.trim() || 'Untitled layout';
});

document.getElementById('layout-name').addEventListener('blur', (evt) => {
  evt.target.value = state.name;
});

document.getElementById('btn-save').addEventListener('click', async () => {
  state.name = document.getElementById('layout-name').value.trim() || state.name;
  const body = {
    id: state.layoutId,
    name: state.name,
    devices: state.devices,
    connections: state.connections,
  };
  try {
    const res = state.layoutId
      ? await fetch(`${API_BASE}/layouts/${state.layoutId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      : await fetch(`${API_BASE}/layouts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(await res.text());
    const layout = await res.json();
    state.layoutId = layout.id;
    state.name = layout.name;
    document.getElementById('layout-name').value = state.name;
    await refreshLoadLayoutOptions();
    alert('Saved.');
  } catch (e) {
    alert('Save failed: ' + e.message);
  }
});

document.getElementById('btn-new').addEventListener('click', () => {
  newLayout();
});

document.getElementById('load-layout-select').addEventListener('focus', async () => {
  await refreshLoadLayoutOptions();
});
document.getElementById('load-layout-select').addEventListener('mousedown', async () => {
  await refreshLoadLayoutOptions();
});

document.getElementById('load-layout-select').addEventListener('change', async (evt) => {
  const id = evt.target.value;
  if (!id) return;
  try {
    const res = await fetch(`${API_BASE}/layouts/${id}`);
    if (!res.ok) throw new Error(await res.text());
    const layout = await res.json();
    setStateFromLayout(layout);
    evt.target.selectedIndex = 0;
  } catch (e) {
    alert('Load failed: ' + e.message);
  }
});

document.getElementById('btn-delete-layout').addEventListener('click', async () => {
  if (!state.layoutId) return;
  if (!confirm('Delete this layout from the server?')) return;
  try {
    const res = await fetch(`${API_BASE}/layouts/${state.layoutId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(await res.text());
    newLayout();
    await refreshLoadLayoutOptions();
  } catch (e) {
    alert('Delete failed: ' + e.message);
  }
});

function updateDeleteLayoutButton() {
  const btn = document.getElementById('btn-delete-layout');
  if (btn) btn.disabled = !state.layoutId;
}

hideRubberBand();
setupCanvasListeners();
renderDevices();
renderCables();
renderPortsEditor();
updateRemoveCableButton();
updateDeleteLayoutButton();
refreshLoadLayoutOptions();
setTimeout(refreshLoadLayoutOptions, 300);
