# MIDI Reference Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a MIDI REF tab to the Art Van Delay 2 web editor showing a clickable index of all CC/PC messages with a full detail panel per entry including 14-bit high-resolution info and enum value tables.

**Architecture:** New `src/midi-cc-map.js` holds the pure CC/PC data (plain JS, Node-testable). New `src/midi-reference.jsx` holds the `PhMidiRef` React component. Three existing files get minimal changes: `variant-phosphor.jsx` (add tab), `app.jsx` (add panel), `index.html` + `scripts/build.js` (register new files).

**Tech Stack:** React 18 (UMD globals — no imports), esbuild JSX transform, Node built-in test runner (`node:test`).

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/midi-cc-map.js` | **Create** | Pure data: `MIDI_CC_MAP` array; Node-compatible export for tests |
| `src/midi-reference.jsx` | **Create** | `PhMidiRef` + `MidiDetail` components |
| `src/variant-phosphor.jsx` | **Modify** | Add `["midi-ref", "MIDI REF"]` to `PhTab` tabs array |
| `src/app.jsx` | **Modify** | Add `tab === "midi-ref"` panel case |
| `index.html` | **Modify** | Add `<script src="src/midi-cc-map.js">` and `<script src="src/midi-reference.js">` |
| `scripts/build.js` | **Modify** | Copy `midi-cc-map.js` as-is; add `"midi-reference"` to JSX srcFiles |
| `tests/midi-cc-map.test.js` | **Create** | Data integrity tests |

---

## Task 1: MIDI CC Map Data File

**Files:**
- Create: `src/midi-cc-map.js`
- Create: `tests/midi-cc-map.test.js`

### Background

`src/midi-cc-map.js` follows the same pattern as `src/pure.js`: plain JS (no JSX), global declaration for browser, `module.exports` guard for Node tests. The build script copies it as-is (no esbuild transform needed), and `index.html` loads it via `<script>` before `shared.js`.

Enum value MIDI ranges are derived from the firmware's `scale_7_to_index(value, 7)` formula:
`index = floor((value * 6 + 63) / 127)`. For 7 options this produces breakpoints at 0, 11, 32, 53, 75, 96, 117.

- [ ] **Step 1: Write failing tests**

Create `tests/midi-cc-map.test.js`:

```js
// Tests for MIDI_CC_MAP data integrity.
// Run with: node tests/midi-cc-map.test.js

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { MIDI_CC_MAP } = require("../src/midi-cc-map.js");

test("MIDI_CC_MAP is a non-empty array", () => {
  assert.ok(Array.isArray(MIDI_CC_MAP));
  assert.ok(MIDI_CC_MAP.length > 0);
});

test("all entries have required fields", () => {
  for (const e of MIDI_CC_MAP) {
    assert.ok(e.cc !== undefined, `missing cc on ${JSON.stringify(e)}`);
    assert.ok(e.shortLabel, `missing shortLabel on CC ${e.cc}`);
    assert.ok(e.label, `missing label on CC ${e.cc}`);
    assert.strictEqual(typeof e.channel, "number", `channel not a number on CC ${e.cc}`);
    assert.ok(["continuous","enum","threshold","trigger","pc"].includes(e.kind),
      `unknown kind "${e.kind}" on CC ${e.cc}`);
    assert.ok(e.midiRange, `missing midiRange on CC ${e.cc}`);
    assert.ok(e.mapsTo, `missing mapsTo on CC ${e.cc}`);
  }
});

test("CC numbers are unique", () => {
  const seen = new Set();
  for (const e of MIDI_CC_MAP) {
    assert.ok(!seen.has(e.cc), `duplicate CC ${e.cc}`);
    seen.add(e.cc);
  }
});

