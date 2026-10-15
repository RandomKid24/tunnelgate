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

No lint, test, or formatter scripts exist. **`npm run build` typechecks `main` and `preload` only — it does
not typecheck the renderer**, so undefined identifiers and type errors in `src/renderer/` ship silently
(Vite/esbuild strips types without checking). This has already caused one shipped bug: an unimported icon
reference threw at render time and blanked the whole window. Always typecheck the renderer before
committing a renderer change:

```sh
npx tsc -p tsconfig.json --noEmit          # renderer + shared  <-- the one people forget
npx tsc -p tsconfig.main.json --noEmit     # main
npx tsc -p tsconfig.preload.json --noEmit  # preload
```

## Build gotchas

- **Two native addon directories**: `src/native/rdp-addon/` has CMake source; `native/rdp-addon/build/Release/` is the build output. The build script (`scripts/build-native.js`) compiles from `src/` and copies the `.node` file to `native/`.
- **Windows prebuilt DLLs**: `prebuilt/windows-x64/` contains known-working FreeRDP DLLs. CI-compiled DLLs crash in `gdi_init_ex`. `build-native.js` copies these automatically — do not rebuild on Windows unless you verify RDP works.
- **WiFi native addon** (`scripts/build-wifi-native.js`): macOS-only, builds via `node-gyp`. Skips silently on other platforms.
- **macOS code signing**: `electron-builder`'s built-in signing corrupts Electron Framework on macOS 26+. `build/afterPack.mac.js` handles signing instead. Do not enable `electron-builder`'s native signing.
- **Windows OpenSSL legacy provider**: FreeRDP 3 needs RC4 legacy provider. `bootstrap.ts` sets `OPENSSL_MODULES` and `OPENSSL_CONF` env vars at runtime. The `legacy.dll` + `ossl-modules/` are in `prebuilt/windows-x64/`.
- **`bootstrap.ts` must be the first import** in `src/main/index.ts`. It sets `PATH`, `OPENSSL_MODULES`, and `OPENSSL_CONF` before the native addon loads. On Windows, it may re-launch the process with updated env vars.
- **`vite.config.mts` must keep the `.mts` extension**: `@tailwindcss/vite` is ESM-only and a CommonJS `.ts` config fails to load. The file was renamed from `vite.config.ts` for this reason.
- **Renderer error boundary** (`components/ErrorBoundary.tsx`, wrapped in `main.tsx`) catches render-time throws and shows a Reload screen instead of a blank window. It does not catch errors in event handlers or async code.
- **Renderer images must stay above 4 KB.** The renderer CSP is `default-src 'self'`, and Vite inlines assets smaller than `build.assetsInlineLimit` (4096 B) as `data:` URIs, which that CSP blocks. Importing an icon from `resources/` is fine as long as the file is bigger than the limit (the current app icon is ~22 KB); if you ever add a tiny image, raise `assetsInlineLimit` or add `img-src 'self' data:` to the CSP in `index.html`.

## Architecture

- **Main process** (`src/main/`): CommonJS, compiled via `tsconfig.main.json` → `dist/`. Entry: `index.ts`. Key files: `tunnelManager.ts` (cloudflared spawn/kill), `rdpViewManager.ts` (addon bridge), `credentialStore.ts` (safeStorage encrypt/decrypt), `store.ts` (electron-store persistence).
- **Preload** (`src/preload/`): CommonJS, compiled via `tsconfig.preload.json`. Bridges IPC to renderer as `window.pq` etc.
- **Renderer** (`src/renderer/`): ESNext + React JSX + Tailwind v4, compiled via `vite.config.mts` + `tsconfig.json` → `dist/renderer/`. Vite aliases: `@` → `src/renderer/`, `@shared` → `src/shared/` (mirrored in the `paths` block of `tsconfig.json`).
- **UI layer** (`src/renderer/components/ui/`): vendored [befui](https://befui.vercel.app/) components (Radix + CVA + Tailwind). Import as `@/components/ui/<name>`. `src/renderer/index.css` holds the Tailwind v4 import, the befui theme tokens.
- **Theming** (`src/renderer/hooks/useTheme.ts`): light / dark / system, defaulting to **light** (`DEFAULT_THEME`). Picked from the topbar (`components/ThemeMenu.tsx`) and persisted to `localStorage` under `tunnelgate:theme`. `initTheme()` runs in `main.tsx` before the first render and toggles `light`/`dark` on `<html>`, which is what befui's `dark:` variant keys off. Never hardcode `dark` on the document. `RdpView` pins `className="dark"` on its own root so the remote desktop stays dark in light mode.
- **Branding** (`src/renderer/components/BrandMark.tsx`): the real app icon from `resources/icons/`, used in the sidebar header and the sign-in card. The artwork is a dark navy mark on a transparent background, so it is always drawn on a white tile — otherwise it would disappear against the dark sidebar.
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
- RDP resolution is clamped to 640×480 … 3840×2160 (see `getBestRdpSize` and the clamps in `RdpView.tsx`). The toolbar height is subtracted from the viewport for canvas sizing.

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
src/renderer/index.css         # Tailwind v4 import + befui theme tokens
src/renderer/components/ui/    # vendored befui components (Radix + CVA + Tailwind)
src/renderer/components/BrandMark.tsx  # app icon tile (sidebar + sign-in card)
src/renderer/components/ThemeMenu.tsx  # topbar light/dark/system picker
src/renderer/hooks/useTheme.ts # theme store (applies class on <html>, persists to localStorage)
src/renderer/vite-env.d.ts     # vite/client types (lets the renderer import .png assets)
src/renderer/lib/utils.ts      # cn() helper (clsx + tailwind-merge)
src/renderer/views/RdpView.tsx # RDP viewer: fullscreen, ResizeObserver, Escape handler, Disconnect button
src/renderer/components/RdpCanvas.tsx # Canvas rendering + mouse input
src/preload/index.ts           # IPC bridge (contextIsolation)
vite.config.mts                # Vite + React + Tailwind v4, `@` / `@shared` aliases (must stay .mts)
src/native/rdp-addon/          # C++ FreeRDP 3 addon (cmake-js)
scripts/build-native.js        # cmake-js builder + DLL/dylib copy logic
scripts/build-wifi-native.js   # macOS-only WiFi addon (node-gyp)
prebuilt/windows-x64/          # Known-working Windows FreeRDP DLLs (committed)
build/afterPack.mac.js         # macOS code signing workaround
```
