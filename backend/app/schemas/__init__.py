from app.schemas.auth import (
    UserRegister,
    UserLogin,
    Token,
    TokenPayload,
    UserResponse,
)
from app.schemas.ambulance import (
    AmbulanceLocationUpdate,
    DriverStatusUpdate,
    AmbulanceBase,
    AmbulanceResponse,
    NearbyAmbulanceMatch,
)
from app.schemas.hospital import (
    HospitalCapacityUpdate,
    HospitalBase,
    HospitalResponse,
    HospitalRecommendation,
    HospitalCaseAction,
    HospitalChangeRequestCreate,
    HospitalChangeRequestResponse,
)
from app.schemas.emergency import (
    EmergencyCreate,
    EmergencyStatusUpdate,
    PriorityUpdate,
    HospitalSelectRequest,
    AmbulanceAssignRequest,
    EmergencyResponse,
    StatusHistoryItem,
)
from app.schemas.notification import NotificationResponse
from app.schemas.audit import AuditLogResponse
from app.schemas.analytics import (
    KeyMetric,
    EmergencyTypeBreakdown,
    DailyTrendItem,
    FleetStatusSummary,
    HospitalCapacitySummary,
    AnalyticsOverview,
)

__all__ = [
    "UserRegister",
    "UserLogin",
    "Token",
    "TokenPayload",
    "UserResponse",
    "AmbulanceLocationUpdate",
    "DriverStatusUpdate",
    "AmbulanceBase",
    "AmbulanceResponse",
    "NearbyAmbulanceMatch",
    "HospitalCapacityUpdate",
    "HospitalBase",
    "HospitalResponse",
    "HospitalRecommendation",
    "HospitalCaseAction",
    "HospitalChangeRequestCreate",
    "HospitalChangeRequestResponse",
    "EmergencyCreate",
    "EmergencyStatusUpdate",
    "PriorityUpdate",
    "HospitalSelectRequest",
    "AmbulanceAssignRequest",
    "EmergencyResponse",
    "StatusHistoryItem",
    "NotificationResponse",
    "AuditLogResponse",
    "KeyMetric",
    "EmergencyTypeBreakdown",
    "DailyTrendItem",
    "FleetStatusSummary",
    "HospitalCapacitySummary",
    "AnalyticsOverview",
]
