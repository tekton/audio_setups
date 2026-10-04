"""Pydantic models for layout data. Serializable for API and persistence."""

from typing import Literal

from pydantic import BaseModel, Field, model_validator

RackWidth = Literal[6, 10, 19]  # inches
PortLayout = Literal["top_bottom", "sides"]  # inputs/outputs on top/bottom edges vs left/right edges


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
    width_in: RackWidth = Field(default=19, description="Panel width in inches (rack fit)")
    height_u: int = Field(default=1, ge=1, description="Height in rack units (1U = 1.75in)")
    rack_id: str | None = Field(default=None, description="Rack this device is mounted in, if any")
    rack_u: int | None = Field(default=None, ge=1, description="Lowest occupied U in the rack (1 = bottom)")
    port_layout: PortLayout | None = Field(default=None, description="Overrides the layout-wide port placement")
    rack_x: float = Field(default=0, ge=0, description="Inches from the rack's left rail (devices can share a row)")


class Rack(BaseModel):
    id: str
    label: str = ""
    width_in: RackWidth = 19
    height_u: int = Field(default=12, ge=1)
    position: Position = Field(default_factory=Position)


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


class PortType(BaseModel):
    """Defines a port type (name, type slug, color) for like-to-like and canvas coloring."""
    id: str | None = None
    name: str = ""
    type: str = ""  # slug used in PortDef.type, e.g. "audio", "power"
    color: str = "#808080"  # hex for canvas


class DeviceTypeTemplate(BaseModel):
    """Custom device type (template) for the Add device dropdown. Ports have types for like-to-like matching."""
    id: str | None = None
    name: str = ""
    label: str = ""
    input_ports: list[PortDef] = Field(default_factory=list)
    output_ports: list[PortDef] = Field(default_factory=list)
    width_in: RackWidth = 19
    height_u: int = Field(default=1, ge=1)


class Layout(BaseModel):
    id: str | None = None  # Set by backend on create if omitted
    name: str = "Untitled layout"
    devices: list[Device] = Field(default_factory=list)
    connections: list[Connection] = Field(default_factory=list)
    racks: list[Rack] = Field(default_factory=list)
    port_layout: PortLayout = "top_bottom"
    mode: Literal["rack", "classic"] = "rack"  # which view the layout belongs to; classic = freeform, no racks

    @model_validator(mode="after")
    def _racked_devices_fit(self):
        """Racked devices must reference a rack, fit its width and height, and not overlap."""
        racks = {r.id: r for r in self.racks}
        placed: dict[str, list[Device]] = {r.id: [] for r in self.racks}
        for d in self.devices:
            if d.rack_id is None:
                continue
            rack = racks.get(d.rack_id)
            if rack is None:
                raise ValueError(f"Device {d.id} references unknown rack {d.rack_id}")
            if d.rack_u is None:
                raise ValueError(f"Device {d.id} is in a rack but has no rack_u")
            if d.rack_x + d.width_in > rack.width_in:
                raise ValueError(f"Device {d.id} ({d.width_in}in at {d.rack_x}in) is wider than rack {rack.id} ({rack.width_in}in)")
            if d.rack_u + d.height_u - 1 > rack.height_u:
                raise ValueError(f"Device {d.id} does not fit in rack {rack.id} ({rack.height_u}U)")
            for o in placed[rack.id]:
                rows_overlap = d.rack_u < o.rack_u + o.height_u and o.rack_u < d.rack_u + d.height_u
                cols_overlap = d.rack_x < o.rack_x + o.width_in and o.rack_x < d.rack_x + d.width_in
                if rows_overlap and cols_overlap:
                    raise ValueError(f"Device {d.id} overlaps device {o.id} in rack {rack.id}")
            placed[rack.id].append(d)
        return self
