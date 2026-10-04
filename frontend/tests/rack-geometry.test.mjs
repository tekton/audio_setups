import {
  INCH_PX, U_PX, RACK_PAD, RACK_HEADER, DEVICE_W, DEVICE_H,
  getRackSize, getDeviceSize, getDevicePosition, checkRackFit, findRackAtPoint, slotForDevice, sharedRows, portPoint,
} from '../js/rack-geometry.js';

const rack = (over = {}) => ({ id: 'r', width_in: 19, height_u: 4, position: { x: 100, y: 50 }, ...over });
const dev = (id, over = {}) => ({ id, width_in: 6, height_u: 1, rack_id: 'r', rack_u: 1, rack_x: 0, position: { x: 0, y: 0 }, ...over });

describe('sizes', () => {
  test('rack size includes rails and header', () => {
    expect(getRackSize(rack({ width_in: 10, height_u: 3 }))).toEqual({ w: 10 * INCH_PX + 2 * RACK_PAD, h: RACK_HEADER + 3 * U_PX + RACK_PAD });
  });

  test('free devices use the legacy box, rack-scale devices their physical size', () => {
    expect(getDeviceSize(dev('a'), false)).toEqual({ w: DEVICE_W, h: DEVICE_H });
    expect(getDeviceSize(dev('a', { width_in: 10, height_u: 2 }), true)).toEqual({ w: 10 * INCH_PX, h: 2 * U_PX });
  });
});

describe('getDevicePosition', () => {
  test('free device keeps its own position', () => {
    const d = dev('a', { rack_id: null, position: { x: 7, y: 9 } });
    expect(getDevicePosition(d, [rack()])).toEqual({ x: 7, y: 9 });
  });

  test('U1 sits at the bottom of the rack, offset by the rail', () => {
    const r = rack();
    expect(getDevicePosition(dev('a', { rack_u: 1 }), [r])).toEqual({ x: 100 + RACK_PAD, y: 50 + RACK_HEADER + 3 * U_PX });
  });

  test('top U sits just under the header', () => {
    expect(getDevicePosition(dev('a', { rack_u: 4 }), [rack()]).y).toBe(50 + RACK_HEADER);
  });

  test('a tall device is positioned by its top U', () => {
    expect(getDevicePosition(dev('a', { rack_u: 2, height_u: 3 }), [rack()]).y).toBe(50 + RACK_HEADER);
  });

  test('rack_x shifts the device right in inches', () => {
    expect(getDevicePosition(dev('a', { rack_x: 6 }), [rack()]).x).toBe(100 + RACK_PAD + 6 * INCH_PX);
  });
});

