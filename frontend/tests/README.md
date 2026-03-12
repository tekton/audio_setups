# Audio Gear Layout - Test Suite Documentation

This directory contains a comprehensive test suite for the Audio Gear Layout application, covering layout creation/save/load, port types, device types, and end-to-end workflows.

## 📋 Test Coverage

### 1. **Layout Tests** (6 tests)
- ✅ Create a new layout
- ✅ Save layout with devices
- ✅ Load layout from local storage
- ✅ Save layout with connections
- ✅ Update existing layout
- ✅ List multiple layouts

### 2. **Port Type Tests** (3 tests)
- ✅ Create custom port type
- ✅ Create multiple port types
- ✅ Update existing port type

### 3. **Device Type Tests** (3 tests)
- ✅ Create custom device type
- ✅ Create device type with multiple ports
- ✅ Create multiple device types

### 4. **End-to-End Tests** (3 tests)
- ✅ **E2E 4.1**: Create port types → device types → layout with connections
  - Creates custom port types (S/PDIF, RCA)
  - Creates device types (Streamer, DAC, Amplifier)
  - Populates layout with devices
  - Connects them with proper port type validation
  - Saves and loads the complete layout
  
- ✅ **E2E 4.2**: Complex multi-output device with selective connections
  - Creates port types (Audio, Subwoofer)
  - Creates crossover device with dual outputs
  - Creates main speaker and subwoofer devices
  - Connects different output ports to different devices
  - Verifies correct port routing
  
- ✅ **E2E 4.3**: Save, load, modify, and re-save layout
  - Creates initial layout with one device
  - Loads it from storage
  - Modifies it by adding another device and connection
  - Re-saves the modified layout
  - Verifies no duplicates are created

## 🚀 Running Tests

### Option 1: Browser Test Runner (Recommended for Development)

1. Start the application:
   ```bash
   docker-compose up
   ```

2. Open the test suite in your browser:
   ```
   http://localhost:7002/tests/

3. Click the **"Run Tests"** button to execute all tests

**Features:**
- Real-time test execution
- Visual pass/fail indicators
- Error messages with details
- Performance timing
- Summary of failures

### Option 2: Node.js/Jest Runner (Recommended for CI/CD)

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run tests:
   ```bash
   npm test
   ```

3. Run tests in watch mode (auto-rerun on file changes):
   ```bash
   npm run test:watch
   ```

4. Generate coverage report:
   ```bash
   npm run test:coverage
   ```

## 📊 Test Architecture

### Test Classes and Methods

#### `TestRunner` Class
Core testing utility class with the following methods:

**Storage Utilities:**
- `clearStorage()` - Clear all localStorage data
- `getLayoutsFromLocalStorage()` - Retrieve saved layouts
- `getPortTypesFromLocalStorage()` - Retrieve port types
- `getDeviceTypesFromLocalStorage()` - Retrieve device types

**Save/Load Methods:**
- `saveLayoutLocally(layout)` - Save layout to localStorage
- `loadLayoutLocally(id)` - Load layout from localStorage
- `savePortTypeLocally(portType)` - Save port type
- `saveDeviceTypeLocally(deviceType)` - Save device type

**Assertion Methods:**
- `assert(condition, message)` - Basic assertion
- `assertEqual(actual, expected, message)` - Equality check
- `assertDeepEqual(actual, expected, message)` - Deep object comparison
- `assertArrayIncludes(array, value, message)` - Array inclusion check

**Test Execution:**
- `test(name, fn)` - Queue a test
- `run()` - Execute all queued tests

### Test Data Models

#### Layout
```javascript
{
  id: string,
  name: string,
  devices: Device[],
  connections: Connection[]
}
```

#### Device
```javascript
{
  id: string,
  type: string,
  label: string,
  position: { x: number, y: number },
  input_ports: Port[],
  output_ports: Port[],
  templateId?: string
}
```

#### Port
```javascript
{
  name: string,
  type: string  // e.g., 'audio', 'spdif', 'rca', 'subwoofer'
}
```

#### Connection
```javascript
{
  id: string,
  from_device_id: string,
  to_device_id: string,
  from_port: string,
  to_port: string,
  from_port_type: string,
  to_port_type: string
}
```

#### PortType
```javascript
{
  id: string,
  name: string,
  type: string,  // slug/key
  color: string  // hex color
}
```

#### DeviceType
```javascript
{
  id: string,
  name: string,
  label: string,
  input_ports: Port[],
  output_ports: Port[]
}
```

## 📝 Local Storage Schema

The tests use localStorage with these keys:

```javascript
{
  'audio_gear_layouts': [...],        // Array of layouts
  'audio_gear_port_types': [...],     // Array of port types
  'audio_gear_device_types': [...],   // Array of device types
  'audio_gear_storage_mode': 'local'  // Storage mode
}
```

## 🧪 Test Scenarios

### Scenario 1: Basic Layout Workflow
```
Create Layout → Add Devices → Save → Load → Verify Data Integrity
```

### Scenario 2: Custom Port Types
```
Create Port Type 1 → Create Port Type 2 → Use in Device Type → Create Device
```

### Scenario 3: Complex Hi-Fi Setup
```
↓ Create 2 Port Types (S/PDIF, RCA)
↓ Create 3 Device Types (Streamer, DAC, Amp)
↓ Create Layout with 3 Device Instances
↓ Connect Streamer → DAC (S/PDIF)
↓ Connect DAC → Amp (RCA)
↓ Save to localStorage
↓ Reload and verify structure
```

### Scenario 4: Selective Connections
```
↓ Create Crossover Device (1 input, 2 outputs)
↓ Create Main Speaker Device
↓ Create Subwoofer Device
↓ Connect Output 1 → Main Speaker (audio port)
↓ Connect Output 2 → Subwoofer (subwoofer port)
↓ Verify port type matching
```

## 🔍 Debugging Tests

### Browser Console
Open browser DevTools (F12) and check the console for detailed logs:
```javascript
// Run a specific test function manually
runner.test('Custom test', async function() {
  // your test code
});
```

### Node.js Debug Mode
```bash
node --inspect-brk node_modules/.bin/jest --config frontend/tests/jest.config.js frontend/tests/test-suite.test.js
```

Then open `chrome://inspect` in Chrome.

