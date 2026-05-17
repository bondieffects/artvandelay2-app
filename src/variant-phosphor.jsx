// Green CRT oscilloscope studio, instrument cluster.
// Dense readouts, lots of mono, single accent (phosphor green).

const PH = {
  bg: "#0a0d0a",
  bgAlt: "#0e120e",
  panel: "#0f1511",
  panelHi: "#131a14",
  ink: "#c7e8c7",
  inkDim: "#7aa37a",
  inkMute: "#4a6a4a",
  rule: "rgba(124,255,158,0.1)",
  ruleStrong: "rgba(124,255,158,0.22)",
  accent: "#7cff9e",
  accentDim: "#3da659",
  accentMute: "rgba(124,255,158,0.1)",
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
        textShadow: `0 0 10px ${tone || "rgba(124,255,158,0.5)"}` }}>
        {value}{unit && <span style={{ fontSize: 11, color: PH.inkDim, marginLeft: 3 }}>{unit}</span>}
      </div>
    </div>
  );
}

function PhHeader({ connected, onToggle }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "16px 24px", borderBottom: `1px solid ${PH.rule}`, background: PH.bgAlt }}>
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <div style={{ width: 10, height: 10, borderRadius: 5, background: connected ? PH.accent : PH.danger,
          boxShadow: `0 0 10px ${connected ? PH.accent : PH.danger}` }} />
        <div>
          <div style={{ fontFamily: PH.mono, fontSize: 10, letterSpacing: "0.3em",
            color: PH.inkMute, textTransform: "uppercase" }}>Bondi Effects</div>
          <div style={{ fontFamily: PH.serif, fontSize: 26, color: PH.accent, lineHeight: 1, marginTop: 4,
            textShadow: "0 0 18px rgba(124,255,158,0.35)" }}>Art Van Delay 2</div>
        </div>
        <div style={{ fontFamily: PH.mono, fontSize: 10, color: PH.inkMute, letterSpacing: "0.15em",
          marginLeft: 12, paddingLeft: 20, borderLeft: `1px solid ${PH.rule}` }}>
          WEB EDITOR<br/>FW 1.4.2 · AVD2-0412
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div style={{ fontFamily: PH.mono, fontSize: 11, color: PH.inkDim, letterSpacing: "0.15em" }}>
          LINK: <span style={{ color: connected ? PH.accent : PH.danger }}>
            {connected ? "ESTABLISHED" : "SEVERED"}</span>
        </div>
        <button onClick={onToggle}
          style={{ border: `1px solid ${PH.accent}`, background: connected ? "transparent" : PH.accent,
            color: connected ? PH.accent : "#0a0d0a", fontFamily: PH.mono, fontSize: 11,
            fontWeight: 700, letterSpacing: "0.2em", padding: "10px 18px", borderRadius: 2, cursor: "pointer" }}>
          {connected ? "DISCONNECT" : "CONNECT"}
        </button>
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
      background: "repeating-linear-gradient(90deg, transparent 0, transparent 19px, rgba(124,255,158,0.03) 19px, rgba(124,255,158,0.03) 20px), repeating-linear-gradient(0deg, transparent 0, transparent 19px, rgba(124,255,158,0.03) 19px, rgba(124,255,158,0.03) 20px), #0c1410",
      fontFamily: PH.mono }}>
      <div style={{ textAlign: "center", marginBottom: 22 }}>
        <div style={{ fontSize: 9, letterSpacing: "0.4em", color: PH.inkMute }}>BONDI EFFECTS — SCHEMATIC</div>
        <div style={{ fontFamily: PH.serif, fontSize: 28, color: PH.accent, marginTop: 6,
          textShadow: "0 0 14px rgba(124,255,158,0.4)" }}>Art Van Delay 2</div>
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
          background: "radial-gradient(circle at 35% 30%, rgba(124,255,158,0.3), transparent 60%)",
          boxShadow: "0 0 18px rgba(124,255,158,0.25), inset 0 0 12px rgba(124,255,158,0.3)" }} />
        <div style={{ fontSize: 9, letterSpacing: "0.28em", color: PH.inkMute }}>OUT ▸</div>
      </div>
    </div>
  );
}

function PhKnob({ value, max, label, onChange }) {
  const frac = value / max;
  const angle = -135 + frac * 270;
  const onWheel = (e) => { e.preventDefault();
    onChange(Math.max(0, Math.min(max, value - Math.sign(e.deltaY) * (max / 80)))); };
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div onWheel={onWheel}
        style={{ width: 58, height: 58, borderRadius: 29, position: "relative",
          background: "#0a0d0a", border: `1.5px solid ${PH.accentDim}`,
          boxShadow: `0 0 12px rgba(124,255,158,0.15), inset 0 0 12px rgba(124,255,158,0.08)`,
          cursor: "ns-resize" }}>
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
        style={{ background: "#0a0d0a", border: `1px solid ${PH.accentDim}`, color: PH.accent,
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
            <div><span style={{ color: PH.accent }}>▸</span> baud …………… <span style={{ color: PH.ink }}>115200</span></div>
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
                onChange={(v)=>setLive({...live, [k]: Math.round(v)})} />
            ))}
          </div>
        </PhPanel>
      </div>
    </div>
  );
}

