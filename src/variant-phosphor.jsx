// Magenta CRT oscilloscope studio, instrument cluster.
// Dense readouts, lots of mono, single accent (phosphor magenta).

const PH = {
  bg: "#0d0a0b",
  bgAlt: "#130e10",
  panel: "#160f12",
  panelHi: "#1c1316",
  ink: "#f5c8d8",
  inkDim: "#b07880",
  inkMute: "#6a4850",
  rule: "rgba(255,26,136,0.1)",
  ruleStrong: "rgba(255,26,136,0.22)",
  accent: "#ff1a88",
  accentDim: "#c01060",
  accentMute: "rgba(255,26,136,0.1)",
  warn: "#ffc46a",
  danger: "#ff6a7a",
  mono: '"JetBrains Mono", ui-monospace, Consolas, monospace',
  sans: '"Inter", system-ui, sans-serif',
  serif: '"CooperBlack", "Cooper Std Black", "DM Serif Display", serif',
};

function PhPanel({ children, style, title, rightMeta }) {
  return (
    <div style={{ position: "relative", background: PH.panel, border: `1px solid ${PH.rule}`,
      borderRadius: 4, ...style }}>
      {title && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 14px", borderBottom: `1px solid ${PH.rule}`,
          fontFamily: PH.mono, fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase" }}>
          <div style={{ color: PH.accent }}>{title}</div>
          {rightMeta && <div style={{ color: PH.inkMute }}>{rightMeta}</div>}
        </div>
      )}
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  );
}
PhPanel = React.memo(PhPanel);

const PH_TAB_ID = (k) => `tab-${k}`;
const PH_PANEL_ID = (k) => `tabpanel-${k}`;

function PhTab({ tab, setTab }) {
  const tabs = [["live","LIVE"],["presets","PRESETS"],["config","CONFIG"],["firmware","FIRMWARE"],["console","CONSOLE"]];
  const tablistRef = React.useRef(null);

  const move = (nextKey) => {
    setTab(nextKey);
    requestAnimationFrame(() => {
      const btn = tablistRef.current?.querySelector(`#${PH_TAB_ID(nextKey)}`);
      if (btn) btn.focus();
    });
  };

  const onKeyDown = (e) => {
    const i = tabs.findIndex(([k]) => k === tab);
    if (i < 0) return;
    let next = -1;
    if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    if (next < 0) return;
    e.preventDefault();
    move(tabs[next][0]);
  };

  return (
    <div role="tablist" aria-label="Editor sections" ref={tablistRef}
      style={{ display: "flex", borderBottom: `1px solid ${PH.rule}` }}>
      {tabs.map(([k,l])=>{
        const active = tab===k;
        return (
          <button key={k}
            id={PH_TAB_ID(k)}
            role="tab"
            aria-selected={active}
            aria-controls={PH_PANEL_ID(k)}
            tabIndex={active ? 0 : -1}
            onClick={()=>setTab(k)}
            onKeyDown={onKeyDown}
            className="avd-tab"
            style={{ border: "none", background: "transparent", padding: "14px 22px",
              color: active ? PH.accent : PH.inkDim, fontFamily: PH.mono, fontSize: 12,
              letterSpacing: "0.24em", fontWeight: 600, cursor: "pointer",
              borderBottom: active ? `2px solid ${PH.accent}` : "2px solid transparent",
              marginBottom: -1 }}>{l}</button>
        );
      })}
    </div>
  );
}

function PhReadout({ label, value, unit, tone }) {
  return (
    <div style={{ padding: "10px 12px", borderLeft: `2px solid ${tone || PH.accentDim}`,
      background: PH.bgAlt }}>
      <div style={{ fontFamily: PH.mono, fontSize: 9, letterSpacing: "0.22em",
        color: PH.inkMute, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontFamily: PH.mono, fontSize: 18, color: tone || PH.accent, marginTop: 4,
        textShadow: `0 0 10px ${tone || "rgba(255,26,136,0.5)"}` }}>
        {value}{unit && <span style={{ fontSize: 11, color: PH.inkDim, marginLeft: 3 }}>{unit}</span>}
      </div>
    </div>
  );
}
PhReadout = React.memo(PhReadout);


