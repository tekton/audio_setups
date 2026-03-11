# AGENTS.md — Project context for AI assistants

**audio_gear_layout**: plan and visualize a stereo/hi-fi chain (DACs, phono preamps, EQ, headphone amps, speakers). Arrange devices, draw cables between them (drag from one to another), support placement and cable-run decisions. Out of scope / roadmap: [docs/PLANS.md](docs/PLANS.md).

---

## Architecture

- **Backend**: Python + FastAPI. Store/serve layout data (devices + connections). REST: `GET/POST /layouts`, `GET/PUT/DELETE /layouts/{id}`. JSON matches frontend model.
- **Frontend**: Vanilla JS, minimal libs. SVG or Canvas. Main interaction: drag cable from one device to another to create a connection (rubber-band feedback). Layout state is source of truth; sync to backend on save.
- **Data**: device (id, type, position, label), connection (from_device_id, to_device_id).

---

## Engineering

[docs/ENGINEERING.md](docs/ENGINEERING.md) for full guidelines. Summary: simplicity first, minimal deps, single source of truth, cable drag-and-drop with feedback, keep docs updated.
