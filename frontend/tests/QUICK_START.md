# Audio Gear Layout - Test Suite Quick Start

## 📦 What's Included

A complete test suite covering:
- **15 total tests** across 4 categories
- **Layout management** (create, save, load, update, list)
- **Port type creation** (custom port types with colors)
- **Device type creation** (devices with multiple configurable ports)
- **End-to-end workflows** (complex hi-fi setups with multiple connections)

## 🚀 Quick Start

### Browser Testing (Easiest)

```bash
# 1. Start the application
docker-compose up

# 2. Open in browser
http://localhost:7002/tests/

# 3. Click "Run Tests"
```

### Command Line Testing (CI/CD)

```bash
# 1. Install dependencies
npm install

# 2. Run all tests
npm test

# 3. Watch mode (auto-rerun)
npm run test:watch

# 4. Coverage report
npm run test:coverage
```

## 📊 Test Summary

### Layout Tests (6)
```
✓ Create new layout
✓ Save layout with devices
✓ Load layout from storage
✓ Save layout with connections
✓ Update existing layout
✓ List multiple layouts
```

### Port Type Tests (3)
```
✓ Create custom port type
✓ Create multiple port types
✓ Update existing port type
```

### Device Type Tests (3)
```
✓ Create custom device type
✓ Create device with multiple ports
✓ Create multiple device types
```

### End-to-End Tests (3)
```
✓ Hi-Fi chain: Port types → Device types → Layout → Connections
✓ Complex system: Crossover with dual outputs to different devices
✓ Modify workflow: Create → Load → Modify → Re-save
```

## 🧪 Test Execution Flow

### E2E Test 1: Complete Hi-Fi Setup
```
1. Create port types (S/PDIF, RCA)
2. Create device types (Streamer, DAC, Amplifier)
3. Create layout with 3 device instances
4. Connect: Streamer --[S/PDIF]--> DAC
5. Connect: DAC --[RCA]--> Amplifier
6. Save to localStorage
7. Load and verify complete structure
```

### E2E Test 2: Multi-Output Routing
```
1. Create port types (Audio, Subwoofer)
2. Create Crossover device (1 in, 2 out)
3. Create Main Speaker and Subwoofer devices
4. Connect output 1 → Main Speaker (audio)
5. Connect output 2 → Subwoofer (subwoofer)
6. Verify port type matching
```

### E2E Test 3: Evolution Workflow
```
1. Create V1: DAC only
2. Load and add Amplifier
3. Create connection between them
4. Re-save as V2
5. Verify single layout (not duplicated)
```

## 📁 Test Files

```
frontend/tests/
├── index.html              # Browser test runner
├── test-suite.js           # Core test suite (shared)
├── test-suite.test.js      # Jest test wrapper
├── jest.config.js          # Jest configuration
├── EXAMPLES.js             # Example test patterns
├── README.md               # Full documentation
└── QUICK_START.md          # This file
```

## 🔧 Test Infrastructure

### Storage Keys Used
- `audio_gear_layouts` - Saved layouts
- `audio_gear_port_types` - Custom port types
- `audio_gear_device_types` - Custom device types
- `audio_gear_storage_mode` - Storage backend setting

### Test Isolation
Each test automatically clears storage before running to ensure test independence.

## ✅ Verification Checklist

After running tests, verify:
- [ ] All 15 tests pass
- [ ] Duration < 500ms
- [ ] No errors in console
- [ ] Browser test runner shows green stats
- [ ] Jest output indicates 0 failures

## 🐛 Troubleshooting

### Tests Won't Run
1. Check browser console for errors
2. Verify localStorage is enabled
3. Clear localStorage and retry

### Specific Test Fails
1. See error message for details
2. Check test-suite.js for that test
3. Review test comments and expected values

### Jest Won't Start
1. Run `npm install` first
2. Check Node.js version >= 16.0.0
3. Verify jest.config.js path is correct

## 📈 What These Tests Validate

✅ **Data Integrity**
- Saved data matches loaded data
- No data corruption
- IDs uniquely identify items

✅ **Functionality**
- Create operations work
- Update operations don't duplicate
- Load/save roundtrips work

✅ **Port Type Matching**
- Same port types can connect
- Different types prevent connection
- Type validation is preserved

✅ **Complex Workflows**
- Multi-device chains work
- Selective port routing works
- Template-based devices work

## 🎯 Next Steps

1. Run the browser test runner to verify setup
2. Check all 15 tests pass
3. Review test-suite.js for test patterns
4. Add custom tests using EXAMPLES.js as reference
5. Integrate Jest tests into CI/CD pipeline

## 📞 Key Files for Reference

- **App Code**: `frontend/js/app.js`
- **Port Types**: `frontend/js/port-types.js`
- **Device Types**: `frontend/js/device-types.js`
- **Test Suite**: `frontend/tests/test-suite.js`
- **Jest Tests**: `frontend/tests/test-suite.test.js`

---

**Happy testing! 🎉**
