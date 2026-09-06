from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.user import User
from app.models.emergency import EmergencyRequest, EmergencyStatusHistory
from app.models.ambulance import Ambulance
from app.models.hospital import Hospital
from app.models.hospital_case import HospitalChangeRequest
from app.models.enums import (
    EmergencyStatus,
    EmergencyPriority,
    UserRole,
    ChangeRequestStatus,
    AmbulanceStatus,
)
from app.schemas.emergency import (
    EmergencyCreate,
    EmergencyResponse,
    EmergencyStatusUpdate,
    PriorityUpdate,
    HospitalSelectRequest,
    LocationUpdatePayload,
    HospitalChangePayload,
    HospitalChangeReviewPayload,
)
from app.api.deps import get_current_user, require_roles
from app.services.emergency_service import EmergencyService
from app.services.matching_service import AmbulanceMatchingService
from app.services.audit_service import AuditService
from app.websocket.connection_manager import manager

router = APIRouter(prefix="/emergencies", tags=["Emergencies"])

@router.post("", response_model=EmergencyResponse, status_code=status.HTTP_201_CREATED)
async def create_emergency(
    payload: EmergencyCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Report an emergency. Automatically searches for nearby available ambulances and initiates matching."""
    client_ip = request.client.host if request.client else None
    emergency = await EmergencyService.create_emergency(
        db=db,
        user_id=current_user.id,
        patient_name=payload.patient_name,
        patient_age=payload.patient_age,
        emergency_type=payload.emergency_type,
        priority=payload.priority,
        description=payload.description,
        medical_info=payload.medical_info,
        contact_number=payload.contact_number,
        preferred_hospital=payload.preferred_hospital,
        selected_hospital_id=payload.selected_hospital_id,
        pickup_address=payload.pickup_address,
        pickup_lat=payload.pickup_lat,
        pickup_lng=payload.pickup_lng,
        client_ip=client_ip,
    )

    # Automatically rank & assign closest available ambulance
    try:
        matches = await AmbulanceMatchingService.find_and_rank_nearby(
            db=db,
            pickup_lat=payload.pickup_lat,
            pickup_lng=payload.pickup_lng,
            emergency_type=payload.emergency_type,
        )
        if matches:
            top_match = matches[0]
            await EmergencyService.assign_ambulance(
                db=db,
                emergency_id=emergency.id,
                ambulance_id=top_match.ambulance_id,
                assigned_by_user_id=current_user.id,
                client_ip=client_ip,
            )
    except Exception as e:
        # If matching fails, request remains in SEARCHING_AMBULANCE state for dispatcher attention
        pass

    full_emergency = await EmergencyService.get_emergency_by_id(db, emergency.id)
    return full_emergency

@router.get("", response_model=List[EmergencyResponse])
async def list_emergencies(
    status_filter: Optional[EmergencyStatus] = None,
    active_only: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve list of emergencies respecting user role & permissions."""
    stmt = (
        select(EmergencyRequest)
        .options(
            selectinload(EmergencyRequest.assigned_ambulance),
            selectinload(EmergencyRequest.selected_hospital),
            selectinload(EmergencyRequest.status_history),
        )
        .order_by(desc(EmergencyRequest.created_at))
    )

    if current_user.role == UserRole.USER:
        stmt = stmt.where(EmergencyRequest.user_id == current_user.id)
    elif current_user.role == UserRole.AMBULANCE_DRIVER:
        if current_user.ambulance:
            stmt = stmt.where(EmergencyRequest.assigned_ambulance_id == current_user.ambulance.id)
        else:
            return []
    elif current_user.role == UserRole.HOSPITAL_STAFF:
        if current_user.hospital:
            stmt = stmt.where(EmergencyRequest.selected_hospital_id == current_user.hospital.id)
        else:
            return []

    if status_filter:
        stmt = stmt.where(EmergencyRequest.status == status_filter)

    if active_only:
        stmt = stmt.where(EmergencyRequest.status.notin_([EmergencyStatus.CASE_COMPLETED, EmergencyStatus.CANCELLED]))

    result = await db.execute(stmt)
    return result.scalars().all()

@router.get("/active/current", response_model=Optional[EmergencyResponse])
async def get_active_emergency(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Fetch currently active emergency for logged in citizen, driver, or hospital."""
    stmt = (
        select(EmergencyRequest)
        .where(EmergencyRequest.status.notin_([EmergencyStatus.CASE_COMPLETED, EmergencyStatus.CANCELLED]))
        .options(
            selectinload(EmergencyRequest.assigned_ambulance).selectinload(Ambulance.driver),
            selectinload(EmergencyRequest.selected_hospital),
            selectinload(EmergencyRequest.status_history),
        )
        .order_by(desc(EmergencyRequest.created_at))
    )
    if current_user.role in [UserRole.USER, UserRole.CITIZEN]:
        stmt = stmt.where(EmergencyRequest.user_id == current_user.id)
    elif current_user.role == UserRole.AMBULANCE_DRIVER:
        # Ensure driver has an assigned ambulance record
        my_amb = current_user.ambulance
        if not my_amb:
            amb_find = await db.execute(select(Ambulance).where(Ambulance.driver_id == current_user.id))
            my_amb = amb_find.scalars().first()
            if not my_amb:
                # Link first available ambulance or unassigned ambulance to driver
                unassigned_amb = (await db.execute(
                    select(Ambulance).order_by(Ambulance.driver_id.desc(), Ambulance.id.asc())
                )).scalars().first()
                if unassigned_amb:
                    unassigned_amb.driver_id = current_user.id
                    await db.commit()
                    my_amb = unassigned_amb

        amb_id = my_amb.id if my_amb else None

        if amb_id:
            driver_stmt = stmt.where(EmergencyRequest.assigned_ambulance_id == amb_id)
            active_emg = (await db.execute(driver_stmt)).scalars().first()
            if active_emg:
                return active_emg

            # Check for waiting unassigned emergencies or emergencies with unassigned driver
            pending_stmt = (
                select(EmergencyRequest)
                .where(
                    EmergencyRequest.status.notin_([EmergencyStatus.CASE_COMPLETED, EmergencyStatus.CANCELLED]),
                    (
                        (EmergencyRequest.status == EmergencyStatus.SEARCHING_AMBULANCE) |
                        (EmergencyRequest.assigned_ambulance_id.is_(None)) |
                        (EmergencyRequest.assigned_ambulance.has(Ambulance.driver_id.is_(None)))
                    )
                )
                .options(
                    selectinload(EmergencyRequest.assigned_ambulance).selectinload(Ambulance.driver),
                    selectinload(EmergencyRequest.selected_hospital),
                    selectinload(EmergencyRequest.status_history),
                )
                .order_by(desc(EmergencyRequest.created_at))
            )
            pending_emg = (await db.execute(pending_stmt)).scalars().first()
            if pending_emg:
                try:
                    assigned_emg = await EmergencyService.assign_ambulance(
                        db=db,
                        emergency_id=pending_emg.id,
                        ambulance_id=amb_id,
                        assigned_by_user_id=current_user.id,
                    )
                    return assigned_emg
                except Exception:
                    return pending_emg

            # Fallback: if any active emergency exists in system and driver has none, return it
            any_active = (await db.execute(stmt)).scalars().first()
            if any_active:
                if not any_active.assigned_ambulance_id or (any_active.assigned_ambulance and not any_active.assigned_ambulance.driver_id):
                    try:
                        any_active = await EmergencyService.assign_ambulance(
                            db=db,
                            emergency_id=any_active.id,
                            ambulance_id=amb_id,
                            assigned_by_user_id=current_user.id,
                        )
                    except Exception:
                        pass
                return any_active
            return None
        else:
            # Fallback if no ambulance found at all
            result = await db.execute(stmt)
            return result.scalars().first()
    elif current_user.role == UserRole.HOSPITAL_STAFF and current_user.hospital:
        stmt = stmt.where(EmergencyRequest.selected_hospital_id == current_user.hospital.id)

    result = await db.execute(stmt)
    return result.scalars().first()

@router.get("/{emergency_id}", response_model=EmergencyResponse)
async def get_emergency(
    emergency_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    emergency = await EmergencyService.get_emergency_by_id(db, emergency_id)
    if not emergency:
        raise HTTPException(status_code=404, detail="Emergency not found")

    # Authorization check
    if current_user.role == UserRole.USER and emergency.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this emergency")

    return emergency

@router.post("/{emergency_id}/cancel", response_model=EmergencyResponse)
async def cancel_emergency(
    emergency_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    emergency = await EmergencyService.get_emergency_by_id(db, emergency_id)
    if not emergency:
        raise HTTPException(status_code=404, detail="Emergency not found")

    if current_user.role == UserRole.USER and emergency.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to cancel this emergency")

    if emergency.status in [EmergencyStatus.CASE_COMPLETED, EmergencyStatus.CANCELLED]:
        raise HTTPException(status_code=400, detail=f"Cannot cancel emergency in {emergency.status.value} status")

    client_ip = request.client.host if request.client else None
    updated = await EmergencyService.update_status(
        db=db,
        emergency_id=emergency_id,
        new_status=EmergencyStatus.CANCELLED,
        changed_by_user_id=current_user.id,
        notes="Emergency cancelled by user/dispatcher.",
        client_ip=client_ip,
    )
    return updated

@router.post("/{emergency_id}/status", response_model=EmergencyResponse)
async def update_emergency_status(
    emergency_id: int,
    payload: EmergencyStatusUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Driver, Dispatcher, or Admin updates the emergency status."""
    emergency = await EmergencyService.get_emergency_by_id(db, emergency_id)
    if not emergency:
        raise HTTPException(status_code=404, detail="Emergency not found")

    client_ip = request.client.host if request.client else None
    updated = await EmergencyService.update_status(
        db=db,
        emergency_id=emergency_id,
        new_status=payload.status,
        changed_by_user_id=current_user.id,
        notes=payload.notes,
        client_ip=client_ip,
    )
    return updated

@router.post("/{emergency_id}/priority", response_model=EmergencyResponse)
async def update_emergency_priority(
    emergency_id: int,
    payload: PriorityUpdate,
    request: Request,
    current_user: User = Depends(require_roles(UserRole.DISPATCHER, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """Dispatcher or Admin escalates/updates the priority."""
    emergency = await EmergencyService.get_emergency_by_id(db, emergency_id)
    if not emergency:
        raise HTTPException(status_code=404, detail="Emergency not found")

    old_priority = emergency.priority.value
    emergency.priority = payload.priority
    await db.commit()

    client_ip = request.client.host if request.client else None
    await AuditService.log_action(
        db=db,
        action="PRIORITY_ESCALATED",
        entity_type="EmergencyRequest",
        entity_id=emergency.id,
        user_id=current_user.id,
        previous_value=old_priority,
        new_value=f"{payload.priority.value} (Reason: {payload.reason or 'Dispatcher assessment'})",
        ip_address=client_ip,
    )
    return emergency

@router.post("/{emergency_id}/hospital", response_model=EmergencyResponse)
async def select_hospital_destination(
    emergency_id: int,
    payload: HospitalSelectRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """User selects hospital from recommendations, or Dispatcher overrides destination."""
    emergency = await EmergencyService.get_emergency_by_id(db, emergency_id)
    if not emergency:
        raise HTTPException(status_code=404, detail="Emergency not found")

    is_dispatcher = current_user.role in [UserRole.DISPATCHER, UserRole.ADMIN]
    if current_user.role == UserRole.USER and emergency.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to select hospital for this emergency")

    # Driver is NOT allowed to select/change hospital directly (must use change request)
    if current_user.role == UserRole.AMBULANCE_DRIVER:
        raise HTTPException(status_code=403, detail="Ambulance drivers cannot freely set hospital destination. Please submit a hospital change request.")

    client_ip = request.client.host if request.client else None
    updated = await EmergencyService.select_hospital(
        db=db,
        emergency_id=emergency_id,
        hospital_id=payload.hospital_id,
        selected_by_user_id=current_user.id,
        is_dispatcher_override=is_dispatcher,
        override_reason=payload.override_reason,
        client_ip=client_ip,
    )
    return updated

@router.post("/{emergency_id}/location")
async def update_emergency_location(
    emergency_id: int,
    payload: LocationUpdatePayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Driver or system updates vehicle location during emergency."""
    emergency = await EmergencyService.get_emergency_by_id(db, emergency_id)
    if not emergency:
        raise HTTPException(status_code=404, detail="Emergency not found")

    if emergency.assigned_ambulance:
        emergency.assigned_ambulance.current_lat = payload.latitude
        emergency.assigned_ambulance.current_lng = payload.longitude
        if payload.heading is not None:
            emergency.assigned_ambulance.heading = payload.heading
        await db.commit()

    event_data = {
        "emergency_id": emergency_id,
        "ambulance_id": emergency.assigned_ambulance_id,
        "latitude": payload.latitude,
        "longitude": payload.longitude,
        "heading": payload.heading or 0.0,
        "speed": payload.speed or 48.0,
    }
    await manager.broadcast_emergency_location(
        emergency_id=emergency_id,
        user_id=emergency.user_id,
        hospital_id=emergency.selected_hospital_id,
        data=event_data,
    )
    return {"status": "updated", "data": event_data}

@router.post("/{emergency_id}/hospital-change")
async def request_hospital_change(
    emergency_id: int,
    payload: HospitalChangePayload,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Driver or attendant requests destination hospital diversion."""
    emergency = await EmergencyService.get_emergency_by_id(db, emergency_id)
    if not emergency:
        raise HTTPException(status_code=404, detail="Emergency not found")

    curr_hosp_id = emergency.selected_hospital_id or payload.target_hospital_id

    change_req = HospitalChangeRequest(
        emergency_id=emergency_id,
        driver_id=current_user.id,
        current_hospital_id=curr_hosp_id,
        new_hospital_id=payload.target_hospital_id,
        reason=payload.reason or "Patient condition requires facility reassignment",
        status=ChangeRequestStatus.PENDING,
    )
    db.add(change_req)
    await db.commit()
    await db.refresh(change_req)

    await manager.send_to_dispatchers("HOSPITAL_CHANGE_REQUESTED", {
        "request_id": change_req.id,
        "emergency_id": emergency_id,
        "target_hospital_id": payload.target_hospital_id,
        "reason": change_req.reason,
        "requested_by": current_user.full_name,
    })

    return {
        "status": "pending_approval",
        "request_id": change_req.id,
        "message": "Hospital change request submitted for dispatcher approval.",
    }

@router.post("/hospital-change/{request_id}/review")
async def review_hospital_change(
    request_id: int,
    payload: HospitalChangeReviewPayload,
    request: Request,
    current_user: User = Depends(require_roles(UserRole.DISPATCHER, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """Dispatcher reviews and approves or rejects hospital diversion."""
    stmt = select(HospitalChangeRequest).where(HospitalChangeRequest.id == request_id)
    change_req = (await db.execute(stmt)).scalar_one_or_none()
    if not change_req:
        raise HTTPException(status_code=404, detail="Hospital change request not found")

    is_approved = payload.action.upper() in ["APPROVED", "APPROVE", "ACCEPT"]
    change_req.status = ChangeRequestStatus.APPROVED if is_approved else ChangeRequestStatus.REJECTED
    change_req.resolved_at = datetime.now(timezone.utc)
    change_req.notes = payload.dispatcher_comments

    if is_approved and change_req.new_hospital_id:
        emergency = await EmergencyService.get_emergency_by_id(db, change_req.emergency_id)
        if emergency:
            client_ip = request.client.host if request.client else None
            await EmergencyService.select_hospital(
                db=db,
                emergency_id=emergency.id,
                hospital_id=change_req.new_hospital_id,
                selected_by_user_id=current_user.id,
                is_dispatcher_override=True,
                override_reason=f"Approved diversion: {payload.dispatcher_comments or 'Dispatcher approved'}",
                client_ip=client_ip,
            )

    await db.commit()
    return {"status": "success", "action": change_req.status.value}

