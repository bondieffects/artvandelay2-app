// Shared: mock device data (matches firmware JSON shape), LFO math, hooks.

const PARAM_CATALOG = [
  { id: 0, key: "delay_time_ms", label: "Delay Time",   shortLabel: "DELAY",        unit: "ms", min: 20, max: 1000, kind: "time" },
  { id: 1, key: "lfo_depth",     label: "LFO Depth",    shortLabel: "DEPTH",        unit: "",   min: 0,  max: 255,  kind: "8bit" },
  { id: 2, key: "lfo_rate",      label: "LFO Rate",     shortLabel: "RATE",         unit: "",   min: 0,  max: 255,  kind: "8bit" },
  { id: 3, key: "effect_level",  label: "Effect Level", shortLabel: "EFFECT LEVEL", unit: "",   min: 0,  max: 255,  kind: "8bit" },
  { id: 4, key: "feedback",      label: "Feedback",     shortLabel: "FEEDBACK",     unit: "",   min: 0,  max: 255,  kind: "8bit" },
  { id: 5, key: "tilt",          label: "Tilt",         shortLabel: "TILT",         unit: "",   min: 0,  max: 255,  kind: "8bit" },
  { id: 6, key: "subdivision",   label: "Subdivision",  unit: "", min: 0, max: 6,   kind: "enum",
    options: ["1/1","1/2","1/3","1/4","1/6","1/8","1/16"] },
  { id: 7, key: "lfo_waveform",  label: "Waveform",     unit: "", min: 0, max: 6,   kind: "enum",
    options: ["Sine","Triangle","S-Shaped","Exponential","Smooth Rand","Skewed Tri","Trapezoid"] },
];

const WAVEFORM_LABELS = PARAM_CATALOG.find((p) => p.key === "lfo_waveform").options;

// Bump this manually when a new firmware is released.
const LATEST_FW_VERSION = { major: 1, minor: 0, patch: 0 };

function fwVersionCompare(a, b) {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return (a.patch ?? 0) - (b.patch ?? 0);
}

function fwVersionString(v) {
  return `${v.major}.${v.minor}.${v.patch ?? 0}`;
}

const MOCK_DEVICE = {
  device: "ArtVanDelay2",
  firmware: { major: 1, minor: 4, patch: 2, tweak: 0 },
  board: "artvandelay2",
  hardware_revision: 0,
  serial: "AVD2-0412",
};

const MOCK_LIVE = {
  delay_time_ms: 487,
  lfo_depth: 96,
  lfo_rate: 72,
  effect_level: 180,
  feedback: 134,
  tilt: 140,
  subdivision: 3,
  lfo_waveform: 1,
  expression: 0,
  bypass_state: 1,
  active_preset: 2,
  preset_dirty: true,
};

const PRESET_NAMES = [
  "Quarter Note Ghost","Tape Echo Warm","Bucket Brigade","Dub Chamber",
  "Stuttered Subdiv","Modulated Plate","Haunted Hallway","Empty",
];

const MOCK_PRESETS = PRESET_NAMES.map((name, i) => {
  if (name === "Empty") return { slot: i, valid: false, name };
  // Deterministic pseudo-random
  const s = (i * 37 + 13);
  return {
    slot: i,
    valid: true,
    name,
    delay_time_ms: 120 + ((s * 7) % 900),
    lfo_depth: (s * 11) % 256,
    lfo_rate: (s * 13) % 256,
    effect_level: 100 + ((s * 17) % 150),
    feedback: (s * 19) % 220,
    tilt: (s * 23) % 256,
    subdivision: i % 7,
    lfo_waveform: i % 7,
    expression: 0,
    bypass_state: 1,
  };
});

const MOCK_CONFIG = {
  expression_enabled: true,
  expression_assignment: 2,
  expression_curve: 0,
  expression_auto_assign: false,
  expression_calibration_min: 12,
  expression_calibration_max: 3980,
  effect_level_mode: "effect_level",
};

