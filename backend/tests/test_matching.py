import pytest
from app.services.matching_service import haversine_distance, calculate_eta_minutes, evaluate_equipment_score
from app.models.enums import AmbulanceType, EmergencyType

def test_haversine_distance_accuracy():
    # Distance between two known points in Chennai (approx ~4.1 km)
    # Sholinganallur: 12.9010, 80.2279
    # Thoraipakkam: 12.9372, 80.2366
    dist = haversine_distance(12.9010, 80.2279, 12.9372, 80.2366)
    assert 3.8 <= dist <= 4.4

def test_eta_calculation():
    # 5 km distance should take around 9-10 mins with urban buffer
    eta = calculate_eta_minutes(5.0, speed_kmh=38.0)
    assert 8.0 <= eta <= 12.0

def test_equipment_scoring_cardiac():
    # ALS with Defibrillator and ECG for cardiac emergency should give 100%
    caps = "Defibrillator,ECG,Oxygen,Ventilator"
    score = evaluate_equipment_score(caps, AmbulanceType.ALS, EmergencyType.CARDIAC)
    assert score >= 95.0

    # BLS without defibrillator should score noticeably lower
    score_bls = evaluate_equipment_score("Oxygen,Stretcher", AmbulanceType.BLS, EmergencyType.CARDIAC)
    assert score_bls < 85.0
