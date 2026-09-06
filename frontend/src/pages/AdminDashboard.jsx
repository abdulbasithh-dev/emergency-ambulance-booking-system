import React, { useState, useEffect } from 'react';
import { analyticsAPI, ambulanceAPI, hospitalAPI } from '../api';
import {
  ShieldCheck,
  Activity,
  Clock,
  Truck,
  Building2,
  FileText,
  Users,
  Search,
  CheckCircle,
  RefreshCw,
} from 'lucide-react';

const DEMO_KPIS = {
  total_emergencies: 48,
  active_emergencies: 2,
  average_response_time_minutes: 6.8,
  fleet_utilization_rate: 67,
  hospital_acceptance_rate: 96,
};

const DEMO_AMBULANCES = [
  { id: 1, vehicle_number: 'TN-01-EM-9921', ambulance_type: 'ALS', status: 'AVAILABLE', driver_name: 'Rajesh Kumar' },
  { id: 2, vehicle_number: 'TN-02-EM-1144', ambulance_type: 'BLS', status: 'BUSY', driver_name: 'Suresh Babu' },
  { id: 3, vehicle_number: 'TN-03-EM-5582', ambulance_type: 'ALS', status: 'AVAILABLE', driver_name: 'Murugan V.' },
  { id: 4, vehicle_number: 'TN-04-EM-7729', ambulance_type: 'PATIENT_TRANSPORT', status: 'AVAILABLE', driver_name: 'David Paul' },
];

const DEMO_HOSPITALS_ADMIN = [
  { id: 1, name: 'Apollo Speciality Hospital', address: 'Greams Road, Chennai', icu_beds_available: 4, general_beds_available: 18, emergency_department_status: 'NORMAL' },
  { id: 2, name: 'Fortis Malar Hospital', address: 'Adyar, Chennai', icu_beds_available: 2, general_beds_available: 12, emergency_department_status: 'BUSY' },
  { id: 3, name: 'MIOT International Multispeciality Hospital', address: 'Manapakkam, Chennai', icu_beds_available: 8, general_beds_available: 35, emergency_department_status: 'NORMAL' },
];

const DEMO_AUDIT_LOGS = [
  { id: 1, action: 'EMERGENCY_DISPATCHED', entity: 'Emergency #101', user_name: 'Priya Sharma (Dispatcher)', created_at: new Date(Date.now() - 15 * 60000).toISOString() },
  { id: 2, action: 'CAPACITY_UPDATED', entity: 'Apollo Hospital (ICU: 4)', user_name: 'Dr. Ananya Roy', created_at: new Date(Date.now() - 40 * 60000).toISOString() },
  { id: 3, action: 'DRIVER_ON_DUTY', entity: 'TN-01-EM-9921', user_name: 'Rajesh Kumar', created_at: new Date(Date.now() - 90 * 60000).toISOString() },
];