const MOCK_LOG = [
  [-1,  "14:02:11", "INFO", "Serial port connected."],
  [-2,  "14:02:11", "TX",   "> web info"],
  [-3,  "14:02:11", "RX",   `< {"device":"ArtVanDelay2","firmware":{"major":1,"minor":4,"patch":2,"tweak":0}}`],
  [-4,  "14:02:12", "TX",   "> web param get"],
  [-5,  "14:02:12", "RX",   `< {"delay_time_ms":487,"lfo_depth":96,"lfo_rate":72,...}`],
  [-6,  "14:02:12", "TX",   "> web preset list"],
  [-7,  "14:02:13", "RX",   `< {"active":2,"dirty":true,"slots":[{"slot":0,"valid":true},...]}`],
  [-8,  "14:02:14", "TX",   "> web config get"],
  [-9,  "14:02:14", "RX",   `< {"expression_enabled":true,"expression_assignment":2,...}`],
  [-10, "14:04:02", "INFO", "Preset 3 loaded."],
];

// ── LfoScope — canvas oscilloscope with configurable skin ──
function LfoScope({ waveformId, rate, depth, width, height, skin = "phosphor" }) {
  const ref = React.useRef(null);
  const animParamsRef = React.useRef({ waveformId, rate, depth });
  // Update synchronously every render so the RAF loop reads current values without restarting.
  animParamsRef.current = { waveformId, rate, depth };

  React.useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let raf, start = performance.now();
    const skins = {
      phosphor: {
        bg: (g) => { g.fillStyle = "#110a0d"; g.fillRect(0,0,width,height); },
        grid: "rgba(255,26,136,0.14)",
        zero: "rgba(255,26,136,0.3)",
        trace: "#ff1a88",
        glow: "rgba(255,26,136,0.55)",
        dot: "#ffd6e8",
      },
      cream: {
        bg: (g) => {
          const lg = g.createLinearGradient(0,0,0,height);
          lg.addColorStop(0,"#1d1713"); lg.addColorStop(1,"#14100d");
          g.fillStyle = lg; g.fillRect(0,0,width,height);
        },
        grid: "rgba(236,198,132,0.12)",
        zero: "rgba(236,198,132,0.28)",
        trace: "#f2c96c",
        glow: "rgba(242,201,108,0.45)",
        dot: "#fff2c7",
      },
      ink: {
        bg: (g) => { g.fillStyle = "#f3efe7"; g.fillRect(0,0,width,height); },
        grid: "rgba(30,24,20,0.08)",
        zero: "rgba(30,24,20,0.22)",
        trace: "#141414",
        glow: "rgba(230,52,103,0.35)",
        dot: "#e63467",
      },
    };
    const S = skins[skin] || skins.phosphor;

    const padX = 20, padY = 24;
    const gw = width - padX * 2, gh = height - padY * 2;
    const midY = padY + gh / 2;

    const draw = (now) => {
      const { waveformId, rate, depth } = animParamsRef.current;
      const phaseOffset = ((now - start) / 1000) * lfoRateParamToHz(rate);
      S.bg(ctx);

      // grid
      ctx.strokeStyle = S.grid; ctx.lineWidth = 1;
      for (let i = 0; i <= 8; i++) {
        const x = padX + (gw / 8) * i;
        ctx.beginPath(); ctx.moveTo(x, padY); ctx.lineTo(x, height - padY); ctx.stroke();
      }
      for (let i = 0; i <= 4; i++) {
        const y = padY + (gh / 4) * i;
        ctx.beginPath(); ctx.moveTo(padX, y); ctx.lineTo(width - padX, y); ctx.stroke();
      }
      // zero line
      ctx.strokeStyle = S.zero;
      ctx.setLineDash([4, 6]);
      ctx.beginPath(); ctx.moveTo(padX, midY); ctx.lineTo(width - padX, midY); ctx.stroke();
      ctx.setLineDash([]);

      // trace (depth-scaled)
      const depthScale = Math.max(0.08, lfoDepthParamToCents(depth) / 25);
      const amp = (gh * 0.42) * depthScale;

      // glow pass
      ctx.shadowBlur = skin === "ink" ? 0 : 18;
      ctx.shadowColor = S.glow;
      ctx.strokeStyle = S.trace;
      ctx.lineWidth = skin === "ink" ? 2.2 : 2.4;
      ctx.lineJoin = "round"; ctx.lineCap = "round";
      ctx.beginPath();
      for (let px = 0; px <= gw; px++) {
        const phase = px / gw + phaseOffset * 0.25;
        const s = sampleWave(waveformId, phase);
        const x = padX + px, y = midY - s * amp;
        if (px === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // scanning dot
      const frac = ((phaseOffset % 1) + 1) % 1;
      const dx = padX + frac * gw;
      const dy = midY - sampleWave(waveformId, frac + phaseOffset * 0.25) * amp;
      ctx.fillStyle = S.dot;
      ctx.beginPath(); ctx.arc(dx, dy, 4, 0, Math.PI * 2); ctx.fill();

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, skin]);

  const waveLabel = WAVEFORM_LABELS[waveformId] || "sine";
  return (
    <div role="img" aria-label={`LFO oscilloscope: ${waveLabel} waveform`}
      style={{ position: "relative" }}>
      <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden",
        clip: "rect(0,0,0,0)", whiteSpace: "nowrap" }}>
        {`${waveLabel} LFO — ${lfoRateParamToHz(rate).toFixed(2)} Hz, ${lfoDepthParamToCents(depth).toFixed(1)} ct depth`}
      </span>
      <canvas ref={ref} aria-hidden="true" style={{ display: "block", borderRadius: 6 }} />
    </div>
  );
}
LfoScope = React.memo(LfoScope);

