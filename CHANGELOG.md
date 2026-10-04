# Changelog

## Unreleased

### Added
- Library page: **System reset** (clears custom device and port types, keeps layouts), **Export all layouts**, **Full backup** (layouts plus custom types), **Import** for any of those files, **Clear all layouts**, installed state with **Remove** for each pack, a storage summary and a backup reminder.
- Library content: Desktop 10" and Full-width 19" gear packs; Desktop 10" rack, Two-channel listening rack and a freeform Headphone desk example.
- Layouts: **Duplicate**, **Rename**, **Export image** (PNG), **Copy link** (share a layout in the URL), **Convert to rack** (Classic page), **Undo/Redo** and a printable **Parts list**.
- Cables now route around devices in a stacked rack instead of crossing them.

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
