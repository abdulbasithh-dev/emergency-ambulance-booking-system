import asyncio
import logging
from datetime import datetime, timezone, timedelta

from app.core.database import engine, Base, AsyncSessionLocal
from app.core.security import get_password_hash
from app.models.user import User
from app.models.ambulance import Ambulance
from app.models.hospital import Hospital
from app.models.emergency import EmergencyRequest, EmergencyStatusHistory
from app.models.trip import TripHistory
from app.models.hospital_case import HospitalCase
from app.models.notification import Notification
from app.models.audit import AuditLog
from app.models.enums import (
    UserRole,
    AmbulanceStatus,
    AmbulanceType,
    HospitalDeptStatus,
    EmergencyPriority,
    EmergencyType,
    EmergencyStatus,
    HospitalCaseStatus,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("resq.seed")

DEMO_PASSWORD = "Password123!"

async def seed(custom_engine=None, custom_session_maker=None):
    eng = custom_engine or engine
    session_cls = custom_session_maker or AsyncSessionLocal

    logger.info("Initializing database schema...")
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with session_cls() as db:
        # Check if users already seeded
        from sqlalchemy import select
        existing_user = (await db.execute(select(User))).scalars().first()
        if existing_user:
            logger.info("Database already seeded. Skipping initial population.")
            return

        logger.info("Seeding demo users...")
        hashed_pwd = get_password_hash(DEMO_PASSWORD)

        user_citizen = User(
            email="user@resq.com",
            hashed_password=hashed_pwd,
            full_name="Sarah Jenkins",
            phone_number="+91 98400 11111",
            role=UserRole.USER,
            emergency_contact="+91 98400 99999 (Brother)",
        )

        user_driver = User(
            email="driver@resq.com",
            hashed_password=hashed_pwd,
            full_name="Rajesh Kumar",
            phone_number="+91 98400 22222",
            role=UserRole.AMBULANCE_DRIVER,
            emergency_contact="+91 98400 88888",
        )

        user_hospital = User(
            email="hospital@resq.com",
            hashed_password=hashed_pwd,
            full_name="Dr. Arvind Swaminathan",
            phone_number="+91 98400 33333",
            role=UserRole.HOSPITAL_STAFF,
            emergency_contact="+91 98400 77777",
        )

        user_dispatcher = User(
            email="dispatcher@resq.com",
            hashed_password=hashed_pwd,
            full_name="Command Dispatcher Alpha",
            phone_number="+91 98400 44444",
            role=UserRole.DISPATCHER,
            emergency_contact="+91 98400 66666",
        )

        user_admin = User(
            email="admin@resq.com",
            hashed_password=hashed_pwd,
            full_name="Chief Medical Admin",
            phone_number="+91 98400 55555",
            role=UserRole.ADMIN,
            emergency_contact="+91 98400 00000",
        )

        db.add_all([user_citizen, user_driver, user_hospital, user_dispatcher, user_admin])
        await db.commit()
        await db.refresh(user_driver)
        await db.refresh(user_hospital)
        await db.refresh(user_citizen)

        logger.info("Seeding Hospitals...")
        hospitals = [
            Hospital(
                name="Apollo Speciality Hospital OMR",
                address="5/639, Rajiv Gandhi Salai (OMR), Perungudi, Chennai",
                phone="+91 44 2496 1111",
                latitude=12.9660,
                longitude=80.2450,
                emergency_dept_status=HospitalDeptStatus.AVAILABLE,
                accepting_emergencies=True,
                icu_beds_total=25,
                icu_beds_available=7,
                general_beds_total=120,
                general_beds_available=34,
                ventilators_total=18,
                ventilators_available=6,
                trauma_capable=True,
                cardiac_capable=True,
                maternity_capable=True,
                pediatric_capable=True,
                staff_user_id=user_hospital.id,
            ),
            Hospital(
                name="Gleneagles Global Health City",
                address="439, Cheran Nagar, Perumbakkam, Chennai",
                phone="+91 44 4477 7000",
                latitude=12.9055,
                longitude=80.1980,
                emergency_dept_status=HospitalDeptStatus.AVAILABLE,
                accepting_emergencies=True,
                icu_beds_total=30,
                icu_beds_available=9,
                general_beds_total=150,
                general_beds_available=42,
                ventilators_total=20,
                ventilators_available=8,
                trauma_capable=True,
                cardiac_capable=True,
                maternity_capable=False,
                pediatric_capable=True,
            ),
            Hospital(
                name="Chettinad Super Speciality Hospital",
                address="Rajiv Gandhi Salai, Kelambakkam, Chennai",
                phone="+91 44 4741 1000",
                latitude=12.8250,
                longitude=80.2180,
                emergency_dept_status=HospitalDeptStatus.BUSY,
                accepting_emergencies=True,
                icu_beds_total=20,
                icu_beds_available=3,
                general_beds_total=100,
                general_beds_available=15,
                ventilators_total=12,
                ventilators_available=2,
                trauma_capable=True,
                cardiac_capable=True,
                maternity_capable=True,
                pediatric_capable=True,
            ),
            Hospital(
                name="Fortis Malar Hospital",
                address="52, 1st Main Rd, Gandhi Nagar, Adyar, Chennai",
                phone="+91 44 4289 2222",
                latitude=13.0060,
                longitude=80.2580,
                emergency_dept_status=HospitalDeptStatus.AVAILABLE,
                accepting_emergencies=True,
                icu_beds_total=15,
                icu_beds_available=4,
                general_beds_total=80,
                general_beds_available=18,
                ventilators_total=10,
                ventilators_available=3,
                trauma_capable=True,
                cardiac_capable=True,
                maternity_capable=True,
                pediatric_capable=False,
            ),
        ]
        db.add_all(hospitals)
        await db.commit()

        logger.info("Seeding Ambulances...")
        ambulances = [
            Ambulance(
                vehicle_number="TN-09-EM-1001",
                vehicle_type=AmbulanceType.ALS,
                driver_id=user_driver.id,
                current_lat=12.9080,
                current_lng=80.2220,
                heading=45.0,
                availability_status=AmbulanceStatus.AVAILABLE,
                capabilities="Ventilator,Defibrillator,ECG,Oxygen,Advanced Trauma Kit,Suction",
                model_info="Force Traveller Advanced ALS ICU",
            ),
            Ambulance(
                vehicle_number="TN-09-EM-1002",
                vehicle_type=AmbulanceType.ALS,
                current_lat=12.9240,
                current_lng=80.2310,
                heading=180.0,
                availability_status=AmbulanceStatus.AVAILABLE,
                capabilities="Defibrillator,Oxygen,Stretcher,Trauma Kit,Multipara Monitor",
                model_info="Tata Winger Critical Care",
            ),
            Ambulance(
                vehicle_number="TN-09-EM-1003",
                vehicle_type=AmbulanceType.BLS,
                current_lat=12.8910,
                current_lng=80.2190,
                heading=90.0,
                availability_status=AmbulanceStatus.AVAILABLE,
                capabilities="Oxygen,Stretcher,First Aid,Spine Board",
                model_info="Mahindra Bolero Maxi Ambulance",
            ),
            Ambulance(
                vehicle_number="TN-09-EM-1004",
                vehicle_type=AmbulanceType.ALS,
                current_lat=12.9420,
                current_lng=80.2450,
                heading=270.0,
                availability_status=AmbulanceStatus.AVAILABLE,
                capabilities="Ventilator,Defibrillator,Neonatal Stretcher,Oxygen,Infusion Pump",
                model_info="Force Traveller Pediatric ALS",
            ),
            Ambulance(
                vehicle_number="TN-09-EM-1005",
                vehicle_type=AmbulanceType.PATIENT_TRANSPORT,
                current_lat=12.8800,
                current_lng=80.2290,
                heading=0.0,
                availability_status=AmbulanceStatus.AVAILABLE,
                capabilities="Oxygen,Wheelchair,Stretcher,First Aid Kit",
                model_info="Maruti Suzuki Eeco Ambulance",
            ),
        ]
        db.add_all(ambulances)
        await db.commit()

        logger.info("Seeding Completed Trips & History...")
        now = datetime.now(timezone.utc)
        # Seed 1 historical completed emergency
        hist_emg = EmergencyRequest(
            user_id=user_citizen.id,
            patient_name="Priya Raman",
            patient_age=28,
            emergency_type=EmergencyType.CARDIAC,
            priority=EmergencyPriority.CRITICAL,
            description="Sudden severe chest pain and breathlessness",
            contact_number="+91 98401 98765",
            pickup_address="Sholinganallur Junction, Chennai",
            pickup_lat=12.9010,
            pickup_lng=80.2279,
            status=EmergencyStatus.CASE_COMPLETED,
            assigned_ambulance_id=ambulances[0].id,
            selected_hospital_id=hospitals[0].id,
            estimated_distance_km=4.8,
            estimated_eta_minutes=9.5,
            created_at=now - timedelta(hours=3),
            updated_at=now - timedelta(hours=2),
        )
        db.add(hist_emg)
        await db.commit()
        await db.refresh(hist_emg)

        trip = TripHistory(
            emergency_id=hist_emg.id,
            ambulance_id=ambulances[0].id,
            driver_id=user_driver.id,
            start_time=now - timedelta(hours=3),
            pickup_arrival_time=now - timedelta(hours=2, minutes=52),
            patient_onboard_time=now - timedelta(hours=2, minutes=47),
            hospital_arrival_time=now - timedelta(hours=2, minutes=32),
            completed_time=now - timedelta(hours=2, minutes=10),
            total_distance_km=8.4,
            total_duration_minutes=22.0,
            response_time_minutes=8.0,
        )
        db.add(trip)

        audit_entry = AuditLog(
            user_id=user_admin.id,
            user_name="System Seeder",
            action="SYSTEM_INITIALIZED",
            entity_type="System",
            new_value="Demo users, hospitals, and ambulances provisioned.",
            ip_address="127.0.0.1",
        )
        db.add(audit_entry)
        await db.commit()

        logger.info("Database seeding completed successfully.")

if __name__ == "__main__":
    asyncio.run(seed())
