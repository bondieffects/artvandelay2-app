// web/src/app.jsx — Art Van Delay 2 UI wired to the real firmware protocol.
//
// Live params are READ-ONLY over USB MIDI SysEx (no `web param set`). They change
// when the user loads a preset or turns a physical knob on the pedal.
// The 2 Hz poll keeps the Live tab in sync with physical knob movement.
//
// Preset editing is slot-scoped: LOAD copies a slot into the active buffer
// (so live params now reflect it), SAVE commits the current live state to
// a slot. Draft edits on the Presets tab are local-only — you have to
// turn the physical knobs / load a preset to change what gets saved.

function PhosphorWired() {
  const { transport, connected, status, log } = useTransport();

  const [tab, setTab] = React.useState("live");
  const [info, setInfo]       = React.useState(MOCK_DEVICE);
  const [live, setLive]       = React.useState(MOCK_LIVE);
  const [presets, setPresets] = React.useState(MOCK_PRESETS);
  const [selected, setSelected] = React.useState(2);
  const [config, setConfig]   = React.useState(MOCK_CONFIG);
  const [error, setError]     = React.useState(null);
  const loadedSlotsRef = React.useRef(new Set());
  const deviceConfigRef = React.useRef(MOCK_CONFIG);

  // ── Refreshers ──────────────────────────────────────────
  const refreshParams = React.useCallback(async () => {
    try { const v = await transport.paramGet(); if (v) setLive((L) => ({ ...L, ...v })); }
    catch (e) { setError(e.message); }
  }, [transport]);

  const refreshPresets = React.useCallback(async () => {
    try {
      const list = await transport.presetList();
      if (!list) return;
      // Build from the firmware's slot list so we show all slots the device reports,
      // not just the 8 entries in MOCK_PRESETS. Preserve any already-fetched detail.
      setPresets((current) => {
        const bySlot = {};
        for (const p of current) bySlot[p.slot] = p;
        return list.slots.map(({ slot, valid }) => {
          const existing = bySlot[slot];
          const base = { slot, valid, name: `Slot ${String(slot).padStart(2, "0")}`,
            delay_time_ms: 400, lfo_depth: 80, lfo_rate: 64, effect_level: 160,
            feedback: 90, tilt: 128, subdivision: 3, lfo_waveform: 0, expression: 0, bypass_state: 1 };
          return existing ? { ...existing, valid } : base;
        });
      });
      if (typeof list.active === "number") {
        setLive((L) => ({ ...L, active_preset: list.active, preset_dirty: !!list.dirty }));
      }
    } catch (e) { setError(e.message); }
  }, [transport]);

  const refreshSelected = React.useCallback(async (slot) => {
    try {
      const r = await transport.presetGet(slot);
      if (r && r.preset) {
        loadedSlotsRef.current.add(slot);
        setPresets((P) => P.map((p) => p.slot === slot ? { ...p, ...r.preset } : p));
      }
    } catch (e) { setError(e.message); }
  }, [transport]);

  const refreshConfig = React.useCallback(async () => {
    try {
      const c = await transport.configGet();
      if (c) {
        deviceConfigRef.current = { ...deviceConfigRef.current, ...c };
        setConfig((C) => ({ ...C, ...c }));
      }
    }
    catch (e) { setError(e.message); }
  }, [transport]);

  const refreshAll = React.useCallback(async () => {
    try {
      const i = await transport.info(); if (i) setInfo(i);
    } catch (e) { setError(e.message); }
    await refreshParams();
    await refreshPresets();
    await refreshConfig();
  }, [transport, refreshParams, refreshPresets, refreshConfig]);

  // ── Clear loaded-slot cache on disconnect ───────────────
  React.useEffect(() => {
    if (!connected) loadedSlotsRef.current.clear();
  }, [connected]);

  // ── Connect / disconnect ────────────────────────────────
  const onToggle = React.useCallback(async () => {
    setError(null);
    try {
      if (connected) { await transport.disconnect(); }
      else { await transport.connect(); await refreshAll(); }
    } catch (e) { setError(e.message); }
  }, [transport, connected, refreshAll]);

  // ── Live polling — tracks physical knob movement; pauses when tab is hidden ─
  React.useEffect(() => {
    if (!connected) return;
    let stopped = false;
    let timerId;
    let failCount = 0;
    const tick = async () => {
      if (stopped) return;
      if (!document.hidden) {
        try {
          const v = await transport.paramGet();
          if (v && !stopped) { setLive((L) => ({ ...L, ...v })); failCount = 0; }
        } catch {
          failCount++;
          if (!stopped && failCount >= 3) setError("Lost contact with pedal — try reconnecting.");
        }
      }
      if (!stopped) timerId = setTimeout(tick, document.hidden ? 2000 : 500);
    };
    timerId = setTimeout(tick, 500);
    return () => { stopped = true; clearTimeout(timerId); };
  }, [connected, transport]);

  // ── Lazy-load per-slot detail when user selects a slot ──
  React.useEffect(() => {
    const slot = presets.find((p) => p.slot === selected);
    if (connected && slot?.valid && !loadedSlotsRef.current.has(selected)) {
      refreshSelected(selected);
    }
  }, [connected, selected, presets, refreshSelected]);

  // ── Preset actions ──────────────────────────────────────
  const loadSlot = React.useCallback(async (slot) => {
    setError(null);
    try { const r = await transport.presetLoad(slot);
          if (r && r.error) throw new Error(r.error);
          await refreshAll(); }
    catch (e) { setError(e.message); }
  }, [transport, refreshAll]);

  const saveSlot = React.useCallback(async (slot) => {
    setError(null);
    try { const r = await transport.presetSave(slot);
          if (r && r.error) throw new Error(r.error);
          await refreshPresets();
          await refreshSelected(slot); }
    catch (e) { setError(e.message); }
  }, [transport, refreshPresets, refreshSelected]);

  // ── Config push — only fields that differ from the last device fetch ──
  const commitConfig = React.useCallback(async (pendingConfig) => {
    setError(null);
    const allPairs = [
      ["expression_enabled",         String(pendingConfig.expression_enabled)],
      ["expression_assignment",      String(pendingConfig.expression_assignment)],
      ["expression_curve",           String(pendingConfig.expression_curve)],
      ["expression_auto_assign",     String(pendingConfig.expression_auto_assign)],
      ["expression_calibration_min", String(pendingConfig.expression_calibration_min)],
      ["expression_calibration_max", String(pendingConfig.expression_calibration_max)],
    ];
    const pairs = allPairs.filter(([k]) => String(pendingConfig[k]) !== String(deviceConfigRef.current[k]));
    if (pairs.length === 0) return;
    try {
      for (const [k, v] of pairs) {
        const r = await transport.configSet(k, v);
        if (r && r.error) throw new Error(`${k}: ${r.error}`);
        if (r) {
          deviceConfigRef.current = { ...deviceConfigRef.current, ...r };
          setConfig((C) => ({ ...C, ...r }));
        }
      }
    } catch (e) { setError(e.message); }
  }, [transport]);

  // Local draft for presets tab — edits here are UI-only until LOAD/SAVE.
  const presetBySlot = presets.find((p) => p.slot === selected);
  const draft = presetBySlot?.valid && presetBySlot?.delay_time_ms !== undefined
    ? presetBySlot
    : { slot: selected, valid: false, name: `Slot ${selected}`,
        delay_time_ms: 400, lfo_depth: 80, lfo_rate: 64,
        effect_level: 160, feedback: 90, tilt: 128,
        subdivision: 3, lfo_waveform: 0, expression: 0, bypass_state: 1 };
  const setDraft = React.useCallback((d) => {
    setPresets((P) => P.map((p) => p.slot === selected ? { ...d, valid: true } : p));
  }, [selected]);

  const fw = info.firmware || MOCK_DEVICE.firmware;
  const fwString = fwVersionString(fw);
  const firmwareOutdated = connected && fwVersionCompare(fw, LATEST_FW_VERSION) < 0;
  const serialString = connected
    ? (info.board ? `${info.board} · rev ${info.hardware_revision ?? 0}` : "unknown")
    : MOCK_DEVICE.serial;

  return (
    <div style={{ width: 1440, minHeight: 1080, background: PH.bg, color: PH.ink,
      fontFamily: PH.sans, position: "relative" }}>
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1,
        backgroundImage: "repeating-linear-gradient(0deg, rgba(255,26,136,0.025), rgba(255,26,136,0.025) 1px, transparent 1px, transparent 3px)" }} />
      <div style={{ position: "relative", zIndex: 2 }}>
        <WiredHeader connected={connected} status={status} onToggle={onToggle}
          fw={fwString} serial={serialString} error={error}
          firmwareOutdated={firmwareOutdated} onFirmwareUpdate={() => setTab("firmware")} />
        <PhTab tab={tab} setTab={setTab} />
        <div style={{ padding: 20 }}>
          {tab === "live" && (
            <PhLive live={live}
              // Live knob turns are UI-local only; firmware exposes no `web param set`.
              // The 2 Hz poll overwrites these on the next tick, so this is essentially
              // a no-op when connected (as expected). When disconnected, lets you demo.
              setLive={setLive} />
          )}
          {tab === "presets" && (
            <WiredPresets presets={presets} selected={selected} setSelected={setSelected}
              draft={draft} setDraft={setDraft} activeSlot={live.active_preset}
              connected={connected} onLoad={loadSlot} onSave={saveSlot} />
          )}
          {tab === "config" && (
            <WiredConfig config={config} setConfig={setConfig} onCommit={commitConfig}
              connected={connected} />
          )}
          {tab === "firmware" && <FirmwareUpdaterPanel deviceFirmware={connected ? fw : null} />}
          {tab === "console" && <PhConsole log={log.length ? log : MOCK_LOG} />}
        </div>
      </div>
    </div>
  );
}

