# Web UI — Delivery & Liability Notes

## Current state (friends / internal)

The UI is served with a local Python server and connects to the pedal over Web
Serial for editing and Web MIDI SysEx for firmware updates. This is fine for
sharing with a small group of trusted users who can follow a one-liner
instruction. No hosted infrastructure, no liability.

```
python -m http.server 8000
# open http://localhost:8000 in Chrome or Edge
```

Web Serial and Web MIDI SysEx are Chromium-only in practice (Chrome, Edge,
Opera desktop). Firefox and Safari do not support this workflow.

---

## Why `file://` will never work

Web Serial, Web MIDI SysEx, WebUSB, and WebHID all require a **secure context**
— either `https://` with a real cert, or `localhost`. The browser enforces this
at the API level; there is no workaround. A double-click HTML file (`file://`)
is not a secure context and will never have access to these APIs.

---

## Liability problems in the current `index.html`

Before distributing to anyone outside a trusted circle, two things must be
fixed:

### 1. Google Fonts
```html
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono...">
```
Every page load sends the user's IP address to Google. German courts have ruled
this a GDPR violation without explicit consent. Remove it and use system fonts
or vendor the font files locally.

### 2. CDN-loaded React and Babel
```html
<script src="https://unpkg.com/react@18.3.1/...">
<script src="https://unpkg.com/@babel/standalone@7.29.0/...">
```
SRI hashes protect against tampering but you still depend on unpkg availability
and npm infrastructure. `babel/standalone` is also ~900 KB on every cold load —
it exists to transpile JSX at runtime, which is unnecessary in a production
build.

---

## Future path — companion executable

The cleanest solution for public distribution: a single small binary that
embeds the entire web app, starts a `localhost` HTTP server, and opens the
browser. No Python, no install wizard, no external network calls.

**Why this works:**
- `localhost` is a secure context → Web Serial works
- All assets are baked in → no CDN, no Google Fonts, no external calls
- Single file → simple user experience (double-click to run)
- Nothing is hosted → no servers, no privacy policy, no GDPR surface area

**Recommended stack:** Go
- `net/http` in the standard library handles the local server
- `//go:embed` bundles the compiled web assets at build time
- `os/exec` or `x/sys/windows` opens the default browser
- Output is a single static binary, ~5–8 MB, no runtime dependencies

**Build step required:** before embedding, replace the runtime Babel transpile
with a one-time build (esbuild, Vite, or similar) that outputs plain JS. This
also eliminates the `babel/standalone` download.

### Code signing (required to avoid OS security warnings)

| Platform | What you need | Approx. cost |
|---|---|---|
| macOS | Apple Developer Program + notarization | $99/yr |
| Windows | EV code signing certificate | $200–400/yr |
| Linux | No signing required | — |

Without signing, macOS shows "unidentified developer" and Windows shows a
SmartScreen warning. Both are dismissible but kill user confidence.

---

## Why not WebUSB?

WebUSB was evaluated and ruled out for this use case:

- **Same browser support** — Chrome and Edge desktop only, same as Web Serial
- **Same secure context requirement** — doesn't solve the distribution problem
- **Cannot serve the web app** — WebUSB is a transport (a pipe between browser
  and device), not a web server. The page still has to come from somewhere.
  The only way to serve from the device itself (USB RNDIS + HTTP server) puts
  the page on a plain `http://` address, which is not a secure context, so
  Web Serial and WebUSB both refuse to run on it.
- **Significant firmware cost** — the current JSON shell over USB CDC works
  today; WebUSB would require defining a vendor USB class, implementing bulk
  endpoints, and rewriting the transport layer in the firmware.
- **Loses debuggability** — the CDC shell can be probed with any serial
  terminal; WebUSB bulk transfers cannot.

The one thing WebUSB offers that Web Serial does not is a **landing page URL**:
the device can advertise a `https://` URL in its USB descriptors and Chrome
shows a popup when the pedal is plugged in. This is a nice UX feature but
requires external hosting, which reintroduces liability.

---

## Decision log

| Decision | Rationale |
|---|---|
| Web Serial over WebUSB | No firmware changes needed; same browser support; debuggable |
| Web MIDI for bootloader updates | Matches the existing MIDI SysEx bootloader and allows browser-controlled pacing |
| Local server over hosted page | No liability, no GDPR, no servers to maintain |
| Go binary for future distribution | Single file, no runtime deps, small, cross-platform |
| Defer companion exe | Current audience is friends; Python one-liner is acceptable |
| Must fix before public release | Remove Google Fonts; vendor React/Babel; add build step |
