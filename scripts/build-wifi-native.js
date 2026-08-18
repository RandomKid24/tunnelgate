const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

if (process.platform !== 'darwin') {
  console.log('[wifi-native] Skipping — macOS only');
  process.exit(0);
}

const ELECTRON_VERSION = '31.7.7';
const srcDir = path.resolve(__dirname, '..', 'native', 'wifi-native');
const buildDir = path.join(srcDir, 'build');
const addonOutPath = path.join(buildDir, 'Release', 'wifi_native.node');

console.log('[wifi-native] Building native WiFi helper addon...');

if (fs.existsSync(buildDir)) {
  fs.rmSync(buildDir, { recursive: true, force: true });
}

const r = spawnSync('npx', [
  'node-gyp', 'rebuild',
  `--target=${ELECTRON_VERSION}`,
  '--arch=arm64',
  '--dist-url=https://electronjs.org/headers',
], { cwd: srcDir, stdio: 'inherit' });

if (r.status !== 0) {
  console.error('[wifi-native] Build failed');
  process.exit(1);
}

if (!fs.existsSync(addonOutPath)) {
  console.error('[wifi-native] Build output not found at', addonOutPath);
  process.exit(1);
}

// Ad-hoc sign — hardened runtime library validation is disabled via
// entitlements, but a valid signature keeps codesign --verify happy.
spawnSync('codesign', ['--force', '--sign', '-', addonOutPath], { stdio: 'ignore' });
console.log('[wifi-native] Signed', addonOutPath);

// Mirror into dev Electron's own Resources so `npm run dev` (which runs the
// raw node_modules/electron binary) can find it at the same relative path
// wifiDetector.ts expects in packaged mode, for local testing consistency.
// (In dev mode wifiDetector.ts actually reads directly from
// native/wifi-native/build/Release, so this mirror isn't required — kept
// here only for parity with build-native.js's existing pattern.)

console.log('[wifi-native] Build complete.');
