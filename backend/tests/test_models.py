"""Layout validation: rack fit, side-by-side placement, overlap, defaults."""

import pytest
from pydantic import ValidationError

from backend.models import Layout

RACK = {"id": "r", "width_in": 19, "height_u": 4}


def device(dev_id, rack_u, rack_x=0, width_in=6, height_u=2, rack_id="r"):
    return {"id": dev_id, "type": "x", "width_in": width_in, "height_u": height_u,
            "rack_id": rack_id, "rack_u": rack_u, "rack_x": rack_x}


def layout(devices, racks=(RACK,)):
    return Layout(racks=list(racks), devices=devices)


def test_defaults():
    lay = Layout()
    assert lay.mode == "rack"
    assert lay.port_layout == "top_bottom"
    assert lay.racks == []


def test_device_defaults_to_free_19in_1u():
    d = Layout(devices=[{"id": "a", "type": "x"}]).devices[0]
    assert (d.width_in, d.height_u, d.rack_id, d.rack_x, d.port_layout) == (19, 1, None, 0, None)


def test_side_by_side_devices_share_a_row():
    layout([device("a", 1, 0), device("b", 1, 6), device("c", 1, 12)])


def test_stacked_devices_fit():
    layout([device("a", 1), device("b", 3)])


@pytest.mark.parametrize("bad", [
    [device("a", 1, 0), device("b", 1, 5)],          # horizontal overlap
    [device("a", 1, 0), device("b", 2, 0)],          # vertical overlap (a spans U1-2)
    [device("a", 1, 14)],                            # runs off the right edge
    [device("a", 4)],                                # runs off the top (2U at U4 in a 4U rack)
    [device("a", 1, rack_id="missing")],             # unknown rack
    [{"id": "a", "type": "x", "rack_id": "r"}],      # racked with no rack_u
])
def test_invalid_placements_rejected(bad):
    with pytest.raises(ValidationError):
        layout(bad)


def test_device_wider_than_rack_rejected():
    with pytest.raises(ValidationError):
        layout([device("a", 1, width_in=19)], racks=[{"id": "r", "width_in": 10, "height_u": 4}])


@pytest.mark.parametrize("width", [5, 8, 20])
def test_rack_width_must_be_6_10_or_19(width):
    with pytest.raises(ValidationError):
        Layout(racks=[{"id": "r", "width_in": width}])


def test_invalid_port_layout_and_mode_rejected():
    with pytest.raises(ValidationError):
        Layout(port_layout="diagonal")
    with pytest.raises(ValidationError):
        Layout(mode="other")
