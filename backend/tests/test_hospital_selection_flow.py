import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_full_hospital_first_emergency_workflow(client: AsyncClient):
    # 1. Login as Citizen User
    login_user = await client.post("/api/auth/demo-login/CITIZEN")
    assert login_user.status_code == 200
    user_token = login_user.json()["access_token"]
    user_headers = {"Authorization": f"Bearer {user_token}"}

    # 2. Citizen queries nearest hospitals
    rec_res = await client.get(
        "/api/hospitals/recommendations?lat=12.8235&lng=80.0445&emergency_type=Cardiac+arrest",
        headers=user_headers,
    )
    assert rec_res.status_code == 200
    recs = rec_res.json()
    assert len(recs) > 0
    selected_hosp = recs[0]
    selected_hosp_id = selected_hosp["hospital_id"]

    # 3. Citizen selects hospital and requests emergency care
    emg_payload = {
        "patient_name": "Ravi Shankar",
        "patient_age": 48,
        "emergency_type": "Cardiac emergency",
        "priority": "CRITICAL",
        "pickup_address": "41, Potheri, SRM University Campus, Chennai",
        "pickup_lat": 12.8235,
        "pickup_lng": 80.0445,
        "contact_number": "+91 98765 43210",
        "selected_hospital_id": selected_hosp_id,
        "preferred_hospital": selected_hosp["name"],
    }
    create_res = await client.post("/api/emergencies", json=emg_payload, headers=user_headers)
    assert create_res.status_code == 201
    emergency = create_res.json()
    emergency_id = emergency["id"]
    assert emergency["selected_hospital_id"] == selected_hosp_id

    # 4. Hospital staff reviews and accepts the incoming case
    login_hosp = await client.post("/api/auth/demo-login/HOSPITAL_STAFF")
    assert login_hosp.status_code == 200
    hosp_token = login_hosp.json()["access_token"]
    hosp_headers = {"Authorization": f"Bearer {hosp_token}"}

    accept_case_res = await client.post(
        f"/api/hospitals/{selected_hosp_id}/cases/{emergency_id}/action",
        json={"action": "ACCEPTED"},
        headers=hosp_headers,
    )
    assert accept_case_res.status_code == 200
    assert accept_case_res.json()["status"] == "accepted"

    # 5. Driver logs in, receives alert, and accepts the request via PATCH
    login_driver = await client.post("/api/auth/demo-login/AMBULANCE_DRIVER")
    assert login_driver.status_code == 200
    driver_token = login_driver.json()["access_token"]
    driver_headers = {"Authorization": f"Bearer {driver_token}"}

    driver_accept_res = await client.patch(
        f"/api/emergencies/{emergency_id}/status",
        json={"status": "DRIVER_ACCEPTED", "notes": "Driver accepted assignment"},
        headers=driver_headers,
    )
    assert driver_accept_res.status_code == 200
    assert driver_accept_res.json()["status"] == "DRIVER_ACCEPTED"

    # 6. Driver arrives at pickup
    arrive_pickup_res = await client.patch(
        f"/api/emergencies/{emergency_id}/status",
        json={"status": "ARRIVED_AT_PICKUP", "notes": "Ambulance arrived at patient scene"},
        headers=driver_headers,
    )
    assert arrive_pickup_res.status_code == 200
    assert arrive_pickup_res.json()["status"] == "ARRIVED_AT_PICKUP"

    # 7. Driver confirms patient pickup via popup
    pickup_confirm_res = await client.patch(
        f"/api/emergencies/{emergency_id}/status",
        json={"status": "PATIENT_LOADED", "notes": f"Confirmed patient pickup. Heading to {selected_hosp['name']}."},
        headers=driver_headers,
    )
    assert pickup_confirm_res.status_code == 200
    # Normalizes to PATIENT_ONBOARD
    assert pickup_confirm_res.json()["status"] in ["PATIENT_ONBOARD", "EN_ROUTE_TO_HOSPITAL"]

    # 8. Driver arrives at hospital
    arrive_hosp_res = await client.patch(
        f"/api/emergencies/{emergency_id}/status",
        json={"status": "ARRIVED_AT_HOSPITAL", "notes": "Arrived at hospital ER entrance"},
        headers=driver_headers,
    )
    assert arrive_hosp_res.status_code == 200
    assert arrive_hosp_res.json()["status"] == "ARRIVED_AT_HOSPITAL"

    # 9. Hospital staff completes clinical handover via handover endpoint
    handover_res = await client.post(
        f"/api/hospitals/handover/{emergency_id}",
        json={"doctor_name": "Dr. Ananya Roy (ER Lead)", "notes": "Patient admitted to ICU"},
        headers=hosp_headers,
    )
    assert handover_res.status_code == 200
    assert handover_res.json()["status"] == "success"

    # 10. Verify emergency is completed
    check_res = await client.get(f"/api/emergencies/{emergency_id}", headers=user_headers)
    assert check_res.status_code == 200
    assert check_res.json()["status"] in ["CASE_COMPLETED", "HANDOVER_COMPLETE"]
