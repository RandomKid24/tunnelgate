---
name: TunnelGate
description: One-click RDP through Cloudflare Zero Trust Tunnel, gated by HRMS login and office WiFi policy.
colors:
  signal-blue: "#3b82f6"
  console-violet: "#8b5cf6"
  connected-green: "#22c55e"
  reconnecting-amber: "#f59e0b"
  alert-red: "#ef4444"
  void: "#0f1117"
  panel: "#1a1c25"
  card: "#1e2030"
  raised: "#232530"
  hairline: "#2a2d3e"
  muted-ink: "#6b7089"
  secondary-ink: "#9ca0b0"
  primary-ink: "#e2e4eb"
typography:
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.3
  heading:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "normal"
  mono:
    fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  xxl: "24px"
  xxxl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.signal-blue}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "10px 18px"
  button-primary-hover:
    backgroundColor: "{colors.signal-blue}"
    textColor: "#ffffff"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.secondary-ink}"
    rounded: "{rounded.sm}"
    padding: "10px 18px"
  button-danger:
    backgroundColor: "{colors.alert-red}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "10px 18px"
  input:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.primary-ink}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.primary-ink}"
    rounded: "{rounded.md}"
    padding: "18px"
---

# Design System: TunnelGate

## Overview

**Creative North Star: "The Calm Concierge"**

TunnelGate stands between an employee and a genuinely technical stack — Cloudflare tunnels, certificates, the RDP protocol, HRMS access policy — and shows them almost none of it. Like a good concierge, it's quietly, thoroughly capable, but the person in front of it should only ever feel *helped*: warm dark surfaces, generous breathing room, plain language. The interface earns that trust the same way the rest of the app already did — flat, restrained, single-accent surfaces rather than decoration — so a new screen never reads as a generic imported template bolted onto an otherwise plain, considered tool. The technical plumbing still shows up exactly where it must — a hostname you need to type correctly, a log line worth reading precisely — but it's the exception, not the interface's default voice.

Depth stays soft rather than heavy: cards lift gently on interaction instead of casting hard industrial shadows, corners are rounded enough to feel approachable without losing definition, and color is still spent with intention — one calm accent color, plus green/amber/red reserved for connection status — but that restraint now reads as *clarity for the user*, not console discipline for its own sake. A non-technical employee should be able to look at any screen and immediately know what's happening and what to do next.

**Key Characteristics:**
- Warm dark neutral base — flat surfaces, no gradients or ambient glow; contrast comes from the tonal layer system (Void → Panel → Card → Raised), not decoration
- Plain, sentence-case language by default; uppercase tracked labels are the exception, reserved for dense settings/technical panels
- Status color (green/amber/red) still reserved exclusively for connection/severity state — clarity, not decoration
- Monospace reserved for genuinely technical, copy-worthy values (hostnames, ports, log lines) — not the interface's default voice
- Gently rounded surfaces (6–16px) and soft, low-opacity shadows; nothing reads as heavy or industrial

## Colors

A near-monochrome dark palette carries the interface; color is spent with intention — one calm identity accent, used flat, and status color exactly where it matters.

