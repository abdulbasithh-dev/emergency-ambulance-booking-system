import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../context/WebSocketContext';
import { emergencyAPI, ambulanceAPI, hospitalAPI } from '../api';
import { LiveMap } from '../components/LiveMap';
import {
  Truck,
  CheckCircle,
  XCircle,
  Navigation,
  MapPin,
  Building2,
  AlertTriangle,
  Play,
  RotateCw,
  Clock,
  Phone,
  Radio,
  UserCheck,
} from 'lucide-react';

const DEFAULT_DEMO_AMBULANCE = {
  id: 1,
  vehicle_number: 'TN-01-EM-9921',
  ambulance_type: 'ALS (Advanced Life Support)',
  status: 'AVAILABLE',
  availability_status: 'AVAILABLE',
  current_lat: 13.0450,
  current_lng: 80.2310,
  current_latitude: 13.0450,
  current_longitude: 80.2310,
  speed_kmh: 0,
  driver_name: 'Rajesh Kumar (ALS Paramedic)',
  driver_phone: '+91 98765 43210',
};

const DEFAULT_DEMO_EMERGENCY = {
  id: 101,
  emergency_type: 'CARDIAC_ARREST',
  priority: 'CRITICAL',
  severity: 'CRITICAL',
  status: 'EN_ROUTE_TO_PICKUP',
  pickup_address: 'T. Nagar, Usman Road, Chennai',
  pickup_lat: 13.0418,
  pickup_lng: 80.2341,
  pickup_latitude: 13.0418,
  pickup_longitude: 80.2341,
  patient_name: 'Rajesh Kumar',
  patient_age: 52,
  patient_gender: 'Male',
  contact_phone: '+91 98401 23456',
  description: 'Sudden chest pain, difficulty breathing, conscious but in distress',
  assigned_ambulance_id: 1,
  selected_hospital: {
    id: 1,
    name: 'Apollo Speciality Hospital (Emergency & Trauma)',
    address: 'Greams Road, Chennai',
    latitude: 13.0569,
    longitude: 80.2525,
    icu_beds_available: 4,
    emergency_department_status: 'NORMAL',
  }
};

const FALLBACK_HOSPITALS = [
  { id: 1, name: 'Apollo Speciality Hospital (Emergency & Trauma)' },
  { id: 2, name: 'Fortis Malar Hospital (Cardiac & Critical Care)' },
  { id: 3, name: 'MIOT International Multispeciality Hospital' },
];

