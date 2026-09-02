# AGENTS.md — TunnelGate

Electron 31 + React 18 + Vite 5 + TypeScript 5 + C++ native addon (FreeRDP 3 via cmake-js).
One-click RDP viewer through Cloudflare Zero Trust tunnels.

## Key commands

```sh
npm run build:all        # full build: native addon + TS + Vite
npm run build            # TS + Vite only (no native)
npm run build:native     # cmake-js builds C++ addon + copies prebuilt DLLs
npm run dev              # Vite dev server + Electron hot reload
npm run dev:renderer     # Vite only (port 5173)
npm run dev:main         # tsc + electron only
```

Packaging:
```sh
npm run build:all && npx electron-builder --mac    # DMG (arm64)
npm run build:all && npx electron-builder --win    # NSIS installer
npm run build:all && npx electron-builder --linux  # AppImage + .deb
```

No lint, typecheck, test, or formatter scripts exist. `npm run build` is the closest verification step (TypeScript strict mode catches type errors).

## Build gotchas

- **Two native addon directories**: `src/native/rdp-addon/` has CMake source; `native/rdp-addon/build/Release/` is the build output. The build script (`scripts/build-native.js`) compiles from `src/` and copies the `.node` file to `native/`.
- **Windows prebuilt DLLs**: `prebuilt/windows-x64/` contains known-working FreeRDP DLLs. CI-compiled DLLs crash in `gdi_init_ex`. `build-native.js` copies these automatically — do not rebuild on Windows unless you verify RDP works.
- **WiFi native addon** (`scripts/build-wifi-native.js`): macOS-only, builds via `node-gyp`. Skips silently on other platforms.
- **macOS code signing**: `electron-builder`'s built-in signing corrupts Electron Framework on macOS 26+. `build/afterPack.mac.js` handles signing instead. Do not enable `electron-builder`'s native signing.
- **Windows OpenSSL legacy provider**: FreeRDP 3 needs RC4 legacy provider. `bootstrap.ts` sets `OPENSSL_MODULES` and `OPENSSL_CONF` env vars at runtime. The `legacy.dll` + `ossl-modules/` are in `prebuilt/windows-x64/`.
- **`bootstrap.ts` must be the first import** in `src/main/index.ts`. It sets `PATH`, `OPENSSL_MODULES`, and `OPENSSL_CONF` before the native addon loads. On Windows, it may re-launch the process with updated env vars.

## Architecture

- **Main process** (`src/main/`): CommonJS, compiled via `tsconfig.main.json` → `dist/`. Entry: `index.ts`. Key files: `tunnelManager.ts` (cloudflared spawn/kill), `rdpViewManager.ts` (addon bridge), `credentialStore.ts` (safeStorage encrypt/decrypt), `store.ts` (electron-store persistence).
- **Preload** (`src/preload/`): CommonJS, compiled via `tsconfig.preload.json`. Bridges IPC to renderer as `window.pq` etc.
- **Renderer** (`src/renderer/`): ESNext + React JSX, compiled via `vite.config.ts` + `tsconfig.json` → `dist/renderer/`. Vite alias `@shared` → `src/shared/`.
- **Shared types** (`src/shared/`): Used by both main and renderer. Each tsconfig includes it.
- **Native addon** (`src/native/rdp-addon/`): C++ via cmake-js + N-API. GDI frames → raw RGBA → IPC `rdp-frame` → React `<canvas>`.
- **Preload bridge** (`src/preload/index.ts`): Exposes IPC channels to renderer. Never expose `safeStorage` or API keys.

## Important conventions

- Main process uses `commonjs` module system. Renderer uses `ESNext` with Vite bundling. Do not mix imports across this boundary.
- Passwords are encrypted at rest via Electron `safeStorage` (DPAPI/Keychain/libsecret). Never log or expose them.
- Processes are spawned with `argv` arrays, never shell strings (security requirement).
- Window close is intercepted — `PREVENT_WINDOW_CLOSE = true` hides to tray instead. Only the tray "Quit" menu truly exits.
- `electron-store` persists tunnel configs and window bounds. Data lives in `userData` directory.
- `pq-befu` error monitoring: API key stays in main process only. Renderer reports errors through preload bridge.
- RDP resolution capped at 2560×1440. Toolbar height is subtracted from viewport for canvas sizing.

## Environment variables

```sh
PQ_API_KEY=...           # error monitoring (main process only)
PQ_BASE_URL=...          # optional, default http://localhost:8000
NODE_ENV=development     # or production
FREERDP_ROOT=...         # optional override for FreeRDP install path
VCPKG_ROOT=...           # optional, Windows vcpkg root (defaults to C:\vcpkg)
```

## Must-read before touching the native addon

Read `docs/RDP_NATIVE_ADDON.md` before modifying any C++ or RDP-related code. It documents the full pixel pipeline, mouse/keyboard flag constants (mixing up `PTR_FLAGS_*` vs `PTR_XFLAGS_*` kills the transport), canvas rendering rules, cross-platform gotchas, and 11 real bugs with their fixes. The troubleshooting section covers black-screen diagnosis and pump loop issues.

## File map (high-signal)

```
src/main/bootstrap.ts          # MUST import first — sets PATH/env for native addon
src/main/index.ts              # Electron entry point
src/main/tunnelManager.ts      # cloudflared lifecycle
src/main/cloudflaredResolver.ts # locates cloudflared (bundled > system > PATH)
src/main/rdpViewManager.ts     # FreeRDP addon bridge + clipboard bridge
src/main/credentialStore.ts    # safeStorage encrypt/decrypt
src/main/store.ts              # electron-store persistence
src/renderer/views/RdpView.tsx # RDP viewer: fullscreen, ResizeObserver, Escape handler
src/renderer/components/RdpCanvas.tsx # Canvas rendering + mouse input
src/preload/index.ts           # IPC bridge (contextIsolation)
src/native/rdp-addon/          # C++ FreeRDP 3 addon (cmake-js)
scripts/build-native.js        # cmake-js builder + DLL/dylib copy logic
scripts/build-wifi-native.js   # macOS-only WiFi addon (node-gyp)
prebuilt/windows-x64/          # Known-working Windows FreeRDP DLLs (committed)
build/afterPack.mac.js         # macOS code signing workaround
```
