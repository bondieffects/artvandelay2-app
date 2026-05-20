// Web MIDI firmware updater for signed Art Van Delay 2 bootloader images.
// Input file format matches midi-bootloader/tools/sign_firmware.py:
// firmware bytes followed by a 32-byte HMAC-SHA256 tag.

const FW_PROTO = {
  MFR_ID: 0x7d,
  CMD_PING: 0x00,
  CMD_BLOCK: 0x01,
  CMD_COMMIT: 0x02,
  RESP_PONG: 0x70,
  RESP_COMMIT_OK: 0x73,
  RESP_COMMIT_FAIL: 0x74,
  APP_BASE: 0x08008000,
  FLASH_END: 0x08040000,
  BLOCK_SIZE: 256,
  PAGE_SIZE: 2048,
  APP_SPACE: 256 * 1024 - (0x08008000 - 0x08000000),
  MIN_BLOCK_INTERVAL_MS: 120,
  PAGE_ERASE_INTERVAL_MS: 400,
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

function fwMakePing() {
  return new Uint8Array([0xf0, FW_PROTO.MFR_ID, FW_PROTO.CMD_PING, 0xf7]);
}

function fwMakeEnterDfu() {
  const text = "web dfu";
  const frame = new Uint8Array(4 + text.length + 1);
  frame.set([0xf0, FW_PROTO.MFR_ID, 0x10, 0x01], 0);
  for (let i = 0; i < text.length; i++) frame[4 + i] = text.charCodeAt(i) & 0x7f;
  frame[frame.length - 1] = 0xf7;
  return frame;
}

function fwMakeBlockFrame(blockNo, totalBlocks, targetAddr, data) {
  const raw = new Uint8Array(268);
  fwU16be(raw, 0, blockNo);
  fwU16be(raw, 2, totalBlocks);
  fwU32be(raw, 4, targetAddr);
  fwU16be(raw, 8, data.length);
  raw.fill(0xff, 10, 266);
  raw.set(data, 10);
  const crc = fwCrc16(raw.slice(0, 266));
  fwU16be(raw, 266, crc);
  const enc = fwEncode8to7(raw);
  const frame = new Uint8Array(3 + enc.length + 1);
  frame.set([0xf0, FW_PROTO.MFR_ID, FW_PROTO.CMD_BLOCK], 0);
  frame.set(enc, 3);
  frame[frame.length - 1] = 0xf7;
  return frame;
}

function fwMakeCommitFrame(size, tag) {
  const raw = new Uint8Array(36);
  fwU32be(raw, 0, size);
  raw.set(tag, 4);
  const enc = fwEncode8to7(raw);
  const frame = new Uint8Array(3 + enc.length + 1);
  frame.set([0xf0, FW_PROTO.MFR_ID, FW_PROTO.CMD_COMMIT], 0);
  frame.set(enc, 3);
  frame[frame.length - 1] = 0xf7;
  return frame;
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
    firmware,
    padded,
    tag,
    size: firmware.length,
    totalBlocks: padded.length / FW_PROTO.BLOCK_SIZE,
    sp,
    reset,
    vectorOk,
  };
}

function fwResponseName(bytes) {
  if (!bytes || bytes.length < 2 || bytes[0] !== FW_PROTO.MFR_ID) return "unknown";
  if (bytes[1] === FW_PROTO.RESP_PONG) return "pong";
  if (bytes[1] === FW_PROTO.RESP_COMMIT_OK) return "commit-ok";
  if (bytes[1] === FW_PROTO.RESP_COMMIT_FAIL) return "commit-fail";
  return `0x${bytes[1].toString(16).padStart(2, "0")}`;
}

