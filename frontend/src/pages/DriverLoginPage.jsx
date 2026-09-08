import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Truck, Lock, UserCheck, ArrowRight, AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react';

export const DriverLoginPage = ({ onLoginSuccess }) => {
  const { driverLogin } = useAuth();
  
  const [identifier, setIdentifier] = useState('DRV-101');
  const [password, setPassword] = useState('Password123!');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const navigateToDriver = () => {
    window.history.pushState(null, '', '/driver');
    window.dispatchEvent(new PopStateEvent('popstate'));
    window.dispatchEvent(new CustomEvent('resq-route-change'));
    if (onLoginSuccess) {
      onLoginSuccess();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!identifier.trim()) {
      setErrorMsg('Please enter your Driver ID or registered Mobile Number.');
      return;
    }
    if (!password) {
      setErrorMsg('Please enter your password.');
      return;
    }

    setLoading(true);
    try {
      await driverLogin(identifier.trim(), password);
      setSuccessMsg('Driver authenticated! Launching cockpit...');
      setTimeout(() => {
        navigateToDriver();
      }, 600);
    } catch (err) {
      console.error('Driver login error:', err);
      const detail = err.response?.data?.detail;
      setErrorMsg(detail || 'Invalid Driver ID / Mobile Number or password. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: 'calc(100vh - 60px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
      background: 'radial-gradient(ellipse at 50% 30%, #291B07 0%, #080D1A 75%)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '460px',
        background: 'rgba(15, 23, 42, 0.9)',
        backdropFilter: 'blur(16px)',
        borderRadius: '20px',
        border: '1px solid rgba(245, 158, 11, 0.25)',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7), 0 0 30px rgba(245, 158, 11, 0.15)',
        padding: '36px 32px',
        color: '#FFF',
      }}>
        {/* Cockpit Badge & Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #F59E0B, #D97706)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px',
            boxShadow: '0 0 20px rgba(245, 158, 11, 0.4)',
          }}>
            <Truck size={30} color="#FFF" />
          </div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 12px',
            borderRadius: '999px',
            background: 'rgba(245, 158, 11, 0.15)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            color: '#FBBF24',
            fontSize: '0.76rem',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: '8px',
          }}>
            <span className="pulsing-dot" style={{ width: '6px', height: '6px', background: '#F59E0B' }} />
            ALS / BLS FLEET COCKPIT
          </div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, margin: '0 0 6px', letterSpacing: '-0.02em' }}>
            Ambulance Driver Login
          </h1>
          <p style={{ fontSize: '0.9rem', color: '#94A3B8', margin: 0 }}>
            Sign in to access your assigned vehicle telemetry, duty switcher, and real-time emergency dispatch queue.
          </p>
        </div>

        {/* Feedback Alerts */}
        {errorMsg && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid #EF4444',
            color: '#FCA5A5',
            padding: '12px 14px',
            borderRadius: '10px',
            fontSize: '0.86rem',
            marginBottom: '18px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid #10B981',
            color: '#6EE7B7',
            padding: '12px 14px',
            borderRadius: '10px',
            fontSize: '0.86rem',
            marginBottom: '18px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* DRIVER LOGIN FORM */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#CBD5E1', marginBottom: '6px' }}>
              Driver ID or Mobile Number
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <UserCheck size={18} color="#F59E0B" style={{ position: 'absolute', left: '14px' }} />
              <input
                type="text"
                placeholder="e.g. DRV-101 or 9840022222"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 14px 12px 44px',
                  borderRadius: '10px',
                  background: '#0B1120',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#FFF',
                  fontSize: '0.95rem',
                  outline: 'none',
                }}
                required
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#CBD5E1', marginBottom: '6px' }}>
              Cockpit Password
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Lock size={18} color="#F59E0B" style={{ position: 'absolute', left: '14px' }} />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 14px 12px 44px',
                  borderRadius: '10px',
                  background: '#0B1120',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#FFF',
                  fontSize: '0.95rem',
                  outline: 'none',
                }}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '10px',
              fontSize: '1rem',
              fontWeight: 700,
              marginTop: '6px',
              background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
              color: '#000',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              boxShadow: '0 4px 14px rgba(245, 158, 11, 0.4)',
              transition: 'all 0.2s',
            }}
          >
            <span>{loading ? 'Authenticating...' : 'Sign In to Driver Cockpit'}</span>
            <ArrowRight size={18} />
          </button>

          {/* Quick Demo Fill Helper */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.04)',
            borderRadius: '8px',
            padding: '10px 14px',
            fontSize: '0.78rem',
            color: '#94A3B8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span>Driver Demo: <strong>DRV-101</strong> / <strong>Password123!</strong></span>
            <button
              type="button"
              onClick={() => { setIdentifier('DRV-101'); setPassword('Password123!'); }}
              style={{
                background: 'none',
                border: 'none',
                color: '#FBBF24',
                fontWeight: 700,
                fontSize: '0.78rem',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              Use Demo
            </button>
          </div>
        </form>

        {/* Driver Notice */}
        <div style={{
          marginTop: '24px',
          padding: '12px',
          borderRadius: '8px',
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          fontSize: '0.78rem',
          color: '#FDE68A',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '8px',
          lineHeight: 1.4,
        }}>
          <ShieldAlert size={16} color="#F59E0B" style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>
            <strong>Duty Status Policy:</strong> Upon initial sign-in, duty defaults to <strong>OFF DUTY</strong>. Toggle to <strong>ON DUTY</strong> to receive and accept dispatched calls.
          </span>
        </div>
      </div>
    </div>
  );
};
export default DriverLoginPage;
