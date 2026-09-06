from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from app.core.database import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    user_name = Column(String(150), nullable=True)
    
    action = Column(String(100), nullable=False, index=True) 
    # e.g., USER_CREATED, EMERGENCY_CREATED, AMBULANCE_ASSIGNED, DRIVER_ACCEPTED, 
    # DRIVER_REJECTED, HOSPITAL_SELECTED, HOSPITAL_ACCEPTED, HOSPITAL_REJECTED, 
    # STATUS_CHANGED, TRIP_COMPLETED, HOSPITAL_CHANGED
    
    entity_type = Column(String(50), nullable=False) # EmergencyRequest, Ambulance, Hospital, User
    entity_id = Column(Integer, nullable=True)
    
    previous_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    
    ip_address = Column(String(50), nullable=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
