# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Employees of a single organization who need to remotely access their work desktops. They authenticate with their existing company HRMS (RBAC) credentials, and access may additionally be gated by whether they're on an approved office WiFi network. This is an internal company tool, not a multi-tenant or consumer product.

## Product Purpose

TunnelGate gives employees one-click RDP access to their work PCs through a Cloudflare Zero Trust Tunnel, without needing to run terminal commands, hand-configure `cloudflared`, or install a separate RDP client. Success means a non-technical employee can open the app, sign in, and be looking at their work desktop within a couple of clicks.

## Positioning

Two things a generic RDP client or manually-run `cloudflared` cannot match together: (1) zero-setup, one-click tunnel + RDP viewer bundled into a single app with credentials stored securely (Electron `safeStorage`), and (2) an access-control layer tying connection to the company's own identity and network policy — HRMS-authenticated login (RBAC) and optional office-WiFi restriction, so IT can gate who can reach company machines and from where.

## Operating Context

- Desktop Electron app (macOS, Windows, Linux) with an in-app FreeRDP 3 viewer rendered via a native C++ addon, so most sessions never need Microsoft's own RDP client.
- A native-client fallback exists (`mstsc.exe` on Windows, Microsoft Remote Desktop on macOS) with credentials pre-filled, for cases where the in-app viewer isn't preferred.
- Login is against the company's HRMS RBAC API (`hrms.encryptedbar.com`), which also returns roles/permissions.
- WiFi-based access gating (checking SSID/BSSID against an HRMS-managed whitelist) is being integrated; enforcement is controlled by a company-wide toggle on the HRMS side and can be off while still wired up.
- Core workflows: manage a list of saved tunnels/servers, connect/disconnect, view an in-app remote desktop session, view connection logs, and adjust app settings (cloudflared path, launch on startup, auto-reconnect, etc.).

## Capabilities and Constraints

- Passwords/secrets are encrypted at rest via Electron `safeStorage` (DPAPI / Keychain / libsecret) — never stored in plaintext.
- RDP rendering path: `cloudflared access tcp` → native FreeRDP 3 addon (worker thread, GDI decode) → IPC frame push → `<canvas>` in the renderer, with dynamic resolution via `ResizeObserver`.
- Auto-reconnect on transient tunnel interruption. The RDP session is ended with the in-app **← Back** button; Esc is forwarded to the remote desktop (and exits fullscreen when fullscreen) so it never accidentally drops the session.
- Auth and WiFi-gating are actively being built out (uncommitted work as of this session: `hrmsClient.ts`, `wifiDetector.ts`, `useAuth.ts`, `Login.tsx`, `UserMenu.tsx`) — treat these as real, load-bearing product surfaces, not experiments.

## Brand Commitments

Product name is "TunnelGate." Only the branding (name, logo, existing dark visual identity) is a fixed constraint for future design work — no other binding constraints were specified.

## Evidence on Hand

- `README.md` documents the architecture (system overview and RDP rendering pipeline diagrams) and the feature set.
- `RBAC_API_DOCUMENTATION.md` and `WIFI_TUNNELGATE_INTEGRATION.md` describe the external HRMS APIs this app integrates with (login/RBAC, WiFi whitelist validation) — these are specs for the backend TunnelGate talks to, not TunnelGate's own docs.
- No testimonials, customer names, or usage metrics exist; do not fabricate any.

## Product Principles

- Reduce every remote-access task to the fewest possible clicks; never surface tunnel/cloudflared internals unless something goes wrong.
- Treat credentials and access-control state as sensitive by default — encrypt at rest, gate visibly, fail closed rather than silently.
- The in-app viewer is the primary path; native-client fallback and manual configuration are escape hatches, not the main flow.
- Access control (HRMS login, WiFi restriction) should read as protection for the user's own company, not friction bolted onto the RDP experience.
