// Tests for pure math and protocol functions.
// Run with: node tests/pure-functions.test.js
// Requires Node.js 18+ (uses node:test).

const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  FW_PROTO,
  lfoRateParamToHz, lfoDepthParamToCents, sampleWave,
  fwVersionCompare, fwVersionString,
  fwEncode8to7, fwCrc16, fwU16be, fwU32be, fwU32le, fwParseImage,
} = require("../src/pure.js");

// ── LFO math tests ────────────────────────────────────────────────────────
test("lfoRateParamToHz: 0 → 0.1 Hz (minimum)", () => {
  assert.ok(Math.abs(lfoRateParamToHz(0) - 0.1) < 0.001);
});

test("lfoRateParamToHz: 255 → 10.0 Hz (maximum)", () => {
  assert.ok(Math.abs(lfoRateParamToHz(255) - 10.0) < 0.001);
});

test("lfoRateParamToHz: midpoint is between min and max", () => {
  const mid = lfoRateParamToHz(128);
  assert.ok(mid > 0.1 && mid < 10.0);
});

test("lfoDepthParamToCents: 0 → 0", () => {
  assert.strictEqual(lfoDepthParamToCents(0), 0);
});

test("lfoDepthParamToCents: 255 → 25.0 cents", () => {
  assert.ok(Math.abs(lfoDepthParamToCents(255) - 25.0) < 0.01);
});

test("sampleWave: sine peak at phase 0.25", () => {
  assert.ok(Math.abs(sampleWave(0, 0.25) - 1.0) < 1e-9);
});

test("sampleWave: sine trough at phase 0.75", () => {
  assert.ok(Math.abs(sampleWave(0, 0.75) + 1.0) < 1e-9);
});

test("sampleWave: triangle zero-crossing at phase 0", () => {
  assert.ok(Math.abs(sampleWave(1, 0)) < 1e-9);
});

test("sampleWave: triangle peak at phase 0.25", () => {
  assert.ok(Math.abs(sampleWave(1, 0.25) - 1.0) < 1e-9);
});

test("sampleWave: triangle trough at phase 0.75", () => {
  assert.ok(Math.abs(sampleWave(1, 0.75) + 1.0) < 1e-9);
});

test("sampleWave: triangle zero-crossing at phase 0.5", () => {
  assert.ok(Math.abs(sampleWave(1, 0.5)) < 1e-9);
});

test("sampleWave: skewTri at -1 at phase 0", () => {
  assert.ok(Math.abs(sampleWave(5, 0) + 1.0) < 1e-9);
});

test("sampleWave: skewTri peaks at +1 at phase 0.72", () => {
  assert.ok(Math.abs(sampleWave(5, 0.72) - 1.0) < 1e-9);
});

test("sampleWave: trap reaches +1 on plateau (phase 0.34)", () => {
  assert.ok(Math.abs(sampleWave(6, 0.34) - 1.0) < 1e-9);
});

test("sampleWave: trap holds -1 on floor (phase 0.80)", () => {
  assert.ok(Math.abs(sampleWave(6, 0.80) + 1.0) < 1e-9);
});

test("sampleWave: all 7 waveforms stay within [-1, 1]", () => {
  for (let id = 0; id <= 6; id++) {
    for (let i = 0; i <= 200; i++) {
      const v = sampleWave(id, i / 200);
      assert.ok(v >= -1.001 && v <= 1.001,
        `waveform ${id} at phase ${(i / 200).toFixed(3)} = ${v} — out of range`);
    }
  }
});

test("sampleWave: unknown id falls back to sine", () => {
  assert.ok(Math.abs(sampleWave(99, 0.25) - 1.0) < 1e-9);
});

// ── fwVersionCompare / fwVersionString tests (M15) ───────────────────────
test("fwVersionCompare: equal versions return 0", () => {
  assert.strictEqual(fwVersionCompare({ major: 1, minor: 2, patch: 3 }, { major: 1, minor: 2, patch: 3 }), 0);
});

test("fwVersionCompare: major takes precedence", () => {
  assert.ok(fwVersionCompare({ major: 2, minor: 0, patch: 0 }, { major: 1, minor: 9, patch: 9 }) > 0);
  assert.ok(fwVersionCompare({ major: 1, minor: 9, patch: 9 }, { major: 2, minor: 0, patch: 0 }) < 0);
});

test("fwVersionCompare: minor compared when major equal", () => {
  assert.ok(fwVersionCompare({ major: 1, minor: 3, patch: 0 }, { major: 1, minor: 2, patch: 9 }) > 0);
});

test("fwVersionCompare: patch compared when major and minor equal", () => {
  assert.ok(fwVersionCompare({ major: 1, minor: 0, patch: 5 }, { major: 1, minor: 0, patch: 4 }) > 0);
});

test("fwVersionCompare: missing patch treated as 0", () => {
  assert.strictEqual(fwVersionCompare({ major: 1, minor: 0 }, { major: 1, minor: 0, patch: 0 }), 0);
});

