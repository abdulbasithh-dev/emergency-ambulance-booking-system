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
                
                # Step 1: Driver Accepts
                if await is_cancelled_or_stopped():
                    logger.info(f"Simulation aborted before step 1 for emergency {emergency_id}")
                    return
                await asyncio.sleep(step_delay)
                await EmergencyService.update_status(
                    db, emergency_id, EmergencyStatus.DRIVER_ACCEPTED,
                    changed_by_user_id=driver_id, notes="Driver accepted emergency assignment."
                )

                # Step 2: En route to pickup
                if await is_cancelled_or_stopped():
                    logger.info(f"Simulation aborted before step 2 for emergency {emergency_id}")
                    return
                await asyncio.sleep(step_delay)
                await EmergencyService.update_status(
                    db, emergency_id, EmergencyStatus.EN_ROUTE_TO_PICKUP,
                    changed_by_user_id=driver_id, notes="Unit rolling toward pickup location."
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

                # Step 3: Arrived at pickup
                if await is_cancelled_or_stopped():
                    logger.info(f"Simulation aborted before step 3 for emergency {emergency_id}")
                    return
                await asyncio.sleep(step_delay)
                await EmergencyService.update_status(
                    db, emergency_id, EmergencyStatus.ARRIVED_AT_PICKUP,
                    changed_by_user_id=driver_id, notes="Ambulance arrived on scene."
                )

                # Step 4: Patient onboard
                if await is_cancelled_or_stopped():
                    logger.info(f"Simulation aborted before step 4 for emergency {emergency_id}")
                    return
                await asyncio.sleep(step_delay * 1.2)
                await EmergencyService.update_status(
                    db, emergency_id, EmergencyStatus.PATIENT_ONBOARD,
                    changed_by_user_id=driver_id, notes="Patient secured onboard. Stabilizing vitals."
                )

                # Step 5: Recommended Hospital selection
                if await is_cancelled_or_stopped():
                    logger.info(f"Simulation aborted before step 5 for emergency {emergency_id}")
                    return
                await asyncio.sleep(step_delay)
                recs = await HospitalRecommendationService.get_recommendations(
                    db, emergency.pickup_lat, emergency.pickup_lng, emergency.emergency_type
                )
                best_hosp_id = recs[0].hospital_id if recs else 1
                await EmergencyService.select_hospital(
                    db, emergency_id, best_hosp_id,
                    selected_by_user_id=user_id,
                    notes=f"Confirmed destination: {recs[0].name if recs else 'Hospital'}"
                )

                # Step 6: Hospital accepts incoming case
                if await is_cancelled_or_stopped():
                    logger.info(f"Simulation aborted before step 6 for emergency {emergency_id}")
                    return
                await asyncio.sleep(step_delay)
                hosp = await db.get(Hospital, best_hosp_id)
                hosp_payload = {
                    "emergency_id": emergency.id,
                    "hospital_id": best_hosp_id,
                    "status": HospitalCaseStatus.ACCEPTED.value,
                    "hospital_name": hosp.name if hosp else "Hospital",
                }
                await manager.send_to_hospital(best_hosp_id, "CASE_ACCEPTED", hosp_payload)
                await manager.send_to_driver(driver_id, "HOSPITAL_ACCEPTED_CASE", hosp_payload)
                await manager.send_to_user(user_id, "HOSPITAL_ACCEPTED_CASE", hosp_payload)
                await manager.send_to_dispatchers("HOSPITAL_ACCEPTED_CASE", hosp_payload)

                # Step 7: En route to hospital
                if await is_cancelled_or_stopped():
                    logger.info(f"Simulation aborted before step 7 for emergency {emergency_id}")
                    return
                await asyncio.sleep(step_delay)
                await EmergencyService.update_status(
                    db, emergency_id, EmergencyStatus.EN_ROUTE_TO_HOSPITAL,
                    changed_by_user_id=driver_id, notes="Transporting patient to confirmed emergency hospital."
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
                    logger.info(f"Simulation aborted before step 8 for emergency {emergency_id}")
                    return
                await asyncio.sleep(step_delay)
                await EmergencyService.update_status(
                    db, emergency_id, EmergencyStatus.ARRIVED_AT_HOSPITAL,
                    changed_by_user_id=driver_id, notes="Arrived at Emergency Department entrance. Handover underway."
                )

                # Step 9: Case Completed
                if await is_cancelled_or_stopped():
                    logger.info(f"Simulation aborted before step 9 for emergency {emergency_id}")
                    return
                await asyncio.sleep(step_delay * 1.5)
                await EmergencyService.update_status(
                    db, emergency_id, EmergencyStatus.CASE_COMPLETED,
                    changed_by_user_id=driver_id, notes="Patient successfully admitted. Trip completed."
                )

                logger.info(f"Simulation completed successfully for emergency {emergency_id}")

        except asyncio.CancelledError:
            logger.info(f"Simulation cancelled for emergency {emergency_id}")
        except Exception as e:
            logger.error(f"Error during simulation: {e}", exc_info=True)
        finally:
            self.active_tasks.pop(emergency_id, None)

simulation_runner = SimulationRunner()
