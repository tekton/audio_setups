import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { checkRackFit } from '../js/rack-geometry.js';
import { mergeById, normalizeDeviceTypes, uniqueName, copyLayout, pageForLayout } from '../js/library-core.js';

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
});