// Header variant that shows real status and error text.
function WiredHeader({ connected, status, onToggle, fw, serial, error, firmwareOutdated, onFirmwareUpdate }) {
  const label = status === "connecting" ? "LINKING…"
              : status === "error"      ? "ERROR"
              : connected               ? "ESTABLISHED"
                                        : "SEVERED";
  const color = status === "connecting" ? PH.warn
              : status === "error"      ? PH.danger
              : connected               ? PH.accent
                                        : PH.danger;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "16px 24px", borderBottom: `1px solid ${PH.rule}`, background: PH.bgAlt }}>
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <div style={{ width: 10, height: 10, borderRadius: 5, background: color,
          boxShadow: `0 0 10px ${color}` }} />
        <div>
          <div style={{ fontFamily: PH.mono, fontSize: 10, letterSpacing: "0.3em",
            color: PH.inkMute, textTransform: "uppercase" }}>Bondi Effects</div>
          <div style={{ fontFamily: PH.serif, fontSize: 26, color: PH.accent, lineHeight: 1, marginTop: 4,
            textShadow: "0 0 18px rgba(255,26,136,0.35)" }}>Art Van Delay 2</div>
        </div>
        <div style={{ fontFamily: PH.mono, fontSize: 10, color: PH.inkMute, letterSpacing: "0.15em",
          marginLeft: 12, paddingLeft: 20, borderLeft: `1px solid ${PH.rule}` }}>
          WEB EDITOR<br/>FW {fw} · {serial}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        {error && <div style={{ fontFamily: PH.mono, fontSize: 11, color: PH.danger,
          letterSpacing: "0.1em", maxWidth: 280, textAlign: "right" }}>⚠ {error}</div>}
        {firmwareOutdated && (
          <button onClick={onFirmwareUpdate}
            style={{ border: `1px solid ${PH.warn}`, background: "transparent",
              color: PH.warn, fontFamily: PH.mono, fontSize: 10, fontWeight: 700,
              letterSpacing: "0.2em", padding: "7px 12px", borderRadius: 2, cursor: "pointer",
              boxShadow: `0 0 8px rgba(255,180,0,0.3)` }}>
            ▲ FW UPDATE AVAILABLE
          </button>
        )}
        <div style={{ fontFamily: PH.mono, fontSize: 11, color: PH.inkDim, letterSpacing: "0.15em" }}>
          LINK: <span style={{ color }}>{label}</span>
        </div>
        <button onClick={onToggle} disabled={status === "connecting"}
          style={{ border: `1px solid ${PH.accent}`,
            background: connected ? "transparent" : PH.accent,
            color: connected ? PH.accent : "#0a0d0a",
            opacity: status === "connecting" ? 0.5 : 1,
            fontFamily: PH.mono, fontSize: 11, fontWeight: 700,
            letterSpacing: "0.2em", padding: "10px 18px", borderRadius: 2,
            cursor: status === "connecting" ? "wait" : "pointer" }}>
          {connected ? "DISCONNECT" : "CONNECT"}
        </button>
      </div>
    </div>
  );
}

