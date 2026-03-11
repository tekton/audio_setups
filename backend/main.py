"""FastAPI backend: store and serve layout data (devices, connections)."""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .database import init_db
from .models import DeviceTypeTemplate, Layout, PortType
from .device_type_store import delete_device_type, get_device_type, list_device_types, save_device_type
from .port_type_store import delete_port_type, get_port_type, list_port_types, save_port_type
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


@app.get("/device-types")
def api_list_device_types() -> list[DeviceTypeTemplate]:
    return list_device_types()


@app.get("/device-types/{template_id}")
def api_get_device_type(template_id: str) -> DeviceTypeTemplate:
    t = get_device_type(template_id)
    if not t:
        raise HTTPException(status_code=404, detail="Device type not found")
    return t


@app.post("/device-types")
def api_create_device_type(template: DeviceTypeTemplate) -> DeviceTypeTemplate:
    return save_device_type(template)


@app.put("/device-types/{template_id}")
def api_update_device_type(template_id: str, template: DeviceTypeTemplate) -> DeviceTypeTemplate:
    updated = template.model_copy(update={"id": template_id})
    return save_device_type(updated)


@app.delete("/device-types/{template_id}")
def api_delete_device_type(template_id: str) -> None:
    if not delete_device_type(template_id):
        raise HTTPException(status_code=404, detail="Device type not found")


@app.get("/port-types")
def api_list_port_types() -> list[PortType]:
    return list_port_types()


@app.get("/port-types/{port_type_id}")
def api_get_port_type(port_type_id: str) -> PortType:
    t = get_port_type(port_type_id)
    if not t:
        raise HTTPException(status_code=404, detail="Port type not found")
    return t


@app.post("/port-types")
def api_create_port_type(port_type: PortType) -> PortType:
    return save_port_type(port_type)


@app.put("/port-types/{port_type_id}")
def api_update_port_type(port_type_id: str, port_type: PortType) -> PortType:
    updated = port_type.model_copy(update={"id": port_type_id})
    return save_port_type(updated)


@app.delete("/port-types/{port_type_id}")
def api_delete_port_type(port_type_id: str) -> None:
    if not delete_port_type(port_type_id):
        raise HTTPException(status_code=404, detail="Port type not found")
