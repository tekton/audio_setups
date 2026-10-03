"""Layout storage: Postgres when DATABASE_URL is set, otherwise in-memory."""

import os
import uuid

from .database import LayoutRow, session_scope
from .models import Connection, Device, Layout, Rack

_layouts: dict[str, Layout] = {}
_next_id = 1


def _new_id() -> str:
    global _next_id
    out = f"layout_{_next_id}"
    _next_id += 1
    return out


def _layout_data(layout: Layout) -> dict:
    return {
        "devices": [d.model_dump() for d in layout.devices],
        "connections": [c.model_dump() for c in layout.connections],
        "racks": [r.model_dump() for r in layout.racks],
        "port_layout": layout.port_layout,
        "mode": layout.mode,
    }


def _layout_to_row(layout: Layout) -> LayoutRow:
    return LayoutRow(id=layout.id or "", name=layout.name, data=_layout_data(layout))


def _row_to_layout(row: LayoutRow) -> Layout:
    devices = [Device(**d) for d in row.data.get("devices", [])]
    connections = [Connection(**c) for c in row.data.get("connections", [])]
    racks = [Rack(**r) for r in row.data.get("racks", [])]
    return Layout(id=row.id, name=row.name, devices=devices, connections=connections, racks=racks,
                  port_layout=row.data.get("port_layout", "top_bottom"), mode=row.data.get("mode", "rack"))


def _use_db() -> bool:
    return bool(os.environ.get("DATABASE_URL"))


def list_layouts() -> list[Layout]:
    if not _use_db():
        return list(_layouts.values())
    with session_scope() as session:
        if session is None:
            return list(_layouts.values())
        rows = session.query(LayoutRow).all()
        return [_row_to_layout(r) for r in rows]


def get_layout(layout_id: str) -> Layout | None:
    if not _use_db():
        return _layouts.get(layout_id)
    with session_scope() as session:
        if session is None:
            return _layouts.get(layout_id)
        row = session.query(LayoutRow).filter(LayoutRow.id == layout_id).first()
        return _row_to_layout(row) if row else None


def save_layout(layout: Layout) -> Layout:
    lid = layout.id or (_new_id() if not _use_db() else f"layout_{uuid.uuid4().hex[:12]}")
    updated = layout.model_copy(update={"id": lid})

    if not _use_db():
        _layouts[lid] = updated
        return updated

    with session_scope() as session:
        if session is None:
            _layouts[lid] = updated
            return updated
        row = session.query(LayoutRow).filter(LayoutRow.id == lid).first()
        data = _layout_data(updated)
        if row:
            row.name = updated.name
            row.data = data
        else:
            session.add(LayoutRow(id=lid, name=updated.name, data=data))
    return updated


def delete_layout(layout_id: str) -> bool:
    if not _use_db():
        if layout_id in _layouts:
            del _layouts[layout_id]
            return True
        return False
    with session_scope() as session:
        if session is None:
            if layout_id in _layouts:
                del _layouts[layout_id]
                return True
            return False
        row = session.query(LayoutRow).filter(LayoutRow.id == layout_id).first()
        if row:
            session.delete(row)
            return True
        return False
