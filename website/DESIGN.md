# TunnelGate website — Design System

Reference for how `website/` looks, behaves and ships. Adapted from the BeForth Design System V2.
Source of truth for tokens: `public/styles/global.css`. Page: `src/pages/index.astro`. Shell: `src/layouts/Layout.astro`.

## 1. Brief

Visitors are employees and IT staff. They need one read to learn what TunnelGate is and how to start.
**Plain and legible first.** If a choice is only interesting rather than useful, it does not ship.

First read, before scrolling:
1. **What is it?** One-click RDP through a secure tunnel.
2. **Who is it for?** People whose IT team has set up Zero Trust access.
3. **What next?** One primary button: "Setup guide".

Hero: one headline, one paragraph, one button, one text link, one drawing (the terminal panel). No badges, counters or tickers.

## 2. Colour

Seven tokens, nothing else.

| Token | Hex | Use |
|---|---|---|
| `paper` | `#F2F7F9` | Page canvas |
| `bone` | `#D6E7F1` | Alternate section background |
| `ink` | `#231F20` | Body text, dark panels, borders |
| `ash` | `#5F6571` | Secondary text only (AA on paper and bone) |
| `signal` | `#1C75BC` | The single accent: primary action, key words, step numbers |
| `wave` | `#75BAE6` | Accent on dark surfaces only |
| `signal-deep` | `#165B93` | Hover for `signal` |

Rules: one accent; `ash` for secondary text only; `wave` (not `signal`) on `ink`; faded text on dark stays at 65% opacity or higher; separate with `bone` and a 1px rule, never a shadow, gradient or glow; no decorative colour.

## 3. Type

**Plus Jakarta Sans** everywhere, loaded from a non-blocking `<link>` with `preconnect`. **JetBrains Mono** only in the terminal mock-up. `Plus Jakarta Fallback` (Arial, scaled 104.3%) prevents layout shift. Classes: `.display-xl` (hero), `.display-lg` (section), `.display-md` (card), `.lead`, `.body`, `.body-tight`, `.label` (uppercase section name only), `.accent`.

Headings are left aligned. Measure stays under 80 characters.

## 4. Layout

`.wrap` max 1280px (24px gutter, 40px from 900px up). `.section` is 80px/112px vertical padding. Alternate `paper` and `.bone` down the page. Cards and grids use 1px rules and square corners; only pills and the numbered circles are round.

Page order: Hero → How it works → Setup → Under the hood → Features → FAQ → Call to action → Footer.

Every page: a "Skip to content" link first, exactly one `<main id="main-content">` (in the layout), one `<h1>`, no skipped heading levels, real `<ul>`/`<ol>` with `<li>` as direct children.

## 5. Motion

Motion answers an action or it does not ship. Hover colour changes, native anchor scrolling, and the FAQ `<details>` toggle. No scroll reveals, parallax, marquees or entrance animations. `prefers-reduced-motion` turns off transitions and smooth scroll.

## 6. Illustration (doodles)

Hand-drawn-style line drawings, the one deliberate exception to "no decoration". Source: `src/components/Doodles.astro` (`<Doodle name="..." />`). The wobble filter `#sketch` is defined once in `Layout.astro`.

Look: `ink` line work, 2.4px, round caps; `signal` only for the working or connected part; `bone` for flat fills (`paper` on bone sections); on dark panels lines are `paper` and the accent is `wave`. No gradients or shadows.

Rules:
1. Each drawing is drawn from the text of its own section. If another section could swap in the same drawing, it is the wrong drawing.
2. Every drawing is unique. Do not reuse a subject or add a repeating motif.
3. Facts only: nothing the page does not already say (no invented hosts, numbers or logos).
4. Decorative: `aria-hidden="true"`, `focusable="false"`, no text inside the SVG.
5. Wide drawings hide on small screens (`road` below 700px, `side` drawings below 1000px). Place them beside or below copy, never over it.

| Section | Name | Subject |
|---|---|---|
| How it works | `road` | A road with four stops (server, click, desktop, back) and a flag |
| Setup, what you need | `checklist` | A clipboard with three ticks, one per prerequisite |
| Under the hood | `tunnel` | A laptop joined to a locked server by a tunnel that passes under a barrier |
| FAQ | `faq` | A question bubble and an answer bubble with a tick |
| Call to action | `click` | A monitor with a button and a cursor about to press it |

To add one: write down what the section says, draw that, check this table for duplicates, add it to `Doodles.astro`, check desktop and phone widths, run the build, add a row above.

## 7. Components

| Class | Use |
|---|---|
| `.btn .btn-signal` | Primary action |
| `.btn .btn-invert` | Primary action on dark surfaces |
| `.ulink` | Text link |
| `.surface` / `.surface-ink` | Card / dark panel |
| `.steps`, `.features` | 1px-ruled grids |
| `.stack` | Flat architecture diagram |
| `.faq` | `<details>` list |

Buttons and links are sentence case, 15px, semibold.

## 8. Honesty

- Never invent facts: no user counts, version claims, benchmarks or customer names.
- No "Cloudflare" branding in copy; say "secure tunnel" or "tunnel".
- **No download buttons or installer links.** The installer comes from the user's IT team. Do not re-add release links to the nav, hero, setup steps or footer.
- No placeholder content (empty screenshot boxes) reaches a visitor; add a screenshot section only with a real one.
- Features listed must exist in the app (see `docs/TUNNELGATE_COMPLETE.md`).

## 9. Build

```sh
cd website && npm run build   # astro build → dist/
```

After deploying, check the live site: status code and that `/styles/global.css` loads.

## 10. Do / don't

| Do | Don't |
|---|---|
| One accent colour | Multiple accents, tinted panels |
| Flat surfaces, 1px rules | Shadows, glows, glass, gradients |
| Left-aligned headings | Centred hero text |
| A drawing that shows what its section says | A stock drawing reused elsewhere |
| One `<main>` and one `<h1>` | Nested `<main>`, skipped levels |
| `ash` for secondary text at AA contrast | Fading text below AA on dark |
| Hover colour changes | Scroll-triggered reveals |
