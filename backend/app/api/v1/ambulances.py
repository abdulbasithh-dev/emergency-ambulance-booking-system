from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.user import User
from app.models.ambulance import Ambulance
from app.models.emergency import EmergencyRequest
from app.models.enums import AmbulanceStatus, EmergencyStatus, EmergencyType, UserRole
from app.schemas.ambulance import (
    AmbulanceResponse,
    NearbyAmbulanceMatch,
    AmbulanceLocationUpdate,
    DriverStatusUpdate,
)
from app.api.deps import get_current_user, require_roles
from app.services.matching_service import AmbulanceMatchingService
from app.services.emergency_service import EmergencyService
from app.services.audit_service import AuditService
from app.websocket.connection_manager import manager

router = APIRouter(prefix="/ambulances", tags=["Ambulances"])

def format_ambulance(amb: Ambulance) -> AmbulanceResponse:
    driver_name = amb.driver.full_name if amb.driver else None
    driver_phone = amb.driver.phone_number if amb.driver else None
    return AmbulanceResponse(
        id=amb.id,
        vehicle_number=amb.vehicle_number,
        vehicle_type=amb.vehicle_type,
        current_lat=amb.current_lat,
        current_lng=amb.current_lng,
        heading=amb.heading,
        availability_status=amb.availability_status,
        status=amb.availability_status.value if amb.availability_status else "AVAILABLE",
        capabilities=amb.capabilities or "",
        model_info=amb.model_info or "",
        driver_id=amb.driver_id,
        driver_name=driver_name,
        driver_phone=driver_phone,
        updated_at=amb.updated_at,
    )

@router.get("", response_model=List[AmbulanceResponse])
async def list_ambulances(
    status_filter: Optional[AmbulanceStatus] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Ambulance).options(selectinload(Ambulance.driver))
    if status_filter:
        stmt = stmt.where(Ambulance.availability_status == status_filter)
    result = await db.execute(stmt)
    ambulances = result.scalars().all()
    return [format_ambulance(a) for a in ambulances]

