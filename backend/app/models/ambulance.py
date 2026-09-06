from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.enums import AmbulanceStatus, AmbulanceType

class Ambulance(Base):
    __tablename__ = "ambulances"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    vehicle_number = Column(String(50), unique=True, index=True, nullable=False)
    vehicle_type = Column(SAEnum(AmbulanceType), default=AmbulanceType.ALS, nullable=False)
    driver_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    current_lat = Column(Float, nullable=False, default=12.9010)
    current_lng = Column(Float, nullable=False, default=80.2279)
    heading = Column(Float, default=0.0) # In degrees 0-360
    
    availability_status = Column(
        SAEnum(AmbulanceStatus),
        default=AmbulanceStatus.AVAILABLE,
        index=True,
        nullable=False
    )
    
    # Comma-separated or description of onboard capabilities
    # E.g.: "Ventilator,Defibrillator,Advanced Monitor,Oxygen,Stretcher,Trauma Kit"
    capabilities = Column(String(500), default="Oxygen,Defibrillator,ECG,Stretcher")
    model_info = Column(String(100), default="Force Traveller Advanced ALS")
    
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    driver = relationship("User", back_populates="ambulance")
    assigned_emergencies = relationship("EmergencyRequest", back_populates="assigned_ambulance")
