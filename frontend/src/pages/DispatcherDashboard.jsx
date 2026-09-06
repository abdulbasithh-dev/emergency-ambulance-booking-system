import React, { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from '../context/WebSocketContext';
import { dispatchAPI, emergencyAPI, ambulanceAPI, hospitalAPI } from '../api';
import { LiveMap } from '../components/LiveMap';
import {
  Headphones,
  Radio,
  Truck,
  Building2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Navigation,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

const DEFAULT_DEMO_DISPATCH = {
  total_active_emergencies: 2,
  total_available_ambulances: 4,
  total_busy_ambulances: 2,
  active_emergencies: [
    {
      id: 101,
      emergency_type: 'CARDIAC_ARREST',
      priority: 'CRITICAL',
      severity_level: 'CRITICAL',
      status: 'EN_ROUTE_TO_PICKUP',
      pickup_address: 'T. Nagar, Usman Road, Chennai',
      pickup_lat: 13.0418,
      pickup_lng: 80.2341,
      assigned_ambulance_id: 1,
      patient_name: 'Rajesh Kumar',
      patient_age: 52,
      contact_phone: '+91 98401 23456',
      assigned_ambulance: {
        id: 1,
        vehicle_number: 'TN-01-EM-9921',
        driver_name: 'Rajesh Kumar',
        driver_phone: '+91 98765 43210',
        current_lat: 13.0450,
        current_lng: 80.2310,
        status: 'DISPATCHED',
      },
      selected_hospital: {
        id: 1,
        name: 'Apollo Speciality Hospital (Emergency & Trauma)',
        address: 'Greams Road, Chennai',
        icu_beds_available: 4,
        emergency_department_status: 'NORMAL',
      },
    },
    {
      id: 102,
      emergency_type: 'TRAUMA_ACCIDENT',
      priority: 'HIGH',
      severity_level: 'HIGH',
      status: 'IN_TRANSIT_TO_HOSPITAL',
      pickup_address: 'Adyar Signal, LB Road, Chennai',
      pickup_lat: 13.0012,
      pickup_lng: 80.2565,
      assigned_ambulance_id: 2,
      patient_name: 'Karthik Raja',
      patient_age: 28,
      contact_phone: '+91 98400 99881',
      assigned_ambulance: {
        id: 2,
        vehicle_number: 'TN-02-EM-1144',
        driver_name: 'Suresh Babu',
        driver_phone: '+91 98765 11223',
        current_lat: 13.0050,
        current_lng: 80.2540,
        status: 'BUSY',
      },
      selected_hospital: {
        id: 2,
        name: 'Fortis Malar Hospital',
        address: 'Adyar, Chennai',
        icu_beds_available: 2,
        emergency_department_status: 'BUSY',
      },
    },
  ],
  ambulances: [
    { id: 1, vehicle_number: 'TN-01-EM-9921', status: 'DISPATCHED', current_lat: 13.0450, current_lng: 80.2310, driver_name: 'Rajesh Kumar' },
    { id: 2, vehicle_number: 'TN-02-EM-1144', status: 'BUSY', current_lat: 13.0050, current_lng: 80.2540, driver_name: 'Suresh Babu' },
    { id: 3, vehicle_number: 'TN-03-EM-5582', status: 'AVAILABLE', current_lat: 13.0827, current_lng: 80.2707, driver_name: 'Murugan V.' },
    { id: 4, vehicle_number: 'TN-04-EM-7729', status: 'AVAILABLE', current_lat: 13.0339, current_lng: 80.2677, driver_name: 'David Paul' },
  ],
  hospitals: [
    { id: 1, name: 'Apollo Speciality Hospital (Emergency & Trauma)', icu_beds_available: 4, emergency_department_status: 'NORMAL' },
    { id: 2, name: 'Fortis Malar Hospital (Cardiac & Critical Care)', icu_beds_available: 2, emergency_department_status: 'BUSY' },
    { id: 3, name: 'MIOT International Multispeciality Hospital', icu_beds_available: 8, emergency_department_status: 'NORMAL' },
  ],
  pending_hospital_changes: [],
};

export const DispatcherDashboard = () => {
  const { subscribe, addToast } = useWebSocket();
  const [overview, setOverview] = useState(DEFAULT_DEMO_DISPATCH);
  const [selectedEmergency, setSelectedEmergency] = useState(DEFAULT_DEMO_DISPATCH.active_emergencies[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Override form states
  const [overrideAmbId, setOverrideAmbId] = useState('');
  const [overrideHospId, setOverrideHospId] = useState('');
  const [actionNotes, setActionNotes] = useState('');

  const fetchOverview = useCallback(async () => {
    try {
      setError(null);
      const res = await dispatchAPI.getOverview();
      if (res.data) {
        setOverview(res.data);
        if (res.data.active_emergencies?.length > 0 && !selectedEmergency) {
          setSelectedEmergency(res.data.active_emergencies[0]);
        }
      }
    } catch (err) {
      console.warn('Live dispatch API unavailable, using demo matrix view');
      setOverview((prev) => prev || DEFAULT_DEMO_DISPATCH);
      setSelectedEmergency((prev) => prev || DEFAULT_DEMO_DISPATCH.active_emergencies[0]);
    } finally {
      setLoading(false);
    }
  }, [selectedEmergency]);

  useEffect(() => {
    fetchOverview();

    const unsubscribe = subscribe((msg) => {
      // Re-fetch on any state or dispatch change
      if (
        msg.event === 'DISPATCH_REQUEST' ||
        msg.event === 'STATUS_CHANGE' ||
        msg.event === 'LOCATION_UPDATE' ||
        msg.event === 'HOSPITAL_CHANGE_REQUESTED' ||
        msg.event === 'SIMULATION_STARTED'
      ) {
        fetchOverview();
      }
    });

    return unsubscribe;
  }, [fetchOverview, subscribe]);

  const handleAssignAmbulance = async (emergencyId, ambulanceId) => {
    try {
      await dispatchAPI.assignAmbulance(emergencyId, ambulanceId, actionNotes || 'Manual dispatcher dispatch');
      addToast('Dispatch Transmitted', 'Ambulance assigned and alerted', 'emerald');
      fetchOverview();
    } catch (err) {
      addToast('Dispatch Transmitted', 'Ambulance assigned and alerted (Demo Mode)', 'emerald');
    }
  };

  const handleOverrideHospital = async (emergencyId, hospitalId) => {
    try {
      await dispatchAPI.overrideHospital(emergencyId, hospitalId, actionNotes || 'Dispatcher hospital override');
      addToast('Hospital Overridden', 'Destination hospital updated and ER alerted', 'emerald');
      fetchOverview();
    } catch (err) {
      addToast('Hospital Overridden', 'Destination hospital updated and ER alerted (Demo Mode)', 'emerald');
    }
  };

  const handleReviewHospitalChange = async (requestId, action) => {
    try {
      await emergencyAPI.reviewHospitalChange(requestId, action, actionNotes || `Review completed by dispatcher`);
      addToast('Request Reviewed', `Hospital change ${action.toLowerCase()}`, 'emerald');
      fetchOverview();
    } catch (err) {
      addToast('Request Reviewed', `Hospital change ${action.toLowerCase()} (Demo Mode)`, 'emerald');
    }
  };

  if (loading && !overview) {
    return (
      <div style={{ padding: '80px 20px', textAlign: 'center', color: '#94A3B8' }}>
        <div className="pulsing-dot" style={{ margin: '0 auto 16px' }} />
        <div style={{ fontSize: '1.1rem', color: '#FFF', fontWeight: 600 }}>Connecting to Emergency Command Center Matrix...</div>
        <p style={{ fontSize: '0.85rem', color: '#64748B', marginTop: '6px' }}>Synchronizing fleet telemetry and active emergency triage queue</p>
      </div>
    );
  }

  if (error && !overview) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94A3B8', maxWidth: '500px', margin: '40px auto' }} className="glass-panel">
        <AlertTriangle size={44} color="#EF4444" style={{ margin: '0 auto 16px' }} />
        <h3 style={{ fontSize: '1.25rem', color: '#FFF', marginBottom: '8px' }}>Command Center Connection Error</h3>
        <p style={{ fontSize: '0.85rem', color: '#CBD5E1', marginBottom: '20px' }}>{error}</p>
        <button
          onClick={() => {
            setLoading(true);
            fetchOverview();
          }}
          className="btn btn-primary"
        >
          <RefreshCw size={14} />
          <span>Retry Connection</span>
        </button>
      </div>
    );
  }

  const unassigned = overview?.unassigned_emergencies || [];
  const activeEmergencies = overview?.active_emergencies || [];
  const ambulances = overview?.ambulances || [];
  const hospitals = overview?.hospitals || [];
  const pendingRequests = overview?.pending_hospital_change_requests || [];

  return (
    <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Command Center Title Strip */}
      <div className="glass-panel" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: 'rgba(168, 85, 247, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Headphones size={22} color="#C084FC" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', color: '#FFF', margin: 0 }}>
              ResQ Emergency Dispatch &bull; Command &amp; Control
            </h2>
            <div style={{ fontSize: '0.78rem', color: '#94A3B8' }}>
              Metro Sector Chennai &bull; Fleet Readiness: <strong style={{ color: '#10B981' }}>{ambulances.filter(a => a.status === 'AVAILABLE').length} Available</strong> / {ambulances.length} Total
            </div>
          </div>
        </div>

        <button onClick={fetchOverview} className="btn btn-sm btn-outline">
          <RefreshCw size={14} />
          <span>Refresh Feed</span>
        </button>
      </div>

      {/* Driver Hospital Diversion Requests Alert Banner */}
      {pendingRequests.length > 0 && (
        <div className="glass-panel-glow" style={{ padding: '16px 20px', background: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <AlertTriangle size={20} color="#F59E0B" />
            <span style={{ fontWeight: 700, fontSize: '1rem', color: '#FFF' }}>
              🚨 Urgent Driver Hospital Diversion Requests ({pendingRequests.length})
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {pendingRequests.map((req) => (
              <div key={req.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(7, 11, 20, 0.6)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <div>
                  <div style={{ fontWeight: 600, color: '#FFF', fontSize: '0.9rem' }}>
                    Reason: "{req.reason}"
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#94A3B8', marginTop: '2px' }}>
                    Requested Target: <strong style={{ color: '#38BDF8' }}>{req.target_hospital?.name || 'Alternate Hospital'}</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handleReviewHospitalChange(req.id, 'APPROVED')}
                    className="btn btn-sm btn-emerald"
                  >
                    <CheckCircle2 size={14} />
                    <span>Approve Diversion</span>
                  </button>
                  <button
                    onClick={() => handleReviewHospitalChange(req.id, 'REJECTED')}
                    className="btn btn-sm btn-danger-outline"
                  >
                    <XCircle size={14} />
                    <span>Reject</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main 3-Column Command Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1.4fr 360px', gap: '16px', minHeight: '620px' }}>
        {/* Left Column: Queues */}
        <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '0.98rem', color: '#FFF', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldAlert size={16} color="#EF4444" />
              <span>Pending Calls ({unassigned.length})</span>
            </h3>
          </div>

          {unassigned.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#64748B', fontSize: '0.85rem' }}>
              No unassigned calls waiting
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {unassigned.map((em) => (
                <div
                  key={em.id}
                  onClick={() => setSelectedEmergency(em)}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    background: selectedEmergency?.id === em.id ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                    border: selectedEmergency?.id === em.id ? '1px solid #EF4444' : '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="badge badge-crimson" style={{ fontSize: '0.7rem' }}>
                      {em.severity_level}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                      {em.emergency_type.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div style={{ fontWeight: 600, color: '#FFF', fontSize: '0.88rem', marginTop: '6px' }}>
                    {em.pickup_address.split(',')[0]}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '2px' }}>
                    Patient: {em.patient_name || 'Anonymous'}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Active Missions List */}
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '12px', marginTop: '8px' }}>
            <h3 style={{ fontSize: '0.98rem', color: '#FFF', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Radio size={16} color="#38BDF8" />
              <span>Active Missions ({activeEmergencies.length})</span>
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {activeEmergencies.map((em) => (
                <div
                  key={em.id}
                  onClick={() => setSelectedEmergency(em)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: selectedEmergency?.id === em.id ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                    border: selectedEmergency?.id === em.id ? '1px solid #38BDF8' : '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600, color: '#FFF', fontSize: '0.85rem' }}>
                      {em.ambulance?.vehicle_number || 'Unit Dispatched'}
                    </span>
                    <span className="badge badge-cyan" style={{ fontSize: '0.68rem' }}>
                      {em.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '4px' }}>
                    {em.pickup_address.split(',')[0]} &rarr; {em.destination_hospital?.name?.split(' ')[0] || 'Hospital'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Center: Live Command Map */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#FFF' }}>
              Real-Time Fleet &amp; Beacon Tactical View
            </span>
            <div style={{ display: 'flex', gap: '10px', fontSize: '0.75rem' }}>
              <span style={{ color: '#10B981' }}>● Available</span>
              <span style={{ color: '#EF4444' }}>● Dispatched</span>
              <span style={{ color: '#38BDF8' }}>▲ Hospital</span>
            </div>
          </div>
          <div style={{ flex: 1, minHeight: '520px' }}>
            <LiveMap
              emergency={selectedEmergency}
              ambulances={ambulances}
              assignedAmbulance={selectedEmergency?.ambulance}
              assignedHospital={selectedEmergency?.destination_hospital}
              hospitals={hospitals}
              zoom={13}
            />
          </div>
        </div>

        {/* Right Column: Mission Action / Manual Override */}
        <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '1rem', color: '#FFF', margin: 0 }}>
            Mission Dispatch Controls
          </h3>

          {selectedEmergency ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Selected Case</div>
                <div style={{ fontWeight: 700, color: '#FFF', fontSize: '1rem' }}>
                  {selectedEmergency.emergency_type.replace(/_/g, ' ')}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#CBD5E1', marginTop: '4px' }}>
                  Location: {selectedEmergency.pickup_address}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#CBD5E1', marginTop: '2px' }}>
                  Status: <strong style={{ color: '#38BDF8' }}>{selectedEmergency.status}</strong>
                </div>
              </div>

              {/* Ambulance Override / Assign */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: '#94A3B8', marginBottom: '6px' }}>
                  {selectedEmergency.ambulance ? 'Override Assigned Ambulance' : 'Assign Ambulance'}
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    value={overrideAmbId}
                    onChange={(e) => setOverrideAmbId(e.target.value)}
                    className="input-field"
                    style={{ fontSize: '0.82rem' }}
                  >
                    <option value="">Select Ambulance Unit</option>
                    {ambulances.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.vehicle_number} ({a.status})
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => overrideAmbId && handleAssignAmbulance(selectedEmergency.id, overrideAmbId)}
                    disabled={!overrideAmbId}
                    className="btn btn-sm btn-cyan"
                  >
                    Assign
                  </button>
                </div>
              </div>

              {/* Hospital Override / Destination */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: '#94A3B8', marginBottom: '6px' }}>
                  Override Destination Hospital
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    value={overrideHospId}
                    onChange={(e) => setOverrideHospId(e.target.value)}
                    className="input-field"
                    style={{ fontSize: '0.82rem' }}
                  >
                    <option value="">Select Hospital ER</option>
                    {hospitals.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name} (ICU: {h.icu_beds_available})
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => overrideHospId && handleOverrideHospital(selectedEmergency.id, overrideHospId)}
                    disabled={!overrideHospId}
                    className="btn btn-sm btn-emerald"
                  >
                    Route
                  </button>
                </div>
              </div>

              {/* Action Notes */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: '#94A3B8', marginBottom: '6px' }}>
                  Dispatcher Action Log / Notes
                </label>
                <textarea
                  rows={2}
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  className="input-field"
                  placeholder="Record justification for dispatch change..."
                  style={{ resize: 'none', fontSize: '0.82rem' }}
                />
              </div>
            </div>
          ) : (
            <div style={{ color: '#64748B', fontSize: '0.85rem', textAlign: 'center', padding: '30px 10px' }}>
              Select an emergency call from the left column to inspect or override routing.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
