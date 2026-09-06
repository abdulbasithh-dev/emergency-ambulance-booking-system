from typing import List, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.hospital import Hospital
from app.models.enums import HospitalDeptStatus, EmergencyType
from app.schemas.hospital import HospitalRecommendation
from app.services.matching_service import haversine_distance, calculate_eta_minutes

class HospitalRecommendationService:
    @staticmethod
    async def get_recommendations(
        db: AsyncSession,
        pickup_lat: float,
        pickup_lng: float,
        emergency_type: EmergencyType = EmergencyType.ACCIDENT,
        exclude_hospital_ids: List[int] = None,
    ) -> List[HospitalRecommendation]:
        if exclude_hospital_ids is None:
            exclude_hospital_ids = []

        stmt = select(Hospital)
        result = await db.execute(stmt)
        hospitals = result.scalars().all()

        recommendations: List[HospitalRecommendation] = []

        for hosp in hospitals:
            if hosp.id in exclude_hospital_ids:
                continue

            dist = haversine_distance(pickup_lat, pickup_lng, hosp.latitude, hosp.longitude)
            eta = calculate_eta_minutes(dist)

            # 1. Capability Score (0 to 35)
            capability_score = 10.0
            capability_badges = []
            match_reasons = []

            if emergency_type == EmergencyType.CARDIAC:
                if hosp.cardiac_capable:
                    capability_score += 20.0
                    capability_badges.append("Cardiac Center")
                    match_reasons.append("Dedicated 24/7 Cardiac Cath Lab & Stent Facility")
                if hosp.icu_beds_available > 0:
                    capability_score += 5.0
            elif emergency_type in [EmergencyType.ACCIDENT, EmergencyType.INJURY, EmergencyType.FIRE]:
                if hosp.trauma_capable:
                    capability_score += 20.0
                    capability_badges.append("Trauma Unit")
                    match_reasons.append("Level-1 Advanced Trauma & Emergency Surgical Team")
                if hosp.general_beds_available > 0:
                    capability_score += 5.0
            elif emergency_type == EmergencyType.BREATHING:
                if hosp.ventilators_available > 0:
                    capability_score += 20.0
                    capability_badges.append(f"{hosp.ventilators_available} Ventilators")
                    match_reasons.append(f"Critical Respiratory Care with {hosp.ventilators_available} ventilators available")
                else:
                    capability_score += 5.0
            elif emergency_type == EmergencyType.PREGNANCY:
                if hosp.maternity_capable:
                    capability_score += 25.0
                    capability_badges.append("Maternity / OB-GYN")
                    match_reasons.append("Equipped for high-risk obstetric emergencies")
            else:
                capability_score += 15.0
                capability_badges.append("Emergency Care")

            # 2. Capacity & Availability Score (0 to 35)
            capacity_score = 0.0
            if hosp.emergency_dept_status == HospitalDeptStatus.AVAILABLE:
                capacity_score += 20.0
                match_reasons.append("Emergency Department is accepting immediate intake")
            elif hosp.emergency_dept_status == HospitalDeptStatus.BUSY:
                capacity_score += 10.0
                match_reasons.append("Emergency Department under elevated load")
            else:
                capacity_score += 0.0
                match_reasons.append("Emergency Department near full capacity")

            # Bed ratios
            icu_ratio = hosp.icu_beds_available / max(1, hosp.icu_beds_total)
            capacity_score += min(10.0, icu_ratio * 10.0)
            if hosp.icu_beds_available > 0:
                capability_badges.append(f"{hosp.icu_beds_available} ICU Beds")

            gen_ratio = hosp.general_beds_available / max(1, hosp.general_beds_total)
            capacity_score += min(5.0, gen_ratio * 5.0)

            # 3. Proximity Score (0 to 30)
            proximity_score = max(5.0, 30.0 - (dist * 1.6))
            if dist <= 5.0:
                match_reasons.append(f"Rapid proximity: {dist:.1f} km away (ETA ~{eta:.0f} mins)")
            else:
                match_reasons.append(f"Distance: {dist:.1f} km (ETA ~{eta:.0f} mins)")

            total_raw = capability_score + capacity_score + proximity_score
            # Clamp between 45% and 98%
            match_pct = int(min(98, max(45, total_raw)))

            recommendations.append(
                HospitalRecommendation(
                    hospital_id=hosp.id,
                    name=hosp.name,
                    address=hosp.address,
                    phone=hosp.phone,
                    latitude=hosp.latitude,
                    longitude=hosp.longitude,
                    distance_km=dist,
                    eta_minutes=eta,
                    emergency_dept_status=hosp.emergency_dept_status,
                    icu_beds_available=hosp.icu_beds_available,
                    general_beds_available=hosp.general_beds_available,
                    ventilators_available=hosp.ventilators_available,
                    match_percentage=match_pct,
                    is_best_match=False, # Set after sorting
                    capability_badges=capability_badges,
                    match_reasons=match_reasons,
                )
            )

        # Sort descending by match percentage
        recommendations.sort(key=lambda x: x.match_percentage, reverse=True)
        if recommendations:
            recommendations[0].is_best_match = True

        return recommendations
