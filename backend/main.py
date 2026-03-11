"""FastAPI backend: store and serve layout data (devices, connections)."""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .database import init_db
from .models import Layout
from .store import delete_layout, get_layout, list_layouts, save_layout

app = FastAPI(title="Audio gear layout API", version="0.1.0")


@app.on_event("startup")
def startup():
    init_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/layouts")
def api_list_layouts() -> list[Layout]:
    return list_layouts()


@app.get("/layouts/{layout_id}")
def api_get_layout(layout_id: str) -> Layout:
    layout = get_layout(layout_id)
    if not layout:
        raise HTTPException(status_code=404, detail="Layout not found")
    return layout


@app.post("/layouts")
def api_create_layout(layout: Layout) -> Layout:
    return save_layout(layout)


@app.put("/layouts/{layout_id}")
def api_update_layout(layout_id: str, layout: Layout) -> Layout:
    if layout_id != layout.id:
        raise HTTPException(status_code=400, detail="ID in path and body must match")
    return save_layout(layout)


@app.delete("/layouts/{layout_id}")
def api_delete_layout(layout_id: str) -> None:
    if not delete_layout(layout_id):
        raise HTTPException(status_code=404, detail="Layout not found")
