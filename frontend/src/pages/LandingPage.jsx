import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  ArrowRight,
  Clock,
  Zap,
  ShieldCheck,
  UserCheck,
  Activity,
  HeartPulse,
} from 'lucide-react';

export const LandingPage = ({ onOpenEmergencyModal }) => {
  const { user, demoLogin } = useAuth();

  const handleBookNow = () => {
    const isCitizenLoggedIn = user && (user.role === 'CITIZEN' || user.role === 'USER');
    if (isCitizenLoggedIn) {
      window.history.pushState(null, '', '/citizen?openBooking=true');
      window.dispatchEvent(new PopStateEvent('popstate'));
      window.dispatchEvent(new CustomEvent('resq-route-change'));
      if (onOpenEmergencyModal) {
        onOpenEmergencyModal();
      }
    } else {
      window.history.pushState(null, '', '/citizen-login?intent=book');
      window.dispatchEvent(new PopStateEvent('popstate'));
      window.dispatchEvent(new CustomEvent('resq-route-change'));
    }
  };

  const navigateTo = (path) => {
    window.history.pushState(null, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
    window.dispatchEvent(new CustomEvent('resq-route-change'));
  };

  return (
    <div className="lifecare-portal">
      {/* Hero Section */}
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
                onClick={handleBookNow}
                className="lifecare-btn-red"
                style={{
                  fontSize: '1.05rem',
                  padding: '14px 34px',
                  borderRadius: '12px',
                }}
              >
                <span>Book Ambulance</span>
                <ArrowRight size={18} />
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

      {/* Floating Trust / Features Bar */}
      <section id="trust-section" style={{ maxWidth: '1280px', margin: '0 auto', width: '100%', padding: '0 24px 60px' }}>
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

      {/* Ecosystem Operations Strip (Footer) */}
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
              onClick={() => navigateTo('/citizen')}
              style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: '#38BDF8', padding: '4px 10px', borderRadius: '6px', fontSize: '0.78rem', cursor: 'pointer' }}
            >
              Citizen Tracker
            </button>
            <button
              onClick={() => navigateTo('/driver')}
              style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: '#F59E0B', padding: '4px 10px', borderRadius: '6px', fontSize: '0.78rem', cursor: 'pointer' }}
            >
              Driver Cockpit
            </button>
            <button
              onClick={() => navigateTo('/hospital')}
              style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: '#10B981', padding: '4px 10px', borderRadius: '6px', fontSize: '0.78rem', cursor: 'pointer' }}
            >
              Hospital ER
            </button>
            <button
              onClick={() => navigateTo('/dispatcher')}
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
export default LandingPage;