export const DriverDashboard = () => {
  const { user } = useAuth();
  const { subscribe, addToast } = useWebSocket();
  const [ambulance, setAmbulance] = useState(DEFAULT_DEMO_AMBULANCE);
  const [activeEmergency, setActiveEmergency] = useState(DEFAULT_DEMO_EMERGENCY);
  const [hospitals, setHospitals] = useState(FALLBACK_HOSPITALS);
  const [loading, setLoading] = useState(false);
  const [pickupModalOpen, setPickupModalOpen] = useState(false);

  // Hospital Change Request state
  const [diversionModalOpen, setDiversionModalOpen] = useState(false);
  const [targetHospitalId, setTargetHospitalId] = useState('1');
  const [diversionReason, setDiversionReason] = useState('');
  const [diversionStatus, setDiversionStatus] = useState(null);

  const fetchDriverData = useCallback(async () => {
    try {
      // Find driver's ambulance
      const ambRes = await ambulanceAPI.getAll();
      if (ambRes.data && ambRes.data.length > 0) {
        const myAmb = ambRes.data.find((a) => a.driver_id === user?.id) || ambRes.data[0];
        setAmbulance(myAmb);
      }

      // Check for active assigned emergency
      try {
        const emRes = await emergencyAPI.getActive();
        if (emRes.data) {
          setActiveEmergency(emRes.data);
        } else {
          const saved = localStorage.getItem('resq_active_emergency');
          if (saved) {
            try { setActiveEmergency(JSON.parse(saved)); } catch {}
          }
        }
      } catch (e) {
        const saved = localStorage.getItem('resq_active_emergency');
        if (saved) {
          try { setActiveEmergency(JSON.parse(saved)); } catch {}
        }
      }

      // Fetch hospitals
      const hospRes = await hospitalAPI.getAll();
      if (hospRes.data && hospRes.data.length > 0) {
        setHospitals(hospRes.data);
        setTargetHospitalId(hospRes.data[0].id);
      }
    } catch (err) {
      console.warn('Driver data API unavailable, active in demo mode');
      setAmbulance((prev) => prev || DEFAULT_DEMO_AMBULANCE);
      try {
        const saved = localStorage.getItem('resq_active_emergency');
        if (saved) {
          setActiveEmergency(JSON.parse(saved));
        } else {
          setActiveEmergency((prev) => prev || DEFAULT_DEMO_EMERGENCY);
        }
      } catch {
        setActiveEmergency((prev) => prev || DEFAULT_DEMO_EMERGENCY);
      }
      setHospitals(FALLBACK_HOSPITALS);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDriverData();

    // Periodic polling to ensure driver never misses dispatch offers
    const pollInterval = setInterval(() => {
      fetchDriverData();
    }, 3500);

    const handleCustomEmergencyUpdate = (e) => {
      if (e.detail) {
        setActiveEmergency(e.detail);
      } else {
        fetchDriverData();
      }
    };
    window.addEventListener('resq-emergency-updated', handleCustomEmergencyUpdate);

    const unsubscribe = subscribe((msg) => {
      if (msg.event === 'DISPATCH_REQUEST' || msg.event === 'NEW_DISPATCH_OFFER') {
        const payload = msg.data || {};
        const normalized = {
          ...payload,
          id: payload.id || payload.emergency_id,
          emergency_id: payload.emergency_id || payload.id,
          assigned_ambulance_id: payload.assigned_ambulance_id || payload.ambulance_id,
        };
        setActiveEmergency(normalized);
        addToast('🚨 EMERGENCY DISPATCH ASSIGNED', `Pickup at: ${payload.pickup_address || 'Patient Location'}`, 'crimson');
        fetchDriverData();
      } else if (msg.event === 'STATUS_CHANGE' || msg.event === 'EMERGENCY_STATUS_UPDATED') {
        setActiveEmergency((prev) => (prev ? { ...prev, status: msg.data.status } : null));
        fetchDriverData();
      } else if (msg.event === 'LOCATION_UPDATE' || msg.event === 'AMBULANCE_LOCATION_UPDATE') {
        setAmbulance((prev) => prev ? {
          ...prev,
          current_latitude: msg.data.latitude,
          current_longitude: msg.data.longitude,
          current_lat: msg.data.latitude,
          current_lng: msg.data.longitude,
          speed_kmh: msg.data.speed,
        } : null);
      } else if (msg.event === 'HOSPITAL_CHANGE_REVIEWED') {
        setDiversionStatus(msg.data.status);
        addToast('Hospital Change Update', `Dispatcher ${msg.data.status} your request`, msg.data.status === 'APPROVED' ? 'emerald' : 'amber');
        fetchDriverData();
      } else if (msg.event === 'SIMULATION_STARTED' || msg.event === 'SIMULATION_ENDED') {
        fetchDriverData();
      }
    });

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('resq-emergency-updated', handleCustomEmergencyUpdate);
      unsubscribe();
    };
  }, [fetchDriverData, subscribe, addToast]);

  const handleToggleDuty = async () => {
    if (!ambulance) return;
    if (activeEmergency) {
      addToast(
        'Active Mission In Progress',
        'Cannot go off-duty while an emergency mission is active. Complete patient handover first.',
        'crimson'
      );
      return;
    }
    const currentStatus = ambulance.availability_status || ambulance.status || 'AVAILABLE';
    const newStatus = currentStatus === 'AVAILABLE' ? 'OFF_DUTY' : 'AVAILABLE';
    try {
      await ambulanceAPI.updateStatus(ambulance.id, newStatus);
      setAmbulance((prev) => ({
        ...prev,
        status: newStatus,
        availability_status: newStatus,
      }));
      addToast('Duty Status Updated', `You are now ${newStatus.replace('_', ' ')}`, 'emerald');
      fetchDriverData();
    } catch (err) {
      setAmbulance((prev) => ({
        ...prev,
        status: newStatus,
        availability_status: newStatus,
      }));
      addToast('Duty Status Updated', `You are now ${newStatus.replace('_', ' ')}`, 'emerald');
    }
  };

  const handleAcceptEmergency = async () => {
    if (!activeEmergency) return;
    try {
      if (ambulance) {
        await ambulanceAPI.updateStatus(ambulance.id, 'DISPATCHED').catch(() => {});
      }
    } catch {}
    await handleAdvanceStatus('EN_ROUTE_TO_PICKUP');
    addToast('Ambulance Accepted', 'Your ambulance is on the way.', 'emerald');
    window.dispatchEvent(new CustomEvent('resq-toast-broadcast', {
      detail: {
        title: 'Ambulance Accepted',
        message: 'Your ambulance is on the way.',
        type: 'emerald'
      }
    }));
  };

  const handleConfirmPickup = async () => {
    setPickupModalOpen(false);
    await handleAdvanceStatus('IN_TRANSIT_TO_HOSPITAL');
    const destHosp = (activeEmergency?.selected_hospital || activeEmergency?.destination_hospital)?.name || 'Citizen-Selected Hospital';
    addToast(
      'Patient Picked Up',
      `Proceeding to ${destHosp}`,
      'emerald'
    );
    window.dispatchEvent(new CustomEvent('resq-toast-broadcast', {
      detail: {
        title: 'Patient Picked Up',
        message: `Ambulance is transporting patient to ${destHosp}`,
        type: 'cyan'
      }
    }));
  };

  const handleAdvanceStatus = async (nextStatus) => {
    if (!activeEmergency) return;
    const destHosp = activeEmergency.selected_hospital || activeEmergency.destination_hospital;
    const updated = {
      ...activeEmergency,
      status: nextStatus,
      patient_status: nextStatus === 'IN_TRANSIT_TO_HOSPITAL' || nextStatus === 'PATIENT_ONBOARD' ? 'PICKED_UP' : activeEmergency.patient_status,
      selected_hospital: destHosp || activeEmergency.selected_hospital,
    };

    if (nextStatus === 'EN_ROUTE_TO_PICKUP' || nextStatus === 'AMBULANCE_EN_ROUTE') {
      window.dispatchEvent(new CustomEvent('resq-toast-broadcast', {
        detail: {
          title: 'Ambulance Accepted',
          message: 'Your ambulance is on the way.',
          type: 'emerald'
        }
      }));
    }

    try {
      await emergencyAPI.updateStatus(activeEmergency.id, nextStatus, `Status advanced by driver ${user?.full_name}`);

      // Auto-update GPS location when driver arrives at scene or at hospital
      if (nextStatus === 'ARRIVED_AT_PICKUP' || nextStatus === 'ARRIVED_AT_SCENE') {
        const pLat = activeEmergency.pickup_lat ?? activeEmergency.pickup_latitude;
        const pLng = activeEmergency.pickup_lng ?? activeEmergency.pickup_longitude;
        if (pLat && pLng) {
          try {
            await emergencyAPI.updateLocation(activeEmergency.id, pLat, pLng, 0.0, 0.0);
          } catch (locErr) {
            console.warn('Auto GPS sync on scene arrival failed', locErr);
          }
          if (ambulance) {
            setAmbulance((prev) => ({
              ...prev,
              current_lat: pLat,
              current_lng: pLng,
              current_latitude: pLat,
              current_longitude: pLng,
              speed_kmh: 0,
            }));
          }
        }
      } else if (nextStatus === 'ARRIVED_AT_HOSPITAL') {
        const hosp = activeEmergency.selected_hospital || activeEmergency.destination_hospital;
        if (hosp?.latitude && hosp?.longitude) {
          try {
            await emergencyAPI.updateLocation(activeEmergency.id, hosp.latitude, hosp.longitude, 0.0, 0.0);
          } catch (locErr) {
            console.warn('Auto GPS sync at hospital failed', locErr);
          }
          if (ambulance) {
            setAmbulance((prev) => ({
              ...prev,
              current_lat: hosp.latitude,
              current_lng: hosp.longitude,
              current_latitude: hosp.latitude,
              current_longitude: hosp.longitude,
              speed_kmh: 0,
            }));
          }
        }
      }

      if (nextStatus === 'CASE_COMPLETED' || nextStatus === 'HANDOVER_COMPLETE') {
        localStorage.removeItem('resq_active_emergency');
        setActiveEmergency(null);
        window.dispatchEvent(new CustomEvent('resq-emergency-updated', { detail: null }));
        addToast('Mission Completed', 'Patient handover completed successfully. Vehicle returned to available fleet.', 'emerald');
        fetchDriverData();
      } else {
        localStorage.setItem('resq_active_emergency', JSON.stringify(updated));
        setActiveEmergency(updated);
        window.dispatchEvent(new CustomEvent('resq-emergency-updated', { detail: updated }));
        addToast('Mission Updated', `Status changed to: ${nextStatus.replace(/_/g, ' ')}`, 'emerald');
      }
    } catch (err) {
      if (nextStatus === 'CASE_COMPLETED' || nextStatus === 'HANDOVER_COMPLETE') {
        localStorage.removeItem('resq_active_emergency');
        setActiveEmergency(null);
        window.dispatchEvent(new CustomEvent('resq-emergency-updated', { detail: null }));
        addToast('Mission Completed', 'Patient handover completed successfully.', 'emerald');
      } else {
        localStorage.setItem('resq_active_emergency', JSON.stringify(updated));
        setActiveEmergency(updated);
        window.dispatchEvent(new CustomEvent('resq-emergency-updated', { detail: updated }));
        addToast('Mission Updated', `Status advanced to: ${nextStatus.replace(/_/g, ' ')}`, 'emerald');
      }
    }
  };

  const handleSimulateStep = async () => {
    if (!ambulance || !activeEmergency) return;
    const curLat = ambulance.current_lat ?? ambulance.current_latitude ?? 13.0827;
    const curLng = ambulance.current_lng ?? ambulance.current_longitude ?? 80.2707;
    const destHosp = activeEmergency.selected_hospital || activeEmergency.destination_hospital;
    const targetLat = activeEmergency.status.includes('TRANSIT') || activeEmergency.status.includes('HOSPITAL')
      ? (destHosp?.latitude || 13.0827)
      : (activeEmergency.pickup_lat ?? activeEmergency.pickup_latitude ?? 13.0827);
    const targetLng = activeEmergency.status.includes('TRANSIT') || activeEmergency.status.includes('HOSPITAL')
      ? (destHosp?.longitude || 80.2707)
      : (activeEmergency.pickup_lng ?? activeEmergency.pickup_longitude ?? 80.2707);

    const newLat = curLat + (targetLat - curLat) * 0.25;
    const newLng = curLng + (targetLng - curLng) * 0.25;

    try {
      await emergencyAPI.updateLocation(activeEmergency.id, newLat, newLng, 48.0, 90.0);
      setAmbulance({
        ...ambulance,
        current_lat: newLat,
        current_lng: newLng,
        current_latitude: newLat,
        current_longitude: newLng,
        speed_kmh: 48.0,
      });
      addToast('GPS Updated', `Coordinates: ${newLat.toFixed(4)}, ${newLng.toFixed(4)}`, 'cyan');
    } catch (err) {
      setAmbulance((prev) => ({
        ...prev,
        current_lat: newLat,
        current_lng: newLng,
        current_latitude: newLat,
        current_longitude: newLng,
        speed_kmh: 48.0,
      }));
      addToast('GPS Telemetry Simulated', `Coordinates: ${newLat.toFixed(4)}, ${newLng.toFixed(4)}`, 'cyan');
    }
  };

  const handleRequestHospitalChange = async (e) => {
    e.preventDefault();
    if (!activeEmergency || !targetHospitalId) return;
    try {
      await emergencyAPI.requestHospitalChange(activeEmergency.id, targetHospitalId, diversionReason);
      addToast('Request Sent', 'Hospital diversion requested. Awaiting dispatcher review.', 'cyan');
      setDiversionModalOpen(false);
      setDiversionReason('');
      setDiversionStatus('PENDING');
    } catch (err) {
      addToast('Diversion Transmitted', 'Hospital diversion requested (Demo Mode).', 'cyan');
      setDiversionModalOpen(false);
      setDiversionReason('');
      setDiversionStatus('PENDING');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: '#94A3B8' }}>
        <div className="pulsing-dot" style={{ marginBottom: '16px' }} />
        <div>Loading Ambulance Driver Cockpit...</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Driver Cockpit Status Bar */}
      <div className="glass-panel" style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '10px',
            background: 'rgba(245, 158, 11, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(245, 158, 11, 0.3)'
          }}>
            <Truck size={24} color="#F59E0B" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ fontSize: '1.25rem', color: '#FFF', margin: 0 }}>
                {ambulance?.vehicle_number || 'Vehicle TN-01-EM-2024'}
              </h2>
              <span className={`badge ${
                (ambulance?.availability_status || ambulance?.status) === 'AVAILABLE'
                  ? 'badge-emerald'
                  : (ambulance?.availability_status || ambulance?.status) === 'OFF_DUTY' || (ambulance?.availability_status || ambulance?.status) === 'OFFLINE'
                  ? 'badge-amber'
                  : 'badge-crimson'
              }`}>
                {ambulance?.availability_status || ambulance?.status || 'ONLINE'}
              </span>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#94A3B8', marginTop: '2px' }}>
              Driver: <strong>{user?.full_name}</strong> &bull; {ambulance?.ambulance_type || 'ADVANCED_LIFE_SUPPORT'}
            </div>
          </div>
        </div>

        {/* Duty Toggle & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={handleToggleDuty}
            disabled={!!activeEmergency}
            title={activeEmergency ? "Cannot toggle duty while on an active emergency mission" : "Toggle Duty Status"}
            className={`btn btn-sm ${
              (ambulance?.availability_status || ambulance?.status) === 'AVAILABLE'
                ? 'btn-outline'
                : 'btn-emerald'
            }`}
            style={{
              opacity: activeEmergency ? 0.65 : 1,
              cursor: activeEmergency ? 'not-allowed' : 'pointer',
            }}
          >
            <Radio size={14} />
            <span>
              {activeEmergency
                ? 'Mission In Progress (Locked)'
                : (ambulance?.availability_status || ambulance?.status) === 'AVAILABLE'
                ? 'Go Off-Duty'
                : 'Go Online (Available)'}
            </span>
          </button>
        </div>
      </div>

      {/* Active Mission Alert / HUD */}
      {activeEmergency ? (
        <div className="glass-panel-glow" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span className="pulsing-dot" />
              <div>
                <span className="badge badge-crimson" style={{ marginRight: '8px' }}>
                  ACTIVE EMERGENCY MISSION
                </span>
                <span style={{ fontSize: '1.2rem', fontWeight: 700, color: '#FFF' }}>
                  {activeEmergency.emergency_type.replace(/_/g, ' ')}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setDiversionModalOpen(true)}
                className="btn btn-sm btn-outline"
                style={{ borderColor: 'rgba(245, 158, 11, 0.4)', color: '#F59E0B' }}
              >
                <Building2 size={14} />
                <span>Request Hospital Diversion</span>
              </button>

              <button
                onClick={handleSimulateStep}
                className="btn btn-sm btn-cyan"
                title="Simulate vehicle moving forward towards waypoint"
              >
                <Navigation size={14} />
                <span>Simulate GPS Move (+25%)</span>
              </button>
            </div>
          </div>

          {/* Mission Details Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            <div style={{ padding: '16px', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.75rem', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MapPin size={14} color="#EF4444" />
                <span>PATIENT PICKUP LOCATION</span>
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#FFF', marginTop: '4px' }}>
                {activeEmergency.pickup_address}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#CBD5E1', marginTop: '6px' }}>
                Patient: <strong>{activeEmergency.patient_name || 'Emergency Patient'}</strong> ({activeEmergency.patient_age || 45}y)
                <br />
                Contact: <a href={`tel:${activeEmergency.contact_number || activeEmergency.contact_phone || '911'}`} style={{ color: '#38BDF8' }}>{activeEmergency.contact_number || activeEmergency.contact_phone || 'N/A'}</a>
              </div>
            </div>

            <div style={{ padding: '16px', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.75rem', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Building2 size={14} color="#38BDF8" />
                <span>DESTINATION HOSPITAL ER</span>
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#FFF', marginTop: '4px' }}>
                {(activeEmergency.selected_hospital || activeEmergency.destination_hospital)?.name || 'Triage Assigned En Route'}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#CBD5E1', marginTop: '6px' }}>
                {(activeEmergency.selected_hospital || activeEmergency.destination_hospital)?.address || 'Chennai Central Zone'}
                <br />
                ICU Available: <strong style={{ color: '#10B981' }}>{(activeEmergency.selected_hospital || activeEmergency.destination_hospital)?.icu_beds_available || 4} Beds</strong>
              </div>
            </div>
          </div>

          {/* Incoming Emergency Alert Notification */}
          {(!activeEmergency.status || activeEmergency.status === 'PENDING' || activeEmergency.status === 'REQUESTED' || activeEmergency.status === 'SEARCHING_AMBULANCE' || activeEmergency.status === 'ASSIGNED') && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.22) 0%, rgba(245, 158, 11, 0.18) 100%)',
              border: '2px solid #EF4444',
              borderRadius: '12px',
              padding: '18px 22px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px',
              boxShadow: '0 0 30px rgba(239, 68, 68, 0.35)',
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="pulsing-dot" style={{ background: '#EF4444', width: '12px', height: '12px' }} />
                  <span style={{ color: '#FCA5A5', fontWeight: 800, fontSize: '0.92rem', letterSpacing: '0.05em' }}>
                    🚨 INCOMING EMERGENCY REQUEST
                  </span>
                </div>
                <div style={{ color: '#FFF', fontSize: '1.1rem', fontWeight: 800, marginTop: '4px' }}>
                  Closest Available Unit Prioritized &bull; Tap to Accept Emergency
                </div>
                <div style={{ color: '#CBD5E1', fontSize: '0.85rem', marginTop: '2px' }}>
                  Citizen Destination: <strong style={{ color: '#38BDF8' }}>{(activeEmergency.selected_hospital || activeEmergency.destination_hospital)?.name || 'Citizen Selected Hospital'}</strong>
                </div>
              </div>
              <button
                type="button"
                onClick={handleAcceptEmergency}
                className="btn btn-lg btn-emerald"
                style={{ fontWeight: 800, padding: '12px 28px', fontSize: '1.05rem', boxShadow: '0 0 20px rgba(16, 185, 129, 0.6)' }}
              >
                <UserCheck size={20} />
                <span>ACCEPT EMERGENCY</span>
              </button>
            </div>
          )}

          {/* Stepper One-Tap Quick Actions */}
          <div style={{ background: 'rgba(7, 11, 20, 0.6)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.8rem', color: '#94A3B8', marginBottom: '12px', fontWeight: 600 }}>
              MISSION STAGE CONTROL (Current: <span style={{ color: '#38BDF8' }}>{activeEmergency.status}</span>):
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              <button
                onClick={handleAcceptEmergency}
                className={`btn btn-sm ${
                  activeEmergency.status === 'EN_ROUTE_TO_PICKUP' || activeEmergency.status === 'AMBULANCE_EN_ROUTE'
                    ? 'btn-primary'
                    : 'btn-emerald'
                }`}
                style={{ fontWeight: 700 }}
              >
                1. Accept &amp; En Route to Patient
              </button>

              <button
                onClick={() => handleAdvanceStatus('ARRIVED_AT_PICKUP')}
                className={`btn btn-sm ${
                  activeEmergency.status === 'ARRIVED_AT_PICKUP' || activeEmergency.status === 'ARRIVED_AT_SCENE'
                    ? 'btn-primary'
                    : 'btn-outline'
                }`}
              >
                2. Arrived at Scene
              </button>

              <button
                onClick={() => setPickupModalOpen(true)}
                className={`btn btn-sm ${
                  activeEmergency.status === 'PATIENT_ONBOARD' || activeEmergency.status === 'IN_TRANSIT_TO_HOSPITAL'
                    ? 'btn-primary'
                    : (activeEmergency.status === 'ARRIVED_AT_SCENE' || activeEmergency.status === 'ARRIVED_AT_PICKUP' ? 'btn-emerald' : 'btn-outline')
                }`}
                style={{ fontWeight: 700 }}
              >
                <UserCheck size={14} />
                <span>3. Patient Picked Up</span>
              </button>

              <button
                onClick={() => handleAdvanceStatus('ARRIVED_AT_HOSPITAL')}
                className={`btn btn-sm ${activeEmergency.status === 'ARRIVED_AT_HOSPITAL' ? 'btn-primary' : 'btn-outline'}`}
              >
                4. Arrived at Hospital ER
              </button>

              <button
                onClick={() => handleAdvanceStatus('CASE_COMPLETED')}
                className="btn btn-sm btn-emerald"
              >
                <CheckCircle size={14} />
                <span>5. Complete Handover</span>
              </button>
            </div>
          </div>

          {/* Interactive Navigation Map */}
          <div style={{ height: '420px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
            <LiveMap
              emergency={activeEmergency}
              ambulances={ambulance ? [ambulance] : []}
              assignedAmbulance={ambulance}
              assignedHospital={activeEmergency.selected_hospital || activeEmergency.destination_hospital}
              hospitals={hospitals}
              zoom={14}
            />
          </div>
        </div>
      ) : (ambulance?.availability_status || ambulance?.status) === 'OFF_DUTY' || (ambulance?.availability_status || ambulance?.status) === 'OFFLINE' ? (
        <div className="glass-panel" style={{ padding: '60px 20px', textAlign: 'center' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(245, 158, 11, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            border: '2px solid rgba(245, 158, 11, 0.3)'
          }}>
            <Truck size={32} color="#F59E0B" />
          </div>
          <h3 style={{ fontSize: '1.4rem', color: '#FFF', marginBottom: '8px' }}>Driver Shift Off-Duty</h3>
          <p style={{ color: '#94A3B8', maxWidth: '480px', margin: '0 auto 20px' }}>
            You are currently marked <strong>OFF-DUTY</strong>. Emergency dispatches will not be routed to your unit while off-duty. Switch online to start receiving life-saving calls.
          </p>
          <button onClick={handleToggleDuty} className="btn btn-emerald" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <Radio size={16} />
            <span>Go Online (Available for Dispatch)</span>
          </button>
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: '60px 20px', textAlign: 'center' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(16, 185, 129, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            border: '2px solid rgba(16, 185, 129, 0.3)'
          }}>
            <Truck size={32} color="#10B981" />
          </div>
          <h3 style={{ fontSize: '1.4rem', color: '#FFF', marginBottom: '8px' }}>No Active Dispatches</h3>
          <p style={{ color: '#94A3B8', maxWidth: '460px', margin: '0 auto 20px' }}>
            You are online and stationed. As soon as a high-priority emergency is reported near your sector, you will receive an immediate siren alert.
          </p>
          <span className="badge badge-emerald">GPS TELEMETRY BROADCASTING</span>
        </div>
      )}

      {/* Patient Pickup Confirmation Modal */}
      {pickupModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(7, 11, 20, 0.85)',
          backdropFilter: 'blur(8px)',
          padding: '16px',
        }}>
          <div className="glass-panel" style={{ maxWidth: '460px', width: '100%', padding: '28px', textAlign: 'center', border: '2px solid #38BDF8' }}>
            <div style={{
              width: '54px',
              height: '54px',
              borderRadius: '50%',
              background: 'rgba(56, 189, 248, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              border: '2px solid rgba(56, 189, 248, 0.3)'
            }}>
              <UserCheck size={28} color="#38BDF8" />
            </div>
            <h3 style={{ color: '#FFF', fontSize: '1.3rem', marginBottom: '8px', fontWeight: 800 }}>
              Confirm Patient Pickup
            </h3>
            <p style={{ color: '#CBD5E1', fontSize: '0.95rem', marginBottom: '20px' }}>
              Have you picked up the patient?
            </p>
            <div style={{
              padding: '12px 14px',
              borderRadius: '8px',
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              marginBottom: '20px',
              fontSize: '0.84rem',
              color: '#94A3B8',
              textAlign: 'left'
            }}>
              <div>Citizen Selected Destination:</div>
              <div style={{ color: '#10B981', fontWeight: 700, fontSize: '0.92rem', marginTop: '2px' }}>
                {(activeEmergency?.selected_hospital || activeEmergency?.destination_hospital)?.name || 'Citizen Selected Hospital'}
              </div>
              <div style={{ fontSize: '0.76rem', color: '#64748B', marginTop: '4px' }}>
                Upon confirmation, ambulance navigates directly to this citizen-selected hospital ER.
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setPickupModalOpen(false)}
                className="btn btn-outline"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPickup}
                className="btn btn-emerald"
                style={{ flex: 1.5, fontWeight: 700 }}
              >
                Confirm Pickup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hospital Change Modal */}
      {diversionModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(7, 11, 20, 0.8)',
          backdropFilter: 'blur(8px)',
          padding: '16px',
        }}>
          <div className="glass-panel" style={{ maxWidth: '480px', width: '100%', padding: '24px' }}>
            <h3 style={{ color: '#FFF', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Building2 size={20} color="#F59E0B" />
              <span>Request Hospital Diversion</span>
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#94A3B8', marginBottom: '16px' }}>
              Submit an urgent rerouting request to the dispatch command center.
            </p>

            <form onSubmit={handleRequestHospitalChange} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#E2E8F0', marginBottom: '6px' }}>
                  Target Hospital
                </label>
                <select
                  value={targetHospitalId}
                  onChange={(e) => setTargetHospitalId(e.target.value)}
                  className="input-field"
                >
                  {hospitals.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} (ICU: {h.icu_beds_available} beds free)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#E2E8F0', marginBottom: '6px' }}>
                  Clinical Justification
                </label>
                <textarea
                  required
                  rows={3}
                  value={diversionReason}
                  onChange={(e) => setDiversionReason(e.target.value)}
                  className="input-field"
                  placeholder="E.g. Patient deteriorating rapidly, requires nearest emergency catheterization lab..."
                  style={{ resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setDiversionModalOpen(false)}
                  className="btn btn-outline"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1.5 }}>
                  Submit to Dispatcher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
