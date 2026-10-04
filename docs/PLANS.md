# Plans and scope

Out-of-scope and future ideas. Update as the product evolves.

## Out of scope (for now)

- Real-time audio processing or DAW integration
- E-commerce or inventory management
- User accounts or multi-tenant hosting (unless explicitly added later)

## Roadmap / ideas

- (Optional: list future features, e.g. “Layout list / picker in UI”, “Export as image”, “Port labels per device”.)
- Done: "Convert to rack" on the classic page (`convertClassicToRack` in `rack-geometry.js`): one rack per width (6/10/19"), devices stacked in signal-flow order, cables kept; saved as a new layout.
- Racks: rack rename/resize in UI; port labels on devices (currently tooltips only).
- Export/import of whole layouts as JSON (local-only testers can't move layouts between browsers); deploy workflow for the local-only build.
- Categories for devices (audio, networking, power, generic, visual), shown as groups in pickers, especially the "Add device" dropdown for pre-existing and custom types (e.g. `<optgroup>`); likely a `category` field on device types.

- Real-device pass on an iPhone and iPad before announcing the published site (Playwright only emulates them). Pinch-zoom and pull-to-refresh on the canvas, and a share-sheet Export on iOS, are untested.

- Library: even more example racks and device packs, and grouping packs by category (see the categories note above). Done: 10" and 19" packs, more examples, and cable routing around stacked devices (`cableRoute` in `rack-geometry.js`).
- Done: undo/redo (`frontend/js/history.js`, buttons plus Ctrl/Cmd+Z) and a printable parts-and-cables list (`frontend/js/parts.js`, the Parts list button).