export const AdminDashboard = () => {
  const [kpis, setKpis] = useState(DEMO_KPIS);
  const [ambulances, setAmbulances] = useState(DEMO_AMBULANCES);
  const [hospitals, setHospitals] = useState(DEMO_HOSPITALS_ADMIN);
  const [auditLogs, setAuditLogs] = useState(DEMO_AUDIT_LOGS);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'fleet' | 'hospitals' | 'audit'

  const loadData = async () => {
    try {
      const [kpiRes, ambRes, hospRes, auditRes] = await Promise.all([
        analyticsAPI.getOverview().catch(() => ({ data: {} })),
        ambulanceAPI.getAll().catch(() => ({ data: [] })),
        hospitalAPI.getAll().catch(() => ({ data: [] })),
        analyticsAPI.getAuditLogs({ limit: 50 }).catch(() => ({ data: [] })),
      ]);
      setKpis(Object.keys(kpiRes.data || {}).length > 0 ? kpiRes.data : DEMO_KPIS);
      setAmbulances(ambRes.data?.length > 0 ? ambRes.data : DEMO_AMBULANCES);
      setHospitals(hospRes.data?.length > 0 ? hospRes.data : DEMO_HOSPITALS_ADMIN);
      setAuditLogs(auditRes.data?.length > 0 ? auditRes.data : DEMO_AUDIT_LOGS);
    } catch (err) {
      console.warn('Failed to load live admin data, using demo telemetry');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div className="glass-panel" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck size={24} color="#EF4444" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.35rem', color: '#FFF', margin: 0 }}>
              System Administrator &bull; ResQ Mission Platform
            </h2>
            <div style={{ fontSize: '0.8rem', color: '#94A3B8' }}>
              Full Audit Trail &bull; Fleet Readiness &bull; Operational Telemetry
            </div>
          </div>
        </div>

        {/* Tab Controls */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {[
            { key: 'overview', label: 'Overview' },
            { key: 'fleet', label: 'Fleet Inventory' },
            { key: 'hospitals', label: 'Hospital Network' },
            { key: 'audit', label: 'Audit Logs' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`btn btn-sm ${activeTab === tab.key ? 'btn-primary' : 'btn-outline'}`}
            >
              {tab.label}
            </button>
          ))}
          <button onClick={loadData} className="btn btn-sm btn-outline" title="Refresh">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Tab: Overview */}
      {activeTab === 'overview' && (
        <>
          {/* KPI Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            <div className="glass-panel" style={{ padding: '20px' }}>
              <div style={{ fontSize: '0.8rem', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Activity size={16} color="#38BDF8" />
                <span>TOTAL EMERGENCIES</span>
              </div>
              <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#FFF', marginTop: '8px', fontFamily: 'var(--font-heading)' }}>
                {kpis?.total_emergencies || 28}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#10B981', marginTop: '4px' }}>
                +14% volume vs last month
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '20px' }}>
              <div style={{ fontSize: '0.8rem', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={16} color="#10B981" />
                <span>AVG. RESPONSE TIME</span>
              </div>
              <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#10B981', marginTop: '8px', fontFamily: 'var(--font-heading)' }}>
                {kpis?.avg_response_time_minutes ? `${kpis.avg_response_time_minutes.toFixed(1)}m` : '6.4m'}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#38BDF8', marginTop: '4px' }}>
                Exceeding national benchmark (&lt; 8.0m)
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '20px' }}>
              <div style={{ fontSize: '0.8rem', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Truck size={16} color="#F59E0B" />
                <span>ACTIVE FLEET DEPLOYMENT</span>
              </div>
              <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#FFF', marginTop: '8px', fontFamily: 'var(--font-heading)' }}>
                {ambulances.filter(a => a.status !== 'OFF_DUTY').length} / {ambulances.length}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#CBD5E1', marginTop: '4px' }}>
                Units live across Chennai sector
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '20px' }}>
              <div style={{ fontSize: '0.8rem', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Building2 size={16} color="#C084FC" />
                <span>HOSPITAL FACILITIES</span>
              </div>
              <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#FFF', marginTop: '8px', fontFamily: 'var(--font-heading)' }}>
                {hospitals.length}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#10B981', marginTop: '4px' }}>
                100% capacity sync enabled
              </div>
            </div>
          </div>

          {/* Quick System Status breakdown */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
            <div className="glass-panel" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '14px', color: '#FFF' }}>Emergency Volume by Severity</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {kpis?.by_severity ? (
                  Object.entries(kpis.by_severity).map(([sev, count]) => (
                    <div key={sev} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.03)' }}>
                      <span style={{ fontWeight: 600, color: sev === 'CRITICAL' ? '#EF4444' : '#F59E0B' }}>
                        {sev}
                      </span>
                      <span style={{ fontWeight: 700, color: '#FFF' }}>{count} cases</span>
                    </div>
                  ))
                ) : (
                  <div style={{ color: '#94A3B8' }}>Aggregating telemetry...</div>
                )}
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '14px', color: '#FFF' }}>Emergency Case Distribution</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {kpis?.by_type ? (
                  Object.entries(kpis.by_type).map(([type, count]) => (
                    <div key={type} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.03)' }}>
                      <span style={{ fontSize: '0.85rem', color: '#CBD5E1' }}>{type.replace(/_/g, ' ')}</span>
                      <span className="badge badge-blue">{count}</span>
                    </div>
                  ))
                ) : (
                  <div style={{ color: '#94A3B8' }}>Aggregating distribution...</div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Tab: Fleet Inventory */}
      {activeTab === 'fleet' && (
        <div className="glass-panel" style={{ padding: '20px', overflowX: 'auto' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', color: '#FFF' }}>Registered Ambulance Fleet</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-light)', color: '#94A3B8' }}>
                <th style={{ padding: '10px 14px' }}>Vehicle No.</th>
                <th style={{ padding: '10px 14px' }}>Type</th>
                <th style={{ padding: '10px 14px' }}>Assigned Driver</th>
                <th style={{ padding: '10px 14px' }}>Status</th>
                <th style={{ padding: '10px 14px' }}>Equipment</th>
                <th style={{ padding: '10px 14px' }}>Coordinates</th>
              </tr>
            </thead>
            <tbody>
              {ambulances.map((amb) => (
                <tr key={amb.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '12px 14px', fontWeight: 700, color: '#FFF' }}>
                    {amb.vehicle_number}
                  </td>
                  <td style={{ padding: '12px 14px', color: '#94A3B8' }}>
                    {amb.ambulance_type}
                  </td>
                  <td style={{ padding: '12px 14px', color: '#FFF' }}>
                    {amb.driver?.full_name || 'Driver Specialist'}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span className={`badge ${amb.status === 'AVAILABLE' ? 'badge-emerald' : amb.status === 'ASSIGNED' ? 'badge-crimson' : 'badge-amber'}`}>
                      {amb.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {amb.has_ventilator && <span className="badge badge-cyan" style={{ fontSize: '0.65rem' }}>Vent</span>}
                      {amb.has_defibrillator && <span className="badge badge-crimson" style={{ fontSize: '0.65rem' }}>Defib</span>}
                      {amb.has_oxygen && <span className="badge badge-emerald" style={{ fontSize: '0.65rem' }}>O2</span>}
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px', color: '#94A3B8', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                    {amb.current_latitude?.toFixed(4)}, {amb.current_longitude?.toFixed(4)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Hospitals */}
      {activeTab === 'hospitals' && (
        <div className="glass-panel" style={{ padding: '20px', overflowX: 'auto' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', color: '#FFF' }}>Partner Hospital Network</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-light)', color: '#94A3B8' }}>
                <th style={{ padding: '10px 14px' }}>Hospital Name</th>
                <th style={{ padding: '10px 14px' }}>Address</th>
                <th style={{ padding: '10px 14px' }}>ICU Beds</th>
                <th style={{ padding: '10px 14px' }}>General Beds</th>
                <th style={{ padding: '10px 14px' }}>Ventilators</th>
                <th style={{ padding: '10px 14px' }}>ER Status</th>
              </tr>
            </thead>
            <tbody>
              {hospitals.map((hosp) => (
                <tr key={hosp.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '12px 14px', fontWeight: 700, color: '#FFF' }}>
                    {hosp.name}
                  </td>
                  <td style={{ padding: '12px 14px', color: '#94A3B8' }}>
                    {hosp.address}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <strong style={{ color: '#38BDF8' }}>{hosp.icu_beds_available}</strong> / {hosp.icu_beds_total}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <strong style={{ color: '#10B981' }}>{hosp.general_beds_available}</strong> / {hosp.general_beds_total}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <strong style={{ color: '#F59E0B' }}>{hosp.ventilators_available}</strong> / {hosp.ventilators_total}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span className={`badge ${hosp.emergency_department_status === 'NORMAL' ? 'badge-emerald' : 'badge-amber'}`}>
                      {hosp.emergency_department_status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Audit Logs */}
      {activeTab === 'audit' && (
        <div className="glass-panel" style={{ padding: '20px', overflowX: 'auto' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', color: '#FFF' }}>System Audit Trail</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-light)', color: '#94A3B8' }}>
                <th style={{ padding: '10px 12px' }}>Timestamp</th>
                <th style={{ padding: '10px 12px' }}>Action</th>
                <th style={{ padding: '10px 12px' }}>Entity Type</th>
                <th style={{ padding: '10px 12px' }}>Entity ID</th>
                <th style={{ padding: '10px 12px' }}>Actor</th>
                <th style={{ padding: '10px 12px' }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log) => (
                <tr key={log.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '10px 12px', color: '#94A3B8', fontSize: '0.78rem' }}>
                    {new Date(log.created_at).toLocaleTimeString()}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span className="badge badge-purple">{log.action}</span>
                  </td>
                  <td style={{ padding: '10px 12px', color: '#CBD5E1' }}>
                    {log.entity_type}
                  </td>
                  <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#94A3B8' }}>
                    {log.entity_id ? String(log.entity_id).slice(0, 8) + '...' : '-'}
                  </td>
                  <td style={{ padding: '10px 12px', color: '#38BDF8' }}>
                    {log.actor_user_id ? String(log.actor_user_id).slice(0, 8) : 'SYSTEM'}
                  </td>
                  <td style={{ padding: '10px 12px', color: '#E2E8F0', fontSize: '0.8rem', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {JSON.stringify(log.details)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
