/**
 * Rack geometry — pure functions (no DOM, no app state) so they can be unit tested.
 * Racks: { id, width_in, height_u, position }. Devices: { id, width_in, height_u, rack_id, rack_u, rack_x, position }.
 * rack_u is the lowest occupied U (1 = bottom); rack_x is inches from the rack's left rail.
 */

export const DEVICE_W = 120;
export const DEVICE_H = 56;
// Rack drawing scale (visual, not to-scale between width and height): 1 inch = INCH_PX wide, 1U = U_PX tall
export const INCH_PX = 24;
export const U_PX = 56;
export const RACK_PAD = 16; // side rails; also holds the shared-row asterisk
export const RACK_HEADER = 24;

export function getRackSize(rack) {
  return { w: rack.width_in * INCH_PX + 2 * RACK_PAD, h: RACK_HEADER + rack.height_u * U_PX + RACK_PAD };
}

// Rack-scale devices are drawn at their physical size; free devices keep the legacy box.
export function getDeviceSize(device, rackScale) {
  if (!rackScale) return { w: DEVICE_W, h: DEVICE_H };
  return { w: (device.width_in || 19) * INCH_PX, h: (device.height_u || 1) * U_PX };
}

// Racked devices derive their position from the rack and slot; free devices use their own.
export function getDevicePosition(device, racks) {
  const rack = device.rack_id ? racks.find((r) => r.id === device.rack_id) : null;
  if (!rack) return device.position;
  const topU = device.rack_u + (device.height_u || 1) - 1;
  return {
    x: rack.position.x + RACK_PAD + (device.rack_x || 0) * INCH_PX,
    y: rack.position.y + RACK_HEADER + (rack.height_u - topU) * U_PX,
  };
}

// Returns an error message if `device` can't sit at `rackU` / `rackX` in `rack`, else null.
// Devices may share a row as long as their rectangles don't overlap.
export function checkRackFit(rack, device, rackU, rackX, devices) {
  const h = device.height_u || 1;
  const w = device.width_in || 19;
  if (w > rack.width_in) return `Too wide: ${w}" device in a ${rack.width_in}" rack.`;
  if (rackX < 0 || rackX + w > rack.width_in) return `Doesn't fit across: ${w}" device at ${rackX}" in a ${rack.width_in}" rack.`;
  if (rackU < 1 || rackU + h - 1 > rack.height_u) return `Doesn't fit: ${h}U device in a ${rack.height_u}U rack.`;
  const clash = devices.some((o) => o.id !== device.id && o.rack_id === rack.id
    && o.rack_u <= rackU + h - 1 && rackU <= o.rack_u + (o.height_u || 1) - 1
    && (o.rack_x || 0) < rackX + w && rackX < (o.rack_x || 0) + (o.width_in || 19));
  return clash ? 'That slot is taken by another device.' : null;
}

export function findRackAtPoint(racks, pt) {
  return racks.find((r) => {
    const { w, h } = getRackSize(r);
    return pt.x >= r.position.x && pt.x <= r.position.x + w && pt.y >= r.position.y && pt.y <= r.position.y + h;
  });
}

// Nearest slot (U and whole inches from the left rail) for a dragged free device's top-left corner, clamped to the rack.
export function slotForDevice(rack, device) {
  const h = device.height_u || 1;
  const w = device.width_in || 19;
  const row = Math.round((device.position.y - (rack.position.y + RACK_HEADER)) / U_PX);
  const topRow = Math.max(0, Math.min(rack.height_u - h, row));
  const inch = Math.round((device.position.x - (rack.position.x + RACK_PAD)) / INCH_PX);
  return { rack_u: rack.height_u - topRow - h + 1, rack_x: Math.max(0, Math.min(rack.width_in - w, inch)) };
}

// U rows of `rack` that hold more than one device (they need a shelf or custom plate), as { u, count }.
export function sharedRows(rack, devices) {
  const rows = [];
  for (let u = 1; u <= rack.height_u; u++) {
    const count = devices.filter((d) => d.rack_id === rack.id && d.rack_u <= u && u <= d.rack_u + (d.height_u || 1) - 1).length;
    if (count > 1) rows.push({ u, count });
  }
  return rows;
}

// Point of port number `index` (0-based) of `count` on a device box at `pos` with size `size`.
// Ports are evenly spaced: inputs on the top (or left) edge, outputs on the bottom (or right).
export function portPoint(pos, size, index, count, io, layout) {
  const t = (index + 1) / (count + 1);
  if (layout === 'sides') return { x: io === 'input' ? pos.x : pos.x + size.w, y: pos.y + t * size.h };
  return { x: pos.x + t * size.w, y: io === 'input' ? pos.y : pos.y + size.h };
}