### Primary
- **Signal Blue** (#3b82f6): The interactive/brand accent, used flat/solid — primary buttons, focus rings, active nav indicator, links, the "View Screen" action, and the signed-in user's avatar fill. No gradient, no ambient glow — an earlier login-screen treatment tried both and was deliberately reverted for reading as a generic imported template rather than this app's own considered surface (see The Single-Accent Rule).

### Secondary
- **Console Violet** (#8b5cf6): Defined as a token but currently unused in the shipped UI — reserved for a future second accent (e.g. a distinct category or role color) rather than spent decoratively. Do not reach for it to "add visual interest"; an unused reserved color is doing its job.

### Status (reserved — not decorative)
- **Connected Green** (#22c55e): Live/connected/success state only — status dot, "Connected" label, success confirmations, detected-server-name text.
- **Reconnecting Amber** (#f59e0b): Connecting/reconnecting/warning only — status dot (pulsing), update-available banner, "password changed but unsaved" indicator.
- **Alert Red** (#ef4444): Error/destructive only — error status, failed connections, delete confirmations, validation errors.

### Neutral
- **Void** (#0f1117): App background (`--bg-primary`) — the base the whole interface sits on.
- **Panel** (#1a1c25): Secondary surfaces — nav rail, input backgrounds (`--bg-secondary`).
- **Card** (#1e2030): Card and modal backgrounds (`--bg-card`).
- **Raised** (#232530): Tertiary surfaces — active tab background, small tag/badge backgrounds (`--bg-tertiary`).
- **Hairline** (#2a2d3e): Borders and dividers (`--border-color`) — the only line weight in the system.
- **Muted Ink** (#6b7089): Tertiary text — timestamps, placeholders, disabled state (`--text-muted`).
- **Secondary Ink** (#9ca0b0): Secondary text — subtitles, field labels, nav item default state (`--text-secondary`).
- **Primary Ink** (#e2e4eb): Primary text and headings (`--text-primary`).

### Named Rules
**The Reserved Signal Rule.** Green, amber, and red mean connected, warning/in-progress, and error/destructive — nowhere else. A future screen that wants a "success" or "danger" tint anywhere outside connection/action state must earn a new token; it does not borrow these. This isn't console discipline for its own sake — it's what lets a non-technical user trust color at a glance.

**The Single-Accent Rule.** Signal Blue is the only accent in active use, and it's spent flat — solid fills, solid text, solid borders. No gradients, no ambient glows, no decorative radial backgrounds anywhere in the app. This was a deliberate correction: an earlier pass added a blue→violet gradient badge and a soft radial glow to the login screen, and it read as an "AI-generated SaaS" cliché that clashed with every other screen's flat, restrained treatment (`TunnelCard`, `Settings`). The fix was matching the app's own established language, not inventing a new one. Console Violet stays reserved and unused until a real second accent is needed.

## Typography

**UI Font:** -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif (system stack — no custom webfont)
**Mono Font:** 'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace

**Character:** The system UI stack, set a notch larger and roomier than a typical dense tool (14px body, not 12–13px), keeps the interface reading as friendly and legible rather than cramped. Monospace is switched in deliberately and sparingly — only where a value needs to be read or copied precisely (a hostname, a port, a log line, a detected server name) — its appearance is itself a signal that "this is verifiable data," not a default technical texture spread across the app.

### Hierarchy
- **Title** (700, 22px, 1.3): Page-level headers only — "Tunnels", "Logs", "Settings".
- **Heading** (600, 16px, 1.4): Section and dialog headers — "Add Tunnel", "Delete Tunnel?".
- **Body** (400, 14px, 1.5): Default UI text — labels, descriptions, form values, empty-state copy.
- **Label** (500, 12px, 1.4, sentence case): Field labels, status text, section headers. Plain sentence case by default; reserve uppercase tracked caps for dense, technical contexts only (advanced settings fields, log-level badges) — not for anything a first-time user reads.
- **Mono** (400, 12px, 1.5): Log entries, hostnames, ports, detected server names, cloudflared paths — nowhere else.

### Named Rules
**The Human-First Rule.** Plain sentence-case Body/Label type is the interface's default voice. Uppercase tracked labels and monospace are both exceptions reserved for genuinely dense or technical contexts, never applied by default just because a value "looks technical."

**The Verifiable-Data Rule.** Anything the user might need to copy, type into another tool, or trust exactly as shown (hostnames, ports, server names, log output, file paths) renders in Mono. Everything else — including status words, settings, and descriptions — stays in the warm UI font.

## Layout

Single-window, three-pane shell: a fixed 200px nav rail on the left (Tunnels / Logs / Settings, each with a small line icon; user identity pinned to the bottom), a flexible main content area, and an optional top-of-window banner (e.g. update available) that pushes content down rather than overlaying it. Main content uses 24px outer padding and scrolls independently of the nav rail. Lists (tunnel cards, log filter chips) stack with 12px gaps; form fields stack with 12px gaps — tight enough that the Add/Edit Tunnel dialog fits without internal scrolling on the app's default window size. Calm, low-density screens (login, empty states) stay flat — Void background, no ambient glow or gradient (see The Single-Accent Rule) — with generous whitespace and centered content doing the "calm" work instead of decoration. There is no responsive breakpoint system — this is a fixed-chrome desktop app window — but the RDP viewer itself is the one fully dynamic surface, resizing its stream resolution to the available viewport via `ResizeObserver`.

## Elevation & Depth

TunnelGate uses a hybrid model: flat neutral-layer surfaces (Void → Panel → Card → Raised) do most of the depth work through tonal contrast alone, with shadow kept soft and low-opacity rather than heavy. Card-level surfaces carry a gentle resting shadow even at idle — so they read as distinct, liftable objects immediately — and lift a little further on hover. The intent throughout is welcoming depth, not industrial-strength stacking cues.

### Shadow Vocabulary
- **Resting** (`box-shadow: 0 1px 3px rgba(0,0,0,0.18)`): Default state for card-level surfaces (tunnel cards) — soft, always present, establishes stacking order without weight.
- **Interactive Lift** (`box-shadow: 0 4px 16px rgba(0,0,0,0.16)` + `transform: translateY(-1px)`): Hover/focus state for the same cards — a clear but gentle lift, paired with a status-colored border when the card represents an active connection.
- **Modal** (`box-shadow: 0 16px 28px -6px rgba(0,0,0,0.45)`): Dialogs and confirmation overlays sitting above a `rgba(0,0,0,0.55)` backdrop-blurred scrim — present enough to focus attention, not oppressive.
- **Modal Danger Glow** (`box-shadow: 0 16px 28px -6px rgba(0,0,0,0.45), 0 0 20px rgba(239,68,68,0.12)`): Destructive confirmations (e.g. delete tunnel) add a faint red glow on top of the standard modal shadow — the only place shadow carries status color, and still soft rather than alarming.

### Named Rules
**The Soft-Not-Heavy Rule.** Shadows stay low-opacity (≤0.45) and diffuse throughout. If a shadow reads as "industrial" or "aggressive" at any size, it's too strong for this system.

**The Idle-Isn't-Invisible Rule.** Card-level surfaces always carry the Resting shadow, even with nothing happening — shadow is baseline instrumentation for legibility, not purely a hover reward.

## Shapes

Radii are gently rounded rather than sharp or boxy — a deliberate softening from a typical dense admin tool, chosen so the interface reads as approachable on a dark background rather than clinical. Circular geometry (`full`, 9999px) is reserved for identity and state: the connection status dot, the user avatar, and icon-only buttons. Borders are always 1px Hairline; there is no heavier border weight anywhere in the system.

- **xs** (6px): Small tags — local-port badge, inline error/status chips.
- **sm** (8px): Inputs, standard buttons, icon-only buttons (sign-out).
- **md** (12px): Cards, form containers, empty-state CTAs.
- **lg** (16px): Modals, the login card, identity marks (avatar, login glyph).
- **full** (9999px): Circular/pill elements — status dot, filter chips, the "N connected" summary pill (radius ≥ half height). The user avatar is deliberately *not* circular — see Identity footer.

## Components

### Buttons
- **Shape:** `sm` radius (8px) everywhere except the empty-state primary CTA, which uses `md` (12px) to read as more prominent and inviting.
- **Primary:** Solid Signal Blue fill, white text, no border, 600 weight, `10px 18px` padding (compact inline actions like a card's "Connect" may use tighter padding, but never smaller than is comfortable to click).
- **Secondary/Ghost:** Transparent background, 1px Hairline (or the action's own color) border, text in that same color; used for Edit, Cancel, Browse, Sign Out.
- **Danger:** Solid Alert Red fill for confirmed destructive actions ("Delete Tunnel"); danger actions default to the Secondary treatment (red text/border, transparent fill) until confirmed, then commit to solid red only inside the confirmation modal — the extra step is itself a friendly guardrail against accidental data loss.
- **Hover/Focus:** Opacity drops to 0.85 on hover for solid buttons (a touch gentler than a hard 0.8); a 3px `rgba(59,130,246,0.15)` focus ring on inputs and equivalent treatment expected on keyboard-focused buttons.
- **Icon + label:** Tunnel-card action buttons (Connect, Edit, Logs, Delete, Disconnect, View Screen) pair a small 13px stroke icon with the text label — same stroke weight/style as the nav icons — so each action is distinguishable by shape, not color alone. Icons never appear without their label on these buttons; icon-only is reserved for compact chrome (sign-out, modal close).

### Chips
- **Filter Chip** (Logs view): `full` radius pill, 1px Hairline border, transparent by default; active state fills Signal Blue with white text. Used for tunnel filtering, never for arbitrary tagging.
- **Status/Level Badge** (log severity): `xs` radius, small solid-tint fill (e.g. `rgba(239,68,68,0.7)` for ERROR) with white or dark text depending on contrast — one of the few places uppercase tracked type is appropriate, since this panel is explicitly a technical log view.
- **Summary pill** ("N connected"): `full` radius, Connected Green text/dot on a low-opacity green fill (`rgba(34,197,94,0.1)`), only rendered when the count is > 0. Same reserved-color discipline as the status dot — it appears only because something is genuinely connected, never as a static label.

### Cards / Containers
- **Corner Style:** `md` (12px).
- **Background:** Card (#1e2030), border Hairline; border color swaps to the connection's status color while a tunnel is active/connecting/erroring.
- **Shadow Strategy:** Resting → Interactive Lift on hover (see Elevation & Depth).
- **Internal Padding:** 18px, with a 12px gap between header row and action row.

### Inputs / Fields
- **Style:** Panel background, Hairline border, `sm` radius (8px), 400-weight text, `8px 12px` padding — comfortable without being loose, tight enough that a multi-field dialog still fits without scrolling.
- **Focus:** Border shifts to Signal Blue with a `0 0 0 3px rgba(59,130,246,0.15)` glow ring — no layout shift.
- **Error/Disabled:** Errors render as inline Alert Red text below the field, in plain sentence-case language (never a raw error code), plus a `rgba(239,68,68,0.1)` background strip — the field itself stays neutral so the message, not the field, carries the alarm.

### Navigation
- **Style:** Fixed 200px left rail, Panel background, Hairline right border. Items are left-aligned Body text (Secondary Ink default, Primary Ink + 600 weight when active) with a small 16px line icon before the label (monitor for Tunnels, list for Logs, gear for Settings — one consistent stroke weight, matching the icon system used everywhere else), plus a 2px Signal Blue right-edge indicator and Raised background marking the active tab. Icons are a scan aid; they never replace the text label.
- **Identity footer:** A `radius-xs` (8px) square avatar in solid Signal Blue with white initials — same shape language as the local-port badge and other small tags, not a circular "brand mark" — plus name and a green "Signed in" dot, pinned to the bottom of the rail via `margin-top: auto`, separated by a Hairline top border. A sign-out icon button (door/arrow, `radius-xs`) sits at the far end; it turns Alert Red on hover.

### Modals
A single overlay pattern is reused everywhere a task needs the user's full, protected attention: `position: fixed` full-screen scrim (`--overlay-bg`, `backdrop-filter: blur(4px)`), a centered `radius-lg` Card-background dialog with Modal shadow (Modal Danger Glow for destructive ones), and a `fade-in` entrance. Every modal offers at least two ways out — an explicit `×` icon button top-right (`radius-xs`, Muted Ink, transparent) *and* either a Cancel button or backdrop click — plus Esc. Currently used for: the Delete Tunnel confirmation, and the Add/Edit Tunnel dialog (`TunnelModal`) — the latter replaced an earlier inline-expanding form, which user testing found confusing (it wasn't visually clear you'd entered a distinct "editing" mode versus just scrolling the list). Content must fit the dialog without internal scrolling at the app's default window size — pack related short fields onto one row (see Inputs / Fields) rather than growing the dialog taller than the viewport; `max-height` + `overflow-y: auto` stays only as a safety net for unusually small windows, not the expected experience.

### Tooltips
Any field or label whose meaning isn't self-evident (a technical term, a value pulled from another dashboard, a non-obvious default) gets a native `title` tooltip, signaled visually by a `1px dashed` Muted Ink underline under just the label text and a `help` cursor — never the whole row. This is the one hover-affordance in the system and it's reserved for genuinely explanatory copy (e.g. "Cloudflare Tunnel Hostname" explaining where to find it, or "Local RDP Port" explaining the 3389 default) — not restated obvious labels. Used in Settings and the Add/Edit Tunnel form.

### Status Dot (signature component)
A 10px circular dot is the system's most-repeated element: solid Status color, with a `pulse-dot` animation (1.5s ease-in-out, opacity 1→0.3) while connecting/reconnecting, static while connected/error/disconnected. It's the fastest way for a non-technical user to know "is this working?" without reading anything, and appears identically in the tunnel card header and (as a smaller 6px variant) next to "Signed in."

### Empty States (signature moment)
Empty states (e.g. no tunnels configured) are a calm screen, not a dead end — and they teach rather than just prompt: a short heading ("Add your first server"), one plain sentence of context, then a small unordered checklist of what the user needs before they start (hostname, username, password) using a plain `text-muted` bullet dot — deliberately *not* numbered, since these are prerequisites to gather, not sequential steps, and numbering a non-sequence is a banned pattern (see Do's and Don'ts). Closed with a single prominent `md`-radius primary CTA ("Add Your First Tunnel"). No ambient glow or decoration — centered content and generous whitespace do the "calm" work. No error tone, no technical jargon — this is the first thing a brand-new employee sees and it should feel inviting, not like an empty database table.

### RDP Session Overlay (distinct context — not app chrome)
The live RDP session screen (`RdpView`) is deliberately outside the Void/Panel/Card neutral system: its background is pure black (`#000`), because it's a frame around someone else's screen, not a surface in our own UI — any dark-gray-with-warmth would visibly compete with the video. Its floating toolbar and alert banners are a "glass HUD," not cards: translucent white at a small set of opacity steps (`0.1` hairline / `0.12–0.15` fill / `0.2` border / `0.4` emphasis border / `0.6` icon) layered directly over the video, radius-scaled the same as the rest of the system (`xs`/`sm`/`md` per element type), so it still reads as TunnelGate rather than a generic video player. High-stakes banners (password-expired, connection error) use the same Reserved status colors (Amber, Alert Red) at near-opaque tint (`0.95`) so they stay legible over unpredictable video content, paired with solid white/`#222` buttons for maximum contrast — the one place in the system a button pair departs from the Signal Blue default, because it must win against a live video background, not a calm dark surface.

**The Video Wins Rule.** Nothing in the RDP overlay may use the ambient ink/neutral scale (Void/Panel/Card/Raised/Hairline) — it would blend with or fight the video instead of framing it. Stay on the glass-white-on-black language for this one context only.

## Do's and Don'ts

### Do:
- **Do** reserve green/amber/red strictly for connection and severity state (The Reserved Signal Rule).
- **Do** default to plain, sentence-case language; save uppercase tracked labels and monospace for genuinely technical/dense contexts (The Human-First Rule, The Verifiable-Data Rule).
- **Do** give card-level surfaces a soft resting shadow at idle, not just on hover — but keep every shadow low-opacity and diffuse (The Idle-Isn't-Invisible Rule, The Soft-Not-Heavy Rule).
- **Do** keep every surface flat and match the app's own existing language (`TunnelCard`, `Settings`) when designing something new, rather than reaching for generic conventions (The Single-Accent Rule).
- **Do** reuse the established Modal and Tooltip patterns for any new dialog or explanatory hover, rather than inventing a new overlay/hint style.
- **Do** keep radii gently rounded (6–16px) and borders at 1px Hairline; roomy padding over cramped density.
- **Do** keep the RDP session overlay on its own glass-white-on-black language, radius-matched to the rest of the system but never pulled onto the Void/Panel/Card neutral scale (The Video Wins Rule).

### Don't:
- **Don't** add a gradient, a decorative radial glow, or any other atmosphere-for-its-own-sake — if a screen needs to feel "considered," reach for whitespace, plain copy, and the tonal layer system, not a visual effect (The Single-Accent Rule).
- **Don't** introduce a second free-floating brand color — Console Violet stays reserved and unused until a real second accent is needed (The Single-Accent Rule).
- **Don't** number a list of items that aren't a true sequence (see Empty States) — numbering implies an order the reader needs, and a checklist of prerequisites isn't one.
- **Don't** use a unicode glyph (✓, ✎, ★, etc.) as a stand-in icon — draw it as an SVG in the system's stroke style, matching every other icon in the app.
- **Don't** use status colors decoratively (e.g. a green "New" badge unrelated to connection state).
- **Don't** let shadows read as heavy, industrial, or "console-like" — if it looks aggressive at any size, soften it.
- **Don't** default to uppercase tracked labels or monospace for values that aren't genuinely technical or copy-worthy — that's console texture, not this system's voice.
- **Don't** show raw error codes or technical jargon in user-facing copy; translate to a short, plain sentence about what happened and what to do.
