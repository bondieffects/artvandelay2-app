// src/user-manual.jsx — Art Van Delay 2 user manual tab
// Reads: window.RENDER_SVG_URI (set by render-svg-uri.js)
// Reads: window.PH, window.PhPanel, window.PARAM_CATALOG, window.WAVEFORM_LABELS
// Exposes: window.PhManual

// ─── Control overlay data ────────────────────────────────────────────────────
// Coordinates extracted from render.svg path geometry (viewBox 413.1 × 362.46).
// Each entry is a clickable region that opens a PhManualPopover.

const MANUAL_CONTROLS = [
  // Large knobs
  { key: 'delay',      id: 'delay',     shape: 'circle', cx: 69.0,   cy: 92.5,   r: 32 },
  { key: 'feedback',   id: 'feedback',  shape: 'circle', cx: 343.0,  cy: 92.5,   r: 32 },
  // Small knobs — top row
  { key: 'depth',      id: 'depth',     shape: 'circle', cx: 169.71, cy: 86.07,  r: 25 },
  { key: 'level',      id: 'level',     shape: 'circle', cx: 257.01, cy: 86.07,  r: 25 },
  // Small knobs — middle row
  { key: 'rate',       id: 'rate',      shape: 'circle', cx: 169.71, cy: 162.87, r: 25 },
  { key: 'tilt',       id: 'tilt',      shape: 'circle', cx: 257.01, cy: 168.57, r: 25 },
  // LFO section (toggle + LED between DEPTH and RATE)
  { key: 'lfo-tog',    id: 'lfowave',   shape: 'circle', cx: 148.72, cy: 124.35, r: 11 },
  { key: 'lfo-led',    id: 'lfowave',   shape: 'circle', cx: 187.47, cy: 124.77, r: 11 },
  // SUB.DIV — 5 LEDs as a rect + toggle below
  { key: 'sd-leds',    id: 'subdiv',    shape: 'rect',   x: 26.3,    y: 144.4,   w: 81.5, h: 10 },
  { key: 'sd-tog',     id: 'subdiv',    shape: 'circle', cx: 66.76,  cy: 173.91, r: 10 },
  // PRESET bank LEDs as a rect
  { key: 'ps-leds',    id: 'presetled', shape: 'rect',   x: 309.6,   y: 144.4,   w: 64.6, h: 10 },
  // SHIFT toggle
  { key: 'shift-tog',  id: 'shift',     shape: 'circle', cx: 341.20, cy: 173.91, r: 10 },
  // Isolated LEDs
  { key: 'tempo-led',  id: 'tap',       shape: 'circle', cx: 66.99,  cy: 226.23, r: 9 },
  { key: 'bypass-led', id: 'bypass',    shape: 'circle', cx: 341.43, cy: 226.23, r: 9 },
  // Footswitches
  { key: 'tap-fs',     id: 'tap',       shape: 'circle', cx: 65.64,  cy: 319.23, r: 25 },
  { key: 'recall-fs',  id: 'recall',    shape: 'circle', cx: 202.86, cy: 319.23, r: 25 },
  { key: 'bypass-fs',  id: 'bypass',    shape: 'circle', cx: 340.08, cy: 319.23, r: 25 },
];

// ─── Popover content keyed by id ─────────────────────────────────────────────