test("all hires entries have lsbCc = cc + 32", () => {
  for (const e of MIDI_CC_MAP) {
    if (e.hires) {
      assert.ok(typeof e.lsbCc === "number", `hires CC ${e.cc} missing lsbCc`);
      assert.strictEqual(e.lsbCc, e.cc + 32, `CC ${e.cc} lsbCc should be ${e.cc + 32}`);
      assert.ok(e.hiresRange, `hires CC ${e.cc} missing hiresRange`);
    }
  }
});

test("non-hires entries do not have lsbCc", () => {
  for (const e of MIDI_CC_MAP) {
    if (!e.hires) {
      assert.strictEqual(e.lsbCc, undefined, `non-hires CC ${e.cc} should not have lsbCc`);
    }
  }
});

test("enum entries have options array with index/midi/name", () => {
  for (const e of MIDI_CC_MAP.filter(e => e.kind === "enum")) {
    assert.ok(Array.isArray(e.options) && e.options.length > 0,
      `CC ${e.cc} enum missing options`);
    for (const opt of e.options) {
      assert.ok(typeof opt.index === "number", `CC ${e.cc} option missing index`);
      assert.ok(opt.midi, `CC ${e.cc} option missing midi`);
      assert.ok(opt.name, `CC ${e.cc} option missing name`);
    }
  }
});

test("threshold entries have low and high labels", () => {
  for (const e of MIDI_CC_MAP.filter(e => e.kind === "threshold")) {
    assert.ok(e.low, `threshold CC ${e.cc} missing low`);
    assert.ok(e.high, `threshold CC ${e.cc} missing high`);
  }
});

test("known CC numbers match firmware defines", () => {
  const byCC = Object.fromEntries(MIDI_CC_MAP.filter(e => e.cc !== "PC").map(e => [e.cc, e]));
  assert.ok(byCC[20].label === "delay_time_ms");
  assert.ok(byCC[21].label === "lfo_depth");
  assert.ok(byCC[22].label === "lfo_rate");
  assert.ok(byCC[23].label === "effect_level");
  assert.ok(byCC[24].label === "feedback");
  assert.ok(byCC[25].label === "tilt");
  assert.ok(byCC[26].label === "subdivision");
  assert.ok(byCC[27].label === "lfo_waveform");
  assert.ok(byCC[28].label === "bypass");
  assert.ok(byCC[29].label === "expression");
  assert.ok(byCC[30].label === "tap_tempo");
  assert.ok(byCC[31].label === "bypass_type");
  assert.ok(byCC[32].label === "knob_mode");
});

test("hires CCs are exactly 20-25 and 29", () => {
  const hiresCCs = MIDI_CC_MAP.filter(e => e.hires).map(e => e.cc).sort((a,b) => a-b);
  assert.deepStrictEqual(hiresCCs, [20, 21, 22, 23, 24, 25, 29]);
});

test("PC entry exists with kind pc and 12 slots midiRange", () => {
  const pc = MIDI_CC_MAP.find(e => e.cc === "PC");
  assert.ok(pc, "PC entry missing");
  assert.strictEqual(pc.kind, "pc");
  assert.ok(pc.midiRange.includes("11"), "PC midiRange should cover slot 11");
});

