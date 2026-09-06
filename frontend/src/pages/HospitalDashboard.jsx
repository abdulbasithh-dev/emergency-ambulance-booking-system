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

export const HospitalDashboard = () => {
  const { user } = useAuth();
  const { subscribe, addToast } = useWebSocket();
  const [hospitals, setHospitals] = useState([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState(user?.hospital_id || '');
  const [hospital, setHospital] = useState(null);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingCapacity, setSavingCapacity] = useState(false);

  // Editable capacity state
  const [capacity, setCapacity] = useState({
    icu_beds_available: 5,
    general_beds_available: 20,
    ventilators_available: 4,
    status: 'NORMAL',
  });

  const fetchData = useCallback(async () => {
    try {
      const allHosp = await hospitalAPI.getAll();
      setHospitals(allHosp.data);

      const currentId = selectedHospitalId || (allHosp.data[0]?.id ?? '');
      if (!selectedHospitalId && allHosp.data[0]) {
        setSelectedHospitalId(allHosp.data[0].id);
      }

      if (currentId) {
        const hRes = await hospitalAPI.getOne(currentId);
        setHospital(hRes.data);
        setCapacity({
          icu_beds_available: hRes.data.icu_beds_available,
          general_beds_available: hRes.data.general_beds_available,
          ventilators_available: hRes.data.ventilators_available,
          status: hRes.data.emergency_department_status,
        });

        const caseRes = await hospitalAPI.getCases(currentId);
        setCases(caseRes.data);
      }
    } catch (err) {
      console.error('Error fetching hospital data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedHospitalId]);

  useEffect(() => {
    fetchData();

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

    return unsubscribe;
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
      addToast('Error', 'Failed to update capacity', 'crimson');
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
        'Dr. C. Srinivasan'
      );
      addToast('Triage Confirmed', `Case marked as ${action}`, 'emerald');
      fetchData();
    } catch (err) {
      addToast('Error', err.response?.data?.detail || 'Failed to triage case', 'crimson');
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
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => handleTriageCase(c.id, 'ACCEPTED')}
                          className="btn btn-sm btn-emerald"
                        >
                          <UserCheck size={14} />
                          <span>Accept &amp; Prep ER</span>
                        </button>
                        <button
                          onClick={() => handleTriageCase(c.id, 'DIVERTED')}
                          className="btn btn-sm btn-danger-outline"
                        >
                          <XCircle size={14} />
                          <span>Divert</span>
                        </button>
                      </div>
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
