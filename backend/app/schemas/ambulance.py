from typing import Optional
from datetime import datetime
from pydantic import BaseModel
from app.models.enums import AmbulanceStatus, AmbulanceType

class AmbulanceLocationUpdate(BaseModel):
    latitude: float
    longitude: float
    heading: Optional[float] = 0.0

class DriverStatusUpdate(BaseModel):
    availability_status: AmbulanceStatus

class AmbulanceBase(BaseModel):
    vehicle_number: str
    vehicle_type: AmbulanceType = AmbulanceType.ALS
    current_lat: float
    current_lng: float
    heading: Optional[float] = 0.0
    availability_status: AmbulanceStatus = AmbulanceStatus.AVAILABLE
    status: Optional[str] = None
    capabilities: str = "Oxygen,Defibrillator,ECG,Stretcher"
    model_info: str = "Force Traveller Advanced ALS"

class AmbulanceResponse(AmbulanceBase):
    id: int
    driver_id: Optional[int] = None
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class NearbyAmbulanceMatch(BaseModel):
    ambulance_id: int
    vehicle_number: str
    vehicle_type: AmbulanceType
    driver_id: Optional[int]
    driver_name: Optional[str]
    driver_phone: Optional[str]
    distance_km: float
    eta_minutes: float
    capabilities: str
    equipment_match_score: float # 0 to 100%
    overall_rank_score: float     # Lower rank score = better