const MANUAL_CONTENT = {
  delay:    { name: 'DELAY TIME',      desc: 'Base delay time. Tap tempo overrides this value — the current subdivision determines the resulting note length.', range: '20–1000 ms', cc: 'CC 20 · 14-bit hi-res' },
  depth:    { name: 'DEPTH',           desc: 'LFO modulation depth. Controls how much the delay time wobbles. At zero the LFO has no audible effect.', range: '0–255', cc: 'CC 21 · 14-bit' },
  rate:     { name: 'RATE',            desc: 'LFO speed. Low = slow subtle shimmer. High = fast vibrato warble.', range: '~0.01–10 Hz', cc: 'CC 22 · 14-bit' },
  level:    { name: 'EFFECT LEVEL',    desc: 'Wet signal level. Can be reconfigured as a true wet/dry mix in the CONFIG tab.', range: '0–255', cc: 'CC 23 · 14-bit' },
  feedback: { name: 'FEEDBACK',        desc: 'Delay regeneration. Near maximum the pedal self-oscillates. Hold TAP for 500ms to slam to max — release to restore.', range: '0–255', cc: 'CC 24 · 14-bit' },
  tilt:     { name: 'TILT',            desc: 'Spectral tilt EQ on the wet signal. Centre = flat. Turn left = darker. Turn right = brighter.', range: '0–255', cc: 'CC 25 · 14-bit' },
  subdiv:   { name: 'SUB.DIV',         desc: 'Tap tempo subdivision. Flick toggle to step one value. Hold for a group jump (+3 steps). LEDs = minim, crotchet, quaver, dotted, triplet.', range: '7 steps', cc: 'CC 26' },
  lfowave:  { name: 'LFO WAVEFORM',    desc: 'Toggle cycles through 7 LFO waveforms. LED confirms the LFO is running. Waveforms: Sine, Triangle, S-Shaped, Exponential, Smooth Rand, Skewed Tri, Trapezoid.', range: '7 waveforms', cc: 'CC 27' },
  presetled:{ name: 'PRESET BANK LEDs',desc: '4 LEDs show the active preset bank (1–4). Illuminated during preset browse mode.', range: '4 banks', cc: '' },
  shift:    { name: 'SHIFT',           desc: 'Hold SHIFT + press BYPASS to toggle True Bypass ↔ Trails bypass type.', range: '', cc: '' },
  tap:      { name: 'TAP',             desc: 'Tap tempo. Weighted average of last 4 taps. 40–400 BPM, 2s timeout. Tempo LED flashes each tap. Hold 500ms to max feedback — release restores original.', range: '', cc: 'CC 30' },
  recall:   { name: 'RECALL',          desc: 'Short press: reload current preset. Hold 2s → preset browse mode. TAP=slot A, RECALL=slot B, BYPASS=slot C. Hold RECALL+TAP/BYPASS to change bank. Hold SHIFT to save.', range: '4 banks × 3 slots', cc: 'PC 0–11' },
  bypass:   { name: 'BYPASS',          desc: 'Toggle effect on/off. Bypass LED: cyan = true bypass, magenta = trails. Double-tap in Trails to fade repeats to silence. In preset mode: loads slot C.', range: 'Active / True Bypass / Trails', cc: 'CC 28' },
};

// ─── PhManualPopover ─────────────────────────────────────────────────────────

function PhManualPopover({ content, x, y, onDismiss }) {
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onDismiss(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onDismiss]);

  const meta = [content.range, content.cc].filter(Boolean).join(' · ');

  return React.createElement('div', {
    style: {
      position: 'fixed', left: x, top: y, zIndex: 200, pointerEvents: 'none',
      background: '#1c1316', border: `1px solid ${PH.accent}`, borderRadius: 4,
      padding: '10px 14px', maxWidth: 270,
      boxShadow: '0 0 22px rgba(255,26,136,0.35)',
      fontFamily: PH.mono, fontSize: 11,
    },
  }, [
    React.createElement('div', {
      key: 'name',
      style: { color: PH.accent, fontSize: 10, letterSpacing: '0.2em', marginBottom: 5 },
    }, content.name),
    React.createElement('div', {
      key: 'desc',
      style: { color: '#f5c8d8', fontSize: 10, lineHeight: 1.55, marginBottom: meta ? 6 : 0 },
    }, content.desc),
    meta && React.createElement('div', {
      key: 'meta',
      style: { color: PH.inkMute, fontSize: 9 },
    }, meta),
  ].filter(Boolean));
}

// ─── PhManualDiagram ─────────────────────────────────────────────────────────

