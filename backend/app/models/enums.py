from enum import Enum

class UserRole(str, Enum):
    USER = "USER"
    CITIZEN = "CITIZEN"
    AMBULANCE_DRIVER = "AMBULANCE_DRIVER"
    HOSPITAL_STAFF = "HOSPITAL_STAFF"
    DISPATCHER = "DISPATCHER"
    ADMIN = "ADMIN"

class DutyStatus(str, Enum):
    ON_DUTY = "ON_DUTY"
    OFF_DUTY = "OFF_DUTY"

class AmbulanceStatus(str, Enum):
    AVAILABLE = "AVAILABLE"
    OFFLINE = "OFFLINE"
    OFF_DUTY = "OFF_DUTY"
    ON_TRIP = "ON_TRIP"
    EMERGENCY = "EMERGENCY"
    MAINTENANCE = "MAINTENANCE"

class AmbulanceType(str, Enum):
    ALS = "ALS"                  # Advanced Life Support (ICU on wheels)
    BLS = "BLS"                  # Basic Life Support
    PATIENT_TRANSPORT = "PATIENT_TRANSPORT"

class EmergencyPriority(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"

class EmergencyType(str, Enum):
    ACCIDENT = "Accident"
    CARDIAC = "Cardiac emergency"
    BREATHING = "Breathing problem"
    INJURY = "Injury"
    FIRE = "Fire emergency"
    PREGNANCY = "Pregnancy"
    UNCONSCIOUS = "Unconscious patient"
    OTHER = "Other"

class EmergencyStatus(str, Enum):
    REQUESTED = "REQUESTED"
    SEARCHING_AMBULANCE = "SEARCHING_AMBULANCE"
    AMBULANCE_ASSIGNED = "AMBULANCE_ASSIGNED"
    HOSPITAL_ACCEPTED = "HOSPITAL_ACCEPTED"
    DRIVER_ACCEPTED = "DRIVER_ACCEPTED"
    EN_ROUTE_TO_PICKUP = "EN_ROUTE_TO_PICKUP"
    AMBULANCE_EN_ROUTE = "AMBULANCE_EN_ROUTE"
    ARRIVED_AT_PICKUP = "ARRIVED_AT_PICKUP"
    ARRIVED_AT_SCENE = "ARRIVED_AT_SCENE"
    PATIENT_ONBOARD = "PATIENT_ONBOARD"
    PATIENT_LOADED = "PATIENT_LOADED"
    HOSPITAL_SELECTED = "HOSPITAL_SELECTED"
    EN_ROUTE_TO_HOSPITAL = "EN_ROUTE_TO_HOSPITAL"
    IN_TRANSIT_TO_HOSPITAL = "IN_TRANSIT_TO_HOSPITAL"
    ARRIVED_AT_HOSPITAL = "ARRIVED_AT_HOSPITAL"
    CASE_COMPLETED = "CASE_COMPLETED"
    HANDOVER_COMPLETE = "HANDOVER_COMPLETE"
    CANCELLED = "CANCELLED"

class HospitalDeptStatus(str, Enum):
    AVAILABLE = "AVAILABLE"
    BUSY = "BUSY"
    FULL = "FULL"

class HospitalCaseStatus(str, Enum):
    NOTIFIED = "NOTIFIED"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"

class ChangeRequestStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
