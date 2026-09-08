import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Phone, Lock, User, ArrowRight, AlertCircle, HeartPulse, CheckCircle2 } from 'lucide-react';

export const CitizenAuthPage = ({ onLoginSuccess, bookingIntent = false }) => {
  const { citizenLogin, citizenRegister } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  
  // Login form state
  const [mobileNumber, setMobileNumber] = useState('9876543210');
  const [loginPassword, setLoginPassword] = useState('Password123!');
  
  // Register form state
  const [fullName, setFullName] = useState('');
  const [regMobile, setRegMobile] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // UI states
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const navigateToCitizen = (openBooking = false) => {
    const target = openBooking ? '/citizen?openBooking=true' : '/citizen';
    window.history.pushState(null, '', target);
    window.dispatchEvent(new PopStateEvent('popstate'));
    window.dispatchEvent(new CustomEvent('resq-route-change'));
    if (onLoginSuccess) {
      onLoginSuccess({ openBooking });
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanNumber = mobileNumber.replace(/\D/g, '');
    if (cleanNumber.length !== 10) {
      setErrorMsg('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (!loginPassword) {
      setErrorMsg('Please enter your password.');
      return;
    }

    setLoading(true);
    try {
      await citizenLogin(cleanNumber, loginPassword);
      setSuccessMsg('Login successful! Redirecting to Citizen Portal...');
      setTimeout(() => {
        navigateToCitizen(bookingIntent);
      }, 600);
    } catch (err) {
      console.error('Citizen login error:', err);
      const detail = err.response?.data?.detail;
      setErrorMsg(detail || 'Invalid mobile number or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!fullName.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    const cleanNumber = regMobile.replace(/\D/g, '');
    if (cleanNumber.length !== 10) {
      setErrorMsg('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (regPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }
    if (regPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please re-enter.');
      return;
    }

    setLoading(true);
    try {
      await citizenRegister({
        full_name: fullName.trim(),
        mobile_number: cleanNumber,
        password: regPassword,
        confirm_password: confirmPassword,
      });
      setSuccessMsg('Account created successfully! Redirecting...');
      setTimeout(() => {
        navigateToCitizen(bookingIntent);
      }, 700);
    } catch (err) {
      console.error('Registration error:', err);
      const detail = err.response?.data?.detail;
      setErrorMsg(detail || 'Registration failed. Mobile number may already exist.');
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
      background: 'radial-gradient(ellipse at 50% 30%, #15223D 0%, #080D1A 75%)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '460px',
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(16px)',
        borderRadius: '20px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), 0 0 30px rgba(239, 68, 68, 0.15)',
        padding: '36px 32px',
        color: '#FFF',
      }}>
        {/* Header Icon & Title */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #EF4444, #B91C1C)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px',
            boxShadow: '0 0 20px rgba(239, 68, 68, 0.4)',
          }}>
            <HeartPulse size={30} color="#FFF" />
          </div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, margin: '0 0 6px', letterSpacing: '-0.02em' }}>
            Citizen Emergency Portal
          </h1>
          <p style={{ fontSize: '0.9rem', color: '#94A3B8', margin: 0 }}>
            {bookingIntent
              ? 'Please sign in to request and book emergency ambulance assistance.'
              : 'Secure access to dispatch tracking and SOS emergency services.'}
          </p>
        </div>

        {/* Intent Badge if triggered by Book Ambulance */}
        {bookingIntent && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            borderRadius: '10px',
            padding: '10px 14px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.85rem',
            color: '#FCA5A5'
          }}>
            <span className="pulsing-dot" style={{ width: '8px', height: '8px', background: '#EF4444' }} />
            <span><strong>Booking Intent Active:</strong> You will be directed straight to ambulance dispatch right after login.</span>
          </div>
        )}

        {/* Mode Switcher Tabs */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          background: 'rgba(0, 0, 0, 0.3)',
          padding: '4px',
          borderRadius: '12px',
          marginBottom: '24px',
        }}>
          <button
            type="button"
            onClick={() => { setMode('login'); setErrorMsg(''); setSuccessMsg(''); }}
            style={{
              padding: '10px',
              borderRadius: '8px',
              border: 'none',
              background: mode === 'login' ? '#EF4444' : 'transparent',
              color: mode === 'login' ? '#FFF' : '#94A3B8',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            Citizen Login
          </button>
          <button
            type="button"
            onClick={() => { setMode('register'); setErrorMsg(''); setSuccessMsg(''); }}
            style={{
              padding: '10px',
              borderRadius: '8px',
              border: 'none',
              background: mode === 'register' ? '#EF4444' : 'transparent',
              color: mode === 'register' ? '#FFF' : '#94A3B8',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            Create Account
          </button>
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

        {/* LOGIN FORM */}
        {mode === 'login' ? (
          <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#CBD5E1', marginBottom: '6px' }}>
                Mobile Number
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <span style={{
                  position: 'absolute',
                  left: '14px',
                  color: '#64748B',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                }}>
                  <Phone size={16} />
                  <span>+91</span>
                </span>
                <input
                  type="tel"
                  maxLength={10}
                  placeholder="9876543210"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ''))}
                  style={{
                    width: '100%',
                    padding: '12px 14px 12px 76px',
                    borderRadius: '10px',
                    background: '#0B1120',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#FFF',
                    fontSize: '0.95rem',
                    letterSpacing: '0.04em',
                    outline: 'none',
                  }}
                  required
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#CBD5E1', marginBottom: '6px' }}>
                Password
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Lock size={16} color="#64748B" style={{ position: 'absolute', left: '14px' }} />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px 12px 42px',
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
              className="lifecare-btn-red"
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '10px',
                fontSize: '1rem',
                fontWeight: 700,
                marginTop: '6px',
                justifyContent: 'center',
              }}
            >
              <span>{loading ? 'Authenticating...' : 'Sign In as Citizen'}</span>
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
              <span>Demo ID: <strong>9876543210</strong> / <strong>Password123!</strong></span>
              <button
                type="button"
                onClick={() => { setMobileNumber('9876543210'); setLoginPassword('Password123!'); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#38BDF8',
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
        ) : (
          /* REGISTRATION FORM */
          <form onSubmit={handleRegisterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#CBD5E1', marginBottom: '6px' }}>
                Full Name
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <User size={16} color="#64748B" style={{ position: 'absolute', left: '14px' }} />
                <input
                  type="text"
                  placeholder="e.g. Kavitha Raman"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px 12px 42px',
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
                Mobile Number
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <span style={{
                  position: 'absolute',
                  left: '14px',
                  color: '#64748B',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                }}>
                  <Phone size={16} />
                  <span>+91</span>
                </span>
                <input
                  type="tel"
                  maxLength={10}
                  placeholder="9876543210"
                  value={regMobile}
                  onChange={(e) => setRegMobile(e.target.value.replace(/\D/g, ''))}
                  style={{
                    width: '100%',
                    padding: '12px 14px 12px 76px',
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
                Password
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Lock size={16} color="#64748B" style={{ position: 'absolute', left: '14px' }} />
                <input
                  type="password"
                  placeholder="Minimum 6 characters"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px 12px 42px',
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
                Confirm Password
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Lock size={16} color="#64748B" style={{ position: 'absolute', left: '14px' }} />
                <input
                  type="password"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px 12px 42px',
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
              className="lifecare-btn-red"
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '10px',
                fontSize: '1rem',
                fontWeight: 700,
                marginTop: '6px',
                justifyContent: 'center',
              }}
            >
              <span>{loading ? 'Creating Account...' : 'Register & Continue'}</span>
              <ArrowRight size={18} />
            </button>
          </form>
        )}

        {/* Security Assurance footer */}
        <div style={{
          marginTop: '24px',
          textAlign: 'center',
          fontSize: '0.76rem',
          color: '#64748B',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
        }}>
          <ShieldCheck size={14} color="#10B981" />
          <span>256-Bit Encrypted Medical Dispatch Network</span>
        </div>
      </div>
    </div>
  );
};
export default CitizenAuthPage;
