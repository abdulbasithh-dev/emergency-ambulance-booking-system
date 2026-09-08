import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('resq_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(localStorage.getItem('resq_token') || null);
  const [loading, setLoading] = useState(true);

  // Initialize and verify existing session
  useEffect(() => {
    const fetchMe = async () => {
      if (token && token !== 'demo_fallback_token') {
        try {
          const res = await authAPI.getMe();
          setUser(res.data);
          localStorage.setItem('resq_user', JSON.stringify(res.data));
        } catch (err) {
          console.warn('Session verification note:', err.message);
          // Only clear if no saved fallback user exists
          const saved = localStorage.getItem('resq_user');
          if (!saved) {
            localStorage.removeItem('resq_token');
            setToken(null);
            setUser(null);
          }
        }
      }
      setLoading(false);
    };

    fetchMe();
  }, [token]);

  const login = async (email, password) => {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);
    const res = await authAPI.login(formData);
    const accessToken = res.data.access_token;
    localStorage.setItem('resq_token', accessToken);
    localStorage.setItem('resq_user', JSON.stringify(res.data.user));
    setToken(accessToken);
    setUser(res.data.user);
    return res.data.user;
  };

const DEMO_FALLBACK_USERS = {
  PORTAL: null,
  CITIZEN: { id: 1, full_name: 'Alex Johnson (Citizen)', email: 'citizen@resq.demo', role: 'CITIZEN' },
  USER: { id: 1, full_name: 'Alex Johnson (Citizen)', email: 'citizen@resq.demo', role: 'CITIZEN' },
  AMBULANCE_DRIVER: { id: 2, full_name: 'Rajesh Kumar (ALS Paramedic)', email: 'driver@resq.demo', role: 'AMBULANCE_DRIVER', ambulance_id: 1 },
  DRIVER: { id: 2, full_name: 'Rajesh Kumar (ALS Paramedic)', email: 'driver@resq.demo', role: 'AMBULANCE_DRIVER', ambulance_id: 1 },
  HOSPITAL_STAFF: { id: 3, full_name: 'Dr. Ananya Roy (ER Lead)', email: 'hospital@resq.demo', role: 'HOSPITAL_STAFF', hospital_id: 1 },
  HOSPITAL: { id: 3, full_name: 'Dr. Ananya Roy (ER Lead)', email: 'hospital@resq.demo', role: 'HOSPITAL_STAFF', hospital_id: 1 },
  DISPATCHER: { id: 4, full_name: 'Priya Sharma (Dispatcher)', email: 'dispatcher@resq.demo', role: 'DISPATCHER' },
  ADMIN: { id: 5, full_name: 'System Administrator', email: 'admin@resq.demo', role: 'ADMIN' },
};

  const demoLogin = async (role) => {
    if (!role || role === 'PORTAL') {
      setUser(null);
      localStorage.removeItem('resq_user');
      localStorage.removeItem('resq_token');
      setToken(null);
      return null;
    }
    try {
      const res = await authAPI.demoLogin(role);
      if (!res.data?.user) {
        throw new Error('No user data returned from demo-login');
      }
      const accessToken = res.data.access_token || 'demo_fallback_token';
      localStorage.setItem('resq_token', accessToken);
      localStorage.setItem('resq_user', JSON.stringify(res.data.user));
      setToken(accessToken);
      setUser(res.data.user);
      return res.data.user;
    } catch (err) {
      console.warn('Backend demo-login unavailable, using client demo persona:', err.message);
      const roleUpper = String(role).toUpperCase();
      const fallbackUser = DEMO_FALLBACK_USERS[roleUpper] || DEMO_FALLBACK_USERS[role] || {
        id: 1,
        full_name: `${role.replace(/_/g, ' ')} (Demo)`,
        email: `${role.toLowerCase()}@resq.demo`,
        role: roleUpper,
      };
      if (fallbackUser) {
        setUser(fallbackUser);
        localStorage.setItem('resq_user', JSON.stringify(fallbackUser));
        localStorage.setItem('resq_token', 'demo_fallback_token');
        setToken('demo_fallback_token');
      } else {
        setUser(null);
        localStorage.removeItem('resq_user');
      }
      return fallbackUser;
    }
  };

  const citizenLogin = async (mobileNumber, password) => {
    try {
      const res = await authAPI.citizenLogin(mobileNumber, password);
      const accessToken = res.data.access_token;
      const userData = res.data.user;
      localStorage.setItem('resq_token', accessToken);
      localStorage.setItem('resq_user', JSON.stringify(userData));
      setToken(accessToken);
      setUser(userData);
      return userData;
    } catch (err) {
      // Fallback for static Netlify hosting if backend is unreachable
      if (!err.response || err.response.status === 404 || err.message?.includes('HTML fallback')) {
        const fallback = {
          id: 1,
          full_name: 'Sarah Jenkins',
          phone_number: mobileNumber || '9876543210',
          role: 'CITIZEN',
          email: `${mobileNumber}@resq.local`
        };
        localStorage.setItem('resq_token', 'demo_fallback_token');
        localStorage.setItem('resq_user', JSON.stringify(fallback));
        setToken('demo_fallback_token');
        setUser(fallback);
        return fallback;
      }
      throw err;
    }
  };

  const citizenRegister = async (registrationData) => {
    try {
      const res = await authAPI.citizenRegister(registrationData);
      const accessToken = res.data.access_token;
      const userData = res.data.user;
      localStorage.setItem('resq_token', accessToken);
      localStorage.setItem('resq_user', JSON.stringify(userData));
      setToken(accessToken);
      setUser(userData);
      return userData;
    } catch (err) {
      if (!err.response || err.response.status === 404 || err.message?.includes('HTML fallback')) {
        const fallback = {
          id: Date.now(),
          full_name: registrationData.full_name,
          phone_number: registrationData.mobile_number,
          role: 'CITIZEN',
          email: `${registrationData.mobile_number}@resq.local`
        };
        localStorage.setItem('resq_token', 'demo_fallback_token');
        localStorage.setItem('resq_user', JSON.stringify(fallback));
        setToken('demo_fallback_token');
        setUser(fallback);
        return fallback;
      }
      throw err;
    }
  };

  const driverLogin = async (identifier, password) => {
    try {
      const res = await authAPI.driverLogin(identifier, password);
      const accessToken = res.data.access_token;
      const userData = res.data.user;
      localStorage.setItem('resq_token', accessToken);
      localStorage.setItem('resq_user', JSON.stringify(userData));
      setToken(accessToken);
      setUser(userData);
      return userData;
    } catch (err) {
      if (!err.response || err.response.status === 404 || err.message?.includes('HTML fallback')) {
        const fallback = {
          id: 2,
          full_name: 'Rajesh Kumar',
          driver_id: identifier.startsWith('DRV') ? identifier : 'DRV-101',
          phone_number: '9840022222',
          role: 'AMBULANCE_DRIVER',
          duty_status: 'OFF_DUTY',
          ambulance_id: 1,
          email: 'driver@resq.com'
        };
        localStorage.setItem('resq_token', 'demo_fallback_token');
        localStorage.setItem('resq_user', JSON.stringify(fallback));
        setToken('demo_fallback_token');
        setUser(fallback);
        return fallback;
      }
      throw err;
    }
  };

  const updateDutyStatus = async (newStatus) => {
    try {
      const res = await authAPI.updateDutyStatus(newStatus);
      const updatedUser = res.data;
      setUser(updatedUser);
      localStorage.setItem('resq_user', JSON.stringify(updatedUser));
      return updatedUser;
    } catch (err) {
      // If backend offline, fallback update locally
      const updatedUser = { ...user, duty_status: newStatus };
      setUser(updatedUser);
      localStorage.setItem('resq_user', JSON.stringify(updatedUser));
      return updatedUser;
    }
  };

  const logout = () => {
    localStorage.removeItem('resq_token');
    localStorage.removeItem('resq_user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      login,
      citizenLogin,
      citizenRegister,
      driverLogin,
      updateDutyStatus,
      demoLogin,
      logout,
      setUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
