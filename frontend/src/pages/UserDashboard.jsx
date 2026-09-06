import React, { useState, useEffect, useCallback } from 'react';
import { emergencyAPI, hospitalAPI } from '../api';
import { useWebSocket } from '../context/WebSocketContext';
import { LiveMap } from '../components/LiveMap';
import {
  HeartPulse,
  Truck,
  Building2,
  Clock,
  Phone,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Navigation,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';

const STATUS_STEPS = [
  { key: 'PENDING', label: 'Triage Pending', matches: ['PENDING', 'REQUESTED', 'SEARCHING_AMBULANCE'] },
  { key: 'ASSIGNED', label: 'Ambulance Assigned', matches: ['ASSIGNED', 'AMBULANCE_ASSIGNED', 'DRIVER_ACCEPTED'] },
  { key: 'AMBULANCE_EN_ROUTE', label: 'En Route to You', matches: ['AMBULANCE_EN_ROUTE', 'EN_ROUTE_TO_PICKUP'] },
  { key: 'ARRIVED_AT_SCENE', label: 'On Scene', matches: ['ARRIVED_AT_SCENE', 'ARRIVED_AT_PICKUP'] },
  { key: 'PATIENT_LOADED', label: 'Patient Loaded', matches: ['PATIENT_LOADED', 'PATIENT_ONBOARD'] },
  { key: 'IN_TRANSIT_TO_HOSPITAL', label: 'Transit to Hospital', matches: ['IN_TRANSIT_TO_HOSPITAL', 'EN_ROUTE_TO_HOSPITAL', 'HOSPITAL_SELECTED'] },
  { key: 'ARRIVED_AT_HOSPITAL', label: 'At Hospital ER', matches: ['ARRIVED_AT_HOSPITAL'] },
  { key: 'HANDOVER_COMPLETE', label: 'Handover Complete', matches: ['HANDOVER_COMPLETE', 'CASE_COMPLETED'] },
];

const formatStatus = (status) => {
  if (!status) return 'ACTIVE';
  switch (status) {
    case 'REQUESTED':
    case 'SEARCHING_AMBULANCE':
    case 'PENDING':
      return 'TRIAGE PENDING';
    case 'AMBULANCE_ASSIGNED':
    case 'DRIVER_ACCEPTED':
    case 'ASSIGNED':
      return 'AMBULANCE ASSIGNED';
    case 'EN_ROUTE_TO_PICKUP':
    case 'AMBULANCE_EN_ROUTE':
      return 'EN ROUTE TO YOU';
    case 'ARRIVED_AT_PICKUP':
    case 'ARRIVED_AT_SCENE':
      return 'ARRIVED AT SCENE (ON SCENE)';
    case 'PATIENT_ONBOARD':
    case 'PATIENT_LOADED':
      return 'PATIENT LOADED';
    case 'EN_ROUTE_TO_HOSPITAL':
    case 'IN_TRANSIT_TO_HOSPITAL':
    case 'HOSPITAL_SELECTED':
      return 'TRANSIT TO HOSPITAL';
    case 'ARRIVED_AT_HOSPITAL':
      return 'ARRIVED AT HOSPITAL ER';
    case 'CASE_COMPLETED':
    case 'HANDOVER_COMPLETE':
      return 'HANDOVER COMPLETE';
    default:
      return status.replace(/_/g, ' ');
  }
};

export const UserDashboard = ({ onOpenEmergencyModal }) => {
  const { subscribe, addToast } = useWebSocket();
  const [activeEmergency, setActiveEmergency] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hospitalRecs, setHospitalRecs] = useState([]);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [defaultPickup, setDefaultPickup] = useState({
    address: '41, Potheri, SRM University Campus, Chennai',
    lat: 12.8235,
    lng: 80.0445,
  });

  const fetchActive = useCallback(async () => {
    try {
      const res = await emergencyAPI.getActive();
      setActiveEmergency(res.data);

      if (res.data) {
        // Fetch hospital recommendations
        try {
          const lat = res.data.pickup_lat ?? res.data.pickup_latitude;
          const lng = res.data.pickup_lng ?? res.data.pickup_longitude;
          const priority = res.data.priority || res.data.severity_level || 'CRITICAL';
          const recRes = await hospitalAPI.getRecommendations(
            lat,
            lng,
            res.data.emergency_type,
            priority
          );
          setHospitalRecs(recRes.data || []);
        } catch (e) {
          console.warn('Failed to load hospital recommendations', e);
        }
      }
    } catch (err) {
      try {
        const saved = localStorage.getItem('resq_active_emergency');
        if (saved) {
          const parsed = JSON.parse(saved);
          setActiveEmergency(parsed);
        } else {
          setActiveEmergency(null);
        }
      } catch {
        setActiveEmergency(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActive();

    // Subscribe to real-time events
    const unsubscribe = subscribe((msg) => {
      if (msg.event === 'LOCATION_UPDATE' || msg.event === 'AMBULANCE_LOCATION_UPDATE') {
        const data = msg.data || {};
        const lat = data.latitude ?? data.current_latitude ?? data.current_lat;
        const lng = data.longitude ?? data.current_longitude ?? data.current_lng;
        setActiveEmergency((prev) => {
          if (!prev || (data.emergency_id && prev.id !== data.emergency_id)) return prev;
          return {
            ...prev,
            ambulance: {
              ...prev.ambulance,
              current_latitude: lat,
              current_longitude: lng,
              current_lat: lat,
              current_lng: lng,
              speed_kmh: data.speed ?? data.speed_kmh ?? prev.ambulance?.speed_kmh,
              heading: data.heading ?? prev.ambulance?.heading,
            },
            estimated_eta_minutes: data.eta_minutes ?? prev.estimated_eta_minutes,
            estimated_distance_km: data.distance_km ?? prev.estimated_distance_km,
            eta_minutes: data.eta_minutes ?? prev.eta_minutes,
            distance_km: data.distance_km ?? prev.distance_km,
          };
        });
      } else if (msg.event === 'STATUS_CHANGE' || msg.event === 'EMERGENCY_STATUS_UPDATED') {
        const data = msg.data || {};
        setActiveEmergency((prev) => {
          if (!prev || (data.emergency_id && prev.id !== data.emergency_id)) return prev;
          const newStatus = data.status || prev.status;
          const isAtSceneNow = newStatus === 'ARRIVED_AT_PICKUP' || newStatus === 'ARRIVED_AT_SCENE';
          const isAtHospNow = newStatus === 'ARRIVED_AT_HOSPITAL';
          return {
            ...prev,
            status: newStatus,
            estimated_eta_minutes: isAtSceneNow || isAtHospNow ? 0 : (data.eta_minutes ?? prev.estimated_eta_minutes ?? prev.eta_minutes),
            eta_minutes: isAtSceneNow || isAtHospNow ? 0 : (data.eta_minutes ?? prev.eta_minutes),
            estimated_distance_km: isAtSceneNow ? 0 : (data.distance_km ?? prev.estimated_distance_km ?? prev.distance_km),
            distance_km: isAtSceneNow ? 0 : (data.distance_km ?? prev.distance_km),
            ambulance: data.ambulance ? { ...prev.ambulance, ...data.ambulance } : (
              isAtSceneNow && (prev.pickup_lat ?? prev.pickup_latitude) ? {
                ...prev.ambulance,
                current_latitude: prev.pickup_lat ?? prev.pickup_latitude,
                current_longitude: prev.pickup_lng ?? prev.pickup_longitude,
                current_lat: prev.pickup_lat ?? prev.pickup_latitude,
                current_lng: prev.pickup_lng ?? prev.pickup_longitude,
                speed_kmh: 0,
              } : prev.ambulance
            ),
          };
        });
        // Fetch to ensure full database synchronization
        fetchActive();
      } else if (msg.event === 'HOSPITAL_ASSIGNED' || msg.event === 'HOSPITAL_ACCEPTED_CASE' || msg.event === 'CASE_ACCEPTED') {
        fetchActive();
      } else if (msg.event === 'SIMULATION_STARTED') {
        fetchActive();
      }
    });

    return unsubscribe;
  }, [fetchActive, subscribe]);

  const handleSelectHospital = async (hospitalId) => {
    if (!activeEmergency) return;
    try {
      await emergencyAPI.requestHospitalChange(activeEmergency.id, hospitalId, 'Selected by patient attendant');
      addToast('Hospital Requested', 'Destination hospital preference submitted', 'emerald');
      fetchActive();
    } catch (err) {
      addToast('Error', err.response?.data?.detail || 'Failed to select hospital', 'crimson');
    }
  };

  const handleCancelEmergency = async () => {
    if (!activeEmergency) return;
    localStorage.removeItem('resq_active_emergency');
    try {
      await emergencyAPI.cancel(activeEmergency.id, cancelReason || 'Cancelled by user');
      addToast('Emergency Cancelled', 'Your request has been cancelled', 'amber');
      setActiveEmergency(null);
      setCancelModalOpen(false);
    } catch (err) {
      addToast('Emergency Cancelled', 'Your request has been cancelled (Demo Mode)', 'amber');
      setActiveEmergency(null);
      setCancelModalOpen(false);
    }
  };

  // Determine current step index
  const currentStepIdx = activeEmergency
    ? STATUS_STEPS.findIndex((s) => s.key === activeEmergency.status || s.matches?.includes(activeEmergency.status))
    : -1;

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: '#94A3B8' }}>
        <div className="pulsing-dot" style={{ marginBottom: '16px' }} />
        <div>Connecting to emergency dispatch network...</div>
      </div>
    );
  }


  // View when NO active emergency exists - Displays Live Radar Map with Nearby Cruising Ambulances (Rapido style)
  if (!activeEmergency) {
    return (
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '20px', width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Top Emergency Ready Banner */}
        <div className="glass-panel-glow" style={{
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <span className="pulsing-dot" style={{ width: '14px', height: '14px', background: '#10B981' }} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="badge badge-emerald">FLEET READY</span>
                <span style={{ fontSize: '0.85rem', color: '#CBD5E1', fontWeight: 600 }}>
                  Chennai South &amp; Chengalpattu Life-Support Network
                </span>
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#FFF', marginTop: '2px' }}>
                ⚡ 3 Rapid ALS Ambulances On Radar Near Your Location
              </div>
            </div>
          </div>

          <button
            onClick={onOpenEmergencyModal}
            className="btn btn-lg btn-primary"
            style={{ fontSize: '1.05rem', padding: '12px 28px', borderRadius: '12px', fontWeight: 700 }}
          >
            <HeartPulse size={20} />
            <span>🚨 REQUEST EMERGENCY AMBULANCE NOW</span>
          </button>
        </div>

        {/* Live Radar Map Card with Nearby Ambulances Cruising Around User Pickup */}
        <div className="glass-panel" style={{ padding: '0', overflow: 'hidden', height: '560px', position: 'relative', display: 'flex', flexDirection: 'column' }}>
          {/* Header Strip */}
          <div style={{
            padding: '12px 20px',
            background: 'rgba(13, 19, 34, 0.85)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
            zIndex: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Navigation size={18} color="#10B981" />
              <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#FFF' }}>
                Live Radar Fleet &bull; Nearest Available Unit: <span style={{ color: '#10B981' }}>~3 min away</span>
              </span>
            </div>
            {/* Quick Location Chips */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.78rem', color: '#94A3B8' }}>Select Location:</span>
              {[
                { name: 'Potheri (SRM Campus)', lat: 12.8235, lng: 80.0445, address: '41, Potheri, SRM University Campus, Chennai' },
                { name: 'Velachery', lat: 12.9815, lng: 80.2180, address: 'Velachery Bypass Road, Chennai' },
                { name: 'T. Nagar', lat: 13.0418, lng: 80.2341, address: 'Usman Road, T. Nagar, Chennai' },
                { name: 'Adyar Signal', lat: 13.0012, lng: 80.2565, address: 'Adyar Signal, LB Road, Chennai' },
              ].map((loc) => (
                <button
                  key={loc.name}
                  onClick={() => setDefaultPickup(loc)}
                  className={`btn btn-sm ${defaultPickup.name === loc.name || defaultPickup.lat === loc.lat ? 'btn-primary' : 'btn-outline'}`}
                  style={{ fontSize: '0.75rem', padding: '3px 10px' }}
                >
                  📍 {loc.name}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Modern Map */}
          <div style={{ flex: 1, minHeight: '480px', position: 'relative' }}>
            <LiveMap
              center={[defaultPickup.lat, defaultPickup.lng]}
              zoom={15}
              emergency={{
                pickup_address: defaultPickup.address,
                pickup_lat: defaultPickup.lat,
                pickup_lng: defaultPickup.lng,
                emergency_type: 'Emergency Standby',
                priority: 'READY',
                status: 'SEARCHING_AMBULANCE',
              }}
              showNearbyRadar={true}
            />
          </div>
        </div>

        {/* Informational Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          <div className="glass-panel" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', color: '#38BDF8' }}>
              <Clock size={20} />
              <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Rapid Multi-Factor Dispatch</h3>
            </div>
            <p style={{ fontSize: '0.88rem', color: '#94A3B8', margin: 0 }}>
              AI engine evaluates real-time GPS distance, urban traffic clearing, and life-support equipment suitability (ventilators, defibrillators).
            </p>
          </div>

          <div className="glass-panel" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', color: '#10B981' }}>
              <Building2 size={20} />
              <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Live ER Bed Reservation</h3>
            </div>
            <p style={{ fontSize: '0.88rem', color: '#94A3B8', margin: 0 }}>
              Transmits patient vitals ahead of time to the destination emergency room, guaranteeing ICU bed and doctor readiness on arrival.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Active Emergency Live View
  const ambulance = activeEmergency.assigned_ambulance || activeEmergency.ambulance;
  const hospital = activeEmergency.selected_hospital || activeEmergency.destination_hospital;
  
  const isAtScene = activeEmergency.status === 'ARRIVED_AT_PICKUP' || activeEmergency.status === 'ARRIVED_AT_SCENE';
  const isAtHospital = activeEmergency.status === 'ARRIVED_AT_HOSPITAL';
  const isCompleted = activeEmergency.status === 'CASE_COMPLETED' || activeEmergency.status === 'HANDOVER_COMPLETE';

  let etaText = 'Calculating...';
  let distText = null;

  if (isAtScene) {
    etaText = 'ARRIVED ON SCENE';
    distText = '0.0 km (At Scene)';
  } else if (isAtHospital) {
    etaText = 'AT HOSPITAL ER';
    distText = '0.0 km';
  } else if (isCompleted) {
    etaText = 'COMPLETED';
    distText = '0.0 km';
  } else {
    const rawEta = activeEmergency.estimated_eta_minutes ?? activeEmergency.eta_minutes;
    const rawDist = activeEmergency.estimated_distance_km ?? activeEmergency.distance_km;
    if (rawEta !== null && rawEta !== undefined) {
      etaText = `${rawEta} min`;
    }
    if (rawDist !== null && rawDist !== undefined) {
      distText = `${rawDist} km`;
    }
  }

  return (
    <div style={{ width: '100%', maxWidth: '1400px', margin: '0 auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Emergency Status Banner */}
      <div className="glass-panel-glow" style={{
        padding: '18px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span className="pulsing-dot" style={{ width: '14px', height: '14px', background: isAtScene ? '#10B981' : '#EF4444' }} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="badge badge-crimson">
                {activeEmergency.emergency_type ? activeEmergency.emergency_type.replace(/_/g, ' ') : 'EMERGENCY'}
              </span>
              <span className="badge badge-amber">
                {activeEmergency.priority || activeEmergency.severity_level || 'CRITICAL'}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Case #{String(activeEmergency.id).slice(0, 8)}
              </span>
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#FFF', marginTop: '4px' }}>
              Status: <span style={{ color: isAtScene ? '#10B981' : '#38BDF8' }}>{formatStatus(activeEmergency.status)}</span>
            </div>
          </div>
        </div>

        {/* ETA Counter */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          background: 'rgba(7, 11, 20, 0.6)',
          padding: '10px 18px',
          borderRadius: '12px',
          border: isAtScene ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: isAtScene ? '0 0 16px rgba(16, 185, 129, 0.2)' : 'none'
        }}>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {isAtScene ? 'Unit Arrival Status' : 'Estimated Arrival (ETA)'}
            </div>
            <div style={{
              fontSize: isAtScene ? '1.35rem' : '1.6rem',
              fontWeight: 800,
              color: isAtScene ? '#10B981' : '#38BDF8',
              fontFamily: 'var(--font-heading)'
            }}>
              {etaText}
            </div>
          </div>
          {distText !== null && (
            <div style={{ borderLeft: '1px solid var(--border-subtle)', paddingLeft: '14px' }}>
              <div style={{ fontSize: '0.72rem', color: '#94A3B8', textTransform: 'uppercase' }}>Distance</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: isAtScene ? '#10B981' : '#F1F5F9' }}>
                {distText}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => setCancelModalOpen(true)}
          className="btn btn-sm btn-danger-outline"
        >
          <XCircle size={15} />
          <span>Cancel Emergency</span>
        </button>
      </div>

      {/* Progress Pipeline Stepper */}
      <div className="glass-panel" style={{ padding: '16px 20px', overflowX: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: '700px' }}>
          {STATUS_STEPS.map((step, idx) => {
            const isCompleted = idx < currentStepIdx;
            const isCurrent = idx === currentStepIdx;
            return (
              <div key={step.key} style={{ display: 'flex', alignItems: 'center', flex: idx < STATUS_STEPS.length - 1 ? 1 : 'none' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '80px' }}>
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    background: isCurrent ? '#38BDF8' : isCompleted ? '#10B981' : 'rgba(255, 255, 255, 0.08)',
                    color: isCurrent || isCompleted ? '#070B14' : '#64748B',
                    boxShadow: isCurrent ? '0 0 12px rgba(56, 189, 248, 0.6)' : 'none',
                    transition: 'all 0.3s'
                  }}>
                    {isCompleted ? <CheckCircle2 size={16} /> : idx + 1}
                  </div>
                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: isCurrent ? 700 : 500,
                    color: isCurrent ? '#FFF' : isCompleted ? '#E2E8F0' : '#64748B',
                    marginTop: '6px',
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                  }}>
                    {step.label}
                  </span>
                </div>
                {idx < STATUS_STEPS.length - 1 && (
                  <div style={{
                    flex: 1,
                    height: '2px',
                    margin: '0 8px',
                    marginBottom: '16px',
                    background: isCompleted ? '#10B981' : 'rgba(255, 255, 255, 0.1)',
                    transition: 'all 0.3s',
                  }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Grid: Map & Details */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '20px', minHeight: '520px' }}>
        {/* Left: Live Interactive Map */}
        <div className="glass-panel" style={{ height: '100%', minHeight: '500px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Navigation size={18} color="#38BDF8" />
              <span style={{ fontWeight: 600, fontSize: '0.92rem', color: '#FFF' }}>Live Vehicle GPS Tracking</span>
            </div>
            {ambulance?.speed_kmh && (
              <span className="badge badge-cyan">
                Speed: {ambulance.speed_kmh} km/h
              </span>
            )}
          </div>
          <div style={{ flex: 1, minHeight: '450px' }}>
            <LiveMap
              emergency={activeEmergency}
              ambulances={ambulance ? [ambulance] : []}
              assignedAmbulance={ambulance}
              assignedHospital={hospital}
              hospitals={hospital ? [hospital] : []}
              zoom={15}
              showNearbyRadar={true}
            />
          </div>
        </div>

        {/* Right: Driver Card & Hospital Recommendations */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Assigned Ambulance Driver Card */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px', color: '#FFF' }}>
              <Truck size={18} color="#F59E0B" />
              <span>Assigned Life-Support Unit</span>
            </h3>

            {ambulance ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#FFF' }}>
                      {ambulance.vehicle_number}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#94A3B8' }}>
                      {ambulance.vehicle_type || ambulance.ambulance_type || 'ALS'} &bull; Model: {ambulance.model_info || ambulance.model || 'Force Traveller BLS/ALS'}
                    </div>
                  </div>
                  <span className="badge badge-emerald">
                    {ambulance.availability_status || ambulance.status || 'ASSIGNED'}
                  </span>
                </div>

                <div style={{
                  padding: '12px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Driver in Charge</div>
                    <div style={{ fontWeight: 600, color: '#FFF' }}>{ambulance.driver_name || ambulance.driver?.full_name || 'Assigned Specialist'}</div>
                  </div>
                  <a
                    href={`tel:${ambulance.driver_phone || ambulance.driver?.phone_number || '9840000000'}`}
                    className="btn btn-sm btn-emerald"
                  >
                    <Phone size={14} />
                    <span>Call Driver</span>
                  </a>
                </div>

                {/* Equipment Check */}
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginBottom: '6px' }}>On-Board Life Support:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {(ambulance.has_ventilator || ambulance.capabilities?.includes('Ventilator')) && <span className="badge badge-cyan">Ventilator</span>}
                    {(ambulance.has_defibrillator || ambulance.capabilities?.includes('Defibrillator')) && <span className="badge badge-crimson">Defibrillator</span>}
                    {(ambulance.has_oxygen || ambulance.capabilities?.includes('Oxygen')) && <span className="badge badge-emerald">Oxygen Cylinders</span>}
                    {ambulance.capabilities?.includes('ECG') && <span className="badge badge-purple">ECG Monitor</span>}
                    {ambulance.capabilities?.includes('Stretcher') && <span className="badge badge-amber">Stretcher</span>}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ color: '#94A3B8', fontSize: '0.9rem', textAlign: 'center', padding: '20px' }}>
                <div className="pulsing-dot" style={{ marginBottom: '10px' }} />
                <div>Searching &amp; assigning nearest life-support ambulance...</div>
              </div>
            )}
          </div>

          {/* Destination Hospital & Recommendations */}
          <div className="glass-panel" style={{ padding: '20px', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '1.1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#FFF' }}>
                <Building2 size={18} color="#38BDF8" />
                <span>Destination Hospital</span>
              </h3>
              {hospital && (
                <span className="badge badge-blue">
                  CONFIRMED
                </span>
              )}
            </div>

            {hospital ? (
              <div style={{
                padding: '14px',
                borderRadius: '10px',
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                marginBottom: '16px'
              }}>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#FFF' }}>{hospital.name}</div>
                <div style={{ fontSize: '0.8rem', color: '#94A3B8', marginTop: '2px' }}>{hospital.address}</div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '10px', fontSize: '0.8rem' }}>
                  <div><strong style={{ color: '#38BDF8' }}>{hospital.icu_beds_available}</strong> ICU Beds</div>
                  <div><strong style={{ color: '#10B981' }}>{hospital.general_beds_available}</strong> General Beds</div>
                  <div>Status: <span style={{ color: '#34D399' }}>{hospital.emergency_department_status}</span></div>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '0.85rem', color: '#94A3B8', marginBottom: '12px' }}>
                Select an AI-recommended hospital or allow dispatcher auto-allocation:
              </div>
            )}

            {/* Recommendations List */}
            {hospitalRecs.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '0.78rem', color: '#94A3B8', fontWeight: 600 }}>
                  Nearby Capacity-Matched Recommendations:
                </div>
                {hospitalRecs.slice(0, 3).map((rec) => {
                  const hId = rec.hospital_id || rec.hospital?.id || rec.id;
                  const hName = rec.name || rec.hospital?.name || 'Hospital Center';
                  const isSelected = hospital?.id === hId;
                  const dist = rec.distance_km ?? 0;
                  const eta = rec.eta_minutes ?? rec.travel_time_minutes ?? 0;
                  const icu = rec.icu_beds_available ?? rec.hospital?.icu_beds_available ?? 0;
                  return (
                    <div
                      key={hId}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        background: isSelected ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                        border: isSelected ? '1px solid #38BDF8' : '1px solid var(--border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#FFF' }}>{hName}</div>
                        <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
                          {dist} km &bull; ETA ~{eta} min &bull; {icu} ICU beds
                        </div>
                      </div>
                      {!isSelected && (
                        <button
                          onClick={() => handleSelectHospital(hId)}
                          className="btn btn-sm btn-outline"
                          style={{ fontSize: '0.74rem', padding: '4px 8px' }}
                        >
                          Select
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      {cancelModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(7, 11, 20, 0.8)',
          backdropFilter: 'blur(8px)',
        }}>
          <div className="glass-panel" style={{ maxWidth: '420px', width: '90%', padding: '24px' }}>
            <h3 style={{ color: '#EF4444', marginBottom: '12px' }}>Cancel Emergency Call?</h3>
            <p style={{ fontSize: '0.88rem', color: '#94A3B8', marginBottom: '16px' }}>
              Are you sure? This will recall the dispatched ambulance and notify the emergency command center.
            </p>
            <input
              type="text"
              placeholder="Cancellation Reason (e.g. false alarm, alternate transport)"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="input-field"
              style={{ marginBottom: '16px' }}
            />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setCancelModalOpen(false)} className="btn btn-outline" style={{ flex: 1 }}>
                Back
              </button>
              <button onClick={handleCancelEmergency} className="btn btn-primary" style={{ flex: 1 }}>
                Confirm Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
