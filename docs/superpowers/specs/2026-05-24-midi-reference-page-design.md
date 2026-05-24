# MIDI Reference Page — Design Spec
**Date:** 2026-05-24

## Goal

Add a MIDI REF tab to the Art Van Delay 2 web editor so the user can quickly look up what CC and PC messages the pedal responds to, what values are expected, and how 14-bit high-resolution pairs work — without leaving the app.

## Data Source

All CC/PC data is sourced from the authoritative firmware files:
- `C:\Users\jon\zephyrproject\artvandelay2\src\midi\midi_control.h` — CC number defines and LSB offsets
- `C:\Users\jon\zephyrproject\artvandelay2\src\midi\midi_control.c` — scaling logic and dispatch

**Known inaccuracies in `docs/midi-testing-mc6.md` that the reference page will correct:**
- Preset count is **12** (PC 0–11), not 8
- Tap tempo triggers only on value **≥ 64**, not any value

## Architecture

### New file: `src/midi-reference.jsx`

Follows the pattern of `src/firmware-updater.jsx` — self-contained component, no props, registered as a tab in `app.jsx`.

### Data: `src/shared.jsx`

Add `MIDI_CC_MAP` array (exported via `window`). One entry per logical message:

```js
{
  cc: 20,                      // number, or "PC"
  lsbCc: 52,                   // only for hires-capable CCs; omit otherwise
  hires: true,                 // true = supports 14-bit MSB+LSB pairing
  shortLabel: "delay",         // shown in index column
  label: "delay_time_ms",      // full name shown in detail header
  channel: 1,
  kind: "continuous",          // "continuous" | "enum" | "threshold" | "trigger" | "pc"
  midiRange: "0–127",          // 7-bit (standalone)
  hiresRange: "0–16383",       // only when hires: true
  mapsTo: "20–1000 ms",        // human-readable output range
  options: [                   // only for kind: "enum"
    { midi: "0–18", index: 0, name: "1/1" }, ...
  ],
  notes: "...",                // optional plain-text footnote
}
```

**Full CC map (channel 1, configurable in firmware):**

| CC  | LSB CC | Kind        | Label            | Maps To              | Notes                          |
|-----|--------|-------------|------------------|----------------------|--------------------------------|
| 20  | 52     | continuous  | delay_time_ms    | 20–1000 ms           |                                |
| 21  | 53     | continuous  | lfo_depth        | 0–255                |                                |
| 22  | 54     | continuous  | lfo_rate         | 0–255                |                                |
| 23  | 55     | continuous  | effect_level     | 0–255                |                                |
| 24  | 56     | continuous  | feedback         | 0–255                |                                |
| 25  | 57     | continuous  | tilt             | 0–255                |                                |
| 26  | —      | enum        | subdivision      | index 0–6            | 1/1, 1/2, 1/3, 1/4, 1/6, 1/8, 1/16 |
| 27  | —      | enum        | lfo_waveform     | index 0–6            | Sine, Triangle, S-Shaped, Exponential, Smooth Rand, Skewed Tri, Trapezoid |
| 28  | —      | threshold   | bypass           | <64=active ≥64=bypass | Drives relay + LED            |
| 29  | 61     | continuous  | expression       | 0–255                |                                |
| 30  | —      | trigger     | tap_tempo        | each ≥64 = tap       | 2 s timeout; 40–400 BPM; weighted avg of last 4 taps |
| 31  | —      | threshold   | bypass_type      | <64=true ≥64=trails  | Drives relay + LED colour      |
| 32  | —      | threshold   | knob_mode        | <64=effect_level ≥64=mix | Not reflected in web param get |
| PC  | —      | pc          | preset load      | slot 0–11            |                                |

**14-bit protocol:** Send MSB CC alone for 7-bit (backward-compatible) operation. For higher resolution, send MSB first then LSB (= MSB CC + 32). The device combines them `val14 = (msb << 7) | lsb` before scaling. LSBs for CC 26–28 (subdivision, waveform, bypass) are received but explicitly discarded — do not send them.

### Component: `PhMidiRef` in `src/midi-reference.jsx`

```
┌──────────────┬─────────────────────────────────────────┐
│ CC / PC      │ CC 20 · delay_time_ms          [CONTINUOUS] │
│ ──────────── │ ─────────────────────────────────────── │
│ 20  delay  ◉ │ CC Number (MSB)   20                    │
│ 21  depth    │ LSB CC            52                    │
│ 22  rate     │ Channel           1                     │
│ 23  level    │ 7-bit Range       0–127 → 20–1000 ms   │
│ 24  fdbk     │ 14-bit Range      0–16383 → 20–1000 ms │
│ 25  tilt     │                                         │
│ 26  subdiv   │ 14-bit send order:                      │
│ 27  waveform │   1. CC 20 (MSB) then CC 52 (LSB)      │
│ 28  bypass   │                                         │
│ 29  expr     │                                         │
│ 30  tap      │                                         │
│ 31  bp type  │                                         │
│ 32  knob     │                                         │
│ ──────────── │                                         │
│ PC  preset   │                                         │
└──────────────┴─────────────────────────────────────────┘
```

**State:** `selected` (string key, defaults to `"20"`). Clicking an index row sets `selected`.

**Detail panel rendering by `kind`:**

- `continuous`: header rows (CC, LSB CC if present, channel, 7-bit range, 14-bit range if hires). If hires, a send-order note: "Send CC {msb} (MSB) then CC {lsb} (LSB)".
- `enum`: header rows (CC, channel, MIDI range) + Values sub-table with columns: MIDI Range | Index | Name.
- `threshold`: header rows + two-segment bar split at 64: left segment labelled with the <64 meaning, right with the ≥64 meaning.
- `trigger`: header rows + plain note (e.g. "Each message with value ≥ 64 triggers a tap").
- `pc`: channel row + slots table (PC number → "Load slot N").

**No props required.** `MIDI_CC_MAP` is read from `window` (set in `shared.jsx`). No connection state needed — this is static reference data.

### Wiring

**`src/variant-phosphor.jsx` — `PhTab`:**  
Add `["midi-ref", "MIDI REF"]` to the `tabs` array.

**`src/app.jsx` — `PhosphorWired`:**  
Add a tab panel case for `"midi-ref"` rendering `<PhMidiRef />`. No state or callbacks needed.

## Out of Scope

- No search/filter (13 entries is scannable without it)
- No copy-to-clipboard
- No SysEx protocol details
- No live "send this CC" interactive controls
