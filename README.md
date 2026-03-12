# Audio gear layout

Plan and visualize layout of DACs, phono preamps, EQ, headphone amps, and speakers. Drag a cable from one device to another to connect them. Data is stored via a small Python backend.

## Run the app

### Docker (recommended)

From the project root:

```bash
docker compose up --build
```

- **Frontend**: http://localhost:7002  
- **Backend API**: http://localhost:7001  
- **Postgres**: localhost:7432 (user `layout`, password `layout`, db `audio_gear_layout`)

Layouts are stored in Postgres (user/account tables can be added later). The backend uses the same API; no code changes needed.

### Backend (Python, local)

From the project root (so `backend` is a package):

```bash
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

API: `GET/POST /layouts`, `GET/PUT/DELETE /layouts/{id}`.

### Frontend

Serve the `frontend` folder with any static server, then open in a browser. For example:

```bash
cd frontend
python -m http.server 3000
```

Open http://localhost:3000. The frontend talks to the backend at http://localhost:8000 (edit `API_BASE` in `frontend/js/app.js` if your backend runs elsewhere). If using docker-compose, the frontend is at http://localhost:7002 and backend at http://localhost:7001.

## Usage

- **Add device**: adds a new device block on the canvas.
- **Drag from one device to another**: draws a cable (connection) between them. Drop on the target device to confirm.
- **Save**: POSTs the current layout to the backend (creates or updates).
- **Load**: fetches the first saved layout from the backend and displays it.

- **Docs**: [AGENTS.md](AGENTS.md) (goals and architecture), [docs/ENGINEERING.md](docs/ENGINEERING.md) (guidelines), [docs/PLANS.md](docs/PLANS.md) (scope and roadmap).
