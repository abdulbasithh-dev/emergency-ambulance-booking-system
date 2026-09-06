from typing import List, Dict, Any
from pydantic import BaseModel

class KeyMetric(BaseModel):
    label: str
    value: Any
    subtext: str
    trend: str # e.g. "+12% vs last week", "Normal", "98.2%"
    color: str # emerald, blue, amber, red

class EmergencyTypeBreakdown(BaseModel):
    type: str
    count: int
    percentage: float

class DailyTrendItem(BaseModel):
    date: str
    emergencies: int
    completed: int

class FleetStatusSummary(BaseModel):
    available: int
    on_trip: int
    emergency: int
    offline: int
    maintenance: int
    total: int

class HospitalCapacitySummary(BaseModel):
    hospital_name: str
    icu_available: int
    icu_total: int
    general_available: int
    general_total: int
    status: str

class AnalyticsOverview(BaseModel):
    total_users: int
    total_drivers: int
    total_ambulances: int
    total_hospitals: int
    active_emergencies: int
    completed_trips: int
    cancelled_trips: int
    avg_response_time_minutes: float
    avg_ambulance_arrival_minutes: float
    hospital_acceptance_rate_percent: float
    
    fleet_status: FleetStatusSummary
    emergency_types: List[EmergencyTypeBreakdown]
    daily_trends: List[DailyTrendItem]
    hospital_summaries: List[HospitalCapacitySummary]
