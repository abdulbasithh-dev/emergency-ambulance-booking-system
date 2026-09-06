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
    return () => window.removeEventListener('popstate', onLocationChange);
  }, []);

  // Initial URL route synchronization on mount
  const initialSyncRef = React.useRef(false);
  React.useEffect(() => {
    if (!loading && !initialSyncRef.current) {
      initialSyncRef.current = true;
      const path = window.location.pathname.replace('/', '').toLowerCase();
      const roleMap = {
        citizen: 'CITIZEN',
        user: 'CITIZEN',
        driver: 'AMBULANCE_DRIVER',
        hospital: 'HOSPITAL_STAFF',
        dispatcher: 'DISPATCHER',
        admin: 'ADMIN',
      };
      const targetRole = roleMap[path];
      if (targetRole && (!user || user.role !== targetRole)) {
        demoLogin(targetRole).catch(() => {});
      }
    }
  }, [loading, user, demoLogin]);

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

  // Determine which dashboard to render based on URL route and user role
  const renderDashboard = () => {
    const isRoot = currentPath === '/' || currentPath === '/home' || currentPath === '';
    if (!user || isRoot) {
      return <LandingPage onOpenEmergencyModal={() => setEmergencyModalOpen(true)} />;
    }

    switch (user.role) {
      case 'CITIZEN':
      case 'USER':
        return <UserDashboard onOpenEmergencyModal={() => setEmergencyModalOpen(true)} />;
      case 'AMBULANCE_DRIVER':
      case 'DRIVER':
        return <DriverDashboard />;
      case 'HOSPITAL_STAFF':
      case 'HOSPITAL':
        return <HospitalDashboard />;
      case 'DISPATCHER':
        return <DispatcherDashboard />;
      case 'ADMIN':
        return <AdminDashboard />;
      default:
        return <LandingPage onOpenEmergencyModal={() => setEmergencyModalOpen(true)} />;
    }
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