function PhPresets({ presets, selected, setSelected, draft, setDraft, activeSlot }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 18 }}>
      <PhPanel title="Bank · 16 slots" style={{ height: "fit-content" }}>
        <div className="avd-scroll" style={{ maxHeight: 640, overflowY: "auto", margin: "-16px", padding: 12 }}>
          {presets.map(p => {
            const isSel = p.slot === selected;
            const isAct = p.slot === activeSlot;
            return (
              <button key={p.slot} onClick={()=>setSelected(p.slot)}
                style={{ display: "block", width: "100%", textAlign: "left",
                  padding: "10px 12px", marginBottom: 2, cursor: "pointer",
                  border: `1px solid ${isSel ? PH.accent : "transparent"}`,
                  background: isSel ? PH.accentMute : "transparent",
                  fontFamily: PH.mono }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10,
                  color: PH.inkMute, letterSpacing: "0.16em" }}>
                  <span>{String(p.slot).padStart(2,"0")}</span>
                  {isAct && <span style={{ color: PH.accent }}>◉ ACTIVE</span>}
                  {!p.valid && <span>∅ EMPTY</span>}
                </div>
                <div style={{ fontSize: 13, color: p.valid ? PH.ink : PH.inkMute, marginTop: 3 }}>
                  {p.name}
                </div>
              </button>
            );
          })}
        </div>
      </PhPanel>
      <PhPanel title={`Slot ${String(selected).padStart(2,"0")} · ${draft.name}`}
        rightMeta="◉ EDITING">
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 28, alignItems: "start" }}>
          <PhPedal preset={draft} onChange={setDraft} />
          <div>
            <div style={{ fontFamily: PH.mono, fontSize: 10, letterSpacing: "0.24em",
              color: PH.inkMute, marginBottom: 10 }}>FIELD VALUES</div>
            <div style={{ fontFamily: PH.mono, fontSize: 12, color: PH.ink }}>
              {[
                ["delay_time_ms", `${draft.delay_time_ms} ms`],
                ["lfo_depth", `${draft.lfo_depth} (${lfoDepthParamToCents(draft.lfo_depth).toFixed(1)} ct)`],
                ["lfo_rate", `${draft.lfo_rate} (${lfoRateParamToHz(draft.lfo_rate).toFixed(2)} Hz)`],
                ["effect_level", draft.effect_level],
                ["feedback", draft.feedback],
                ["tilt", draft.tilt],
                ["subdivision", ["1/1","1/2","1/3","1/4","1/6","1/8","1/16"][draft.subdivision]],
                ["lfo_waveform", WAVEFORM_LABELS[draft.lfo_waveform]],
                ["expression", draft.expression],
                ["bypass_state", draft.bypass_state],
              ].map(([k,v])=>(
                <div key={k} style={{ display: "grid", gridTemplateColumns: "160px 1fr",
                  padding: "7px 0", borderBottom: `1px dashed ${PH.rule}`, gap: 12 }}>
                  <span style={{ color: PH.inkMute }}>{k}</span>
                  <span style={{ color: PH.accent, textAlign: "right" }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <button style={{ flex: 1, border: `1px solid ${PH.accent}`, background: "transparent",
                color: PH.accent, fontFamily: PH.mono, fontSize: 11, letterSpacing: "0.22em",
                padding: "12px", cursor: "pointer" }}>LOAD TO DEVICE</button>
              <button style={{ flex: 1, border: "none", background: PH.accent, color: "#0a0d0a",
                fontFamily: PH.mono, fontSize: 11, letterSpacing: "0.22em", fontWeight: 700,
                padding: "12px", cursor: "pointer" }}>WRITE TO SLOT</button>
            </div>
          </div>
        </div>
      </PhPanel>
    </div>
  );
}

function PhConfig({ config, setConfig }) {
  const input = { background: "#0a0d0a", border: `1px solid ${PH.accentDim}`,
    color: PH.accent, fontFamily: PH.mono, fontSize: 12, padding: "10px 12px",
    letterSpacing: "0.08em", width: "100%" };
  const fld = (label, el) => (
    <div>
      <div style={{ fontFamily: PH.mono, fontSize: 9, letterSpacing: "0.26em",
        color: PH.inkMute, marginBottom: 6 }}>{label}</div>
      {el}
    </div>
  );
  return (
    <PhPanel title="Expression · Calibration · Routing">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 18 }}>
        {fld("expression_enabled",
          <select value={config.expression_enabled} style={input}
            onChange={e=>setConfig({...config, expression_enabled: e.target.value==="true"})}>
            <option value="true">TRUE</option><option value="false">FALSE</option></select>)}
        {fld("expression_assignment",
          <select value={config.expression_assignment} style={input}
            onChange={e=>setConfig({...config, expression_assignment: +e.target.value})}>
            {PARAM_CATALOG.map(p=><option key={p.id} value={p.id}>[{p.id}] {p.label}</option>)}
          </select>)}
        {fld("expression_curve",
          <select value={config.expression_curve} style={input}
            onChange={e=>setConfig({...config, expression_curve: +e.target.value})}>
            <option value="0">0 — LINEAR</option><option value="1">1 — LOGARITHMIC</option>
            <option value="2">2 — EXPONENTIAL</option></select>)}
        {fld("expression_auto_assign",
          <select value={config.expression_auto_assign} style={input}
            onChange={e=>setConfig({...config, expression_auto_assign: e.target.value==="true"})}>
            <option value="true">TRUE</option><option value="false">FALSE</option></select>)}
        {fld("calibration_min",
          <input type="number" value={config.expression_calibration_min} style={input}
            onChange={e=>setConfig({...config, expression_calibration_min: +e.target.value})}/>)}
        {fld("calibration_max",
          <input type="number" value={config.expression_calibration_max} style={input}
            onChange={e=>setConfig({...config, expression_calibration_max: +e.target.value})}/>)}
      </div>
      <div style={{ marginTop: 28, padding: 14, border: `1px dashed ${PH.rule}`,
        fontFamily: PH.mono, fontSize: 11, color: PH.inkDim, letterSpacing: "0.08em", lineHeight: 1.8 }}>
        <span style={{color:PH.accent}}>▸</span> calibration range constrained to 0–4095 (12-bit ADC).<br/>
        <span style={{color:PH.accent}}>▸</span> setting auto_assign=true will bind expression to the last-tweaked parameter.
      </div>
      <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button style={{ border: `1px solid ${PH.accent}`, background: PH.accent,
          color: "#0a0d0a", fontFamily: PH.mono, fontSize: 11, fontWeight: 700,
          letterSpacing: "0.24em", padding: "12px 24px", cursor: "pointer" }}>COMMIT</button>
      </div>
    </PhPanel>
  );
}

