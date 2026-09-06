import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_emergency_lifecycle_and_rbac(client: AsyncClient):
    # 1. Login as Citizen User
    login_user = await client.post("/api/auth/demo-login/USER")
    user_token = login_user.json()["access_token"]
    user_headers = {"Authorization": f"Bearer {user_token}"}

    # 2. Citizen creates emergency
    emg_payload = {
        "patient_name": "Test Emergency Patient",
        "patient_age": 42,
        "emergency_type": "Accident",
        "contact_number": "+91 99999 33333",
        "pickup_address": "Velachery Main Road, Chennai",
        "pickup_lat": 12.9815,
        "pickup_lng": 80.2180,
    }
    create_res = await client.post("/api/emergencies", json=emg_payload, headers=user_headers)
    assert create_res.status_code == 201
    emg_data = create_res.json()
    emergency_id = emg_data["id"]
    assert emergency_id is not None
    assert emg_data["status"] in ["SEARCHING_AMBULANCE", "AMBULANCE_ASSIGNED"]

    # 3. Login as Driver
    login_driver = await client.post("/api/auth/demo-login/AMBULANCE_DRIVER")
    driver_token = login_driver.json()["access_token"]
    driver_headers = {"Authorization": f"Bearer {driver_token}"}

    # 4. Driver accepts emergency
    status_update = await client.post(
        f"/api/emergencies/{emergency_id}/status",
        json={"status": "DRIVER_ACCEPTED", "notes": "Driver en route"},
        headers=driver_headers,
    )
    assert status_update.status_code == 200
    assert status_update.json()["status"] == "DRIVER_ACCEPTED"

    # 5. User selects Hospital from recommendations
    # Fetch recommendations first
    rec_res = await client.get(
        f"/api/hospitals/recommended?lat=12.9815&lng=80.2180&emergency_type=Accident",
        headers=user_headers,
    )
    assert rec_res.status_code == 200
    recs = rec_res.json()
    assert len(recs) > 0
    chosen_hosp_id = recs[0]["hospital_id"]

    # Confirm hospital destination
    hosp_select = await client.post(
        f"/api/emergencies/{emergency_id}/hospital",
        json={"hospital_id": chosen_hosp_id},
        headers=user_headers,
    )
    assert hosp_select.status_code == 200
    assert hosp_select.json()["selected_hospital_id"] == chosen_hosp_id

    # 6. Driver completes case
    finish_res = await client.post(
        f"/api/emergencies/{emergency_id}/status",
        json={"status": "CASE_COMPLETED", "notes": "Patient admitted safely"},
        headers=driver_headers,
    )
    assert finish_res.status_code == 200
    assert finish_res.json()["status"] == "CASE_COMPLETED"


@pytest.mark.asyncio
async def test_emergency_creation_with_hospital_and_driver_view(client: AsyncClient):
    # 1. Login as Citizen User
    login_user = await client.post("/api/auth/demo-login/CITIZEN")
    user_token = login_user.json()["access_token"]
    user_headers = {"Authorization": f"Bearer {user_token}"}

    # 2. Get list of available hospitals
    hosp_res = await client.get("/api/hospitals")
    assert hosp_res.status_code == 200
    hospitals = hosp_res.json()
    assert len(hospitals) > 0
    target_hospital = hospitals[0]
    target_hospital_id = target_hospital["id"]

    # 3. Citizen creates emergency with chosen hospital pre-selected
    emg_payload = {
        "patient_name": "Emergency Patient With Hospital",
        "patient_age": 55,
        "emergency_type": "Cardiac emergency",
        "priority": "CRITICAL",
        "pickup_address": "T. Nagar, Chennai",
        "pickup_lat": 13.0418,
        "pickup_lng": 80.2341,
        "contact_number": "+91 98401 12345",
        "selected_hospital_id": target_hospital_id,
        "preferred_hospital": target_hospital["name"],
    }
    create_res = await client.post("/api/emergencies", json=emg_payload, headers=user_headers)
    assert create_res.status_code == 201
    created_data = create_res.json()
    emergency_id = created_data["id"]
    assert created_data["selected_hospital_id"] == target_hospital_id
    assert created_data["selected_hospital"] is not None
    assert created_data["selected_hospital"]["id"] == target_hospital_id

    # 4. Login as Driver and check active emergency visibility
    login_driver = await client.post("/api/auth/demo-login/AMBULANCE_DRIVER")
    assert login_driver.status_code == 200
    driver_token = login_driver.json()["access_token"]
    driver_headers = {"Authorization": f"Bearer {driver_token}"}

    active_res = await client.get("/api/emergencies/active/current", headers=driver_headers)
    assert active_res.status_code == 200
    active_data = active_res.json()
    assert active_data is not None, "Driver must receive the active emergency"
    assert active_data["id"] == emergency_id
    assert active_data["selected_hospital_id"] == target_hospital_id
    assert active_data["selected_hospital"]["name"] == target_hospital["name"]

    # 5. Clean up by completing case
    comp_res = await client.post(
        f"/api/emergencies/{emergency_id}/status",
        json={"status": "CASE_COMPLETED", "notes": "Handover complete at hospital"},
        headers=driver_headers,
    )
    assert comp_res.status_code == 200


