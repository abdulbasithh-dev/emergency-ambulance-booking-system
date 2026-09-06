from typing import Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr
from app.models.enums import UserRole

class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    phone_number: str
    role: UserRole = UserRole.USER
    emergency_contact: Optional[str] = None

class UserRegister(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

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
