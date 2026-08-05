const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// electron-builder's own packaging step invalidates (and on macOS 26+
// "Tahoe" corrupts) the prebuilt Electron Framework's original Apple
// signature. Running this before the DMG/zip is created — instead of
// after, when it would be too late — replaces the Framework binary with
// the untouched copy from node_modules and re-signs the whole bundle
// ad-hoc so Gatekeeper/AMFI see a valid (if untrusted) signature instead
// of none at all. See docs/README "macOS: Code Signing Workarounds".
exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;

  const projectDir = context.packager.projectDir;
  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);

  const pristineFramework = path.join(
    projectDir, 'node_modules', 'electron', 'dist', 'Electron.app',
    'Contents', 'Frameworks', 'Electron Framework.framework', 'Versions', 'A', 'Electron Framework'
  );
  const bundledFramework = path.join(
    appPath, 'Contents', 'Frameworks', 'Electron Framework.framework', 'Versions', 'A', 'Electron Framework'
  );

  if (fs.existsSync(pristineFramework) && fs.existsSync(bundledFramework)) {
    fs.copyFileSync(pristineFramework, bundledFramework);
    console.log('[afterPack] Restored pristine Electron Framework binary');
  } else {
    console.warn('[afterPack] Skipped Framework restore — pristine copy not found at', pristineFramework);
  }

  const entitlements = path.join(projectDir, 'build', 'entitlements.mac.plist');
  const sign = spawnSync('codesign', [
    '--deep', '--force', '--sign', '-',
    '--options', 'runtime',
    '--entitlements', entitlements,
    appPath,
  ], { stdio: 'inherit' });

  if (sign.status !== 0) {
    throw new Error(`[afterPack] codesign failed with exit code ${sign.status}`);
  }
  console.log('[afterPack] Ad-hoc signed', appPath);
};