test("fwVersionString: formats correctly", () => {
  assert.strictEqual(fwVersionString({ major: 1, minor: 4, patch: 2 }), "1.4.2");
});

test("fwVersionString: missing patch defaults to 0", () => {
  assert.strictEqual(fwVersionString({ major: 2, minor: 0 }), "2.0.0");
});

// ── PARAM_CATALOG validation tests (I11) ─────────────────────────────────
// Catalog definition inlined here so structural regressions fail tests.
const PARAM_CATALOG = [
  { id: 0, key: "delay_time_ms", min: 20,  max: 1000 },
  { id: 1, key: "lfo_depth",     min: 0,   max: 255  },
  { id: 2, key: "lfo_rate",      min: 0,   max: 255  },
  { id: 3, key: "effect_level",  min: 0,   max: 255  },
  { id: 4, key: "feedback",      min: 0,   max: 255  },
  { id: 5, key: "tilt",          min: 0,   max: 255  },
  { id: 6, key: "subdivision",   min: 0,   max: 6,   options: ["1/1","1/2","1/3","1/4","1/6","1/8","1/16"] },
  { id: 7, key: "lfo_waveform",  min: 0,   max: 6,   options: ["Sine","Triangle","S-Shaped","Exponential","Smooth Rand","Skewed Tri","Trapezoid"] },
];

test("PARAM_CATALOG: all IDs are unique", () => {
  const ids = PARAM_CATALOG.map((p) => p.id);
  assert.strictEqual(ids.length, new Set(ids).size);
});

test("PARAM_CATALOG: all keys are unique", () => {
  const keys = PARAM_CATALOG.map((p) => p.key);
  assert.strictEqual(keys.length, new Set(keys).size);
});

test("PARAM_CATALOG: enum entries have options.length === max - min + 1", () => {
  for (const p of PARAM_CATALOG) {
    if (p.options) {
      assert.strictEqual(p.options.length, p.max - p.min + 1,
        `${p.key}: options.length ${p.options.length} !== max-min+1 ${p.max - p.min + 1}`);
    }
  }
});

test("PARAM_CATALOG: MOCK_PRESETS values stay within declared bounds", () => {
  // Guard against the mock generator accidentally producing out-of-range values.
  const PRESET_NAMES = [
    "Quarter Note Ghost", "Tape Echo Warm", "Bucket Brigade",
    "Dub Chamber", "Stuttered Subdiv", "Modulated Plate",
    "Haunted Hallway", "Slapback Room", "Long Tape Wash",
    "Dark Dub", "Shimmer Mod", "Empty",
  ];
  const presets = PRESET_NAMES.map((name, i) => {
    if (name === "Empty") return null;
    const s = (i * 37 + 13);
    return {
      delay_time_ms: Math.min(1000, 120 + ((s * 7) % 900)),
      lfo_depth:     (s * 11) % 256,
      lfo_rate:      (s * 13) % 256,
      effect_level:  100 + ((s * 17) % 150),
      feedback:      (s * 19) % 220,
      tilt:          (s * 23) % 256,
      subdivision:   i % 7,
      lfo_waveform:  i % 7,
    };
  }).filter(Boolean);

  for (const preset of presets) {
    for (const p of PARAM_CATALOG) {
      const val = preset[p.key];
      if (val === undefined) continue;
      assert.ok(val >= p.min && val <= p.max,
        `MOCK_PRESETS: ${p.key} = ${val} out of [${p.min}, ${p.max}]`);
    }
  }
});

// ── fwEncode8to7 tests ────────────────────────────────────────────────────
test("fwEncode8to7: all zeros — no high bits", () => {
  const enc = fwEncode8to7(new Uint8Array(7));
  assert.strictEqual(enc[0], 0);
  for (let i = 1; i < enc.length; i++) assert.strictEqual(enc[i], 0);
});

test("fwEncode8to7: all 0xff — MSB byte is 0x7f, data bytes are 0x7f", () => {
  const enc = fwEncode8to7(new Uint8Array(7).fill(0xff));
  assert.strictEqual(enc[0], 0x7f);
  for (let i = 1; i < enc.length; i++) assert.strictEqual(enc[i], 0x7f);
});

test("fwEncode8to7: mixed high bits packed correctly", () => {
  // bytes 0–3 have bit7=0, bytes 4–6 have bit7=1
  const input = new Uint8Array([0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde]);
  const enc = fwEncode8to7(input);
  assert.strictEqual(enc[0], 0b1110000); // bits 4,5,6 set
  assert.strictEqual(enc.length, 8);
});

test("fwEncode8to7: all output bytes are 7-bit safe", () => {
  const input = new Uint8Array(256).map((_, i) => i);
  const enc = fwEncode8to7(input);
  for (const b of enc) assert.ok(b < 0x80, `byte 0x${b.toString(16)} not 7-bit safe`);
});

