# Plans and scope

Out-of-scope and future ideas. Update as the product evolves.

## Out of scope (for now)

- Real-time audio processing or DAW integration
- E-commerce or inventory management
- User accounts or multi-tenant hosting (unless explicitly added later)

## Roadmap / ideas

- (Optional: list future features, e.g. “Layout list / picker in UI”, “Export as image”, “Port labels per device”.)
- "Convert to rack" button on the classic view: place a classic layout's devices into new racks, carrying connections over.
- Racks: rack rename/resize in UI; port labels on devices (currently tooltips only).
- Export/import of whole layouts as JSON (local-only testers can't move layouts between browsers); deploy workflow for the local-only build.
- Categories for devices (audio, networking, power, generic, visual), shown as groups in pickers, especially the "Add device" dropdown for pre-existing and custom types (e.g. `<optgroup>`); likely a `category` field on device types.

- Real-device pass on an iPhone and iPad before announcing the published site (Playwright only emulates them). Pinch-zoom and pull-to-refresh on the canvas, and a share-sheet Export on iOS, are untested.

- Library: more example racks and device packs (the 19" device types are still only the built-ins), grouping packs by category (see the categories note above), and routing cables around devices in a stacked rack.