function PhManualDiagram() {
  const [popover, setPopover]   = React.useState(null); // { content, x, y } | null
  const [hoveredKey, setHovered] = React.useState(null);

  const handleControlClick = React.useCallback((e, ctl) => {
    e.stopPropagation();
    const content = MANUAL_CONTENT[ctl.id];
    if (!content) return;
    if (popover && popover.key === ctl.key) { setPopover(null); return; }
    const vw = window.innerWidth, vh = window.innerHeight;
    let x = e.clientX + 16, y = e.clientY + 16;
    if (x + 280 > vw) x = e.clientX - 284;
    if (y + 170 > vh) y = e.clientY - 174;
    setPopover({ key: ctl.key, content, x, y });
  }, [popover]);

  const dismiss = React.useCallback(() => setPopover(null), []);

  React.useEffect(() => {
    if (!popover) return;
    document.addEventListener('click', dismiss);
    return () => document.removeEventListener('click', dismiss);
  }, [popover, dismiss]);

  const ringStyle = (ctl) => {
    const isHovered = hoveredKey === ctl.key;
    const isActive  = popover && popover.key === ctl.key;
    const show = isHovered || isActive;
    const base = {
      fill: 'transparent',
      stroke: show ? 'rgba(255,26,136,0.8)' : 'transparent',
      strokeWidth: ctl.r >= 20 ? 4 : 3,
      cursor: 'pointer',
      transition: 'stroke 0.12s',
    };
    if (show) base.filter = 'drop-shadow(0 0 6px rgba(255,26,136,0.9))';
    return base;
  };

  return React.createElement('div', {
    style: { position: 'relative', width: '100%', maxWidth: 640, margin: '0 auto 20px' },
  }, [
    React.createElement('img', {
      key: 'img',
      src: window.RENDER_SVG_URI,
      alt: 'Art Van Delay 2 panel',
      style: { width: '100%', display: 'block', filter: 'invert(1)' },
    }),
    React.createElement('div', {
      key: 'tint',
      style: {
        position: 'absolute', inset: 0,
        background: '#ff1a88', mixBlendMode: 'multiply',
        pointerEvents: 'none',
      },
    }),
    React.createElement('svg', {
      key: 'overlay',
      viewBox: '0 0 413.1 362.46',
      xmlns: 'http://www.w3.org/2000/svg',
      style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
      onClick: (e) => e.stopPropagation(),
    },
      MANUAL_CONTROLS.map((ctl) => {
        const props = {
          key: ctl.key,
          style: ringStyle(ctl),
          onMouseEnter: () => setHovered(ctl.key),
          onMouseLeave: () => setHovered(null),
          onClick: (e) => handleControlClick(e, ctl),
        };
        if (ctl.shape === 'rect') {
          return React.createElement('rect', {
            ...props, x: ctl.x, y: ctl.y, width: ctl.w, height: ctl.h, rx: 2,
          });
        }
        return React.createElement('circle', {
          ...props, cx: ctl.cx, cy: ctl.cy, r: ctl.r,
        });
      })
    ),
    popover && React.createElement(PhManualPopover, {
      key: 'popover',
      content: popover.content,
      x: popover.x,
      y: popover.y,
      onDismiss: dismiss,
    }),
  ]);
}

// ─── Section components ───────────────────────────────────────────────────────

function row(label, value) {
  return React.createElement('div', {
    key: label,
    style: {
      display: 'grid', gridTemplateColumns: '160px 1fr', gap: 12,
      padding: '7px 0', borderBottom: `1px dashed ${PH.rule}`,
      fontFamily: PH.mono, fontSize: 12,
    },
  }, [
    React.createElement('span', { key: 'l', style: { color: PH.inkMute } }, label),
    React.createElement('span', { key: 'v', style: { color: PH.accent } }, value),
  ]);
}

function prose(text) {
  return React.createElement('p', {
    style: { fontFamily: PH.sans, fontSize: 13, color: PH.inkDim, lineHeight: 1.7, margin: '0 0 10px' },
  }, text);
}

