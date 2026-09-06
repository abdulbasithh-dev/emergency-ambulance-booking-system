from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.enums import HospitalDeptStatus

class Hospital(Base):
    __tablename__ = "hospitals"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(200), nullable=False, index=True)
    address = Column(String(300), nullable=False)
    phone = Column(String(50), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)

    # Emergency Department Status
    emergency_dept_status = Column(
        SAEnum(HospitalDeptStatus),
        default=HospitalDeptStatus.AVAILABLE,
        nullable=False
    )
    accepting_emergencies = Column(Boolean, default=True, nullable=False)

    # Beds & Resource Availability
    icu_beds_total = Column(Integer, default=20, nullable=False)
    icu_beds_available = Column(Integer, default=5, nullable=False)
    
    general_beds_total = Column(Integer, default=100, nullable=False)
    general_beds_available = Column(Integer, default=25, nullable=False)
    
    ventilators_total = Column(Integer, default=15, nullable=False)
    ventilators_available = Column(Integer, default=4, nullable=False)

    # Specialized Capabilities
    trauma_capable = Column(Boolean, default=True, nullable=False)
    cardiac_capable = Column(Boolean, default=True, nullable=False)
    maternity_capable = Column(Boolean, default=True, nullable=False)
    pediatric_capable = Column(Boolean, default=True, nullable=False)
    
    # Associated staff manager
    staff_user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    staff_user = relationship("User", back_populates="hospital")
    hospital_cases = relationship("HospitalCase", back_populates="hospital")
    selected_emergencies = relationship("EmergencyRequest", back_populates="selected_hospital")
