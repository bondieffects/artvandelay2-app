// web/src/transport.jsx
// Web Serial wrapper for the Art Van Delay 2 JSON shell.
// Protocol matches legacy web/app.js exactly.
//
//   TX: newline-terminated ASCII. Commands are serialized through a promise chain
//       so only one is in flight at a time. 3-second timeout per command.
//   RX: newline-delimited JSON. Shell prompt lines ("artvandelay2:~$ …") ignored.
//       Non-JSON lines go to the log as "serial" messages. Each JSON line
//       resolves the oldest pending command.
//
// Commands (exactly as the firmware exposes them):
//   web info                     → {device, firmware:{major,minor,patch,tweak}}
//   web param get                → {delay_time_ms, lfo_depth, …, active_preset, preset_dirty}
//   web preset list              → {active, dirty, slots:[{slot, valid}, …]}
//   web preset get <slot>        → {active, dirty, preset:{slot, valid, …fields}}
//   web preset load <slot>       → {...} (response echoes new state; or {error:"…"})
//   web preset save <slot>       → {active, dirty, preset:{…}} (same shape as `get`)
//   web config get               → {expression_enabled, expression_assignment, …}
//   web config set <key> <value> → {...full config} or {error:"…"}
//
// No unsolicited push events, no `web param set` — live params only change
// via `preset load` or firmware-side controls. Poll `web param get` to track them.

function makeTransport() {
  let port = null;
  let reader = null;
  let writer = null;
  let textEncoderStream = null;
  let textDecoderStream = null;
  let writableStreamClosed = null;
  let readableStreamClosed = null;
  let readLoopPromise = null;
  let keepReading = false;
  let commandChain = Promise.resolve();
  const pendingResolvers = [];

  const subs = { log: new Set(), status: new Set() };
  let status = "disconnected"; // disconnected | connecting | connected | error

  const emit = (kind, payload) => subs[kind].forEach((fn) => { try { fn(payload); } catch {} });
  const log = (type, msg) => emit("log", { t: stamp(), type, msg });
  const setStatus = (s, detail) => { status = s; emit("status", { status: s, detail }); };

  // ── Open / close ─────────────────────────────────────────
  async function connect({ baudRate = 115200 } = {}) {
    if (!("serial" in navigator)) {
      const err = new Error("Web Serial is not available in this browser.");
      log("ERR", err.message);
      setStatus("error", err.message);
      throw err;
    }
    if (port) return;
    setStatus("connecting");
    try {
      port = await navigator.serial.requestPort();
      await port.open({ baudRate });

      textDecoderStream = new TextDecoderStream();
      readableStreamClosed = port.readable.pipeTo(textDecoderStream.writable);
      reader = textDecoderStream.readable.getReader();

      textEncoderStream = new TextEncoderStream();
      writableStreamClosed = textEncoderStream.readable.pipeTo(port.writable);
      writer = textEncoderStream.writable.getWriter();

      keepReading = true;
      readLoopPromise = readLoop();
      setStatus("connected");
      log("INFO", "Serial port connected.");
    } catch (e) {
      setStatus("error", e.message);
      log("ERR", `Connect failed: ${e.message}`);
      await hardTeardown();
      throw e;
    }
  }

  async function disconnect() {
    if (!port) return;
    keepReading = false;
    log("INFO", "Disconnecting…");
    try { reader && await reader.cancel(); } catch (e) { log("WARN", `Reader cancel: ${e.message}`); }
    try { await readLoopPromise; } catch {}
    await hardTeardown();
    setStatus("disconnected");
    log("INFO", "Serial port closed.");
  }

  async function hardTeardown() {
    if (writer) {
      try { await writer.close(); } catch {}
      try { writer.releaseLock(); } catch {}
      writer = null;
    }
    if (writableStreamClosed) { try { await writableStreamClosed; } catch {} writableStreamClosed = null; }
    if (readableStreamClosed) { try { await readableStreamClosed; } catch {} readableStreamClosed = null; }
    if (port) { try { await port.close(); } catch {} port = null; }
    while (pendingResolvers.length) {
      const { reject } = pendingResolvers.shift();
      try { reject(new Error("Port closed")); } catch {}
    }
    reader = null;
    textEncoderStream = null;
    textDecoderStream = null;
  }

  // ── Read loop ────────────────────────────────────────────
  async function readLoop() {
    let buffer = "";
    try {
      while (keepReading && reader) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";
        for (const raw of lines) handleIncomingLine(raw.trim());
      }
    } catch (e) {
      log("WARN", `Read loop stopped: ${e.message}`);
    } finally {
      if (reader) { try { reader.releaseLock(); } catch {} reader = null; }
    }
  }

  function handleIncomingLine(line) {
    if (!line) return;
    // Ignore the Zephyr shell prompt lines.
    if (line.startsWith("artvandelay2:~$")) return;

    let parsed = null;
    try { parsed = JSON.parse(line); }
    catch { log("SERIAL", line); return; }

    log("RX", `< ${line}`);
    const resolver = pendingResolvers.shift();
    if (resolver) resolver.resolve(parsed);
    else log("WARN", `Unmatched JSON: ${line}`);
  }

  // ── Send / request (serialized via commandChain) ─────────
  function sendCommand(command) {
    if (!port || !writer) return Promise.reject(new Error("Not connected."));

    commandChain = commandChain.then(async () => {
      log("TX", `> ${command}`);
      const responsePromise = new Promise((resolve, reject) => {
        pendingResolvers.push({ resolve, reject });
        setTimeout(() => {
          const idx = pendingResolvers.findIndex((e) => e.resolve === resolve);
          if (idx >= 0) {
            pendingResolvers.splice(idx, 1);
            reject(new Error(`Timed out waiting for JSON response to "${command}"`));
          }
        }, 3000);
      });
      await writer.write(`${command}\n`);
      return responsePromise;
    });

    return commandChain;
  }

  // ── High-level API — one method per documented command ─
  const api = {
    info:       () => sendCommand("web info"),
    paramGet:   () => sendCommand("web param get"),
    presetList: () => sendCommand("web preset list"),
    presetGet:  (slot) => sendCommand(`web preset get ${slot}`),
    presetLoad: (slot) => sendCommand(`web preset load ${slot}`),
    presetSave: (slot) => sendCommand(`web preset save ${slot}`),
    configGet:  () => sendCommand("web config get"),
    configSet:  (key, value) => sendCommand(`web config set ${key} ${value}`),
    sendCommand,
  };

  const subscribe = (kind, fn) => { subs[kind].add(fn); return () => subs[kind].delete(fn); };

  return {
    connect, disconnect,
    get status() { return status; },
    get connected() { return status === "connected"; },
    onLog:    (fn) => subscribe("log", fn),
    onStatus: (fn) => subscribe("status", fn),
    ...api,
  };
}

// ── helpers ────────────────────────────────────────────────
function stamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// ── React hook ─────────────────────────────────────────────
function useTransport() {
  const transportRef = React.useRef(null);
  if (!transportRef.current) transportRef.current = makeTransport();
  const t = transportRef.current;

  const [status, setStatus] = React.useState(t.status);
  const [log, setLog] = React.useState([]);

  React.useEffect(() => {
    const offStatus = t.onStatus(({ status }) => setStatus(status));
    const offLog = t.onLog((entry) => setLog((L) => {
      const next = L.concat([[entry.t, entry.type, entry.msg]]);
      return next.length > 500 ? next.slice(next.length - 500) : next;
    }));
    return () => { offStatus(); offLog(); };
  }, [t]);

  return { transport: t, status, connected: status === "connected", log };
}

Object.assign(window, { makeTransport, useTransport });
