import pytest
import asyncio
from httpx import AsyncClient
from app.services.simulation_service import simulation_runner

@pytest.mark.asyncio
async def test_citizen_can_cancel_active_emergency(client: AsyncClient):
    # 1. Login as citizen
    login_res = await client.post("/api/auth/demo-login/USER")
    assert login_res.status_code == 200
    user_token = login_res.json()["access_token"]
    user_headers = {"Authorization": f"Bearer {user_token}"}

    # 2. Create emergency
    payload = {
        "patient_name": "Cancellation Test User",
        "patient_age": 30,
        "emergency_type": "Accident",
        "contact_number": "+91 91234 56789",
        "pickup_address": "Kotturpuram, Chennai",
        "pickup_lat": 13.0163,
        "pickup_lng": 80.2435,
    }
    create_res = await client.post("/api/emergencies", json=payload, headers=user_headers)
    assert create_res.status_code == 201
    emg = create_res.json()
    emg_id = emg["id"]
    assigned_amb_id = emg.get("assigned_ambulance_id")

    # 3. Citizen cancels the emergency
    cancel_res = await client.post(
        f"/api/emergencies/{emg_id}/cancel",
        json={"cancellation_reason": "Patient stable, family taking to clinic"},
        headers=user_headers,
    )
    assert cancel_res.status_code == 200
    cancelled_emg = cancel_res.json()
    assert cancelled_emg["status"] == "CANCELLED"

    # 4. Check that ambulance (if assigned) is released back to AVAILABLE
    if assigned_amb_id:
        fleet_res = await client.get("/api/ambulances", headers=user_headers)
        assert fleet_res.status_code == 200
        ambulances = fleet_res.json()
        target_amb = next((a for a in ambulances if a["id"] == assigned_amb_id), None)
        if target_amb:
            assert target_amb["availability_status"] == "AVAILABLE"

@pytest.mark.asyncio
async def test_cancellation_is_idempotent(client: AsyncClient):
    login_res = await client.post("/api/auth/demo-login/USER")
    user_token = login_res.json()["access_token"]
    user_headers = {"Authorization": f"Bearer {user_token}"}

    # Create emergency
    payload = {
        "patient_name": "Idempotent Test User",
        "patient_age": 28,
        "emergency_type": "Breathing problem",
        "contact_number": "+91 99887 76655",
        "pickup_address": "Guindy, Chennai",
        "pickup_lat": 13.0067,
        "pickup_lng": 80.2024,
    }
    create_res = await client.post("/api/emergencies", json=payload, headers=user_headers)
    assert create_res.status_code == 201
    emg_id = create_res.json()["id"]

    # First cancel call
    res1 = await client.post(f"/api/emergencies/{emg_id}/cancel", headers=user_headers)
    assert res1.status_code == 200
    assert res1.json()["status"] == "CANCELLED"

    # Second cancel call (should not fail with 400 or 500; returns 200)
    res2 = await client.post(f"/api/emergencies/{emg_id}/cancel", headers=user_headers)
    assert res2.status_code == 200
    assert res2.json()["status"] == "CANCELLED"

@pytest.mark.asyncio
async def test_status_update_ignored_after_cancellation(client: AsyncClient):
    # Citizen creates and cancels
    login_user = await client.post("/api/auth/demo-login/USER")
    user_headers = {"Authorization": f"Bearer {login_user.json()['access_token']}"}

    emg_res = await client.post("/api/emergencies", json={
        "patient_name": "Stale Update Test",
        "patient_age": 45,
        "emergency_type": "Cardiac emergency",
        "contact_number": "+91 98401 11223",
        "pickup_address": "Adyar, Chennai",
        "pickup_lat": 13.0012,
        "pickup_lng": 80.2565,
    }, headers=user_headers)
    assert emg_res.status_code == 201
    emg_id = emg_res.json()["id"]

    # Cancel emergency
    await client.post(f"/api/emergencies/{emg_id}/cancel", headers=user_headers)

    # Driver attempts to update status to EN_ROUTE_TO_PICKUP
    login_driver = await client.post("/api/auth/demo-login/AMBULANCE_DRIVER")
    driver_headers = {"Authorization": f"Bearer {login_driver.json()['access_token']}"}

    update_res = await client.post(
        f"/api/emergencies/{emg_id}/status",
        json={"status": "EN_ROUTE_TO_PICKUP", "notes": "Driver trying to roll"},
        headers=driver_headers,
    )
    # The status must remain CANCELLED, not updated to EN_ROUTE_TO_PICKUP
    assert update_res.status_code == 200
    assert update_res.json()["status"] == "CANCELLED"

@pytest.mark.asyncio
async def test_dispatcher_can_cancel_emergency(client: AsyncClient):
    # Citizen creates
    login_user = await client.post("/api/auth/demo-login/USER")
    user_headers = {"Authorization": f"Bearer {login_user.json()['access_token']}"}
    emg_res = await client.post("/api/emergencies", json={
        "patient_name": "Dispatcher Cancel Test",
        "patient_age": 55,
        "emergency_type": "Injury",
        "contact_number": "+91 97777 88888",
        "pickup_address": "T. Nagar, Chennai",
        "pickup_lat": 13.0418,
        "pickup_lng": 80.2341,
    }, headers=user_headers)
    assert emg_res.status_code == 201
    emg_id = emg_res.json()["id"]

    # Dispatcher cancels
    login_disp = await client.post("/api/auth/demo-login/DISPATCHER")
    disp_headers = {"Authorization": f"Bearer {login_disp.json()['access_token']}"}

    cancel_res = await client.post(
        f"/api/emergencies/{emg_id}/cancel",
        json={"cancellation_reason": "False alarm confirmed via callback"},
        headers=disp_headers,
    )
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "CANCELLED"

@pytest.mark.asyncio
async def test_simulation_runner_halts_on_emergency_cancellation(client: AsyncClient):
    # Launch simulation
    sim_res = await client.post("/api/simulation/start", json={
        "emergency_type": "Cardiac emergency",
        "auto_advance_seconds": 10.0,  # long enough to remain running
    })
    assert sim_res.status_code == 200
    sim_data = sim_res.json()
    emg_id = sim_data["emergency_id"]

    # Verify simulation runner task is active
    assert simulation_runner.is_active(emg_id) is True

    # Cancel emergency via API
    login_disp = await client.post("/api/auth/demo-login/DISPATCHER")
    disp_headers = {"Authorization": f"Bearer {login_disp.json()['access_token']}"}
    cancel_res = await client.post(f"/api/emergencies/{emg_id}/cancel", headers=disp_headers)
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "CANCELLED"

    # Give event loop a cycle to finalize task cancellation
    await asyncio.sleep(0.1)

    # Verify simulation runner task was halted
    assert simulation_runner.is_active(emg_id) is False
