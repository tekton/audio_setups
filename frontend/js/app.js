/**
 * Audio gear layout — vanilla JS. Devices on SVG canvas; drag from one device
 * to another to create a cable (connection). State synced to backend.
 */

const API_BASE = 'http://localhost:7001';
const DEVICE_W = 120;
const DEVICE_H = 56;
const PORT_R = 5;
const LOCAL_STORAGE_KEY = 'audio_gear_layouts';
const STORAGE_MODE_KEY = 'audio_gear_storage_mode';
const CUSTOM_TYPES_KEY = 'audio_gear_device_types';
const PORT_TYPES_LOCAL_KEY = 'audio_gear_port_types';
const DEFAULT_PORT_TYPE = window.DEFAULT_PORT_TYPE || { type: 'audio', color: '#6b9b6b' };

let portTypesList = [DEFAULT_PORT_TYPE];

let state = {
  layoutId: null,
  name: 'Untitled layout',
  devices: [],
  connections: [],
  selectedDeviceId: null,
  selectedConnectionId: null,
  storageMode: (() => {
    try {
      const m = localStorage.getItem(STORAGE_MODE_KEY);
      return m === 'local' || m === 'server' ? m : 'local';
    } catch {
      return 'local';
    }
  })(),
};

// Storage abstraction: same interface for API and device storage (easy to add more backends later)
const storage = {
  server: {
    async listLayouts() {
      const res = await fetch(`${API_BASE}/layouts`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    async getLayout(id) {
      const res = await fetch(`${API_BASE}/layouts/${id}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    async saveLayout(layout) {
      const method = layout.id ? 'PUT' : 'POST';
      const url = layout.id ? `${API_BASE}/layouts/${layout.id}` : `${API_BASE}/layouts`;
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(layout) });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    async deleteLayout(id) {
      const res = await fetch(`${API_BASE}/layouts/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
    },
  },
  local: {
    _read() {
      try {
        const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    },
    _write(layouts) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(layouts));
    },
    async listLayouts() {
      return Promise.resolve(this._read().map((l) => ({ id: l.id, name: l.name || l.id })));
    },
    async getLayout(id) {
      const list = this._read();
      const found = list.find((l) => l.id === id);
      if (!found) throw new Error('Layout not found');
      return Promise.resolve(found);
    },
    async saveLayout(layout) {
      const list = this._read();
      const id = layout.id || `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const payload = { id, name: layout.name || 'Untitled layout', devices: layout.devices || [], connections: layout.connections || [] };
      const idx = list.findIndex((l) => l.id === id);
      if (idx >= 0) list[idx] = payload;
      else list.push(payload);
      this._write(list);
      return Promise.resolve(payload);
    },
    async deleteLayout(id) {
      const list = this._read().filter((l) => l.id !== id);
      this._write(list);
      return Promise.resolve();
    },
  },
};

function getStorage() {
  const mode = state.storageMode === 'local' ? 'local' : 'server';
  return storage[mode];
}

function syncStorageModeFromUI() {
  const sel = document.getElementById('storage-mode-select');
  if (sel && (sel.value === 'local' || sel.value === 'server')) state.storageMode = sel.value;
}

let dragState = null; // { type: 'cable', ... } | { type: 'move', deviceId, offsetX, offsetY, startX, startY }
let touchCableState = null; // { fromDeviceId, fromPort, fromPortType } for tap-based cable connections on mobile

const canvas = document.getElementById('canvas');
const devicesLayer = document.getElementById('devices-layer');
const cablesLayer = document.getElementById('cables-layer');
const rubberBand = document.getElementById('rubber-band');
const svgNs = 'http://www.w3.org/2000/svg';

function genId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function getDeviceById(id) {
  return state.devices.find((d) => d.id === id);
}

function normalizePorts(ports) {
  if (!ports || !ports.length) return [];
  return ports.map((p) => (typeof p === 'string' ? { name: p, type: 'audio' } : { name: p.name || '', type: p.type || 'audio' }));
}

function getPortTypeColor(typeSlug) {
  const pt = portTypesList.find((p) => p.type === (typeSlug || 'audio'));
  return pt ? pt.color : DEFAULT_PORT_TYPE.color;
}

async function loadPortTypes() {
  let api = [];
  try {
    const res = await fetch(`${API_BASE}/port-types`);
    if (res.ok) api = await res.json();
  } catch (_) {}
  try {
    const raw = localStorage.getItem(PORT_TYPES_LOCAL_KEY);
    const local = raw ? JSON.parse(raw) : [];
    const byId = new Map();
    [DEFAULT_PORT_TYPE, ...api].forEach((t) => byId.set(t.id, t));
    local.forEach((t) => { if (t.id !== DEFAULT_PORT_TYPE.id) byId.set(t.id, t); });
    portTypesList = Array.from(byId.values());
  } catch (_) {
    portTypesList = [DEFAULT_PORT_TYPE, ...api];
  }
}

function getPortByName(device, portName, io) {
  const ports = normalizePorts(io === 'input' ? device.input_ports : device.output_ports);
  return ports.find((p) => p.name === portName);
}

function getDeviceCenter(device) {
  return {
    x: device.position.x + DEVICE_W / 2,
    y: device.position.y + DEVICE_H / 2,
  };
}

function getPortPosition(device, portName, io) {
  const ports = normalizePorts(io === 'input' ? device.input_ports : device.output_ports);
  const idx = ports.findIndex((p) => p.name === portName);
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
  const outPorts = normalizePorts(from.output_ports);
  const inPorts = normalizePorts(to.input_ports);
  const a = c.from_port && outPorts.some((p) => p.name === c.from_port)
    ? getPortPosition(from, c.from_port, 'output')
    : getDeviceCenter(from);
  const b = c.to_port && inPorts.some((p) => p.name === c.to_port)
    ? getPortPosition(to, c.to_port, 'input')
    : getDeviceCenter(to);
  return { a, b };
}

function renderDevices() {
  devicesLayer.innerHTML = '';
  state.devices.forEach((d) => {
    const inputs = normalizePorts(d.input_ports);
    const outputs = normalizePorts(d.output_ports);
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.dataset.deviceId = d.id;
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('class', 'device-block' + (d.id === state.selectedDeviceId ? ' selected' : ''));
    rect.setAttribute('x', d.position.x);
    rect.setAttribute('y', d.position.y);
    rect.setAttribute('width', DEVICE_W);
    rect.setAttribute('height', DEVICE_H);
    g.append(rect);
    inputs.forEach((p, i) => {
      const n = inputs.length;
      const x = d.position.x;
      const y = d.position.y + (n === 1 ? DEVICE_H / 2 : (i + 1) * (DEVICE_H / (n + 1)));
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('class', 'device-port port-input');
      circle.setAttribute('cx', x);
      circle.setAttribute('cy', y);
      circle.setAttribute('r', PORT_R);
      circle.style.fill = getPortTypeColor(p.type);
      circle.dataset.port = p.name;
      circle.dataset.portType = p.type || 'audio';
      circle.dataset.portIo = 'input';
      g.append(circle);
    });
    outputs.forEach((p, i) => {
      const n = outputs.length;
      const x = d.position.x + DEVICE_W;
      const y = d.position.y + (n === 1 ? DEVICE_H / 2 : (i + 1) * (DEVICE_H / (n + 1)));
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('class', 'device-port port-output');
      circle.setAttribute('cx', x);
      circle.setAttribute('cy', y);
      circle.setAttribute('r', PORT_R);
      circle.style.fill = getPortTypeColor(p.type);
      circle.dataset.port = p.name;
      circle.dataset.portType = p.type || 'audio';
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
  const defs = canvas.querySelector('defs');
  if (defs) {
    defs.querySelectorAll('marker.cable-marker').forEach((m) => m.remove());
  }
  cablesLayer.innerHTML = '';
  state.connections.forEach((c) => {
    const endpoints = getConnectionEndpoints(c);
    if (!endpoints) return;
    const { a, b } = endpoints;
    const portType = c.from_port_type || c.to_port_type || 'audio';
    const color = getPortTypeColor(portType);
    const markerId = 'arrowhead-cable-' + c.id;
    if (defs) {
      const marker = document.createElementNS(svgNs, 'marker');
      marker.setAttribute('id', markerId);
      marker.setAttribute('markerWidth', '10');
      marker.setAttribute('markerHeight', '7');
      marker.setAttribute('refX', '9');
      marker.setAttribute('refY', '3.5');
      marker.setAttribute('orient', 'auto');
      marker.classList.add('cable-marker');
      const poly = document.createElementNS(svgNs, 'polygon');
      poly.setAttribute('points', '0 0, 10 3.5, 0 7');
      poly.setAttribute('fill', color);
      marker.appendChild(poly);
      defs.appendChild(marker);
    }
    const line = document.createElementNS(svgNs, 'line');
    line.setAttribute('class', 'cable' + (c.id === state.selectedConnectionId ? ' selected' : ''));
    line.dataset.connectionId = c.id;
    line.setAttribute('x1', a.x);
    line.setAttribute('y1', a.y);
    line.setAttribute('x2', b.x);
    line.setAttribute('y2', b.y);
    line.setAttribute('marker-end', 'url(#' + markerId + ')');
    line.style.stroke = color;
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
  const rubberArrow = canvas.querySelector('#arrowhead polygon');
  if (rubberArrow) rubberArrow.setAttribute('fill', DEFAULT_PORT_TYPE.color || '#6b9b6b');
}

function svgPoint(evt) {
  const pt = canvas.createSVGPoint();
  // Handle both mouse and touch events
  const clientX = evt.clientX !== undefined ? evt.clientX : (evt.touches?.[0]?.clientX ?? 0);
  const clientY = evt.clientY !== undefined ? evt.clientY : (evt.touches?.[0]?.clientY ?? 0);
  pt.x = clientX;
  pt.y = clientY;
  return pt.matrixTransform(canvas.getScreenCTM().inverse());
}

function startCableDrag(deviceId, portName, portType, pt) {
  const dev = getDeviceById(deviceId);
  if (!dev) return;
  const start = portName ? getPortPosition(dev, portName, 'output') : getDeviceCenter(dev);
  dragState = { type: 'cable', fromDeviceId: deviceId, fromPort: portName || '', fromPortType: portType || '', fromX: start.x, fromY: start.y };
  rubberBand.setAttribute('x1', start.x);
  rubberBand.setAttribute('y1', start.y);
  rubberBand.setAttribute('x2', start.x);
  rubberBand.setAttribute('y2', start.y);
  const color = getPortTypeColor(portType || 'audio');
  rubberBand.style.stroke = color;
  rubberBand.style.display = '';
  const rubberArrow = canvas.querySelector('#arrowhead polygon');
  if (rubberArrow) rubberArrow.setAttribute('fill', color);
  canvas.classList.add('drawing');
  document.querySelector(`[data-device-id="${deviceId}"] rect`)?.classList.add('drag-source');
}

function startDeviceMove(deviceId, pt, isTouchDrag = false) {
  const dev = getDeviceById(deviceId);
  if (!dev) return;
  const offsetX = pt.x - dev.position.x;
  const offsetY = pt.y - dev.position.y;
  dragState = { type: 'move', deviceId, offsetX, offsetY, startX: dev.position.x, startY: dev.position.y, isTouchDrag };
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

const PORT_MISMATCH_DURATION_MS = 3500;

function showPortTypeMismatchMessage() {
  const el = document.getElementById('canvas-message');
  if (!el) return;
  el.textContent = 'Port types don\'t match. Connect the same type (e.g. audio to audio).';
  el.className = 'canvas-message visible port-mismatch';
  clearTimeout(showPortTypeMismatchMessage._timeout);
  showPortTypeMismatchMessage._timeout = setTimeout(() => {
    el.className = 'canvas-message';
    el.textContent = '';
  }, PORT_MISMATCH_DURATION_MS);
}

function showCableConnectionModeMessage() {
  const el = document.getElementById('canvas-message');
  if (!el) return;
  el.textContent = 'Cable mode active. Tap an input port to connect.';
  el.className = 'canvas-message visible cable-mode';
}

function clearCableConnectionMode() {
  const el = document.getElementById('canvas-message');
  if (el && el.classList.contains('cable-mode')) {
    el.className = 'canvas-message';
    el.textContent = '';
  }
  touchCableState = null;
  hideRubberBand();
  canvas.classList.remove('drawing');
  document.querySelectorAll('.device-block.drag-source').forEach((el) => el.classList.remove('drag-source'));
}

function endCableDrag(toDeviceId, toPortName, toPortType) {
  if (!dragState || dragState.type !== 'cable' || !toDeviceId || toDeviceId === dragState.fromDeviceId) {
    dragState = null;
    hideRubberBand();
    canvas.classList.remove('drawing');
    document.querySelectorAll('.device-block.drag-source').forEach((el) => el.classList.remove('drag-source'));
    return;
  }
  const fromType = (dragState.fromPortType || 'audio').toLowerCase();
  const toType = (toPortType || 'audio').toLowerCase();
  if (fromType !== toType) {
    showPortTypeMismatchMessage();
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
    from_port_type: dragState.fromPortType || '',
    to_port_type: toPortType || '',
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
  
  // On mobile: only select if it's a tap (no movement)
  // On desktop: always select
  const isTouchDrag = dragState.isTouchDrag;
  if (moved > DRAG_THRESHOLD_PX) {
    // It was a drag, not a tap
    if (!isTouchDrag) {
      // Desktop drag - keep device selected
      state.selectedDeviceId = dragState.deviceId;
    }
    // Touch drag - don't select to avoid ports editor popping up
  } else {
    // It was a small movement/tap - select the device
    if (dev) {
      dev.position.x = dragState.startX;
      dev.position.y = dragState.startY;
    }
    state.selectedDeviceId = dragState.deviceId;
  }
  
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
      endCableDrag(g.dataset.deviceId, inputPort.dataset.port || '', inputPort.dataset.portType || '');
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
  // Track touch state for move/cable operations
  let touchStartPoint = null;
  let touchStartTime = null;
  
  // Central touch move handler for both device move and cable mode
  function onTouchMove(evt) {
    if (dragState && dragState.type === 'move') {
      const pt = svgPoint(evt);
      updateDeviceMove(pt);
    } else if (touchCableState && evt.touches.length > 0) {
      const pt = svgPoint(evt);
      const dev = getDeviceById(touchCableState.fromDeviceId);
      if (dev) {
        const start = getPortPosition(dev, touchCableState.fromPort, 'output');
        showRubberBand(start.x, start.y, pt.x, pt.y);
      }
    }
  }
  
  // Central touch end handler
  function onTouchEnd(evt) {
    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('touchend', onTouchEnd);
    
    if (dragState && dragState.type === 'move') {
      endDeviceMove();
    }
  }
  
  // Mouse events for desktop
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
      startCableDrag(g.dataset.deviceId, port.dataset.port || '', port.dataset.portType || '', pt);
    } else if (!port || port.dataset.portIo !== 'output') {
      startDeviceMove(g.dataset.deviceId, pt);
    }
    document.addEventListener('mousemove', onPointerMove);
    document.addEventListener('mouseup', onPointerUp);
  });

  canvas.addEventListener('mouseleave', () => {
    if (dragState?.type === 'cable') updateRubberBand(svgPoint({ clientX: 0, clientY: 0 }));
  });

  // Touch events for mobile/tablet
  canvas.addEventListener('touchstart', (evt) => {
    if (evt.touches.length !== 1) {
      clearCableConnectionMode();
      return;
    }
    
    const touch = evt.touches[0];
    touchStartPoint = { x: touch.clientX, y: touch.clientY };
    touchStartTime = Date.now();
    
    const touchTarget = document.elementFromPoint(touch.clientX, touch.clientY);
    const connectionId = touchTarget?.dataset?.connectionId;
    const port = touchTarget?.closest('.device-port');
    const g = touchTarget?.closest('[data-device-id]');
    
    // If touching a cable, select it and don't start move/cable
    if (connectionId) {
      state.selectedConnectionId = connectionId;
      state.selectedDeviceId = null;
      renderDevices();
      renderCables();
      renderPortsEditor();
      updateRemoveCableButton();
      return;
    }
    
    // If touching a port and in cable mode, complete the connection on touchend
    if (touchCableState && port && port.dataset.portIo === 'input' && g) {
      evt.preventDefault();
      // Mark that we're attempting a connection (will complete in touchend)
      touchCableState.targetDeviceId = g.dataset.deviceId;
      touchCableState.targetPortName = port.dataset.port || '';
      touchCableState.targetPortType = port.dataset.portType || '';
      return;
    }
    
    // If touching an output port and not in cable mode, start cable mode
    if (port && port.dataset.portIo === 'output' && g && !touchCableState) {
      evt.preventDefault();
      const deviceId = g.dataset.deviceId;
      const portName = port.dataset.port || '';
      const portType = port.dataset.portType || '';
      
      touchCableState = {
        fromDeviceId: deviceId,
        fromPort: portName,
        fromPortType: portType,
      };
      
      const dev = getDeviceById(deviceId);
      if (dev) {
        const start = getPortPosition(dev, portName, 'output');
        showRubberBand(start.x, start.y, start.x, start.y);
        const color = getPortTypeColor(portType || 'audio');
        rubberBand.style.stroke = color;
        rubberBand.style.display = '';
        const rubberArrow = canvas.querySelector('#arrowhead polygon');
        if (rubberArrow) rubberArrow.setAttribute('fill', color);
        canvas.classList.add('drawing');
        document.querySelector(`[data-device-id="${deviceId}"] rect`)?.classList.add('drag-source');
        showCableConnectionModeMessage();
        
        // Set up touch move/end listeners for cable mode
        document.addEventListener('touchmove', onTouchMove, { passive: false });
        document.addEventListener('touchend', onTouchEnd);
      }
      return;
    }
    
    // If touching a device body (not a port), start device move preparation
    // Don't select yet - only select if it's a tap without movement
    if (g && !port && !touchCableState) {
      evt.preventDefault();
      const pt = svgPoint(evt);
      startDeviceMove(g.dataset.deviceId, pt, true); // true = isTouchDrag
      // Set up touch move/end listeners for device move
      document.addEventListener('touchmove', onTouchMove, { passive: false });
      document.addEventListener('touchend', onTouchEnd);
      return;
    }
    
    // If background tap, deselect
    if (!g && !touchCableState) {
      state.selectedDeviceId = null;
      state.selectedConnectionId = null;
      renderDevices();
      renderCables();
      renderPortsEditor();
      updateRemoveCableButton();
    }
  });
  
  // Handle cable connection completion on touch end
  canvas.addEventListener('touchend', (evt) => {
    if (touchCableState && touchCableState.targetDeviceId) {
      evt.preventDefault();
      
      const toDeviceId = touchCableState.targetDeviceId;
      const toPortName = touchCableState.targetPortName || '';
      const toPortType = touchCableState.targetPortType || '';
      
      if (toDeviceId === touchCableState.fromDeviceId) {
        clearCableConnectionMode();
        return;
      }
      
      // Validate port types
      const fromType = (touchCableState.fromPortType || 'audio').toLowerCase();
      const toType = (toPortType || 'audio').toLowerCase();
      if (fromType !== toType) {
        showPortTypeMismatchMessage();
        clearCableConnectionMode();
        return;
      }
      
      // Create the connection
      state.connections.push({
        id: genId(),
        from_device_id: touchCableState.fromDeviceId,
        to_device_id: toDeviceId,
        from_port: touchCableState.fromPort || '',
        to_port: toPortName || '',
        from_port_type: touchCableState.fromPortType || '',
        to_port_type: toPortType || '',
      });
      
      clearCableConnectionMode();
      renderCables();
      return;
    }
  });
}


const DEVICE_LABELS = { dac: 'DAC', turntable: 'Turntable', phono: 'Phono pre-amp', headphone_amp: 'Headphone amp', eq: 'EQ', speaker: 'Speaker' };

const DEFAULT_PORTS = {
  dac: { input_ports: [], output_ports: [{ name: 'Out', type: 'audio' }] },
  turntable: { input_ports: [], output_ports: [{ name: 'Phono', type: 'phono' }] },
  phono: { input_ports: [{ name: 'Phono', type: 'phono' }], output_ports: [{ name: 'Out', type: 'audio' }] },
  headphone_amp: { input_ports: [{ name: 'In', type: 'audio' }], output_ports: [{ name: 'Phones', type: 'audio' }] },
  eq: { input_ports: [{ name: 'In', type: 'audio' }], output_ports: [{ name: 'Out', type: 'audio' }] },
  speaker: { input_ports: [{ name: 'In', type: 'audio' }], output_ports: [] },
};

let customDeviceTypes = [];

function getCustomDeviceTypes() {
  try {
    const raw = localStorage.getItem(CUSTOM_TYPES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function loadCustomDeviceTypes() {
  customDeviceTypes = getCustomDeviceTypes();
  try {
    const res = await fetch(`${API_BASE}/device-types`);
    if (res.ok) {
      const api = await res.json();
      const byId = new Map(customDeviceTypes.map((t) => [t.id, t]));
      api.forEach((t) => byId.set(t.id, t));
      customDeviceTypes = Array.from(byId.values());
    }
  } catch (_) {}
  return customDeviceTypes;
}

function refreshAddDeviceDropdown() {
  const sel = document.getElementById('add-device-select');
  if (!sel) return;
  const builtIn = [
    { value: 'dac', label: 'DAC' },
    { value: 'turntable', label: 'Turntable' },
    { value: 'phono', label: 'Phono pre-amp' },
    { value: 'headphone_amp', label: 'Headphone amp' },
    { value: 'eq', label: 'EQ' },
    { value: 'speaker', label: 'Speaker' },
  ];
  sel.innerHTML = '';
  const empty = document.createElement('option');
  empty.value = '';
  empty.textContent = '— choose type —';
  sel.appendChild(empty);
  builtIn.forEach((o) => {
    const opt = document.createElement('option');
    opt.value = o.value;
    opt.textContent = o.label;
    sel.appendChild(opt);
  });
  customDeviceTypes.forEach((t) => {
    const opt = document.createElement('option');
    opt.value = `template:${t.id}`;
    opt.textContent = (t.label || t.name) + ' (custom)';
    sel.appendChild(opt);
  });
}

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
  const fromTemplate = !!(dev.templateId || dev.template_id);
  panel.classList.toggle('ports-readonly', fromTemplate);
  if (fromTemplate) {
    const inPorts = normalizePorts(dev.input_ports);
    const outPorts = normalizePorts(dev.output_ports);
    inp.value = inPorts.map((p) => `${p.name} (${p.type})`).join(', ');
    out.value = outPorts.map((p) => `${p.name} (${p.type})`).join(', ');
    inp.readOnly = true;
    out.readOnly = true;
    panel.querySelector('#btn-apply-ports').style.display = 'none';
  } else {
    const inPorts = normalizePorts(dev.input_ports);
    const outPorts = normalizePorts(dev.output_ports);
    inp.value = inPorts.map((p) => p.name).join(', ');
    out.value = outPorts.map((p) => p.name).join(', ');
    inp.readOnly = false;
    out.readOnly = false;
    panel.querySelector('#btn-apply-ports').style.display = '';
  }
}

function applyPortsFromEditor() {
  const dev = state.selectedDeviceId ? getDeviceById(state.selectedDeviceId) : null;
  if (!dev || dev.templateId || dev.template_id) return;
  const inp = document.getElementById('ports-inputs');
  const out = document.getElementById('ports-outputs');
  if (!inp || !out) return;
  const inNames = inp.value.split(',').map((s) => s.trim()).filter(Boolean);
  const outNames = out.value.split(',').map((s) => s.trim()).filter(Boolean);
  dev.input_ports = inNames.map((name) => ({ name, type: 'audio' }));
  dev.output_ports = outNames.map((name) => ({ name, type: 'audio' }));
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
  if (type.startsWith('template:')) {
    const templateId = type.slice(9);
    const template = customDeviceTypes.find((t) => t.id === templateId);
    if (!template) return;
    const input_ports = (template.input_ports || []).map((p) => (typeof p === 'string' ? { name: p, type: 'audio' } : { name: p.name, type: p.type || 'audio' }));
    const output_ports = (template.output_ports || []).map((p) => (typeof p === 'string' ? { name: p, type: 'audio' } : { name: p.name, type: p.type || 'audio' }));
    state.devices.push({
      id: genId(),
      type: template.name || templateId,
      label: template.label || template.name || templateId,
      position: { x: 80 + state.devices.length * 20, y: 80 + state.devices.length * 20 },
      input_ports,
      output_ports,
      templateId,
    });
  } else {
    const defaults = DEFAULT_PORTS[type] || { input_ports: [], output_ports: [] };
    const inp = (defaults.input_ports || []).map((p) => (typeof p === 'string' ? { name: p, type: 'audio' } : p));
    const out = (defaults.output_ports || []).map((p) => (typeof p === 'string' ? { name: p, type: 'audio' } : p));
    state.devices.push({
      id: genId(),
      type,
      label: DEVICE_LABELS[type] || type,
      position: { x: 80 + state.devices.length * 20, y: 80 + state.devices.length * 20 },
      input_ports: [...inp],
      output_ports: [...out],
    });
  }
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
  syncStorageModeFromUI();
  try {
    const adapter = state.storageMode === 'local' ? storage.local : storage.server;
    const layouts = await adapter.listLayouts();
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
    // Leave existing options unchanged if list fails (e.g. backend not ready)
  }
}

document.getElementById('storage-mode-select').value = state.storageMode;

const toolbarSaveLoad = document.getElementById('toolbar-save-load');
const btnToggleSaveLoad = document.getElementById('btn-toggle-save-load');
if (btnToggleSaveLoad && toolbarSaveLoad) {
  btnToggleSaveLoad.addEventListener('click', () => {
    const isHidden = toolbarSaveLoad.hidden;
    toolbarSaveLoad.hidden = !isHidden;
    btnToggleSaveLoad.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
  });
}

document.getElementById('storage-mode-select').addEventListener('change', async (evt) => {
  state.storageMode = evt.target.value;
  try {
    localStorage.setItem(STORAGE_MODE_KEY, state.storageMode);
  } catch (_) {}
  await refreshLoadLayoutOptions();
});

document.getElementById('layout-name').addEventListener('input', (evt) => {
  state.name = evt.target.value.trim() || 'Untitled layout';
});

document.getElementById('layout-name').addEventListener('blur', (evt) => {
  evt.target.value = state.name;
});

document.getElementById('btn-save').addEventListener('click', async () => {
  syncStorageModeFromUI();
  state.name = document.getElementById('layout-name').value.trim() || state.name;
  const devices = state.devices.map((d) => ({ ...d, template_id: d.template_id ?? d.templateId ?? null }));
  const body = { id: state.layoutId, name: state.name, devices, connections: state.connections };
  try {
    const adapter = state.storageMode === 'local' ? storage.local : storage.server;
    const layout = await adapter.saveLayout(body);
    state.layoutId = layout.id;
    state.name = layout.name;
    document.getElementById('layout-name').value = state.name;
    await refreshLoadLayoutOptions();
    updateDeleteLayoutButton();
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
  syncStorageModeFromUI();
  try {
    const adapter = state.storageMode === 'local' ? storage.local : storage.server;
    const layout = await adapter.getLayout(id);
    setStateFromLayout(layout);
    evt.target.selectedIndex = 0;
  } catch (e) {
    alert('Load failed: ' + e.message);
  }
});

document.getElementById('btn-delete-layout').addEventListener('click', async () => {
  if (!state.layoutId) return;
  syncStorageModeFromUI();
  const msg = state.storageMode === 'local' ? 'Delete this layout from device storage?' : 'Delete this layout from the server?';
  if (!confirm(msg)) return;
  try {
    const adapter = state.storageMode === 'local' ? storage.local : storage.server;
    await adapter.deleteLayout(state.layoutId);
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
loadPortTypes().then(() => {
  renderDevices();
  renderCables();
});
updateRemoveCableButton();
updateDeleteLayoutButton();
loadCustomDeviceTypes().then(() => refreshAddDeviceDropdown());
refreshLoadLayoutOptions();
setTimeout(refreshLoadLayoutOptions, 300);
