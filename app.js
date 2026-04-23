const PARAMETER_NAMES = [
  { id: 0, label: "Delay Time" },
  { id: 1, label: "LFO Depth" },
  { id: 2, label: "LFO Rate" },
  { id: 3, label: "Effect Level" },
  { id: 4, label: "Feedback" },
  { id: 5, label: "Tilt" },
  { id: 6, label: "Subdivision" },
  { id: 7, label: "LFO Waveform" },
  { id: 8, label: "Expression" },
  { id: 9, label: "Bypass State" },
];

const WAVEFORM_LABELS = [
  "Sine",
  "Triangle",
  "S-Shaped",
  "Exponential",
  "Smooth Random",
  "Skewed Triangle",
  "Trapezoid",
];

const UI = {
  connectButton: document.querySelector("#connect-button"),
  disconnectButton: document.querySelector("#disconnect-button"),
  refreshAllButton: document.querySelector("#refresh-all-button"),
  refreshParamsButton: document.querySelector("#refresh-params-button"),
  refreshPresetsButton: document.querySelector("#refresh-presets-button"),
  refreshConfigButton: document.querySelector("#refresh-config-button"),
  clearLogButton: document.querySelector("#clear-log-button"),
  loadSelectedButton: document.querySelector("#load-selected-button"),
  connectionPill: document.querySelector("#connection-pill"),
  deviceLabel: document.querySelector("#device-label"),
  paramsGrid: document.querySelector("#params-grid"),
  lfoCanvas: document.querySelector("#lfo-canvas"),
  lfoStats: document.querySelector("#lfo-stats"),
  presetList: document.querySelector("#preset-list"),
  presetDetailTitle: document.querySelector("#preset-detail-title"),
  presetDetail: document.querySelector("#preset-detail"),
  logPanel: document.querySelector("#log-panel"),
  configForm: document.querySelector("#config-form"),
  expressionEnabled: document.querySelector("#expression-enabled"),
  expressionAssignment: document.querySelector("#expression-assignment"),
  expressionCurve: document.querySelector("#expression-curve"),
  expressionAutoAssign: document.querySelector("#expression-auto-assign"),
  expressionCalibrationMin: document.querySelector("#expression-calibration-min"),
  expressionCalibrationMax: document.querySelector("#expression-calibration-max"),
  saveConfigButton: document.querySelector("#save-config-button"),
};

const state = {
  port: null,
  reader: null,
  writer: null,
  readLoopPromise: null,
  keepReading: false,
  textEncoderStream: null,
  textDecoderStream: null,
  writableStreamClosed: null,
  readableStreamClosed: null,
  pendingResolvers: [],
  selectedSlot: null,
  currentParams: null,
  presetList: null,
  selectedPreset: null,
  config: null,
  deviceInfo: null,
  commandChain: Promise.resolve(),
  lfoAnimationFrame: null,
  lfoStartTime: performance.now(),
};

const lfoCanvasContext = UI.lfoCanvas.getContext("2d");

function logLine(message, type = "info") {
  const timestamp = new Date().toLocaleTimeString("en-AU", { hour12: false });
  UI.logPanel.textContent += `[${timestamp}] ${type.toUpperCase()} ${message}\n`;
  UI.logPanel.scrollTop = UI.logPanel.scrollHeight;
}

function setConnected(connected) {
  UI.connectionPill.textContent = connected ? "Online" : "Offline";
  UI.connectionPill.className = connected ? "pill pill-online" : "pill pill-offline";

  [
    UI.disconnectButton,
    UI.refreshAllButton,
    UI.refreshParamsButton,
    UI.refreshPresetsButton,
    UI.refreshConfigButton,
    UI.loadSelectedButton,
    UI.saveConfigButton,
  ].forEach((button) => {
    button.disabled = !connected || (button === UI.loadSelectedButton && state.selectedSlot === null);
  });

  UI.connectButton.disabled = connected;

  [
    UI.expressionEnabled,
    UI.expressionAssignment,
    UI.expressionCurve,
    UI.expressionAutoAssign,
    UI.expressionCalibrationMin,
    UI.expressionCalibrationMax,
  ].forEach((input) => {
    input.disabled = !connected;
  });
}

