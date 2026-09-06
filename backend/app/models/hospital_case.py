from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum as SAEnum, Text
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.enums import HospitalCaseStatus, ChangeRequestStatus

class HospitalCase(Base):
    __tablename__ = "hospital_cases"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    emergency_id = Column(Integer, ForeignKey("emergency_requests.id"), nullable=False, index=True)
    hospital_id = Column(Integer, ForeignKey("hospitals.id"), nullable=False, index=True)
    
    status = Column(SAEnum(HospitalCaseStatus), default=HospitalCaseStatus.NOTIFIED, nullable=False)
    rejection_reason = Column(String(255), nullable=True)
    
    notified_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    responded_at = Column(DateTime, nullable=True)

    emergency = relationship("EmergencyRequest", back_populates="hospital_cases")
    hospital = relationship("Hospital", back_populates="hospital_cases")

class HospitalChangeRequest(Base):
    __tablename__ = "hospital_change_requests"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    emergency_id = Column(Integer, ForeignKey("emergency_requests.id"), nullable=False, index=True)
    driver_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    current_hospital_id = Column(Integer, ForeignKey("hospitals.id"), nullable=False)
    new_hospital_id = Column(Integer, ForeignKey("hospitals.id"), nullable=True)
    
    reason = Column(String(255), nullable=False)
    notes = Column(Text, nullable=True)
    status = Column(SAEnum(ChangeRequestStatus), default=ChangeRequestStatus.PENDING, nullable=False)
    
    requested_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    resolved_at = Column(DateTime, nullable=True)

    emergency = relationship("EmergencyRequest", back_populates="change_requests")
