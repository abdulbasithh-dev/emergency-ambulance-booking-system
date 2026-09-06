import sys
import time
import requests

BASE_URL = "http://127.0.0.1:8000"

def test_live_cancellation():
    print("=" * 70)
    print("RESQ EMERGENCY DISPATCH & CANCELLATION LIVE TERMINAL VERIFICATION")
    print("=" * 70)

    # 1. Authenticate as Citizen
    print("\n[Step 1] Authenticating as Citizen (Alex Johnson)...")
    res = requests.post(f"{BASE_URL}/api/v1/auth/demo-login?role=USER")
    assert res.status_code == 200, f"Auth failed: {res.text}"
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print(f"  -> SUCCESS: Received access token: {token[:20]}...")

    # 2. Trigger 1-Click Live Simulation
    print("\n[Step 2] Triggering Live Simulation...")
    sim_res = requests.post(f"{BASE_URL}/api/v1/simulation/start", json={
        "emergency_type": "Cardiac emergency",
        "severity_level": "CRITICAL",
        "auto_advance_seconds": 3.0
    }, headers=headers)
    assert sim_res.status_code == 200, f"Simulation start failed: {sim_res.text}"
    sim_data = sim_res.json()
    emergency_id = sim_data["emergency_id"]
    assigned_amb_id = sim_data.get("ambulance_id")
    print(f"  -> SUCCESS: Emergency #{emergency_id} created with Ambulance #{assigned_amb_id} ({sim_data.get('vehicle_number')})")

    # 3. Check Simulation Status
    print("\n[Step 3] Verifying Simulation is Actively Running...")
    status_res = requests.get(f"{BASE_URL}/api/v1/simulation/status")
    assert status_res.status_code == 200
    st_data = status_res.json()
    print(f"  -> Active emergencies in runner: {st_data['active_emergency_ids']}")
    assert emergency_id in st_data["active_emergency_ids"], "Emergency task should be active in simulation runner"
    print("  -> SUCCESS: SimulationRunner has active asyncio task running.")

    # 4. Wait for 2 seconds to simulate ambulance rolling
    print("\n[Step 4] Waiting 2 seconds while ambulance unit is dispatched...")
    time.sleep(2)

    # 5. Cancel Emergency Request
    print(f"\n[Step 5] Calling POST /api/v1/emergencies/{emergency_id}/cancel...")
    cancel_res = requests.post(f"{BASE_URL}/api/v1/emergencies/{emergency_id}/cancel", json={
        "cancellation_reason": "Citizen cancelled via live console test: Patient stabilized."
    }, headers=headers)
    assert cancel_res.status_code == 200, f"Cancellation failed: {cancel_res.text}"
    cancelled_data = cancel_res.json()
    print(f"  -> SUCCESS: Emergency status is now: {cancelled_data['status']}")
    assert cancelled_data["status"] == "CANCELLED"

    # 6. Verify Simulation Task was Terminated
    print("\n[Step 6] Checking simulation runner status after cancellation...")
    post_status_res = requests.get(f"{BASE_URL}/api/v1/simulation/status")
    post_st_data = post_status_res.json()
    print(f"  -> Active emergency tasks: {post_st_data['active_emergency_ids']}")
    assert emergency_id not in post_st_data["active_emergency_ids"], "Emergency task must be removed from simulation runner!"
    print("  -> SUCCESS: Background simulation task was successfully stopped and cancelled.")

    # 7. Check Ambulance Availability
    print("\n[Step 7] Checking ambulance availability status...")
    amb_res = requests.get(f"{BASE_URL}/api/v1/ambulances/{assigned_amb_id}", headers=headers)
    if amb_res.status_code == 200:
        amb_data = amb_res.json()
        print(f"  -> Ambulance #{assigned_amb_id} status: {amb_data['availability_status']}")
        assert amb_data["availability_status"] == "AVAILABLE"
        print("  -> SUCCESS: Ambulance successfully released back to AVAILABLE!")

    # 8. Test Idempotent Cancellation
    print("\n[Step 8] Testing Idempotent Cancellation (calling cancel again)...")
    repeat_cancel = requests.post(f"{BASE_URL}/api/v1/emergencies/{emergency_id}/cancel", headers=headers)
    assert repeat_cancel.status_code == 200
    assert repeat_cancel.json()["status"] == "CANCELLED"
    print("  -> SUCCESS: Second cancel call returned 200 OK without errors.")

    # 9. Verify Stale Updates Ignored
    print("\n[Step 9] Testing that subsequent status transitions are rejected for cancelled emergency...")
    stale_update = requests.post(f"{BASE_URL}/api/v1/emergencies/{emergency_id}/status", json={
        "status": "EN_ROUTE_TO_PICKUP",
        "notes": "Attempting unauthorized state resurrection"
    }, headers=headers)
    assert stale_update.status_code == 200
    assert stale_update.json()["status"] == "CANCELLED"
    print("  -> SUCCESS: Status remains CANCELLED. Stale update correctly discarded.")

    print("\n" + "=" * 70)
    print("ALL LIVE VERIFICATION CHECKS PASSED PERFECTLY!")
    print("=" * 70)

if __name__ == "__main__":
    test_live_cancellation()
