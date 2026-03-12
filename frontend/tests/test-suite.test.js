/**
 * Jest Test Runner for Audio Gear Layout
 * Run with: npm test
 */

const { TestRunner, setupTestSuite } = require('./test-suite.js');

describe('Audio Gear Layout Test Suite', () => {
  let runner;

  beforeAll(async () => {
    runner = await setupTestSuite();
  });

  // ===== LAYOUT TESTS =====

  test('Layout 1.1: Create a new layout', async () => {
    const layout = {
      name: 'Test Layout 1',
      devices: [],
      connections: [],
    };
    const saved = runner.saveLayoutLocally(layout);
    expect(saved.id).toBeDefined();
    expect(saved.name).toBe('Test Layout 1');
  });

  test('Layout 1.2: Save layout with devices', async () => {
    await runner.clearStorage();
    const layout = {
      name: 'Layout with Devices',
      devices: [
        {
          id: 'dev1',
          type: 'dac',
          label: 'DAC 1',
          position: { x: 100, y: 100 },
          input_ports: [],
          output_ports: [{ name: 'Out', type: 'audio' }],
        },
        {
          id: 'dev2',
          type: 'amp',
          label: 'Amp 1',
          position: { x: 300, y: 100 },
          input_ports: [{ name: 'In', type: 'audio' }],
          output_ports: [],
        },
      ],
      connections: [],
    };
    const saved = runner.saveLayoutLocally(layout);
    expect(saved.devices.length).toBe(2);
    expect(saved.devices[0].type).toBe('dac');
  });

  test('Layout 1.3: Load layout from local storage', async () => {
    await runner.clearStorage();
    const layout = {
      name: 'Layout to Load',
      devices: [{ id: 'dev1', type: 'dac', label: 'DAC', position: { x: 50, y: 50 }, input_ports: [], output_ports: [] }],
      connections: [],
    };
    const saved = runner.saveLayoutLocally(layout);
    const loaded = runner.loadLayoutLocally(saved.id);

    expect(loaded).toBeDefined();
    expect(loaded.name).toBe('Layout to Load');
    expect(loaded.devices.length).toBe(1);
  });

  test('Layout 1.4: Save layout with connections', async () => {
    await runner.clearStorage();
    const layout = {
      name: 'Layout with Connections',
      devices: [
        { id: 'dev1', type: 'dac', label: 'DAC', position: { x: 50, y: 50 }, input_ports: [], output_ports: [{ name: 'Out', type: 'audio' }] },
        { id: 'dev2', type: 'amp', label: 'Amp', position: { x: 250, y: 50 }, input_ports: [{ name: 'In', type: 'audio' }], output_ports: [] },
      ],
      connections: [
        {
          id: 'conn1',
          from_device_id: 'dev1',
          to_device_id: 'dev2',
          from_port: 'Out',
          to_port: 'In',
          from_port_type: 'audio',
          to_port_type: 'audio',
        },
      ],
    };
    const saved = runner.saveLayoutLocally(layout);
    expect(saved.connections.length).toBe(1);
    expect(saved.connections[0].from_device_id).toBe('dev1');
    expect(saved.connections[0].to_device_id).toBe('dev2');
  });

  test('Layout 1.5: Update existing layout', async () => {
    await runner.clearStorage();
    const layout = { name: 'Original', devices: [], connections: [] };
    const saved = runner.saveLayoutLocally(layout);
    const layoutId = saved.id;

    const updated = { id: layoutId, name: 'Updated', devices: [], connections: [] };
    const newSave = runner.saveLayoutLocally(updated);

    expect(newSave.name).toBe('Updated');
    const allLayouts = runner.getLayoutsFromLocalStorage();
    expect(allLayouts.length).toBe(1);
  });

  test('Layout 1.6: List multiple layouts', async () => {
    await runner.clearStorage();
    runner.saveLayoutLocally({ name: 'Layout 1', devices: [], connections: [] });
    runner.saveLayoutLocally({ name: 'Layout 2', devices: [], connections: [] });
    runner.saveLayoutLocally({ name: 'Layout 3', devices: [], connections: [] });

    const layouts = runner.getLayoutsFromLocalStorage();
    expect(layouts.length).toBe(3);
    expect(layouts.map((l) => l.name)).toContain('Layout 1');
  });

  // ===== PORT TYPE TESTS =====

  test('Port Types 2.1: Create custom port type', async () => {
    await runner.clearStorage();
    const portType = runner.savePortTypeLocally({
      name: 'Digital',
      type: 'digital',
      color: '#ff6b6b',
    });
    expect(portType.id).toBeDefined();
    expect(portType.name).toBe('Digital');
    expect(portType.color).toBe('#ff6b6b');
  });

  test('Port Types 2.2: Create multiple port types', async () => {
    await runner.clearStorage();
    runner.savePortTypeLocally({ name: 'Digital', type: 'digital', color: '#ff6b6b' });
    runner.savePortTypeLocally({ name: 'Analog', type: 'analog', color: '#4ecdc4' });
    runner.savePortTypeLocally({ name: 'Optical', type: 'optical', color: '#ffd93d' });

    const types = runner.getPortTypesFromLocalStorage();
    expect(types.length).toBe(3);
  });

  test('Port Types 2.3: Update existing port type', async () => {
    await runner.clearStorage();
    const original = runner.savePortTypeLocally({ name: 'Original', type: 'orig', color: '#000000' });
    const origId = original.id;

    const updated = runner.savePortTypeLocally({ id: origId, name: 'Updated', type: 'orig', color: '#ffffff' });
    expect(updated.name).toBe('Updated');
    expect(updated.color).toBe('#ffffff');

    const types = runner.getPortTypesFromLocalStorage();
    expect(types.length).toBe(1);
  });

  // ===== DEVICE TYPE TESTS =====

  test('Device Types 3.1: Create custom device type', async () => {
    await runner.clearStorage();
    const deviceType = runner.saveDeviceTypeLocally({
      name: 'Custom DAC',
      label: 'My DAC',
      input_ports: [{ name: 'USB', type: 'digital' }],
      output_ports: [{ name: 'RCA', type: 'audio' }],
    });
    expect(deviceType.id).toBeDefined();
    expect(deviceType.name).toBe('Custom DAC');
    expect(deviceType.input_ports.length).toBe(1);
  });

  test('Device Types 3.2: Create device type with multiple ports', async () => {
    await runner.clearStorage();
    const deviceType = runner.saveDeviceTypeLocally({
      name: 'Mixer',
      label: 'Audio Mixer',
      input_ports: [
        { name: 'Input 1', type: 'audio' },
        { name: 'Input 2', type: 'audio' },
        { name: 'Input 3', type: 'audio' },
      ],
      output_ports: [
        { name: 'Main Out L', type: 'audio' },
        { name: 'Main Out R', type: 'audio' },
      ],
    });
    expect(deviceType.input_ports.length).toBe(3);
    expect(deviceType.output_ports.length).toBe(2);
  });

  test('Device Types 3.3: Create multiple device types', async () => {
    await runner.clearStorage();
    runner.saveDeviceTypeLocally({ name: 'DAC', label: 'DAC', input_ports: [], output_ports: [] });
    runner.saveDeviceTypeLocally({ name: 'Amp', label: 'Amplifier', input_ports: [], output_ports: [] });
    runner.saveDeviceTypeLocally({ name: 'EQ', label: 'Equalizer', input_ports: [], output_ports: [] });

    const types = runner.getDeviceTypesFromLocalStorage();
    expect(types.length).toBe(3);
  });

  // ===== END-TO-END TESTS =====

  test('E2E 4.1: Create port types, device types, and connect in layout', async () => {
    await runner.clearStorage();

    // Create port types
    const portType1 = runner.savePortTypeLocally({ name: 'Digital S/PDIF', type: 'spdif', color: '#ff6b6b' });
    const portType2 = runner.savePortTypeLocally({ name: 'RCA Analog', type: 'rca', color: '#4ecdc4' });

    let portTypes = runner.getPortTypesFromLocalStorage();
    expect(portTypes.length).toBe(2);

    // Create device types
    const sourceDevice = runner.saveDeviceTypeLocally({
      name: 'Digital Streamer',
      label: 'Music Source',
      input_ports: [],
      output_ports: [
        { name: 'S/PDIF Out', type: 'spdif' },
        { name: 'RCA Out', type: 'rca' },
      ],
    });

    const dacDevice = runner.saveDeviceTypeLocally({
      name: 'DAC',
      label: 'Digital to Analog',
      input_ports: [
        { name: 'S/PDIF In', type: 'spdif' },
        { name: 'RCA In', type: 'rca' },
      ],
      output_ports: [{ name: 'RCA Out', type: 'rca' }],
    });

    const ampDevice = runner.saveDeviceTypeLocally({
      name: 'Amplifier',
      label: 'Power Amp',
      input_ports: [{ name: 'RCA In', type: 'rca' }],
      output_ports: [{ name: 'Speakers', type: 'rca' }],
    });

    let deviceTypes = runner.getDeviceTypesFromLocalStorage();
    expect(deviceTypes.length).toBe(3);

    // Create layout
    const layout = {
      name: 'Hi-Fi Chain',
      devices: [
        {
          id: 'dev_source',
          type: sourceDevice.name,
          label: sourceDevice.label,
          position: { x: 50, y: 100 },
          input_ports: [],
          output_ports: sourceDevice.output_ports,
          templateId: sourceDevice.id,
        },
        {
          id: 'dev_dac',
          type: dacDevice.name,
          label: dacDevice.label,
          position: { x: 250, y: 100 },
          input_ports: dacDevice.input_ports,
          output_ports: dacDevice.output_ports,
          templateId: dacDevice.id,
        },
        {
          id: 'dev_amp',
          type: ampDevice.name,
          label: ampDevice.label,
          position: { x: 450, y: 100 },
          input_ports: ampDevice.input_ports,
          output_ports: ampDevice.output_ports,
          templateId: ampDevice.id,
        },
      ],
      connections: [
        {
          id: 'conn1',
          from_device_id: 'dev_source',
          to_device_id: 'dev_dac',
          from_port: 'S/PDIF Out',
          to_port: 'S/PDIF In',
          from_port_type: 'spdif',
          to_port_type: 'spdif',
        },
        {
          id: 'conn2',
          from_device_id: 'dev_dac',
          to_device_id: 'dev_amp',
          from_port: 'RCA Out',
          to_port: 'RCA In',
          from_port_type: 'rca',
          to_port_type: 'rca',
        },
      ],
    };

    const savedLayout = runner.saveLayoutLocally(layout);

    expect(savedLayout.devices.length).toBe(3);
    expect(savedLayout.connections.length).toBe(2);

    // Load and verify
    const loadedLayout = runner.loadLayoutLocally(savedLayout.id);
    expect(loadedLayout).toBeDefined();
    expect(loadedLayout.name).toBe('Hi-Fi Chain');
    expect(loadedLayout.devices[0].label).toBe('Music Source');
    expect(loadedLayout.connections[0].from_port_type).toBe('spdif');
  });

  test('E2E 4.2: Complex multi-output device with selective connections', async () => {
    await runner.clearStorage();

    // Create port types
    runner.savePortTypeLocally({ name: 'Audio', type: 'audio', color: '#6b9b6b' });
    runner.savePortTypeLocally({ name: 'Subwoofer', type: 'subwoofer', color: '#95e1d3' });

    // Create device types
    const crossoverDevice = runner.saveDeviceTypeLocally({
      name: 'Crossover',
      label: 'Audio Crossover',
      input_ports: [{ name: 'In', type: 'audio' }],
      output_ports: [
        { name: 'Mid/High Out', type: 'audio' },
        { name: 'Sub Out', type: 'subwoofer' },
      ],
    });

    const mainSpeaker = runner.saveDeviceTypeLocally({
      name: 'Main Speaker',
      label: 'Main Speakers',
      input_ports: [{ name: 'In', type: 'audio' }],
      output_ports: [],
    });

    const subSpeaker = runner.saveDeviceTypeLocally({
      name: 'Subwoofer',
      label: 'Subwoofer',
      input_ports: [{ name: 'In', type: 'subwoofer' }],
      output_ports: [],
    });

    // Create layout
    const layout = {
      name: 'Surround System',
      devices: [
        {
          id: 'crossover',
          type: 'Crossover',
          label: 'Audio Crossover',
          position: { x: 100, y: 100 },
          input_ports: crossoverDevice.input_ports,
          output_ports: crossoverDevice.output_ports,
          templateId: crossoverDevice.id,
        },
        {
          id: 'main_spk',
          type: 'Main Speaker',
          label: 'Main Speakers',
          position: { x: 300, y: 50 },
          input_ports: mainSpeaker.input_ports,
          output_ports: [],
          templateId: mainSpeaker.id,
        },
        {
          id: 'sub_spk',
          type: 'Subwoofer',
          label: 'Subwoofer',
          position: { x: 300, y: 150 },
          input_ports: subSpeaker.input_ports,
          output_ports: [],
          templateId: subSpeaker.id,
        },
      ],
      connections: [
        {
          id: 'conn_main',
          from_device_id: 'crossover',
          to_device_id: 'main_spk',
          from_port: 'Mid/High Out',
          to_port: 'In',
          from_port_type: 'audio',
          to_port_type: 'audio',
        },
        {
          id: 'conn_sub',
          from_device_id: 'crossover',
          to_device_id: 'sub_spk',
          from_port: 'Sub Out',
          to_port: 'In',
          from_port_type: 'subwoofer',
          to_port_type: 'subwoofer',
        },
      ],
    };

    const saved = runner.saveLayoutLocally(layout);
    const loaded = runner.loadLayoutLocally(saved.id);

    expect(loaded.devices.length).toBe(3);
    expect(loaded.connections.length).toBe(2);
    expect(loaded.connections[0].from_port).toBe('Mid/High Out');
    expect(loaded.connections[1].from_port).toBe('Sub Out');
  });

  test('E2E 4.3: Save, load, modify, and re-save layout', async () => {
    await runner.clearStorage();

    // Create initial layout
    const layout1 = {
      name: 'Version 1',
      devices: [
        {
          id: 'dev1',
          type: 'dac',
          label: 'DAC',
          position: { x: 50, y: 50 },
          input_ports: [],
          output_ports: [{ name: 'Out', type: 'audio' }],
        },
      ],
      connections: [],
    };

    const saved1 = runner.saveLayoutLocally(layout1);
    const layoutId = saved1.id;

    // Load it
    const loaded1 = runner.loadLayoutLocally(layoutId);
    expect(loaded1.devices.length).toBe(1);

    // Modify it
    const loaded1Modified = {
      id: layoutId,
      name: 'Version 2',
      devices: [
        ...loaded1.devices,
        {
          id: 'dev2',
          type: 'amp',
          label: 'Amp',
          position: { x: 250, y: 50 },
          input_ports: [{ name: 'In', type: 'audio' }],
          output_ports: [],
        },
      ],
      connections: [
        {
          id: 'conn1',
          from_device_id: 'dev1',
          to_device_id: 'dev2',
          from_port: 'Out',
          to_port: 'In',
          from_port_type: 'audio',
          to_port_type: 'audio',
        },
      ],
    };

    // Re-save
    const saved2 = runner.saveLayoutLocally(loaded1Modified);
    expect(saved2.name).toBe('Version 2');
    expect(saved2.devices.length).toBe(2);
    expect(saved2.connections.length).toBe(1);

    // Verify only one layout exists
    const layouts = runner.getLayoutsFromLocalStorage();
    expect(layouts.length).toBe(1);
  });
});
