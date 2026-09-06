from datetime import datetime, timezone
from typing import Optional, Tuple, List
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload

logger = logging.getLogger("resq.emergency_service")

from app.models.emergency import EmergencyRequest, EmergencyStatusHistory
from app.models.ambulance import Ambulance
from app.models.hospital import Hospital
from app.models.hospital_case import HospitalCase, HospitalChangeRequest
from app.models.trip import TripHistory
from app.models.notification import Notification
from app.models.user import User
from app.models.enums import (
    EmergencyStatus,
    EmergencyPriority,
    EmergencyType,
    AmbulanceStatus,
    HospitalCaseStatus,
    ChangeRequestStatus,
    UserRole
)
from app.websocket.connection_manager import manager
from app.services.audit_service import AuditService
from app.services.matching_service import haversine_distance, calculate_eta_minutes

def determine_default_priority(emergency_type: EmergencyType) -> EmergencyPriority:
    if emergency_type in [EmergencyType.CARDIAC, EmergencyType.UNCONSCIOUS]:
        return EmergencyPriority.CRITICAL
    elif emergency_type in [EmergencyType.ACCIDENT, EmergencyType.BREATHING, EmergencyType.FIRE]:
        return EmergencyPriority.HIGH
    elif emergency_type in [EmergencyType.PREGNANCY, EmergencyType.INJURY]:
        return EmergencyPriority.MEDIUM
    return EmergencyPriority.LOW

def diff_minutes(dt_end: Optional[datetime], dt_start: Optional[datetime]) -> float:
    if not dt_end or not dt_start:
        return 0.0
    if dt_end.tzinfo is not None and dt_start.tzinfo is None:
        dt_start = dt_start.replace(tzinfo=timezone.utc)
    elif dt_end.tzinfo is None and dt_start.tzinfo is not None:
        dt_end = dt_end.replace(tzinfo=timezone.utc)
    return max(0.1, round((dt_end - dt_start).total_seconds() / 60.0, 1))

