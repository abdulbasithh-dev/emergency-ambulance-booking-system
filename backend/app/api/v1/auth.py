import re
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token, create_refresh_token
from app.models.user import User
from app.models.ambulance import Ambulance
from app.models.hospital import Hospital
from app.models.emergency import EmergencyRequest
from app.models.enums import UserRole, AmbulanceStatus, EmergencyStatus
from typing import Optional
from app.schemas.auth import (
    UserRegister,
    UserLogin,
    Token,
    UserResponse,
    DemoLoginRequest,
    CitizenRegisterRequest,
    CitizenLoginRequest,
    DriverLoginRequest,
    DutyStatusUpdateRequest,
)
from app.api.deps import get_current_user
from app.services.audit_service import AuditService
from app.websocket.connection_manager import manager

router = APIRouter(prefix="/auth", tags=["Authentication"])

def normalize_mobile(phone: str) -> str:
    cleaned = re.sub(r'[\s\-\+\(\)]', '', phone)
    if cleaned.startswith('91') and len(cleaned) == 12:
        cleaned = cleaned[2:]
    elif cleaned.startswith('0') and len(cleaned) == 11:
        cleaned = cleaned[1:]
    return cleaned

def validate_indian_mobile(phone: str) -> str:
    cleaned = normalize_mobile(phone)
    if not re.match(r'^[6-9]\d{9}$', cleaned):
        raise HTTPException(
            status_code=400,
            detail="Invalid mobile number. Please enter a valid 10-digit Indian mobile number."
        )
    return cleaned

def format_user_response(user: User) -> UserResponse:
    amb_id = None
    if "ambulance" in user.__dict__ and user.ambulance is not None:
        amb_id = user.ambulance.id
    hosp_id = None
    if "hospital" in user.__dict__ and user.hospital is not None:
        hosp_id = user.hospital.id
    # Normalize USER to CITIZEN for frontend UI compatibility
    normalized_role = UserRole.CITIZEN if user.role == UserRole.USER else user.role
    return UserResponse(
        id=user.id,
        email=user.email or f"{user.phone_number}@resq.local",
        full_name=user.full_name,
        phone_number=user.phone_number,
        role=normalized_role,
        driver_id=getattr(user, "driver_id", None),
        duty_status=getattr(user, "duty_status", "OFF_DUTY") or "OFF_DUTY",
        emergency_contact=user.emergency_contact,
        is_active=user.is_active,
        created_at=user.created_at,
        ambulance_id=amb_id,
        hospital_id=hosp_id,
    )

@router.post("/citizen/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def citizen_register(payload: CitizenRegisterRequest, request: Request, db: AsyncSession = Depends(get_db)):
    if payload.password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match.")
    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long.")
    
    clean_phone = validate_indian_mobile(payload.mobile_number)
    
    stmt = select(User).where((User.phone_number == clean_phone) | (User.phone_number.like(f"%{clean_phone}")))
    existing = (await db.execute(stmt)).scalars().first()
    if existing:
        raise HTTPException(status_code=400, detail="A user with this mobile number already exists. Please log in.")
    
    new_user = User(
        email=f"{clean_phone}@resq.citizen",
        hashed_password=get_password_hash(payload.password),
        full_name=payload.full_name.strip(),
        phone_number=clean_phone,
        role=UserRole.CITIZEN,
        duty_status="OFF_DUTY",
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    
    access_token = create_access_token(new_user.id)
    refresh_token = create_refresh_token(new_user.id)
    
    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        user=format_user_response(new_user),
    )

@router.post("/citizen/login", response_model=Token)
async def citizen_login(payload: CitizenLoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    clean_phone = normalize_mobile(payload.mobile_number)
    if not clean_phone:
        raise HTTPException(status_code=400, detail="Please enter a valid mobile number.")
    
    stmt = (
        select(User)
        .where(
            (User.phone_number == clean_phone) | (User.phone_number.like(f"%{clean_phone}")),
            User.role.in_([UserRole.CITIZEN, UserRole.USER])
        )
        .options(selectinload(User.ambulance), selectinload(User.hospital))
    )
    user = (await db.execute(stmt)).scalars().first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect mobile number or password",
        )
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user account")
    
    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)
    
    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        user=format_user_response(user),
    )

@router.post("/driver/login", response_model=Token)
async def driver_login(payload: DriverLoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    ident = payload.identifier.strip()
    clean_phone = normalize_mobile(ident)
    
    stmt = (
        select(User)
        .where(
            User.role == UserRole.AMBULANCE_DRIVER,
            (User.driver_id.ilike(ident)) |
            (User.phone_number == clean_phone) |
            (User.phone_number.like(f"%{clean_phone}")) |
            (User.email == ident)
        )
        .options(selectinload(User.ambulance), selectinload(User.hospital))
    )
    user = (await db.execute(stmt)).scalars().first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect Driver ID / Mobile number or password",
        )
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive driver account")
    
    # Requirement 4: Default after first setup/login: OFF DUTY
    user.duty_status = "OFF_DUTY"
    amb_stmt = select(Ambulance).where(Ambulance.driver_id == user.id)
    amb = (await db.execute(amb_stmt)).scalars().first()
    if amb:
        amb.availability_status = AmbulanceStatus.OFF_DUTY
    await db.commit()
    await db.refresh(user)

    user_resp = format_user_response(user)
    if amb and user_resp.ambulance_id is None:
        user_resp.ambulance_id = amb.id

    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)
    
    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        user=user_resp,
    )

