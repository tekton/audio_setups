# AGENTS.md — Project context for AI assistants

**audio_gear_layout**: plan and visualize a stereo/hi-fi chain (DACs, phono preamps, EQ, headphone amps, speakers). Arrange devices, draw cables between them (drag from one to another), support placement and cable-run decisions. Out of scope / roadmap: [docs/PLANS.md](docs/PLANS.md).

---

## Architecture

- **Backend**: Python + FastAPI. Store/serve layout data (devices + connections). REST: `GET/POST /layouts`, `GET/PUT/DELETE /layouts/{id}`. JSON matches frontend model.
- **Frontend**: Vanilla JS, minimal libs. SVG or Canvas. Main interaction: drag cable from one device to another to create a connection (rubber-band feedback). Layout state is source of truth; sync to backend on save.
- **Data**: device (id, type, position, label, width_in, height_u, rack_id, rack_u, rack_x), connection (from_device_id, to_device_id), rack (id, label, width_in ∈ {6,10,19}, height_u, position). A racked device's position is derived from its rack and `rack_u` (1 = bottom U) and `rack_x` (inches from the left rail); devices may share a row and the row gets an asterisk. Ports: inputs on the top edge, outputs on the bottom by default; `Layout.port_layout` ("top_bottom" | "sides") sets the canvas-wide placement and `Device.port_layout` overrides it per device. Backend validates fit/overlap on `Layout`. `Layout.mode` ("rack" | "classic") separates the two pages: `index.html` (racks) and `classic.html` (the original freeform view, no racks, ports on sides by default) share `js/app.js` via `body[data-mode]`, and each lists only its own layouts.

---

## Engineering

[docs/ENGINEERING.md](docs/ENGINEERING.md) for full guidelines. Summary: simplicity first, minimal deps, single source of truth, cable drag-and-drop with feedback, keep docs updated.

Do not try to commit to git, allow the user to do that
---

## Tests

- Frontend: `npm test` (Jest, `frontend/tests/`). Pure rack/port geometry lives in `frontend/js/rack-geometry.js` (no DOM or app state) and is unit tested by `frontend/tests/rack-geometry.test.mjs`; keep new layout math there. `.mjs` tests import the app's ES modules natively (`npm test` passes `--experimental-vm-modules`; `frontend/js/package.json` marks that folder as ESM). Backend: `pip install -r backend/requirements-dev.txt && python -m pytest backend/tests`.
- E2E: `npm run test:e2e` (Playwright, `e2e/`; desktop plus iPhone/iPad WebKit emulation); see [docs/E2E_TESTS.md](docs/E2E_TESTS.md).
- Publishing: `npm run build:local` builds a backend-free, local-storage-only site into `dist/`; see [docs/PUBLISHING.md](docs/PUBLISHING.md). Route backend calls through `apiFetch` and mark server-only UI `.server-only`.
- Library: `library.html` imports example layouts, device packs and port types from `frontend/library/index.json`; see [docs/LIBRARY.md](docs/LIBRARY.md). `npm test` validates every listed file.
- CI: `.github/workflows/test.yml` runs all of these on every push and pull request.
