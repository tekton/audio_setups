import { createHistory } from '../js/history.js';
import { partsList, partsCsv } from '../js/parts.js';

describe('createHistory', () => {
  test('starts with nothing to undo or redo', () => {
    const h = createHistory();
    h.reset('a');
    expect([h.canUndo(), h.canRedo(), h.undo(), h.redo()]).toEqual([false, false, null, null]);
  });

  test('undo and redo walk back and forward through pushed states', () => {
    const h = createHistory();
    h.reset('a');
    expect(h.push('b')).toBe(true);
    expect(h.push('c')).toBe(true);
    expect(h.undo()).toBe('b');
    expect(h.undo()).toBe('a');
    expect(h.undo()).toBeNull();
    expect(h.canRedo()).toBe(true);
    expect(h.redo()).toBe('b');
    expect(h.redo()).toBe('c');
    expect(h.redo()).toBeNull();
    expect(h.canUndo()).toBe(true);
  });

  test('pushing the current state again records nothing', () => {
    const h = createHistory();
    h.reset('a');
    expect(h.push('a')).toBe(false);
    expect(h.canUndo()).toBe(false);
  });

  test('a new edit after undo drops the redo branch', () => {
    const h = createHistory();
    h.reset('a');
    h.push('b');
    h.push('c');
    h.undo();
    h.push('d');
    expect(h.canRedo()).toBe(false);
    expect(h.undo()).toBe('b');
  });

  test('keeps only the newest `limit` states', () => {
    const h = createHistory(3);
    h.reset('a');
    ['b', 'c', 'd', 'e'].forEach((s) => h.push(s));
    expect([h.undo(), h.undo(), h.undo()]).toEqual(['d', 'c', null]); // 'a' and 'b' fell off the front
  });

  test('replaceCurrent changes the current snapshot without adding a step', () => {
    const h = createHistory();
    h.reset('a');
    h.push('b');
    h.undo();
    h.replaceCurrent('a2');
    expect(h.push('a2')).toBe(false);
    expect(h.canUndo()).toBe(false);
    expect(h.redo()).toBe('b');
    expect(h.undo()).toBe('a2');
  });

  test('reset forgets everything before it', () => {
    const h = createHistory();
    h.reset('a');
    h.push('b');
    h.reset('z');
    expect([h.canUndo(), h.canRedo()]).toEqual([false, false]);
    expect(h.push('y')).toBe(true);
    expect(h.undo()).toBe('z');
  });
});

describe('partsList', () => {
  const layout = {
    racks: [{ id: 'r', label: 'Desk', width_in: 6, height_u: 6 }],
    devices: [
      { id: 'a', label: 'Mac mini mount', width_in: 6, height_u: 2, rack_id: 'r', rack_u: 1 },
      { id: 'b', label: 'DAC', width_in: 6, height_u: 1, rack_id: 'r', rack_u: 3 },
      { id: 'c', type: 'speaker', width_in: 19, height_u: 1 },
    ],
    connections: [
      { id: '1', from_device_id: 'a', to_device_id: 'b', from_port: 'USB', to_port: 'USB', from_port_type: 'usb_audio' },
      { id: '2', from_device_id: 'b', to_device_id: 'c', from_port: 'RCA Out', to_port: 'In', from_port_type: 'rca' },
      { id: '3', from_device_id: 'b', to_device_id: 'gone', from_port: 'RCA Out', from_port_type: 'rca' },
    ],
  };

  test('lists devices with size and where they sit', () => {
    expect(partsList(layout).devices).toEqual([
      { name: 'Mac mini mount', size: '6" × 2U', where: 'Desk, U1–U2' },
      { name: 'DAC', size: '6" × 1U', where: 'Desk, U3' },
      { name: 'speaker', size: '19" × 1U', where: 'Not in a rack' },
    ]);
    expect(partsList(layout).racks).toEqual([{ name: 'Desk', size: '6" × 6U' }]);
  });

  test('lists each cable with both ends, naming missing devices instead of crashing', () => {
    const { cables } = partsList(layout, (t) => ({ rca: 'RCA', usb_audio: 'USB Audio' }[t] || t));
    expect(cables[0]).toEqual({ from: 'Mac mini mount · USB', to: 'DAC · USB', type: 'USB Audio' });
    expect(cables[1]).toEqual({ from: 'DAC · RCA Out', to: 'speaker · In', type: 'RCA' });
    expect(cables[2].to).toBe('(missing device)');
  });

  test('totals cables by type, most first', () => {
    expect(partsList(layout).cableTotals).toEqual([{ type: 'rca', count: 2 }, { type: 'usb_audio', count: 1 }]);
  });

  test('an empty layout gives empty lists', () => {
    expect(partsList({})).toEqual({ devices: [], cables: [], cableTotals: [], racks: [] });
  });

  test('partsCsv quotes values and escapes quotes', () => {
    const csv = partsCsv({ devices: [{ name: 'Amp, "big"', size: '19" × 1U', where: 'x' }], cables: [] });
    expect(csv).toContain('"Amp, ""big""","19"" × 1U","x"');
    expect(csv.split('\n')[0]).toBe('Devices');
  });
});