@router.post("/driver/duty-status", response_model=UserResponse)
async def update_driver_duty_status(
    payload: DutyStatusUpdateRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role != UserRole.AMBULANCE_DRIVER:
        raise HTTPException(status_code=403, detail="Only ambulance drivers can update duty status")
    
    new_duty = payload.duty_status.upper()
    if new_duty not in ["ON_DUTY", "OFF_DUTY"]:
        raise HTTPException(status_code=400, detail="Invalid duty status. Must be ON_DUTY or OFF_DUTY")
    
    amb_stmt = select(Ambulance).where(Ambulance.driver_id == current_user.id)
    amb = (await db.execute(amb_stmt)).scalars().first()
    
    if new_duty == "OFF_DUTY" and amb:
        stmt_emg = select(EmergencyRequest).where(
            EmergencyRequest.assigned_ambulance_id == amb.id,
            EmergencyRequest.status.notin_([EmergencyStatus.CASE_COMPLETED, EmergencyStatus.CANCELLED]),
        )
        active_emg = (await db.execute(stmt_emg)).scalar_one_or_none()
        if active_emg:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot go off duty while active emergency #{active_emg.id} is in progress. Complete patient handover first."
            )
    
    current_user.duty_status = new_duty
    
    if amb:
        if new_duty == "ON_DUTY":
            amb.availability_status = AmbulanceStatus.AVAILABLE
        else:
            amb.availability_status = AmbulanceStatus.OFF_DUTY
    
    await db.commit()
    await db.refresh(current_user)
    
    if amb:
        await manager.send_to_dispatchers("FLEET_STATUS_UPDATED", {
            "ambulance_id": amb.id,
            "vehicle_number": amb.vehicle_number,
            "availability_status": amb.availability_status.value,
            "duty_status": new_duty,
        })
    
    user_resp = format_user_response(current_user)
    if amb and user_resp.ambulance_id is None:
        user_resp.ambulance_id = amb.id
    return user_resp

@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register_user(user_in: UserRegister, request: Request, db: AsyncSession = Depends(get_db)):
    stmt = select(User).where(User.email == user_in.email)
    existing = (await db.execute(stmt)).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="A user with this email already exists.")

    new_user = User(
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        full_name=user_in.full_name,
        phone_number=user_in.phone_number,
        role=user_in.role,
        emergency_contact=user_in.emergency_contact,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    await AuditService.log_action(
        db=db,
        action="USER_CREATED",
        entity_type="User",
        entity_id=new_user.id,
        user_id=new_user.id,
        user_name=new_user.full_name,
        new_value=f"Role: {new_user.role.value}",
        ip_address=request.client.host if request.client else None,
    )

    access_token = create_access_token(new_user.id)
    refresh_token = create_refresh_token(new_user.id)

    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        user=format_user_response(new_user),
    )

@router.post("/login", response_model=Token)
async def login(credentials: UserLogin, request: Request, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(User)
        .where(User.email == credentials.email)
        .options(selectinload(User.ambulance), selectinload(User.hospital))
    )
    user = (await db.execute(stmt)).scalar_one_or_none()
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user account")

    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)

    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        user=format_user_response(user),
    )

@router.post("/demo-login", response_model=Token)
@router.post("/demo-login/{role}", response_model=Token)
async def demo_login(
    request: Request,
    role: Optional[str] = None,
    payload: Optional[DemoLoginRequest] = None,
    db: AsyncSession = Depends(get_db),
):
    """Convenience endpoint to switch/login directly into any of the 5 roles with pre-seeded accounts."""
    target_role = (payload.role if payload and payload.role else role) or "CITIZEN"
    target_role_upper = target_role.upper()

    if target_role_upper in ["CITIZEN", "USER", "PATIENT"]:
        stmt = (
            select(User)
            .where(User.role.in_([UserRole.USER, UserRole.CITIZEN]))
            .options(selectinload(User.ambulance), selectinload(User.hospital))
        )
    elif target_role_upper in ["DRIVER", "AMBULANCE_DRIVER"]:
        stmt = (
            select(User)
            .where(User.role == UserRole.AMBULANCE_DRIVER)
            .options(selectinload(User.ambulance), selectinload(User.hospital))
        )
    elif target_role_upper in ["HOSPITAL", "HOSPITAL_STAFF"]:
        stmt = (
            select(User)
            .where(User.role == UserRole.HOSPITAL_STAFF)
            .options(selectinload(User.ambulance), selectinload(User.hospital))
        )
    elif target_role_upper in ["DISPATCHER"]:
        stmt = (
            select(User)
            .where(User.role == UserRole.DISPATCHER)
            .options(selectinload(User.ambulance), selectinload(User.hospital))
        )
    elif target_role_upper in ["ADMIN"]:
        stmt = (
            select(User)
            .where(User.role == UserRole.ADMIN)
            .options(selectinload(User.ambulance), selectinload(User.hospital))
        )
    else:
        stmt = (
            select(User)
            .where(User.role.in_([UserRole.USER, UserRole.CITIZEN]))
            .options(selectinload(User.ambulance), selectinload(User.hospital))
        )

    user = (await db.execute(stmt)).scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail=f"No pre-configured demo user found for role {target_role}")

    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)

    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        user=format_user_response(user),
    )

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return format_user_response(current_user)
