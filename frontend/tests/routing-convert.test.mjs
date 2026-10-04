import { U_PX, getDevicePosition, getRackSize, checkRackFit, portPoint, segmentHitsRect, cableRoute, convertClassicToRack } from '../js/rack-geometry.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const readJson = (file) => JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', file), 'utf8'));

describe('segmentHitsRect', () => {
  const r = { x: 100, y: 100, w: 100, h: 50 };
  test('a line through the middle hits; one that misses or only touches an edge does not', () => {
    expect(segmentHitsRect({ x: 150, y: 0 }, { x: 150, y: 300 }, r)).toBe(true);
    expect(segmentHitsRect({ x: 0, y: 125 }, { x: 300, y: 125 }, r)).toBe(true);
    expect(segmentHitsRect({ x: 0, y: 0 }, { x: 90, y: 300 }, r)).toBe(false);
    expect(segmentHitsRect({ x: 0, y: 100 }, { x: 300, y: 100 }, r)).toBe(false); // along the top edge
    expect(segmentHitsRect({ x: 150, y: 150 }, { x: 150, y: 400 }, r)).toBe(false); // starts on the bottom edge, goes away
  });
  test('a segment that ends before reaching the box does not hit', () => {
    expect(segmentHitsRect({ x: 150, y: 0 }, { x: 150, y: 90 }, r)).toBe(false);
  });
});

describe('cableRoute', () => {
  // three 1U devices stacked: A (top), B, C (bottom); output on a device's bottom edge, input on its top edge
  const box = (i) => ({ x: 100, y: 100 + i * U_PX, w: 120, h: U_PX });
  const rects = [box(0), box(1), box(2)];
  const out = (i) => ({ x: 160, y: box(i).y + U_PX });
  const inn = (i) => ({ x: 160, y: box(i).y });

  test('neighbours stay a straight line along the seam', () => {
    expect(cableRoute(out(0), inn(1), rects)).toEqual([out(0), inn(1)]);
  });

  test('a cable that would cross a device in between goes around the side instead', () => {
    const route = cableRoute(out(0), inn(2), rects);
    expect(route).toHaveLength(4);
    expect(route[0]).toEqual(out(0));
    expect(route[3]).toEqual(inn(2));
    expect(route[1].x).toBe(route[2].x);
    expect(route[1].x).toBeLessThan(100); // outside the devices' left edge
    expect(route[1].y).toBe(out(0).y);
    expect(route[2].y).toBe(inn(2).y);
    // no leg of the new route cuts through any device
    for (let i = 0; i < route.length - 1; i++) rects.forEach((r) => expect(segmentHitsRect(route[i], route[i + 1], r)).toBe(false));
  });

  test('a cable going up the stack (output below input) is rerouted too, not drawn through both devices', () => {
    const route = cableRoute(out(2), inn(0), rects);
    expect(route.length).toBe(4);
    for (let i = 0; i < route.length - 1; i++) rects.forEach((r) => expect(segmentHitsRect(route[i], route[i + 1], r)).toBe(false));
  });

  test('picks the nearer side and gives each rerouted cable its own lane', () => {
    const right = (o) => ({ x: 215, y: o.y });
    const r0 = cableRoute(right(out(0)), right(inn(2)), rects);
    expect(r0[1].x).toBeGreaterThan(220);
    const lane0 = cableRoute(out(0), inn(2), rects, 0);
    const lane1 = cableRoute(out(0), inn(2), rects, 1);
    expect(lane1[1].x).toBeLessThan(lane0[1].x);
  });

  test('side ports (not on a top or bottom edge) always stay straight', () => {
    const a = portPoint({ x: 100, y: 100 }, { w: 120, h: U_PX }, 0, 1, 'output', 'sides');
    const b = portPoint({ x: 100, y: 100 + 2 * U_PX }, { w: 120, h: U_PX }, 0, 1, 'input', 'sides');
    expect(cableRoute(a, b, rects)).toEqual([a, b]);
  });
});

