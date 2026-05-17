# Art Van Delay 2 Web Editor

Web UI for the Art Van Delay 2 firmware. The editor and firmware updater both
use Web MIDI SysEx, so public builds no longer require Web Serial or USB CDC.
The app is intended to be served from GitHub Pages over HTTPS.

**Requires Chrome or Edge desktop.** Web MIDI SysEx is not supported in Firefox
or Safari.

## Build

Install dependencies once:

```bash
npm install
```

Build the self-contained static site:

```bash
npm run build
```

Output goes to `dist/`. The build copies React, ReactDOM, Babel, and the same
fonts previously loaded from Google Fonts into local `vendor/` and `fonts/`
directories, so the hosted page does not call third-party CDNs.

## Files

```
/
  index.html             static shell; loads local vendor scripts and fonts
  scripts/build.js       copies static assets into dist/
  src/
    shared.jsx           PARAM_CATALOG, MOCK_*, LFO math, LfoScope, Knob
    variant-phosphor.jsx visual components
    transport.jsx        Web MIDI SysEx editor transport
    firmware-updater.jsx Web MIDI SysEx bootloader update flow
    app.jsx              customer-facing UI
```

## Editor Protocol

The normal app receives editor commands over USB MIDI SysEx:

```
Browser -> Pedal: F0 7D 10 <request-id> <ASCII command> F7
Pedal -> Browser: F0 7D 11 <request-id> <ASCII JSON response> F7
```

Supported commands:

| TX | RX |
|---|---|
| `web info` | `{device, firmware, transport:"usb_midi", ...}` |
| `web param get` | full live params incl. `active_preset`, `preset_dirty` |
| `web preset list` | `{active, dirty, slots:[{slot, valid}]}` |
| `web preset get <slot>` | `{active, dirty, preset:{...full fields}}` |
| `web preset load <slot>` | `{ok:true,slot:N}` or `{error:"..."}` |
| `web preset save <slot>` | `{ok:true,slot:N}` or `{error:"..."}` |
| `web config get` | full expression config |
| `web config set <key> <value>` | full config or `{error:"..."}` |
| `web dfu` | asks the app to reboot into bootloader DFU mode |

The app firmware also accepts runtime MIDI CC/program-change control over the
same USB MIDI port.

## Firmware Updates

The updater expects a signed firmware binary produced by the bootloader repo:

```bash
python3 tools/sign_firmware.py zephyr.bin -o artvandelay2_signed.bin
```

From app mode, press **ENTER DFU** in the Firmware tab. Then choose the signed
`.bin` file and press **FLASH FIRMWARE**.

The browser updater uses conservative DIN-safe pacing:

- 120 ms minimum between block frames.
- 400 ms after the first block of each 2 KB flash page.

## Hosting

Serve the contents of `dist/` from GitHub Pages. Web MIDI SysEx requires a
secure context, so use HTTPS or `http://localhost:<port>` for development.
`file://` will not work.
