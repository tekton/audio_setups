"""Pydantic models for layout data. Serializable for API and persistence."""

from pydantic import BaseModel, Field


# Device types we support (DAC, phono, EQ, headphone_amp, speaker)
DeviceType = str  # use literal in API: "dac" | "phono" | "eq" | "headphone_amp" | "speaker"


class Position(BaseModel):
    x: float = 0.0
    y: float = 0.0


class Device(BaseModel):
    id: str
    type: str = Field(..., description="One of: dac, phono, eq, headphone_amp, speaker")
    label: str = ""
    position: Position = Field(default_factory=Position)
    input_ports: list[str] = Field(default_factory=list, description="e.g. ['Phono', 'Line In']")
    output_ports: list[str] = Field(default_factory=list, description="e.g. ['Out L', 'Out R']")


class Connection(BaseModel):
    id: str
    from_device_id: str
    to_device_id: str
    from_port: str = ""
    to_port: str = ""


class Layout(BaseModel):
    id: str | None = None  # Set by backend on create if omitted
    name: str = "Untitled layout"
    devices: list[Device] = Field(default_factory=list)
    connections: list[Connection] = Field(default_factory=list)
