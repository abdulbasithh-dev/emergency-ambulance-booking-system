import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { emergencyAPI } from '../api';
import { LiveMap } from '../components/LiveMap';
import {
  PhoneCall,
  ArrowRight,
  MapPin,
  Clock,
  Zap,
  ShieldCheck,
  UserCheck,
  Activity,
  Truck,
  HeartPulse,
  Search,
  CheckCircle2,
  Building2,
  Radio,
  Sparkles,
} from 'lucide-react';

export const LandingPage = ({ onOpenEmergencyModal }) => {
  const { user, demoLogin } = useAuth();
  const [activeNav, setActiveNav] = useState('Home');
  const [bookingIdInput, setBookingIdInput] = useState('');
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingFeedback, setTrackingFeedback] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState({
    name: 'Potheri (SRM)',
    lat: 12.8235,
    lng: 80.0445,
    address: '41, Potheri, SRM University Campus, Chennai',
  });

  const handleBookNow = async (serviceType = 'CARDIAC_ARREST') => {
    try {
      if (!user) {
        await demoLogin('CITIZEN');
      }
      onOpenEmergencyModal();
    } catch (err) {
      console.error('Failed to initialize booking:', err);
      onOpenEmergencyModal();
    }
  };

  const handleTrackSubmit = async (e) => {
    if (e) e.preventDefault();
    setTrackingLoading(true);
    setTrackingFeedback(null);

    try {
      if (!user) {
        await demoLogin('CITIZEN');
      }
      // If a specific ID is entered, or default to checking active
      setTrackingFeedback({
        success: true,
        message: 'Redirecting to live vehicle radar...',
      });
      setTimeout(() => {
        window.history.pushState(null, '', '/citizen');
        window.dispatchEvent(new PopStateEvent('popstate'));
      }, 600);
    } catch (err) {
      setTrackingFeedback({
        success: false,
        message: 'Could not find booking. Launching live fleet radar...',
      });
      setTimeout(() => {
        demoLogin('CITIZEN');
      }, 1000);
    } finally {
      setTrackingLoading(false);
    }
  };

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="lifecare-portal">
      {/* 1. Life Care Top Navigation Bar */}
      <nav className="lifecare-header">
        <div style={{
          maxWidth: '1280px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          {/* Logo Branding */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => scrollToSection('hero-section')}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: '#EF4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(239, 68, 68, 0.45)',
            }}>
              {/* Crisp Medical Cross Emblem */}
              <div style={{ position: 'relative', width: '20px', height: '20px' }}>
                <div style={{ position: 'absolute', top: '7px', left: '0', width: '20px', height: '6px', background: '#FFF', borderRadius: '2px' }} />
                <div style={{ position: 'absolute', top: '0', left: '7px', width: '6px', height: '20px', background: '#FFF', borderRadius: '2px' }} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, letterSpacing: '-0.02em', color: '#FFF', lineHeight: 1.1 }}>
                LIFE <span style={{ color: '#EF4444' }}>CARE</span>
              </div>
              <div style={{ fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.12em', color: '#94A3B8', textTransform: 'uppercase' }}>
                AMBULANCE SERVICE
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
            {[
              { name: 'Home', action: () => scrollToSection('hero-section') },
              { name: 'About Us', action: () => scrollToSection('trust-section') },
              { name: 'Live Ambulance', action: () => scrollToSection('ambulance-radar-section') },
              { name: 'Track Ambulance', action: () => scrollToSection('track-section') },
              { name: 'Hospitals', action: () => handleBookNow() },
              { name: 'Contact Us', action: () => window.open('tel:+911234567890') },
            ].map((item) => (
              <button
                key={item.name}
                onClick={() => {
                  setActiveNav(item.name);
                  item.action();
                }}
                className={`lifecare-nav-link ${activeNav === item.name ? 'active' : ''}`}
              >
                {item.name}
              </button>
            ))}
          </div>

          {/* Right Hotline & Book Now Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* 24/7 Helpline Pill */}
            <a href="tel:+911234567890" className="lifecare-phone-pill" title="Call 24/7 Emergency Helpline">
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: '#EF4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFF',
                boxShadow: '0 0 10px rgba(239, 68, 68, 0.4)'
              }}>
                <PhoneCall size={16} />
              </div>
              <div>
                <div style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 600, letterSpacing: '0.04em' }}>
                  24/7 Emergency
                </div>
                <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#FFF', letterSpacing: '-0.01em' }}>
                  +91 12345 67890
                </div>
              </div>
            </a>

            {/* Primary CTA Book Now */}
            <button
              onClick={() => handleBookNow()}
              className="lifecare-btn-red"
              style={{ padding: '10px 22px', fontSize: '0.92rem' }}
            >
              <span>Book Now</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </nav>

      {/* 2. Hero Section */}
      <header
        id="hero-section"
        style={{
          position: 'relative',
          padding: '70px 24px 100px',
          background: 'radial-gradient(ellipse at 80% 40%, #15223D 0%, #080D1A 70%)',
          overflow: 'hidden',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        }}
      >
        {/* Soft Ambient Light Cone */}
        <div style={{
          position: 'absolute',
          top: '-80px',
          right: '5%',
          width: '500px',
          height: '450px',
          background: 'radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, rgba(239, 68, 68, 0.1) 40%, transparent 70%)',
          filter: 'blur(70px)',
          pointerEvents: 'none',
        }} />

        <div style={{
          maxWidth: '1280px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: '40px',
          alignItems: 'center',
          position: 'relative',
          zIndex: 2,
        }}>
          {/* Left Hero Typography */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Top Pill Tag */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              borderRadius: '999px',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              width: 'fit-content'
            }}>
              <span className="pulsing-dot" style={{ width: '8px', height: '8px', background: '#EF4444' }} />
              <span style={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.08em', color: '#FCA5A5' }}>
                24/7 EMERGENCY SERVICE
              </span>
            </div>

            {/* Main Headline */}
            <h1 style={{
              fontSize: 'clamp(2.5rem, 5vw, 4.2rem)',
              fontWeight: 900,
              lineHeight: 1.12,
              letterSpacing: '-0.03em',
              color: '#FFFFFF',
              margin: 0,
            }}>
              We're Here When <br />
              <span style={{ color: '#EF4444' }}>Every Second</span> Counts
            </h1>

            {/* Subtitle */}
            <p style={{
              fontSize: '1.15rem',
              color: '#94A3B8',
              lineHeight: 1.6,
              maxWidth: '520px',
              margin: 0,
            }}>
              Fast, reliable and compassionate emergency ambulance service available 24/7 for your safety.
            </p>

            {/* Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginTop: '10px' }}>
              <button
                onClick={() => handleBookNow()}
                className="lifecare-btn-red"
                style={{
                  fontSize: '1.05rem',
                  padding: '14px 30px',
                  borderRadius: '12px',
                }}
              >
                <span>Book Ambulance</span>
                <ArrowRight size={18} />
              </button>

              <button
                onClick={() => scrollToSection('track-section')}
                className="lifecare-btn-outline"
                style={{
                  fontSize: '1.05rem',
                  padding: '14px 28px',
                  borderRadius: '12px',
                }}
              >
                <span>Track Ambulance</span>
                <MapPin size={18} color="#EF4444" />
              </button>
            </div>
          </div>

          {/* Right Hero Image: Speeding ALS Ambulance */}
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
            {/* Strobe Beacon Glow behind vehicle */}
            <div style={{
              position: 'absolute',
              top: '15%',
              left: '10%',
              width: '80%',
              height: '70%',
              background: 'radial-gradient(ellipse, rgba(239, 68, 68, 0.25) 0%, rgba(59, 130, 246, 0.2) 50%, transparent 80%)',
              filter: 'blur(50px)',
              pointerEvents: 'none',
              zIndex: 1,
            }} />

            <div style={{
              position: 'relative',
              zIndex: 2,
              borderRadius: '20px',
              overflow: 'hidden',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.7), 0 0 35px rgba(239, 68, 68, 0.25)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              width: '100%',
              maxWidth: '580px',
              transition: 'transform 0.4s ease',
            }}>
              <img
                src="/images/hero-ambulance.jpg"
                alt="High-speed Life Care Emergency Ambulance"
                style={{
                  width: '100%',
                  height: 'auto',
                  display: 'block',
                  transform: 'scale(1.01)',
                }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* 3. Floating Trust / Features Bar (Overlapping Hero) */}
      <section id="trust-section" style={{ maxWidth: '1280px', margin: '0 auto', width: '100%', padding: '0 24px' }}>
        <div className="lifecare-trust-bar">
          {[
            {
              icon: Clock,
              title: '24/7 Availability',
              desc: 'Always at your service',
            },
            {
              icon: Zap,
              title: 'Quick Response',
              desc: 'Reach in minutes',
            },
            {
              icon: ShieldCheck,
              title: 'Safe & Reliable',
              desc: 'Your safety is our priority',
            },
            {
              icon: UserCheck,
              title: 'Expert Paramedics',
              desc: 'Trained & certified staff',
            },
            {
              icon: Activity,
              title: 'Advanced Equipment',
              desc: 'Modern & life-saving tools',
            },
          ].map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <div key={idx} className="lifecare-trust-item">
                <div className="lifecare-trust-icon-circle">
                  <Icon size={20} strokeWidth={2.5} />
                </div>
                <div>
                  <div style={{ fontSize: '0.98rem', fontWeight: 800, color: '#0F172A', lineHeight: 1.2 }}>
                    {feat.title}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '3px' }}>
                    {feat.desc}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. Live Ambulance Fleet & Real-Time Radar Section ("I Only Want Ambulance") */}
      <section id="ambulance-radar-section" style={{ background: '#F8FAFC', padding: '50px 24px 60px' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          {/* Section Header */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '20px',
            marginBottom: '24px',
          }}>
            <div>
              <div style={{
                fontSize: '0.82rem',
                fontWeight: 800,
                color: '#EF4444',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                marginBottom: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}>
                <span style={{ display: 'inline-block', width: '3px', height: '14px', background: '#EF4444', borderRadius: '2px' }} />
                REAL-TIME AMBULANCE RADAR
              </div>
              <h2 style={{
                fontSize: 'clamp(2rem, 3.5vw, 2.6rem)',
                fontWeight: 900,
                color: '#0F172A',
                letterSpacing: '-0.02em',
                margin: 0,
              }}>
                Live Ambulance Fleet &amp; Dispatch
              </h2>
              <p style={{
                fontSize: '1rem',
                color: '#64748B',
                maxWidth: '640px',
                marginTop: '6px',
                lineHeight: 1.5,
              }}>
                Active GPS telemetry tracking life-support ambulances cruising nearby. Nearest unit available in ~3 minutes.
              </p>
            </div>

            {/* Quick Location Chips */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.82rem', color: '#64748B', fontWeight: 600 }}>Location:</span>
              {[
                { name: 'Potheri (SRM)', lat: 12.8235, lng: 80.0445, address: '41, Potheri, SRM University Campus, Chennai' },
                { name: 'Velachery', lat: 12.9815, lng: 80.2180, address: 'Velachery Bypass Road, Chennai' },
                { name: 'T. Nagar', lat: 13.0418, lng: 80.2341, address: 'Usman Road, T. Nagar, Chennai' },
                { name: 'Adyar Signal', lat: 13.0012, lng: 80.2565, address: 'Adyar Signal, LB Road, Chennai' },
              ].map((loc) => (
                <button
                  key={loc.name}
                  onClick={() => setSelectedLocation(loc)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '999px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: selectedLocation.name === loc.name ? '1px solid #EF4444' : '1px solid #CBD5E1',
                    background: selectedLocation.name === loc.name ? '#EF4444' : '#FFFFFF',
                    color: selectedLocation.name === loc.name ? '#FFFFFF' : '#475569',
                    boxShadow: selectedLocation.name === loc.name ? '0 2px 8px rgba(239, 68, 68, 0.3)' : 'none',
                    transition: 'all 0.2s',
                  }}
                >
                  📍 {loc.name}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Live Ambulance Map Card */}
          <div style={{
            borderRadius: '20px',
            overflow: 'hidden',
            height: '540px',
            boxShadow: '0 16px 40px rgba(15, 23, 42, 0.1)',
            border: '1px solid #E2E8F0',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
          }}>
            {/* Top Fleet Status Bar */}
            <div style={{
              padding: '12px 20px',
              background: '#0D1322',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
              zIndex: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="pulsing-dot" style={{ width: '10px', height: '10px', background: '#10B981' }} />
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#FFF' }}>
                  Live Ambulance Radar &bull; Nearest Available Unit: <span style={{ color: '#10B981' }}>~3 min away</span>
                </span>
              </div>

              <button
                onClick={() => handleBookNow()}
                className="lifecare-btn-red"
                style={{ padding: '8px 20px', fontSize: '0.85rem' }}
              >
                <span>🚨 Request Emergency Ambulance</span>
                <ArrowRight size={14} />
              </button>
            </div>

            {/* Map Container */}
            <div style={{ flex: 1, minHeight: '460px', position: 'relative' }}>
              <LiveMap
                center={[selectedLocation.lat, selectedLocation.lng]}
                zoom={15}
                showNearbyRadar={true}
                emergency={{
                  pickup_address: selectedLocation.address,
                  pickup_lat: selectedLocation.lat,
                  pickup_lng: selectedLocation.lng,
                  emergency_type: 'Emergency Standby',
                  priority: 'READY',
                  status: 'SEARCHING_AMBULANCE',
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* 5. Track Your Ambulance Banner */}
      <section
        id="track-section"
        style={{
          background: '#F8FAFC',
          padding: '0 24px 60px',
        }}
      >
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <div className="lifecare-track-banner">
            {/* Ambient subtle route glow on right */}
            <div style={{
              position: 'absolute',
              right: '-40px',
              top: '-20px',
              width: '360px',
              height: '180px',
              background: 'radial-gradient(circle, rgba(239, 68, 68, 0.2) 0%, transparent 70%)',
              filter: 'blur(30px)',
              pointerEvents: 'none',
            }} />

            {/* Left Content */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', zIndex: 2 }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#EF4444',
                flexShrink: 0,
              }}>
                <MapPin size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
                  Track Your Ambulance
                </h3>
                <p style={{ fontSize: '0.86rem', color: '#94A3B8', margin: '4px 0 0', maxWidth: '420px' }}>
                  Enter your booking ID to track the real-time location of your ambulance.
                </p>
              </div>
            </div>

            {/* Middle Tracking Form */}
            <form onSubmit={handleTrackSubmit} style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', zIndex: 2 }}>
              <input
                type="text"
                placeholder="Enter Booking ID (e.g. EM-1002)"
                value={bookingIdInput}
                onChange={(e) => setBookingIdInput(e.target.value)}
                style={{
                  background: '#152238',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#FFFFFF',
                  padding: '12px 18px',
                  borderRadius: '10px',
                  fontSize: '0.92rem',
                  outline: 'none',
                  minWidth: '240px',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => (e.target.style.borderColor = '#EF4444')}
                onBlur={(e) => (e.target.style.borderColor = 'rgba(255, 255, 255, 0.15)')}
              />

              <button
                type="submit"
                disabled={trackingLoading}
                className="lifecare-btn-red"
                style={{ padding: '12px 24px', fontSize: '0.92rem' }}
              >
                <span>{trackingLoading ? 'Locating...' : 'Track Now'}</span>
                <ArrowRight size={16} />
              </button>
            </form>

            {/* Right Graphical Route Path Vector (Matching Screenshot) */}
            <div style={{ position: 'relative', width: '180px', height: '60px', display: 'flex', alignItems: 'center', zIndex: 2 }}>
              <svg width="180" height="60" viewBox="0 0 180 60" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M10 45 C 50 45, 70 15, 110 25 C 140 32, 150 15, 165 20"
                  stroke="#EF4444"
                  strokeWidth="3"
                  strokeDasharray="4 4"
                  strokeLinecap="round"
                />
                {/* Start pulsing vehicle beacon */}
                <circle cx="10" cy="45" r="5" fill="#38BDF8" />
                <circle cx="10" cy="45" r="9" stroke="#38BDF8" strokeWidth="1.5" opacity="0.6" />
                {/* Destination Red Pinpoint */}
                <circle cx="165" cy="20" r="7" fill="#EF4444" />
                <circle cx="165" cy="20" r="3" fill="#FFF" />
              </svg>
            </div>
          </div>

          {trackingFeedback && (
            <div style={{
              marginTop: '12px',
              padding: '10px 16px',
              borderRadius: '8px',
              background: trackingFeedback.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              border: `1px solid ${trackingFeedback.success ? '#10B981' : '#EF4444'}`,
              color: trackingFeedback.success ? '#34D399' : '#FCA5A5',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <CheckCircle2 size={16} />
              <span>{trackingFeedback.message}</span>
            </div>
          )}
        </div>
      </section>

      {/* 6. Ecosystem Operations Strip (Footer / Role Quick Launch) */}
      <footer style={{
        background: '#060A14',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '30px 24px',
        color: '#94A3B8',
        fontSize: '0.85rem',
      }}>
        <div style={{
          maxWidth: '1280px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#FFF', fontWeight: 700 }}>Life Care Ambulance Service &bull; ResQ Network</span>
            <span>&copy; {new Date().getFullYear()} All Rights Reserved.</span>
          </div>

          {/* Quick Platform Launchers */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.78rem', color: '#64748B' }}>Operational Portals:</span>
            <button
              onClick={() => demoLogin('CITIZEN')}
              style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: '#38BDF8', padding: '4px 10px', borderRadius: '6px', fontSize: '0.78rem', cursor: 'pointer' }}
            >
              Citizen Tracker
            </button>
            <button
              onClick={() => demoLogin('AMBULANCE_DRIVER')}
              style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: '#F59E0B', padding: '4px 10px', borderRadius: '6px', fontSize: '0.78rem', cursor: 'pointer' }}
            >
              Driver Cockpit
            </button>
            <button
              onClick={() => demoLogin('HOSPITAL_STAFF')}
              style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: '#10B981', padding: '4px 10px', borderRadius: '6px', fontSize: '0.78rem', cursor: 'pointer' }}
            >
              Hospital ER
            </button>
            <button
              onClick={() => demoLogin('DISPATCHER')}
              style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: '#A855F7', padding: '4px 10px', borderRadius: '6px', fontSize: '0.78rem', cursor: 'pointer' }}
            >
              Dispatcher Matrix
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
