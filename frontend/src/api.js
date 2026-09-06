import axios from 'axios';

// Default API client
const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to inject JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('resq_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor to handle 401s gracefully
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Optional: Clear token if invalid, but keep demo switcher intact
      console.warn('Unauthorized request:', error.response.data);
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (formData) => api.post('/auth/login', formData, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  }),
  demoLogin: (role) => api.post('/auth/demo-login', { role }),
  register: (data) => api.post('/auth/register', data),
  getMe: () => api.get('/auth/me'),
};

export const emergencyAPI = {
  create: (data) => api.post('/emergencies', data),
  get: (id) => api.get(`/emergencies/${id}`),
  getActive: () => api.get('/emergencies/active/current'),
  cancel: (id, reason) => api.post(`/emergencies/${id}/cancel`, { reason }),
  updateStatus: (id, status, notes) => api.post(`/emergencies/${id}/status`, { status, notes }),
  updateLocation: (id, lat, lng, speed, heading) => 
    api.post(`/emergencies/${id}/location`, { latitude: lat, longitude: lng, speed, heading }),
  requestHospitalChange: (id, targetHospitalId, reason) =>
    api.post(`/emergencies/${id}/hospital-change`, { target_hospital_id: targetHospitalId, reason }),
  reviewHospitalChange: (requestId, action, comments) =>
    api.post(`/emergencies/hospital-change/${requestId}/review`, { action, dispatcher_comments: comments }),
};

export const ambulanceAPI = {
  getAll: (params) => api.get('/ambulances', { params }),
  getNearby: (lat, lng, radius) => api.get('/ambulances/nearby', { params: { latitude: lat, longitude: lng, radius_km: radius } }),
  getOne: (id) => api.get(`/ambulances/${id}`),
  updateStatus: (id, status) => api.patch(`/ambulances/${id}/status`, null, { params: { status } }),
  updateLocation: (id, lat, lng, speed, heading) =>
    api.patch(`/ambulances/${id}/location`, { latitude: lat, longitude: lng, speed, heading }),
};

export const hospitalAPI = {
  getAll: (params) => api.get('/hospitals', { params }),
  getOne: (id) => api.get(`/hospitals/${id}`),
  getRecommendations: (lat, lng, type, severity) =>
    api.get('/hospitals/recommendations', {
      params: { patient_lat: lat, patient_lng: lng, emergency_type: type, severity }
    }),
  updateCapacity: (id, data) => api.patch(`/hospitals/${id}/capacity`, data),
  getCases: (id) => api.get(`/hospitals/${id}/cases`),
  reviewCase: (id, caseId, action, notes, doctor) =>
    api.post(`/hospitals/${id}/cases/${caseId}/review`, { action, notes, assigned_doctor: doctor }),
};

export const dispatchAPI = {
  getOverview: () => api.get('/dispatch/overview'),
  assignAmbulance: (emergencyId, ambulanceId, notes) =>
    api.post(`/dispatch/emergencies/${emergencyId}/assign`, { ambulance_id: ambulanceId, notes }),
  overrideHospital: (emergencyId, hospitalId, reason) =>
    api.post(`/dispatch/emergencies/${emergencyId}/override-hospital`, { hospital_id: hospitalId, reason }),
};

export const analyticsAPI = {
  getOverview: () => api.get('/analytics/overview'),
  getAuditLogs: (params) => api.get('/analytics/audit-logs', { params }),
};

export const simulationAPI = {
  start: (type, severity, autoAdvanceSec) =>
    api.post('/simulation/start', {
      emergency_type: type || 'CARDIAC_ARREST',
      severity_level: severity || 'CRITICAL',
      auto_advance_seconds: autoAdvanceSec || 4
    }),
  status: () => api.get('/simulation/status'),
  stop: () => api.post('/simulation/stop'),
};

export default api;