function useFirmwareUpdater() {
  const [access, setAccess] = React.useState(null);
  const [outputs, setOutputs] = React.useState([]);
  const [inputs, setInputs] = React.useState([]);
  const [outputId, setOutputId] = React.useState("");
  const [inputId, setInputId] = React.useState("");
  const [image, setImage] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [status, setStatus] = React.useState("Idle");
  const [log, setLog] = React.useState([]);
  const inputRef = React.useRef(null);
  const outputIdRef = React.useRef(outputId);
  const waitersRef = React.useRef([]);

  React.useEffect(() => { outputIdRef.current = outputId; }, [outputId]);

  const addLog = React.useCallback((type, msg) => {
    const t = new Date().toLocaleTimeString([], { hour12: false });
    setLog((L) => L.concat([[t, type, msg]]).slice(-200));
  }, []);

  const refreshPorts = React.useCallback((midiAccess) => {
    const nextOutputs = Array.from(midiAccess.outputs.values());
    const nextInputs = Array.from(midiAccess.inputs.values());
    setOutputs(nextOutputs);
    setInputs(nextInputs);
    // If the currently selected port has disappeared (e.g. device rebooted between DFU and app
    // mode), fall back to the first available port rather than keeping a stale ID.
    setOutputId((id) => (id && nextOutputs.some((p) => p.id === id)) ? id : (nextOutputs[0]?.id || ""));
    setInputId((id) => (id && nextInputs.some((p) => p.id === id)) ? id : (nextInputs[0]?.id || ""));
  }, []);

  const requestMidi = React.useCallback(async () => {
    if (!navigator.requestMIDIAccess) throw new Error("Web MIDI is not available in this browser.");
    const midiAccess = await navigator.requestMIDIAccess({ sysex: true });
    midiAccess.onstatechange = () => refreshPorts(midiAccess);
    setAccess(midiAccess);
    refreshPorts(midiAccess);
    addLog("INFO", "Web MIDI SysEx access granted.");
    return midiAccess;
  }, [addLog, refreshPorts]);

  const onMidiMessage = React.useCallback((event) => {
    const data = Array.from(event.data || []);
    if (data[0] !== 0xf0 || data[data.length - 1] !== 0xf7) return;
    const payload = new Uint8Array(data.slice(1, -1));
    addLog("RX", fwResponseName(payload));
    const waiters = waitersRef.current;
    for (let i = 0; i < waiters.length; i++) {
      if (waiters[i].match(payload)) {
        const waiter = waiters.splice(i, 1)[0];
        clearTimeout(waiter.timer);
        waiter.resolve(payload);
        return;
      }
    }
  }, [addLog]);

  React.useEffect(() => {
    if (!access) return;
    for (const input of inputs) input.onmidimessage = null;
    const selected = access.inputs.get(inputId);
    if (selected) selected.onmidimessage = onMidiMessage;
    inputRef.current = selected || null;
    return () => { if (selected) selected.onmidimessage = null; };
  }, [access, inputs, inputId, onMidiMessage]);

  const waitFor = React.useCallback((match, timeoutMs, label) => new Promise((resolve, reject) => {
    const waiter = {
      match,
      resolve,
      reject,
      timer: setTimeout(() => {
        waitersRef.current = waitersRef.current.filter((w) => w !== waiter);
        reject(new Error(`Timed out waiting for ${label}.`));
      }, timeoutMs),
    };
    waitersRef.current.push(waiter);
  }), []);

  const send = React.useCallback((output, frame) => {
    output.send(Array.from(frame));
  }, []);

  const ping = React.useCallback(async () => {
    const midiAccess = access ?? await requestMidi();
    // Use the ref rather than the closure-captured outputId: enterDfu calls ping after an
    // await sleep(), during which the device reboots and outputId may have changed.
    const output = midiAccess.outputs.get(outputIdRef.current);
    if (!output) throw new Error("Select a MIDI output.");
    setStatus("Pinging bootloader");
    for (let attempt = 1; attempt <= 6; attempt++) {
      send(output, fwMakePing());
      addLog("TX", `ping ${attempt}`);
      try {
        await waitFor((p) => p[0] === FW_PROTO.MFR_ID && p[1] === FW_PROTO.RESP_PONG, 2000, "pong");
        setStatus("Bootloader replied");
        return true;
      } catch (e) {
        if (attempt === 6) throw e;
      }
    }
    return false;
  }, [access, addLog, requestMidi, send, waitFor]);

  const enterDfu = React.useCallback(async () => {
    const midiAccess = access ?? await requestMidi();
    const output = midiAccess.outputs.get(outputId);
    if (!output) throw new Error("Select a MIDI output.");
    setStatus("Requesting DFU mode");
    send(output, fwMakeEnterDfu());
    addLog("TX", "web dfu");
    await sleep(1800);
    await ping();
  }, [access, addLog, outputId, ping, requestMidi, send]);

  const loadFile = React.useCallback(async (file) => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const parsed = fwParseImage(bytes);
    parsed.name = file.name;
    setImage(parsed);
    setProgress(0);
    setStatus(parsed.vectorOk ? "Image loaded" : "Image loaded with vector warning");
    addLog("INFO", `Loaded ${file.name}: ${parsed.size.toLocaleString()} bytes, ${parsed.totalBlocks} blocks.`);
  }, [addLog]);

  const flash = React.useCallback(async () => {
    if (!image) throw new Error("Choose a signed firmware image first.");
    if (!access) throw new Error("Connect Web MIDI first.");
    const output = access.outputs.get(outputId);
    if (!output) throw new Error("Select a MIDI output.");
    setBusy(true);
    setProgress(0);
    const start = performance.now();
    try {
      await ping();
      setStatus("Flashing blocks");
      for (let blockNo = 0; blockNo < image.totalBlocks; blockNo++) {
        const offset = blockNo * FW_PROTO.BLOCK_SIZE;
        const targetAddr = FW_PROTO.APP_BASE + offset;
        const actualLen = Math.max(1, Math.min(FW_PROTO.BLOCK_SIZE, image.size - offset));
        const chunk = image.padded.slice(offset, offset + actualLen);
        send(output, fwMakeBlockFrame(blockNo, image.totalBlocks, targetAddr, chunk));
        setProgress((blockNo + 1) / image.totalBlocks);
        let delay = FW_PROTO.MIN_BLOCK_INTERVAL_MS;
        if ((targetAddr - FW_PROTO.APP_BASE) % FW_PROTO.PAGE_SIZE === 0) {
          delay = Math.max(delay, FW_PROTO.PAGE_ERASE_INTERVAL_MS);
          const pageNum = (targetAddr - FW_PROTO.APP_BASE) / FW_PROTO.PAGE_SIZE;
          addLog("INFO", `page ${pageNum} erase @ 0x${targetAddr.toString(16)} (block ${blockNo}/${image.totalBlocks})`);
        }
        await sleep(delay);
      }
      setStatus("Verifying HMAC on pedal");
      await sleep(FW_PROTO.MIN_BLOCK_INTERVAL_MS);
      send(output, fwMakeCommitFrame(image.size, image.tag));
      addLog("TX", "commit");
      const resp = await waitFor((p) => p[0] === FW_PROTO.MFR_ID &&
        (p[1] === FW_PROTO.RESP_COMMIT_OK || p[1] === FW_PROTO.RESP_COMMIT_FAIL), 15000, "commit response");
      if (resp[1] === FW_PROTO.RESP_COMMIT_FAIL) throw new Error("Pedal rejected the image: HMAC mismatch.");
      const elapsed = ((performance.now() - start) / 1000).toFixed(1);
      setStatus(`Update complete in ${elapsed}s`);
      setProgress(1);
      addLog("INFO", "Commit OK; pedal is resetting to application.");
    } finally {
      setBusy(false);
    }
  }, [access, addLog, image, outputId, ping, send, waitFor]);

  return {
    access, outputs, inputs, outputId, setOutputId, inputId, setInputId,
    image, busy, progress, status, log, requestMidi, loadFile, enterDfu, flash,
  };
}

