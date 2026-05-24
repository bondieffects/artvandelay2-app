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
    "tap tempo notes must document the >=64 threshold");
});