// Presets tab with working LOAD/SAVE buttons.
function WiredPresets({ presets, selected, setSelected, draft, setDraft, activeSlot,
                        connected, onLoad, onSave }) {
  const disabled = !connected;
  const btn = (primary) => ({
    flex: 1, border: `1px solid ${PH.accent}`,
    background: primary ? PH.accent : "transparent",
    color: primary ? "#0a0d0a" : PH.accent,
    fontFamily: PH.mono, fontSize: 11, letterSpacing: "0.22em",
    fontWeight: primary ? 700 : 400, padding: "12px",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.4 : 1,
  });
  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 18 }}>
      <PhPanel title="Bank · 16 slots" style={{ height: "fit-content" }}>
        <div className="avd-scroll" style={{ maxHeight: 640, overflowY: "auto", margin: "-16px", padding: 12 }}>
          {presets.map((p) => {
            const isSel = p.slot === selected;
            const isAct = p.slot === activeSlot;
            return (
              <button key={p.slot} onClick={() => setSelected(p.slot)}
                style={{ display: "block", width: "100%", textAlign: "left",
                  padding: "10px 12px", marginBottom: 2, cursor: "pointer",
                  border: `1px solid ${isSel ? PH.accent : "transparent"}`,
                  background: isSel ? PH.accentMute : "transparent", fontFamily: PH.mono }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10,
                  color: PH.inkMute, letterSpacing: "0.16em" }}>
                  <span>{String(p.slot).padStart(2, "0")}</span>
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
      <PhPanel title={`Slot ${String(selected).padStart(2, "0")} · ${draft.name}`} rightMeta="◉ EDITING">
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 28, alignItems: "start" }}>
          <PhPedal preset={draft} onChange={setDraft} />
          <div>
            <PhPanel title="LFO · Preview" rightMeta={`${WAVEFORM_LABELS[draft.lfo_waveform]} · ${lfoRateParamToHz(draft.lfo_rate).toFixed(2)} Hz`} style={{ marginBottom: 14 }}>
              <LfoScope waveformId={draft.lfo_waveform} rate={draft.lfo_rate} depth={draft.lfo_depth}
                width={660} height={150} skin="phosphor" />
            </PhPanel>
            <div style={{ fontFamily: PH.mono, fontSize: 10, letterSpacing: "0.24em",
              color: PH.inkMute, marginBottom: 10 }}>FIELD VALUES</div>
            <div style={{ fontFamily: PH.mono, fontSize: 12, color: PH.ink }}>
              {[
                ["delay_time_ms", `${draft.delay_time_ms} ms`],
                ["lfo_depth",     `${draft.lfo_depth} (${lfoDepthParamToCents(draft.lfo_depth).toFixed(1)} ct)`],
                ["lfo_rate",      `${draft.lfo_rate} (${lfoRateParamToHz(draft.lfo_rate).toFixed(2)} Hz)`],
                ["effect_level",  draft.effect_level],
                ["feedback",      draft.feedback],
                ["tilt",          draft.tilt],
                ["subdivision",   ["1/1","1/2","1/3","1/4","1/6","1/8","1/16"][draft.subdivision]],
                ["lfo_waveform",  WAVEFORM_LABELS[draft.lfo_waveform]],
                ["expression",    draft.expression],
                ["bypass_state",  draft.bypass_state],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "grid", gridTemplateColumns: "160px 1fr",
                  padding: "7px 0", borderBottom: `1px dashed ${PH.rule}`, gap: 12 }}>
                  <span style={{ color: PH.inkMute }}>{k}</span>
                  <span style={{ color: PH.accent, textAlign: "right" }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16, padding: "8px 10px",
              border: `1px dashed ${PH.warn}`, color: PH.warn,
              fontFamily: PH.mono, fontSize: 10, letterSpacing: "0.12em", lineHeight: 1.6 }}>
              ▸ Knob edits above are preview-only — they are not sent to the pedal.<br/>
              ▸ WRITE TO SLOT commits the pedal's current live state, not these values.
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button style={btn(false)} disabled={disabled}
                onClick={() => onLoad(selected)}>LOAD TO DEVICE</button>
              <button style={btn(true)} disabled={disabled}
                onClick={() => onSave(selected)}>WRITE TO SLOT</button>
            </div>
            <div style={{ fontFamily: PH.mono, fontSize: 10, color: PH.inkMute,
              letterSpacing: "0.14em", marginTop: 12, lineHeight: 1.6 }}>
              ▸ LOAD sends <code style={{ color: PH.accent }}>web preset load {selected}</code> — copies this slot into the live buffer.<br/>
              ▸ WRITE sends <code style={{ color: PH.accent }}>web preset save {selected}</code> — commits current live state here.
            </div>
          </div>
        </div>
      </PhPanel>
    </div>
  );
}

