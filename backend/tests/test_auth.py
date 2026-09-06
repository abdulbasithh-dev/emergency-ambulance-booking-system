import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_auth_register_and_login(client: AsyncClient):
    # Test Register
    reg_payload = {
        "email": "testpilot@resq.com",
        "password": "Password123!",
        "full_name": "Test Pilot",
        "phone_number": "+91 99999 11111",
        "role": "USER",
        "emergency_contact": "+91 88888 22222",
    }
    res = await client.post("/api/auth/register", json=reg_payload)
    assert res.status_code == 201
    data = res.json()
    assert "access_token" in data
    assert data["user"]["email"] == "testpilot@resq.com"

    # Test Login
    login_payload = {
        "email": "testpilot@resq.com",
        "password": "Password123!",
    }
    res_login = await client.post("/api/auth/login", json=login_payload)
    assert res_login.status_code == 200
    login_data = res_login.json()
    assert "access_token" in login_data

    # Test Invalid Password
    bad_login = {
        "email": "testpilot@resq.com",
        "password": "WrongPassword",
    }
    res_bad = await client.post("/api/auth/login", json=bad_login)
    assert res_bad.status_code == 401

@pytest.mark.asyncio
async def test_demo_login_endpoint(client: AsyncClient):
    res = await client.post("/api/auth/demo-login/DISPATCHER")
    assert res.status_code == 200
    data = res.json()
    assert data["user"]["role"] == "DISPATCHER"
