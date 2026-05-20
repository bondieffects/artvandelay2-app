// Tests for pure math and protocol functions.
// Run with: node tests/pure-functions.test.js
// Requires Node.js 18+ (uses node:test).

const { test } = require("node:test");
const assert = require("node:assert/strict");

// ── LFO math (mirrored from src/shared.jsx) ───────────────────────────────
const lfoRateParamToHz = (r) => {
  const minHz = 0.1, maxHz = 10.0;
  const t = r / 255;
  return Math.min(Math.max(minHz * ((maxHz / minHz) ** (t * t)), minHz), maxHz);
};
const lfoDepthParamToCents = (d) => (d * 25.0) / 255.0;
const smoothstep = (v) => v * v * (3 - 2 * v);
const triShape = (p) => (2 / Math.PI) * Math.asin(Math.sin(2 * Math.PI * p));
const smoothRand = (p) => {
  const pts = [-0.806507, 0.440361, -0.294578, 0.814458, -0.612048, 0.121687, 0.620482, -0.283133];
  const n = pts.length, pos = p * n, seg = Math.floor(pos) % n, local = pos - seg;
  return pts[seg] + (pts[(seg + 1) % n] - pts[seg]) * smoothstep(local);
};
const skewTri = (p) => { const s = 0.72; return p < s ? -1 + 2 * (p / s) : 1 - 2 * ((p - s) / (1 - s)); };
const trap = (p) => {
  const r = 0.18, h = 0.32, f = 0.18, ls = r + h + f;
  if (p < r) return -1 + 2 * (p / r);
  if (p < r + h) return 1;
  if (p < ls) return 1 - 2 * ((p - r - h) / f);
  return -1;
};
const sampleWave = (id, phase) => {
  const p = ((phase % 1) + 1) % 1;
  const t = triShape(p);
  switch (id) {
    case 0: return Math.sin(2 * Math.PI * p);
    case 1: return t;
    case 2: return Math.tanh(2.4 * t) / Math.tanh(2.4);
    case 3: return Math.sign(t || 1) * (Math.abs(t) ** 2.2);
    case 4: return smoothRand(p);
    case 5: return skewTri(p);
    case 6: return trap(p);
    default: return Math.sin(2 * Math.PI * p);
  }
};

// ── Firmware protocol (mirrored from src/firmware-updater.jsx) ────────────
function fwEncode8to7(data) {
  const out = [];
  for (let i = 0; i < data.length; i += 7) {
    const chunk = data.slice(i, i + 7);
    let msbs = 0;
    for (let j = 0; j < chunk.length; j++) msbs |= ((chunk[j] >> 7) & 1) << j;
    out.push(msbs);
    for (const b of chunk) out.push(b & 0x7f);
  }
  return new Uint8Array(out);
}

function fwCrc16(data) {
  let crc = 0xffff;
  for (const b of data) {
    crc ^= b << 8;
    for (let i = 0; i < 8; i++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xffff;
    }
  }
  return crc;
}

function fwU16be(out, offset, value) {
  out[offset] = (value >> 8) & 0xff;
  out[offset + 1] = value & 0xff;
}

function fwU32be(out, offset, value) {
  out[offset] = (value >>> 24) & 0xff;
  out[offset + 1] = (value >>> 16) & 0xff;
  out[offset + 2] = (value >>> 8) & 0xff;
  out[offset + 3] = value & 0xff;
}

function fwU32le(data, offset) {
  return ((data[offset] ?? 0xff) |
          ((data[offset + 1] ?? 0xff) << 8) |
          ((data[offset + 2] ?? 0xff) << 16) |
          ((data[offset + 3] ?? 0xff) << 24)) >>> 0;
}

const FW_PROTO = {
  APP_BASE:   0x08008000,
  FLASH_END:  0x08040000,
  BLOCK_SIZE: 256,
  APP_SPACE:  256 * 1024 - (0x08008000 - 0x08000000),
};

function fwParseImage(bytes) {
  if (bytes.length < 33) throw new Error("File is too small; expected firmware plus 32-byte tag.");
  const firmware = bytes.slice(0, bytes.length - 32);
  const tag = bytes.slice(bytes.length - 32);
  if (firmware.length > FW_PROTO.APP_SPACE)
    throw new Error(`Firmware is ${firmware.length.toLocaleString()} bytes; maximum is ${FW_PROTO.APP_SPACE.toLocaleString()}.`);
  const paddedSize = Math.ceil(firmware.length / FW_PROTO.BLOCK_SIZE) * FW_PROTO.BLOCK_SIZE;
  const padded = new Uint8Array(paddedSize);
  padded.fill(0xff);
  padded.set(firmware);
  const sp    = fwU32le(firmware, 0);
  const reset = fwU32le(firmware, 4);
  const vectorOk = firmware.length >= 8 &&
    (sp & 0xff000000) === 0x20000000 &&
    FW_PROTO.APP_BASE <= (reset & ~1) &&
    (reset & ~1) < FW_PROTO.FLASH_END;
  return { firmware, padded, tag, size: firmware.length,
    totalBlocks: padded.length / FW_PROTO.BLOCK_SIZE, sp, reset, vectorOk };
}

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
  // CRC of [0x00]: 0xffff ^ 0x0000 = 0xffff, then 8 shifts with poly 0x1021
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
  // bytes 1–3 are out of bounds → 0xff
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
  assert.strictEqual(result.totalBlocks, 1);       // ceil(100/256)*256/256
  assert.strictEqual(result.padded.length, 256);
  assert.strictEqual(result.padded[100], 0xff);    // padding byte
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
