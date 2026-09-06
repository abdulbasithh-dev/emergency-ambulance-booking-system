from typing import Optional, List, Any
from datetime import datetime
from pydantic import BaseModel, model_validator
from app.models.enums import EmergencyPriority, EmergencyStatus, EmergencyType
from app.schemas.ambulance import AmbulanceResponse
from app.schemas.hospital import HospitalResponse

class EmergencyCreate(BaseModel):
    patient_name: str
    patient_age: Optional[int] = None
    emergency_type: EmergencyType = EmergencyType.ACCIDENT
    priority: Optional[EmergencyPriority] = EmergencyPriority.CRITICAL
    description: Optional[str] = None
    medical_info: Optional[str] = None
    contact_number: Optional[str] = "+91 98401 23456"
    contact_phone: Optional[str] = None
    preferred_hospital: Optional[str] = None
    pickup_address: str
    pickup_lat: float = 13.0827
    pickup_lng: float = 80.2707
    pickup_latitude: Optional[float] = None
    pickup_longitude: Optional[float] = None
    severity_level: Optional[str] = None
    notes: Optional[str] = None
    hospital_id: Optional[int] = None
    selected_hospital_id: Optional[int] = None

    @model_validator(mode="before")
    @classmethod
    def normalize_emergency_fields(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # Hospital ID
            if "selected_hospital_id" not in data or data.get("selected_hospital_id") is None:
                if "hospital_id" in data:
                    data["selected_hospital_id"] = data["hospital_id"]
            if "hospital_id" not in data or data.get("hospital_id") is None:
                if "selected_hospital_id" in data:
                    data["hospital_id"] = data["selected_hospital_id"]

            # Coordinates
            if "pickup_lat" not in data or data.get("pickup_lat") is None:
                if "pickup_latitude" in data:
                    data["pickup_lat"] = data["pickup_latitude"]
            if "pickup_lng" not in data or data.get("pickup_lng") is None:
                if "pickup_longitude" in data:
                    data["pickup_lng"] = data["pickup_longitude"]
            
            # Contact number
            if "contact_number" not in data or not data.get("contact_number"):
                if data.get("contact_phone"):
                    data["contact_number"] = data["contact_phone"]
                else:
                    data["contact_number"] = "+91 98401 23456"

            # Priority / Severity
            if "priority" not in data or data.get("priority") is None:
                sev = str(data.get("severity_level", "")).upper()
                if "CRIT" in sev:
                    data["priority"] = EmergencyPriority.CRITICAL
                elif "SEV" in sev or "HIGH" in sev:
                    data["priority"] = EmergencyPriority.HIGH
                elif "MOD" in sev or "MED" in sev:
                    data["priority"] = EmergencyPriority.MEDIUM
                elif sev:
                    data["priority"] = EmergencyPriority.LOW
                else:
                    data["priority"] = EmergencyPriority.CRITICAL

            # Description / Notes
            if not data.get("description") and data.get("notes"):
                data["description"] = data["notes"]

            # Emergency Type mapping
            etype = str(data.get("emergency_type", ""))
            type_map = {
                "CARDIAC_ARREST": EmergencyType.CARDIAC,
                "Cardiac emergency": EmergencyType.CARDIAC,
                "TRAUMA_ACCIDENT": EmergencyType.ACCIDENT,
                "Accident": EmergencyType.ACCIDENT,
                "RESPIRATORY_DISTRESS": EmergencyType.BREATHING,
                "Breathing problem": EmergencyType.BREATHING,
                "STROKE": EmergencyType.UNCONSCIOUS,
                "Unconscious patient": EmergencyType.UNCONSCIOUS,
                "PREGNANCY_COMPLICATIONS": EmergencyType.PREGNANCY,
                "Pregnancy": EmergencyType.PREGNANCY,
                "BURNS": EmergencyType.FIRE,
                "Fire emergency": EmergencyType.FIRE,
                "GENERAL_MEDICAL": EmergencyType.OTHER,
                "Other": EmergencyType.OTHER,
            }
            if etype in type_map:
                data["emergency_type"] = type_map[etype]
        return data

class StatusHistoryItem(BaseModel):
    id: int
    old_status: Optional[str]
    new_status: str
    changed_by_user_id: Optional[int]
    notes: Optional[str]
    timestamp: datetime

    class Config:
        from_attributes = True

class EmergencyStatusUpdate(BaseModel):
    status: EmergencyStatus
    notes: Optional[str] = None

class PriorityUpdate(BaseModel):
    priority: EmergencyPriority
    reason: Optional[str] = None

class HospitalSelectRequest(BaseModel):
    hospital_id: int
    override_reason: Optional[str] = None

class AmbulanceAssignRequest(BaseModel):
    ambulance_id: int
    notes: Optional[str] = None

class LocationUpdatePayload(BaseModel):
    latitude: float
    longitude: float
    speed: Optional[float] = None
    heading: Optional[float] = None

class HospitalChangePayload(BaseModel):
    target_hospital_id: int
    reason: Optional[str] = None

class HospitalChangeReviewPayload(BaseModel):
    action: str
    dispatcher_comments: Optional[str] = None

class EmergencyResponse(BaseModel):
    id: int
    user_id: int
    patient_name: str
    patient_age: Optional[int]
    emergency_type: EmergencyType
    priority: EmergencyPriority
    description: Optional[str]
    medical_info: Optional[str]
    contact_number: str
    preferred_hospital: Optional[str]
    
    pickup_address: str
    pickup_lat: float
    pickup_lng: float
    
    status: EmergencyStatus
    assigned_ambulance_id: Optional[int]
    selected_hospital_id: Optional[int]
    
    estimated_distance_km: Optional[float]
    estimated_eta_minutes: Optional[float]
    
    created_at: datetime
    updated_at: datetime
    
    assigned_ambulance: Optional[AmbulanceResponse] = None
    selected_hospital: Optional[HospitalResponse] = None
    status_history: List[StatusHistoryItem] = []

    class Config:
        from_attributes = True