// Config tab with working COMMIT button.
function WiredConfig({ config, setConfig, onCommit, connected }) {
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
          <select value={String(config.expression_enabled)} style={input}
            onChange={(e) => setConfig({ ...config, expression_enabled: e.target.value === "true" })}>
            <option value="true">TRUE</option><option value="false">FALSE</option>
          </select>)}
        {fld("expression_assignment",
          <select value={config.expression_assignment} style={input}
            onChange={(e) => setConfig({ ...config, expression_assignment: +e.target.value })}>
            {PARAM_CATALOG.map((p) => <option key={p.id} value={p.id}>[{p.id}] {p.label}</option>)}
          </select>)}
        {fld("expression_curve",
          <select value={config.expression_curve} style={input}
            onChange={(e) => setConfig({ ...config, expression_curve: +e.target.value })}>
            <option value="0">0 — LINEAR</option><option value="1">1 — LOGARITHMIC</option>
            <option value="2">2 — EXPONENTIAL</option>
          </select>)}
        {fld("expression_auto_assign",
          <select value={String(config.expression_auto_assign)} style={input}
            onChange={(e) => setConfig({ ...config, expression_auto_assign: e.target.value === "true" })}>
            <option value="true">TRUE</option><option value="false">FALSE</option>
          </select>)}
        {fld("calibration_min",
          <input type="number" min={0} max={4095} value={config.expression_calibration_min} style={input}
            onChange={(e) => setConfig({ ...config, expression_calibration_min: +e.target.value })}/>)}
        {fld("calibration_max",
          <input type="number" min={0} max={4095} value={config.expression_calibration_max} style={input}
            onChange={(e) => setConfig({ ...config, expression_calibration_max: +e.target.value })}/>)}
      </div>
      <div style={{ marginTop: 28, padding: 14, border: `1px dashed ${PH.rule}`,
        fontFamily: PH.mono, fontSize: 11, color: PH.inkDim, letterSpacing: "0.08em", lineHeight: 1.8 }}>
        <span style={{ color: PH.accent }}>▸</span> calibration range constrained to 0–4095 (12-bit ADC).<br/>
        <span style={{ color: PH.accent }}>▸</span> setting auto_assign=true will bind expression to the last-tweaked parameter.
      </div>
      <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button disabled={!connected} onClick={() => onCommit(config)}
          style={{ border: `1px solid ${PH.accent}`,
            background: connected ? PH.accent : "transparent",
            color: connected ? "#0a0d0a" : PH.accent,
            opacity: connected ? 1 : 0.4,
            fontFamily: PH.mono, fontSize: 11, fontWeight: 700,
            letterSpacing: "0.24em", padding: "12px 24px",
            cursor: connected ? "pointer" : "not-allowed" }}>COMMIT</button>
      </div>
    </PhPanel>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<PhosphorWired />);