describe('checkRackFit', () => {
  const r = rack({ width_in: 19, height_u: 4 });

  test('fits an empty rack', () => {
    expect(checkRackFit(r, dev('a'), 1, 0, [])).toBeNull();
  });

  test('wider than the rack', () => {
    expect(checkRackFit(rack({ width_in: 10 }), dev('a', { width_in: 19 }), 1, 0, [])).toMatch(/Too wide/);
  });

  test('runs off the right edge', () => {
    expect(checkRackFit(r, dev('a', { width_in: 6 }), 1, 14, [])).toMatch(/across/);
  });

  test('runs off the top', () => {
    expect(checkRackFit(r, dev('a', { height_u: 2 }), 4, 0, [])).toMatch(/Doesn't fit/);
  });

  test('below U1', () => {
    expect(checkRackFit(r, dev('a'), 0, 0, [])).toMatch(/Doesn't fit/);
  });

  test('side-by-side devices in one row are allowed', () => {
    expect(checkRackFit(r, dev('b'), 1, 6, [dev('a')])).toBeNull();
  });

  test('horizontal overlap is rejected', () => {
    expect(checkRackFit(r, dev('b'), 1, 5, [dev('a')])).toMatch(/taken/);
  });

  test('vertical overlap with a taller device is rejected', () => {
    expect(checkRackFit(r, dev('b'), 2, 0, [dev('a', { height_u: 2 })])).toMatch(/taken/);
  });

  test('a device does not clash with itself', () => {
    const a = dev('a');
    expect(checkRackFit(r, a, 1, 0, [a])).toBeNull();
  });

  test('devices in other racks are ignored', () => {
    expect(checkRackFit(r, dev('b'), 1, 0, [dev('a', { rack_id: 'other' })])).toBeNull();
  });
});

describe('findRackAtPoint', () => {
  test('finds the rack containing a point, else undefined', () => {
    const r = rack();
    const { w, h } = getRackSize(r);
    expect(findRackAtPoint([r], { x: 100 + w / 2, y: 50 + h / 2 })).toBe(r);
    expect(findRackAtPoint([r], { x: 99, y: 60 })).toBeUndefined();
    expect(findRackAtPoint([r], { x: 100 + w + 1, y: 60 })).toBeUndefined();
  });
});

describe('slotForDevice', () => {
  const r = rack({ height_u: 4 });
  const dragged = (x, y, over = {}) => ({ width_in: 6, height_u: 1, position: { x, y }, ...over });

  test('top-left corner maps to the top row and left rail', () => {
    expect(slotForDevice(r, dragged(100 + RACK_PAD, 50 + RACK_HEADER))).toEqual({ rack_u: 4, rack_x: 0 });
  });

  test('snaps to the nearest U and inch', () => {
    const slot = slotForDevice(r, dragged(100 + RACK_PAD + 6 * INCH_PX + 5, 50 + RACK_HEADER + 2 * U_PX + 10));
    expect(slot).toEqual({ rack_u: 2, rack_x: 6 });
  });

  test('clamps inside the rack', () => {
    expect(slotForDevice(r, dragged(-500, -500))).toEqual({ rack_u: 4, rack_x: 0 });
    expect(slotForDevice(r, dragged(5000, 5000))).toEqual({ rack_u: 1, rack_x: 13 });
  });

  test('a tall device is anchored by its lowest U', () => {
    expect(slotForDevice(r, dragged(100 + RACK_PAD, 50 + RACK_HEADER, { height_u: 2 })).rack_u).toBe(3);
  });
});

describe('sharedRows', () => {
  const r = rack();

  test('no rows are shared when devices are stacked', () => {
    expect(sharedRows(r, [dev('a'), dev('b', { rack_u: 2 })])).toEqual([]);
  });

  test('side-by-side devices mark their row', () => {
    expect(sharedRows(r, [dev('a'), dev('b', { rack_x: 6 })])).toEqual([{ u: 1, count: 2 }]);
  });

  test('a tall device sharing only some rows marks just those', () => {
    expect(sharedRows(r, [dev('a', { height_u: 3 }), dev('b', { rack_u: 2, rack_x: 6 })])).toEqual([{ u: 2, count: 2 }]);
  });
});

describe('portPoint', () => {
  const pos = { x: 10, y: 20 };
  const size = { w: 100, h: 40 };

  test('top/bottom: inputs on the top edge, outputs on the bottom, evenly spaced', () => {
    expect(portPoint(pos, size, 0, 1, 'input', 'top_bottom')).toEqual({ x: 60, y: 20 });
    expect(portPoint(pos, size, 0, 1, 'output', 'top_bottom')).toEqual({ x: 60, y: 60 });
    expect(portPoint(pos, size, 1, 3, 'input', 'top_bottom')).toEqual({ x: 60, y: 20 });
    expect(portPoint(pos, size, 0, 3, 'input', 'top_bottom').x).toBe(35);
  });

  test('sides: inputs on the left edge, outputs on the right', () => {
    expect(portPoint(pos, size, 0, 1, 'input', 'sides')).toEqual({ x: 10, y: 40 });
    expect(portPoint(pos, size, 0, 1, 'output', 'sides')).toEqual({ x: 110, y: 40 });
  });
});