## 📈 Test Results Interpretation

### Green (✅ Pass)
Test completed successfully, all assertions passed.

### Red (❌ Fail)
Test failed. Check the error message for details:
- **"Assertion failed"**: Condition was false
- **"expected X, got Y"**: Value mismatch
- **"TypeError: Cannot read property..."**: Null/undefined reference
- **"Array does not include..."**: Value not found in array

### Example Error Output
```
❌ Layout 1.4: Save layout with connections
   → connections[0].from_device_id: expected dev1, got undefined
```

This indicates the connection wasn't properly saved or loaded.

## 🛠️ Adding New Tests

### In Browser Test Runner

Edit `frontend/tests/test-suite.js` and add:

```javascript
runner.test('New Test Name', async function () {
  // TestRunner instance is available as 'this'
  
  // Arrange
  const layout = { name: 'Test', devices: [], connections: [] };
  
  // Act
  const saved = this.saveLayoutLocally(layout);
  
  // Assert
  this.assert(saved.id, 'Should have ID');
  this.assertEqual(saved.name, 'Test', 'Name should match');
});
```

### In Jest Test Suite

Edit `frontend/tests/test-suite.test.js` and add:

```javascript
test('New Test Name', async () => {
  await runner.clearStorage();
  
  const layout = { name: 'Test', devices: [], connections: [] };
  const saved = runner.saveLayoutLocally(layout);
  
  expect(saved.id).toBeDefined();
  expect(saved.name).toBe('Test');
});
```

## 🚨 Common Issues

### Issue: Tests fail with "Cannot read property X of undefined"
**Solution**: Make sure to call `await runner.clearStorage()` at the start of each test.

### Issue: Layout doesn't save/load
**Solution**: Check that the layout has an `id` property. The save method generates one if missing.

### Issue: Port types not matching in connections
**Solution**: Ensure port types are lowercase strings. The validation uses `.toLowerCase()` for comparison.

### Issue: Device instances not linked to templates
**Solution**: Include `templateId` property when creating device instances from device types.

## 📚 Related Files

- **Test Suite**: `frontend/tests/test-suite.js`
- **Jest Tests**: `frontend/tests/test-suite.test.js`
- **Browser Runner**: `frontend/tests/index.html`
- **App Code**: `frontend/js/app.js`
- **Port Types Page**: `frontend/js/port-types.js`
- **Device Types Page**: `frontend/js/device-types.js`

## 🎯 Future Improvements

- [ ] Add mutation testing
- [ ] Add performance benchmarks
- [ ] Add visual regression tests
- [ ] Add API integration tests
- [ ] Add touch event simulation tests
- [ ] Add accessibility tests (a11y)
- [ ] Add real browser testing with Playwright/Cypress

## 📞 Support

For issues or questions about the tests:
1. Check the error message in the test results
2. Review relevant test code in `test-suite.js`
3. Examine the app code for the feature being tested
4. Check browser console for detailed logs
