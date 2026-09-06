from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel
from app.models.enums import HospitalDeptStatus, HospitalCaseStatus, ChangeRequestStatus

class HospitalCapacityUpdate(BaseModel):
    emergency_dept_status: Optional[HospitalDeptStatus] = None
    accepting_emergencies: Optional[bool] = None
    icu_beds_available: Optional[int] = None
    general_beds_available: Optional[int] = None
    ventilators_available: Optional[int] = None
    trauma_capable: Optional[bool] = None
    cardiac_capable: Optional[bool] = None
    maternity_capable: Optional[bool] = None
    pediatric_capable: Optional[bool] = None

class HospitalBase(BaseModel):
    name: str
    address: str
    phone: str
    latitude: float
    longitude: float
    emergency_dept_status: HospitalDeptStatus = HospitalDeptStatus.AVAILABLE
    accepting_emergencies: bool = True
    icu_beds_total: int = 20
    icu_beds_available: int = 5
    general_beds_total: int = 100
    general_beds_available: int = 25
    ventilators_total: int = 15
    ventilators_available: int = 4
    trauma_capable: bool = True
    cardiac_capable: bool = True
    maternity_capable: bool = True
    pediatric_capable: bool = True

class HospitalResponse(HospitalBase):
    id: int
    staff_user_id: Optional[int] = None
    staff_name: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class HospitalRecommendation(BaseModel):
    hospital_id: int
    name: str
    address: str
    phone: str
    latitude: float
    longitude: float
    distance_km: float
    eta_minutes: float
    emergency_dept_status: HospitalDeptStatus
    icu_beds_available: int
    general_beds_available: int
    ventilators_available: int
    match_percentage: int
    is_best_match: bool
    capability_badges: List[str]
    match_reasons: List[str]

class HospitalCaseAction(BaseModel):
    action: HospitalCaseStatus # ACCEPTED or REJECTED
    rejection_reason: Optional[str] = None
    notes: Optional[str] = None
    assigned_doctor: Optional[str] = None

class HospitalChangeRequestCreate(BaseModel):
    reason: str
    notes: Optional[str] = None

class HospitalChangeRequestResponse(BaseModel):
    id: int
    emergency_id: int
    driver_id: int
    driver_name: Optional[str]
    current_hospital_id: int
    current_hospital_name: Optional[str]
    new_hospital_id: Optional[int]
    reason: str
    notes: Optional[str]
    status: ChangeRequestStatus
    requested_at: datetime
    resolved_at: Optional[datetime]

    class Config:
        from_attributes = True
