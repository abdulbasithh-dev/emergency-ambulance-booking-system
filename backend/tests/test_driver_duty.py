import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_citizen_mobile_register_and_login(client: AsyncClient):
    # 1. Register with mobile number
    reg_payload = {
        "full_name": "Kavitha Raman",
        "mobile_number": "9876500001",
        "password": "Password123!",
        "confirm_password": "Password123!",
    }
    res = await client.post("/api/v1/auth/citizen/register", json=reg_payload)
    assert res.status_code == 201
    data = res.json()
    assert "access_token" in data
    assert data["user"]["full_name"] == "Kavitha Raman"
    assert data["user"]["phone_number"] == "9876500001"
    assert data["user"]["role"] == "CITIZEN"

    # 2. Duplicate registration rejected
    dup_res = await client.post("/api/v1/auth/citizen/register", json=reg_payload)
    assert dup_res.status_code == 400
    assert "already exists" in dup_res.json()["detail"]

    # 3. Password mismatch rejected
    mismatch_payload = {
        "full_name": "Test User",
        "mobile_number": "9876500002",
        "password": "Password123!",
        "confirm_password": "DifferentPassword!",
    }
    mismatch_res = await client.post("/api/v1/auth/citizen/register", json=mismatch_payload)
    assert mismatch_res.status_code == 400

    # 4. Login with mobile number
    login_res = await client.post("/api/v1/auth/citizen/login", json={
        "mobile_number": "9876500001",
        "password": "Password123!",
    })
    assert login_res.status_code == 200
    assert "access_token" in login_res.json()

    # 5. Invalid mobile login rejected
    bad_login = await client.post("/api/v1/auth/citizen/login", json={
        "mobile_number": "9876500001",
        "password": "WrongPassword",
    })
    assert bad_login.status_code == 401

@pytest.mark.asyncio
async def test_driver_login_and_duty_status(client: AsyncClient):
    # 1. Driver Login with Driver ID (DRV-101)
    login_res = await client.post("/api/v1/auth/driver/login", json={
        "identifier": "DRV-101",
        "password": "Password123!",
    })
    assert login_res.status_code == 200
    driver_data = login_res.json()
    assert driver_data["user"]["role"] == "AMBULANCE_DRIVER"
    # Default after setup/login must be OFF_DUTY
    assert driver_data["user"]["duty_status"] == "OFF_DUTY"
    token = driver_data["access_token"]
    driver_headers = {"Authorization": f"Bearer {token}"}
    amb_id = driver_data["user"]["ambulance_id"]

    # 2. Also test Driver Login with mobile number
    login_phone_res = await client.post("/api/v1/auth/driver/login", json={
        "identifier": "9840022222",
        "password": "Password123!",
    })
    assert login_phone_res.status_code == 200

    # 3. Driver cannot accept emergency while OFF DUTY
    # Create emergency first as citizen
    cit_res = await client.post("/api/v1/auth/citizen/login", json={
        "mobile_number": "9876543210",
        "password": "Password123!",
    })
    cit_headers = {"Authorization": f"Bearer {cit_res.json()['access_token']}"}

    emg_res = await client.post("/api/v1/emergencies", json={
        "patient_name": "Emergency Duty Test Patient",
        "patient_age": 42,
        "emergency_type": "Accident",
        "contact_number": "+91 98400 99999",
        "pickup_address": "Guindy, Chennai",
        "pickup_lat": 13.0067,
        "pickup_lng": 80.2025,
    }, headers=cit_headers)
    assert emg_res.status_code == 201
    emg_data = emg_res.json()
    emg_id = emg_data["id"]
    assigned_amb_id = emg_data["assigned_ambulance_id"] or amb_id

    # Attempt to accept while OFF_DUTY -> must be rejected
    reject_res = await client.post(
        f"/api/v1/ambulances/{assigned_amb_id}/accept?emergency_id={emg_id}",
        headers=driver_headers
    )
    assert reject_res.status_code == 400
    assert "OFF DUTY" in reject_res.json()["detail"]

    # 4. Go ON DUTY
    duty_on_res = await client.post("/api/v1/auth/driver/duty-status", json={
        "duty_status": "ON_DUTY"
    }, headers=driver_headers)
    assert duty_on_res.status_code == 200
    assert duty_on_res.json()["duty_status"] == "ON_DUTY"
    active_amb_id = duty_on_res.json().get("ambulance_id") or assigned_amb_id

    # 5. Now Driver CAN accept emergency while ON DUTY
    accept_res = await client.post(
        f"/api/v1/ambulances/{active_amb_id}/accept?emergency_id={emg_id}",
        headers=driver_headers
    )
    assert accept_res.status_code == 200, f"Accept failed: {accept_res.status_code} {accept_res.text}"
    assert accept_res.json()["status"] == "accepted"

    # 6. Cannot accept a second emergency while BUSY
    emg2_res = await client.post("/api/v1/emergencies", json={
        "patient_name": "Second Patient",
        "patient_age": 35,
        "emergency_type": "Cardiac emergency",
        "contact_number": "+91 98400 88888",
        "pickup_address": "Saidapet, Chennai",
        "pickup_lat": 13.0210,
        "pickup_lng": 80.2230,
    }, headers=cit_headers)
    assert emg2_res.status_code == 201
    emg2_id = emg2_res.json()["id"]

    busy_res = await client.post(
        f"/api/v1/ambulances/{active_amb_id}/accept?emergency_id={emg2_id}",
        headers=driver_headers
    )
    assert busy_res.status_code == 400
    assert "busy" in busy_res.json()["detail"].lower()
