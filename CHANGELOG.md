# Changelog

All notable changes to TunnelGate.

## [Unreleased]

### Added
- Clipboard redirection in the in-app RDP viewer — copy/paste text between your local machine and the remote session, both directions, matching what `mstsc` gives you by default. The native addon (`rdp_session.cpp`) now enables `RedirectClipboard`, loads the `cliprdr` static virtual channel, and bridges it to the host OS clipboard through `RdpViewManager`, which polls the local clipboard while any session is live and mirrors remote copies back with an Electron `clipboard.writeText`. Text only (no file transfer); payloads over 256 KB are not synced to the remote. Requires the addon to be built against FreeRDP 3 (the path is compiled out on the FreeRDP 2 line some older Linux distros still ship). Clipboard contents are never written to the app logs.
- **cloudflared now ships inside the app** — users no longer install it separately. `scripts/fetch-cloudflared.js` downloads a pinned, SHA-256-verified `cloudflared` release for the target platform into `resources/`; `build/beforePack.js` runs it before every package build and `npm run build:native` runs it for local builds. `src/main/cloudflaredResolver.ts` is the new single resolver used by both the tunnel spawner and the Settings status readout — it prefers an explicit path from Settings, then the bundled binary, then a system install, then `PATH`. The Settings → Cloudflared section now shows "Bundled with app" and the path field is an optional override.

### Changed
- Building from source no longer needs `cloudflared` installed — `npm run build:all` fetches it.
- **<kbd>Esc</kbd> no longer disconnects the RDP session.** It was firing a full teardown (tunnel + RDP + Windows re-login) on a key you constantly need inside a remote desktop. Now: in fullscreen Esc exits fullscreen (and is not passed to the remote); windowed, Esc goes straight to the remote session. Disconnect with the **← Back** button. (`RdpView.tsx`)

### Fixed
- "Use Native Client" from within the in-app RDP viewer could fail with Windows' `Your computer could not connect to another console session... you already have a console session in progress` — the in-app FreeRDP session was still live and holding the target machine's one available session slot when `mstsc.exe` tried to open a second one. `LAUNCH_NATIVE_CLIENT` now disconnects the FreeRDP view first (with a brief pause for the server to actually release the slot) before launching the native client.
- The app no longer leaves the user stuck on a "session has expired, log in again" error banner — `useTunnels` now signs the user out automatically when a connect attempt fails for that reason, so the Login screen comes back up on its own instead of requiring a manual sign-out first.

### Changed
- `native/wifi-native/build/` (generated build output) is now gitignored, matching `native/rdp-addon/build/` — it had been accidentally tracked, which was inflating diffs with machine-specific build artifacts.

## [2.1.1] - 2026-08-27

