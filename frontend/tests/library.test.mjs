import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { checkRackFit } from '../js/rack-geometry.js';
import { mergeById, normalizeDeviceTypes, uniqueName, copyLayout, pageForLayout, parseLayoutsFile, importLayouts, baseName, installState, removeById, buildBackup, parseImportFile, storageSummary, formatChars, backupNudge } from '../js/library-core.js';

const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(frontend, file), 'utf8'));
const manifest = readJson('library/index.json');
const portTypeSlugs = new Set(readJson('audio-gear-port-types.json').map((t) => t.type).concat('audio'));

describe('library files', () => {
  const entries = [...manifest.layouts, ...manifest.device_types, ...manifest.port_types];

  test.each(entries.map((e) => [e.id, e]))('%s has a name, a description and a file that exists', (_id, e) => {
    expect(e.name).toBeTruthy();
    expect(e.description).toBeTruthy();
    expect(fs.existsSync(path.join(frontend, e.file))).toBe(true);
  });

  test('ids are unique within each section', () => {
    for (const list of [manifest.layouts, manifest.device_types, manifest.port_types]) {
      const ids = list.map((e) => e.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  test.each(manifest.device_types.map((e) => [e.id, e]))('device pack %s has valid sizes and ports', (_id, e) => {
    const pack = readJson(e.file);
    expect(pack.length).toBeGreaterThan(0);
    pack.forEach((t) => {
      expect(t.id).toBeTruthy();
      expect([6, 10, 19]).toContain(t.width_in);
      expect(t.height_u).toBeGreaterThanOrEqual(1);
      [...t.input_ports, ...t.output_ports].forEach((p) => expect(portTypeSlugs.has(p.type)).toBe(true));
    });
    expect(new Set(pack.map((t) => t.id)).size).toBe(pack.length);
  });

  test.each(manifest.layouts.map((e) => [e.id, e]))('layout %s is a valid rack layout', (_id, e) => {
    const layout = readJson(e.file);
    expect(layout.mode).toBe('rack');
    const ids = new Set(layout.devices.map((d) => d.id));
    expect(ids.size).toBe(layout.devices.length);

    // every device fits its rack without clashing with another
    layout.devices.forEach((d) => {
      const rack = layout.racks.find((r) => r.id === d.rack_id);
      expect(rack).toBeDefined();
      expect(checkRackFit(rack, d, d.rack_u, d.rack_x, layout.devices)).toBeNull();
    });

    // every cable joins two real ports of the same type
    layout.connections.forEach((c) => {
      const from = layout.devices.find((d) => d.id === c.from_device_id);
      const to = layout.devices.find((d) => d.id === c.to_device_id);
      const out = from.output_ports.find((p) => p.name === c.from_port);
      const inp = to.input_ports.find((p) => p.name === c.to_port);
      expect(out && inp).toBeTruthy();
      expect(out.type).toBe(inp.type);
      expect(c.from_port_type).toBe(out.type);
    });
  });

  test('The Crap Rack is a 6" rack holding a 2U mount and three 1U devices', () => {
    const layout = readJson('library/layouts/crap-rack.json');
    expect(layout.racks).toHaveLength(1);
    expect(layout.racks[0].width_in).toBe(6);
    expect(layout.devices.map((d) => d.height_u).sort()).toEqual([1, 1, 1, 2]);
    expect(layout.devices.every((d) => d.width_in === 6)).toBe(true);
  });
});

describe('library helpers', () => {
  test('mergeById replaces matching ids and keeps the rest', () => {
    expect(mergeById([{ id: 'a', v: 1 }, { id: 'b', v: 1 }], [{ id: 'b', v: 2 }, { id: 'c', v: 1 }])).toEqual([{ id: 'a', v: 1 }, { id: 'b', v: 2 }, { id: 'c', v: 1 }]);
  });

  test('normalizeDeviceTypes fills defaults', () => {
    expect(normalizeDeviceTypes([{ id: 'x', name: 'X' }])).toEqual([{ id: 'x', name: 'X', label: 'X', width_in: 19, height_u: 1, input_ports: [], output_ports: [] }]);
  });

  test('uniqueName numbers a clashing name', () => {
    expect(uniqueName('Rack', [])).toBe('Rack');
    expect(uniqueName('Rack', ['Rack'])).toBe('Rack (2)');
    expect(uniqueName('Rack', ['Rack', 'Rack (2)'])).toBe('Rack (3)');
  });

  test('copyLayout gives a new id and a free name, leaving the original alone', () => {
    const original = { id: null, name: 'Rack', devices: [] };
    expect(copyLayout(original, 'local_1', ['Rack'])).toEqual({ id: 'local_1', name: 'Rack (2)', devices: [] });
    expect(original.id).toBeNull();
  });

  test('pageForLayout sends classic layouts to the classic page', () => {
    expect(pageForLayout({ mode: 'classic' })).toBe('classic.html');
    expect(pageForLayout({ mode: 'rack' })).toBe('index.html');
    expect(pageForLayout({})).toBe('index.html');
  });

  test('parseLayoutsFile reads one layout or an array, and rejects anything else', () => {
    expect(parseLayoutsFile('{"name":"A","devices":[]}')).toHaveLength(1);
    expect(parseLayoutsFile('[{"name":"A","devices":[]},{"name":"B","devices":[]}]')).toHaveLength(2);
    expect(() => parseLayoutsFile('nope')).toThrow('not a JSON file');
    expect(() => parseLayoutsFile('[]')).toThrow('not a layouts file');
    expect(() => parseLayoutsFile('{"name":"A"}')).toThrow('not a layouts file');
    expect(() => parseLayoutsFile('[{"devices":[]},{"x":1}]')).toThrow('not a layouts file');
  });

  test('importLayouts adds copies with fresh ids and names that never clash', () => {
    let n = 0;
    const saved = [{ id: 'old', name: 'Rack', devices: [] }];
    const out = importLayouts([{ id: 'x', name: 'Rack', devices: [] }, { id: 'y', name: 'Rack', devices: [] }], saved, () => `new_${++n}`);
    expect(out.map((l) => [l.id, l.name])).toEqual([['old', 'Rack'], ['new_1', 'Rack (2)'], ['new_2', 'Rack (3)']]);
    expect(saved).toHaveLength(1);
  });

  test('baseName drops a trailing copy number only', () => {
    expect(baseName('Desk (2)')).toBe('Desk');
    expect(baseName('Desk (12)')).toBe('Desk');
    expect(baseName('Desk (mk2)')).toBe('Desk (mk2)');
    expect(baseName('(3)')).toBe('(3)');
  });

  test('installState reports none, some or all of a pack as present', () => {
    const pack = [{ id: 'a' }, { id: 'b' }];
    expect(installState(pack, [])).toBe('none');
    expect(installState(pack, [{ id: 'a' }, { id: 'z' }])).toBe('some');
    expect(installState(pack, [{ id: 'b' }, { id: 'a' }, { id: 'z' }])).toBe('all');
    expect(installState([], [{ id: 'a' }])).toBe('none');
  });

  test('removeById drops only the pack items and leaves the rest', () => {
    const out = removeById([{ id: 'a' }, { id: 'mine' }, { id: 'b' }], [{ id: 'a' }, { id: 'b' }]);
    expect(out).toEqual([{ id: 'mine' }]);
  });

  test('a full backup round-trips through parseImportFile', () => {
    const backup = buildBackup([{ name: 'L', devices: [] }], [{ id: 'd1' }], [{ id: 'p1' }], new Date('2026-10-04T00:00:00Z'));
    expect(backup.exported_at).toBe('2026-10-04T00:00:00.000Z');
    const parsed = parseImportFile(JSON.stringify(backup));
    expect(parsed.layouts).toHaveLength(1);
    expect(parsed.deviceTypes).toEqual([{ id: 'd1' }]);
    expect(parsed.portTypes).toEqual([{ id: 'p1' }]);
  });

  test('parseImportFile still reads a single layout or an array, with no types', () => {
    expect(parseImportFile('{"name":"A","devices":[]}')).toEqual({ layouts: [{ name: 'A', devices: [] }], deviceTypes: [], portTypes: [] });
    expect(parseImportFile('[{"devices":[]},{"devices":[]}]').layouts).toHaveLength(2);
  });

  test('parseImportFile rejects broken backups', () => {
    const bad = (o) => () => parseImportFile(JSON.stringify(o));
    expect(() => parseImportFile('nope')).toThrow('not a JSON file');
    expect(bad({ app: 'audio_gear_layout', layouts: [{ name: 'x' }] })).toThrow('not a layouts file');
    expect(bad({ app: 'audio_gear_layout', layouts: [], device_types: 'x' })).toThrow('not a backup file');
    expect(bad({ app: 'audio_gear_layout', layouts: [], port_types: [{ name: 'no id' }] })).toThrow('not a backup file');
    expect(parseImportFile(JSON.stringify({ app: 'audio_gear_layout', layouts: [] }))).toEqual({ layouts: [], deviceTypes: [], portTypes: [] });
  });

  test('storageSummary and formatChars size what is stored', () => {
    expect(storageSummary([['ab', 'cde'], ['f', null]])).toEqual({ keys: 2, chars: 6 });
    expect(formatChars(500)).toBe('500 B');
    expect(formatChars(12345)).toBe('12 KB');
    expect(formatChars(2500000)).toBe('2.5 MB');
  });

  test('backupNudge only speaks up for unsaved-elsewhere layouts or an old backup', () => {
    const now = new Date('2026-10-04T00:00:00Z');
    expect(backupNudge(null, 0, now)).toBe('');
    expect(backupNudge(null, 1, now)).toContain('never been backed up');
    expect(backupNudge('garbage', 2, now)).toContain('2 saved layouts');
    expect(backupNudge('2026-09-30T00:00:00Z', 3, now)).toBe('');
    expect(backupNudge('2026-08-01T00:00:00Z', 3, now)).toContain('64 days ago');
  });
});