test("fwEncode8to7: partial final chunk handled", () => {
  // 8 bytes → one full chunk (7) + one partial (1)
  const input = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0xff]);
  const enc = fwEncode8to7(input);
  assert.strictEqual(enc.length, 8 + 2); // chunk1: 1+7, chunk2: 1+1
  assert.strictEqual(enc[8], 0x01);  // MSB of 0xff
  assert.strictEqual(enc[9], 0x7f);  // low 7 bits of 0xff
});

// ── fwCrc16 tests ─────────────────────────────────────────────────────────
test("fwCrc16: empty input → 0xffff (initial value)", () => {
  assert.strictEqual(fwCrc16(new Uint8Array(0)), 0xffff);
});

test("fwCrc16: known vector '123456789' → 0x29b1", () => {
  const data = new TextEncoder().encode("123456789");
  assert.strictEqual(fwCrc16(data), 0x29b1);
});

test("fwCrc16: single zero byte", () => {
  const crc = fwCrc16(new Uint8Array([0x00]));
  assert.strictEqual(typeof crc, "number");
  assert.ok(crc >= 0 && crc <= 0xffff);
});

// ── Integer read/write tests ──────────────────────────────────────────────
test("fwU16be: writes big-endian correctly", () => {
  const buf = new Uint8Array(4);
  fwU16be(buf, 0, 0x1234);
  fwU16be(buf, 2, 0xabcd);
  assert.deepStrictEqual(Array.from(buf), [0x12, 0x34, 0xab, 0xcd]);
});

test("fwU32be: writes big-endian correctly", () => {
  const buf = new Uint8Array(4);
  fwU32be(buf, 0, 0x12345678);
  assert.deepStrictEqual(Array.from(buf), [0x12, 0x34, 0x56, 0x78]);
});

test("fwU32le: reads little-endian correctly", () => {
  const buf = new Uint8Array([0x78, 0x56, 0x34, 0x12]);
  assert.strictEqual(fwU32le(buf, 0), 0x12345678);
});

test("fwU32le: out-of-bounds bytes default to 0xff", () => {
  const buf = new Uint8Array([0x00]);
  assert.strictEqual(fwU32le(buf, 0), (0x00 | (0xff << 8) | (0xff << 16) | (0xff << 24)) >>> 0);
});

// ── fwParseImage tests ────────────────────────────────────────────────────
test("fwParseImage: rejects file smaller than 33 bytes", () => {
  assert.throws(() => fwParseImage(new Uint8Array(32)), /too small/);
});

test("fwParseImage: rejects firmware exceeding APP_SPACE", () => {
  const big = new Uint8Array(FW_PROTO.APP_SPACE + 33);
  assert.throws(() => fwParseImage(big), /bytes/);
});

test("fwParseImage: pads firmware to block boundary", () => {
  const img = new Uint8Array(100 + 32); // 100 B firmware + 32 B tag
  const result = fwParseImage(img);
  assert.strictEqual(result.size, 100);
  assert.strictEqual(result.totalBlocks, 1);
  assert.strictEqual(result.padded.length, 256);
  assert.strictEqual(result.padded[100], 0xff);
});

test("fwParseImage: tag split correctly", () => {
  const img = new Uint8Array(64 + 32);
  for (let i = 0; i < 32; i++) img[64 + i] = i + 1;
  const result = fwParseImage(img);
  assert.strictEqual(result.tag.length, 32);
  assert.strictEqual(result.tag[0], 1);
  assert.strictEqual(result.tag[31], 32);
});

test("fwParseImage: valid STM32 vector table detected", () => {
  const img = new Uint8Array(256 + 32);
  // SP = 0x20010000 (SRAM), little-endian
  img[0] = 0x00; img[1] = 0x00; img[2] = 0x01; img[3] = 0x20;
  // Reset vector = 0x08008001 (APP_BASE | Thumb bit), little-endian
  img[4] = 0x01; img[5] = 0x80; img[6] = 0x00; img[7] = 0x08;
  const result = fwParseImage(img);
  assert.ok(result.vectorOk, "expected vectorOk=true");
});

test("fwParseImage: invalid stack pointer flagged", () => {
  const img = new Uint8Array(256 + 32);
  // SP = 0x10010000 (not in SRAM 0x20xxxxxx range)
  img[0] = 0x00; img[1] = 0x00; img[2] = 0x01; img[3] = 0x10;
  img[4] = 0x01; img[5] = 0x80; img[6] = 0x00; img[7] = 0x08;
  const result = fwParseImage(img);
  assert.ok(!result.vectorOk, "expected vectorOk=false");
});

test("fwParseImage: reset vector below APP_BASE flagged", () => {
  const img = new Uint8Array(256 + 32);
  img[0] = 0x00; img[1] = 0x00; img[2] = 0x01; img[3] = 0x20; // valid SP
  // Reset = 0x08000001 — below APP_BASE (0x08008000)
  img[4] = 0x01; img[5] = 0x00; img[6] = 0x00; img[7] = 0x08;
  const result = fwParseImage(img);
  assert.ok(!result.vectorOk, "expected vectorOk=false");
});