@router.get("/nearby", response_model=List[NearbyAmbulanceMatch])
async def get_nearby_ambulances(
    lat: Optional[float] = Query(None, description="Pickup latitude"),
    lng: Optional[float] = Query(None, description="Pickup longitude"),
    latitude: Optional[float] = Query(None),
    longitude: Optional[float] = Query(None),
    emergency_type: EmergencyType = Query(EmergencyType.ACCIDENT),
    radius_km: float = Query(35.0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    actual_lat = latitude if latitude is not None else (lat if lat is not None else 12.9716)
    actual_lng = longitude if longitude is not None else (lng if lng is not None else 80.2433)
    matches = await AmbulanceMatchingService.find_and_rank_nearby(
        db=db,
        pickup_lat=actual_lat,
        pickup_lng=actual_lng,
        emergency_type=emergency_type,
        max_radius_km=radius_km,
    )
    return matches

@router.get("/{ambulance_id}", response_model=AmbulanceResponse)
async def get_ambulance(ambulance_id: int, db: AsyncSession = Depends(get_db)):
    stmt = select(Ambulance).where(Ambulance.id == ambulance_id).options(selectinload(Ambulance.driver))
    amb = (await db.execute(stmt)).scalar_one_or_none()
    if not amb:
        raise HTTPException(status_code=404, detail="Ambulance not found")
    return format_ambulance(amb)

@router.patch("/{ambulance_id}/status", response_model=AmbulanceResponse)
async def patch_ambulance_status(
    ambulance_id: int,
    status: AmbulanceStatus = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    amb = await db.get(Ambulance, ambulance_id)
    if not amb:
        raise HTTPException(status_code=404, detail="Ambulance not found")

    # Prevent going offline or off-duty while currently assigned to an active emergency
    if status in [AmbulanceStatus.OFFLINE, AmbulanceStatus.OFF_DUTY]:
        stmt_emg = select(EmergencyRequest).where(
            EmergencyRequest.assigned_ambulance_id == ambulance_id,
            EmergencyRequest.status.notin_([EmergencyStatus.CASE_COMPLETED, EmergencyStatus.CANCELLED]),
        )
        active_emg = (await db.execute(stmt_emg)).scalar_one_or_none()
        if active_emg:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot change duty status while active emergency mission #{active_emg.id} is in progress. Complete patient handover first."
            )

    amb.availability_status = status
    await db.commit()

    # If ambulance just went on-duty/available and has a driver, auto-assign any pending emergency waiting for unit
    if status == AmbulanceStatus.AVAILABLE and amb.driver_id:
        unassigned_stmt = (
            select(EmergencyRequest)
            .where(EmergencyRequest.status == EmergencyStatus.SEARCHING_AMBULANCE)
            .order_by(EmergencyRequest.created_at.asc())
        )
        unassigned_emg = (await db.execute(unassigned_stmt)).scalars().first()
        if unassigned_emg:
            try:
                await EmergencyService.assign_ambulance(
                    db=db,
                    emergency_id=unassigned_emg.id,
                    ambulance_id=amb.id,
                    assigned_by_user_id=amb.driver_id,
                )
            except Exception as e:
                pass

    # Notify dispatchers of the fleet status change
    await manager.send_to_dispatchers("FLEET_STATUS_UPDATED", {
        "ambulance_id": amb.id,
        "vehicle_number": amb.vehicle_number,
        "availability_status": status.value,
    })

    stmt = select(Ambulance).where(Ambulance.id == ambulance_id).options(selectinload(Ambulance.driver))
    updated_amb = (await db.execute(stmt)).scalar_one()
    return format_ambulance(updated_amb)

@router.patch("/{ambulance_id}/location")
async def patch_ambulance_location(
    ambulance_id: int,
    payload: AmbulanceLocationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    amb = await db.get(Ambulance, ambulance_id)
    if not amb:
        raise HTTPException(status_code=404, detail="Ambulance not found")
    amb.current_lat = payload.latitude
    amb.current_lng = payload.longitude
    if payload.heading is not None:
        amb.heading = payload.heading
    await db.commit()
    return {"status": "success", "ambulance_id": ambulance_id, "lat": amb.current_lat, "lng": amb.current_lng}

@router.post("/location")
async def update_ambulance_location(
    payload: AmbulanceLocationUpdate,
    current_user: User = Depends(require_roles(UserRole.AMBULANCE_DRIVER, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """Driver device sends real-time GPS coordinates."""
    if not current_user.ambulance and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=400, detail="Current driver has no assigned ambulance vehicle")

    amb = current_user.ambulance
    amb.current_lat = payload.latitude
    amb.current_lng = payload.longitude
    amb.heading = payload.heading or 0.0
    await db.commit()

    # Find active emergency associated with this ambulance
    stmt = (
        select(EmergencyRequest)
        .where(
            EmergencyRequest.assigned_ambulance_id == amb.id,
            EmergencyRequest.status.notin_([EmergencyStatus.CASE_COMPLETED, EmergencyStatus.CANCELLED]),
        )
    )
    active_emg = (await db.execute(stmt)).scalar_one_or_none()

    loc_data = {
        "ambulance_id": amb.id,
        "vehicle_number": amb.vehicle_number,
        "latitude": payload.latitude,
        "longitude": payload.longitude,
        "heading": payload.heading,
        "emergency_id": active_emg.id if active_emg else None,
    }

    # Broadcast to dispatchers
    await manager.send_to_dispatchers("AMBULANCE_LOCATION_UPDATE", loc_data)

    # Broadcast to patient user if on an active emergency
    if active_emg:
        await manager.send_to_user(active_emg.user_id, "AMBULANCE_LOCATION_UPDATE", loc_data)
        if active_emg.selected_hospital_id:
            await manager.send_to_hospital(active_emg.selected_hospital_id, "AMBULANCE_LOCATION_UPDATE", loc_data)

    return {"status": "success", "data": loc_data}

@router.post("/status")
async def update_driver_status(
    payload: DriverStatusUpdate,
    request: Request,
    current_user: User = Depends(require_roles(UserRole.AMBULANCE_DRIVER, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.ambulance:
        raise HTTPException(status_code=400, detail="Driver has no assigned vehicle")

    amb = current_user.ambulance
    old_status = amb.availability_status.value
    amb.availability_status = payload.availability_status
    await db.commit()

    client_ip = request.client.host if request.client else None
    await AuditService.log_action(
        db=db,
        action="DRIVER_STATUS_CHANGED",
        entity_type="Ambulance",
        entity_id=amb.id,
        user_id=current_user.id,
        previous_value=old_status,
        new_value=payload.availability_status.value,
        ip_address=client_ip,
    )

    await manager.send_to_dispatchers("FLEET_STATUS_UPDATED", {
        "ambulance_id": amb.id,
        "vehicle_number": amb.vehicle_number,
        "availability_status": payload.availability_status.value,
    })

    return {"status": "success", "availability_status": payload.availability_status}

@router.post("/{ambulance_id}/accept")
async def driver_accept_emergency(
    ambulance_id: int,
    request: Request,
    emergency_id: int = Query(..., description="ID of emergency to accept"),
    current_user: User = Depends(require_roles(UserRole.AMBULANCE_DRIVER, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """Driver explicitly accepts an assigned emergency dispatch."""
    emergency = await EmergencyService.get_emergency_by_id(db, emergency_id)
    if not emergency:
        raise HTTPException(status_code=404, detail="Emergency not found")

    client_ip = request.client.host if request.client else None
    updated = await EmergencyService.update_status(
        db=db,
        emergency_id=emergency_id,
        new_status=EmergencyStatus.DRIVER_ACCEPTED,
        changed_by_user_id=current_user.id,
        notes="Driver acknowledged and accepted the emergency call.",
        client_ip=client_ip,
    )
    return {"status": "accepted", "emergency": updated}

@router.post("/{ambulance_id}/reject")
async def driver_reject_emergency(
    ambulance_id: int,
    request: Request,
    emergency_id: int = Query(..., description="ID of emergency to reject"),
    reason: str = Query("Mechanical delay / traffic blockage"),
    current_user: User = Depends(require_roles(UserRole.AMBULANCE_DRIVER, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """Driver rejects incoming emergency. System frees ambulance and alerts dispatch for alternative unit."""
    emergency = await EmergencyService.get_emergency_by_id(db, emergency_id)
    if not emergency:
        raise HTTPException(status_code=404, detail="Emergency not found")

    amb = await db.get(Ambulance, ambulance_id)
    if amb:
        amb.availability_status = AmbulanceStatus.AVAILABLE

    emergency.status = EmergencyStatus.SEARCHING_AMBULANCE
    emergency.assigned_ambulance_id = None
    await db.commit()

    client_ip = request.client.host if request.client else None
    await AuditService.log_action(
        db=db,
        action="DRIVER_REJECTED",
        entity_type="EmergencyRequest",
        entity_id=emergency_id,
        user_id=current_user.id,
        previous_value=f"Ambulance ID {ambulance_id}",
        new_value=f"Rejected: {reason}",
        ip_address=client_ip,
    )

    # Notify dispatchers immediately
    await manager.send_to_dispatchers("EMERGENCY_DRIVER_REJECTED", {
        "emergency_id": emergency.id,
        "ambulance_id": ambulance_id,
        "reason": reason,
    })

    return {"status": "rejected", "message": "Emergency returned to dispatch pool"}
