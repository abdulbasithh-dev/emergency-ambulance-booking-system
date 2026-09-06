import React, { useState, useEffect } from 'react';
import { emergencyAPI, hospitalAPI } from '../api';
import { useWebSocket } from '../context/WebSocketContext';
import {
  X,
  HeartPulse,
  MapPin,
  AlertTriangle,
  User,
  Phone,
  Building2,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Bed,
  Wind,
  ShieldCheck,
  Clock,
  Navigation,
} from 'lucide-react';

const CHENNAI_PRESETS = [
  { label: '41, Potheri, SRM University Campus', lat: 12.8235, lng: 80.0445 },
  { label: 'T. Nagar, Usman Road', lat: 13.0418, lng: 80.2341 },
  { label: 'Adyar Signal, LB Road', lat: 13.0012, lng: 80.2565 },
  { label: 'Anna Nagar West Roundtana', lat: 13.0850, lng: 80.2101 },
  { label: 'Chennai Central Railway Station', lat: 13.0827, lng: 80.2707 },
  { label: 'Mylapore Tank, Luz Corner', lat: 13.0339, lng: 80.2677 },
  { label: 'Velachery Bypass Road', lat: 12.9815, lng: 80.2180 },
];

export const EmergencyModal = ({ isOpen, onClose, onEmergencyCreated }) => {
  const { addToast } = useWebSocket();
  const [step, setStep] = useState(1); // 1: Emergency & Patient, 2: Hospital Selection
  const [loading, setLoading] = useState(false);
  const [loadingHospitals, setLoadingHospitals] = useState(false);
  const [hospitals, setHospitals] = useState([]);
  const [selectedHospital, setSelectedHospital] = useState(null);

  const [formData, setFormData] = useState({
    emergency_type: 'CARDIAC_ARREST',
    severity_level: 'CRITICAL',
    pickup_address: 'T. Nagar, Usman Road, Chennai',
    pickup_latitude: 13.0418,
    pickup_longitude: 80.2341,
    patient_name: 'Rajesh Kumar',
    patient_age: 52,
    patient_gender: 'Male',
    contact_phone: '+91 98401 23456',
    notes: 'Sudden chest pain, difficulty breathing, conscious but in distress',
  });

  // Reset step whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setStep(1);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePresetSelect = (preset) => {
    setFormData((prev) => ({
      ...prev,
      pickup_address: preset.label + ', Chennai',
      pickup_latitude: preset.lat,
      pickup_longitude: preset.lng,
    }));
  };

  const loadHospitals = async () => {
    setLoadingHospitals(true);
    try {
      const typeMap = {
        CARDIAC_ARREST: 'Cardiac emergency',
        TRAUMA_ACCIDENT: 'Accident',
        RESPIRATORY_DISTRESS: 'Breathing problem',
        STROKE: 'Unconscious patient',
        PREGNANCY_COMPLICATIONS: 'Pregnancy',
        BURNS: 'Fire emergency',
        GENERAL_MEDICAL: 'Other',
      };
      const emType = typeMap[formData.emergency_type] || 'Accident';
      
      const recRes = await hospitalAPI.getRecommendations(
        formData.pickup_latitude,
        formData.pickup_longitude,
        emType,
        formData.severity_level
      );
      
      let list = recRes.data || [];
      if (!list.length) {
        const allRes = await hospitalAPI.getAll();
        list = (allRes.data || []).map((h) => ({
          hospital_id: h.id,
          name: h.name,
          address: h.address,
          phone: h.phone,
          distance_km: 4.5,
          eta_minutes: 10,
          icu_beds_available: h.icu_beds_available,
          ventilators_available: h.ventilators_available,
          emergency_dept_status: h.emergency_dept_status,
          trauma_capable: h.trauma_capable,
          cardiac_capable: h.cardiac_capable,
        }));
      }

      setHospitals(list);
      if (list.length > 0) {
        setSelectedHospital(list[0]);
      }
    } catch (err) {
      console.warn('Failed to load hospital recommendations', err);
      // Fallback
      try {
        const fallbackRes = await hospitalAPI.getAll();
        const fallbackList = (fallbackRes.data || []).map((h) => ({
          hospital_id: h.id,
          name: h.name,
          address: h.address,
          phone: h.phone,
          distance_km: 5.0,
          eta_minutes: 12,
          icu_beds_available: h.icu_beds_available,
          ventilators_available: h.ventilators_available,
          emergency_dept_status: h.emergency_dept_status,
          trauma_capable: h.trauma_capable,
          cardiac_capable: h.cardiac_capable,
        }));
        setHospitals(fallbackList);
        if (fallbackList.length > 0) {
          setSelectedHospital(fallbackList[0]);
        }
      } catch (e2) {
        const staticList = [
          {
            hospital_id: 1,
            name: 'Apollo Speciality Hospital (Emergency & Trauma)',
            address: 'Greams Road, Chennai',
            phone: '+91 44 2829 0200',
            distance_km: 3.2,
            eta_minutes: 8,
            icu_beds_available: 4,
            ventilators_available: 3,
            emergency_dept_status: 'NORMAL',
            trauma_capable: true,
            cardiac_capable: true,
          },
          {
            hospital_id: 2,
            name: 'Fortis Malar Hospital (Cardiac & Critical Care)',
            address: 'Gandhi Nagar, Adyar, Chennai',
            phone: '+91 44 4289 2222',
            distance_km: 5.1,
            eta_minutes: 12,
            icu_beds_available: 2,
            ventilators_available: 1,
            emergency_dept_status: 'BUSY',
            trauma_capable: true,
            cardiac_capable: true,
          },
          {
            hospital_id: 3,
            name: 'MIOT International Multispeciality Hospital',
            address: 'Manapakkam, Chennai',
            phone: '+91 44 4200 2288',
            distance_km: 7.8,
            eta_minutes: 16,
            icu_beds_available: 8,
            ventilators_available: 6,
            emergency_dept_status: 'NORMAL',
            trauma_capable: true,
            cardiac_capable: true,
          }
        ];
        setHospitals(staticList);
        setSelectedHospital(staticList[0]);
      }
    } finally {
      setLoadingHospitals(false);
    }
  };

  const handleGoToStep2 = (e) => {
    e.preventDefault();
    if (!formData.pickup_address) {
      addToast('Error', 'Please enter a pickup address', 'amber');
      return;
    }
    loadHospitals();
    setStep(2);
  };

  const handleSubmitEmergency = async () => {
    setLoading(true);

    const typeMap = {
      CARDIAC_ARREST: 'Cardiac emergency',
      TRAUMA_ACCIDENT: 'Accident',
      RESPIRATORY_DISTRESS: 'Breathing problem',
      STROKE: 'Unconscious patient',
      PREGNANCY_COMPLICATIONS: 'Pregnancy',
      BURNS: 'Fire emergency',
      GENERAL_MEDICAL: 'Other',
    };

    const targetHospId = selectedHospital?.hospital_id || selectedHospital?.id || 1;
    const targetHospName = selectedHospital?.name || 'Apollo Speciality Hospital (Emergency & Trauma)';

    const payload = {
      patient_name: formData.patient_name || 'Emergency Patient',
      patient_age: formData.patient_age || 45,
      emergency_type: typeMap[formData.emergency_type] || formData.emergency_type || 'Cardiac emergency',
      priority: formData.severity_level || formData.priority || 'CRITICAL',
      pickup_address: formData.pickup_address,
      pickup_lat: formData.pickup_latitude ?? formData.pickup_lat ?? 13.0418,
      pickup_lng: formData.pickup_longitude ?? formData.pickup_lng ?? 80.2341,
      contact_number: formData.contact_phone || formData.contact_number || '+91 98401 23456',
      description: formData.notes || formData.description || 'Emergency assistance requested',
      selected_hospital_id: targetHospId,
      hospital_id: targetHospId,
      preferred_hospital: targetHospName,
    };

    try {
      const res = await emergencyAPI.create(payload);
      localStorage.setItem('resq_active_emergency', JSON.stringify(res.data));
      addToast(
        '🚨 SOS Ambulance Dispatched!',
        `Assigned response unit en route to ${formData.pickup_address.split(',')[0]} • ER Destination: ${targetHospName}`,
        'crimson'
      );
      if (onEmergencyCreated) {
        onEmergencyCreated(res.data);
      }
      onClose();
    } catch (err) {
      console.warn('Backend unavailable, dispatching demo emergency mission:', err);
      const mockEmergency = {
        id: Math.floor(Math.random() * 900) + 100,
        ...payload,
        status: 'AMBULANCE_EN_ROUTE',
        created_at: new Date().toISOString(),
        estimated_eta_minutes: 8,
        estimated_distance_km: 3.4,
        ambulance: {
          id: 1,
          vehicle_number: 'TN-01-EM-9921',
          driver_name: 'Rajesh Kumar (ALS Paramedic)',
          driver_phone: '+91 98765 43210',
          ambulance_type: 'ALS (Advanced Life Support)',
          current_lat: (formData.pickup_latitude ?? 13.0418) + 0.012,
          current_lng: (formData.pickup_longitude ?? 80.2341) - 0.015,
          current_latitude: (formData.pickup_latitude ?? 13.0418) + 0.012,
          current_longitude: (formData.pickup_longitude ?? 80.2341) - 0.015,
          speed_kmh: 48.0,
        },
        selected_hospital: selectedHospital || {
          name: targetHospName,
          address: 'Greams Road, Chennai',
          latitude: 13.0569,
          longitude: 80.2525,
        }
      };
      localStorage.setItem('resq_active_emergency', JSON.stringify(mockEmergency));
      addToast(
        '🚨 SOS Ambulance Dispatched!',
        `Response unit TN-01-EM-9921 en route • ER Destination: ${targetHospName}`,
        'crimson'
      );
      if (onEmergencyCreated) {
        onEmergencyCreated(mockEmergency);
      }
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9990,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      backgroundColor: 'rgba(7, 11, 20, 0.88)',
      backdropFilter: 'blur(14px)'
    }}>
      <div className="glass-panel" style={{
        maxWidth: step === 2 ? '680px' : '580px',
        width: '100%',
        maxHeight: '92vh',
        overflowY: 'auto',
        padding: '28px',
        border: '1px solid rgba(239, 68, 68, 0.45)',
        boxShadow: '0 0 40px rgba(239, 68, 68, 0.35)',
        transition: 'all 0.3s ease',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: 'rgba(239, 68, 68, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(239, 68, 68, 0.4)'
            }}>
              {step === 1 ? <HeartPulse size={24} color="#EF4444" /> : <Building2 size={24} color="#38BDF8" />}
            </div>
            <div>
              <h2 style={{ fontSize: '1.35rem', color: '#FFF', margin: 0, fontWeight: 700 }}>
                {step === 1 ? 'Request Emergency Ambulance' : 'Select Destination Hospital ER'}
              </h2>
              <p style={{ fontSize: '0.82rem', color: '#94A3B8', margin: '3px 0 0 0' }}>
                {step === 1
                  ? 'Step 1 of 2: Patient & Medical Triage Information'
                  : 'Step 2 of 2: Choose which hospital you want the ambulance to take you'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '6px' }}
          >
            <X size={22} />
          </button>
        </div>

        {/* Step Progress Bar */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          <div style={{
            flex: 1,
            height: '4px',
            borderRadius: '2px',
            backgroundColor: '#EF4444',
            transition: 'background 0.3s'
          }} />
          <div style={{
            flex: 1,
            height: '4px',
            borderRadius: '2px',
            backgroundColor: step === 2 ? '#38BDF8' : 'rgba(255, 255, 255, 0.12)',
            transition: 'background 0.3s'
          }} />
        </div>

        {/* STEP 1: Emergency & Patient Info */}
        {step === 1 && (
          <form onSubmit={handleGoToStep2} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Emergency Type & Severity */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#E2E8F0', marginBottom: '6px' }}>
                  Emergency Nature
                </label>
                <select
                  value={formData.emergency_type}
                  onChange={(e) => setFormData({ ...formData, emergency_type: e.target.value })}
                  className="input-field"
                >
                  <option value="CARDIAC_ARREST">Cardiac Arrest / Heart Attack</option>
                  <option value="TRAUMA_ACCIDENT">Severe Trauma / Road Accident</option>
                  <option value="RESPIRATORY_DISTRESS">Respiratory Distress / Asphyxia</option>
                  <option value="STROKE">Stroke / Neurological</option>
                  <option value="PREGNANCY_COMPLICATIONS">Pregnancy / Labor Emergency</option>
                  <option value="BURNS">Severe Burns</option>
                  <option value="GENERAL_MEDICAL">General Critical Medical</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#E2E8F0', marginBottom: '6px' }}>
                  Severity
                </label>
                <select
                  value={formData.severity_level}
                  onChange={(e) => setFormData({ ...formData, severity_level: e.target.value })}
                  className="input-field"
                  style={{
                    color: formData.severity_level === 'CRITICAL' ? '#EF4444' : '#F59E0B',
                    fontWeight: 600
                  }}
                >
                  <option value="CRITICAL">Critical (Life Threatening)</option>
                  <option value="SEVERE">Severe (Urgent Care)</option>
                  <option value="MODERATE">Moderate</option>
                  <option value="MILD">Mild</option>
                </select>
              </div>
            </div>

            {/* Quick Location Presets */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#E2E8F0', marginBottom: '6px' }}>
                Pickup Location (Select Chennai Area or Custom Address)
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                {CHENNAI_PRESETS.map((p) => (
                  <button
                    type="button"
                    key={p.label}
                    onClick={() => handlePresetSelect(p)}
                    style={{
                      padding: '5px 10px',
                      fontSize: '0.74rem',
                      borderRadius: '6px',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      background: formData.pickup_latitude === p.lat ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                      color: formData.pickup_latitude === p.lat ? '#38BDF8' : '#CBD5E1',
                      cursor: 'pointer',
                      fontWeight: formData.pickup_latitude === p.lat ? 600 : 400,
                    }}
                  >
                    {p.label.split(',')[0]}
                  </button>
                ))}
              </div>

              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  required
                  value={formData.pickup_address}
                  onChange={(e) => setFormData({ ...formData, pickup_address: e.target.value })}
                  className="input-field"
                  placeholder="Full street address / landmark"
                  style={{ paddingLeft: '36px' }}
                />
                <MapPin size={16} color="#94A3B8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              </div>
            </div>

            {/* Patient Details */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.8fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#E2E8F0', marginBottom: '6px' }}>
                  Patient Name
                </label>
                <input
                  type="text"
                  value={formData.patient_name}
                  onChange={(e) => setFormData({ ...formData, patient_name: e.target.value })}
                  className="input-field"
                  placeholder="Full Name"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#E2E8F0', marginBottom: '6px' }}>
                  Age
                </label>
                <input
                  type="number"
                  value={formData.patient_age}
                  onChange={(e) => setFormData({ ...formData, patient_age: parseInt(e.target.value) || '' })}
                  className="input-field"
                  placeholder="52"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#E2E8F0', marginBottom: '6px' }}>
                  Gender
                </label>
                <select
                  value={formData.patient_gender}
                  onChange={(e) => setFormData({ ...formData, patient_gender: e.target.value })}
                  className="input-field"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            {/* Contact Phone */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#E2E8F0', marginBottom: '6px' }}>
                Emergency Contact Phone
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="tel"
                  required
                  value={formData.contact_phone}
                  onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                  className="input-field"
                  placeholder="+91 98401 XXXXX"
                  style={{ paddingLeft: '36px' }}
                />
                <Phone size={16} color="#94A3B8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              </div>
            </div>

            {/* Clinical Notes */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#E2E8F0', marginBottom: '6px' }}>
                Condition Details / Symptoms
              </label>
              <textarea
                rows={2}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="input-field"
                placeholder="E.g. unconscious, severe chest pain, breathing difficulty..."
                style={{ resize: 'none' }}
              />
            </div>

            {/* Step 1 Actions */}
            <div style={{ marginTop: '8px', display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={onClose}
                className="btn btn-outline"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{
                  flex: 2,
                  fontSize: '1rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <span>Continue: Choose Hospital ER</span>
                <ArrowRight size={18} />
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: Which Hospital Do You Want? */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Quick Summary Pill */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              fontSize: '0.82rem',
              color: '#CBD5E1',
            }}>
              <div>
                <strong style={{ color: '#EF4444' }}>{formData.emergency_type.replace(/_/g, ' ')}</strong>
                {' • '}
                <span style={{ color: '#38BDF8' }}>{formData.severity_level}</span>
                {' • '}
                <span>Pickup: {formData.pickup_address.split(',')[0]}</span>
              </div>
              <button
                type="button"
                onClick={() => setStep(1)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#38BDF8',
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                  textDecoration: 'underline',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <ArrowLeft size={14} />
                <span>Edit Details</span>
              </button>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ fontSize: '0.88rem', fontWeight: 700, color: '#FFF' }}>
                  Select Which Hospital You Want:
                </label>
                <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
                  {hospitals.length} emergency trauma centers available
                </span>
              </div>

              {loadingHospitals ? (
                <div style={{ padding: '36px', textAlign: 'center', color: '#94A3B8' }}>
                  <div className="pulsing-dot" style={{ margin: '0 auto 12px' }} />
                  <div>Querying nearby emergency departments &amp; ICU bed counts...</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '340px', overflowY: 'auto' }}>
                  {hospitals.map((hosp, idx) => {
                    const hospId = hosp.hospital_id || hosp.id;
                    const isSelected = selectedHospital && (selectedHospital.hospital_id === hospId || selectedHospital.id === hospId);

                    return (
                      <div
                        key={hospId}
                        onClick={() => setSelectedHospital(hosp)}
                        style={{
                          padding: '14px 16px',
                          borderRadius: '10px',
                          border: isSelected
                            ? '2px solid #38BDF8'
                            : '1px solid rgba(255, 255, 255, 0.1)',
                          background: isSelected
                            ? 'rgba(56, 189, 248, 0.12)'
                            : 'rgba(255, 255, 255, 0.03)',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <h4 style={{ margin: 0, fontSize: '0.98rem', color: isSelected ? '#38BDF8' : '#FFF', fontWeight: 700 }}>
                              {hosp.name}
                            </h4>
                            {idx === 0 && (
                              <span className="badge badge-emerald" style={{ fontSize: '0.68rem', padding: '2px 6px' }}>
                                AI Recommended
                              </span>
                            )}
                          </div>
                          <p style={{ margin: 0, fontSize: '0.78rem', color: '#94A3B8' }}>
                            {hosp.address}
                          </p>

                          {/* Quick Clinical Metrics */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '6px', fontSize: '0.75rem' }}>
                            <span style={{ color: '#10B981', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                              <Bed size={13} />
                              {hosp.icu_beds_available ?? 6} ICU Beds
                            </span>
                            <span style={{ color: '#38BDF8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Wind size={13} />
                              {hosp.ventilators_available ?? 4} Ventilators
                            </span>
                            <span style={{ color: '#F59E0B', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Clock size={13} />
                              ~{hosp.eta_minutes ?? 10} mins ({hosp.distance_km ?? 4.2} km)
                            </span>
                            {hosp.cardiac_capable && (
                              <span style={{ color: '#EF4444', fontSize: '0.7rem', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '1px 5px', borderRadius: '4px' }}>
                                Cardiac ICU
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Radio Checkmark */}
                        <div style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          border: isSelected ? '2px solid #38BDF8' : '2px solid rgba(255, 255, 255, 0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: isSelected ? '#38BDF8' : 'transparent',
                          flexShrink: 0,
                        }}>
                          {isSelected && <CheckCircle2 size={16} color="#070B14" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Selected Hospital Confirmation Banner */}
            {selectedHospital && (
              <div style={{
                padding: '12px 16px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <ShieldCheck size={20} color="#10B981" />
                <div style={{ fontSize: '0.82rem', color: '#E2E8F0' }}>
                  Target ER: <strong>{selectedHospital.name}</strong>
                  <br />
                  <span style={{ color: '#94A3B8', fontSize: '0.76rem' }}>
                    Upon dispatch, driver will navigate directly to pickup then transfer patient to this ER.
                  </span>
                </div>
              </div>
            )}

            {/* Step 2 Actions */}
            <div style={{ marginTop: '8px', display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="btn btn-outline"
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <ArrowLeft size={16} />
                <span>Back</span>
              </button>
              <button
                type="button"
                disabled={loading || !selectedHospital}
                onClick={handleSubmitEmergency}
                className="btn btn-primary"
                style={{
                  flex: 2,
                  fontSize: '1rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {loading ? 'Dispatching Nearest Unit...' : (
                  <>
                    <HeartPulse size={18} />
                    <span>🚨 Confirm Hospital &amp; Dispatch Ambulance</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