function sectionLabel(text) {
  return React.createElement('div', {
    style: {
      fontFamily: PH.mono, fontSize: 9, letterSpacing: '0.24em',
      textTransform: 'uppercase', color: PH.inkMute, marginTop: 14, marginBottom: 6,
    },
  }, text);
}

function noteBox(text) {
  return React.createElement('div', {
    style: {
      marginTop: 10, padding: '8px 12px',
      border: `1px dashed ${PH.rule}`,
      fontFamily: PH.mono, fontSize: 11, color: PH.inkDim, lineHeight: 1.7,
    },
  }, [
    React.createElement('span', { key: 's', style: { color: PH.accent } }, '▸ '),
    text,
  ]);
}

function PhManualSectionQuickStart() {
  return React.createElement(PhPanel, { title: 'Quick Start' }, [
    React.createElement('ol', {
      key: 'list',
      style: { fontFamily: PH.sans, fontSize: 13, color: PH.inkDim, lineHeight: 1.9, margin: 0, paddingLeft: 20 },
    }, [
      React.createElement('li', { key: '1' }, 'Connect the pedal via USB-C and click CONNECT in the header.'),
      React.createElement('li', { key: '2' }, 'Set DELAY TIME and FEEDBACK to taste — noon on both is a good starting point.'),
      React.createElement('li', { key: '3' }, 'Tap the TAP footswitch in time with your playing to sync delay tempo, then tweak DEPTH and RATE for modulation.'),
    ]),
  ]);
}

function PhManualSectionKnobs() {
  const knobs = [
    ['DELAY TIME', '20–1000 ms', 'CC 20', 'Base echo length. Tap tempo overrides this; subdivision scales it to a musical note value.'],
    ['DEPTH',      '0–255',      'CC 21', 'LFO modulation depth. At zero the LFO is silent; at max it adds 25 cents of delay-time wobble.'],
    ['RATE',       '0–255',      'CC 22', 'LFO speed (approx 0.01–10 Hz). Low values give chorus shimmer; high values give vibrato.'],
    ['EFFECT LEVEL','0–255',     'CC 23', 'Wet signal level. Can be switched to a true wet/dry mix in the CONFIG tab.'],
    ['FEEDBACK',   '0–255',      'CC 24', 'Repeat regeneration. Near maximum the pedal self-oscillates. Hold TAP 500ms to slam to 255 — release to restore.'],
    ['TILT',       '0–255',      'CC 25', 'Spectral tilt EQ on the wet signal. Centre = flat. Left = darker repeats. Right = brighter repeats.'],
  ];
  return React.createElement(PhPanel, { title: 'Knobs' },
    knobs.map(([name, range, cc, desc]) =>
      React.createElement('div', {
        key: name,
        style: { padding: '10px 0', borderBottom: `1px dashed ${PH.rule}` },
      }, [
        React.createElement('div', {
          key: 'h',
          style: { display: 'flex', justifyContent: 'space-between', marginBottom: 4 },
        }, [
          React.createElement('span', { key: 'n', style: { fontFamily: PH.mono, fontSize: 11, color: PH.accent, letterSpacing: '0.12em' } }, name),
          React.createElement('span', { key: 'm', style: { fontFamily: PH.mono, fontSize: 10, color: PH.inkMute } }, `${range} · ${cc}`),
        ]),
        React.createElement('div', { key: 'd', style: { fontFamily: PH.sans, fontSize: 12, color: PH.inkDim, lineHeight: 1.6 } }, desc),
      ])
    )
  );
}

