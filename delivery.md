# Web UI Delivery Notes

## Decision

The customer-facing app is a static GitHub Pages site served from `dist/`.
It uses Web MIDI SysEx for both normal editor commands and firmware updates.
Web Serial is no longer part of the public browser workflow.

## Privacy / Liability Posture

- No Google Fonts requests. Inter, JetBrains Mono, and DM Serif Display are
  copied from Fontsource npm packages into `dist/fonts/`.
- No unpkg/CDN runtime scripts. React, ReactDOM, and Babel are copied into
  `dist/vendor/`.
- No analytics, cookies, account system, or backend service.
- GitHub Pages provides HTTPS, which is required by Web MIDI SysEx.

## Build And Publish

```bash
npm install
npm run build
```

Publish the contents of `dist/` to GitHub Pages.

## Browser Support

Chrome and Edge desktop are the supported browsers. Firefox and Safari do not
support the required Web MIDI SysEx workflow.

## Firmware Update UX

- In normal app mode, the Firmware tab can send `web dfu` over USB MIDI SysEx
  to reboot the pedal into the bootloader.
- In DFU mode, the bootloader responds to the existing MIDI SysEx ping and
  signed-image flashing protocol.
- The updater keeps DIN-safe pacing: 120 ms between blocks and 400 ms after
  each page-erase trigger.

## Remaining Release Work

- Hardware-test app-mode USB MIDI editor commands in Chrome/Edge.
- Hardware-test **ENTER DFU** from the page, then flash the signed app twice.
- Decide final production USB PID policy for app vs. bootloader.
