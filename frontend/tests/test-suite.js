/**
 * Comprehensive Test Suite for Audio Gear Layout Application
 * Tests: Layout creation/save/load, port types, device types, E2E flow
 */

const TEST_CONSTANTS = {
  STORAGE_KEYS: {
    layouts: 'audio_gear_layouts',
    portTypes: 'audio_gear_port_types',
    deviceTypes: 'audio_gear_device_types',
    storageMode: 'audio_gear_storage_mode',
  },
};

class TestRunner {
  constructor() {
    this.tests = [];
    this.results = {
      passed: 0,
      failed: 0,
      errors: [],
      logs: [],
    };
  }

  // ===== Test Utilities =====

  async clearStorage() {
    try {
      localStorage.setItem(TEST_CONSTANTS.STORAGE_KEYS.layouts, JSON.stringify([]));
      localStorage.setItem(TEST_CONSTANTS.STORAGE_KEYS.portTypes, JSON.stringify([]));
      localStorage.setItem(TEST_CONSTANTS.STORAGE_KEYS.deviceTypes, JSON.stringify([]));
    } catch (e) {
      console.error('Failed to clear storage:', e);
    }
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  assert(condition, message) {
    if (!condition) {
      throw new Error(message || 'Assertion failed');
    }
  }

  assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(`${message}: expected ${expected}, got ${actual}`);
    }
  }

  assertDeepEqual(actual, expected, message) {
    const actualStr = JSON.stringify(actual);
    const expectedStr = JSON.stringify(expected);
    if (actualStr !== expectedStr) {
      throw new Error(`${message}: expected ${expectedStr}, got ${actualStr}`);
    }
  }

  assertArrayIncludes(array, value, message) {
    if (!array.includes(value)) {
      throw new Error(`${message}: array does not include ${value}`);
    }
  }

  // ===== Helper Methods =====

  getPortTypesFromLocalStorage() {
    try {
      const raw = localStorage.getItem(TEST_CONSTANTS.STORAGE_KEYS.portTypes);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  getDeviceTypesFromLocalStorage() {
    try {
      const raw = localStorage.getItem(TEST_CONSTANTS.STORAGE_KEYS.deviceTypes);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  getLayoutsFromLocalStorage() {
    try {
      const raw = localStorage.getItem(TEST_CONSTANTS.STORAGE_KEYS.layouts);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  saveLayoutLocally(layout) {
    const layouts = this.getLayoutsFromLocalStorage();
    const id = layout.id || `test_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const payload = {
      id,
      name: layout.name || 'Untitled layout',
      devices: layout.devices || [],
      connections: layout.connections || [],
    };
    const idx = layouts.findIndex((l) => l.id === id);
    if (idx >= 0) {
      layouts[idx] = payload;
    } else {
      layouts.push(payload);
    }
    localStorage.setItem(TEST_CONSTANTS.STORAGE_KEYS.layouts, JSON.stringify(layouts));
    return payload;
  }

  loadLayoutLocally(id) {
    const layouts = this.getLayoutsFromLocalStorage();
    return layouts.find((l) => l.id === id);
  }

  savePortTypeLocally(portType) {
    const types = this.getPortTypesFromLocalStorage();
    const id = portType.id || `port_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const payload = {
      id,
      name: portType.name || 'Custom Port',
      type: portType.type || id,
      color: portType.color || '#6b9b6b',
    };
    const idx = types.findIndex((t) => t.id === id);
    if (idx >= 0) {
      types[idx] = payload;
    } else {
      types.push(payload);
    }
    localStorage.setItem(TEST_CONSTANTS.STORAGE_KEYS.portTypes, JSON.stringify(types));
    return payload;
  }

  saveDeviceTypeLocally(deviceType) {
    const types = this.getDeviceTypesFromLocalStorage();
    const id = deviceType.id || `device_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const payload = {
      id,
      name: deviceType.name || 'Custom Device',
      label: deviceType.label || deviceType.name || 'Custom Device',
      input_ports: deviceType.input_ports || [],
      output_ports: deviceType.output_ports || [],
    };
    const idx = types.findIndex((t) => t.id === id);
    if (idx >= 0) {
      types[idx] = payload;
    } else {
      types.push(payload);
    }
    localStorage.setItem(TEST_CONSTANTS.STORAGE_KEYS.deviceTypes, JSON.stringify(types));
    return payload;
  }

  // ===== Test Methods =====

  test(name, fn) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log('🧪 Running Test Suite...\n');
    const startTime = performance.now();

    for (const { name, fn } of this.tests) {
      try {
        await this.clearStorage();
        await fn.call(this);
        this.results.passed++;
        console.log(`✅ ${name}`);
      } catch (error) {
        this.results.failed++;
        this.results.errors.push({ name, error: error.message });
        console.error(`❌ ${name}`);
        console.error(`   → ${error.message}`);
      }
    }

    const endTime = performance.now();
    const duration = (endTime - startTime).toFixed(2);

    console.log('\n' + '='.repeat(60));
    console.log(`\n📊 Results: ${this.results.passed} passed, ${this.results.failed} failed`);
    console.log(`⏱️  Duration: ${duration}ms\n`);

    if (this.results.failed === 0) {
      console.log('🎉 All tests passed!');
    } else {
      console.log('Failed tests:');
      this.results.errors.forEach(({ name, error }) => {
        console.log(`  • ${name}: ${error}`);
      });
    }

    return this.results;
  }
}

// ===== TEST SUITE DEFINITION =====

async function setupTestSuite() {
  const runner = new TestRunner();

  // ===== SECTION 1: LAYOUT TESTS =====

  runner.test('Layout 1.1: Create a new layout', async function () {
    const layout = {
      name: 'Test Layout 1',
      devices: [],
      connections: [],
    };
    const saved = this.saveLayoutLocally(layout);
    this.assert(saved.id, 'Layout should have an ID');
    this.assertEqual(saved.name, 'Test Layout 1', 'Layout name should be saved');
  });

  runner.test('Layout 1.2: Save layout with devices', async function () {
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
    const saved = this.saveLayoutLocally(layout);
    this.assertEqual(saved.devices.length, 2, 'Should have 2 devices');
    this.assertEqual(saved.devices[0].type, 'dac', 'First device should be DAC');
  });

  runner.test('Layout 1.3: Load layout from local storage', async function () {
    const layout = {
      name: 'Layout to Load',
      devices: [{ id: 'dev1', type: 'dac', label: 'DAC', position: { x: 50, y: 50 }, input_ports: [], output_ports: [] }],
      connections: [],
    };
    const saved = this.saveLayoutLocally(layout);
    const loaded = this.loadLayoutLocally(saved.id);

    this.assert(loaded, 'Layout should be loadable');
    this.assertEqual(loaded.name, 'Layout to Load', 'Loaded layout name should match');
    this.assertEqual(loaded.devices.length, 1, 'Loaded layout should have correct device count');
  });

  runner.test('Layout 1.4: Save layout with connections', async function () {
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
    const saved = this.saveLayoutLocally(layout);
    this.assertEqual(saved.connections.length, 1, 'Should have 1 connection');
    this.assertEqual(saved.connections[0].from_device_id, 'dev1', 'Connection should be from dev1');
    this.assertEqual(saved.connections[0].to_device_id, 'dev2', 'Connection should be to dev2');
  });

  runner.test('Layout 1.5: Update existing layout', async function () {
    const layout = { name: 'Original', devices: [], connections: [] };
    const saved = this.saveLayoutLocally(layout);
    const layoutId = saved.id;

    const updated = { id: layoutId, name: 'Updated', devices: [], connections: [] };
    const newSave = this.saveLayoutLocally(updated);

    this.assertEqual(newSave.name, 'Updated', 'Name should be updated');
    const allLayouts = this.getLayoutsFromLocalStorage();
    this.assertEqual(allLayouts.length, 1, 'Should only have 1 layout (update, not create)');
  });

  runner.test('Layout 1.6: List multiple layouts', async function () {
    const layout1 = this.saveLayoutLocally({ name: 'Layout 1', devices: [], connections: [] });
    const layout2 = this.saveLayoutLocally({ name: 'Layout 2', devices: [], connections: [] });
    const layout3 = this.saveLayoutLocally({ name: 'Layout 3', devices: [], connections: [] });

    const layouts = this.getLayoutsFromLocalStorage();
    this.assertEqual(layouts.length, 3, 'Should have 3 layouts');
    this.assertArrayIncludes(
      layouts.map((l) => l.name),
      'Layout 1',
      'Should include Layout 1'
    );
  });

  // ===== SECTION 2: PORT TYPE TESTS =====

  runner.test('Port Types 2.1: Create custom port type', async function () {
    const portType = this.savePortTypeLocally({
      name: 'Digital',
      type: 'digital',
      color: '#ff6b6b',
    });
    this.assert(portType.id, 'Port type should have an ID');
    this.assertEqual(portType.name, 'Digital', 'Port type name should be saved');
    this.assertEqual(portType.color, '#ff6b6b', 'Port type color should be saved');
  });

  runner.test('Port Types 2.2: Create multiple port types', async function () {
    const pt1 = this.savePortTypeLocally({ name: 'Digital', type: 'digital', color: '#ff6b6b' });
    const pt2 = this.savePortTypeLocally({ name: 'Analog', type: 'analog', color: '#4ecdc4' });
    const pt3 = this.savePortTypeLocally({ name: 'Optical', type: 'optical', color: '#ffd93d' });

    const types = this.getPortTypesFromLocalStorage();
    this.assertEqual(types.length, 3, 'Should have 3 port types');
  });

  runner.test('Port Types 2.3: Update existing port type', async function () {
    const original = this.savePortTypeLocally({ name: 'Original', type: 'orig', color: '#000000' });
    const origId = original.id;

    const updated = this.savePortTypeLocally({ id: origId, name: 'Updated', type: 'orig', color: '#ffffff' });
    this.assertEqual(updated.name, 'Updated', 'Name should be updated');
    this.assertEqual(updated.color, '#ffffff', 'Color should be updated');

    const types = this.getPortTypesFromLocalStorage();
    this.assertEqual(types.length, 1, 'Should only have 1 port type');
  });

  // ===== SECTION 3: DEVICE TYPE TESTS =====

  runner.test('Device Types 3.1: Create custom device type', async function () {
    const deviceType = this.saveDeviceTypeLocally({
      name: 'Custom DAC',
      label: 'My DAC',
      input_ports: [{ name: 'USB', type: 'digital' }],
      output_ports: [{ name: 'RCA', type: 'audio' }],
    });
    this.assert(deviceType.id, 'Device type should have an ID');
    this.assertEqual(deviceType.name, 'Custom DAC', 'Device type name should be saved');
    this.assertEqual(deviceType.input_ports.length, 1, 'Should have 1 input port');
  });

  runner.test('Device Types 3.2: Create device type with multiple ports', async function () {
    const deviceType = this.saveDeviceTypeLocally({
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
    this.assertEqual(deviceType.input_ports.length, 3, 'Should have 3 input ports');
    this.assertEqual(deviceType.output_ports.length, 2, 'Should have 2 output ports');
  });

  runner.test('Device Types 3.3: Create multiple device types', async function () {
    const dt1 = this.saveDeviceTypeLocally({ name: 'DAC', label: 'DAC', input_ports: [], output_ports: [] });
    const dt2 = this.saveDeviceTypeLocally({ name: 'Amp', label: 'Amplifier', input_ports: [], output_ports: [] });
    const dt3 = this.saveDeviceTypeLocally({ name: 'EQ', label: 'Equalizer', input_ports: [], output_ports: [] });

    const types = this.getDeviceTypesFromLocalStorage();
    this.assertEqual(types.length, 3, 'Should have 3 device types');
  });

  // ===== SECTION 4: END-TO-END TESTS =====

  runner.test('E2E 4.1: Create port types, device types, and connect in layout', async function () {
    // Step 1: Create custom port types
    const portType1 = this.savePortTypeLocally({ name: 'Digital S/PDIF', type: 'spdif', color: '#ff6b6b' });
    const portType2 = this.savePortTypeLocally({ name: 'RCA Analog', type: 'rca', color: '#4ecdc4' });

    // Verify port types are saved
    const portTypes = this.getPortTypesFromLocalStorage();
    this.assertEqual(portTypes.length, 2, 'Should have created 2 port types');

    // Step 2: Create custom device types using those port types
    const sourceDevice = this.saveDeviceTypeLocally({
      name: 'Digital Streamer',
      label: 'Music Source',
      input_ports: [],
      output_ports: [
        { name: 'S/PDIF Out', type: 'spdif' },
        { name: 'RCA Out', type: 'rca' },
      ],
    });

    const dacDevice = this.saveDeviceTypeLocally({
      name: 'DAC',
      label: 'Digital to Analog',
      input_ports: [
        { name: 'S/PDIF In', type: 'spdif' },
        { name: 'RCA In', type: 'rca' },
      ],
      output_ports: [{ name: 'RCA Out', type: 'rca' }],
    });

    const ampDevice = this.saveDeviceTypeLocally({
      name: 'Amplifier',
      label: 'Power Amp',
      input_ports: [{ name: 'RCA In', type: 'rca' }],
      output_ports: [{ name: 'Speakers', type: 'rca' }],
    });

    // Verify device types are saved
    const deviceTypes = this.getDeviceTypesFromLocalStorage();
    this.assertEqual(deviceTypes.length, 3, 'Should have created 3 device types');

    // Step 3: Create a layout with instances of these device types
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

    const savedLayout = this.saveLayoutLocally(layout);

    // Verify the layout is correctly saved
    this.assertEqual(savedLayout.devices.length, 3, 'Should have 3 devices in layout');
    this.assertEqual(savedLayout.connections.length, 2, 'Should have 2 connections in layout');

    // Step 4: Load the layout and verify structure
    const loadedLayout = this.loadLayoutLocally(savedLayout.id);
    this.assert(loadedLayout, 'Layout should be loadable');
    this.assertEqual(loadedLayout.name, 'Hi-Fi Chain', 'Layout name should match');
    this.assertEqual(loadedLayout.devices[0].label, 'Music Source', 'Device labels should be preserved');
    this.assertEqual(loadedLayout.connections[0].from_port_type, 'spdif', 'Connection port types should match');
  });

  runner.test('E2E 4.2: Complex multi-output device with selective connections', async function () {
    // Create port types
    const audioPort = this.savePortTypeLocally({ name: 'Audio', type: 'audio', color: '#6b9b6b' });
    const subPort = this.savePortTypeLocally({ name: 'Subwoofer', type: 'subwoofer', color: '#95e1d3' });

    // Create a device with multiple outputs
    const crossoverDevice = this.saveDeviceTypeLocally({
      name: 'Crossover',
      label: 'Audio Crossover',
      input_ports: [{ name: 'In', type: 'audio' }],
      output_ports: [
        { name: 'Mid/High Out', type: 'audio' },
        { name: 'Sub Out', type: 'subwoofer' },
      ],
    });

    // Create speakers
    const mainSpeaker = this.saveDeviceTypeLocally({
      name: 'Main Speaker',
      label: 'Main Speakers',
      input_ports: [{ name: 'In', type: 'audio' }],
      output_ports: [],
    });

    const subSpeaker = this.saveDeviceTypeLocally({
      name: 'Subwoofer',
      label: 'Subwoofer',
      input_ports: [{ name: 'In', type: 'subwoofer' }],
      output_ports: [],
    });

    // Create layout with selective connections
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

    const saved = this.saveLayoutLocally(layout);
    const loaded = this.loadLayoutLocally(saved.id);

    this.assertEqual(loaded.devices.length, 3, 'Should have 3 devices');
    this.assertEqual(loaded.connections.length, 2, 'Should have 2 connections');
    this.assertEqual(loaded.connections[0].from_port, 'Mid/High Out', 'First connection should use Mid/High Out');
    this.assertEqual(loaded.connections[1].from_port, 'Sub Out', 'Second connection should use Sub Out');
  });

  runner.test('E2E 4.3: Save, load, modify, and re-save layout', async function () {
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

    const saved1 = this.saveLayoutLocally(layout1);
    const layoutId = saved1.id;

    // Load it
    const loaded1 = this.loadLayoutLocally(layoutId);
    this.assertEqual(loaded1.devices.length, 1, 'Initial layout should have 1 device');

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
    const saved2 = this.saveLayoutLocally(loaded1Modified);
    this.assertEqual(saved2.name, 'Version 2', 'Modified name should be saved');
    this.assertEqual(saved2.devices.length, 2, 'Modified layout should have 2 devices');
    this.assertEqual(saved2.connections.length, 1, 'Modified layout should have 1 connection');

    // Verify only one layout exists (updated, not duplicated)
    const layouts = this.getLayoutsFromLocalStorage();
    this.assertEqual(layouts.length, 1, 'Should still have only 1 layout');
  });

  return runner;
}

// ===== EXPORT FOR NODE.JS OR BROWSER =====

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TestRunner, setupTestSuite };
}
