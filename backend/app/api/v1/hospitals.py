from typing import List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.user import User
from app.models.hospital import Hospital
from app.models.hospital_case import HospitalCase, HospitalChangeRequest
from app.models.emergency import EmergencyRequest
from app.models.enums import (
    HospitalDeptStatus,
    HospitalCaseStatus,
    ChangeRequestStatus,
    EmergencyType,
    EmergencyStatus,
    UserRole,
)
from app.schemas.hospital import (
    HospitalResponse,
    HospitalCapacityUpdate,
    HospitalRecommendation,
    HospitalCaseAction,
    HospitalChangeRequestCreate,
    HospitalChangeRequestResponse,
)
from app.api.deps import get_current_user, require_roles
from app.services.hospital_service import HospitalRecommendationService
from app.services.emergency_service import EmergencyService
from app.services.audit_service import AuditService
from app.websocket.connection_manager import manager

router = APIRouter(prefix="/hospitals", tags=["Hospitals"])

def format_hospital(hosp: Hospital) -> HospitalResponse:
    staff_name = hosp.staff_user.full_name if hosp.staff_user else None
    return HospitalResponse(
        id=hosp.id,
        name=hosp.name,
        address=hosp.address,
        phone=hosp.phone,
        latitude=hosp.latitude,
        longitude=hosp.longitude,
        emergency_dept_status=hosp.emergency_dept_status,
        accepting_emergencies=hosp.accepting_emergencies,
        icu_beds_total=hosp.icu_beds_total,
        icu_beds_available=hosp.icu_beds_available,
        general_beds_total=hosp.general_beds_total,
        general_beds_available=hosp.general_beds_available,
        ventilators_total=hosp.ventilators_total,
        ventilators_available=hosp.ventilators_available,
        trauma_capable=hosp.trauma_capable,
        cardiac_capable=hosp.cardiac_capable,
        maternity_capable=hosp.maternity_capable,
        pediatric_capable=hosp.pediatric_capable,
        staff_user_id=hosp.staff_user_id,
        staff_name=staff_name,
        created_at=hosp.created_at,
    )

@router.get("", response_model=List[HospitalResponse])
async def list_hospitals(db: AsyncSession = Depends(get_db)):
    stmt = select(Hospital).options(selectinload(Hospital.staff_user))
    result = await db.execute(stmt)
    hospitals = result.scalars().all()
    return [format_hospital(h) for h in hospitals]

from app.models.ambulance import Ambulance

