import asyncio
import logging
import math
from typing import List, Tuple, Optional
from datetime import datetime, timezone
from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.emergency import EmergencyRequest
from app.models.ambulance import Ambulance
from app.models.hospital import Hospital
from app.models.hospital_case import HospitalCase
from app.models.enums import (
    EmergencyStatus,
    EmergencyPriority,
    EmergencyType,
    AmbulanceStatus,
    HospitalCaseStatus,
)
from app.services.emergency_service import EmergencyService
from app.services.hospital_service import HospitalRecommendationService
from app.websocket.connection_manager import manager

logger = logging.getLogger("resq.simulation")

def interpolate_points(start_lat: float, start_lng: float, end_lat: float, end_lng: float, steps: int = 12) -> List[Tuple[float, float, float]]:
    """Generate intermediate GPS points with heading angles."""
    points = []
    d_lat = end_lat - start_lat
    d_lng = end_lng - start_lng
    
    # Calculate initial heading
    y = math.sin(math.radians(d_lng)) * math.cos(math.radians(end_lat))
    x = math.cos(math.radians(start_lat)) * math.sin(math.radians(end_lat)) - \
        math.sin(math.radians(start_lat)) * math.cos(math.radians(end_lat)) * math.cos(math.radians(d_lng))
    heading = (math.degrees(math.atan2(y, x)) + 360) % 360

    for i in range(steps + 1):
        ratio = i / float(steps)
        # Add slight natural road curvature
        curve = math.sin(ratio * math.pi) * 0.0012
        lat = start_lat + (d_lat * ratio) + (curve * 0.4)
        lng = start_lng + (d_lng * ratio) + (curve * 0.6)
        points.append((lat, lng, heading))
    return points

