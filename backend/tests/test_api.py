"""Layout REST API round trips (in-memory store)."""

import pytest
from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)

RACKED = {
    "name": "Rack layout",
    "mode": "rack",
    "port_layout": "sides",
    "racks": [{"id": "r", "label": "Main", "width_in": 10, "height_u": 6, "position": {"x": 40, "y": 40}}],
    "devices": [
        {"id": "a", "type": "dac", "width_in": 6, "height_u": 1, "rack_id": "r", "rack_u": 6, "rack_x": 0,
         "port_layout": "top_bottom"},
    ],
}


@pytest.fixture
def created():
    res = client.post("/layouts", json=RACKED)
    assert res.status_code == 200
    layout = res.json()
    yield layout
    client.delete(f"/layouts/{layout['id']}")


def test_create_and_get_preserves_rack_fields(created):
    got = client.get(f"/layouts/{created['id']}").json()
    assert got["mode"] == "rack"
    assert got["port_layout"] == "sides"
    assert got["racks"][0]["height_u"] == 6
    assert got["devices"][0]["rack_u"] == 6
    assert got["devices"][0]["port_layout"] == "top_bottom"


def test_classic_layout_is_listed_with_its_mode():
    res = client.post("/layouts", json={"name": "Classic", "mode": "classic", "port_layout": "sides"})
    lid = res.json()["id"]
    try:
        listed = {l["id"]: l for l in client.get("/layouts").json()}
        assert listed[lid]["mode"] == "classic"
    finally:
        client.delete(f"/layouts/{lid}")


def test_update_layout(created):
    body = {**created, "name": "Renamed"}
    res = client.put(f"/layouts/{created['id']}", json=body)
    assert res.status_code == 200
    assert client.get(f"/layouts/{created['id']}").json()["name"] == "Renamed"


def test_update_with_mismatched_id_is_rejected(created):
    assert client.put("/layouts/other", json=created).status_code == 400


def test_overlapping_devices_get_422():
    body = {**RACKED, "devices": [RACKED["devices"][0], {**RACKED["devices"][0], "id": "b"}]}
    assert client.post("/layouts", json=body).status_code == 422


def test_missing_layout_404():
    assert client.get("/layouts/nope").status_code == 404
    assert client.delete("/layouts/nope").status_code == 404
