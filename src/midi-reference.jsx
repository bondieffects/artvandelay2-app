// MIDI CC / PC Reference panel for Art Van Delay 2 web editor.
// Reads window.MIDI_CC_MAP (set by midi-cc-map.js loaded before this file).
// Globals used: React, PH, PhPanel

// ── Helper UI pieces ──────────────────────────────────────────────────────────

const row = (label, value, key) => (
  <div key={key || label} style={{
    display: "grid", gridTemplateColumns: "140px 1fr", gap: 12,
    padding: "6px 0", borderBottom: `1px dotted ${PH.rule}`,
    fontFamily: PH.mono, fontSize: 12,
  }}>
    <span style={{ color: PH.inkMute }}>{label}</span>
    <span style={{ color: PH.accent }}>{value}</span>
  </div>
);

const sectionLabel = (text) => (
  <div style={{ fontFamily: PH.mono, fontSize: 9, letterSpacing: "0.24em",
    textTransform: "uppercase", color: PH.inkMute, marginTop: 16, marginBottom: 8 }}>
    {text}
  </div>
);

const noteBox = (text) => (
  <div style={{ marginTop: 14, padding: "8px 12px", border: `1px dashed ${PH.rule}`,
    fontFamily: PH.mono, fontSize: 11, color: PH.inkDim, lineHeight: 1.7 }}>
    <span style={{ color: PH.accent }}>▸</span> {text}
  </div>
);

const tableHead = (cols) => (
  <thead>
    <tr>
      {cols.map((h) => (
        <th key={h} style={{ textAlign: "left", color: PH.inkMute, fontSize: 9,
          letterSpacing: "0.18em", textTransform: "uppercase",
          padding: "4px 8px", borderBottom: `1px solid ${PH.ruleStrong}` }}>{h}</th>
      ))}
    </tr>
  </thead>
);

const tdStyle = { padding: "5px 8px", borderBottom: `1px dotted ${PH.rule}` };

// ── MidiDetail — renders differently per entry.kind ───────────────────────────

function MidiDetail({ entry }) {
  if (entry.kind === "continuous") {
    return (
      <div>
        {row("CC Number", entry.cc)}
        {entry.hires && row("LSB CC", entry.lsbCc)}
        {row("Channel", entry.channel)}
        {row("7-bit Range", entry.midiRange + " → " + entry.mapsTo)}
        {entry.hires && row("14-bit Range", entry.hiresRange + " → " + entry.mapsTo)}
        {entry.hires && noteBox(
          `For 14-bit: send CC ${entry.cc} (MSB) then CC ${entry.lsbCc} (LSB). Sending CC ${entry.cc} alone is valid 7-bit (backward-compatible).`
        )}
      </div>
    );
  }

  if (entry.kind === "enum") {
    return (
      <div>
        {row("CC Number", entry.cc)}
        {row("Channel", entry.channel)}
        {row("MIDI Range", entry.midiRange + " → " + entry.mapsTo)}
        {sectionLabel("Values")}
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: PH.mono, fontSize: 12 }}>
          {tableHead(["MIDI Range", "Index", "Name"])}
          <tbody>
            {entry.options.map((opt) => (
              <tr key={opt.index}>
                <td style={{ ...tdStyle, color: PH.accent }}>{opt.midi}</td>
                <td style={{ ...tdStyle, color: PH.inkDim }}>{opt.index}</td>
                <td style={{ ...tdStyle, color: PH.ink }}>{opt.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (entry.kind === "threshold") {
    return (
      <div>
        {row("CC Number", entry.cc)}
        {row("Channel", entry.channel)}
        {row("MIDI Range", entry.midiRange)}
        {sectionLabel("Threshold (split at 64)")}
        <div style={{ display: "flex", borderRadius: 2, overflow: "hidden", height: 36,
          border: `1px solid ${PH.rule}` }}>
          <div style={{ flex: 64, background: PH.accentMute, display: "flex",
            alignItems: "center", padding: "0 10px",
            fontFamily: PH.mono, fontSize: 11, color: PH.accent }}>
            0–63 · {entry.low}
          </div>
          <div style={{ flex: 63, background: "transparent", display: "flex",
            alignItems: "center", padding: "0 10px",
            fontFamily: PH.mono, fontSize: 11, color: PH.inkDim }}>
            64–127 · {entry.high}
          </div>
        </div>
        {entry.notes && noteBox(entry.notes)}
      </div>
    );
  }

  if (entry.kind === "trigger") {
    return (
      <div>
        {row("CC Number", entry.cc)}
        {row("Channel", entry.channel)}
        {row("Trigger On", entry.midiRange)}
        {entry.notes && noteBox(entry.notes)}
      </div>
    );
  }

  if (entry.kind === "pc") {
    return (
      <div>
        {row("Message Type", "Program Change")}
        {row("Channel", entry.channel)}
        {row("Range", entry.midiRange)}
        {sectionLabel("Slots")}
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: PH.mono, fontSize: 12 }}>
          {tableHead(["PC Number", "Action"])}
          <tbody>
            {Array.from({ length: 12 }, (_, i) => (
              <tr key={i}>
                <td style={{ ...tdStyle, color: PH.warn }}>{i}</td>
                <td style={{ ...tdStyle, color: PH.ink }}>Load slot {i}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: PH.mono, fontSize: 12, color: PH.inkDim }}>
      Unknown kind: {entry.kind}
    </div>
  );
}

// ── PhMidiRef — stateful reference browser ────────────────────────────────────

function PhMidiRef() {
  const map = window.MIDI_CC_MAP;
  const [selected, setSelected] = React.useState(map[0].cc);

  const entry = map.find((e) => e.cc === selected) || map[0];

  const detailTitle = (e) =>
    e.kind === "pc" ? "PC · preset load" : `CC ${e.cc} · ${e.label}`;

  const kindBadge = (e) =>
    e.kind.toUpperCase().replace("_", " ");

  return (
    <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 18 }}>
      {/* Left: index list */}
      <PhPanel title="CC / PC">
        <div className="avd-scroll" style={{ overflowY: "auto", margin: "-16px", padding: 8 }}>
          {map.map((e) => {
            const isActive = e.cc === selected;
            const numColor = e.kind === "pc" ? PH.warn : PH.accent;
            const numLabel = e.kind === "pc" ? "PC" : `CC ${e.cc}`;
            return (
              <button
                key={String(e.cc)}
                onClick={() => setSelected(e.cc)}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  width: "100%", padding: "7px 8px", marginBottom: 2, cursor: "pointer",
                  border: "none", textAlign: "left",
                  background: isActive ? PH.accentMute : "transparent",
                  fontFamily: PH.mono, fontSize: 11,
                }}
              >
                <span style={{ color: numColor, flexShrink: 0 }}>{numLabel}</span>
                <span style={{
                  color: isActive ? PH.ink : PH.inkMute,
                  marginLeft: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {e.shortLabel}
                </span>
              </button>
            );
          })}
        </div>
      </PhPanel>

      {/* Right: detail */}
      <PhPanel title={detailTitle(entry)} rightMeta={kindBadge(entry)}>
        <MidiDetail entry={entry} />
      </PhPanel>
    </div>
  );
}
PhMidiRef = React.memo(PhMidiRef);

Object.assign(window, { PhMidiRef });
