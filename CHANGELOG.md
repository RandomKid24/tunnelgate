# Changelog

All notable changes to TunnelGate.

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
