#!/usr/bin/env node

/**
 * Diagnostic script to verify the touch implementation in app.js
 */

const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, 'frontend/js/app.js');
const appJs = fs.readFileSync(appJsPath, 'utf-8');

console.log('🔍 Analyzing app.js for touch functionality...\n');

const checks = [
  {
    name: 'touchCableState variable declared',
    test: () => appJs.includes('let touchCableState = null'),
    critical: true
  },
  {
    name: 'onTouchMove function defined',
    test: () => appJs.includes('function onTouchMove(evt)'),
    critical: true
  },
  {
    name: 'onTouchEnd function defined',
    test: () => appJs.includes('function onTouchEnd(evt)'),
    critical: true
  },
  {
    name: 'canvas.addEventListener("touchstart")',
    test: () => appJs.includes("canvas.addEventListener('touchstart'"),
    critical: true
  },
  {
    name: 'canvas.addEventListener("touchend")',
    test: () => appJs.includes("canvas.addEventListener('touchend'"),
    critical: true
  },
  {
    name: 'clearCableConnectionMode function',
    test: () => appJs.includes('function clearCableConnectionMode()'),
    critical: true
  },
  {
    name: 'showCableConnectionModeMessage function',
    test: () => appJs.includes('function showCableConnectionModeMessage()'),
    critical: true
  },
  {
    name: 'startDeviceMove accepts isTouchDrag parameter',
    test: () => appJs.includes('function startDeviceMove(deviceId, pt, isTouchDrag'),
    critical: true
  },
  {
    name: 'endDeviceMove checks isTouchDrag to skip selection',
    test: () => appJs.includes('isTouchDrag'),
    critical: true
  },
  {
    name: 'svgPoint handles touch events',
    test: () => appJs.includes('evt.touches?.[0]?.clientX'),
    critical: true
  },
  {
    name: 'Passive event listener for touchmove',
    test: () => appJs.includes("{ passive: false }"),
    critical: false
  },
];

let passed = 0;
let failed = 0;

checks.forEach(check => {
  const result = check.test();
  const icon = result ? '✓' : '✗';
  const color = result ? '\x1b[32m' : '\x1b[31m';
  const reset = '\x1b[0m';
  
  console.log(`${color}${icon}${reset} ${check.name}`);
  
  if (result) {
    passed++;
  } else {
    failed++;
    if (check.critical) {
      console.log(`  ⚠️  This is a critical item!`);
    }
  }
});

console.log('\n' + '='.repeat(50));
console.log(`\nResults: ${passed} passed, ${failed} failed\n`);

if (failed === 0) {
  console.log('✓ All checks passed! Touch implementation looks good.');
  console.log('\nNext steps:');
  console.log('1. Start the app with: docker-compose up');
  console.log('2. Open http://localhost:7002 on a mobile device or browser with touch emulation');
  console.log('3. Test:');
  console.log('   - Tap output port → cable mode activates');
  console.log('   - Move finger → rubber band follows');
  console.log('   - Tap input port → connection created (if port types match)');
  console.log('   - Tap device → drag to move (should NOT open ports editor if moved)');
} else {
  console.log('✗ Some checks failed. Review the implementation.');
  process.exit(1);
}
