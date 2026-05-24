# MIDI Testing with the Morningstar MC6 Pro

## How the MC6 acts as a bridge

When the MC6 Pro is connected via USB, it exposes four virtual MIDI ports to the host. Port 1 ("Morningstar MC6 Pro") is a **full-duplex USB↔DIN bridge**: any MIDI sent to it from the host is relayed out the DIN OUT jack, and any MIDI received on the DIN IN jack is forwarded back up to the host. This means you can send MIDI CCs and SysEx to the AVD2 directly from the browser without programming any MC6 presets.

```
Browser → Web MIDI → MC6 output-1 → DIN OUT → AVD2 DIN IN
AVD2 DIN OUT → DIN IN → MC6 input-0 → Web MIDI → Browser
```

The AVD2's web SysEx protocol (`F0 7D ...`) also travels this path, so a single MC6 USB connection serves both live-parameter monitoring and DIN MIDI testing at the same time.

## Sending CCs from the browser

```js
const access = await navigator.requestMIDIAccess({ sysex: true });

// MC6 port 1 is always named "Morningstar MC6 Pro"
const out = Array.from(access.outputs.values())
  .find(o => o.name === 'Morningstar MC6 Pro');

// Send a Control Change on channel 1
const sendCC = (cc, value) => out.send([0xB0, cc, value]);

sendCC(28, 64);  // bypass
sendCC(28, 0);   // activate
```

## AVD2 CC map (channel 1)

| CC | Parameter | Range | Notes |
|----|-----------|-------|-------|
| 20 | delay_time_ms | 0–127 → 20–1000 ms | |
| 21 | lfo_depth | 0–127 → 0–255 | |
| 22 | lfo_rate | 0–127 → 0–255 | |
| 23 | effect_level | 0–127 → 0–255 | |
| 24 | feedback | 0–127 → 0–255 | |
| 25 | tilt | 0–127 → 0–255 | |
| 26 | subdivision | 0–127 → index 0–6 | 1/1, 1/2, 1/3, 1/4, 1/6, 1/8, 1/16 |
| 27 | lfo_waveform | 0–127 → index 0–6 | Sine, Triangle, S-Shaped, Exponential, Smooth Rand, Skewed Tri, Trapezoid |
| 28 | bypass | < 64 = active, ≥ 64 = bypass | Drives relay + LED |
| 29 | expression | 0–127 → 0–255 | 7-bit scaled to 8-bit (mid = 129, not 128) |
| 30 | tap tempo | any | Each message is a tap |
| 31 | bypass type | < 64 = true bypass, ≥ 64 = trails | Drives relay + LED colour |
| 32 | knob mode | — | Not reflected in `web param get` |
| PC | preset load | 0–7 | Program Change loads preset slot |

### bypass_state encoding

`bypass_state: true` in the `web param get` JSON means **the effect is bypassed** (signal passes dry). `bypass_state: false` means the effect is active. The web editor labels this "ACTIVE" when `true`, meaning "active bypass state" — not "effect is active".

## Querying params after sending a CC

```js
const in0 = Array.from(access.inputs.values())
  .find(i => i.name === 'Morningstar MC6 Pro');

let reqId = 1;

function getParams() {
  return new Promise((resolve, reject) => {
    const id = reqId++ & 0x7F;
    const cmd = 'web param get';
    const frame = [0xF0, 0x7D, 0x10, id,
      ...Array.from(cmd, c => c.charCodeAt(0)), 0xF7];

    const timer = setTimeout(() => {
      in0.onmidimessage = null;
      reject(new Error('timeout'));
    }, 3000);

    in0.onmidimessage = (ev) => {
      const d = Array.from(ev.data);
      if (d[0] === 0xF0 && d[1] === 0x7D && d[2] === 0x11 && d[3] === id) {
        clearTimeout(timer);
        in0.onmidimessage = null;
        const json = String.fromCharCode(...d.slice(4, -1).map(b => b & 0x7F));
        try { resolve(JSON.parse(json)); } catch (e) { reject(e); }
      }
    };

    out.send(frame);
  });
}

// Example: verify bypass CC
const before = await getParams();
sendCC(28, 64);
await new Promise(r => setTimeout(r, 400));
const after = await getParams();
console.log(before.bypass_state, '->', after.bypass_state);
```

## MC6 SysEx API (for programming presets)

The MC6 Pro SysEx API (`mc6_sysex_api.pdf`) lets you configure presets remotely. The frame format is:

```
F0 00 21 24 <device_id> 00 70 <op2> <op3> <op4> <op5> <op6> <op7>
   <tx_id> 00 00 [payload...] <checksum> F7
```

- **Device ID:** `0x03` for MC6, `0x06` for MC6 Pro  
- **Checksum:** XOR of all bytes from `op1` through the second-to-last payload byte, then AND with `0x7F`

Key opcodes:

| op2 | Function |
|-----|----------|
| `0x04` | Update Preset Message (programs a button with PC/CC/etc.) |
| `0x05` | Update Preset Other Data (toggle, blink, scroll) |
| `0x10` | Update Current Bank Name |
| `0x11` | Display message on LCD |
| `0x21` | Get Preset Short Name |
| `0x31` | Get toggle states |
| `0x32` | Get controller information (firmware version, model, etc.) |
| `0x7F` | Empty Preset |

For `op2 = 0x04` (Update Preset Message), the CC payload is:

```
Action Type | Toggle Type | CC Number | CC Value | MIDI Channel
```

Action types include `0x01` (PRESS), `0x02` (RELEASE), `0x0B` (ON DISENGAGE), `0x0C` (ON FIRST ENGAGE).

For testing purposes the direct Web MIDI approach above is simpler — the MC6 SysEx API is more useful for deploying a fixed set of CC mappings to the device for live use.
