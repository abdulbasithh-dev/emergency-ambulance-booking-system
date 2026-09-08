import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WebSocketProvider } from './context/WebSocketContext';
import { DemoControlBar } from './components/DemoControlBar';
import { ToastContainer } from './components/ToastContainer';
import { EmergencyModal } from './components/EmergencyModal';
import { LandingPage } from './pages/LandingPage';
import { UserDashboard } from './pages/UserDashboard';
import { DriverDashboard } from './pages/DriverDashboard';
import { HospitalDashboard } from './pages/HospitalDashboard';
import { DispatcherDashboard } from './pages/DispatcherDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { CitizenAuthPage } from './pages/CitizenAuthPage';
import { DriverLoginPage } from './pages/DriverLoginPage';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-primary)',
          color: '#FFF',
          padding: '24px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🚨</div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>Application Encountered an Issue</h2>
          <p style={{ color: '#94A3B8', maxWidth: '500px', marginBottom: '24px' }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.href = '/';
            }}
            className="btn btn-primary"
          >
            Reset &amp; Return to Home
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const MainLayout = () => {
  const { user, loading, demoLogin } = useAuth();
  const [emergencyModalOpen, setEmergencyModalOpen] = useState(false);

  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  React.useEffect(() => {
    const onLocationChange = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', onLocationChange);
    window.addEventListener('resq-route-change', onLocationChange);
    return () => {
      window.removeEventListener('popstate', onLocationChange);
      window.removeEventListener('resq-route-change', onLocationChange);
    };
  }, []);

  // Sync role for non-authenticated demo personas (Hospital, Dispatcher, Admin)
  React.useEffect(() => {
    if (!loading) {
      const path = (currentPath || window.location.pathname).replace(/^\//, '').toLowerCase().split('/')[0];
      const demoPersonaRoles = {
        hospital: 'HOSPITAL_STAFF',
        dispatcher: 'DISPATCHER',
        admin: 'ADMIN',
      };
      const targetRole = demoPersonaRoles[path];
      if (targetRole && (!user || user.role !== targetRole)) {
        demoLogin(targetRole).catch(() => {});
      }
    }
  }, [loading, currentPath, user, demoLogin]);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-primary)',
        color: 'var(--text-secondary)',
        gap: '16px'
      }}>
        <div className="pulsing-dot" style={{ width: '20px', height: '20px' }} />
        <div style={{ fontWeight: 600, fontSize: '1.1rem', color: '#FFF' }}>
          Initializing ResQ Emergency Dispatch Engine...
        </div>
      </div>
    );
  }

  // Determine which dashboard to render based on URL route and authenticated status
  const renderDashboard = () => {
    const clean = (currentPath || window.location.pathname).replace(/^\//, '').toLowerCase().split('/')[0];
    const search = window.location.search;
    const isBookingIntent = search.includes('intent=book') || search.includes('openBooking=true');

    if (!clean || clean === 'home' || clean === 'portal') {
      return <LandingPage onOpenEmergencyModal={() => setEmergencyModalOpen(true)} />;
    }

    // Citizen Login Route
    if (clean === 'citizen-login') {
      return (
        <CitizenAuthPage
          bookingIntent={isBookingIntent}
          onLoginSuccess={({ openBooking } = {}) => {
            if (openBooking) {
              setEmergencyModalOpen(true);
            }
          }}
        />
      );
    }

    // Driver Login Route
    if (clean === 'driver-login') {
      return <DriverLoginPage onLoginSuccess={() => {}} />;
    }

    // Protected Citizen Portal
    if (clean === 'citizen' || clean === 'user') {
      const isCitizenLoggedIn = user && (user.role === 'CITIZEN' || user.role === 'USER');
      if (!isCitizenLoggedIn) {
        return (
          <CitizenAuthPage
            bookingIntent={isBookingIntent}
            onLoginSuccess={({ openBooking } = {}) => {
              if (openBooking) {
                setEmergencyModalOpen(true);
              }
            }}
          />
        );
      }
      return <UserDashboard onOpenEmergencyModal={() => setEmergencyModalOpen(true)} />;
    }

    // Protected Driver Portal
    if (clean === 'driver') {
      const isDriverLoggedIn = user && user.role === 'AMBULANCE_DRIVER';
      if (!isDriverLoggedIn) {
        return <DriverLoginPage onLoginSuccess={() => {}} />;
      }
      return <DriverDashboard />;
    }

    if (clean === 'hospital') {
      return <HospitalDashboard />;
    }

    if (clean === 'dispatcher') {
      return <DispatcherDashboard />;
    }

    if (clean === 'admin') {
      return <AdminDashboard />;
    }

    return <LandingPage onOpenEmergencyModal={() => setEmergencyModalOpen(true)} />;
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
      {/* Top Demo Control & Instant Role Switcher Bar */}
      <DemoControlBar />

      {/* Main Content Area */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {renderDashboard()}
      </main>

      {/* Toast Alert System */}
      <ToastContainer />

      {/* Emergency Request Modal */}
      <EmergencyModal
        isOpen={emergencyModalOpen}
        onClose={() => setEmergencyModalOpen(false)}
        onEmergencyCreated={(data) => {
          console.log('Emergency created successfully:', data);
        }}
      />
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <WebSocketProvider>
          <MainLayout />
        </WebSocketProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
