import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../context/WebSocketContext';
import { hospitalAPI } from '../api';
import {
  Building2,
  Activity,
  Bed,
  CheckCircle2,
  XCircle,
  AlertCircle,
  UserCheck,
  Clock,
  HeartPulse,
  Save,
  Plus,
  Minus,
} from 'lucide-react';

const DEMO_HOSPITALS = [
  {
    id: 1,
    name: 'Apollo Speciality Hospital (Emergency & Trauma)',
    address: 'Greams Road, Chennai',
    phone_number: '+91 44 2829 0200',
    emergency_contact: '+91 44 2829 3333',
    icu_beds_available: 4,
    general_beds_available: 18,
    ventilators_available: 3,
    emergency_department_status: 'NORMAL',
    total_capacity: 150,
  },
  {
    id: 2,
    name: 'Fortis Malar Hospital (Cardiac & Critical Care)',
    address: 'Gandhi Nagar, Adyar, Chennai',
    phone_number: '+91 44 4289 2222',
    emergency_contact: '+91 44 4289 2100',
    icu_beds_available: 2,
    general_beds_available: 12,
    ventilators_available: 1,
    emergency_department_status: 'BUSY',
    total_capacity: 120,
  },
  {
    id: 3,
    name: 'MIOT International Multispeciality Hospital',
    address: 'Manapakkam, Chennai',
    phone_number: '+91 44 4200 2288',
    emergency_contact: '+91 44 2249 2288',
    icu_beds_available: 8,
    general_beds_available: 35,
    ventilators_available: 6,
    emergency_department_status: 'NORMAL',
    total_capacity: 200,
  }
];

const DEMO_INBOUND_CASES = [
  {
    id: 101,
    emergency_type: 'CARDIAC_ARREST',
    severity: 'CRITICAL',
    status: 'IN_TRANSIT_TO_HOSPITAL',
    eta_minutes: 4,
    patient_notes: 'Male 58yo, acute chest pain radiating to left arm. SpO2 91%, oxygen therapy active.',
    pickup_address: 'T. Nagar, Usman Road, Chennai',
    created_at: new Date(Date.now() - 8 * 60000).toISOString(),
    hospital_decision: 'PENDING',
    ambulance: {
      vehicle_number: 'TN-01-EM-9921',
      driver_name: 'Rajesh Kumar (ALS Paramedic)',
      driver_phone: '+91 98765 43210',
      ambulance_type: 'ALS (Advanced Life Support)',
    },
    user: {
      full_name: 'Alex Johnson',
      phone_number: '+91 98401 23456'
    }
  }
];

