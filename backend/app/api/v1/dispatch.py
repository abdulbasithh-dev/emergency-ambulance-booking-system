from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.user import User
from app.models.ambulance import Ambulance
from app.models.hospital import Hospital
from app.models.emergency import EmergencyRequest
from app.models.enums import EmergencyStatus, AmbulanceStatus, UserRole
from app.schemas.emergency import EmergencyResponse, AmbulanceAssignRequest
from app.schemas.ambulance import AmbulanceResponse
from app.schemas.hospital import HospitalResponse
from app.api.deps import require_roles, get_current_user
from app.services.emergency_service import EmergencyService
from app.api.v1.ambulances import format_ambulance
from app.api.v1.hospitals import format_hospital

router = APIRouter(prefix="/dispatch", tags=["Dispatch Command Center"])

class HospitalOverridePayload(BaseModel):
    hospital_id: int
    reason: Optional[str] = "Dispatcher hospital override"

@router.get("/overview")
@router.get("/command-center")
async def get_command_center_overview(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Unified command center telemetry: emergencies, ambulances, hospitals, and pending alerts."""
    # 1. Active emergencies
    emg_stmt = (
        select(EmergencyRequest)
        .where(EmergencyRequest.status.notin_([EmergencyStatus.CASE_COMPLETED, EmergencyStatus.CANCELLED]))
        .options(
            selectinload(EmergencyRequest.assigned_ambulance).selectinload(Ambulance.driver),
            selectinload(EmergencyRequest.selected_hospital),
            selectinload(EmergencyRequest.status_history),
        )
        .order_by(desc(EmergencyRequest.created_at))
    )
    emergencies = (await db.execute(emg_stmt)).scalars().all()

    # 2. Ambulances
    amb_stmt = select(Ambulance).options(selectinload(Ambulance.driver))
    ambulances = (await db.execute(amb_stmt)).scalars().all()

    # 3. Hospitals
    hosp_stmt = select(Hospital).options(selectinload(Hospital.staff_user))
    hospitals = (await db.execute(hosp_stmt)).scalars().all()

    return {
        "active_emergencies": emergencies,
        "ambulances": [format_ambulance(a) for a in ambulances],
        "hospitals": [format_hospital(h) for h in hospitals],
        "summary": {
            "total_active_emergencies": len(emergencies),
            "unassigned_emergencies": len([e for e in emergencies if e.status == EmergencyStatus.SEARCHING_AMBULANCE]),
            "available_ambulances": len([a for a in ambulances if a.availability_status == AmbulanceStatus.AVAILABLE]),
            "busy_ambulances": len([a for a in ambulances if a.availability_status in [AmbulanceStatus.EMERGENCY, AmbulanceStatus.ON_TRIP]]),
        }
    }

@router.post("/emergencies/{emergency_id}/assign", response_model=EmergencyResponse)
@router.post("/assign", response_model=EmergencyResponse)
async def dispatch_assign_or_reassign(
    emergency_id: int,
    payload: AmbulanceAssignRequest,
    request: Request,
    current_user: User = Depends(require_roles(UserRole.DISPATCHER, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """Dispatcher overrides or reassigns an ambulance to an active emergency."""
    client_ip = request.client.host if request.client else None
    emergency = await EmergencyService.assign_ambulance(
        db=db,
        emergency_id=emergency_id,
        ambulance_id=payload.ambulance_id,
        assigned_by_user_id=current_user.id,
        client_ip=client_ip,
    )
    return emergency

@router.post("/emergencies/{emergency_id}/override-hospital", response_model=EmergencyResponse)
@router.post("/override-hospital", response_model=EmergencyResponse)
async def dispatch_override_hospital(
    emergency_id: int,
    request: Request,
    payload: Optional[HospitalOverridePayload] = None,
    hospital_id: Optional[int] = Query(None),
    reason: Optional[str] = Query(None),
    current_user: User = Depends(require_roles(UserRole.DISPATCHER, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """Dispatcher forces destination change for critical clinical routing."""
    target_hosp_id = (payload.hospital_id if payload else hospital_id) or hospital_id
    if not target_hosp_id:
        raise HTTPException(status_code=400, detail="hospital_id is required")
    target_reason = (payload.reason if payload and payload.reason else reason) or "Dispatcher medical diversion"

    client_ip = request.client.host if request.client else None
    emergency = await EmergencyService.select_hospital(
        db=db,
        emergency_id=emergency_id,
        hospital_id=target_hosp_id,
        selected_by_user_id=current_user.id,
        is_dispatcher_override=True,
        override_reason=target_reason,
        client_ip=client_ip,
    )
    return emergency