test("tap tempo notes mention value >= 64 threshold", () => {
  const tap = MIDI_CC_MAP.find(e => e.cc === 30);
  assert.ok(tap.notes && tap.notes.includes("64"),
    "tap tempo notes must document the ≥64 threshold");
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
node tests/midi-cc-map.test.js
```

Expected: all tests fail with `Cannot find module '../src/midi-cc-map.js'`

- [ ] **Step 3: Create `src/midi-cc-map.js`**

```js
// MIDI CC and PC map for Art Van Delay 2.
// Sourced from: src/midi/midi_control.h and midi_control.c in the firmware.
//
// Enum ranges use scale_7_to_index(value, 7): index = floor((value * 6 + 63) / 127)
// Breakpoints: 0, 11, 32, 53, 75, 96, 117
//
// Browser: loaded as <script> before shared.js; MIDI_CC_MAP becomes a global.
// Node: const { MIDI_CC_MAP } = require('./midi-cc-map.js');

const MIDI_CC_MAP = [
  {
    cc: 20, lsbCc: 52, hires: true,
    shortLabel: "delay", label: "delay_time_ms", channel: 1,
    kind: "continuous", midiRange: "0–127", hiresRange: "0–16383", mapsTo: "20–1000 ms",
  },
  {
    cc: 21, lsbCc: 53, hires: true,
    shortLabel: "depth", label: "lfo_depth", channel: 1,
    kind: "continuous", midiRange: "0–127", hiresRange: "0–16383", mapsTo: "0–255",
  },
  {
    cc: 22, lsbCc: 54, hires: true,
    shortLabel: "rate", label: "lfo_rate", channel: 1,
    kind: "continuous", midiRange: "0–127", hiresRange: "0–16383", mapsTo: "0–255",
  },
  {
    cc: 23, lsbCc: 55, hires: true,
    shortLabel: "level", label: "effect_level", channel: 1,
    kind: "continuous", midiRange: "0–127", hiresRange: "0–16383", mapsTo: "0–255",
  },
  {
    cc: 24, lsbCc: 56, hires: true,
    shortLabel: "fdbk", label: "feedback", channel: 1,
    kind: "continuous", midiRange: "0–127", hiresRange: "0–16383", mapsTo: "0–255",
  },
  {
    cc: 25, lsbCc: 57, hires: true,
    shortLabel: "tilt", label: "tilt", channel: 1,
    kind: "continuous", midiRange: "0–127", hiresRange: "0–16383", mapsTo: "0–255",
  },
  {
    cc: 26, hires: false,
    shortLabel: "subdiv", label: "subdivision", channel: 1,
    kind: "enum", midiRange: "0–127", mapsTo: "index 0–6",
    options: [
      { midi: "0–10",   index: 0, name: "1/1" },
      { midi: "11–31",  index: 1, name: "1/2" },
      { midi: "32–52",  index: 2, name: "1/3" },
      { midi: "53–74",  index: 3, name: "1/4" },
      { midi: "75–95",  index: 4, name: "1/6" },
      { midi: "96–116", index: 5, name: "1/8" },
      { midi: "117–127",index: 6, name: "1/16" },
    ],
  },
  {
    cc: 27, hires: false,
    shortLabel: "waveform", label: "lfo_waveform", channel: 1,
    kind: "enum", midiRange: "0–127", mapsTo: "index 0–6",
    options: [
      { midi: "0–10",   index: 0, name: "Sine" },
      { midi: "11–31",  index: 1, name: "Triangle" },
      { midi: "32–52",  index: 2, name: "S-Shaped" },
      { midi: "53–74",  index: 3, name: "Exponential" },
      { midi: "75–95",  index: 4, name: "Smooth Rand" },
      { midi: "96–116", index: 5, name: "Skewed Tri" },
      { midi: "117–127",index: 6, name: "Trapezoid" },
    ],
  },
  {
    cc: 28, hires: false,
    shortLabel: "bypass", label: "bypass", channel: 1,
    kind: "threshold", midiRange: "0–127", mapsTo: "<64 = active  ≥64 = bypass",
    low: "active (effect on)", high: "bypass (effect off)",
  },
  {
    cc: 29, lsbCc: 61, hires: true,
    shortLabel: "expr", label: "expression", channel: 1,
    kind: "continuous", midiRange: "0–127", hiresRange: "0–16383", mapsTo: "0–255",
  },
  {
    cc: 30, hires: false,
    shortLabel: "tap", label: "tap_tempo", channel: 1,
    kind: "trigger", midiRange: "≥64", mapsTo: "registers a tap",
    notes: "Values < 64 are ignored. Timeout 2 s; range 40–400 BPM; weighted average of last 4 tap intervals.",
  },
  {
    cc: 31, hires: false,
    shortLabel: "bp type", label: "bypass_type", channel: 1,
    kind: "threshold", midiRange: "0–127", mapsTo: "<64 = true bypass  ≥64 = trails",
    low: "true bypass", high: "trails",
  },
  {
    cc: 32, hires: false,
    shortLabel: "knob", label: "knob_mode", channel: 1,
    kind: "threshold", midiRange: "0–127", mapsTo: "<64 = effect level  ≥64 = mix",
    low: "effect level", high: "mix",
    notes: "Not reflected in web param get.",
  },
  {
    cc: "PC", hires: false,
    shortLabel: "preset", label: "preset load", channel: 1,
    kind: "pc", midiRange: "0–11", mapsTo: "load slot 0–11",
  },
];

if (typeof module !== "undefined" && module.exports) {
  module.exports = { MIDI_CC_MAP };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
node tests/midi-cc-map.test.js
```

Expected: all tests pass (`ok` for each).

- [ ] **Step 5: Commit**

```
git add src/midi-cc-map.js tests/midi-cc-map.test.js
git commit -m "feat: add MIDI_CC_MAP data file with integrity tests"
```

---

## Task 2: PhMidiRef Component

**Files:**
- Create: `src/midi-reference.jsx`

### Background

`PhMidiRef` reads `window.MIDI_CC_MAP` (set by the `<script>` for `midi-cc-map.js`). It uses `PH`, `PhPanel`, and `React` as globals — all loaded before this file in the HTML. The component never needs connection state; it's pure reference data.

`MidiDetail` renders differently per `entry.kind`:
- `continuous` — header rows; if `hires`, adds a 14-bit send-order note
- `enum` — header rows + options table
- `threshold` — header rows + a two-segment bar split at value 64
- `trigger` — header rows + notes box
- `pc` — simplified header + 12-slot table (slots 0–11)

- [ ] **Step 1: Create `src/midi-reference.jsx`**

```jsx
function PhMidiRef() {
  const entries = window.MIDI_CC_MAP;
  const [selected, setSelected] = React.useState(entries[0].cc);
  const entry = entries.find((e) => e.cc === selected) || entries[0];

  const indexLabel = (e) => e.cc === "PC" ? "PC" : `CC ${e.cc}`;
  const detailTitle = (e) => e.cc === "PC" ? `PC · ${e.label}` : `CC ${e.cc} · ${e.label}`;
  const kindBadge = (e) => e.kind.toUpperCase().replace("_", " ");

  return (
    <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 18, alignItems: "start" }}>
      <PhPanel title="CC / PC">
        <div style={{ margin: "-16px" }}>
          {entries.map((e) => {
            const active = e.cc === selected;
            return (
              <button key={e.cc} onClick={() => setSelected(e.cc)}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "baseline",
                  width: "100%", padding: "7px 14px", cursor: "pointer",
                  background: active ? PH.accentMute : "transparent",
                  border: "none", borderBottom: `1px dotted ${PH.rule}`,
                  fontFamily: PH.mono, fontSize: 11,
                }}>
                <span style={{ color: e.cc === "PC" ? PH.warn : PH.accent, minWidth: 40 }}>
                  {indexLabel(e)}
                </span>
                <span style={{ color: active ? PH.ink : PH.inkMute, fontSize: 10 }}>
                  {e.shortLabel}
                </span>
              </button>
            );
          })}
        </div>
      </PhPanel>

      <PhPanel title={detailTitle(entry)} rightMeta={kindBadge(entry)}>
        <MidiDetail entry={entry} />
      </PhPanel>
    </div>
  );
}
PhMidiRef = React.memo(PhMidiRef);