function PhConsole({ log }) {
  return (
    <PhPanel title="Serial Traffic · JSON Shell" rightMeta="baud 115200 · RX/TX">
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

function Phosphor() {
  const [tab, setTab] = React.useState("live");
  const [connected, setConnected] = React.useState(true);
  const [live, setLive] = React.useState(MOCK_LIVE);
  const [presets, setPresets] = React.useState(MOCK_PRESETS);
  const [selected, setSelected] = React.useState(2);
  const [config, setConfig] = React.useState(MOCK_CONFIG);
  const draft = presets[selected]?.valid ? presets[selected] :
    { slot: selected, valid: false, name: "Empty", delay_time_ms: 400, lfo_depth: 80, lfo_rate: 64,
      effect_level: 160, feedback: 90, tilt: 128, subdivision: 3, lfo_waveform: 0,
      expression: 0, bypass_state: 1 };
  const setDraft = d => { const n = presets.slice(); n[selected] = {...d, valid:true}; setPresets(n); };

  return (
    <div style={{ width: 1440, minHeight: 1080, background: PH.bg, color: PH.ink,
      fontFamily: PH.sans, position: "relative" }}>
      {/* subtle scanline overlay */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1,
        backgroundImage: "repeating-linear-gradient(0deg, rgba(124,255,158,0.025), rgba(124,255,158,0.025) 1px, transparent 1px, transparent 3px)" }} />
      <div style={{ position: "relative", zIndex: 2 }}>
        <PhHeader connected={connected} onToggle={()=>setConnected(!connected)} />
        <PhTab tab={tab} setTab={setTab} />
        <div style={{ padding: 20 }}>
          {tab === "live" && <PhLive live={live} setLive={setLive} />}
          {tab === "presets" && <PhPresets presets={presets} selected={selected} setSelected={setSelected}
            draft={draft} setDraft={setDraft} activeSlot={2} />}
          {tab === "config" && <PhConfig config={config} setConfig={setConfig} />}
          {tab === "console" && <PhConsole log={MOCK_LOG} />}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  Phosphor, PH, PhPanel, PhTab, PhReadout, PhHeader, PhPedal, PhKnob, PhPedalSelect,
  PhLive, PhPresets, PhConfig, PhConsole,
});