function FirmwareUpdaterPanel({ deviceFirmware }) {
  const up = useFirmwareUpdater();
  const [error, setError] = React.useState(null);
  const [confirmFlash, setConfirmFlash] = React.useState(false);

  const run = (fn) => async (...args) => {
    setError(null);
    try { await fn(...args); }
    catch (e) { setError(e.message); }
  };

  const inputStyle = {
    width: "100%", background: PH.bg, border: `1px solid ${PH.ruleStrong}`,
    color: PH.accent, fontFamily: PH.mono, fontSize: 12, padding: "10px",
  };

  const isOutdated = deviceFirmware && fwVersionCompare(deviceFirmware, LATEST_FW_VERSION) < 0;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 18 }}>
      <PhPanel title="Firmware Image">
        <div style={{ marginBottom: 16, display: "grid", gap: 8, fontFamily: PH.mono, fontSize: 11 }}>
          <PhReadout label="Device"
            value={deviceFirmware ? fwVersionString(deviceFirmware) : "—"}
            tone={deviceFirmware ? (isOutdated ? PH.warn : PH.accent) : PH.inkMute} />
          <PhReadout label="Latest" value={fwVersionString(LATEST_FW_VERSION)} />
          {deviceFirmware && (
            <div style={{ marginTop: 4, padding: "6px 10px",
              border: `1px solid ${isOutdated ? PH.warn : PH.accent}`,
              color: isOutdated ? PH.warn : PH.accent,
              background: isOutdated ? "rgba(255,180,0,0.06)" : "rgba(255,26,136,0.06)",
              fontFamily: PH.mono, fontSize: 10, letterSpacing: "0.18em" }}>
              {isOutdated ? "▲ UPDATE AVAILABLE" : "✓ UP TO DATE"}
            </div>
          )}
        </div>
        <input type="file" accept=".bin,application/octet-stream"
          disabled={up.busy}
          onChange={(e) => e.target.files?.[0] && run(up.loadFile)(e.target.files[0])}
          style={{ ...inputStyle, boxSizing: "border-box" }} />
        {up.image && (
          <div style={{ marginTop: 14, display: "grid", gap: 8, fontFamily: PH.mono, fontSize: 11 }}>
            <PhReadout label="File" value={up.image.name} />
            <PhReadout label="Firmware" value={up.image.size.toLocaleString()} unit="B" />
            <PhReadout label="Blocks" value={up.image.totalBlocks} />
            <PhReadout label="Initial SP" value={`0x${up.image.sp.toString(16).padStart(8, "0")}`} />
            <PhReadout label="Reset Vector" value={`0x${up.image.reset.toString(16).padStart(8, "0")}`} />
            <PhReadout label="Vectors" value={up.image.vectorOk ? "OK" : "WARNING"}
              tone={up.image.vectorOk ? PH.accent : PH.warn} />
          </div>
        )}
      </PhPanel>

      <div style={{ display: "grid", gap: 18 }}>
        <PhPanel title="Web MIDI Transfer" rightMeta="SysEx required">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 12, alignItems: "end" }}>
            <label style={{ display: "grid", gap: 6, fontFamily: PH.mono, fontSize: 10, color: PH.inkMute }}>
              FROM PEDAL · MIDI INPUT
              <select value={up.inputId} onChange={(e) => up.setInputId(e.target.value)}
                disabled={up.busy || !up.access} style={inputStyle}>
                {up.inputs.map((p) => <option key={p.id} value={p.id}>{p.name || p.id}</option>)}
              </select>
            </label>
            <label style={{ display: "grid", gap: 6, fontFamily: PH.mono, fontSize: 10, color: PH.inkMute }}>
              TO PEDAL · MIDI OUTPUT
              <select value={up.outputId} onChange={(e) => up.setOutputId(e.target.value)}
                disabled={up.busy || !up.access} style={inputStyle}>
                {up.outputs.map((p) => <option key={p.id} value={p.id}>{p.name || p.id}</option>)}
              </select>
            </label>
            <button onClick={run(up.requestMidi)} disabled={up.busy}
              style={{ border: `1px solid ${PH.accent}`, background: up.access ? "transparent" : PH.accent,
                color: up.access ? PH.accent : PH.bg, fontFamily: PH.mono, fontWeight: 700,
                letterSpacing: "0.16em", padding: "11px 16px", cursor: up.busy ? "wait" : "pointer" }}>
              {up.access ? "REFRESH" : "CONNECT MIDI"}
            </button>
          </div>

          <div style={{ marginTop: 18, border: `1px solid ${PH.ruleStrong}`, height: 18,
            background: PH.bg, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.round(up.progress * 100)}%`,
              background: PH.accent, boxShadow: `0 0 14px ${PH.accent}` }} />
          </div>
          <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between",
            fontFamily: PH.mono, fontSize: 11, color: PH.inkDim }}>
            <span>{up.status}</span>
            <span>{Math.round(up.progress * 100)}%</span>
          </div>

          {error && <div style={{ marginTop: 12, color: PH.danger, fontFamily: PH.mono,
            fontSize: 11, letterSpacing: "0.08em" }}>{error}</div>}

          <div style={{ display: "flex", gap: 12, marginTop: 18 }}>
            <button onClick={run(up.enterDfu)} disabled={up.busy || !up.access}
              style={{ border: `1px solid ${PH.ruleStrong}`, background: "transparent",
                color: PH.accent, fontFamily: PH.mono, fontWeight: 700, letterSpacing: "0.16em",
                padding: "13px 18px", cursor: up.busy ? "wait" : "pointer",
                opacity: up.busy || !up.access ? 0.45 : 1 }}>
              ENTER DFU
            </button>
            {confirmFlash ? (
              <>
                <button onClick={() => { setConfirmFlash(false); run(up.flash)(); }}
                  style={{ border: `1px solid ${PH.danger}`, background: PH.danger,
                    color: PH.bg, fontFamily: PH.mono, fontWeight: 800, letterSpacing: "0.2em",
                    padding: "13px 18px", cursor: "pointer" }}>
                  CONFIRM FLASH
                </button>
                <button onClick={() => setConfirmFlash(false)}
                  style={{ border: `1px solid ${PH.rule}`, background: "transparent",
                    color: PH.inkDim, fontFamily: PH.mono, letterSpacing: "0.16em",
                    padding: "13px 18px", cursor: "pointer" }}>
                  CANCEL
                </button>
              </>
            ) : (
              <button onClick={() => setConfirmFlash(true)} disabled={up.busy || !up.access || !up.image}
                style={{ border: `1px solid ${PH.accent}`, background: PH.accent,
                  color: PH.bg, fontFamily: PH.mono, fontWeight: 800, letterSpacing: "0.2em",
                  padding: "13px 18px", cursor: up.busy ? "wait" : "pointer",
                  opacity: up.busy || !up.access || !up.image ? 0.45 : 1 }}>
                FLASH FIRMWARE
              </button>
            )}
          </div>
        </PhPanel>

        <PhPanel title="Updater Notes">
          <div style={{ fontFamily: PH.mono, fontSize: 11, lineHeight: 1.8, color: PH.inkDim }}>
            Use a signed firmware binary produced by <span style={{ color: PH.accent }}>sign_firmware.py</span>.
            Use ENTER DFU from app mode, or hold the pedal DFU control before flashing. Chrome or Edge must grant Web MIDI SysEx access.
            Select the browser's MIDI input (receiving from the pedal) as <span style={{ color: PH.accent }}>FROM PEDAL</span> and the
            browser's MIDI output (sending to the pedal) as <span style={{ color: PH.accent }}>TO PEDAL</span>.
            The transfer uses DIN-safe pacing: 120 ms between block frames and 400 ms after each page-erase trigger.
          </div>
        </PhPanel>

        <PhPanel title="Transfer Log">
          <PhConsole log={up.log.length ? up.log : [["--:--:--", "INFO", "No firmware transfer yet."]]} />
        </PhPanel>
      </div>
    </div>
  );
}

Object.assign(window, { FirmwareUpdaterPanel });
