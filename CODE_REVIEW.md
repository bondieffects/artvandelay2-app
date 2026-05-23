# Code Review — 2026-05-23

Five-agent parallel review of the web editor (security, firmware updater, MIDI transport, UI/a11y, shared logic/tests/build).

**Verdict:** ship-blocking issues exist but none can brick a device. The cryptographic trust boundary (HMAC verified on-pedal) is in the right place and SysEx framing is rigorous. Blockers are concentrated in the UI/a11y layer plus one latent transport bug.

---

## Critical

### ~~C1~~ — `sendCommand` response misrouting (CLOSED: false positive)
**File:** `src/transport.jsx:121-146`

Reviewer claimed two concurrent callers could swap responses. Verified by `tests/transport-c1-verification.test.js` (three test cases: back-to-back, slow-then-fast, five concurrent — all pass). The synchronous `return commandChain` right after `commandChain = ...` means each caller captures its own freshly-assigned promise; the module-level variable later being reassigned doesn't affect captured references. Reviewer's proposed rewrite was functionally identical to the current code.

The serialization is real (head-of-line blocking under a 3 s timeout delays subsequent calls), but that's a UX trait, not data corruption. Tracked as a minor follow-up if needed.

---

### ~~C2~~ — Knobs have zero accessibility (DONE)
**File:** `src/variant-phosphor.jsx:121-165` (`PhKnob`)

Rewrote `PhKnob` with `role="slider"`, `tabIndex={0}`, `aria-label/valuemin/valuemax/valuenow`, `aria-orientation="vertical"`; replaced mouse handlers with `onPointerDown/Move/Up` + `setPointerCapture` (also fixes I16 drag leak); added `onKeyDown` for Arrow±step, Page±10·step, Home/End; `touchAction: "none"` to enable pointer drag on touch devices. Added `:focus-visible` outline in `index.html`. Verified in Chrome at `http://localhost:4173`: 6 slider knobs, keyboard nav works (Home→0, End→1000, ArrowUp/Down ±10, PageUp/Down ±100), focus ring visible.

`Knob` in `src/shared.jsx:252` was also flagged by the review but is dead code (only references are its definition and window export — see grep at session start). Leave for M11-style cleanup; fixing its a11y now would be polishing unused code.

---

### ~~C3~~ — Tabs are not real tabs (DONE)
**Files:** `src/variant-phosphor.jsx:41-58` (`PhTab`), `src/app.jsx:203-220` (panels)

`PhTab` now uses `role="tablist"` with `aria-label="Editor sections"`, each button has `role="tab"` + `aria-selected` + `id="tab-<key>"` + `aria-controls="tabpanel-<key>"` + roving tabindex (active=0, others=-1). Added ArrowLeft/Right (wraparound) + Home/End keyboard navigation that both moves focus and activates. Each panel in `app.jsx` is wrapped in `<div role="tabpanel" id="tabpanel-<key>" aria-labelledby="tab-<key>">`. Focus ring CSS added for `.avd-tab:focus-visible`. Verified in Chrome: tab→config via ArrowRight×2, End→console, Home→live; focus and aria-selected stay in sync; correct panel rendered.

---

### ~~C4~~ — No fallback for browsers without Web MIDI (DONE)
**File:** `src/app.jsx:460-end`

Added `UnsupportedBrowser` component and a `webMidiSupported` guard at mount time. If `typeof navigator.requestMIDIAccess !== "function"`, the root renders the notice instead of `PhosphorWired`. Notice is a `role="alert"` panel styled to match the rest of the app, listing the three requirements: Chrome/Edge desktop, HTTPS-or-localhost, no Firefox/Safari/mobile. Verified in Chrome both paths: normal (tablist visible) and simulated via `Object.defineProperty(Navigator.prototype, 'requestMIDIAccess', { value: undefined, ... })` (alert visible, no tablist).

---

## Important

### Transport / firmware