// ── Knob — boutique rotary control, SVG ──
function Knob({ value, min = 0, max = 255, size = 64, label, color = "#e8bb6b", trackColor = "rgba(255,255,255,0.08)", indicatorColor = "#fff", onChange }) {
  const frac = (value - min) / (max - min);
  const startA = -135, endA = 135;
  const angle = startA + frac * (endA - startA);
  const r = size / 2 - 4;
  const cx = size / 2, cy = size / 2;
  // arc path
  const rad = (a) => (a - 90) * Math.PI / 180;
  const arcPath = (a0, a1) => {
    const x0 = cx + r * Math.cos(rad(a0));
    const y0 = cy + r * Math.sin(rad(a0));
    const x1 = cx + r * Math.cos(rad(a1));
    const y1 = cy + r * Math.sin(rad(a1));
    const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
    return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
  };
  const onWheel = (e) => {
    if (!onChange) return;
    e.preventDefault();
    const step = (max - min) / 100;
    onChange(Math.max(min, Math.min(max, value - Math.sign(e.deltaY) * step)));
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <svg width={size} height={size} onWheel={onWheel} style={{ cursor: onChange ? "ns-resize" : "default" }}>
        <path d={arcPath(startA, endA)} stroke={trackColor} strokeWidth={3} fill="none" strokeLinecap="round" />
        <path d={arcPath(startA, angle)} stroke={color} strokeWidth={3} fill="none" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={r - 8} fill="#1c1713" stroke="rgba(255,255,255,0.08)" />
        <line x1={cx} y1={cy} x2={cx + (r - 12) * Math.cos(rad(angle))} y2={cy + (r - 12) * Math.sin(rad(angle))}
          stroke={indicatorColor} strokeWidth={2.2} strokeLinecap="round" />
      </svg>
      {label && <div style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.7 }}>{label}</div>}
    </div>
  );
}

Object.assign(window, {
  PARAM_CATALOG, WAVEFORM_LABELS, MOCK_DEVICE, MOCK_LIVE, MOCK_PRESETS,
  MOCK_CONFIG, MOCK_LOG, lfoRateParamToHz, lfoDepthParamToCents, sampleWave,
  LfoScope, Knob,
  LATEST_FW_VERSION, fwVersionCompare, fwVersionString,
});
