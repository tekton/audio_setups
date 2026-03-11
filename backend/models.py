"""Pydantic models for layout data. Serializable for API and persistence."""

from pydantic import BaseModel, Field


# Device types we support (DAC, phono, EQ, headphone_amp, speaker)
DeviceType = str  # use literal in API: "dac" | "phono" | "eq" | "headphone_amp" | "speaker"


class Position(BaseModel):
    x: float = 0.0
    y: float = 0.0


class Device(BaseModel):
    id: str
    type: str = Field(..., description="Device type or template id")
    label: str = ""
    position: Position = Field(default_factory=Position)
    input_ports: list = Field(default_factory=list, description="List of port names (str) or { name, type }")
    output_ports: list = Field(default_factory=list, description="List of port names (str) or { name, type }")
    template_id: str | None = Field(default=None, description="If set, ports are fixed from template")


class Connection(BaseModel):
    id: str
    from_device_id: str
    to_device_id: str
    from_port: str = ""
    to_port: str = ""
    from_port_type: str = ""
    to_port_type: str = ""


class PortDef(BaseModel):
    name: str
    type: str = "audio"


class DeviceTypeTemplate(BaseModel):
    """Custom device type (template) for the Add device dropdown. Ports have types for like-to-like matching."""
    id: str | None = None
    name: str = ""
    label: str = ""
    input_ports: list[PortDef] = Field(default_factory=list)
    output_ports: list[PortDef] = Field(default_factory=list)


class Layout(BaseModel):
    id: str | None = None  # Set by backend on create if omitted
    name: str = "Untitled layout"
    devices: list[Device] = Field(default_factory=list)
    connections: list[Connection] = Field(default_factory=list)
