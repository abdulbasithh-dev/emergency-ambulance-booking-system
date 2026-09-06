import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../context/WebSocketContext';
import { simulationAPI } from '../api';
import {
  User,
  Truck,
  Building2,
  Headphones,
  ShieldCheck,
  Play,
  Square,
  Radio,
  LogOut,
  Sparkles,
} from 'lucide-react';

export const DemoControlBar = () => {
  const { user, demoLogin, logout } = useAuth();
  const { isConnected, addToast, subscribe } = useWebSocket();
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationData, setSimulationData] = useState(null);
  const [switchingRole, setSwitchingRole] = useState(false);

  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  // Track URL path changes
  useEffect(() => {
    const onLocationChange = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', onLocationChange);
    window.addEventListener('resq-route-change', onLocationChange);
    return () => {
      window.removeEventListener('popstate', onLocationChange);
      window.removeEventListener('resq-route-change', onLocationChange);
    };
  }, []);

  // Subscribe to simulation updates
  useEffect(() => {
    const unsubscribe = subscribe((msg) => {
      if (msg.event === 'SIMULATION_STARTED') {
        setIsSimulating(true);
        setSimulationData(msg.data);
      } else if (msg.event === 'SIMULATION_ENDED') {
        setIsSimulating(false);
      }
    });

    // Check status on mount
    simulationAPI.status().then((res) => {
      setIsSimulating(res.data.is_running);
      setSimulationData(res.data);
    }).catch(() => {});

    return unsubscribe;
  }, [subscribe]);

  const handleRoleSwitch = async (role) => {
    setSwitchingRole(true);
    const routeMap = {
      PORTAL: '/',
      CITIZEN: '/citizen',
      AMBULANCE_DRIVER: '/driver',
      HOSPITAL_STAFF: '/hospital',
      DISPATCHER: '/dispatcher',
      ADMIN: '/admin',
    };
    const targetPath = routeMap[role] || '/';
    window.history.pushState(null, '', targetPath);
    setCurrentPath(targetPath);
    window.dispatchEvent(new PopStateEvent('popstate'));
    window.dispatchEvent(new CustomEvent('resq-route-change'));

    try {
      if (role === 'PORTAL') {
        logout();
        addToast('Front Portal', 'Viewing Life Care public front dashboard', 'crimson');
        return;
      }
      await demoLogin(role);
      const roleLabels = {
        CITIZEN: 'Citizen (Patient View)',
        AMBULANCE_DRIVER: 'Ambulance Driver Cockpit',
        HOSPITAL_STAFF: 'Hospital Emergency Room',
        DISPATCHER: 'Central Dispatch Command',
        ADMIN: 'Admin Control Center',
      };
      addToast('Role Switched', `Swapped context to ${roleLabels[role] || role}`, 'emerald');
    } catch (err) {
      console.warn('Role switch caught note:', err);
    } finally {
      setSwitchingRole(false);
    }
  };

  const handleToggleSimulation = async () => {
    try {
      if (isSimulating) {
        try { await simulationAPI.stop(); } catch {}
        setIsSimulating(false);
        addToast('Simulation Stopped', 'Manual halt of active simulation', 'amber');
      } else {
        try {
          const res = await simulationAPI.start('CARDIAC_ARREST', 'CRITICAL', 3);
          setSimulationData(res.data);
        } catch (simErr) {
          console.warn('Simulation backend unavailable, running client simulation:', simErr);
          setSimulationData({ is_running: true, simulation_type: 'CARDIAC_ARREST' });
        }
        setIsSimulating(true);
        addToast('Simulation Launched', 'Real-time GPS waypoints and status changes active', 'emerald');
      }
    } catch (err) {
      console.error(err);
      addToast('Simulation Error', 'Failed to toggle simulation', 'amber');
    }
  };

  const roles = [
    { key: 'PORTAL', label: 'Front Portal', icon: Sparkles, color: '#EF4444' },
    { key: 'CITIZEN', label: 'Citizen', icon: User, color: '#38BDF8' },
    { key: 'AMBULANCE_DRIVER', label: 'Driver', icon: Truck, color: '#F59E0B' },
    { key: 'HOSPITAL_STAFF', label: 'Hospital', icon: Building2, color: '#10B981' },
    { key: 'DISPATCHER', label: 'Dispatcher', icon: Headphones, color: '#A855F7' },
    { key: 'ADMIN', label: 'Admin', icon: ShieldCheck, color: '#EF4444' },
  ];

  const cleanPath = (currentPath || window.location.pathname).replace(/^\//, '').toLowerCase().split('/')[0];
  const pathToRole = {
    '': 'PORTAL',
    'home': 'PORTAL',
    'portal': 'PORTAL',
    'citizen': 'CITIZEN',
    'user': 'CITIZEN',
    'driver': 'AMBULANCE_DRIVER',
    'hospital': 'HOSPITAL_STAFF',
    'dispatcher': 'DISPATCHER',
    'admin': 'ADMIN',
  };
  const activeRoleKey = pathToRole[cleanPath] || user?.role || 'PORTAL';

  return (
    <header className="demo-bar" role="banner">
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            background: 'linear-gradient(135deg, #EF4444, #DC2626)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 10px rgba(239, 68, 68, 0.4)'
          }}>
            <Sparkles size={16} color="#FFF" />
          </div>
          <div>
            <span style={{ fontWeight: 800, fontFamily: 'var(--font-heading)', fontSize: '1.1rem', letterSpacing: '-0.02em', color: '#FFF' }}>
              Res<span style={{ color: '#EF4444' }}>Q</span>
            </span>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginLeft: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              DEMO SWITCHER
            </span>
          </div>
        </div>

        {/* WebSocket Connection Status */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '3px 8px',
          borderRadius: '999px',
          background: 'rgba(255, 255, 255, 0.05)',
          fontSize: '0.75rem',
          color: isConnected ? '#34D399' : '#38BDF8'
        }}>
          <span style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            backgroundColor: isConnected ? '#10B981' : '#38BDF8',
            boxShadow: isConnected ? '0 0 6px #10B981' : '0 0 6px #38BDF8'
          }} />
          {isConnected ? 'LIVE WS' : 'DEMO MODE'}
        </div>
      </div>

      {/* Role Selection Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginRight: '4px' }}>
          Role:
        </span>
        {roles.map((r) => {
          const Icon = r.icon;
          const isActive = r.key === activeRoleKey;
          return (
            <button
              key={r.key}
              onClick={() => handleRoleSwitch(r.key)}
              disabled={switchingRole}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 10px',
                fontSize: '0.8rem',
                fontWeight: 600,
                borderRadius: '6px',
                border: isActive ? `1px solid ${r.color}` : '1px solid rgba(255, 255, 255, 0.1)',
                background: isActive ? `${r.color}25` : 'rgba(255, 255, 255, 0.03)',
                color: isActive ? '#FFF' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <Icon size={13} color={isActive ? r.color : '#94A3B8'} />
              <span>{r.label}</span>
            </button>
          );
        })}
      </div>

      {/* 1-Click Simulation Button & User Profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          onClick={handleToggleSimulation}
          className={`btn btn-sm ${isSimulating ? 'btn-danger-outline' : 'btn-emerald'}`}
          style={{ fontSize: '0.82rem', padding: '6px 14px' }}
        >
          {isSimulating ? (
            <>
              <Square size={13} fill="#EF4444" color="#EF4444" />
              <span>Stop Simulation</span>
            </>
          ) : (
            <>
              <Play size={13} fill="#FFF" color="#FFF" />
              <span>▶ 1-Click Live Simulation</span>
            </>
          )}
        </button>

        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderLeft: '1px solid var(--border-subtle)', paddingLeft: '12px' }}>
            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#FFF' }}>{user.full_name}</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{user.email}</span>
            </div>
            <button
              onClick={logout}
              title="Sign Out"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
