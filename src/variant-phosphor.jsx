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

function PhTab({ tab, setTab }) {
  const tabs = [["live","LIVE"],["presets","PRESETS"],["config","CONFIG"],["firmware","FIRMWARE"],["console","CONSOLE"]];
  return (
    <div style={{ display: "flex", borderBottom: `1px solid ${PH.rule}` }}>
      {tabs.map(([k,l])=>{
        const active = tab===k;
        return (
          <button key={k} onClick={()=>setTab(k)}
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


function PhPedal({ preset, onChange }) {
  // Wireframe / schematic-style pedal rendering
  const knobs = [
    { key: "delay_time_ms", label: "DELAY", max: 1200 },
    { key: "lfo_depth", label: "DEPTH", max: 255 },
    { key: "lfo_rate", label: "RATE", max: 255 },
    { key: "effect_level", label: "MIX", max: 255 },
    { key: "feedback", label: "FEEDBACK", max: 255 },
    { key: "tilt", label: "TILT", max: 255 },
  ];
  const set = (k,v) => onChange && onChange({ ...preset, [k]: Math.round(v) });
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
        {knobs.slice(0,3).map(k => <PhKnob key={k.key} value={preset[k.key]} max={k.max} label={k.label}
          onChange={(v)=>set(k.key,v)} />)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 22 }}>
        {knobs.slice(3,6).map(k => <PhKnob key={k.key} value={preset[k.key]} max={k.max} label={k.label}
          onChange={(v)=>set(k.key,v)} />)}
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

function PhKnob({ value, max, label, onChange }) {
  const frac = value / max;
  const angle = -135 + frac * 270;
  const dragRef = React.useRef(null);

  const onWheel = (e) => {
    if (!onChange) return;
    e.preventDefault();
    onChange(Math.max(0, Math.min(max, value - Math.sign(e.deltaY) * (max / 80))));
  };

  const onMouseDown = (e) => {
    if (!onChange) return;
    e.preventDefault();
    dragRef.current = { startY: e.clientY, startVal: value };
    const onMove = (ev) => {
      if (!dragRef.current) return;
      const delta = dragRef.current.startY - ev.clientY;
      onChange(Math.max(0, Math.min(max, dragRef.current.startVal + delta * (max / 200))));
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div onWheel={onWheel} onMouseDown={onMouseDown}
        style={{ width: 58, height: 58, borderRadius: 29, position: "relative",
          background: "#0d0a0d", border: `1.5px solid ${PH.accentDim}`,
          boxShadow: `0 0 12px rgba(255,26,136,0.15), inset 0 0 12px rgba(255,26,136,0.08)`,
          cursor: onChange ? "ns-resize" : "default", userSelect: "none" }}>
        <div style={{ position: "absolute", top: 4, left: "50%", width: 2, height: 14,
          marginLeft: -1, background: PH.accent, boxShadow: `0 0 8px ${PH.accent}`,
          transform: `rotate(${angle}deg)`, transformOrigin: "center 25px" }} />
      </div>
      <div style={{ fontSize: 9, letterSpacing: "0.26em", color: PH.inkDim }}>{label}</div>
      <div style={{ fontFamily: PH.mono, fontSize: 10, color: PH.accent }}>{Math.round(value)}</div>
    </div>
  );
}

function PhPedalSelect({ label, options, value, onChange }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ fontSize: 9, letterSpacing: "0.26em", color: PH.inkDim }}>{label}</div>
      <select value={value} onChange={(e)=>onChange(Number(e.target.value))}
        style={{ background: "#0d0a0d", border: `1px solid ${PH.accentDim}`, color: PH.accent,
          fontFamily: PH.mono, fontSize: 11, padding: "8px 10px", letterSpacing: "0.1em" }}>
        {options.map((o,i)=><option key={i} value={i}>{o}</option>)}
      </select>
    </div>
  );
}

function PhLive({ live, setLive }) {
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
            {[["delay_time_ms","DLY",1200],["lfo_rate","RATE",255],["lfo_depth","DEPTH",255],
              ["feedback","FB",255],["effect_level","MIX",255],["tilt","TILT",255]].map(([k,l,mx])=>(
              <PhKnob key={k} value={live[k]} max={mx} label={l}
                onChange={(v)=>setLive(L => ({...L, [k]: Math.round(v)}))} />
            ))}
          </div>
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px dashed ${PH.rule}` }}>
            <PhPedalSelect label="WAVE" options={WAVEFORM_LABELS}
              value={live.lfo_waveform} onChange={(v) => setLive(L => ({ ...L, lfo_waveform: v }))} />
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
        {log.map(([t,type,msg],i)=>(
          <div key={i} style={{ display: "grid", gridTemplateColumns: "78px 48px 1fr", gap: 10 }}>
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
  PhLive, PhConsole,
});
