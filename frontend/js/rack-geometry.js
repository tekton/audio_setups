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
