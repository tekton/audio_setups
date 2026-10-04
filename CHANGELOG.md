# Changelog

## 0.3.1 - 2026-10-04

### Security
- Fixed attribute injection (stored XSS) on the Port types and Device types pages: rows are now built with DOM APIs, and imported device and port types are validated before they are stored. A hostile id, name or color from a shared file can no longer run script.
- Share links are size-limited (token length and inflated size), so a tiny crafted link can't hang the page.
- The parts-list CSV neutralises spreadsheet formulas (cells starting with `=`, `+`, `-`, `@`).
- Every page has a Content-Security-Policy (no inline script or style, no third-party hosts); the local-only build also drops the backend host.
- Backend and database ports in `docker-compose.yml` are bound to 127.0.0.1, and CORS no longer sends `allow_credentials`.

### Changed
- Dependencies: jest 30 and jest-environment-jsdom 30.5 (`npm audit` now reports 0 vulnerabilities). CI uses Node 22 and current action versions, runs `npm audit --omit=dev` and `pip-audit`, and Dependabot is configured for npm, pip, GitHub Actions and Docker.
- Added `SECURITY.md`.

## 0.3.0 - 2026-10-04

### Added
- **Library data tools** (Library page):
  - **System reset** clears custom device and port types back to the built-in defaults; saved layouts are kept. It asks for confirmation.
  - **Full backup** saves layouts plus custom device and port types to one file; **Export all layouts** saves layouts only.
  - **Import** reads a full backup, an Export all file or a single layout. Layouts are added as new copies, so nothing is overwritten; types are merged by id.
  - **Clear all layouts** (with confirmation) deletes layouts and keeps types.
  - Packs show **Installed** or **Partly installed**, with a **Remove** button that drops only that pack's types.
  - A storage summary (counts and approximate size) and a backup reminder for layouts that have never been backed up, or whose last backup is 30+ days old.
- **Library content**: Desktop 10" gear and Full-width 19" gear packs; Desktop 10" rack, Two-channel listening rack and Headphone desk (freeform) examples.
- **Layout tools**:
  - **Duplicate** and **Rename** saved layouts.
  - **Export image** downloads a PNG of the canvas.
  - **Copy link** puts a layout in the URL; opening it gives an unsaved copy on the right page.
  - **Convert to rack** (Classic page) saves a rack version with devices stacked in signal-flow order and cables kept.
  - **Undo / Redo** with buttons or Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z and Ctrl+Y.
  - **Parts list** of racks, devices, cables and cables to buy by type, with Print and Copy as CSV.
- Cables now route around devices in a stacked rack instead of crossing them.

### Changed
- `AGENTS.md` asks for approval before every push, PR or release.

### Known limits
- Share links over about 6000 characters show a warning, since some apps truncate long links.
- Mobile support, PNG export and share links are verified with WebKit emulation, not on real devices.
- Cables from side ports ("Ports on sides") stay straight lines.
- Device categories are not built yet.

## 0.2.0 - 2026-10-04

### Added
- **Rack view** (`index.html`): racks (6", 10" or 19", any height) that devices snap into, with shared rows marked by an asterisk and top/bottom or side port placement. The original freeform view lives on as `classic.html`.
- **Local-only build** (`npm run build:local`): a backend-free site that keeps everything in browser local storage, ready to publish for friends and family.
- **Layout Export / Import** as JSON files, so layouts can move between browsers and devices.
- **Library page** (`library.html`) with ready-made examples you can open or add:
  - The Crap Rack: a 6" rack with a Mac mini mount (2U), DAC, headphone amp and phono stage (1U each).
  - Home stereo rack: a 19" rack with turntable, phono pre-amp, DAC, EQ and headphone amp.
  - Compact 6" gear pack and a common audio connectors port-types pack.
  - Add your own by dropping a JSON file in `frontend/library/` (see `docs/LIBRARY.md`).
- **iPhone and iPad support**: responsive layout, 44px tap targets, 16px inputs, and larger touch targets on ports.
- **Tests and CI**: Jest, pytest and Playwright end-to-end tests (desktop Chrome plus iPhone and iPad WebKit emulation), all run on every push and pull request.

### Fixed
- Tall racks were clipped by the fixed-height canvas; it now grows to fit what is drawn.
- Saving to blocked or full browser storage now shows an alert instead of failing silently.

### Known limits
- In a stacked rack, a cable between non-adjacent devices is drawn straight through the devices between them.
- Mobile support is verified with emulation only, not yet on real devices.
