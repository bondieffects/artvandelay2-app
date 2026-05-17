// Web MIDI SysEx transport for the Art Van Delay 2 editor protocol.
//
// TX: F0 7D 10 <request-id> <ASCII command> F7
// RX: F0 7D 11 <request-id> <ASCII JSON response> F7

const WEB_MIDI = {
  MFR_ID: 0x7d,
  CMD_REQUEST: 0x10,
  CMD_RESPONSE: 0x11,
  CMD_EVENT: 0x12,
};

function makeTransport() {
  let access = null;
  let input = null;
  let output = null;
  let commandChain = Promise.resolve();
  let nextRequestId = 1;

  const pending = new Map();
  const subs = { log: new Set(), status: new Set() };
  let status = "disconnected";

  const emit = (kind, payload) => subs[kind].forEach((fn) => { try { fn(payload); } catch {} });
  const log = (type, msg) => emit("log", { t: stamp(), type, msg });
  const setStatus = (s, detail) => { status = s; emit("status", { status: s, detail }); };

  function choosePort(ports, preferredName) {
    const art = ports.find((p) => /artvandelay|art van delay|bondi/i.test(`${p.name || ""} ${p.manufacturer || ""}`));
    if (art) return art;
    if (preferredName) {
      const named = ports.find((p) => (p.name || "") === preferredName);
      if (named) return named;
    }
    return ports[0] || null;
  }

  async function requestAccess() {
    if (!navigator.requestMIDIAccess) {
      throw new Error("Web MIDI is not available in this browser.");
    }
    access = await navigator.requestMIDIAccess({ sysex: true });
    access.onstatechange = () => {
      if (status === "connected") {
        bindPorts();
      }
    };
    return access;
  }

  function bindPorts() {
    if (!access) return;
    const inputs = Array.from(access.inputs.values());
    const outputs = Array.from(access.outputs.values());
    const nextInput = choosePort(inputs, input?.name);
    const nextOutput = choosePort(outputs, output?.name);

    if (input && input !== nextInput) input.onmidimessage = null;
    input = nextInput;
    output = nextOutput;
    if (input) input.onmidimessage = onMidiMessage;
  }

  async function connect() {
    if (status === "connected") return;
    setStatus("connecting");
    try {
      await requestAccess();
      bindPorts();
      if (!input || !output) {
        throw new Error("No USB MIDI input/output pair found.");
      }
      setStatus("connected");
      log("INFO", `USB MIDI connected: ${output.name || output.id}`);
    } catch (e) {
      await disconnect();
      setStatus("error", e.message);
      log("ERR", `Connect failed: ${e.message}`);
      throw e;
    }
  }

  async function disconnect() {
    if (input) input.onmidimessage = null;
    input = null;
    output = null;
    access = null;
    for (const waiter of pending.values()) {
      clearTimeout(waiter.timer);
      waiter.reject(new Error("MIDI disconnected."));
    }
    pending.clear();
    setStatus("disconnected");
  }

  function onMidiMessage(event) {
    const data = Array.from(event.data || []);
    if (data[0] !== 0xf0 || data[data.length - 1] !== 0xf7) return;
    const payload = data.slice(1, -1);
    if (payload[0] !== WEB_MIDI.MFR_ID) return;

    if (payload[1] === WEB_MIDI.CMD_RESPONSE) {
      const requestId = payload[2];
      const waiter = pending.get(requestId);
      if (!waiter) return;
      pending.delete(requestId);
      clearTimeout(waiter.timer);
      const text = asciiFromBytes(payload.slice(3));
      log("RX", `< ${text}`);
      try { waiter.resolve(JSON.parse(text)); }
      catch { waiter.reject(new Error(`Invalid JSON response: ${text}`)); }
      return;
    }

    if (payload[1] === WEB_MIDI.CMD_EVENT) {
      log("MIDI", asciiFromBytes(payload.slice(2)));
    }
  }

  function sendCommand(command) {
    if (!output) return Promise.reject(new Error("Not connected."));

    commandChain = commandChain.then(async () => {
      const requestId = nextRequestId;
      nextRequestId = (nextRequestId + 1) & 0x7f;
      if (nextRequestId === 0) nextRequestId = 1;

      const frame = [0xf0, WEB_MIDI.MFR_ID, WEB_MIDI.CMD_REQUEST, requestId]
        .concat(bytesFromAscii(command), [0xf7]);

      log("TX", `> ${command}`);
      const responsePromise = new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(requestId);
          reject(new Error(`Timed out waiting for MIDI response to "${command}"`));
        }, 3000);
        pending.set(requestId, { resolve, reject, timer });
      });

      output.send(frame);
      return responsePromise;
    });

    return commandChain;
  }

  const api = {
    info:       () => sendCommand("web info"),
    paramGet:   () => sendCommand("web param get"),
    presetList: () => sendCommand("web preset list"),
    presetGet:  (slot) => sendCommand(`web preset get ${slot}`),
    presetLoad: (slot) => sendCommand(`web preset load ${slot}`),
    presetSave: (slot) => sendCommand(`web preset save ${slot}`),
    configGet:  () => sendCommand("web config get"),
    configSet:  (key, value) => sendCommand(`web config set ${key} ${value}`),
    rebootDfu:   () => sendCommand("web dfu"),
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

function bytesFromAscii(text) {
  return Array.from(text, (ch) => ch.charCodeAt(0) & 0x7f);
}

function asciiFromBytes(bytes) {
  return String.fromCharCode(...bytes.map((b) => b & 0x7f));
}

function stamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

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