describe('convertClassicToRack', () => {
  const cdev = (id, x, y, over = {}) => ({ id, type: id, label: id, position: { x, y }, input_ports: [], output_ports: [], width_in: 19, height_u: 1, ...over });
  const conn = (from, to) => ({ id: `${from}_${to}`, from_device_id: from, to_device_id: to, from_port: 'o', to_port: 'i' });

  test('stacks devices top to bottom in signal-flow order, not canvas order', () => {
    // canvas order is C, B, A left to right, but the signal runs A -> B -> C
    const layout = { id: 'x', name: 'Chain', mode: 'classic', port_layout: 'sides', devices: [cdev('C', 0, 0), cdev('B', 100, 0), cdev('A', 200, 0)], connections: [conn('A', 'B'), conn('B', 'C')] };
    const out = convertClassicToRack(layout);
    expect(out.mode).toBe('rack');
    expect(out.id).toBeNull();
    expect(out.port_layout).toBe('top_bottom');
    expect(out.racks).toHaveLength(1);
    expect(out.racks[0]).toMatchObject({ width_in: 19, height_u: 3 });
    const u = Object.fromEntries(out.devices.map((d) => [d.id, d.rack_u]));
    expect(u).toEqual({ A: 3, B: 2, C: 1 }); // A on top
    expect(out.connections).toEqual(layout.connections);
  });

  test('every device fits its rack, positions are derived from the slot, and the input is not changed', () => {
    const layout = { name: 'Mixed', mode: 'classic', devices: [cdev('big', 0, 0, { height_u: 3 }), cdev('small', 50, 0, { width_in: 6 }), cdev('mid', 90, 0, { width_in: 10, height_u: 2 })], connections: [] };
    const before = JSON.stringify(layout);
    const out = convertClassicToRack(layout);
    expect(JSON.stringify(layout)).toBe(before);
    expect(out.racks.map((r) => r.width_in)).toEqual([6, 10, 19]);
    expect(out.racks.map((r) => r.height_u)).toEqual([1, 2, 3]);
    out.devices.forEach((d) => {
      const rack = out.racks.find((r) => r.id === d.rack_id);
      expect(checkRackFit(rack, d, d.rack_u, d.rack_x, out.devices)).toBeNull();
      expect(d.position).toEqual(getDevicePosition(d, out.racks));
    });
    // racks sit side by side without overlapping
    const [r6, r10] = out.racks;
    expect(r6.position.x + getRackSize(r6).w).toBeLessThan(r10.position.x);
  });

  test('loops and unconnected devices still get a slot (position order)', () => {
    const layout = { name: 'Loop', mode: 'classic', devices: [cdev('p', 0, 0), cdev('q', 100, 0), cdev('lone', 200, 0)], connections: [conn('p', 'q'), conn('q', 'p'), conn('p', 'p')] };
    const out = convertClassicToRack(layout);
    expect(out.devices.map((d) => d.rack_u).sort()).toEqual([1, 2, 3]);
  });

  test('an empty layout converts to an empty rack layout', () => {
    expect(convertClassicToRack({ name: 'E', mode: 'classic', devices: [], connections: [] })).toMatchObject({ mode: 'rack', racks: [], devices: [] });
  });

  test('the library headphone desk converts into a valid rack with cables carried over', () => {
    const desk = readJson('library/layouts/headphone-desk-classic.json');
    const out = convertClassicToRack(desk);
    expect(out.devices).toHaveLength(4);
    expect(out.connections).toHaveLength(3);
    out.devices.forEach((d) => expect(checkRackFit(out.racks.find((r) => r.id === d.rack_id), d, d.rack_u, d.rack_x, out.devices)).toBeNull());
    // flow order: laptop on top, headphones at the bottom
    const u = Object.fromEntries(out.devices.map((d) => [d.id, d.rack_u]));
    expect(u.hp_laptop).toBeGreaterThan(u.hp_dac);
    expect(u.hp_dac).toBeGreaterThan(u.hp_amp);
    expect(u.hp_amp).toBeGreaterThan(u.hp_phones);
  });
});