class EmergencyService:
    @staticmethod
    async def get_emergency_by_id(db: AsyncSession, emergency_id: int) -> Optional[EmergencyRequest]:
        stmt = (
            select(EmergencyRequest)
            .where(EmergencyRequest.id == emergency_id)
            .options(
                selectinload(EmergencyRequest.user),
                selectinload(EmergencyRequest.assigned_ambulance).selectinload(Ambulance.driver),
                selectinload(EmergencyRequest.selected_hospital),
                selectinload(EmergencyRequest.status_history),
                selectinload(EmergencyRequest.hospital_cases).selectinload(HospitalCase.hospital),
                selectinload(EmergencyRequest.change_requests),
            )
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def create_emergency(
        db: AsyncSession,
        user_id: int,
        patient_name: str,
        pickup_address: str,
        pickup_lat: float,
        pickup_lng: float,
        contact_number: str,
        emergency_type: EmergencyType = EmergencyType.ACCIDENT,
        priority: Optional[EmergencyPriority] = None,
        patient_age: Optional[int] = None,
        description: Optional[str] = None,
        medical_info: Optional[str] = None,
        preferred_hospital: Optional[str] = None,
        selected_hospital_id: Optional[int] = None,
        client_ip: Optional[str] = None,
    ) -> EmergencyRequest:
        if priority is None:
            priority = determine_default_priority(emergency_type)

        emergency = EmergencyRequest(
            user_id=user_id,
            patient_name=patient_name,
            patient_age=patient_age,
            emergency_type=emergency_type,
            priority=priority,
            description=description,
            medical_info=medical_info,
            contact_number=contact_number,
            preferred_hospital=preferred_hospital,
            selected_hospital_id=selected_hospital_id,
            pickup_address=pickup_address,
            pickup_lat=pickup_lat,
            pickup_lng=pickup_lng,
            status=EmergencyStatus.SEARCHING_AMBULANCE,
        )
        db.add(emergency)
        await db.commit()
        await db.refresh(emergency)

        # If hospital was pre-selected during booking, register the ER triage case
        if selected_hospital_id:
            hosp_case = HospitalCase(
                emergency_id=emergency.id,
                hospital_id=selected_hospital_id,
                status=HospitalCaseStatus.NOTIFIED,
            )
            db.add(hosp_case)
            await db.commit()

        # Status History entry
        history_entry = EmergencyStatusHistory(
            emergency_id=emergency.id,
            old_status=None,
            new_status=EmergencyStatus.SEARCHING_AMBULANCE.value,
            changed_by_user_id=user_id,
            notes=f"Emergency created with priority {priority.value}",
        )
        db.add(history_entry)

        # In-app notification for User
        user_notif = Notification(
            user_id=user_id,
            title="Emergency Dispatched",
            message=f"Your emergency request ({emergency_type.value}) has been received. Locating the nearest response unit...",
            notification_type="ALERT",
            related_emergency_id=emergency.id,
        )
        db.add(user_notif)

        # Notification for Dispatchers
        disp_notif = Notification(
            role_target=UserRole.DISPATCHER.value,
            title=f"New {priority.value} Emergency: {emergency_type.value}",
            message=f"Patient {patient_name} at {pickup_address}. Searching for available units.",
            notification_type="ALERT" if priority == EmergencyPriority.CRITICAL else "INFO",
            related_emergency_id=emergency.id,
        )
        db.add(disp_notif)

        await db.commit()

        # Audit Log
        await AuditService.log_action(
            db=db,
            action="EMERGENCY_CREATED",
            entity_type="EmergencyRequest",
            entity_id=emergency.id,
            user_id=user_id,
            new_value=f"Type: {emergency_type.value}, Priority: {priority.value}",
            ip_address=client_ip,
        )

        # Broadcast via WebSockets
        emergency_payload = {
            "emergency_id": emergency.id,
            "patient_name": emergency.patient_name,
            "emergency_type": emergency.emergency_type.value,
            "priority": emergency.priority.value,
            "status": emergency.status.value,
            "pickup_address": emergency.pickup_address,
            "pickup_lat": emergency.pickup_lat,
            "pickup_lng": emergency.pickup_lng,
        }
        await manager.send_to_user(user_id, "EMERGENCY_STATUS_UPDATED", emergency_payload)
        await manager.send_to_dispatchers("NEW_EMERGENCY_REQUESTED", emergency_payload)

        return emergency

    @staticmethod
    async def assign_ambulance(
        db: AsyncSession,
        emergency_id: int,
        ambulance_id: int,
        assigned_by_user_id: Optional[int] = None,
        client_ip: Optional[str] = None,
    ) -> EmergencyRequest:
        emergency = await EmergencyService.get_emergency_by_id(db, emergency_id)
        if not emergency:
            raise ValueError("Emergency request not found")

        stmt = select(Ambulance).where(Ambulance.id == ambulance_id).options(selectinload(Ambulance.driver))
        ambulance = (await db.execute(stmt)).scalar_one_or_none()
        if not ambulance:
            raise ValueError("Ambulance not found")

        # If the assigned ambulance has no driver, auto-link an active driver
        if not ambulance.driver_id:
            # First look for a driver not currently attached to another ambulance
            unassigned_stmt = (
                select(User)
                .outerjoin(Ambulance, User.id == Ambulance.driver_id)
                .where(User.role == UserRole.AMBULANCE_DRIVER, Ambulance.id.is_(None))
                .order_by(User.id.asc())
            )
            driver_user = (await db.execute(unassigned_stmt)).scalars().first()
            if not driver_user:
                # Fallback: select any driver
                fallback_stmt = select(User).where(User.role == UserRole.AMBULANCE_DRIVER).order_by(User.id.asc())
                driver_user = (await db.execute(fallback_stmt)).scalars().first()
                if driver_user:
                    from sqlalchemy import update
                    await db.execute(
                        update(Ambulance)
                        .where(Ambulance.driver_id == driver_user.id)
                        .values(driver_id=None)
                    )
            if driver_user:
                ambulance.driver_id = driver_user.id
                ambulance.driver = driver_user

        dist = haversine_distance(ambulance.current_lat, ambulance.current_lng, emergency.pickup_lat, emergency.pickup_lng)
        eta = calculate_eta_minutes(dist)

        old_status = emergency.status.value
        emergency.assigned_ambulance_id = ambulance_id
        emergency.status = EmergencyStatus.AMBULANCE_ASSIGNED
        emergency.estimated_distance_km = dist
        emergency.estimated_eta_minutes = eta

        # Mark ambulance as ON_TRIP / EMERGENCY
        ambulance.availability_status = AmbulanceStatus.EMERGENCY

        history = EmergencyStatusHistory(
            emergency_id=emergency.id,
            old_status=old_status,
            new_status=EmergencyStatus.AMBULANCE_ASSIGNED.value,
            changed_by_user_id=assigned_by_user_id,
            notes=f"Assigned unit {ambulance.vehicle_number}. ETA ~{eta:.1f} mins",
        )
        db.add(history)

        # Notify Driver
        if ambulance.driver_id:
            driver_notif = Notification(
                user_id=ambulance.driver_id,
                title="Dispatch Alert: New Emergency Assignment",
                message=f"Emergency: {emergency.emergency_type.value} at {emergency.pickup_address} ({dist:.1f} km)",
                notification_type="ALERT",
                related_emergency_id=emergency.id,
            )
            db.add(driver_notif)

        # Notify User
        user_notif = Notification(
            user_id=emergency.user_id,
            title="Ambulance Dispatched",
            message=f"Ambulance {ambulance.vehicle_number} is en route. Estimated arrival: {eta:.0f} minutes.",
            notification_type="INFO",
            related_emergency_id=emergency.id,
        )
        db.add(user_notif)

        await db.commit()

        await AuditService.log_action(
            db=db,
            action="AMBULANCE_ASSIGNED",
            entity_type="EmergencyRequest",
            entity_id=emergency.id,
            user_id=assigned_by_user_id,
            previous_value=old_status,
            new_value=f"Ambulance: {ambulance.vehicle_number}, Status: AMBULANCE_ASSIGNED",
            ip_address=client_ip,
        )

        hosp_data = None
        if emergency.selected_hospital:
            hosp_data = {
                "id": emergency.selected_hospital.id,
                "name": emergency.selected_hospital.name,
                "address": emergency.selected_hospital.address,
                "phone": emergency.selected_hospital.phone,
                "icu_beds_available": emergency.selected_hospital.icu_beds_available,
                "general_beds_available": emergency.selected_hospital.general_beds_available,
            }

        # WebSocket events
        payload = {
            "id": emergency.id,
            "emergency_id": emergency.id,
            "status": emergency.status.value,
            "ambulance_id": ambulance.id,
            "assigned_ambulance_id": ambulance.id,
            "vehicle_number": ambulance.vehicle_number,
            "driver_name": ambulance.driver.full_name if ambulance.driver else "Assigned Driver",
            "driver_phone": ambulance.driver.phone_number if ambulance.driver else "N/A",
            "current_lat": ambulance.current_lat,
            "current_lng": ambulance.current_lng,
            "distance_km": dist,
            "eta_minutes": eta,
            "pickup_lat": emergency.pickup_lat,
            "pickup_lng": emergency.pickup_lng,
            "pickup_address": emergency.pickup_address,
            "emergency_type": emergency.emergency_type.value,
            "patient_name": emergency.patient_name,
            "patient_age": emergency.patient_age,
            "contact_number": emergency.contact_number,
            "priority": emergency.priority.value,
            "description": emergency.description,
            "selected_hospital_id": emergency.selected_hospital_id,
            "selected_hospital": hosp_data,
            "destination_hospital": hosp_data,
        }
        await manager.send_to_user(emergency.user_id, "AMBULANCE_ASSIGNED", payload)
        if ambulance.driver_id:
            await manager.send_to_driver(ambulance.driver_id, "NEW_DISPATCH_OFFER", payload)
            await manager.send_to_driver(ambulance.driver_id, "DISPATCH_REQUEST", payload)
        # Broadcast to all active driver Cockpits
        await manager.broadcast_to_drivers("NEW_DISPATCH_OFFER", payload)
        await manager.broadcast_to_drivers("DISPATCH_REQUEST", payload)
        await manager.send_to_dispatchers("EMERGENCY_UPDATED", payload)
        await manager.send_to_dispatchers("STATUS_CHANGE", payload)

        return emergency

    @staticmethod
    async def update_status(
        db: AsyncSession,
        emergency_id: int,
        new_status: EmergencyStatus,
        changed_by_user_id: Optional[int] = None,
        notes: Optional[str] = None,
        client_ip: Optional[str] = None,
    ) -> EmergencyRequest:
        emergency = await EmergencyService.get_emergency_by_id(db, emergency_id)
        if not emergency:
            raise ValueError("Emergency request not found")

        # Normalize status aliases to standard workflow stages
        alias_map = {
            EmergencyStatus.AMBULANCE_EN_ROUTE: EmergencyStatus.EN_ROUTE_TO_PICKUP,
            EmergencyStatus.ARRIVED_AT_SCENE: EmergencyStatus.ARRIVED_AT_PICKUP,
            EmergencyStatus.PATIENT_LOADED: EmergencyStatus.PATIENT_ONBOARD,
            EmergencyStatus.IN_TRANSIT_TO_HOSPITAL: EmergencyStatus.EN_ROUTE_TO_HOSPITAL,
            EmergencyStatus.HANDOVER_COMPLETE: EmergencyStatus.CASE_COMPLETED,
        }
        if new_status in alias_map:
            new_status = alias_map[new_status]

        old_status = emergency.status
        if old_status == EmergencyStatus.CANCELLED and new_status != EmergencyStatus.CANCELLED:
            logger.warning(
                f"Emergency {emergency_id} is already CANCELLED. Discarding status transition to {new_status.value}."
            )
            return emergency

        emergency.status = new_status
        emergency.updated_at = datetime.now(timezone.utc)

        # Handle Trip record and Ambulance status updates
        if new_status == EmergencyStatus.DRIVER_ACCEPTED:
            # Create or update trip record
            trip_stmt = select(TripHistory).where(TripHistory.emergency_id == emergency.id)
            trip_res = await db.execute(trip_stmt)
            trip = trip_res.scalar_one_or_none()
            if not trip and emergency.assigned_ambulance:
                trip = TripHistory(
                    emergency_id=emergency.id,
                    ambulance_id=emergency.assigned_ambulance_id,
                    driver_id=emergency.assigned_ambulance.driver_id or changed_by_user_id or 1,
                    start_time=datetime.now(timezone.utc),
                )
                db.add(trip)
        elif new_status == EmergencyStatus.ARRIVED_AT_PICKUP:
            if emergency.assigned_ambulance:
                if emergency.pickup_lat and emergency.pickup_lng:
                    emergency.assigned_ambulance.current_lat = emergency.pickup_lat
                    emergency.assigned_ambulance.current_lng = emergency.pickup_lng
            emergency.estimated_eta_minutes = 0.0
            emergency.estimated_distance_km = 0.0

            trip_stmt = select(TripHistory).where(TripHistory.emergency_id == emergency.id)
            trip_res = await db.execute(trip_stmt)
            trip = trip_res.scalar_one_or_none()
            if trip:
                trip.pickup_arrival_time = datetime.now(timezone.utc)
                if trip.start_time:
                    trip.response_time_minutes = diff_minutes(trip.pickup_arrival_time, trip.start_time)
        elif new_status == EmergencyStatus.PATIENT_ONBOARD:
            trip_stmt = select(TripHistory).where(TripHistory.emergency_id == emergency.id)
            trip_res = await db.execute(trip_stmt)
            trip = trip_res.scalar_one_or_none()
            if trip:
                trip.patient_onboard_time = datetime.now(timezone.utc)
        elif new_status == EmergencyStatus.ARRIVED_AT_HOSPITAL:
            if emergency.assigned_ambulance:
                if emergency.selected_hospital:
                    emergency.assigned_ambulance.current_lat = emergency.selected_hospital.latitude
                    emergency.assigned_ambulance.current_lng = emergency.selected_hospital.longitude
            emergency.estimated_eta_minutes = 0.0
            emergency.estimated_distance_km = 0.0

            trip_stmt = select(TripHistory).where(TripHistory.emergency_id == emergency.id)
            trip_res = await db.execute(trip_stmt)
            trip = trip_res.scalar_one_or_none()
            if trip:
                trip.hospital_arrival_time = datetime.now(timezone.utc)
        elif new_status in [EmergencyStatus.CASE_COMPLETED, EmergencyStatus.CANCELLED]:
            # Release ambulance back to AVAILABLE
            if emergency.assigned_ambulance_id:
                amb = await db.get(Ambulance, emergency.assigned_ambulance_id)
                if amb:
                    amb.availability_status = AmbulanceStatus.AVAILABLE
            trip_stmt = select(TripHistory).where(TripHistory.emergency_id == emergency.id)
            trip_res = await db.execute(trip_stmt)
            trip = trip_res.scalar_one_or_none()
            if trip and not trip.completed_time:
                trip.completed_time = datetime.now(timezone.utc)
                if trip.start_time:
                    trip.total_duration_minutes = diff_minutes(trip.completed_time, trip.start_time)
                trip.total_distance_km = round((emergency.estimated_distance_km or 4.5) * 1.8, 1)

        history = EmergencyStatusHistory(
            emergency_id=emergency.id,
            old_status=old_status.value,
            new_status=new_status.value,
            changed_by_user_id=changed_by_user_id,
            notes=notes or f"Status changed to {new_status.value}",
        )
        db.add(history)

        # Notify parties
        user_msg = f"Emergency status is now: {new_status.value.replace('_', ' ')}"
        user_notif = Notification(
            user_id=emergency.user_id,
            title="Emergency Status Update",
            message=user_msg,
            notification_type="SUCCESS" if new_status == EmergencyStatus.CASE_COMPLETED else "INFO",
            related_emergency_id=emergency.id,
        )
        db.add(user_notif)

        await db.commit()

        await AuditService.log_action(
            db=db,
            action="STATUS_CHANGED",
            entity_type="EmergencyRequest",
            entity_id=emergency.id,
            user_id=changed_by_user_id,
            previous_value=old_status.value,
            new_value=new_status.value,
            ip_address=client_ip,
        )

        # WebSocket broadcast
        payload = {
            "id": emergency.id,
            "emergency_id": emergency.id,
            "status": new_status.value,
            "eta_minutes": emergency.estimated_eta_minutes,
            "distance_km": emergency.estimated_distance_km,
            "notes": notes,
            "updated_at": str(emergency.updated_at),
        }
        if emergency.assigned_ambulance:
            payload["ambulance"] = {
                "id": emergency.assigned_ambulance.id,
                "current_latitude": emergency.assigned_ambulance.current_lat,
                "current_longitude": emergency.assigned_ambulance.current_lng,
                "current_lat": emergency.assigned_ambulance.current_lat,
                "current_lng": emergency.assigned_ambulance.current_lng,
                "speed_kmh": getattr(emergency.assigned_ambulance, "speed_kmh", 0.0),
                "heading": emergency.assigned_ambulance.heading,
            }

        await manager.send_to_user(emergency.user_id, "EMERGENCY_STATUS_UPDATED", payload)
        await manager.send_to_user(emergency.user_id, "STATUS_CHANGE", payload)
        if emergency.assigned_ambulance and emergency.assigned_ambulance.driver_id:
            await manager.send_to_driver(emergency.assigned_ambulance.driver_id, "EMERGENCY_STATUS_UPDATED", payload)
            await manager.send_to_driver(emergency.assigned_ambulance.driver_id, "STATUS_CHANGE", payload)
        if emergency.selected_hospital_id:
            await manager.send_to_hospital(emergency.selected_hospital_id, "EMERGENCY_STATUS_UPDATED", payload)
            await manager.send_to_hospital(emergency.selected_hospital_id, "STATUS_CHANGE", payload)
        await manager.send_to_dispatchers("EMERGENCY_STATUS_UPDATED", payload)
        await manager.send_to_dispatchers("STATUS_CHANGE", payload)

        if new_status == EmergencyStatus.CANCELLED:
            await manager.broadcast("EMERGENCY_STATUS_UPDATED", payload)
            await manager.broadcast("STATUS_CHANGE", payload)
            await manager.broadcast("SIMULATION_ENDED", {
                "emergency_id": emergency.id,
                "status": "CANCELLED",
                "message": "Emergency cancelled"
            })

        # If arrived on scene or at hospital, immediately broadcast location update to sync all maps
        if new_status == EmergencyStatus.ARRIVED_AT_PICKUP and emergency.pickup_lat and emergency.pickup_lng:
            loc_data = {
                "emergency_id": emergency.id,
                "ambulance_id": emergency.assigned_ambulance_id,
                "latitude": emergency.pickup_lat,
                "longitude": emergency.pickup_lng,
                "speed": 0.0,
                "heading": 0.0,
                "eta_minutes": 0.0,
                "distance_km": 0.0,
                "target": "PICKUP",
            }
            await manager.broadcast_emergency_location(
                emergency_id=emergency.id,
                user_id=emergency.user_id,
                hospital_id=emergency.selected_hospital_id,
                data=loc_data,
            )
        elif new_status == EmergencyStatus.ARRIVED_AT_HOSPITAL and emergency.selected_hospital:
            loc_data = {
                "emergency_id": emergency.id,
                "ambulance_id": emergency.assigned_ambulance_id,
                "latitude": emergency.selected_hospital.latitude,
                "longitude": emergency.selected_hospital.longitude,
                "speed": 0.0,
                "heading": 0.0,
                "eta_minutes": 0.0,
                "distance_km": 0.0,
                "target": "HOSPITAL",
            }
            await manager.broadcast_emergency_location(
                emergency_id=emergency.id,
                user_id=emergency.user_id,
                hospital_id=emergency.selected_hospital_id,
                data=loc_data,
            )

        return emergency

    @staticmethod
    async def select_hospital(
        db: AsyncSession,
        emergency_id: int,
        hospital_id: int,
        selected_by_user_id: Optional[int] = None,
        is_dispatcher_override: bool = False,
        override_reason: Optional[str] = None,
        client_ip: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> EmergencyRequest:
        emergency = await EmergencyService.get_emergency_by_id(db, emergency_id)
        if not emergency:
            raise ValueError("Emergency request not found")

        hospital = await db.get(Hospital, hospital_id)
        if not hospital:
            raise ValueError("Hospital not found")

        emergency.selected_hospital_id = hospital_id
        
        # If status was prior to hospital selected, move forward
        if emergency.status in [
            EmergencyStatus.DRIVER_ACCEPTED,
            EmergencyStatus.EN_ROUTE_TO_PICKUP,
            EmergencyStatus.ARRIVED_AT_PICKUP,
            EmergencyStatus.PATIENT_ONBOARD,
        ]:
            emergency.status = EmergencyStatus.HOSPITAL_SELECTED

        # Create or update HospitalCase record
        case_stmt = select(HospitalCase).where(
            HospitalCase.emergency_id == emergency.id,
            HospitalCase.hospital_id == hospital.id,
        )
        case_res = await db.execute(case_stmt)
        hosp_case = case_res.scalar_one_or_none()
        if not hosp_case:
            hosp_case = HospitalCase(
                emergency_id=emergency.id,
                hospital_id=hospital.id,
                status=HospitalCaseStatus.NOTIFIED,
            )
            db.add(hosp_case)

        notes = f"Hospital destination set to {hospital.name}."
        if is_dispatcher_override:
            notes += f" (Dispatcher Override: {override_reason or 'Priority Medical Routing'})"

        history = EmergencyStatusHistory(
            emergency_id=emergency.id,
            old_status=emergency.status.value,
            new_status=EmergencyStatus.HOSPITAL_SELECTED.value,
            changed_by_user_id=selected_by_user_id,
            notes=notes,
        )
        db.add(history)

        # Notify Hospital Staff
        if hospital.staff_user_id:
            hosp_notif = Notification(
                user_id=hospital.staff_user_id,
                title="Incoming Emergency Patient Alert",
                message=f"Inbound ambulance {emergency.assigned_ambulance.vehicle_number if emergency.assigned_ambulance else 'Unit'} with {emergency.emergency_type.value} case ({emergency.patient_name}).",
                notification_type="ALERT",
                related_emergency_id=emergency.id,
            )
            db.add(hosp_notif)

        await db.commit()

        await AuditService.log_action(
            db=db,
            action="HOSPITAL_SELECTED",
            entity_type="EmergencyRequest",
            entity_id=emergency.id,
            user_id=selected_by_user_id,
            new_value=f"Hospital: {hospital.name} (Override: {is_dispatcher_override})",
            ip_address=client_ip,
        )

        payload = {
            "emergency_id": emergency.id,
            "hospital_id": hospital.id,
            "hospital_name": hospital.name,
            "hospital_lat": hospital.latitude,
            "hospital_lng": hospital.longitude,
            "hospital_phone": hospital.phone,
            "patient_name": emergency.patient_name,
            "emergency_type": emergency.emergency_type.value,
            "priority": emergency.priority.value,
            "status": emergency.status.value,
            "vehicle_number": emergency.assigned_ambulance.vehicle_number if emergency.assigned_ambulance else "TBD",
            "is_override": is_dispatcher_override,
        }
        await manager.send_to_user(emergency.user_id, "HOSPITAL_CONFIRMED", payload)
        if emergency.assigned_ambulance and emergency.assigned_ambulance.driver_id:
            await manager.send_to_driver(emergency.assigned_ambulance.driver_id, "HOSPITAL_CONFIRMED", payload)
        await manager.send_to_hospital(hospital.id, "INCOMING_CASE_ALERT", payload)
        await manager.send_to_dispatchers("HOSPITAL_CONFIRMED", payload)

        return emergency