- **~~I1~~** — `useTransport` never calls `disconnect()` on unmount. Fixed: added `t.disconnect()` to useEffect cleanup in `useTransport`. `src/transport.jsx:206`
- **~~I2~~** — Device disconnect mid-session: `bindPorts()` swaps `input`/`output` to `null` but `status` stays `"connected"`. Fixed: `bindPorts` now calls `setStatus("disconnected")` when both ports become null while connected. `src/transport.jsx:62`
- **~~I3~~** — Request IDs wrap 1..127 with no collision check against `pending`. Fixed: `sendCommand` now skips IDs already in `pending` map before assigning. `src/transport.jsx:127-131`
- **~~I4~~** — Firmware updater re-requests its own `MIDIAccess` and replaces `input.onmidimessage`, stealing events from the main transport. Fixed: (a) Added `addRawListener(fn)` to transport API (called for all valid SysEx from the transport's port); (b) firmware updater input effect now uses `addEventListener`/`removeEventListener` instead of `onmidimessage` — non-destructive, transport handler preserved. `src/transport.jsx:102,173` `src/firmware-updater.jsx:207-214`
- **~~I5~~** — Flash has no per-block ACK and no in-flight cancel. Fixed: added `cancelRef` checked at each block iteration; `onstatechange` sets `cancelRef.current = true` on port change so a disconnect during flashing throws within ≤one block interval. `src/firmware-updater.jsx:161,184,284,292`
- **~~I6~~** — `fw = info.firmware || MOCK_DEVICE.firmware` means a real device returning `{}` for info shows "UP TO DATE" (mock 1.4.2). Fixed: guard is now `info.firmware?.major !== undefined`. `src/app.jsx:185`
- **~~I7~~** — File picker reads `await file.arrayBuffer()` before any size guard. Fixed: early size check against `FW_PROTO.APP_SPACE + 32` before `arrayBuffer()`. `src/firmware-updater.jsx:266-269`

### Security

- **~~I8~~** — No CSP and `@babel/standalone` runs in production. Fixed: switched to esbuild build-time JSX compilation (`scripts/build.js`); removed `@babel/standalone` from runtime deps and `babel.min.js` from dist; `index.html` now loads plain `.js` files and includes `Content-Security-Policy` meta tag (`default-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; object-src 'none'; base-uri 'self'`). `index.html:6-8` `scripts/build.js`
- **~~I9~~** — `JSON.parse` on SysEx payload has no size cap. Fixed: responses over 8 KiB are rejected before `JSON.parse`. `src/transport.jsx:111-114`

### Shared logic / tests

- **~~I10~~** — Tests duplicated source inline. Fixed: extracted all pure functions (`lfoRateParamToHz`, `sampleWave` family, `fwVersionCompare/String`, `FW_PROTO`, `fwEncode8to7`, `fwCrc16`, `fwU16be/32be/32le`, `fwParseImage`) into `src/pure.js` — Node-loadable CommonJS with browser-global fallback. Removed duplicates from `shared.jsx` and `firmware-updater.jsx`. Test file now `require('../src/pure.js')`. `src/pure.js` (new), `tests/pure-functions.test.js`
- **~~I11~~** — `PARAM_CATALOG` has no validation tests. Fixed: added four tests — ID uniqueness, key uniqueness, enum `options.length === max-min+1`, and MOCK_PRESETS values within declared `[min, max]` bounds (guards against latent out-of-range from the `delay_time_ms` formula). `tests/pure-functions.test.js`
- **~~I12~~** — `PhKnob` wheel/drag/key produced float values for integer-only params. Fixed: added `step=1` prop; `set` now uses `Math.round(clamp(v) / step) * step`. Added null guard to `PhPedalSelect.onChange` so passing `onChange={null}` is safe. `src/variant-phosphor.jsx`

### UI / UX

- **~~I13~~** — "Quick Trim" knobs (live tab) accept input then get clobbered by the next 500 ms `paramGet` poll. Fixed: `PhLive` now accepts `connected` prop; when connected, Quick Trim knobs and waveform select receive `onChange={null}` (read-only) and a "PHYSICAL KNOBS ONLY" notice is shown. `app.jsx` passes `connected={connected}`. `src/variant-phosphor.jsx`, `src/app.jsx`
- **~~I14~~** — No memoization on `PhKnob` / `PhReadout` / `PhPanel` / `LfoScope`. Fixed: all four wrapped with `React.memo`. `src/variant-phosphor.jsx`, `src/shared.jsx`
- **~~I15~~** — `LfoScope` `<canvas>` had no `aria-label` or `aria-hidden`. Fixed: canvas marked `aria-hidden="true"`; wrapper div has `role="img"` + `aria-label`; visually-hidden `<span>` with rate/depth text. `src/shared.jsx`
- **~~I16~~** — `onMouseDown` drag handlers (already fixed in Round 1 / C2). Confirmed no `onMouseDown` in any source file.
- **~~I17~~** — Root pinned to `width: 1440`. Fixed: changed to `width: "100%", maxWidth: 1440` so the layout fits 13" laptops without a horizontal scrollbar. `src/app.jsx:193`

---

## Minor

- **~~M1~~** — Added `// eslint-disable-next-line react-hooks/exhaustive-deps` before the LfoScope RAF dep array to document the intentional omission. `src/shared.jsx`
- **~~M2~~** — `enterDfu` was using closure-captured `outputId`; fixed to use `outputIdRef.current` (same as `ping()`). Removed `outputId` from `enterDfu`'s deps. `src/firmware-updater.jsx`
- **~~M3~~** — Progress capped at `Math.min(0.99, ...)` during block loop; only set to 1.0 after COMMIT_OK. `src/firmware-updater.jsx`
- **~~M4~~** — Console log entries now carry a monotonic `id` as the first element (`[id, t, type, msg]`). `useTransport` uses `logIdRef`, `useFirmwareUpdater` uses its own `logIdRef`. `PhConsole` uses `key={id}`. MOCK_LOG and the firmware updater fallback entry updated to 4-element format. `src/transport.jsx`, `src/firmware-updater.jsx`, `src/variant-phosphor.jsx`, `src/shared.jsx`
- **~~M5~~** — `PhKnob` now registers wheel with `addEventListener('wheel', h, { passive: false })` via a `useEffect` using a `stateRef` to read current `value`/`max`/`set`. Removed the `onWheel` React prop. `src/variant-phosphor.jsx`
- **~~M6~~** — `bytesFromAscii` now throws on non-ASCII input instead of silently masking. All current call sites use programmer-supplied ASCII strings. `src/transport.jsx`
- **~~M7~~** — `fwMakeEnterDfu` now uses request-id `0x7f` (max, reduces collision chance with the transport which starts from `0x01`). Full routing through `transport.sendCommand` would require sharing the transport object with the firmware updater — deferred. `src/firmware-updater.jsx`
- **~~M8~~** — Pinned `@fontsource/*` to exact version `5.2.8` (dropped `^`). `package.json`
- **~~M9~~** — Build script wrapped in `try/catch` with clean error message (done in Round 3). `scripts/build.js`
- **~~M10~~** — `npm run serve` fixed (done in Round 3). `package.json`
- **~~M11~~** — Removed `useTab` dead-code function and its window export. `src/shared.jsx`
- **~~M12~~** — `disconnect()` now calls `access.onstatechange = null` before clearing `access`. `src/transport.jsx`
- **~~M13~~** — Added `aria-label={label}` to `PhPedalSelect`'s `<select>`. `src/variant-phosphor.jsx`
- **~~M14~~** — `PhPedal` and `PhLive` Quick Trim both derive their knob lists from `PARAM_CATALOG.filter(p => p.kind !== "enum")`. Added `shortLabel` to the 6 non-enum catalog entries. `src/shared.jsx`, `src/variant-phosphor.jsx`
- **~~M15~~** — `fwVersionCompare` / `fwVersionString` tests added (done in Round 4). `tests/pure-functions.test.js`
- **~~M16~~** — Waveform phase tests added (done in Round 4). `tests/pure-functions.test.js`
- **~~M17~~** — `connect()` catch now calls `disconnect({ silent: true })` before `setStatus("error", ...)`, so only one status event fires. `src/transport.jsx`

---

## Round plan

- **Round 1 — Criticals (4):** C1, C2, C3, C4
- **~~Round 2~~ — Transport/firmware lifecycle:** ~~I1, I2, I3, I4, I5, I6, I7~~ (DONE)
- **~~Round 3~~ — Security hardening:** ~~I8, I9~~ (DONE)
- **~~Round 4~~ — Test infrastructure:** ~~I10, I11, M15, M16~~ (DONE)
- **~~Round 5~~ — UI polish:** ~~I12, I13, I14, I15, I16, I17~~ (DONE)
- **~~Round 6~~ — Minors mop-up:** ~~remaining M items~~ (DONE)

---

## Strengths worth preserving

- HMAC verification stays on-device — web app is a courier, not a trust anchor.
- Supply chain locally bundled, core deps pinned, CI uses `npm ci` against committed lockfile, GitHub Pages workflow uses minimum permissions.
- SysEx framing is correct: rigorous `F0/F7` + MFR_ID checks, 7-bit masking on both directions, request IDs constrained to 1..0x7F.
- DIN-safe pacing (120 ms / 400 ms at 2 KB page boundaries) matches the README contract exactly.
- Re-flash fix (commit `ef66e70`) using `outputIdRef` is a genuine, well-targeted fix.
- LFO scope ref-based parameter update (commit `d092a69`) is the correct way to fix staleness without restarting the RAF on every keystroke.
- Polling loop in `app.jsx:99-119` uses a `stopped` flag + `clearTimeout` + `document.hidden` pause — clean, no leaks.
- Functional `setState` used consistently — no obvious poll/user state races.
- Zero `dangerouslySetInnerHTML` / `eval` / `Function`; device strings render via React text children.
