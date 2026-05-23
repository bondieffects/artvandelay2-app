// Verifies CODE_REVIEW.md §C1 — claim was that concurrent sendCommand calls
// can deliver caller A's promise the response intended for caller B.
//
// This test loads src/transport.jsx in a vm context with shimmed globals,
// fires two sendCommand calls back-to-back, and asserts each caller receives
// the response matching its own command.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const SRC = fs.readFileSync(
  path.join(__dirname, "..", "src", "transport.jsx"),
  "utf8",
);

function loadTransport(mockAccess) {
  const context = {
    window: {},
    React: {},
    navigator: { requestMIDIAccess: async () => mockAccess },
    setTimeout,
    clearTimeout,
    console,
    Promise,
    Map,
    Set,
    Array,
    Date,
    String,
    Number,
    Object,
    Error,
    Symbol,
  };
  vm.createContext(context);
  vm.runInContext(SRC, context);
  return context.window.makeTransport();
}

function makeMockAccess(handleSend) {
  let onmidimessage = null;
  const input = {
    name: "Mock Art Van Delay 2 In",
    manufacturer: "BondiEffects",
    get onmidimessage() {
      return onmidimessage;
    },
    set onmidimessage(fn) {
      onmidimessage = fn;
    },
  };
  const output = {
    name: "Mock Art Van Delay 2 Out",
    manufacturer: "BondiEffects",
    send: (frame) =>
      handleSend(frame, (data) => {
        if (onmidimessage) onmidimessage({ data });
      }),
  };
  return {
    inputs: { values: () => [input][Symbol.iterator]() },
    outputs: { values: () => [output][Symbol.iterator]() },
    set onstatechange(_fn) {},
  };
}

function makeReplyHandler(perCommandDelayMs = {}) {
  return function handleSend(frame, reply) {
    const requestId = frame[3];
    const command = String.fromCharCode(...frame.slice(4, -1));
    const responseJson = JSON.stringify({ command, requestId });
    const ascii = Array.from(responseJson, (c) => c.charCodeAt(0) & 0x7f);
    const responseFrame = new Uint8Array([
      0xf0,
      0x7d,
      0x11,
      requestId,
      ...ascii,
      0xf7,
    ]);
    const delay = perCommandDelayMs[command] ?? 5;
    setTimeout(() => reply(responseFrame), delay);
  };
}

test("C1: two back-to-back sendCommand calls each receive their own response", async () => {
  const transport = loadTransport(makeMockAccess(makeReplyHandler()));
  await transport.connect();

  const [resultX, resultY] = await Promise.all([
    transport.sendCommand("cmd-X"),
    transport.sendCommand("cmd-Y"),
  ]);

  assert.equal(resultX.command, "cmd-X", "first caller should receive cmd-X response");
  assert.equal(resultY.command, "cmd-Y", "second caller should receive cmd-Y response");
});

test("C1: slow first command does not steal fast second command's response", async () => {
  const transport = loadTransport(
    makeMockAccess(makeReplyHandler({ "slow-cmd": 50, "fast-cmd": 1 })),
  );
  await transport.connect();

  const [slow, fast] = await Promise.all([
    transport.sendCommand("slow-cmd"),
    transport.sendCommand("fast-cmd"),
  ]);

  assert.equal(slow.command, "slow-cmd");
  assert.equal(fast.command, "fast-cmd");
});

test("C1: five concurrent calls all receive their own responses", async () => {
  const transport = loadTransport(makeMockAccess(makeReplyHandler()));
  await transport.connect();

  const cmds = ["a", "b", "c", "d", "e"];
  const results = await Promise.all(cmds.map((c) => transport.sendCommand(c)));
  for (let i = 0; i < cmds.length; i++) {
    assert.equal(results[i].command, cmds[i], `caller ${i} should receive ${cmds[i]}`);
  }
});