### Fixed
- RDP logon failures (`STATUS_LOGON_FAILURE`, FreeRDP code `131092`) against domain-joined servers when the Windows Username field had no `DOMAIN\` prefix. The native RDP addon (`rdp_session.cpp`) was forcing the NTLM domain to the literal `"."` (local-machine-only auth) whenever no domain was specified — this field had flip-flopped between `""` and `"."` several times across the project's history because a single hardcoded default can't be right for both a workgroup/local-account server and a domain-joined one. Confirmed via real-world logs: the exact same injected credential failed through the in-app FreeRDP viewer but succeeded through `mstsc.exe`, which leaves the domain unspecified in this case. Domain now defaults to blank (matching `mstsc`'s behavior) when none is given; anyone who genuinely needs local-account-only auth can still force it by typing `.\username` explicitly in the Windows Username field.

## [2.1.0] - 2026-08-18

### Added
- HRMS sign-in gate: TunnelGate now requires signing in with an HRMS username/password before any tunnel can be used (`Login.tsx`, `useAuth`, `auth:login` / `auth:logout` / `auth:get-session` IPC). Session token is stored encrypted at rest, the same way tunnel passwords already were.
- Office-WiFi access gate: every connect action (tunnel connect, RDP view connect, native client launch) now validates the current WiFi network against the HRMS `/wifi-networks/validate/` API before proceeding — blocks the connection if the network isn't approved, and **fails closed** (blocks) rather than open if detection or verification fails for any reason (`checkWifiGate()` in `ipcHandlers.ts`, `hrmsClient.ts`, `wifiDetector.ts`).
- Native macOS WiFi-detection addon (`native/wifi-native`, Objective-C++ / N-API): reads the real SSID/BSSID via Apple's CoreWLAN framework directly in-process. Needed because `system_profiler`, `networksetup`, and `ipconfig` were all found to unconditionally redact the network name (`<redacted>`) on this macOS version regardless of what permissions are granted — CoreWLAN called in-process does not have that restriction. The addon requests Location authorization itself (so a first-time user gets the real system permission prompt, worded via a new `NSLocationWhenInUseUsageDescription` in the packaged app's Info.plist) and runs the wait off the main thread (`Napi::AsyncWorker`) so an unanswered dialog can never freeze the app.
- Persistent sidebar identity + sign-out (`UserMenu.tsx`): shows the signed-in user's initials, name, and a sign-out control at the bottom of the nav rail on every tab, not just in Settings.
- Show/hide password toggle on the login screen and the Add/Edit Tunnel form.
- Hover tooltips on every Add/Edit Tunnel field, explaining in plain language what to enter (e.g. where to find the Cloudflare Tunnel hostname, that the Windows username isn't the HRMS login) — matches the existing Settings tooltip convention.
- Search box on the Tunnels view (appears once there are more than 4 tunnels), filtering live by name or hostname.
- "N connected" summary pill next to the Tunnels heading, and active/connecting tunnels now sort to the top of the list instead of being buried alphabetically or by creation order.
- Icons throughout: nav tabs (Tunnels/Logs/Settings) and every tunnel-card action button (Connect, Disconnect, View Screen, Edit, Logs, Delete) — actions are now distinguishable by icon shape, not color alone.
- Instructive empty state: "Add your first server" now lists the three things you need (hostname, username, password) instead of one generic sentence.

### Changed
- Add/Edit Tunnel is now a centered modal dialog (`TunnelModal`) — dismiss via the corner ×, Cancel, backdrop click, or Esc — reusing the same overlay pattern already established by the Delete confirmation, instead of an inline form that expanded in place and pushed the tunnel list around.
- Tunnel form layout tightened so the dialog fits without internal scrolling on the app's default window size: Display Name and Port now share a row, and the detected server name collapses into a small inline caption under the hostname field instead of its own full field block. Input padding tightened from `10px 14px` to `8px 12px` app-wide to match.
- Error messages surfaced from the main process are now stripped of Electron's internal IPC wrapper text (`Error invoking remote method '...':`) before being shown to the user (`formatIpcError()`).
- HRMS error messages now prefer the server's own message over generic wording; "session expired" phrasing is now scoped only to already-authenticated requests (e.g. the WiFi check) instead of incorrectly appearing on the login form's own failed attempts.
- Login screen redesigned to match the rest of the app's flat, restrained visual language instead of a generic gradient-badge SaaS treatment (see Removed).

### Removed
- Gradient blue→purple identity badge, ambient radial background glow, and a decorative "$ tunnelgate login" kicker line on the login screen — all read as a generic imported template rather than this app's own considered surface, and clashed with the flat, single-accent language every other screen already used (`TunnelCard`, `Settings`). See `DESIGN.md`'s "Single-Accent Rule."
- Unicode glyphs (✎ / ✓) used as ad hoc icons in the tunnel form's password-status badge — replaced with proper stroke-style SVG icons matching the rest of the icon system.
- Dead-end Swift CLI WiFi-detection experiment (`native/wifi-helper`) — never managed to trigger a permission prompt on this macOS version; superseded by the native CoreWLAN addon above.

## [2.0.0]

### Added
- Friendly "TLS Handshake Failed" error message for FreeRDP `131080` (`ERRCONNECT_TLS_CONNECT_FAILED`) instead of the generic error box (`RdpView.tsx`).
- Update banner: the app now checks GitHub for the latest release on startup and shows a dismissible banner with a download link when a newer version exists (`useUpdateCheck`, new `app:check-updates` / `app:open-external` IPC).
- `shortServerName()` helper: detected server names are displayed as the short machine name (`ARPT03` instead of `ARPT03.ARPT03.LOCAL`), with the full certificate CN available as a tooltip on cards, the RDP toolbar, and the tunnel form.
- Single-instance lock: launching the app a second time brings the existing window to the front instead of starting a duplicate tray/process.
- Inline connection errors: connect failures are shown as a red banner on the tunnel card instead of a blocking native `alert()`.
- Window size and position are remembered and restored across launches (validated against connected displays).

## [1.0.1] - macOS arm64 / Windows x64 / Linux x64

### Changed
- Repackaged with FreeRDP 3.3 (bundled `libfreerdp3.3`, `libfreerdp-client3.3`, `libwinpr3.3`) to enable real server-name detection via `verifyX509Certificate`.
- Server-name detection also works on the FreeRDP 2.x code path (Linux): common name is captured from the certificate in the legacy verify callbacks, and `IgnoreCertificate` is now version-dependent so the callbacks actually run on 2.x.
- Windows native-client auto-login: injects credentials for both `TERMSRV/127.0.0.1:<port>` and `TERMSRV/127.0.0.1` (the target mstsc actually matches after stripping the port).
- Linux native-client auto-login: `xfreerdp` is now launched with `/p:<password>`.
- macOS app bundle is ad-hoc signed before DMG packaging (avoids Electron Framework corruption on macOS 26+).

### Fixed
- TLS/transport error handling improvements, NLA security layer enabled for RDP connections, and reliable `127.0.0.1` targeting.

### Docs
- `RDP_NATIVE_ADDON.md`, `REPLICATE_FROM_SCRATCH.md`, `TUNNELGATE_COMPLETE.md` updated to cover server-name detection, cross-platform differences, native-client auto-login, and CI FreeRDP setup.

## [1.0.0] - Initial release

- One-click RDP access through Cloudflare Tunnels.
- Bundled native RDP engine (FreeRDP via C++ addon) with in-app "View Screen".
- Credential storage via OS-safe encryption; auto-login to built-in RDP view.
- Multi-platform build pipeline (macOS, Windows, Linux) with GitHub Actions releases.