function PhPedal({ preset, onChange }) {
  const knobs = PARAM_CATALOG.filter((p) => p.kind !== "enum");
  const set = (k, v) => onChange && onChange({ ...preset, [k]: v });
  return (
    <div style={{ width: 380, border: `1px solid ${PH.ruleStrong}`, borderRadius: 6, padding: 24,
      background: "repeating-linear-gradient(90deg, transparent 0, transparent 19px, rgba(255,26,136,0.03) 19px, rgba(255,26,136,0.03) 20px), repeating-linear-gradient(0deg, transparent 0, transparent 19px, rgba(255,26,136,0.03) 19px, rgba(255,26,136,0.03) 20px), #140c14",
      fontFamily: PH.mono }}>
      <div style={{ textAlign: "center", marginBottom: 22 }}>
        <div style={{ fontSize: 9, letterSpacing: "0.4em", color: PH.inkMute }}>BONDI EFFECTS — SCHEMATIC</div>
        <div style={{ fontFamily: PH.serif, fontSize: 28, color: PH.accent, marginTop: 6,
          textShadow: "0 0 14px rgba(255,26,136,0.4)" }}>Art Van Delay 2</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 18 }}>
        {knobs.slice(0,3).map(p => <PhKnob key={p.key} value={preset[p.key]} max={p.max} label={p.shortLabel}
          onChange={(v) => set(p.key, v)} />)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 22 }}>
        {knobs.slice(3,6).map(p => <PhKnob key={p.key} value={preset[p.key]} max={p.max} label={p.shortLabel}
          onChange={(v) => set(p.key, v)} />)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <PhPedalSelect label="WAVE" options={WAVEFORM_LABELS}
          value={preset.lfo_waveform} onChange={(v)=>set("lfo_waveform",v)} />
        <PhPedalSelect label="SUBDIV" options={["1/1","1/2","1/3","1/4","1/6","1/8","1/16"]}
          value={preset.subdivision} onChange={(v)=>set("subdivision",v)} />
      </div>
      <div style={{ marginTop: 24, paddingTop: 18, borderTop: `1px dashed ${PH.rule}`,
        display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 9, letterSpacing: "0.28em", color: PH.inkMute }}>▸ IN</div>
        <div style={{ width: 44, height: 44, borderRadius: 22, border: `2px solid ${PH.accent}`,
          background: "radial-gradient(circle at 35% 30%, rgba(255,26,136,0.3), transparent 60%)",
          boxShadow: "0 0 18px rgba(255,26,136,0.25), inset 0 0 12px rgba(255,26,136,0.3)" }} />
        <div style={{ fontSize: 9, letterSpacing: "0.28em", color: PH.inkMute }}>OUT ▸</div>
      </div>
    </div>
  );
}

