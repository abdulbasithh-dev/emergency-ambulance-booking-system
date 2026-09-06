import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_pages_render_successfully(client: AsyncClient):
    """Verify that all Jinja2 page templates render HTTP 200."""
    routes = [
        ("/", "ResQ"),
        ("/citizen", "Citizen Emergency Dispatch Console"),
        ("/driver", "Driver Cockpit HUD"),
        ("/hospital", "Emergency Trauma Center"),
        ("/dispatcher", "Emergency Dispatch Command Center"),
        ("/admin", "System Administrator"),
    ]

    for route, expected_text in routes:
        response = await client.get(route)
        assert response.status_code == 200, f"Failed for route {route} with status {response.status_code}"
        assert expected_text in response.text, f"Expected '{expected_text}' in response for {route}"
        assert "text/html" in response.headers.get("content-type", "")

@pytest.mark.asyncio
async def test_static_files_served(client: AsyncClient):
    """Verify static assets are properly mounted and served."""
    css_res = await client.get("/static/css/resq.css")
    assert css_res.status_code == 200
    assert "text/css" in css_res.headers.get("content-type", "")

    js_res = await client.get("/static/js/resq-core.js")
    assert js_res.status_code == 200

    map_res = await client.get("/static/js/resq-map.js")
    assert map_res.status_code == 200

@pytest.mark.asyncio
async def test_api_status_endpoint(client: AsyncClient):
    """Verify /api/status returns JSON operational status."""
    res = await client.get("/api/status")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "OPERATIONAL"