function MidiDetail({ entry }) {
  const row = (label, value, key) => (
    <div key={key || label} style={{
      display: "grid", gridTemplateColumns: "140px 1fr", gap: 12,
      padding: "6px 0", borderBottom: `1px dotted ${PH.rule}`,
      fontFamily: PH.mono, fontSize: 12,
    }}>
      <span style={{ color: PH.inkMute }}>{label}</span>
      <span style={{ color: PH.accent }}>{value}</span>
    </div>
  );

  const sectionLabel = (text) => (
    <div style={{ fontFamily: PH.mono, fontSize: 9, letterSpacing: "0.24em",
      textTransform: "uppercase", color: PH.inkMute, marginTop: 16, marginBottom: 8 }}>
      {text}
    </div>
  );

  const noteBox = (text) => (
    <div style={{ marginTop: 14, padding: "8px 12px", border: `1px dashed ${PH.rule}`,
      fontFamily: PH.mono, fontSize: 11, color: PH.inkDim, lineHeight: 1.7 }}>
      <span style={{ color: PH.accent }}>▸</span> {text}
    </div>
  );

  const tableHead = (cols) => (
    <thead>
      <tr>
        {cols.map((h) => (
          <th key={h} style={{ textAlign: "left", color: PH.inkMute, fontSize: 9,
            letterSpacing: "0.18em", textTransform: "uppercase",
            padding: "4px 8px", borderBottom: `1px solid ${PH.ruleStrong}` }}>{h}</th>
        ))}
      </tr>
    </thead>
  );

  const tdStyle = { padding: "5px 8px", borderBottom: `1px dotted ${PH.rule}` };

  if (entry.kind === "continuous") {
    return (
      <div>
        {row("CC Number", entry.cc)}
        {entry.hires && row("LSB CC", entry.lsbCc)}
        {row("Channel", entry.channel)}
        {row("7-bit Range", entry.midiRange + " → " + entry.mapsTo)}
        {entry.hires && row("14-bit Range", entry.hiresRange + " → " + entry.mapsTo)}
        {entry.hires && noteBox(
          `For 14-bit: send CC ${entry.cc} (MSB) then CC ${entry.lsbCc} (LSB). ` +
          `Sending CC ${entry.cc} alone is valid 7-bit (backward-compatible).`
        )}
      </div>
    );
  }

  if (entry.kind === "enum") {
    return (
      <div>
        {row("CC Number", entry.cc)}
        {row("Channel", entry.channel)}
        {row("MIDI Range", entry.midiRange + " → " + entry.mapsTo)}
        {sectionLabel("Values")}
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: PH.mono, fontSize: 11 }}>
          {tableHead(["MIDI Range", "Index", "Name"])}
          <tbody>
            {entry.options.map((opt) => (
              <tr key={opt.index}>
                <td style={{ ...tdStyle, color: PH.accent }}>{opt.midi}</td>
                <td style={{ ...tdStyle, color: PH.inkDim }}>{opt.index}</td>
                <td style={{ ...tdStyle, color: PH.ink }}>{opt.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (entry.kind === "threshold") {
    return (
      <div>
        {row("CC Number", entry.cc)}
        {row("Channel", entry.channel)}
        {row("MIDI Range", entry.midiRange)}
        {sectionLabel("Threshold (split at 64)")}
        <div style={{ display: "flex", height: 32, borderRadius: 2, overflow: "hidden",
          border: `1px solid ${PH.ruleStrong}` }}>
          <div style={{ flex: 64, background: PH.accentMute, display: "flex",
            alignItems: "center", justifyContent: "center",
            fontFamily: PH.mono, fontSize: 10, color: PH.accent }}>
            0–63 · {entry.low}
          </div>
          <div style={{ flex: 63, background: "transparent", display: "flex",
            alignItems: "center", justifyContent: "center",
            fontFamily: PH.mono, fontSize: 10, color: PH.inkDim,
            borderLeft: `1px solid ${PH.ruleStrong}` }}>
            64–127 · {entry.high}
          </div>
        </div>
        {entry.notes && noteBox(entry.notes)}
      </div>
    );
  }

  if (entry.kind === "trigger") {
    return (
      <div>
        {row("CC Number", entry.cc)}
        {row("Channel", entry.channel)}
        {row("Trigger On", entry.midiRange)}
        {entry.notes && noteBox(entry.notes)}
      </div>
    );
  }

  if (entry.kind === "pc") {
    return (
      <div>
        {row("Message Type", "Program Change")}
        {row("Channel", entry.channel)}
        {row("Range", entry.midiRange)}
        {sectionLabel("Slots")}
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: PH.mono, fontSize: 11 }}>
          {tableHead(["PC Number", "Action"])}
          <tbody>
            {Array.from({ length: 12 }, (_, i) => (
              <tr key={i}>
                <td style={{ ...tdStyle, color: PH.warn }}>{i}</td>
                <td style={{ ...tdStyle, color: PH.ink }}>Load slot {i}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return null;
}

Object.assign(window, { PhMidiRef });
```

- [ ] **Step 2: Commit**

```
git add src/midi-reference.jsx
git commit -m "feat: add PhMidiRef component"
```

---

## Task 3: Wire Tab Into App + Build

**Files:**
- Modify: `src/variant-phosphor.jsx` (line 46 — tabs array in PhTab)
- Modify: `src/app.jsx` (lines 202–232 — tab panel block)
- Modify: `index.html` (lines 79–85 — script tags)
- Modify: `scripts/build.js` (lines 28–38 — srcFiles array + plain-JS copy)

- [ ] **Step 1: Add MIDI REF tab to `PhTab` in `src/variant-phosphor.jsx`**

Find this line (currently line 46):
```js
  const tabs = [["live","LIVE"],["presets","PRESETS"],["config","CONFIG"],["firmware","FIRMWARE"],["console","CONSOLE"]];
```

Replace with:
```js
  const tabs = [["live","LIVE"],["presets","PRESETS"],["config","CONFIG"],["firmware","FIRMWARE"],["console","CONSOLE"],["midi-ref","MIDI REF"]];
```

- [ ] **Step 2: Add midi-ref panel in `src/app.jsx`**

Find the closing `{tab === "console" && ...}` block (ends around line 232). Add after it, before the closing `</div>` of the tab content div:

```jsx
          {tab === "midi-ref" && (
            <div role="tabpanel" id={PH_PANEL_ID("midi-ref")} aria-labelledby={PH_TAB_ID("midi-ref")}>
              <PhMidiRef />
            </div>
          )}
```

- [ ] **Step 3: Register script tags in `index.html`**

Find the existing script block (lines 79–85):
```html
  <script src="src/pure.js"></script>
  <script src="src/shared.js"></script>
  <script src="src/transport.js"></script>
  <script src="src/variant-phosphor.js"></script>
  <script src="src/firmware-updater.js"></script>
  <script src="src/app.js"></script>
```

Replace with:
```html
  <script src="src/pure.js"></script>
  <script src="src/midi-cc-map.js"></script>
  <script src="src/shared.js"></script>
  <script src="src/transport.js"></script>
  <script src="src/variant-phosphor.js"></script>
  <script src="src/firmware-updater.js"></script>
  <script src="src/midi-reference.js"></script>
  <script src="src/app.js"></script>
```

`midi-cc-map.js` must come before `shared.js` (so the global is set before shared uses any of its values). `midi-reference.js` must come before `app.js` (so `PhMidiRef` is defined when `app.js` renders it).

- [ ] **Step 4: Update `scripts/build.js`**

Find the plain-JS copy (currently line 25):
```js
  // Copy pure.js as-is (plain JS, no JSX transform needed)
  copyFile(path.join(root, "src", "pure.js"), path.join(srcDist, "pure.js"));
```

Replace with:
```js
  // Copy plain JS files as-is (no JSX transform needed)
  copyFile(path.join(root, "src", "pure.js"), path.join(srcDist, "pure.js"));
  copyFile(path.join(root, "src", "midi-cc-map.js"), path.join(srcDist, "midi-cc-map.js"));
```

Find the JSX srcFiles array (currently line 28):
```js
  const srcFiles = ["shared", "transport", "variant-phosphor", "firmware-updater", "app"];
```

Replace with:
```js
  const srcFiles = ["shared", "transport", "variant-phosphor", "firmware-updater", "midi-reference", "app"];
```

- [ ] **Step 5: Build**

```
npm run build
```

Expected output: `Built <path>/dist`  
No errors. If esbuild errors on JSX in `midi-reference.jsx`, it means a syntax mistake — fix and re-run.

- [ ] **Step 6: Run all tests**

```
node tests/pure-functions.test.js && node tests/midi-cc-map.test.js
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```
git add src/variant-phosphor.jsx src/app.jsx index.html scripts/build.js
git commit -m "feat: wire MIDI REF tab into app and build"
```

---

## Task 4: Verify in Browser

- [ ] **Step 1: Serve the built app**

```
npm run serve
```

Open `http://localhost:4173` in Chrome or Edge (required for Web MIDI SysEx).

- [ ] **Step 2: Verify the MIDI REF tab appears**

Click the **MIDI REF** tab in the tab bar. The index column should show 14 entries (CC 20–32 + PC).

- [ ] **Step 3: Verify continuous parameter detail (CC 20)**

Click CC 20 in the index. Confirm:
- Detail header: `CC 20 · delay_time_ms`
- Badge: `CONTINUOUS`
- Rows show CC Number (20), LSB CC (52), Channel (1), 7-bit Range, 14-bit Range
- Note box explains MSB+LSB send order

- [ ] **Step 4: Verify enum detail (CC 26)**

Click CC 26. Confirm:
- Badge: `ENUM`
- Values table shows 7 rows with MIDI ranges 0–10 through 117–127 and names 1/1 through 1/16

- [ ] **Step 5: Verify threshold detail (CC 28)**

Click CC 28. Confirm:
- Badge: `THRESHOLD`
- Two-segment bar: left segment "0–63 · active (effect on)", right "64–127 · bypass (effect off)"

- [ ] **Step 6: Verify trigger detail (CC 30)**

Click CC 30. Confirm:
- Badge: `TRIGGER`
- Trigger On: `≥64`
- Notes mention values < 64 are ignored, 2 s timeout, 40–400 BPM

- [ ] **Step 7: Verify PC detail**

Click PC in the index. Confirm:
- 12-row table showing PC 0–11 → "Load slot 0" through "Load slot 11"

- [ ] **Step 8: Verify tab keyboard navigation still works**

Tab through the tab bar with arrow keys. MIDI REF should be reachable and navigable.

- [ ] **Step 9: Final commit**

```
git add -A
git commit -m "feat: MIDI Reference page complete"
```

---

## Self-Review

**Spec coverage:**
- ✅ Index + Detail layout (Option C)
- ✅ All 13 CCs + PC in index
- ✅ Continuous: 7-bit + 14-bit ranges, LSB CC, send-order note
- ✅ Enum: MIDI range → index → name table with correct breakpoints from firmware formula
- ✅ Threshold: visual bar split at 64
- ✅ Trigger: ≥64 threshold documented
- ✅ PC: 12 slots (0–11), correcting prior docs
- ✅ Tap tempo ≥64 threshold documented, correcting prior docs
- ✅ New file `midi-reference.jsx` pattern follows `firmware-updater.jsx`
- ✅ Data in `midi-cc-map.js` is Node-testable with integrity checks
- ✅ Build script updated for both new files

**Type/name consistency:**
- `MIDI_CC_MAP` — defined in Task 1, referenced via `window.MIDI_CC_MAP` in Task 2
- `PhMidiRef` — defined in Task 2, used in Task 3 `app.jsx`
- `MidiDetail` — defined in Task 2, used only inside `midi-reference.jsx`
- `entry.kind` values (`"continuous"`, `"enum"`, `"threshold"`, `"trigger"`, `"pc"`) — consistent across Task 1 data and Task 2 component switch
- `entry.lsbCc`, `entry.hires`, `entry.options`, `entry.low`, `entry.high`, `entry.notes` — used in Task 2 exactly as defined in Task 1