// Does the segment a-b pass through the inside of `rect` ({x, y, w, h})? Touching an edge doesn't count.
export function segmentHitsRect(a, b, rect) {
  const x0 = rect.x + 1, y0 = rect.y + 1, x1 = rect.x + rect.w - 1, y1 = rect.y + rect.h - 1;
  if (x1 <= x0 || y1 <= y0) return false;
  let t0 = 0, t1 = 1;
  const dx = b.x - a.x, dy = b.y - a.y;
  for (const [p, q] of [[-dx, a.x - x0], [dx, x1 - a.x], [-dy, a.y - y0], [dy, y1 - a.y]]) {
    if (p === 0) { if (q < 0) return false; continue; }
    const r = q / p;
    if (p < 0) { if (r > t1) return false; t0 = Math.max(t0, r); } else { if (r < t0) return false; t1 = Math.min(t1, r); }
  }
  return t0 < t1;
}

const onTopOrBottomEdge = (p, r) => Math.abs(p.y - r.y) < 1.5 || Math.abs(p.y - (r.y + r.h)) < 1.5;

// Points a cable should follow from `a` to `b`. A straight line unless it would cut through a device
// ("rects" are every device box, { x, y, w, h }): then it runs along the seam out to a channel just outside
// the devices in its way, along that, and back in to the other port. Only for ports on a top or bottom edge
// (side ports keep straight cables). `lane` offsets the channel so several rerouted cables don't overlap.
export function cableRoute(a, b, rects, lane = 0) {
  const own = rects.filter((r) => onTopOrBottomEdge(a, r) && a.x >= r.x - 1 && a.x <= r.x + r.w + 1);
  const ownB = rects.filter((r) => onTopOrBottomEdge(b, r) && b.x >= r.x - 1 && b.x <= r.x + r.w + 1);
  if (!own.length || !ownB.length) return [a, b];
  const blockers = rects.filter((r) => segmentHitsRect(a, b, r));
  if (!blockers.length) return [a, b];
  const left = Math.min(...blockers.map((r) => r.x)) - 8 - lane * 4;
  const right = Math.max(...blockers.map((r) => r.x + r.w)) + 8 + lane * 4;
  const mid = (a.x + b.x) / 2;
  const x = Math.abs(mid - left) <= Math.abs(right - mid) ? left : right;
  return [a, { x, y: a.y }, { x, y: b.y }, b];
}

const widthClass = (w) => (w <= 6 ? 6 : w <= 10 ? 10 : 19);

// Signal-flow order of device ids: sources first (cables go from earlier to later where possible), ties and
// loops by position on the canvas, so stacked devices end up next to the ones they are cabled to.
function flowOrder(devices, connections) {
  const spatial = [...devices].sort((p, q) => (p.position?.x ?? 0) - (q.position?.x ?? 0) || (p.position?.y ?? 0) - (q.position?.y ?? 0) || String(p.id).localeCompare(String(q.id)));
  const ids = new Set(devices.map((d) => d.id));
  const edges = new Set(connections.filter((c) => c.from_device_id !== c.to_device_id && ids.has(c.from_device_id) && ids.has(c.to_device_id)).map((c) => `${c.from_device_id}\u0000${c.to_device_id}`));
  const indegree = new Map(spatial.map((d) => [d.id, 0]));
  edges.forEach((e) => { const to = e.split('\u0000')[1]; indegree.set(to, indegree.get(to) + 1); });
  const order = [];
  const done = new Set();
  while (order.length < spatial.length) {
    const next = spatial.find((d) => !done.has(d.id) && indegree.get(d.id) === 0) || spatial.find((d) => !done.has(d.id));
    done.add(next.id);
    order.push(next.id);
    edges.forEach((e) => { const [from, to] = e.split('\u0000'); if (from === next.id && !done.has(to)) indegree.set(to, indegree.get(to) - 1); });
  }
  return order;
}

// Turns a classic (freeform) layout into a rack layout: one rack per rack width the devices need (6", 10" or
// 19"), devices stacked top to bottom in signal-flow order, cables carried over unchanged.
export function convertClassicToRack(layout) {
  const devices = (layout.devices || []).map((d) => ({ ...d }));
  const byId = new Map(devices.map((d) => [d.id, d]));
  const ordered = flowOrder(devices, layout.connections || []).map((id) => byId.get(id));
  const widths = [...new Set(ordered.map((d) => widthClass(d.width_in || 19)))].sort((p, q) => p - q);
  let nextX = 80;
  const racks = widths.map((w) => {
    const group = ordered.filter((d) => widthClass(d.width_in || 19) === w);
    const rack = { id: `rack_${w}in`, label: `${w}" rack`, width_in: w, height_u: group.reduce((n, d) => n + (d.height_u || 1), 0), position: { x: nextX, y: 40 } };
    nextX += getRackSize(rack).w + 40;
    let used = 0;
    group.forEach((d) => {
      const h = d.height_u || 1;
      d.rack_id = rack.id;
      d.rack_u = rack.height_u - used - h + 1;
      d.rack_x = 0;
      d.width_in = d.width_in || 19;
      d.height_u = h;
      delete d.port_layout;
      used += h;
    });
    return rack;
  });
  devices.forEach((d) => { d.position = { ...getDevicePosition(d, racks) }; });
  return { ...layout, id: null, devices, racks, connections: (layout.connections || []).map((c) => ({ ...c })), port_layout: 'top_bottom', mode: 'rack' };
}
