"""In-memory store for device type templates. Can add DB persistence later."""

import uuid

from .models import DeviceTypeTemplate

_templates: dict[str, DeviceTypeTemplate] = {}


def list_device_types() -> list[DeviceTypeTemplate]:
    return list(_templates.values())


def get_device_type(template_id: str) -> DeviceTypeTemplate | None:
    return _templates.get(template_id)


def save_device_type(template: DeviceTypeTemplate) -> DeviceTypeTemplate:
    tid = template.id or f"dt_{uuid.uuid4().hex[:12]}"
    updated = template.model_copy(update={"id": tid})
    _templates[tid] = updated
    return updated


def delete_device_type(template_id: str) -> bool:
    if template_id in _templates:
        del _templates[template_id]
        return True
    return False