function renderParams(params) {
  UI.paramsGrid.innerHTML = "";

  if (!params) {
    UI.paramsGrid.innerHTML = `<div class="detail-empty">Connect to load device state.</div>`;
    return;
  }

  const entries = [
    ["Delay", `${params.delay_time_ms} ms`],
    ["LFO Depth", params.lfo_depth],
    ["LFO Rate", params.lfo_rate],
    ["Effect Level", params.effect_level],
    ["Feedback", params.feedback],
    ["Tilt", params.tilt],
    ["Subdivision", params.subdivision],
    ["LFO Waveform", params.lfo_waveform],
    ["Expression", params.expression],
    ["Bypass", params.bypass_state],
    ["Active Preset", params.active_preset],
    ["Preset Dirty", params.preset_dirty],
  ];

  for (const [label, value] of entries) {
    const card = document.createElement("article");
    card.className = "metric";
    card.innerHTML = `<p class="metric-label">${label}</p><p class="metric-value">${value}</p>`;
    UI.paramsGrid.append(card);
  }
}

function waveformNameFromId(id) {
  return WAVEFORM_LABELS[id] ?? `Wave ${id}`;
}

function lfoRateParamToHz(rateParam) {
  const minHz = 0.1;
  const maxHz = 10.0;
  const t = rateParam / 255;
  const curved = t * t;
  const hz = minHz * ((maxHz / minHz) ** curved);
  return Math.min(Math.max(hz, minHz), maxHz);
}

function lfoDepthParamToCents(depthParam) {
  return (depthParam * 25.0) / 255.0;
}

function smoothstep(value) {
  return value * value * (3 - (2 * value));
}

function triangleShape(phase) {
  return (2 / Math.PI) * Math.asin(Math.sin(2 * Math.PI * phase));
}

function smoothRandomShape(phase) {
  const points = [-0.806507, 0.440361, -0.294578, 0.814458, -0.612048, 0.121687, 0.620482, -0.283133];
  const count = points.length;
  const position = phase * count;
  const segment = Math.floor(position) % count;
  const local = position - segment;
  const eased = smoothstep(local);
  const start = points[segment];
  const end = points[(segment + 1) % count];
  return start + ((end - start) * eased);
}

function skewedTriangleShape(phase) {
  const skew = 0.72;
  if (phase < skew) {
    return -1 + (2 * (phase / skew));
  }
  return 1 - (2 * ((phase - skew) / (1 - skew)));
}

function trapezoidShape(phase) {
  const rise = 0.18;
  const high = 0.32;
  const fall = 0.18;
  const lowStart = rise + high + fall;

  if (phase < rise) {
    return -1 + (2 * (phase / rise));
  }
  if (phase < rise + high) {
    return 1;
  }
  if (phase < lowStart) {
    return 1 - (2 * ((phase - rise - high) / fall));
  }
  return -1;
}

function sampleWaveform(waveformId, phase) {
  const wrappedPhase = ((phase % 1) + 1) % 1;
  const triangle = triangleShape(wrappedPhase);

  switch (waveformId) {
    case 0:
      return Math.sin(2 * Math.PI * wrappedPhase);
    case 1:
      return triangle;
    case 2:
      return Math.tanh(2.4 * triangle) / Math.tanh(2.4);
    case 3:
      return Math.sign(triangle || 1) * (Math.abs(triangle) ** 2.2);
    case 4:
      return smoothRandomShape(wrappedPhase);
    case 5:
      return skewedTriangleShape(wrappedPhase);
    case 6:
      return trapezoidShape(wrappedPhase);
    default:
      return Math.sin(2 * Math.PI * wrappedPhase);
  }
}

function renderLfoStats(params) {
  UI.lfoStats.innerHTML = "";

  const waveformId = params?.lfo_waveform ?? 0;
  const rateParam = params?.lfo_rate ?? 0;
  const depthParam = params?.lfo_depth ?? 0;
  const stats = [
    ["Waveform", waveformNameFromId(waveformId)],
    ["Rate", `${lfoRateParamToHz(rateParam).toFixed(2)} Hz`],
    ["Depth", `${lfoDepthParamToCents(depthParam).toFixed(1)} cents`],
    ["Rate Param", rateParam],
    ["Depth Param", depthParam],
  ];

  for (const [label, value] of stats) {
    const card = document.createElement("article");
    card.className = "metric";
    card.innerHTML = `<p class="metric-label">${label}</p><p class="metric-value">${value}</p>`;
    UI.lfoStats.append(card);
  }
}

