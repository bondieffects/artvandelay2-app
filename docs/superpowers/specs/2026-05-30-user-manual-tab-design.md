# User Manual Tab — Design Spec

**Date:** 2026-05-30  
**Status:** Approved

---

## Overview

Add a **MANUAL** tab to the Art Van Delay 2 web editor. The tab contains an interactive diagram of the physical pedal and scrollable reference sections. It works without a pedal connected and requires no firmware communication.

---

## Layout

Two-part layout within the standard `padding: 20` tab panel:

1. **Pedal diagram** — full-width at top, interactive
2. **Section cards** — scrollable `PhPanel` blocks below, one per topic

---

## Pedal Diagram

### Source

`aesthetic/render.svg` — the official Illustrator render. ViewBox `413.1 × 362.46`.

### Colour treatment

- CSS `filter: invert(1)` on the `<img>` flips black strokes to white on a dark background
- A sibling `<div class="tint">` with `background: #ff1a88; mix-blend-mode: multiply` converts white lines to magenta — matching the phosphor accent colour exactly
- `.st37` (the grey pedal body fill, `#98918f`) is stripped by injecting `.st37{fill:none!important}` into the SVG `<style>` block at build time, leaving lines only

### Build step

`scripts/bake-render-svg.js`:
1. Read `aesthetic/render.svg`
2. Insert `.st37{fill:none!important}` before `</style>`
3. Base64-encode the result
4. Write `src/render-svg-uri.js` exporting `export const RENDER_SVG_URI = "data:image/svg+xml;base64,…"`

`src/render-svg-uri.js` is gitignored. The bake script runs as a `prebuild` npm hook and also on demand via `npm run bake-svg`.

### Interaction overlay

An absolutely-positioned `<svg viewBox="0 0 413.1 362.46">` sits on top of the image. It contains transparent hit areas (circles and rects) at coordinates extracted directly from the render.svg path geometry.

**Element coordinates (viewBox 413.1 × 362.46):**

| Control | cx | cy | hit r |
|---|---|---|---|
| DELAY TIME | 69.0 | 92.5 | 32 |
| DEPTH | 169.71 | 86.07 | 25 |
| EFFECT LEVEL | 257.01 | 86.07 | 25 |
| FEEDBACK | 343.0 | 92.5 | 32 |
| LFO toggle | 148.72 | 124.35 | 11 |
| LFO LED | 187.47 | 124.77 | 11 |
| RATE | 169.71 | 162.87 | 25 |
| TILT | 257.01 | 168.57 | 25 |
| SUB.DIV LEDs (rect) | x0=26.3 | y=144.4 | w=81.5 h=10 |
| SUB.DIV toggle | 66.76 | 173.91 | 10 |
| PRESET LEDs (rect) | x0=309.6 | y=144.4 | w=64.6 h=10 |
| SHIFT toggle | 341.20 | 173.91 | 10 |
| Tempo LED | 66.99 | 226.23 | 10 |
| Bypass LED | 341.43 | 226.23 | 10 |
| TAP | 65.64 | 319.23 | 25 |
| RECALL | 202.86 | 319.23 | 25 |
| BYPASS | 340.08 | 319.23 | 25 |

**Hover state:** magenta stroke ring + `drop-shadow(0 0 6px rgba(255,26,136,0.9))` via CSS on the hit element.

**Click:** opens `PhManualPopover` near the cursor.

---

## Popover (`PhManualPopover`)

- `position: fixed`, dismissed on outside click or Escape
- Phosphor styled: `background: #1c1316`, `border: 1px solid #ff1a88`, box-shadow glow
- Content built with DOM methods (no `innerHTML`) — three text nodes:
  - **Name** — `color: #ff1a88`, monospace, letter-spaced
  - **Description** — plain English, `color: #f5c8d8`
  - **Meta** — range + MIDI CC where applicable, `color: #6a4850`
- Repositioned if it would overflow viewport edges

---

## Sections (below diagram)

Each section is a `PhPanel`. Content is static (no live data).

| # | Title | Key content |
|---|---|---|
| 1 | Quick Start | Connect → set delay → tap tempo → adjust feedback — 3-step flow |
| 2 | Knobs | DELAY TIME, DEPTH, EFFECT LEVEL, FEEDBACK, RATE, TILT — description + range per knob |
| 3 | LFO & Waveforms | 7 waveforms listed with character descriptions; DEPTH/RATE interaction |
| 4 | Subdivision | 7 values (1/1→1/16), musical note symbols, toggle gestures |
| 5 | Bypass Modes | Active / True Bypass / Trails; how to switch (SHIFT R + BYPASS); bypass LED colours (cyan = true, magenta = trails); Trails double-tap fade |
| 6 | Tap Tempo & Feedback Hold | Tap timing rules; 500ms hold trick; 40–400 BPM limits |
| 7 | Preset System | 4 banks × 3 slots; browse mode entry (hold RECALL 2s); slot A/B/C assignment; bank navigation (RECALL+TAP/BYPASS); save (SHIFT L hold) |
| 8 | Expression Pedal | Enable/disable; parameter assignment; curves; calibration; auto-assign mode |
| 9 | MIDI | CC 20–32 overview table; Program Change 0–11; link to MIDI REF tab for full detail |
| 10 | Connections | Side jacks L→R: DC · MIDI OUT/THRU · MIDI IN · EXPR/TAP · OUTPUT · INPUT; notes on DC connector shape |

---

## Files

| File | Action |
|---|---|
| `scripts/bake-render-svg.js` | **Create** — SVG bake script |
| `src/render-svg-uri.js` | **Generated** — gitignored, created by bake script |
| `src/user-manual.jsx` | **Create** — `PhManual`, `PhManualDiagram`, `PhManualPopover`, section components |
| `src/app.jsx` | **Edit** — add `"manual"` to tab list; render `<PhManual />` in tab panel |
| `src/variant-phosphor.jsx` | **Edit** — add `"manual"` → `"MANUAL"` entry in `PhTab` tabs array |
| `package.json` | **Edit** — add `prebuild` hook and `bake-svg` script |
| `.gitignore` | **Edit** — add `src/render-svg-uri.js` |

---

## Out of scope

- No live data from pedal (manual is static)
- No search or anchor navigation within sections
- No tooltip animations beyond hover ring
- The SHIFT R+BYPASS bypass-type toggle shortcut is documented as-is; the user intends to change it in firmware later — the manual will be updated at that point