@pytest.mark.asyncio
async def test_arrived_at_pickup_status_and_location_sync(client: AsyncClient):
    # 1. Citizen creates emergency
    login_user = await client.post("/api/auth/demo-login/CITIZEN")
    user_headers = {"Authorization": f"Bearer {login_user.json()['access_token']}"}

    pickup_lat, pickup_lng = 13.0335, 80.2690
    emg_payload = {
        "patient_name": "Arrived Scene Test Patient",
        "patient_age": 48,
        "emergency_type": "Cardiac emergency",
        "priority": "CRITICAL",
        "pickup_address": "Mylapore Tank, Luz Corner, Chennai",
        "pickup_lat": pickup_lat,
        "pickup_lng": pickup_lng,
        "contact_number": "+91 98401 23456",
    }
    create_res = await client.post("/api/emergencies", json=emg_payload, headers=user_headers)
    assert create_res.status_code == 201
    emg_id = create_res.json()["id"]

    # 2. Driver accepts
    login_driver = await client.post("/api/auth/demo-login/AMBULANCE_DRIVER")
    driver_headers = {"Authorization": f"Bearer {login_driver.json()['access_token']}"}

    accept_res = await client.post(
        f"/api/emergencies/{emg_id}/status",
        json={"status": "DRIVER_ACCEPTED", "notes": "Responding to scene"},
        headers=driver_headers,
    )
    assert accept_res.status_code == 200

    # 3. Driver advances status to ARRIVED_AT_PICKUP
    arrived_res = await client.post(
        f"/api/emergencies/{emg_id}/status",
        json={"status": "ARRIVED_AT_PICKUP", "notes": "Arrived on scene"},
        headers=driver_headers,
    )
    assert arrived_res.status_code == 200
    arrived_data = arrived_res.json()
    assert arrived_data["status"] == "ARRIVED_AT_PICKUP"
    assert arrived_data["estimated_eta_minutes"] == 0.0
    assert arrived_data["estimated_distance_km"] == 0.0

    # 4. Citizen fetches active emergency and sees ARRIVED_AT_PICKUP with 0 ETA
    citizen_active = await client.get("/api/emergencies/active/current", headers=user_headers)
    assert citizen_active.status_code == 200
    citizen_data = citizen_active.json()
    assert citizen_data["id"] == emg_id
    assert citizen_data["status"] == "ARRIVED_AT_PICKUP"
    assert citizen_data["estimated_eta_minutes"] == 0.0
    assert citizen_data["estimated_distance_km"] == 0.0
    # Ambulance location is synced to scene
    amb = citizen_data["assigned_ambulance"]
    assert amb is not None
    assert abs(amb["current_lat"] - pickup_lat) < 0.0001
    assert abs(amb["current_lng"] - pickup_lng) < 0.0001

    # 5. Clean up
    await client.post(
        f"/api/emergencies/{emg_id}/status",
        json={"status": "CASE_COMPLETED", "notes": "Handover complete"},
        headers=driver_headers,
    )