function drawLfoVisualizer(timestamp) {
  const ctx = lfoCanvasContext;
  const canvas = UI.lfoCanvas;
  const width = canvas.width;
  const height = canvas.height;
  const paddingX = 24;
  const paddingY = 28;
  const graphWidth = width - (paddingX * 2);
  const graphHeight = height - (paddingY * 2);
  const midY = paddingY + (graphHeight / 2);
  const topY = paddingY;
  const bottomY = height - paddingY;

  ctx.clearRect(0, 0, width, height);

  const background = ctx.createLinearGradient(0, 0, 0, height);
  background.addColorStop(0, "rgba(255,255,255,0.98)");
  background.addColorStop(1, "rgba(247,241,239,0.96)");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(16,16,16,0.08)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = topY + ((graphHeight / 4) * i);
    ctx.beginPath();
    ctx.moveTo(paddingX, y);
    ctx.lineTo(width - paddingX, y);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(233,74,154,0.18)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 8; i += 1) {
    const x = paddingX + ((graphWidth / 8) * i);
    ctx.beginPath();
    ctx.moveTo(x, topY);
    ctx.lineTo(x, bottomY);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(16,16,16,0.22)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(paddingX, midY);
  ctx.lineTo(width - paddingX, midY);
  ctx.stroke();

  const waveformId = state.currentParams?.lfo_waveform ?? 0;
  const rateHz = lfoRateParamToHz(state.currentParams?.lfo_rate ?? 0);
  const depthCents = lfoDepthParamToCents(state.currentParams?.lfo_depth ?? 0);
  const depthScale = Math.max(0.08, depthCents / 25.0);
  const amplitude = (graphHeight * 0.42) * depthScale;
  const phaseOffset = ((timestamp - state.lfoStartTime) / 1000) * rateHz;

  ctx.strokeStyle = "#101010";
  ctx.lineWidth = 4;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();

  for (let step = 0; step <= graphWidth; step += 1) {
    const x = paddingX + step;
    const phase = step / graphWidth;
    const sample = sampleWaveform(waveformId, phase);
    const y = midY - (sample * amplitude);
    if (step === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();

  const animatedSample = sampleWaveform(waveformId, phaseOffset);
  const animatedX = paddingX + ((phaseOffset % 1 + 1) % 1) * graphWidth;
  const animatedY = midY - (animatedSample * amplitude);

  ctx.fillStyle = "#e94a9a";
  ctx.beginPath();
  ctx.arc(animatedX, animatedY, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(233,74,154,0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(animatedX, topY);
  ctx.lineTo(animatedX, bottomY);
  ctx.stroke();

  ctx.fillStyle = "#bc2c75";
  ctx.font = '600 18px "Proxima Nova", "Avenir Next", sans-serif';
  ctx.fillText(waveformNameFromId(waveformId), paddingX, 20);

  state.lfoAnimationFrame = window.requestAnimationFrame(drawLfoVisualizer);
}

function ensureLfoAnimation() {
  if (state.lfoAnimationFrame !== null) {
    return;
  }
  state.lfoAnimationFrame = window.requestAnimationFrame(drawLfoVisualizer);
}

function renderPresetList() {
  UI.presetList.innerHTML = "";

  if (!state.presetList) {
    UI.presetList.innerHTML = `<div class="detail-empty">Connect to inspect preset slots.</div>`;
    return;
  }

  for (const slot of state.presetList.slots) {
    const card = document.createElement("article");
    card.className = "preset-card";

    if (slot.slot === state.presetList.active) {
      card.classList.add("is-active");
    }
    if (slot.slot === state.selectedSlot) {
      card.classList.add("is-selected");
    }

    const validityTag = slot.valid
      ? `<span class="tag tag-valid">Valid</span>`
      : `<span class="tag tag-empty">Empty</span>`;
    const activeTag = slot.slot === state.presetList.active
      ? `<span class="tag">Active</span>`
      : "";
    const dirtyTag = state.presetList.dirty && slot.slot === state.presetList.active
      ? `<span class="tag tag-dirty">Dirty</span>`
      : "";

    card.innerHTML = `
      <header>
        <div>
          <strong>Slot ${slot.slot}</strong>
          <div class="preset-meta">${validityTag}${activeTag}${dirtyTag}</div>
        </div>
      </header>
      <div class="preset-actions">
        <button class="button button-ghost" type="button" data-action="inspect" data-slot="${slot.slot}">Inspect</button>
        <button class="button button-secondary" type="button" data-action="load" data-slot="${slot.slot}" ${slot.valid ? "" : "disabled"}>Load</button>
        <button class="button button-primary" type="button" data-action="save" data-slot="${slot.slot}">Save</button>
      </div>
    `;

    UI.presetList.append(card);
  }
}

function renderPresetDetail() {
  if (!state.selectedPreset) {
    UI.presetDetailTitle.textContent = "Select a Slot";
    UI.presetDetail.className = "detail-grid detail-empty";
    UI.presetDetail.textContent = "No preset selected.";
    UI.loadSelectedButton.disabled = true;
    return;
  }

  UI.presetDetailTitle.textContent = `Slot ${state.selectedPreset.preset.slot}`;
  UI.presetDetail.className = "detail-grid";
  UI.loadSelectedButton.disabled = !state.port || !state.selectedPreset.preset.valid;

  const detailEntries = [
    ["Valid", state.selectedPreset.preset.valid],
    ["Active", state.selectedPreset.active],
    ["Dirty", state.selectedPreset.dirty],
    ["Delay Time", `${state.selectedPreset.preset.delay_time_ms} ms`],
    ["LFO Depth", state.selectedPreset.preset.lfo_depth],
    ["LFO Rate", state.selectedPreset.preset.lfo_rate],
    ["Effect Level", state.selectedPreset.preset.effect_level],
    ["Feedback", state.selectedPreset.preset.feedback],
    ["Tilt", state.selectedPreset.preset.tilt],
    ["Subdivision", state.selectedPreset.preset.subdivision],
    ["LFO Waveform", state.selectedPreset.preset.lfo_waveform],
    ["Expression", state.selectedPreset.preset.expression],
    ["Bypass", state.selectedPreset.preset.bypass_state],
  ];

  UI.presetDetail.innerHTML = detailEntries
    .map(([label, value]) => `
      <article class="detail-item">
        <p class="detail-label">${label}</p>
        <p class="detail-value">${value}</p>
      </article>
    `)
    .join("");
}

function populateAssignmentSelect() {
  UI.expressionAssignment.innerHTML = PARAMETER_NAMES
    .map((entry) => `<option value="${entry.id}">${entry.id} - ${entry.label}</option>`)
    .join("");
}

function renderConfig() {
  if (!state.config) {
    UI.expressionEnabled.value = "false";
    UI.expressionAssignment.value = "0";
    UI.expressionCurve.value = "0";
    UI.expressionAutoAssign.value = "false";
    UI.expressionCalibrationMin.value = "";
    UI.expressionCalibrationMax.value = "";
    return;
  }

  UI.expressionEnabled.value = String(state.config.expression_enabled);
  UI.expressionAssignment.value = String(state.config.expression_assignment);
  UI.expressionCurve.value = String(state.config.expression_curve);
  UI.expressionAutoAssign.value = String(state.config.expression_auto_assign);
  UI.expressionCalibrationMin.value = String(state.config.expression_calibration_min);
  UI.expressionCalibrationMax.value = String(state.config.expression_calibration_max);
}

function renderDeviceLabel() {
  if (!state.deviceInfo) {
    UI.deviceLabel.textContent = "Not connected";
    return;
  }

  const firmware = state.deviceInfo.firmware;
  UI.deviceLabel.textContent =
    `${state.deviceInfo.device} v${firmware.major}.${firmware.minor}.${firmware.patch}.${firmware.tweak}`;
}

async function openPort() {
  if (!("serial" in navigator)) {
    throw new Error("Web Serial is not available in this browser.");
  }

  state.port = await navigator.serial.requestPort();
  await state.port.open({ baudRate: 115200 });

  state.textDecoderStream = new TextDecoderStream();
  state.readableStreamClosed = state.port.readable.pipeTo(state.textDecoderStream.writable);
  state.reader = state.textDecoderStream.readable.getReader();

  state.textEncoderStream = new TextEncoderStream();
  state.writableStreamClosed = state.textEncoderStream.readable.pipeTo(state.port.writable);
  state.writer = state.textEncoderStream.writable.getWriter();

  state.keepReading = true;
  state.readLoopPromise = readLoop();
}

async function closePort() {
  state.keepReading = false;

  if (state.reader) {
    try {
      await state.reader.cancel();
    } catch (error) {
      logLine(`Reader cancel warning: ${error.message}`, "warn");
    }
  }

  if (state.readLoopPromise) {
    await state.readLoopPromise.catch(() => {});
  }

  if (state.writer) {
    await state.writer.close().catch(() => {});
    state.writer.releaseLock();
    state.writer = null;
  }

  if (state.writableStreamClosed) {
    await state.writableStreamClosed.catch(() => {});
    state.writableStreamClosed = null;
  }

  if (state.readableStreamClosed) {
    await state.readableStreamClosed.catch(() => {});
    state.readableStreamClosed = null;
  }

  if (state.port) {
    await state.port.close().catch(() => {});
    state.port = null;
  }

  state.reader = null;
  state.textEncoderStream = null;
  state.textDecoderStream = null;
  state.pendingResolvers = [];
}

async function readLoop() {
  let buffer = "";

  try {
    while (state.keepReading && state.reader) {
      const { value, done } = await state.reader.read();
      if (done) {
        break;
      }

      buffer += value;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";

      for (const rawLine of lines) {
        handleIncomingLine(rawLine.trim());
      }
    }
  } catch (error) {
    logLine(`Read loop stopped: ${error.message}`, "warn");
  } finally {
    if (state.reader) {
      state.reader.releaseLock();
      state.reader = null;
    }
  }
}

function handleIncomingLine(line) {
  if (!line) {
    return;
  }

  if (line.startsWith("artvandelay2:~$")) {
    return;
  }

  let parsed = null;
  try {
    parsed = JSON.parse(line);
  } catch (_error) {
    logLine(line, "serial");
    return;
  }

  const resolver = state.pendingResolvers.shift();
  if (resolver) {
    resolver.resolve(parsed);
  } else {
    logLine(`Unmatched JSON: ${line}`, "warn");
  }
}

async function sendCommand(command) {
  if (!state.port || !state.writer) {
    throw new Error("Not connected.");
  }

  state.commandChain = state.commandChain.then(async () => {
    logLine(`> ${command}`, "tx");

    const responsePromise = new Promise((resolve, reject) => {
      state.pendingResolvers.push({ resolve, reject });
      window.setTimeout(() => {
        const index = state.pendingResolvers.findIndex((entry) => entry.resolve === resolve);
        if (index >= 0) {
          state.pendingResolvers.splice(index, 1);
          reject(new Error(`Timed out waiting for JSON response to "${command}"`));
        }
      }, 3000);
    });

    await state.writer.write(`${command}\n`);
    const response = await responsePromise;
    logLine(`< ${JSON.stringify(response)}`, "rx");
    return response;
  });

  return state.commandChain;
}

async function fetchInfo() {
  state.deviceInfo = await sendCommand("web info");
  renderDeviceLabel();
}

async function fetchParams() {
  state.currentParams = await sendCommand("web param get");
  renderParams(state.currentParams);
  renderLfoStats(state.currentParams);
}

async function fetchPresetList() {
  state.presetList = await sendCommand("web preset list");
  renderPresetList();
}

async function fetchPreset(slot) {
  state.selectedSlot = slot;
  state.selectedPreset = await sendCommand(`web preset get ${slot}`);
  renderPresetList();
  renderPresetDetail();
}

async function fetchConfig() {
  state.config = await sendCommand("web config get");
  renderConfig();
}

async function refreshAll() {
  await fetchInfo();
  await fetchParams();
  await fetchPresetList();
  await fetchConfig();

  if (state.selectedSlot !== null) {
    await fetchPreset(state.selectedSlot);
  }
}

async function loadSlot(slot) {
  const response = await sendCommand(`web preset load ${slot}`);
  if (response.error) {
    throw new Error(response.error);
  }

  await refreshAll();
}

async function saveSlot(slot) {
  const response = await sendCommand(`web preset save ${slot}`);
  if (response.error) {
    throw new Error(response.error);
  }

  await refreshAll();
  await fetchPreset(slot);
}

async function saveConfig() {
  const updates = [
    ["expression_enabled", UI.expressionEnabled.value],
    ["expression_assignment", UI.expressionAssignment.value],
    ["expression_curve", UI.expressionCurve.value],
    ["expression_auto_assign", UI.expressionAutoAssign.value],
    ["expression_calibration_min", UI.expressionCalibrationMin.value],
    ["expression_calibration_max", UI.expressionCalibrationMax.value],
  ];

  for (const [key, value] of updates) {
    const response = await sendCommand(`web config set ${key} ${value}`);
    if (response.error) {
      throw new Error(`${key}: ${response.error}`);
    }
    state.config = response;
  }

  renderConfig();
}

async function withBusyState(task, label) {
  try {
    document.body.style.cursor = "progress";
    await task();
  } catch (error) {
    logLine(`${label}: ${error.message}`, "error");
  } finally {
    document.body.style.cursor = "";
  }
}

UI.connectButton.addEventListener("click", () => {
  withBusyState(async () => {
    await openPort();
    setConnected(true);
    logLine("Serial port connected.");
    await refreshAll();
  }, "Connect failed");
});

UI.disconnectButton.addEventListener("click", () => {
  withBusyState(async () => {
    await closePort();
    setConnected(false);
    state.currentParams = null;
    state.presetList = null;
    state.selectedPreset = null;
    state.config = null;
    state.deviceInfo = null;
    renderDeviceLabel();
    renderParams(null);
    renderPresetList();
    renderPresetDetail();
    renderConfig();
    logLine("Serial port disconnected.");
  }, "Disconnect failed");
});

UI.refreshAllButton.addEventListener("click", () => withBusyState(refreshAll, "Refresh failed"));
UI.refreshParamsButton.addEventListener("click", () => withBusyState(fetchParams, "Param refresh failed"));
UI.refreshPresetsButton.addEventListener("click", () => withBusyState(fetchPresetList, "Preset refresh failed"));
UI.refreshConfigButton.addEventListener("click", () => withBusyState(fetchConfig, "Config refresh failed"));

UI.loadSelectedButton.addEventListener("click", () => {
  if (state.selectedSlot === null) {
    return;
  }
  withBusyState(() => loadSlot(state.selectedSlot), "Preset load failed");
});

UI.presetList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-slot]");
  if (!button) {
    return;
  }

  const slot = Number(button.dataset.slot);
  const action = button.dataset.action;

  if (action === "inspect") {
    withBusyState(() => fetchPreset(slot), "Preset fetch failed");
  } else if (action === "load") {
    withBusyState(() => loadSlot(slot), "Preset load failed");
  } else if (action === "save") {
    withBusyState(() => saveSlot(slot), "Preset save failed");
  }
});

UI.configForm.addEventListener("submit", (event) => {
  event.preventDefault();
  withBusyState(saveConfig, "Config save failed");
});

UI.clearLogButton.addEventListener("click", () => {
  UI.logPanel.textContent = "";
});

window.addEventListener("beforeunload", () => {
  if (state.lfoAnimationFrame !== null) {
    window.cancelAnimationFrame(state.lfoAnimationFrame);
    state.lfoAnimationFrame = null;
  }
  if (state.port) {
    closePort().catch(() => {});
  }
});

populateAssignmentSelect();
renderDeviceLabel();
renderParams(null);
renderLfoStats(null);
renderPresetList();
renderPresetDetail();
renderConfig();
setConnected(false);
ensureLfoAnimation();
