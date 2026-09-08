from typing import Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr
from app.models.enums import UserRole

class UserBase(BaseModel):
    email: Optional[str] = None
    full_name: str
    phone_number: str
    role: UserRole = UserRole.USER
    emergency_contact: Optional[str] = None
    driver_id: Optional[str] = None
    duty_status: Optional[str] = "OFF_DUTY"

class UserRegister(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class CitizenRegisterRequest(BaseModel):
    full_name: str
    mobile_number: str
    password: str
    confirm_password: str

class CitizenLoginRequest(BaseModel):
    mobile_number: str
    password: str

class DriverLoginRequest(BaseModel):
    identifier: str
    password: str

class DutyStatusUpdateRequest(BaseModel):
    duty_status: str

class DemoLoginRequest(BaseModel):
    role: Optional[str] = "CITIZEN"

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: "UserResponse"

class TokenPayload(BaseModel):
    sub: Optional[str] = None
    exp: Optional[int] = None
    type: Optional[str] = None

class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    ambulance_id: Optional[int] = None
    hospital_id: Optional[int] = None

    class Config:
        from_attributes = True

Token.model_rebuild()
