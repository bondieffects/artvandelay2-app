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
      { midi: "0–10",    index: 0, name: "1/1" },
      { midi: "11–31",   index: 1, name: "1/2" },
      { midi: "32–52",   index: 2, name: "1/3" },
      { midi: "53–74",   index: 3, name: "1/4" },
      { midi: "75–95",   index: 4, name: "1/6" },
      { midi: "96–116",  index: 5, name: "1/8" },
      { midi: "117–127", index: 6, name: "1/16" },
    ],
  },
  {
    cc: 27, hires: false,
    shortLabel: "waveform", label: "lfo_waveform", channel: 1,
    kind: "enum", midiRange: "0–127", mapsTo: "index 0–6",
    options: [
      { midi: "0–10",    index: 0, name: "Sine" },
      { midi: "11–31",   index: 1, name: "Triangle" },
      { midi: "32–52",   index: 2, name: "S-Shaped" },
      { midi: "53–74",   index: 3, name: "Exponential" },
      { midi: "75–95",   index: 4, name: "Smooth Rand" },
      { midi: "96–116",  index: 5, name: "Skewed Tri" },
      { midi: "117–127", index: 6, name: "Trapezoid" },
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
} else {
  window.MIDI_CC_MAP = MIDI_CC_MAP;
}