function PhKnob({ value, max, label, onChange, step = 1 }) {
  const knobRef = React.useRef(null);
  const stateRef = React.useRef(null);
  const frac = value / max;
  const angle = -135 + frac * 270;
  const dragRef = React.useRef(null);
  const interactive = !!onChange;
  const clamp = (v) => Math.max(0, Math.min(max, v));
  const set = (v) => onChange && onChange(Math.round(clamp(v) / step) * step);
  stateRef.current = { value, max, set };

  // React registers onWheel as passive; use a direct listener so preventDefault works.
  React.useEffect(() => {
    const el = knobRef.current;
    if (!el || !interactive) return;
    const handler = (e) => {
      e.preventDefault();
      const { value, max, set } = stateRef.current;
      set(value - Math.sign(e.deltaY) * (max / 80));
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [interactive]);

  const onPointerDown = (e) => {
    if (!interactive) return;
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    dragRef.current = { startY: e.clientY, startVal: value, pointerId: e.pointerId };
  };

  const onPointerMove = (e) => {
    if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return;
    const delta = dragRef.current.startY - e.clientY;
    set(dragRef.current.startVal + delta * (max / 200));
  };

  const onPointerUp = (e) => {
    if (!dragRef.current) return;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    dragRef.current = null;
  };

  const onKeyDown = (e) => {
    if (!interactive) return;
    const fine = max / 100;
    const coarse = max / 10;
    switch (e.key) {
      case "ArrowUp":
      case "ArrowRight": e.preventDefault(); set(value + fine); break;
      case "ArrowDown":
      case "ArrowLeft":  e.preventDefault(); set(value - fine); break;
      case "PageUp":     e.preventDefault(); set(value + coarse); break;
      case "PageDown":   e.preventDefault(); set(value - coarse); break;
      case "Home":       e.preventDefault(); set(0); break;
      case "End":        e.preventDefault(); set(max); break;
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div
        ref={knobRef}
        className="avd-knob"
        role={interactive ? "slider" : undefined}
        tabIndex={interactive ? 0 : -1}
        aria-label={interactive ? label : undefined}
        aria-valuemin={interactive ? 0 : undefined}
        aria-valuemax={interactive ? max : undefined}
        aria-valuenow={interactive ? Math.round(value) : undefined}
        aria-orientation="vertical"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        style={{ width: 58, height: 58, borderRadius: 29, position: "relative",
          background: "#0d0a0d", border: `1.5px solid ${PH.accentDim}`,
          boxShadow: `0 0 12px rgba(255,26,136,0.15), inset 0 0 12px rgba(255,26,136,0.08)`,
          cursor: interactive ? "ns-resize" : "default",
          userSelect: "none", touchAction: "none" }}>
        <div style={{ position: "absolute", top: 4, left: "50%", width: 2, height: 14,
          marginLeft: -1, background: PH.accent, boxShadow: `0 0 8px ${PH.accent}`,
          transform: `rotate(${angle}deg)`, transformOrigin: "center 25px" }} />
      </div>
      <div style={{ fontSize: 9, letterSpacing: "0.26em", color: PH.inkDim }}>{label}</div>
      <div style={{ fontFamily: PH.mono, fontSize: 10, color: PH.accent }}>{Math.round(value)}</div>
    </div>
  );
}
PhKnob = React.memo(PhKnob);

function PhPedalSelect({ label, options, value, onChange }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ fontSize: 9, letterSpacing: "0.26em", color: PH.inkDim }}>{label}</div>
      <select value={value} onChange={(e) => onChange && onChange(Number(e.target.value))}
        aria-label={label}
        style={{ background: "#0d0a0d", border: `1px solid ${PH.accentDim}`, color: PH.accent,
          fontFamily: PH.mono, fontSize: 11, padding: "8px 10px", letterSpacing: "0.1em" }}>
        {options.map((o,i)=><option key={i} value={i}>{o}</option>)}
      </select>
    </div>
  );
}

