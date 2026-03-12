"""In-memory store for port types. Includes a hardcoded default."""

import uuid

from .models import PortType

# Default port type: always available, used when no port types are defined
DEFAULT_PORT_TYPE = PortType(
    id="default_audio",
    name="Audio",
    type="audio",
    color="#6b9b6b",
)

_port_types: dict[str, PortType] = {DEFAULT_PORT_TYPE.id: DEFAULT_PORT_TYPE}


def list_port_types() -> list[PortType]:
    return list(_port_types.values())


def get_port_type(port_type_id: str) -> PortType | None:
    return _port_types.get(port_type_id)


def get_port_type_by_slug(slug: str) -> PortType | None:
    for pt in _port_types.values():
        if pt.type == slug:
            return pt
    return None


def save_port_type(port_type: PortType) -> PortType:
    if port_type.id == DEFAULT_PORT_TYPE.id:
        return DEFAULT_PORT_TYPE
    pid = port_type.id or f"pt_{uuid.uuid4().hex[:12]}"
    updated = port_type.model_copy(update={"id": pid})
    _port_types[pid] = updated
    return updated


def delete_port_type(port_type_id: str) -> bool:
    if port_type_id == DEFAULT_PORT_TYPE.id:
        return False
    if port_type_id in _port_types:
        del _port_types[port_type_id]
        return True
    return False