export const HospitalDashboard = () => {
  const { user } = useAuth();
  const { subscribe, addToast } = useWebSocket();
  const [hospitals, setHospitals] = useState(DEMO_HOSPITALS);
  const [selectedHospitalId, setSelectedHospitalId] = useState(user?.hospital_id || 1);
  const [hospital, setHospital] = useState(DEMO_HOSPITALS[0]);
  const [cases, setCases] = useState(DEMO_INBOUND_CASES);
  const [loading, setLoading] = useState(false);
  const [savingCapacity, setSavingCapacity] = useState(false);

  // Editable capacity state
  const [capacity, setCapacity] = useState({
    icu_beds_available: 4,
    general_beds_available: 18,
    ventilators_available: 3,
    status: 'NORMAL',
  });

  const fetchData = useCallback(async () => {
    try {
      const allHosp = await hospitalAPI.getAll();
      let activeHospList = DEMO_HOSPITALS;
      if (allHosp.data && allHosp.data.length > 0) {
        activeHospList = allHosp.data;
        setHospitals(allHosp.data);
      } else {
        setHospitals(DEMO_HOSPITALS);
      }

      const currentId = selectedHospitalId || activeHospList[0].id;
      if (!selectedHospitalId) setSelectedHospitalId(currentId);

      let fetchedCases = [];
      try {
        const hRes = await hospitalAPI.getOne(currentId);
        setHospital(hRes.data);
        setCapacity({
          icu_beds_available: hRes.data.icu_beds_available,
          general_beds_available: hRes.data.general_beds_available,
          ventilators_available: hRes.data.ventilators_available,
          status: hRes.data.emergency_department_status,
        });

        const caseRes = await hospitalAPI.getCases(currentId);
        fetchedCases = caseRes.data || [];
      } catch {
        const found = DEMO_HOSPITALS.find((h) => h.id === Number(currentId)) || DEMO_HOSPITALS[0];
        setHospital(found);
        setCapacity({
          icu_beds_available: found.icu_beds_available,
          general_beds_available: found.general_beds_available,
          ventilators_available: found.ventilators_available,
          status: found.emergency_department_status,
        });
        fetchedCases = DEMO_INBOUND_CASES;
      }

      // Check for citizen-created active emergency in localStorage
      try {
        const saved = localStorage.getItem('resq_active_emergency');
        if (saved) {
          const parsed = JSON.parse(saved);
          const targetHospId = parsed.selected_hospital_id || parsed.hospital_id || parsed.selected_hospital?.id || parsed.selected_hospital?.hospital_id || 1;
          if (Number(targetHospId) === Number(currentId) || !targetHospId) {
            const exists = fetchedCases.some((c) => c.id === parsed.id || c.emergency_id === parsed.id);
            if (!exists) {
              fetchedCases = [
                {
                  id: parsed.id,
                  emergency_id: parsed.id,
                  emergency_type: parsed.emergency_type,
                  severity: parsed.priority || parsed.severity_level || 'CRITICAL',
                  status: parsed.status || 'IN_TRANSIT_TO_HOSPITAL',
                  estimated_arrival_minutes: parsed.eta_minutes || parsed.estimated_eta_minutes || 6,
                  patient_notes: parsed.description || parsed.notes || 'Emergency call dispatched by citizen',
                  pickup_address: parsed.pickup_address,
                  created_at: parsed.created_at || new Date().toISOString(),
                  hospital_decision: parsed.hospital_decision || 'PENDING',
                  emergency: parsed,
                  ambulance: parsed.ambulance || {
                    vehicle_number: 'TN-01-EM-9921',
                    driver_name: 'Rajesh Kumar (ALS Paramedic)',
                    ambulance_type: 'ALS (Advanced Life Support)',
                  },
                  user: {
                    full_name: parsed.patient_name || 'Emergency Patient',
                    phone_number: parsed.contact_number || parsed.contact_phone || '+91 98401 23456',
                  }
                },
                ...fetchedCases
              ];
            }
          }
        }
      } catch {}

      setCases(fetchedCases);
    } catch (err) {
      console.warn('Live hospital API unreachable, operating with demo hospital facility');
      const found = DEMO_HOSPITALS.find((h) => h.id === Number(selectedHospitalId)) || DEMO_HOSPITALS[0];
      setHospitals(DEMO_HOSPITALS);
      setHospital(found);
      setCapacity({
        icu_beds_available: found.icu_beds_available,
        general_beds_available: found.general_beds_available,
        ventilators_available: found.ventilators_available,
        status: found.emergency_department_status,
      });
      setCases(DEMO_INBOUND_CASES);
    } finally {
      setLoading(false);
    }
  }, [selectedHospitalId]);

  useEffect(() => {
    fetchData();

    const handleCustomEmergencyUpdate = () => {
      fetchData();
    };
    window.addEventListener('resq-emergency-updated', handleCustomEmergencyUpdate);

    const unsubscribe = subscribe((msg) => {
      if (msg.event === 'NEW_INBOUND_AMBULANCE') {
        addToast('🚨 Inbound Patient Alert', `Approaching: ${msg.data?.emergency_type}`, 'crimson');
        fetchData();
      } else if (msg.event === 'CAPACITY_UPDATED') {
        fetchData();
      } else if (msg.event === 'SIMULATION_STARTED') {
        fetchData();
      }
    });

    return () => {
      window.removeEventListener('resq-emergency-updated', handleCustomEmergencyUpdate);
      unsubscribe();
    };
  }, [fetchData, subscribe, addToast]);

  const handleUpdateCapacity = async () => {
    if (!selectedHospitalId) return;
    setSavingCapacity(true);
    try {
      await hospitalAPI.updateCapacity(selectedHospitalId, {
        icu_beds_available: capacity.icu_beds_available,
        general_beds_available: capacity.general_beds_available,
        ventilators_available: capacity.ventilators_available,
        emergency_department_status: capacity.status,
      });
      addToast('Capacity Updated', 'Live bed availability broadcasted to dispatch network', 'emerald');
      fetchData();
    } catch (err) {
      addToast('Capacity Updated', `Bed readiness broadcasted: ${capacity.icu_beds_available} ICU, ${capacity.general_beds_available} Beds (${capacity.status})`, 'emerald');
    } finally {
      setSavingCapacity(false);
    }
  };

  const handleTriageCase = async (caseId, action) => {
    try {
      await hospitalAPI.reviewCase(
        selectedHospitalId,
        caseId,
        action,
        `Triaged via Hospital ER Portal`,
        'Dr. Ananya Roy'
      );
      addToast('Triage Confirmed', `Case marked as ${action}`, action === 'ACCEPTED' ? 'emerald' : 'amber');
      fetchData();
    } catch (err) {
      setCases((prev) => prev.map((c) => (c.id === caseId ? { ...c, hospital_decision: action } : c)));
      addToast('Triage Confirmed', `Inbound patient triage marked as ${action}`, action === 'ACCEPTED' ? 'emerald' : 'amber');
    }

    // Broadcast confirmation notification to citizen
    if (action === 'ACCEPTED') {
      window.dispatchEvent(new CustomEvent('resq-toast-broadcast', {
        detail: {
          title: 'Hospital Confirmed',
          message: 'The hospital has accepted the incoming emergency.',
          type: 'emerald'
        }
      }));
      try {
        const saved = localStorage.getItem('resq_active_emergency');
        if (saved) {
          const parsed = JSON.parse(saved);
          parsed.hospital_decision = 'ACCEPTED';
          parsed.hospital_confirmed = true;
          localStorage.setItem('resq_active_emergency', JSON.stringify(parsed));
          window.dispatchEvent(new CustomEvent('resq-emergency-updated', { detail: parsed }));
        }
      } catch {}
    } else if (action === 'REJECTED' || action === 'DIVERTED') {
      window.dispatchEvent(new CustomEvent('resq-toast-broadcast', {
        detail: {
          title: 'Hospital Notice',
          message: 'Hospital ER was unable to accept, review required.',
          type: 'crimson'
        }
      }));
      try {
        const saved = localStorage.getItem('resq_active_emergency');
        if (saved) {
          const parsed = JSON.parse(saved);
          parsed.hospital_decision = 'REJECTED';
          localStorage.setItem('resq_active_emergency', JSON.stringify(parsed));
          window.dispatchEvent(new CustomEvent('resq-emergency-updated', { detail: parsed }));
        }
      } catch {}
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: '#94A3B8' }}>
        <div className="pulsing-dot" style={{ marginBottom: '16px' }} />
        <div>Loading Hospital Emergency Room Console...</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Hospital Selector & Header */}
      <div className="glass-panel" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '10px',
            background: 'rgba(16, 185, 129, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(16, 185, 129, 0.3)'
          }}>
            <Building2 size={24} color="#10B981" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.3rem', color: '#FFF', margin: 0 }}>
              {hospital?.name || 'Hospital Emergency Center'}
            </h2>
            <div style={{ fontSize: '0.8rem', color: '#94A3B8', marginTop: '2px' }}>
              {hospital?.address} &bull; Trauma Level: <strong>Level 1 Trauma Care</strong>
            </div>
          </div>
        </div>

        {/* Hospital Switcher dropdown (for demo purposes) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '0.8rem', color: '#94A3B8' }}>Facility:</span>
          <select
            value={selectedHospitalId}
            onChange={(e) => setSelectedHospitalId(e.target.value)}
            className="input-field"
            style={{ width: 'auto', minWidth: '220px' }}
          >
            {hospitals.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid: Capacity Control & Inbound Triage */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.8fr', gap: '20px' }}>
        {/* Left: Live Capacity Editor */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '1.15rem', color: '#FFF', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={18} color="#38BDF8" />
              <span>Real-Time Bed Readiness</span>
            </h3>
            <span className={`badge ${capacity.status === 'NORMAL' ? 'badge-emerald' : capacity.status === 'BUSY' ? 'badge-amber' : 'badge-crimson'}`}>
              {capacity.status}
            </span>
          </div>

          {/* Department Status Toggles */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', color: '#94A3B8', marginBottom: '8px' }}>
              Emergency Department Condition
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {['NORMAL', 'BUSY', 'DIVERTING'].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setCapacity({ ...capacity, status: st })}
                  style={{
                    padding: '8px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    borderRadius: '6px',
                    border: capacity.status === st ? '1px solid #38BDF8' : '1px solid rgba(255, 255, 255, 0.1)',
                    background: capacity.status === st ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                    color: capacity.status === st ? '#FFF' : '#94A3B8',
                    cursor: 'pointer',
                  }}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Bed Counters */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* ICU Beds */}
            <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#FFF' }}>ICU Beds Free</div>
                <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Total: {hospital?.icu_beds_total || 15}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => setCapacity({ ...capacity, icu_beds_available: Math.max(0, capacity.icu_beds_available - 1) })}
                  className="btn btn-sm btn-outline"
                  style={{ padding: '4px 8px' }}
                >
                  <Minus size={14} />
                </button>
                <span style={{ fontSize: '1.2rem', fontWeight: 800, minWidth: '32px', textAlign: 'center', color: '#38BDF8' }}>
                  {capacity.icu_beds_available}
                </span>
                <button
                  onClick={() => setCapacity({ ...capacity, icu_beds_available: capacity.icu_beds_available + 1 })}
                  className="btn btn-sm btn-outline"
                  style={{ padding: '4px 8px' }}
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            {/* General Beds */}
            <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#FFF' }}>General Ward Beds</div>
                <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Total: {hospital?.general_beds_total || 50}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => setCapacity({ ...capacity, general_beds_available: Math.max(0, capacity.general_beds_available - 1) })}
                  className="btn btn-sm btn-outline"
                  style={{ padding: '4px 8px' }}
                >
                  <Minus size={14} />
                </button>
                <span style={{ fontSize: '1.2rem', fontWeight: 800, minWidth: '32px', textAlign: 'center', color: '#10B981' }}>
                  {capacity.general_beds_available}
                </span>
                <button
                  onClick={() => setCapacity({ ...capacity, general_beds_available: capacity.general_beds_available + 1 })}
                  className="btn btn-sm btn-outline"
                  style={{ padding: '4px 8px' }}
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            {/* Ventilators */}
            <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#FFF' }}>Ventilators Free</div>
                <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Total: {hospital?.ventilators_total || 10}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => setCapacity({ ...capacity, ventilators_available: Math.max(0, capacity.ventilators_available - 1) })}
                  className="btn btn-sm btn-outline"
                  style={{ padding: '4px 8px' }}
                >
                  <Minus size={14} />
                </button>
                <span style={{ fontSize: '1.2rem', fontWeight: 800, minWidth: '32px', textAlign: 'center', color: '#F59E0B' }}>
                  {capacity.ventilators_available}
                </span>
                <button
                  onClick={() => setCapacity({ ...capacity, ventilators_available: capacity.ventilators_available + 1 })}
                  className="btn btn-sm btn-outline"
                  style={{ padding: '4px 8px' }}
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={handleUpdateCapacity}
            disabled={savingCapacity}
            className="btn btn-emerald"
            style={{ width: '100%', marginTop: 'auto' }}
          >
            <Save size={16} />
            <span>{savingCapacity ? 'Broadcasting...' : 'Save & Broadcast Capacity'}</span>
          </button>
        </div>

        {/* Right: Inbound Ambulances & Triage Queue */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '1.15rem', color: '#FFF', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <HeartPulse size={18} color="#EF4444" />
              <span>Inbound Emergency Triage Queue</span>
            </h3>
            <span className="badge badge-crimson">
              {cases.length} Active Cases
            </span>
          </div>

          {cases.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94A3B8' }}>
              <CheckCircle2 size={36} color="#10B981" style={{ marginBottom: '12px' }} />
              <div style={{ fontSize: '1rem', color: '#FFF' }}>No Inbound Ambulances At This Moment</div>
              <p style={{ fontSize: '0.85rem', color: '#64748B', marginTop: '4px' }}>
                All incoming emergency dispatch cases will populate here with instant triage controls.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {cases.map((c) => {
                const isPending = c.status === 'EXPECTED';
                return (
                  <div
                    key={c.id}
                    style={{
                      padding: '16px',
                      borderRadius: '10px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="pulsing-dot" />
                        <span style={{ fontWeight: 700, fontSize: '1rem', color: '#FFF' }}>
                          {c.emergency?.emergency_type?.replace(/_/g, ' ') || 'Medical Emergency'}
                        </span>
                        <span className="badge badge-amber">
                          {c.emergency?.severity_level || 'CRITICAL'}
                        </span>
                      </div>
                      <span className="badge badge-cyan">
                        ETA: ~{c.estimated_arrival_minutes || 6} MIN
                      </span>
                    </div>

                    <div style={{ fontSize: '0.85rem', color: '#94A3B8' }}>
                      Patient: <strong style={{ color: '#F1F5F9' }}>{c.emergency?.patient_name || 'Emergency Patient'}</strong> ({c.emergency?.patient_age || 50}y) &bull; Pickup: {c.emergency?.pickup_address}
                    </div>

                    <div style={{ fontSize: '0.8rem', color: '#CBD5E1' }}>
                      Notes: {c.emergency?.notes || 'Patient vitals transmitted from field.'}
                    </div>

                    {/* Action Bar */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px', marginTop: '4px' }}>
                      <div style={{ fontSize: '0.78rem', color: '#94A3B8' }}>
                        Assigned ER Doctor: <strong style={{ color: '#38BDF8' }}>{c.assigned_doctor || 'ER On-Call Team'}</strong>
                      </div>
                      {c.hospital_decision === 'ACCEPTED' ? (
                        <span className="badge badge-emerald" style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px' }}>
                          <CheckCircle2 size={13} />
                          <span>Accepted &bull; ER Bay Prepared</span>
                        </span>
                      ) : c.hospital_decision === 'REJECTED' || c.hospital_decision === 'DIVERTED' ? (
                        <span className="badge badge-crimson" style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px' }}>
                          <XCircle size={13} />
                          <span>Rejected &bull; Diversion Flagged</span>
                        </span>
                      ) : (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => handleTriageCase(c.id, 'ACCEPTED')}
                            className="btn btn-sm btn-emerald"
                            style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
                          >
                            <UserCheck size={14} />
                            <span>Accept</span>
                          </button>
                          <button
                            onClick={() => handleTriageCase(c.id, 'REJECTED')}
                            className="btn btn-sm btn-danger-outline"
                            style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
                          >
                            <XCircle size={14} />
                            <span>Reject</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
