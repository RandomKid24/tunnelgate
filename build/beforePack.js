const path = require('path');
const { spawnSync } = require('child_process');
const { Arch } = require('electron-builder');

// Make sure the cloudflared binary for the platform/arch being packaged is
// present in resources/ before electron-builder copies it in via
// `extraResources`. This is what lets a packaged TunnelGate run tunnels
// without the user installing cloudflared themselves.
exports.default = async function beforePack(context) {
  const plat = context.electronPlatformName; // 'win32' | 'darwin' | 'linux'
  const arch = Arch[context.arch]; // 'x64' | 'arm64' | ...

  const script = path.join(__dirname, '..', 'scripts', 'fetch-cloudflared.js');
  const res = spawnSync(process.execPath, [script, plat, arch], {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
  });

  if (res.status !== 0) {
    throw new Error(
      `[beforePack] fetch-cloudflared.js failed for ${plat}-${arch} (exit ${res.status}). ` +
        `The packaged app would ship without a bundled cloudflared.`,
    );
  }
};