@router.get("/recommendations", response_model=List[HospitalRecommendation])
@router.get("/recommended", response_model=List[HospitalRecommendation])
async def get_recommended_hospitals(
    lat: Optional[float] = Query(None, description="Patient / Pickup latitude"),
    lng: Optional[float] = Query(None, description="Patient / Pickup longitude"),
    patient_lat: Optional[float] = Query(None),
    patient_lng: Optional[float] = Query(None),
    emergency_type: Optional[str] = Query("Accident"),
    severity: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Calculates capability-matched, capacity-scored hospital recommendations."""
    actual_lat = patient_lat if patient_lat is not None else (lat if lat is not None else 12.9716)
    actual_lng = patient_lng if patient_lng is not None else (lng if lng is not None else 80.2433)

    e_type = EmergencyType.ACCIDENT
    if emergency_type:
        for et in EmergencyType:
            if et.value.lower() in emergency_type.lower() or emergency_type.lower() in et.value.lower():
                e_type = et
                break

    recommendations = await HospitalRecommendationService.get_recommendations(
        db=db,
        pickup_lat=actual_lat,
        pickup_lng=actual_lng,
        emergency_type=e_type,
    )
    return recommendations

@router.get("/{hospital_id}", response_model=HospitalResponse)
async def get_hospital(hospital_id: int, db: AsyncSession = Depends(get_db)):
    """Fetch single hospital profile and live telemetry."""
    stmt = select(Hospital).where(Hospital.id == hospital_id).options(selectinload(Hospital.staff_user))
    hosp = (await db.execute(stmt)).scalar_one_or_none()
    if not hosp:
        raise HTTPException(status_code=404, detail="Hospital not found")
    return format_hospital(hosp)

@router.get("/{hospital_id}/cases")
async def get_hospital_cases(hospital_id: int, db: AsyncSession = Depends(get_db)):
    """Fetch incoming and assigned emergency cases for this hospital."""
    stmt = (
        select(EmergencyRequest)
        .where(EmergencyRequest.selected_hospital_id == hospital_id)
        .options(
            selectinload(EmergencyRequest.assigned_ambulance).selectinload(Ambulance.driver),
            selectinload(EmergencyRequest.status_history),
        )
        .order_by(desc(EmergencyRequest.created_at))
    )
    emergencies = (await db.execute(stmt)).scalars().all()
    return emergencies

@router.patch("/{hospital_id}/capacity", response_model=HospitalResponse)
@router.put("/{hospital_id}/capacity", response_model=HospitalResponse)
async def update_capacity(
    hospital_id: int,
    payload: HospitalCapacityUpdate,
    request: Request,
    current_user: User = Depends(require_roles(UserRole.HOSPITAL_STAFF, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    hosp = await db.get(Hospital, hospital_id)
    if not hosp:
        raise HTTPException(status_code=404, detail="Hospital not found")

    if current_user.role == UserRole.HOSPITAL_STAFF and hosp.staff_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to manage this hospital")

    if payload.emergency_dept_status is not None:
        hosp.emergency_dept_status = payload.emergency_dept_status
    if payload.accepting_emergencies is not None:
        hosp.accepting_emergencies = payload.accepting_emergencies
    if payload.icu_beds_available is not None:
        hosp.icu_beds_available = payload.icu_beds_available
    if payload.general_beds_available is not None:
        hosp.general_beds_available = payload.general_beds_available
    if payload.ventilators_available is not None:
        hosp.ventilators_available = payload.ventilators_available
    if payload.trauma_capable is not None:
        hosp.trauma_capable = payload.trauma_capable
    if payload.cardiac_capable is not None:
        hosp.cardiac_capable = payload.cardiac_capable
    if payload.maternity_capable is not None:
        hosp.maternity_capable = payload.maternity_capable
    if payload.pediatric_capable is not None:
        hosp.pediatric_capable = payload.pediatric_capable

    hosp.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(hosp)

    client_ip = request.client.host if request.client else None
    await AuditService.log_action(
        db=db,
        action="HOSPITAL_CAPACITY_UPDATED",
        entity_type="Hospital",
        entity_id=hosp.id,
        user_id=current_user.id,
        new_value=f"Dept: {hosp.emergency_dept_status.value}, ICU: {hosp.icu_beds_available}, General: {hosp.general_beds_available}",
        ip_address=client_ip,
    )

    # Broadcast to dispatchers
    await manager.send_to_dispatchers("HOSPITAL_CAPACITY_UPDATED", {
        "hospital_id": hosp.id,
        "name": hosp.name,
        "emergency_dept_status": hosp.emergency_dept_status.value,
        "icu_beds_available": hosp.icu_beds_available,
        "general_beds_available": hosp.general_beds_available,
        "ventilators_available": hosp.ventilators_available,
    })

    return format_hospital(hosp)

@router.post("/{hospital_id}/cases/{emergency_id}/action")
@router.post("/{hospital_id}/cases/{emergency_id}/review")
async def handle_hospital_case_action(
    hospital_id: int,
    emergency_id: int,
    payload: HospitalCaseAction,
    request: Request,
    current_user: User = Depends(require_roles(UserRole.HOSPITAL_STAFF, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """Hospital staff accepts or rejects an incoming emergency case."""
    hosp = await db.get(Hospital, hospital_id)
    if not hosp:
        raise HTTPException(status_code=404, detail="Hospital not found")

    emergency = await EmergencyService.get_emergency_by_id(db, emergency_id)
    if not emergency:
        raise HTTPException(status_code=404, detail="Emergency not found")

    case_stmt = select(HospitalCase).where(
        HospitalCase.emergency_id == emergency_id,
        HospitalCase.hospital_id == hospital_id,
    )
    hosp_case = (await db.execute(case_stmt)).scalar_one_or_none()
    if not hosp_case:
        hosp_case = HospitalCase(
            emergency_id=emergency_id,
            hospital_id=hospital_id,
            status=payload.action,
            rejection_reason=payload.rejection_reason,
            responded_at=datetime.now(timezone.utc),
        )
        db.add(hosp_case)
    else:
        hosp_case.status = payload.action
        hosp_case.rejection_reason = payload.rejection_reason
        hosp_case.responded_at = datetime.now(timezone.utc)

    client_ip = request.client.host if request.client else None

    if payload.action == HospitalCaseStatus.ACCEPTED:
        # Decrement beds if available
        if hosp.general_beds_available > 0:
            hosp.general_beds_available -= 1
        await db.commit()

        await AuditService.log_action(
            db=db,
            action="HOSPITAL_ACCEPTED",
            entity_type="HospitalCase",
            entity_id=hosp_case.id,
            user_id=current_user.id,
            new_value=f"Hospital {hosp.name} accepted case for patient {emergency.patient_name}",
            ip_address=client_ip,
        )

        msg = {
            "emergency_id": emergency.id,
            "hospital_id": hosp.id,
            "hospital_name": hosp.name,
            "status": "ACCEPTED",
            "message": f"{hosp.name} has accepted your emergency request! Dispatching closest ambulance...",
        }
        await manager.send_to_user(emergency.user_id, "HOSPITAL_ACCEPTED_CASE", msg)
        await manager.send_to_user(emergency.user_id, "STATUS_CHANGE", {
            "emergency_id": emergency.id,
            "status": "HOSPITAL_ACCEPTED",
            "hospital_name": hosp.name,
        })
        if emergency.assigned_ambulance and emergency.assigned_ambulance.driver_id:
            await manager.send_to_driver(emergency.assigned_ambulance.driver_id, "HOSPITAL_ACCEPTED_CASE", msg)
        await manager.send_to_dispatchers("HOSPITAL_ACCEPTED_CASE", msg)

        # Alert the assigned driver or broadcast dispatch offer
        if emergency.assigned_ambulance:
            dispatch_msg = {
                "id": emergency.id,
                "emergency_id": emergency.id,
                "ambulance_id": emergency.assigned_ambulance.id,
                "vehicle_number": emergency.assigned_ambulance.vehicle_number,
                "patient_name": emergency.patient_name,
                "emergency_type": emergency.emergency_type.value if hasattr(emergency.emergency_type, "value") else str(emergency.emergency_type),
                "priority": emergency.priority.value if hasattr(emergency.priority, "value") else str(emergency.priority),
                "pickup_address": emergency.pickup_address,
                "pickup_lat": emergency.pickup_lat,
                "pickup_lng": emergency.pickup_lng,
                "contact_phone": emergency.contact_number,
                "hospital": {
                    "id": hosp.id,
                    "name": hosp.name,
                    "address": hosp.address,
                },
                "destination_hospital": {
                    "id": hosp.id,
                    "name": hosp.name,
                },
                "status": emergency.status.value,
            }
            if emergency.assigned_ambulance.driver_id:
                await manager.send_to_driver(emergency.assigned_ambulance.driver_id, "DISPATCH_REQUEST", dispatch_msg)
                await manager.send_to_driver(emergency.assigned_ambulance.driver_id, "NEW_DISPATCH_OFFER", dispatch_msg)
            await manager.broadcast_to_drivers("DISPATCH_REQUEST", dispatch_msg)
            await manager.broadcast_to_drivers("NEW_DISPATCH_OFFER", dispatch_msg)

        return {"status": "accepted", "message": f"{hosp.name} confirmed acceptance"}

    else:
        # REJECTED -> Recommend alternative hospitals immediately
        await db.commit()
        await AuditService.log_action(
            db=db,
            action="HOSPITAL_REJECTED",
            entity_type="HospitalCase",
            entity_id=hosp_case.id,
            user_id=current_user.id,
            new_value=f"Hospital {hosp.name} rejected case. Reason: {payload.rejection_reason}",
            ip_address=client_ip,
        )

        # Get alternatives excluding this hospital
        alternatives = await HospitalRecommendationService.get_recommendations(
            db=db,
            pickup_lat=emergency.pickup_lat,
            pickup_lng=emergency.pickup_lng,
            emergency_type=emergency.emergency_type,
            exclude_hospital_ids=[hospital_id],
        )

        msg = {
            "emergency_id": emergency.id,
            "rejected_hospital_id": hospital_id,
            "rejected_hospital_name": hosp.name,
            "reason": payload.rejection_reason or "Emergency Department full or diversion required",
            "alternative_recommendations": [a.model_dump() for a in alternatives[:3]],
        }

        await manager.send_to_user(emergency.user_id, "HOSPITAL_REJECTED_CASE", msg)
        if emergency.assigned_ambulance and emergency.assigned_ambulance.driver_id:
            await manager.send_to_driver(emergency.assigned_ambulance.driver_id, "HOSPITAL_REJECTED_CASE", msg)
        await manager.send_to_dispatchers("HOSPITAL_REJECTED_CASE", msg)

        return {
            "status": "rejected",
            "message": "Hospital case rejected. Alternative hospital recommendations dispatched.",
            "alternatives": alternatives,
        }

class HandoverPayload(BaseModel):
    doctor_name: Optional[str] = "Dr. Ananya Roy (ER Lead)"
    notes: Optional[str] = "Patient transferred to ER trauma care team"

@router.post("/handover/{emergency_id}")
async def confirm_patient_handover(
    emergency_id: int,
    payload: Optional[HandoverPayload] = None,
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Hospital confirms clinical handover of arrived patient, completing emergency."""
    emergency = await EmergencyService.get_emergency_by_id(db, emergency_id)
    if not emergency:
        raise HTTPException(status_code=404, detail="Emergency not found")

    doctor = payload.doctor_name if payload and payload.doctor_name else "ER Lead Physician"
    notes = payload.notes if payload and payload.notes else f"Patient handed over to {doctor}"

    client_ip = request.client.host if request and request.client else None
    updated = await EmergencyService.update_status(
        db=db,
        emergency_id=emergency_id,
        new_status=EmergencyStatus.CASE_COMPLETED,
        changed_by_user_id=current_user.id,
        notes=notes,
        client_ip=client_ip,
    )

    handover_data = {
        "emergency_id": emergency_id,
        "status": "CASE_COMPLETED",
        "doctor_name": doctor,
        "message": f"Clinical handover completed by {doctor}. Patient admitted to ER.",
    }
    await manager.send_to_user(emergency.user_id, "HANDOVER_COMPLETE", handover_data)
    await manager.send_to_user(emergency.user_id, "STATUS_CHANGE", handover_data)
    if emergency.assigned_ambulance and emergency.assigned_ambulance.driver_id:
        await manager.send_to_driver(emergency.assigned_ambulance.driver_id, "HANDOVER_COMPLETE", handover_data)
        await manager.send_to_driver(emergency.assigned_ambulance.driver_id, "STATUS_CHANGE", handover_data)
    await manager.send_to_dispatchers("HANDOVER_COMPLETE", handover_data)
    await manager.send_to_dispatchers("STATUS_CHANGE", handover_data)

    return {"status": "success", "emergency_id": emergency_id, "message": handover_data["message"]}

@router.post("/change-request", response_model=HospitalChangeRequestResponse)
async def request_hospital_change(
    payload: HospitalChangeRequestCreate,
    emergency_id: int = Query(...),
    current_user: User = Depends(require_roles(UserRole.AMBULANCE_DRIVER, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """Driver requests hospital destination change without unrestricted bypass."""
    emergency = await EmergencyService.get_emergency_by_id(db, emergency_id)
    if not emergency or not emergency.selected_hospital_id:
        raise HTTPException(status_code=400, detail="No active hospital destination to change")

    change_req = HospitalChangeRequest(
        emergency_id=emergency_id,
        driver_id=current_user.id,
        current_hospital_id=emergency.selected_hospital_id,
        reason=payload.reason,
        notes=payload.notes,
        status=ChangeRequestStatus.PENDING,
    )
    db.add(change_req)
    await db.commit()
    await db.refresh(change_req)

    # Notify dispatchers
    await manager.send_to_dispatchers("DRIVER_REQUESTED_HOSPITAL_CHANGE", {
        "request_id": change_req.id,
        "emergency_id": emergency_id,
        "driver_id": current_user.id,
        "driver_name": current_user.full_name,
        "current_hospital_name": emergency.selected_hospital.name if emergency.selected_hospital else "Hospital",
        "reason": payload.reason,
        "notes": payload.notes,
    })

    return HospitalChangeRequestResponse(
        id=change_req.id,
        emergency_id=change_req.emergency_id,
        driver_id=change_req.driver_id,
        driver_name=current_user.full_name,
        current_hospital_id=change_req.current_hospital_id,
        current_hospital_name=emergency.selected_hospital.name if emergency.selected_hospital else None,
        new_hospital_id=None,
        reason=change_req.reason,
        notes=change_req.notes,
        status=change_req.status,
        requested_at=change_req.requested_at,
        resolved_at=change_req.resolved_at,
    )

@router.get("/change-requests", response_model=List[HospitalChangeRequestResponse])
async def list_change_requests(
    current_user: User = Depends(require_roles(UserRole.DISPATCHER, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(HospitalChangeRequest)
        .order_by(desc(HospitalChangeRequest.requested_at))
    )
    res = await db.execute(stmt)
    records = res.scalars().all()
    out = []
    for r in records:
        driver = await db.get(User, r.driver_id)
        cur_hosp = await db.get(Hospital, r.current_hospital_id)
        out.append(
            HospitalChangeRequestResponse(
                id=r.id,
                emergency_id=r.emergency_id,
                driver_id=r.driver_id,
                driver_name=driver.full_name if driver else "Driver",
                current_hospital_id=r.current_hospital_id,
                current_hospital_name=cur_hosp.name if cur_hosp else "Hospital",
                new_hospital_id=r.new_hospital_id,
                reason=r.reason,
                notes=r.notes,
                status=r.status,
                requested_at=r.requested_at,
                resolved_at=r.resolved_at,
            )
        )
    return out

@router.post("/change-requests/{request_id}/resolve")
async def resolve_change_request(
    request_id: int,
    approved: bool = Query(...),
    new_hospital_id: Optional[int] = Query(None),
    current_user: User = Depends(require_roles(UserRole.DISPATCHER, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    chg = await db.get(HospitalChangeRequest, request_id)
    if not chg:
        raise HTTPException(status_code=404, detail="Change request not found")

    chg.status = ChangeRequestStatus.APPROVED if approved else ChangeRequestStatus.REJECTED
    chg.resolved_at = datetime.now(timezone.utc)
    if approved and new_hospital_id:
        chg.new_hospital_id = new_hospital_id
        await EmergencyService.select_hospital(
            db=db,
            emergency_id=chg.emergency_id,
            hospital_id=new_hospital_id,
            selected_by_user_id=current_user.id,
            is_dispatcher_override=True,
            override_reason=f"Approved driver change request: {chg.reason}",
        )

    await db.commit()
    return {"status": "success", "approved": approved, "new_hospital_id": new_hospital_id}
