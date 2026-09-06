from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Enum as SAEnum, Text
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.enums import EmergencyPriority, EmergencyStatus, EmergencyType

class EmergencyRequest(Base):
    __tablename__ = "emergency_requests"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    
    patient_name = Column(String(150), nullable=False)
    patient_age = Column(Integer, nullable=True)
    emergency_type = Column(SAEnum(EmergencyType), default=EmergencyType.ACCIDENT, nullable=False, index=True)
    priority = Column(SAEnum(EmergencyPriority), default=EmergencyPriority.HIGH, nullable=False, index=True)
    
    description = Column(Text, nullable=True)
    medical_info = Column(Text, nullable=True)
    contact_number = Column(String(50), nullable=False)
    preferred_hospital = Column(String(200), nullable=True)

    pickup_address = Column(String(300), nullable=False)
    pickup_lat = Column(Float, nullable=False)
    pickup_lng = Column(Float, nullable=False)

    status = Column(
        SAEnum(EmergencyStatus),
        default=EmergencyStatus.SEARCHING_AMBULANCE,
        nullable=False,
        index=True
    )

    assigned_ambulance_id = Column(Integer, ForeignKey("ambulances.id"), nullable=True, index=True)
    selected_hospital_id = Column(Integer, ForeignKey("hospitals.id"), nullable=True, index=True)

    estimated_distance_km = Column(Float, nullable=True)
    estimated_eta_minutes = Column(Float, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user = relationship("User", back_populates="emergencies_requested", foreign_keys=[user_id])
    assigned_ambulance = relationship("Ambulance", back_populates="assigned_emergencies")
    selected_hospital = relationship("Hospital", back_populates="selected_emergencies")
    
    status_history = relationship("EmergencyStatusHistory", back_populates="emergency", cascade="all, delete-orphan", order_by="EmergencyStatusHistory.timestamp.asc()")
    hospital_cases = relationship("HospitalCase", back_populates="emergency", cascade="all, delete-orphan")
    change_requests = relationship("HospitalChangeRequest", back_populates="emergency", cascade="all, delete-orphan")
    trip = relationship("TripHistory", back_populates="emergency", uselist=False)

class EmergencyStatusHistory(Base):
    __tablename__ = "emergency_status_history"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    emergency_id = Column(Integer, ForeignKey("emergency_requests.id"), nullable=False, index=True)
    old_status = Column(String(50), nullable=True)
    new_status = Column(String(50), nullable=False)
    changed_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    notes = Column(String(255), nullable=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    emergency = relationship("EmergencyRequest", back_populates="status_history")
