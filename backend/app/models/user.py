from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum as SAEnum
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.enums import UserRole

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    email = Column(String(255), unique=True, index=True, nullable=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(150), nullable=False)
    phone_number = Column(String(50), unique=True, index=True, nullable=False)
    role = Column(SAEnum(UserRole), default=UserRole.USER, nullable=False, index=True)
    driver_id = Column(String(50), nullable=True, index=True)
    duty_status = Column(String(50), default="OFF_DUTY", nullable=False)
    emergency_contact = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    ambulance = relationship("Ambulance", back_populates="driver", uselist=False)
    hospital = relationship("Hospital", back_populates="staff_user", uselist=False)
    emergencies_requested = relationship("EmergencyRequest", back_populates="user", foreign_keys="EmergencyRequest.user_id")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