function PhManualSectionLFO() {
  const waveforms = [
    ['Sine',        'Smooth, rounded oscillation. Classic chorus/vibrato.'],
    ['Triangle',    'Linear ramp up and down. Slightly edgier than sine.'],
    ['S-Shaped',    'Sigmoid curve. Smooth transitions, between sine and triangle.'],
    ['Exponential', 'Fast attack, slow decay. Sweeps quickly then gradually returns.'],
    ['Smooth Rand', 'Randomly-stepped values with smooth interpolation. Organic, unpredictable.'],
    ['Skewed Tri',  'Asymmetric triangle — faster rising edge, slower fall.'],
    ['Trapezoid',   'Flat top and bottom with sharp transitions. Hard, gated sweep.'],
  ];
  return React.createElement(PhPanel, { title: 'LFO · Waveforms' }, [
    prose('The LFO modulates delay time, creating chorus-like sweeps at low depth/rate or vibrato at high settings. Toggle through waveforms with the LFO buttons. The LED confirms the LFO is running.'),
    ...waveforms.map(([name, desc]) => React.createElement('div', {
      key: name,
      style: { display: 'grid', gridTemplateColumns: '140px 1fr', gap: 12, padding: '6px 0', borderBottom: `1px dashed ${PH.rule}`, fontFamily: PH.mono, fontSize: 12 },
    }, [
      React.createElement('span', { key: 'n', style: { color: PH.accent } }, name),
      React.createElement('span', { key: 'd', style: { color: PH.inkDim, fontFamily: PH.sans, fontSize: 12 } }, desc),
    ])),
  ]);
}

