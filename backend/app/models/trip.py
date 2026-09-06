from datetime import datetime, timezone
from sqlalchemy import Column, Integer, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class TripHistory(Base):
    __tablename__ = "trip_history"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    emergency_id = Column(Integer, ForeignKey("emergency_requests.id"), unique=True, nullable=False)
    ambulance_id = Column(Integer, ForeignKey("ambulances.id"), nullable=False)
    driver_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    start_time = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    pickup_arrival_time = Column(DateTime, nullable=True)
    patient_onboard_time = Column(DateTime, nullable=True)
    hospital_arrival_time = Column(DateTime, nullable=True)
    completed_time = Column(DateTime, nullable=True)
    
    total_distance_km = Column(Float, default=0.0)
    total_duration_minutes = Column(Float, default=0.0)
    response_time_minutes = Column(Float, default=0.0) # From request to pickup arrival

    emergency = relationship("EmergencyRequest", back_populates="trip")
