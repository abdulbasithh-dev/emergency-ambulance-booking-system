import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('resq_token') || null);
  const [loading, setLoading] = useState(true);

  // Initialize and verify existing session
  useEffect(() => {
    const fetchMe = async () => {
      if (token) {
        try {
          const res = await authAPI.getMe();
          setUser(res.data);
        } catch (err) {
          console.warn('Session expired, clearing token');
          localStorage.removeItem('resq_token');
          setToken(null);
          setUser(null);
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
    setToken(accessToken);
    setUser(res.data.user);
    return res.data.user;
  };

  const demoLogin = async (role) => {
    setLoading(true);
    try {
      const res = await authAPI.demoLogin(role);
      const accessToken = res.data.access_token;
      localStorage.setItem('resq_token', accessToken);
      setToken(accessToken);
      setUser(res.data.user);
      return res.data.user;
    } catch (err) {
      console.error('Failed demo login:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('resq_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, demoLogin, logout, setUser }}>
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