function PhManualSectionSubdiv() {
  const values = [
    ['♩', 'Minim',           '1/2',  'Two beats per tap'],
    ['♩', 'Crotchet',        '1/4',  'One beat per tap'],
    ['♪', 'Quaver',          '1/8',  'Half a beat per tap'],
    ['•', 'Dotted quaver',   '1/6',  'Dotted rhythm'],
    ['3', 'Triplet crotchet','1/3',  'Triplet feel'],
  ];
  return React.createElement(PhPanel, { title: 'Subdivision' }, [
    prose('Divides the tapped tempo period into smaller note values. The 5 LEDs indicate the current subdivision.'),
    sectionLabel('Toggle gestures'),
    noteBox('Flick toggle — step one value. Hold toggle — jump three values at once.'),
    sectionLabel('Values'),
    React.createElement('table', {
      key: 'tbl',
      style: { width: '100%', borderCollapse: 'collapse', fontFamily: PH.mono, fontSize: 12, marginTop: 6 },
    }, [
      React.createElement('thead', { key: 'th' },
        React.createElement('tr', null,
          ['LED symbol','Name','Value','Character'].map(h =>
            React.createElement('th', {
              key: h,
              style: { textAlign: 'left', color: PH.inkMute, fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', padding: '4px 8px', borderBottom: `1px solid ${PH.ruleStrong}` },
            }, h)
          )
        )
      ),
      React.createElement('tbody', { key: 'tb' },
        values.map(([sym, name, val, char]) =>
          React.createElement('tr', { key: name }, [
            React.createElement('td', { key: 's', style: { padding: '5px 8px', borderBottom: `1px dotted ${PH.rule}`, color: PH.accent, fontSize: 14, fontFamily: 'serif' } }, sym),
            React.createElement('td', { key: 'n', style: { padding: '5px 8px', borderBottom: `1px dotted ${PH.rule}`, color: PH.ink } }, name),
            React.createElement('td', { key: 'v', style: { padding: '5px 8px', borderBottom: `1px dotted ${PH.rule}`, color: PH.accent } }, val),
            React.createElement('td', { key: 'c', style: { padding: '5px 8px', borderBottom: `1px dotted ${PH.rule}`, color: PH.inkDim, fontFamily: PH.sans, fontSize: 12 } }, char),
          ])
        )
      ),
    ]),
  ]);
}

function PhManualSectionBypass() {
  return React.createElement(PhPanel, { title: 'Bypass Modes' }, [
    React.createElement('div', { key: 'rows' }, [
      row('Active',       'Effect is engaged. Wet signal mixes with dry.'),
      row('True Bypass',  'Relay physically disconnects the effect. LED → cyan.'),
      row('Trails',       'Bypass engaged but wet signal decays naturally. LED → magenta.'),
    ]),
    sectionLabel('Switching modes'),
    noteBox('Hold SHIFT R + press BYPASS to toggle between True Bypass and Trails.'),
    sectionLabel('Trails fade'),
    noteBox('In Trails mode, double-tap BYPASS to fade the feedback to silence without re-engaging the effect.'),
  ]);
}

function PhManualSectionTapTempo() {
  return React.createElement(PhPanel, { title: 'Tap Tempo · Feedback Hold' }, [
    sectionLabel('Tap tempo'),
    row('Method',    'Tap the TAP footswitch in rhythm. Pedal averages last 4 taps.'),
    row('Weighting', 'Most recent tap counts most.'),
    row('Range',     '40–400 BPM. 2-second pause resets the sequence.'),
    row('LED',       'Tempo LED flashes on each registered tap.'),
    row('Subdivision','Active subdivision is applied to the tapped period.'),
    sectionLabel('Feedback hold'),
    noteBox('Hold TAP for 500ms → feedback slams to 255. Release → feedback returns to its original value. Use to trigger a bloom of cascading echoes on demand.'),
  ]);
}

function PhManualSectionPresets() {
  return React.createElement(PhPanel, { title: 'Preset System' }, [
    prose('12 presets across 4 banks of 3 slots (A, B, C). The 4 PRESET LEDs show the active bank.'),
    sectionLabel('Loading a preset'),
    noteBox('Short-press RECALL to reload the current active preset into the live buffer.'),
    noteBox('Hold RECALL 2s → enter browse mode. TAP = slot A · RECALL = slot B · BYPASS = slot C. Hold RECALL + TAP to go bank down, RECALL + BYPASS to go bank up.'),
    sectionLabel('Saving a preset'),
    noteBox('In browse mode: navigate to your target slot, then hold SHIFT L for 1 second to commit the current live state.'),
    sectionLabel('Bank LEDs'),
    row('4 LEDs', 'One per bank. Active bank LED lights during browse mode.'),
  ]);
}

function PhManualSectionExpression() {
  return React.createElement(PhPanel, { title: 'Expression Pedal' }, [
    prose('Connect a TRS expression pedal to the EXPR/TAP jack. Configure in the CONFIG tab.'),
    sectionLabel('CONFIG tab settings'),
    row('expression_enabled',    'Enable or disable expression input.'),
    row('expression_assignment', 'Which parameter the pedal controls.'),
    row('expression_curve',      'Response shape: Linear, Logarithmic, or Exponential.'),
    row('expression_auto_assign','When on, the last-tweaked parameter is auto-assigned.'),
    row('calibration_min/max',   'Set to match your pedal\'s physical travel range (0–4095).'),
    noteBox('COMMIT in the CONFIG tab sends changes to the pedal and stores them in config.'),
  ]);
}

function PhManualSectionMIDI() {
  const ccs = [
    ['CC 20', 'Delay Time',   '14-bit (+ CC 52 for LSB)'],
    ['CC 21', 'Depth',        '14-bit (+ CC 53)'],
    ['CC 22', 'Rate',         '14-bit (+ CC 54)'],
    ['CC 23', 'Effect Level', '14-bit (+ CC 55)'],
    ['CC 24', 'Feedback',     '14-bit (+ CC 56)'],
    ['CC 25', 'Tilt',         '14-bit (+ CC 57)'],
    ['CC 26', 'Subdivision',  '7-bit enum'],
    ['CC 27', 'LFO Waveform', '7-bit enum'],
    ['CC 28', 'Bypass',       '<64 = active, ≥64 = bypass'],
    ['CC 30', 'Tap',          '≥64 triggers a tap'],
    ['CC 31', 'Bypass type',  '<64 = true, ≥64 = trails'],
    ['PC 0–11','Preset load', 'Program Change loads slot'],
  ];
  return React.createElement(PhPanel, { title: 'MIDI · Channel 1' }, [
    prose('All parameters respond to MIDI on channel 1. Continuous parameters support 14-bit resolution — send the MSB CC first, then the LSB CC. 7-bit operation is backward-compatible.'),
    React.createElement('table', {
      key: 'tbl',
      style: { width: '100%', borderCollapse: 'collapse', fontFamily: PH.mono, fontSize: 12, marginTop: 8 },
    }, [
      React.createElement('thead', { key: 'th' },
        React.createElement('tr', null,
          ['Message', 'Parameter', 'Notes'].map(h =>
            React.createElement('th', {
              key: h,
              style: { textAlign: 'left', color: PH.inkMute, fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', padding: '4px 8px', borderBottom: `1px solid ${PH.ruleStrong}` },
            }, h)
          )
        )
      ),
      React.createElement('tbody', { key: 'tb' },
        ccs.map(([msg, param, notes]) =>
          React.createElement('tr', { key: msg }, [
            React.createElement('td', { key: 'm', style: { padding: '5px 8px', borderBottom: `1px dotted ${PH.rule}`, color: PH.warn } }, msg),
            React.createElement('td', { key: 'p', style: { padding: '5px 8px', borderBottom: `1px dotted ${PH.rule}`, color: PH.ink } }, param),
            React.createElement('td', { key: 'n', style: { padding: '5px 8px', borderBottom: `1px dotted ${PH.rule}`, color: PH.inkDim } }, notes),
          ])
        )
      ),
    ]),
    noteBox('See the MIDI REF tab for the full CC map including 14-bit LSB pairs and enum value tables.'),
  ]);
}

function PhManualSectionConnections() {
  const jacks = [
    ['DC',           'Power input. Rectangular connector — sits flush with the enclosure.'],
    ['MIDI OUT/THRU','3.5mm TRS MIDI output or thru. Type A wiring.'],
    ['MIDI IN',      '3.5mm TRS MIDI input. Type A wiring.'],
    ['EXPR/TAP',     'TRS: expression pedal input or external tap footswitch.'],
    ['OUTPUT',       'Main audio output (TS).'],
    ['INPUT',        'Main audio input (TS).'],
  ];
  return React.createElement(PhPanel, { title: 'Connections · side panel left to right' },
    jacks.map(([name, desc]) =>
      React.createElement('div', {
        key: name,
        style: { display: 'grid', gridTemplateColumns: '160px 1fr', gap: 12, padding: '7px 0', borderBottom: `1px dashed ${PH.rule}`, fontFamily: PH.mono, fontSize: 12 },
      }, [
        React.createElement('span', { key: 'n', style: { color: PH.accent } }, name),
        React.createElement('span', { key: 'd', style: { color: PH.inkDim, fontFamily: PH.sans, fontSize: 12 } }, desc),
      ])
    )
  );
}

// ─── PhManual root ────────────────────────────────────────────────────────────

function PhManual() {
  return React.createElement('div', null, [
    React.createElement(PhManualDiagram, { key: 'diagram' }),
    React.createElement('div', {
      key: 'sections',
      style: { display: 'grid', gap: 18 },
    }, [
      React.createElement(PhManualSectionQuickStart,  { key: 'qs'   }),
      React.createElement(PhManualSectionKnobs,       { key: 'knob' }),
      React.createElement(PhManualSectionLFO,         { key: 'lfo'  }),
      React.createElement(PhManualSectionSubdiv,      { key: 'sub'  }),
      React.createElement(PhManualSectionBypass,      { key: 'bp'   }),
      React.createElement(PhManualSectionTapTempo,    { key: 'tap'  }),
      React.createElement(PhManualSectionPresets,     { key: 'pre'  }),
      React.createElement(PhManualSectionExpression,  { key: 'expr' }),
      React.createElement(PhManualSectionMIDI,        { key: 'midi' }),
      React.createElement(PhManualSectionConnections, { key: 'conn' }),
    ]),
  ]);
}

Object.assign(window, { PhManual });
