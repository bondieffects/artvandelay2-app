// src/pure.js — pure math and protocol helpers.
// Browser: loaded as a plain <script> before app scripts; declarations are global.
// Node (tests): const { ... } = require('./pure.js');

// ── LFO math ────────────────────────────────────────────────────────────────
const lfoRateParamToHz = (r) => {
  const minHz = 0.1, maxHz = 10.0;
  const t = r / 255;
  return Math.min(Math.max(minHz * ((maxHz / minHz) ** (t * t)), minHz), maxHz);
};
const lfoDepthParamToCents = (d) => (d * 25.0) / 255.0;
const smoothstep = (v) => v * v * (3 - 2 * v);
const triShape = (p) => (2 / Math.PI) * Math.asin(Math.sin(2 * Math.PI * p));
const smoothRand = (p) => {
  const pts = [-0.806507,0.440361,-0.294578,0.814458,-0.612048,0.121687,0.620482,-0.283133];
  const n = pts.length, pos = p * n, seg = Math.floor(pos) % n, local = pos - seg;
  const e = smoothstep(local);
  return pts[seg] + (pts[(seg + 1) % n] - pts[seg]) * e;
};
const skewTri = (p) => { const s = 0.72; return p < s ? -1 + 2*(p/s) : 1 - 2*((p-s)/(1-s)); };
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

// ── Firmware version ─────────────────────────────────────────────────────────
function fwVersionCompare(a, b) {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return (a.patch ?? 0) - (b.patch ?? 0);
}

function fwVersionString(v) {
  return `${v.major}.${v.minor}.${v.patch ?? 0}`;
}

// ── Firmware protocol ────────────────────────────────────────────────────────
const FW_PROTO = {
  MFR_ID:                0x7d,
  CMD_PING:              0x00,
  CMD_BLOCK:             0x01,
  CMD_COMMIT:            0x02,
  RESP_PONG:             0x70,
  RESP_COMMIT_OK:        0x73,
  RESP_COMMIT_FAIL:      0x74,
  APP_BASE:              0x08008000,
  FLASH_END:             0x08040000,
  BLOCK_SIZE:            256,
  PAGE_SIZE:             2048,
  APP_SPACE:             256 * 1024 - (0x08008000 - 0x08000000),
  MIN_BLOCK_INTERVAL_MS: 120,
  PAGE_ERASE_INTERVAL_MS: 400,
};

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

function fwParseImage(bytes) {
  if (bytes.length < 33) throw new Error("File is too small; expected firmware plus 32-byte tag.");
  const firmware = bytes.slice(0, bytes.length - 32);
  const tag = bytes.slice(bytes.length - 32);
  if (firmware.length > FW_PROTO.APP_SPACE) {
    throw new Error(`Firmware is ${firmware.length.toLocaleString()} bytes; maximum is ${FW_PROTO.APP_SPACE.toLocaleString()}.`);
  }
  const paddedSize = Math.ceil(firmware.length / FW_PROTO.BLOCK_SIZE) * FW_PROTO.BLOCK_SIZE;
  const padded = new Uint8Array(paddedSize);
  padded.fill(0xff);
  padded.set(firmware);
  const sp = fwU32le(firmware, 0);
  const reset = fwU32le(firmware, 4);
  const vectorOk = firmware.length >= 8 &&
    (sp & 0xff000000) === 0x20000000 &&
    FW_PROTO.APP_BASE <= (reset & ~1) &&
    (reset & ~1) < FW_PROTO.FLASH_END;
  return {
    firmware, padded, tag,
    size: firmware.length,
    totalBlocks: padded.length / FW_PROTO.BLOCK_SIZE,
    sp, reset, vectorOk,
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    FW_PROTO,
    lfoRateParamToHz, lfoDepthParamToCents,
    smoothstep, triShape, smoothRand, skewTri, trap, sampleWave,
    fwVersionCompare, fwVersionString,
    fwEncode8to7, fwCrc16, fwU16be, fwU32be, fwU32le, fwParseImage,
  };
}