function PhLive({ live, setLive, connected }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 18 }}>
      <div style={{ display: "grid", gap: 18 }}>
        <PhPanel title="LFO · Oscilloscope" rightMeta={`${WAVEFORM_LABELS[live.lfo_waveform]} · ${lfoRateParamToHz(live.lfo_rate).toFixed(2)} Hz`}>
          <LfoScope waveformId={live.lfo_waveform} rate={live.lfo_rate} depth={live.lfo_depth}
            width={780} height={280} skin="phosphor" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8, marginTop: 14 }}>
            <PhReadout label="Waveform" value={WAVEFORM_LABELS[live.lfo_waveform]} />
            <PhReadout label="Rate" value={lfoRateParamToHz(live.lfo_rate).toFixed(2)} unit="Hz" />
            <PhReadout label="Depth" value={lfoDepthParamToCents(live.lfo_depth).toFixed(1)} unit="ct" />
            <PhReadout label="Rate Param" value={live.lfo_rate} />
            <PhReadout label="Depth Param" value={live.lfo_depth} />
          </div>
        </PhPanel>
        <PhPanel title="Parameter Bus · real time" rightMeta="◉ LIVE">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
            <PhReadout label="Delay" value={live.delay_time_ms} unit="ms" />
            <PhReadout label="Feedback" value={live.feedback} />
            <PhReadout label="Effect Lvl" value={live.effect_level} />
            <PhReadout label="Tilt" value={live.tilt} />
            <PhReadout label="Subdiv" value={["1/1","1/2","1/3","1/4","1/6","1/8","1/16"][live.subdivision]} />
            <PhReadout label="Expression" value={live.expression} />
            <PhReadout label="Bypass" value={live.bypass_state ? "ACTIVE" : "BYPASS"}
              tone={live.bypass_state ? PH.accent : PH.warn} />
            <PhReadout label="Active Preset" value={String(live.active_preset).padStart(2,"0")} />
          </div>
        </PhPanel>
      </div>
      <div style={{ display: "grid", gap: 18, alignContent: "start" }}>
        <PhPanel title="Bus Status">
          <div style={{ fontFamily: PH.mono, fontSize: 11, lineHeight: 2, color: PH.inkDim }}>
            <div><span style={{ color: PH.accent }}>▸</span> poll rate ……… <span style={{ color: PH.ink }}>2 Hz</span></div>
            <div><span style={{ color: PH.accent }}>▸</span> transport …… <span style={{ color: PH.ink }}>USB MIDI</span></div>
            <div><span style={{ color: PH.accent }}>▸</span> tx latency …… <span style={{ color: PH.ink }}>14 ms</span></div>
            <div><span style={{ color: PH.accent }}>▸</span> dropped ……… <span style={{ color: PH.ink }}>0</span></div>
            <div><span style={{ color: PH.accent }}>▸</span> preset dirty … <span style={{ color: live.preset_dirty ? PH.warn : PH.ink }}>
              {live.preset_dirty ? "TRUE" : "FALSE"}</span></div>
          </div>
        </PhPanel>
        <PhPanel title="Quick Trim">
          {connected && (
            <div style={{ fontFamily: PH.mono, fontSize: 9, color: PH.inkMute,
              letterSpacing: "0.16em", marginBottom: 10 }}>
              PHYSICAL KNOBS ONLY — POLL OVERWRITES UI CHANGES
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
            {PARAM_CATALOG.filter((p) => p.kind !== "enum").map((p) => (
              <PhKnob key={p.key} value={live[p.key]} max={p.max} label={p.shortLabel}
                onChange={connected ? null : (v) => setLive(L => ({ ...L, [p.key]: v }))} />
            ))}
          </div>
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px dashed ${PH.rule}` }}>
            <PhPedalSelect label="WAVE" options={WAVEFORM_LABELS}
              value={live.lfo_waveform}
              onChange={connected ? null : (v) => setLive(L => ({ ...L, lfo_waveform: v }))} />
          </div>
        </PhPanel>
      </div>
    </div>
  );
}


function PhConsole({ log }) {
  return (
    <PhPanel title="MIDI Traffic · JSON Shell" rightMeta="SysEx · RX/TX">
      <div style={{ background: "#050805", border: `1px solid ${PH.rule}`, padding: 16,
        fontFamily: PH.mono, fontSize: 12, lineHeight: 1.9, maxHeight: 520, overflowY: "auto" }}
        className="avd-scroll">
        {log.map(([id,t,type,msg])=>(
          <div key={id} style={{ display: "grid", gridTemplateColumns: "78px 48px 1fr", gap: 10 }}>
            <span style={{ color: PH.inkMute }}>{t}</span>
            <span style={{ color: type==="TX"? PH.warn : type==="RX"? PH.accent
              : type==="INFO"? PH.ink : PH.danger }}>{type}</span>
            <span style={{ color: PH.inkDim }}>{msg}</span>
          </div>
        ))}
      </div>
    </PhPanel>
  );
}


Object.assign(window, {
  PH, PhPanel, PhTab, PhReadout, PhPedal, PhKnob, PhPedalSelect,
  PhLive, PhConsole, PH_TAB_ID, PH_PANEL_ID,
});
