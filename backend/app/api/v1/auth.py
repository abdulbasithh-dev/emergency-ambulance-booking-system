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
from app.models.enums import UserRole
from typing import Optional
from app.schemas.auth import UserRegister, UserLogin, Token, UserResponse, DemoLoginRequest
from app.api.deps import get_current_user
from app.services.audit_service import AuditService

router = APIRouter(prefix="/auth", tags=["Authentication"])

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
        email=user.email,
        full_name=user.full_name,
        phone_number=user.phone_number,
        role=normalized_role,
        emergency_contact=user.emergency_contact,
        is_active=user.is_active,
        created_at=user.created_at,
        ambulance_id=amb_id,
        hospital_id=hosp_id,
    )

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
