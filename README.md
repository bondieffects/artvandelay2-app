# Art Van Delay 2 — Phosphor Lab

Web UI for the Art Van Delay 2 firmware. Connects to the pedal over Web
Serial. Served via GitHub Pages — no install required.

**Requires Chrome or Edge (desktop).** Web Serial is not supported in Firefox
or Safari.

> **Don't open `index.html` directly** — browsers block local file requests
> needed to load the app. Use the GitHub Pages URL or a local server (see
> below).

## Files

```
/
  index.html             shell; loads React 18 + Babel + four source files
  src/
    shared.jsx           PARAM_CATALOG, MOCK_*, LFO math, LfoScope, Knob
    variant-phosphor.jsx Phosphor Lab visual components (Ph* globals)
    transport.jsx        Web Serial wrapper + useTransport() hook
    app.jsx              PhosphorWired — glues transport to UI
```

## Protocol (from legacy app.js)

Newline-terminated ASCII TX, newline-delimited JSON RX at 115200 baud.
Commands are serialized through a promise chain with a 3-second timeout
per command.

| TX                                 | RX                                                     |
|------------------------------------|--------------------------------------------------------|
| `web info`                         | `{device, firmware:{major,minor,patch,tweak}}`         |
| `web param get`                    | full live params incl. `active_preset`, `preset_dirty` |
| `web preset list`                  | `{active, dirty, slots:[{slot, valid}]}`               |
| `web preset get <slot>`            | `{active, dirty, preset:{…full fields}}`               |
| `web preset load <slot>`           | `{ok:true,slot:N}` or `{error:"…"[,slot:N][,code:N]}` |
| `web preset save <slot>`           | `{ok:true,slot:N}` or `{error:"…"[,code:N]}`           |
| `web config get`                   | full config                                            |
| `web config set <key> <value>`     | full config (or `{error}`)                             |

Shell prompt lines (`artvandelay2:~$ …`) are filtered out.
No unsolicited events. **No `web param set`** — live params are read-only;
they change only via `preset load` or physical knob movement.

## Runtime behavior

- **Connect** → `navigator.serial.requestPort()` → open @ 115200 → run
  `info` → `param get` → `preset list` → `config get` in sequence.
- **Live tab** polls `web param get` at 2 Hz. Tracks physical knob turns
  on the pedal. Knob drags in the UI are local-only (next poll overwrites
  them) — as expected, since firmware exposes no live setter.
- **Presets tab** · **LOAD** sends `preset load <slot>` and refreshes all
  state. **WRITE** sends `preset save <slot>` (commits current live buffer
  to the slot). Selecting an unloaded valid slot lazy-fetches it via
  `preset get`.
- **Config tab** · **COMMIT** pushes each changed field with
  `config set <key> <value>`. Firmware echoes the full config, which
  updates state. Stops at first error.
- **Console tab** mirrors the transport's live TX/RX/INFO/WARN/ERR log
  (capped at 500 lines). Falls back to `MOCK_LOG` before first connect.

## Serving

Web Serial requires a secure context: `http://localhost:<port>` or
`https://` with a real cert. `file://` will not work.

```
python -m http.server 8000
# then visit http://localhost:8000
```

## Browser support

Chrome, Edge, Opera (desktop). Firefox and Safari don't ship Web Serial;
the transport throws a clear error and surfaces it in the header.
