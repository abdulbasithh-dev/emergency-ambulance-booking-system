import math
from typing import List, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.ambulance import Ambulance
from app.models.enums import AmbulanceStatus, AmbulanceType, EmergencyType
from app.schemas.ambulance import NearbyAmbulanceMatch

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance in kilometers between two GPS points using Haversine formula."""
    R = 6371.0  # Earth's radius in kilometers
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2.0) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return round(R * c, 2)

def calculate_eta_minutes(distance_km: float, speed_kmh: float = 38.0) -> float:
    """Calculates ETA with urban emergency vehicle clearing factor."""
    if distance_km <= 0.05:
        return 1.0
    # Add 1.5 minutes dispatch & startup buffer
    travel_time = (distance_km / speed_kmh) * 60.0 + 1.5
    return round(travel_time, 1)

def evaluate_equipment_score(capabilities_str: str, vehicle_type: AmbulanceType, emergency_type: EmergencyType) -> float:
    """Calculates capability match percentage (0 to 100%) for a given emergency."""
    caps = [c.strip().lower() for c in capabilities_str.split(",") if c.strip()]
    score = 70.0  # Base readiness

    if emergency_type in [EmergencyType.CARDIAC, EmergencyType.UNCONSCIOUS]:
        if "defibrillator" in caps: score += 15.0
        if "ecg" in caps: score += 10.0
        if "oxygen" in caps: score += 5.0
        if vehicle_type == AmbulanceType.ALS: score += 10.0
    elif emergency_type == EmergencyType.BREATHING:
        if "ventilator" in caps: score += 20.0
        if "oxygen" in caps: score += 15.0
    elif emergency_type in [EmergencyType.ACCIDENT, EmergencyType.INJURY, EmergencyType.FIRE]:
        if "trauma kit" in caps or "trauma" in caps: score += 15.0
        if "stretcher" in caps: score += 10.0
        if "oxygen" in caps: score += 5.0
    else:
        score += 15.0

    return min(100.0, score)

class AmbulanceMatchingService:
    @staticmethod
    async def find_and_rank_nearby(
        db: AsyncSession,
        pickup_lat: float,
        pickup_lng: float,
        emergency_type: EmergencyType = EmergencyType.ACCIDENT,
        max_radius_km: float = 35.0,
    ) -> List[NearbyAmbulanceMatch]:
        """
        Finds all available ambulances, calculates distance, ETA, equipment suitability,
        and ranks them using a weighted multi-factor scoring function.
        """
        # Prefer available ambulances with an assigned active driver
        stmt = (
            select(Ambulance)
            .where(
                Ambulance.availability_status == AmbulanceStatus.AVAILABLE,
                Ambulance.driver_id.isnot(None),
            )
            .options(selectinload(Ambulance.driver))
        )
        result = await db.execute(stmt)
        available_ambulances = result.scalars().all()

        # Fallback to any available ambulance if no crewed units are found
        if not available_ambulances:
            stmt_fallback = (
                select(Ambulance)
                .where(Ambulance.availability_status == AmbulanceStatus.AVAILABLE)
                .options(selectinload(Ambulance.driver))
            )
            result_fallback = await db.execute(stmt_fallback)
            available_ambulances = result_fallback.scalars().all()

        ranked_list: List[NearbyAmbulanceMatch] = []

        for amb in available_ambulances:
            dist = haversine_distance(amb.current_lat, amb.current_lng, pickup_lat, pickup_lng)
            if dist > max_radius_km:
                continue

            eta = calculate_eta_minutes(dist)
            equip_score = evaluate_equipment_score(amb.capabilities or "", amb.vehicle_type, emergency_type)

            # Composite ranking: Lower overall_rank_score is better
            # Factors: ETA (45%), Distance (25%), Equipment Deficiency (30%)
            overall_rank_score = (eta * 0.45) + (dist * 0.25) + ((100.0 - equip_score) * 0.30)

            driver_name = amb.driver.full_name if amb.driver else "Unassigned Staff"
            driver_phone = amb.driver.phone_number if amb.driver else "N/A"
            driver_id = amb.driver.id if amb.driver else None

            match_item = NearbyAmbulanceMatch(
                ambulance_id=amb.id,
                vehicle_number=amb.vehicle_number,
                vehicle_type=amb.vehicle_type,
                driver_id=driver_id,
                driver_name=driver_name,
                driver_phone=driver_phone,
                distance_km=dist,
                eta_minutes=eta,
                capabilities=amb.capabilities or "Basic medical gear",
                equipment_match_score=round(equip_score, 1),
                overall_rank_score=round(overall_rank_score, 2),
            )
            ranked_list.append(match_item)

        # Sort ascending by overall_rank_score (best ambulance first)
        ranked_list.sort(key=lambda x: x.overall_rank_score)
        return ranked_list
