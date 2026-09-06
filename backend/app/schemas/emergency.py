from typing import Optional, List, Any
from datetime import datetime
from pydantic import BaseModel, model_validator
from app.models.enums import EmergencyPriority, EmergencyStatus, EmergencyType
from app.schemas.ambulance import AmbulanceResponse
from app.schemas.hospital import HospitalResponse

class EmergencyCreate(BaseModel):
    patient_name: Optional[str] = "Emergency Patient"
    patient_age: Optional[int] = 45
    emergency_type: EmergencyType = EmergencyType.ACCIDENT
    priority: Optional[EmergencyPriority] = EmergencyPriority.CRITICAL
    description: Optional[str] = None
    medical_info: Optional[str] = None
    contact_number: Optional[str] = "+91 98401 23456"
    contact_phone: Optional[str] = None
    preferred_hospital: Optional[str] = None
    pickup_address: Optional[str] = "41, Potheri, SRM University Campus, Chennai"
    pickup_lat: float = 12.8235
    pickup_lng: float = 80.0445
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
            # Patient Name default
            if not data.get("patient_name"):
                data["patient_name"] = "Emergency Patient"

            # Pickup Address default
            if not data.get("pickup_address"):
                data["pickup_address"] = "41, Potheri, SRM University Campus, Chennai"

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

            # Emergency Type mapping & flexible normalization
            raw_etype = str(data.get("emergency_type", ""))
            etype_lower = raw_etype.lower()
            if "cardiac" in etype_lower or "heart" in etype_lower or "chest" in etype_lower:
                data["emergency_type"] = EmergencyType.CARDIAC
            elif "accident" in etype_lower or "trauma" in etype_lower or "road" in etype_lower:
                data["emergency_type"] = EmergencyType.ACCIDENT
            elif "breath" in etype_lower or "respirat" in etype_lower or "asthma" in etype_lower:
                data["emergency_type"] = EmergencyType.BREATHING
            elif "stroke" in etype_lower or "paralysis" in etype_lower or "unconscious" in etype_lower:
                data["emergency_type"] = EmergencyType.UNCONSCIOUS
            elif "pregnan" in etype_lower:
                data["emergency_type"] = EmergencyType.PREGNANCY
            elif "burn" in etype_lower or "fire" in etype_lower:
                data["emergency_type"] = EmergencyType.FIRE
            elif "injury" in etype_lower:
                data["emergency_type"] = EmergencyType.INJURY
            elif raw_etype in [e.value for e in EmergencyType]:
                data["emergency_type"] = EmergencyType(raw_etype)
            else:
                data["emergency_type"] = EmergencyType.OTHER
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