class SimulationRunner:
    def __init__(self):
        self.active_tasks: dict = {}

    def stop_simulation(self, emergency_id: int):
        task = self.active_tasks.pop(emergency_id, None)
        if task and not task.done():
            task.cancel()
        logger.info(f"Simulation stopped for emergency {emergency_id}")

    def stop_all(self):
        for emergency_id in list(self.active_tasks.keys()):
            self.stop_simulation(emergency_id)

    def is_active(self, emergency_id: int) -> bool:
        return emergency_id in self.active_tasks

    async def run_end_to_end(self, emergency_id: int, step_delay: float = 2.0):
        """Asynchronously steps through the complete emergency dispatch & navigation lifecycle."""
        logger.info(f"Starting end-to-end simulation for emergency {emergency_id}")
        try:
            async with AsyncSessionLocal() as db:
                async def is_cancelled_or_stopped() -> bool:
                    if emergency_id not in self.active_tasks:
                        return True
                    emg_check = await db.execute(
                        select(EmergencyRequest.status).where(EmergencyRequest.id == emergency_id)
                    )
                    st = emg_check.scalar_one_or_none()
                    if not st or st in [EmergencyStatus.CANCELLED, EmergencyStatus.CASE_COMPLETED]:
                        return True
                    return False

                emergency = await EmergencyService.get_emergency_by_id(db, emergency_id)
                if not emergency or not emergency.assigned_ambulance:
                    logger.error(f"Cannot simulate emergency {emergency_id}: No assigned ambulance")
                    return

                amb = emergency.assigned_ambulance
                user_id = emergency.user_id
                driver_id = amb.driver_id or 1

                # Step 1: Ensure Hospital is selected and notified
                best_hosp_id = emergency.selected_hospital_id
                if not best_hosp_id:
                    recs = await HospitalRecommendationService.get_recommendations(
                        db, emergency.pickup_lat, emergency.pickup_lng, emergency.emergency_type
                    )
                    best_hosp_id = recs[0].hospital_id if recs else 1
                    await EmergencyService.select_hospital(
                        db, emergency_id, best_hosp_id,
                        selected_by_user_id=user_id,
                        notes=f"Confirmed destination: {recs[0].name if recs else 'Hospital'}"
                    )
                    emergency = await EmergencyService.get_emergency_by_id(db, emergency_id)

                hosp = await db.get(Hospital, best_hosp_id)
                hospital_name = hosp.name if hosp else "Trauma Center"

                # Step 2: Hospital Accepts Incoming Emergency Request
                if await is_cancelled_or_stopped():
                    logger.info(f"Simulation aborted before hospital acceptance for emergency {emergency_id}")
                    return
                await asyncio.sleep(step_delay)

                # Set hospital case to accepted
                hosp_case_stmt = select(HospitalCase).where(
                    HospitalCase.emergency_id == emergency_id,
                    HospitalCase.hospital_id == best_hosp_id,
                )
                hosp_case = (await db.execute(hosp_case_stmt)).scalar_one_or_none()
                if not hosp_case:
                    hosp_case = HospitalCase(
                        emergency_id=emergency_id,
                        hospital_id=best_hosp_id,
                        status=HospitalCaseStatus.ACCEPTED,
                        responded_at=datetime.now(timezone.utc),
                    )
                    db.add(hosp_case)
                else:
                    hosp_case.status = HospitalCaseStatus.ACCEPTED
                    hosp_case.responded_at = datetime.now(timezone.utc)
                await db.commit()

                hosp_accept_payload = {
                    "emergency_id": emergency.id,
                    "hospital_id": best_hosp_id,
                    "hospital_name": hospital_name,
                    "status": "ACCEPTED",
                    "message": f"{hospital_name} confirmed emergency acceptance. Transport authorized.",
                }
                await manager.send_to_user(user_id, "HOSPITAL_ACCEPTED_CASE", hosp_accept_payload)
                await manager.send_to_user(user_id, "STATUS_CHANGE", {
                    "emergency_id": emergency.id,
                    "status": "HOSPITAL_ACCEPTED",
                    "hospital_name": hospital_name,
                })
                await manager.send_to_driver(driver_id, "HOSPITAL_ACCEPTED_CASE", hosp_accept_payload)
                await manager.send_to_hospital(best_hosp_id, "CASE_ACCEPTED", hosp_accept_payload)
                await manager.send_to_dispatchers("HOSPITAL_ACCEPTED_CASE", hosp_accept_payload)

                # Step 3: Ambulance Driver Accepts Dispatch
                if await is_cancelled_or_stopped():
                    logger.info(f"Simulation aborted before driver acceptance for emergency {emergency_id}")
                    return
                await asyncio.sleep(step_delay)
                await EmergencyService.update_status(
                    db, emergency_id, EmergencyStatus.DRIVER_ACCEPTED,
                    changed_by_user_id=driver_id, notes=f"Driver accepted dispatch. Destination: {hospital_name}."
                )

                # Step 4: Ambulance en route to pickup
                if await is_cancelled_or_stopped():
                    logger.info(f"Simulation aborted before en route to pickup for emergency {emergency_id}")
                    return
                await asyncio.sleep(step_delay)
                await EmergencyService.update_status(
                    db, emergency_id, EmergencyStatus.EN_ROUTE_TO_PICKUP,
                    changed_by_user_id=driver_id, notes="Unit rolling toward patient pickup coordinates."
                )

                # Simulate navigation along route from ambulance position to pickup
                pickup_route = interpolate_points(amb.current_lat, amb.current_lng, emergency.pickup_lat, emergency.pickup_lng, steps=6)
                for lat, lng, heading in pickup_route:
                    if await is_cancelled_or_stopped():
                        logger.info(f"Simulation route aborted for emergency {emergency_id}")
                        return
                    await asyncio.sleep(step_delay * 0.8)
                    amb.current_lat = lat
                    amb.current_lng = lng
                    amb.heading = heading
                    await db.commit()

                    loc_payload = {
                        "emergency_id": emergency.id,
                        "ambulance_id": amb.id,
                        "latitude": lat,
                        "longitude": lng,
                        "heading": heading,
                        "target": "PICKUP",
                        "vehicle_number": amb.vehicle_number,
                    }
                    await manager.send_to_user(user_id, "AMBULANCE_LOCATION_UPDATE", loc_payload)
                    await manager.send_to_driver(driver_id, "AMBULANCE_LOCATION_UPDATE", loc_payload)
                    await manager.send_to_dispatchers("AMBULANCE_LOCATION_UPDATE", loc_payload)

                # Step 5: Arrived at pickup
                if await is_cancelled_or_stopped():
                    logger.info(f"Simulation aborted before arrived at pickup for emergency {emergency_id}")
                    return
                await asyncio.sleep(step_delay)
                await EmergencyService.update_status(
                    db, emergency_id, EmergencyStatus.ARRIVED_AT_PICKUP,
                    changed_by_user_id=driver_id, notes="Ambulance arrived on scene."
                )

                # Step 6: Driver confirms patient pickup via pop-up
                if await is_cancelled_or_stopped():
                    logger.info(f"Simulation aborted before patient pickup for emergency {emergency_id}")
                    return
                await asyncio.sleep(step_delay * 1.2)
                await EmergencyService.update_status(
                    db, emergency_id, EmergencyStatus.PATIENT_ONBOARD,
                    changed_by_user_id=driver_id, notes=f"Patient secured onboard. Confirmed transit to {hospital_name}."
                )

                # Step 7: En route to selected hospital
                if await is_cancelled_or_stopped():
                    logger.info(f"Simulation aborted before transit to hospital for emergency {emergency_id}")
                    return
                await asyncio.sleep(step_delay)
                await EmergencyService.update_status(
                    db, emergency_id, EmergencyStatus.EN_ROUTE_TO_HOSPITAL,
                    changed_by_user_id=driver_id, notes=f"Directing transport along route to {hospital_name}."
                )

                # Simulate navigation from pickup to hospital
                if hosp:
                    hosp_route = interpolate_points(emergency.pickup_lat, emergency.pickup_lng, hosp.latitude, hosp.longitude, steps=7)
                    for lat, lng, heading in hosp_route:
                        if await is_cancelled_or_stopped():
                            logger.info(f"Simulation hospital route aborted for emergency {emergency_id}")
                            return
                        await asyncio.sleep(step_delay * 0.8)
                        amb.current_lat = lat
                        amb.current_lng = lng
                        amb.heading = heading
                        await db.commit()

                        loc_payload = {
                            "emergency_id": emergency.id,
                            "ambulance_id": amb.id,
                            "latitude": lat,
                            "longitude": lng,
                            "heading": heading,
                            "target": "HOSPITAL",
                            "vehicle_number": amb.vehicle_number,
                        }
                        await manager.send_to_user(user_id, "AMBULANCE_LOCATION_UPDATE", loc_payload)
                        await manager.send_to_driver(driver_id, "AMBULANCE_LOCATION_UPDATE", loc_payload)
                        await manager.send_to_hospital(best_hosp_id, "AMBULANCE_LOCATION_UPDATE", loc_payload)
                        await manager.send_to_dispatchers("AMBULANCE_LOCATION_UPDATE", loc_payload)

                # Step 8: Arrived at hospital
                if await is_cancelled_or_stopped():
                    logger.info(f"Simulation aborted before arriving at hospital for emergency {emergency_id}")
                    return
                await asyncio.sleep(step_delay)
                await EmergencyService.update_status(
                    db, emergency_id, EmergencyStatus.ARRIVED_AT_HOSPITAL,
                    changed_by_user_id=driver_id, notes=f"Arrived at {hospital_name} Emergency Department entrance."
                )

                # Step 9: Case Handover & Completion
                if await is_cancelled_or_stopped():
                    logger.info(f"Simulation aborted before case completion for emergency {emergency_id}")
                    return
                await asyncio.sleep(step_delay * 1.5)
                await EmergencyService.update_status(
                    db, emergency_id, EmergencyStatus.CASE_COMPLETED,
                    changed_by_user_id=driver_id, notes="Clinical handover completed. Patient admitted to emergency ward."
                )

                logger.info(f"Simulation completed successfully for emergency {emergency_id}")

        except asyncio.CancelledError:
            logger.info(f"Simulation cancelled for emergency {emergency_id}")
        except Exception as e:
            logger.error(f"Error during simulation: {e}", exc_info=True)
        finally:
            self.active_tasks.pop(emergency_id, None)

simulation_runner = SimulationRunner()
