# Library

`library.html` lets people pull ready-made content into their own browser: example rack layouts, device-type packs and port types. Everything is static JSON under `frontend/library/` (plus the shared `frontend/audio-gear-port-types.json`), so it ships in the local-only build with no backend.

## What the page does

- **Example layouts**: "Open a copy" saves a copy into device storage (a new id, and a name like "The Crap Rack (2)" if that name is taken), then opens it on the right page (`index.html?layout=<id>` for rack layouts, `classic.html` for classic ones).
- **Device types**: "Add to my devices" merges the pack into the Device types list by id; the devices appear in the "Add device" dropdown as "<label> (custom)".
- **Port types**: merges by id into the Port types list.

Merging and copying logic is in `frontend/js/library-core.js` (pure, unit tested); `frontend/js/library.js` is the page wiring.

## Adding to the library

1. Drop a JSON file in `frontend/library/devices/` (an array of device types: `id`, `name`, `label`, `width_in` 6/10/19, `height_u`, `input_ports`, `output_ports` as `{name, type}`) or `frontend/library/layouts/` (a layout exported with **Save & load > Export**, or hand-built; keep `id: null` and `mode`).
2. List it in `frontend/library/index.json` with an `id`, `name`, `description` and `file` (path relative to `frontend/`).
3. Run `npm test`. `frontend/tests/library.test.mjs` checks every listed file: it exists, sizes and port types are valid, every racked device fits its rack without overlap, and every cable joins real ports of the same type. A layout example is easiest to author by building it in the app and exporting it.

Use stable ids for device types (`lib_...`): layouts reference them through `template_id`, and re-adding a pack replaces the earlier copy instead of duplicating it.

## Included

- **The Crap Rack**: a 6" x 6U rack with a 2U Mac mini mount, DAC, headphone amp and phono stage (all 1U), cabled USB, then RCA. Uses the "Compact 6" gear" device pack.
- **Home stereo rack**: a 19" x 8U rack with a 3U turntable, phono pre-amp, DAC, EQ and headphone amp.
- **Common audio connectors**: the port types in `audio-gear-port-types.json`.

## Known limits

- Ports in a stacked rack are on the top and bottom edges, so cables between non-adjacent devices run straight through the devices in between. Ordering a rack so signal flows between neighbours (or using "Ports on sides") keeps them readable.
- Layouts only come from the shipped library or a file the user imports; there's no user-to-user sharing beyond Export/Import.

## Your data, backups and installed packs

The Library page shows what this browser holds (layout, custom device-type and custom port-type counts, and roughly how much of the ~5 MB of local storage is used). If you have saved layouts and have never backed up, or the last backup is 30+ days old, it nudges you. Browsers can clear local storage, so layouts only exist in the one browser.

- **Full backup** downloads `audio_gear_backup.json`: all layouts plus custom device and port types.
- **Export all layouts** downloads `audio_gear_all_layouts.json` (layouts only). Both count as a backup for the nudge.
- **Import…** reads a full backup, an Export all file or a single exported layout. Layouts are added as new copies (fresh id, a name that never clashes), so nothing is overwritten; a full backup's device and port types are merged by id.
- **Clear all layouts** (confirmation box) deletes layouts only; types are kept.
- Each device pack and port-type row shows **Installed** / **Partly installed** (matched by id) and has a **Remove** button that drops just that pack's types, not ones you made yourself.
- The in-app **Duplicate** and **Rename** buttons (Save & load panel) copy or rename a saved layout, and **Export image** downloads a PNG of the canvas.

## System reset

The Library page has a **System reset** button (with a confirmation box). It removes every custom device type and port type from this browser, back to the built-in defaults. Saved layouts are not touched.
