import asyncio
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.user import User
from app.models.ambulance import Ambulance
from app.models.enums import EmergencyType, EmergencyPriority, UserRole
from app.services.emergency_service import EmergencyService
from app.services.simulation_service import simulation_runner
from app.websocket.connection_manager import manager

router = APIRouter(prefix="/simulation", tags=["Live Simulation Engine"])

class SimulationStartPayload(BaseModel):
    emergency_type: Optional[str] = "Cardiac emergency"
    severity_level: Optional[str] = "CRITICAL"
    auto_advance_seconds: Optional[float] = 2.5

@router.get("/status")
async def get_simulation_status():
    """Check if simulation is currently actively running."""
    active_ids = list(simulation_runner.active_tasks.keys())
    is_running = len(active_ids) > 0
    return {
        "is_running": is_running,
        "active_count": len(active_ids),
        "active_emergency_ids": active_ids,
        "emergency_id": active_ids[0] if active_ids else None,
    }

@router.post("/start")
async def start_simulation(
    payload: Optional[SimulationStartPayload] = None,
    db: AsyncSession = Depends(get_db),
):
    """Start automated live GPS simulation."""
    speed = payload.auto_advance_seconds if payload and payload.auto_advance_seconds else 2.5
    raw_type = (payload.emergency_type if payload and payload.emergency_type else "Cardiac emergency").lower()
    
    selected_type = EmergencyType.CARDIAC
    for et in EmergencyType:
        if et.value.lower() in raw_type or raw_type in et.value.lower():
            selected_type = et
            break

    # Find demo user
    user_stmt = select(User).where(User.role.in_([UserRole.USER, UserRole.CITIZEN]))
    demo_user = (await db.execute(user_stmt)).scalars().first()
    if not demo_user:
        raise HTTPException(status_code=500, detail="Demo user not found. Please seed the database.")

    # Find demo ambulance
    amb_stmt = select(Ambulance)
    demo_amb = (await db.execute(amb_stmt)).scalars().first()
    if not demo_amb:
        raise HTTPException(status_code=500, detail="No ambulance found. Please seed the database.")

    pickup_lat = 12.9038
    pickup_lng = 80.2290
    pickup_address = "OMR Tech Park, Sholinganallur, Chennai"

    emergency = await EmergencyService.create_emergency(
        db=db,
        user_id=demo_user.id,
        patient_name="Alex Johnson",
        patient_age=34,
        emergency_type=selected_type,
        priority=EmergencyPriority.CRITICAL,
        description="Vehicular collision with passenger leg injury. Immediate emergency response requested.",
        contact_number="+91 98401 23456",
        pickup_address=pickup_address,
        pickup_lat=pickup_lat,
        pickup_lng=pickup_lng,
    )

    await EmergencyService.assign_ambulance(
        db=db,
        emergency_id=emergency.id,
        ambulance_id=demo_amb.id,
        assigned_by_user_id=demo_user.id,
    )

    task = asyncio.create_task(simulation_runner.run_end_to_end(emergency.id, step_delay=speed))
    simulation_runner.active_tasks[emergency.id] = task

    return {
        "status": "simulation_started",
        "is_running": True,
        "emergency_id": emergency.id,
        "ambulance_id": demo_amb.id,
        "vehicle_number": demo_amb.vehicle_number,
        "step_delay": speed,
        "message": "Real-time emergency simulation started. Live GPS location broadcasting on WebSockets.",
    }

@router.post("/stop")
async def stop_all_simulations():
    """Halt all active simulations."""
    active_ids = list(simulation_runner.active_tasks.keys())
    for eid in active_ids:
        simulation_runner.stop_simulation(eid)
    try:
        await manager.broadcast("SIMULATION_ENDED", {
            "status": "STOPPED",
            "stopped_emergencies": active_ids,
            "message": "All simulations stopped",
        })
    except Exception:
        pass
    return {"status": "stopped", "is_running": False, "stopped_emergencies": active_ids}

@router.post("/quick-demo")
async def start_quick_demo(
    emergency_type: EmergencyType = Query(EmergencyType.ACCIDENT),
    speed: float = Query(1.5, description="Seconds per step delay"),
    db: AsyncSession = Depends(get_db),
):
    """Legacy 1-Click Demo Launcher."""
    payload = SimulationStartPayload(
        emergency_type=emergency_type.value,
        auto_advance_seconds=speed
    )
    return await start_simulation(payload=payload, db=db)

@router.post("/stop/{emergency_id}")
async def stop_simulation(emergency_id: int):
    simulation_runner.stop_simulation(emergency_id)
    try:
        await manager.broadcast("SIMULATION_ENDED", {
            "emergency_id": emergency_id,
            "status": "STOPPED",
            "message": f"Simulation stopped for emergency {emergency_id}",
        })
    except Exception:
        pass
    return {"status": "stopped", "emergency_id": emergency_id}
