import axios from 'axios';
// const dotenv = require('dotenv');

// dotenv.config();

const API_BASE_URL =  'http://localhost:5000/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getProfile: () => api.get('/auth/profile'),
};

export const employeeAPI = {
  getAll: () => api.get('/employees'),
  getById: (id) => api.get(`/employees/${id}`),
  create: (data) => api.post('/employees', data),
  update: (id, data) => api.put(`/employees/${id}`, data),
  delete: (id) => api.delete(`/employees/${id}`),
  getPayrolls: () => api.get('/employees/all/payrolls'),
};

export const attendanceAPI = {
  // Employee attendance operations
  checkIn: (data) => api.post('/attendance/check-in', data),

  checkOut: (data) => api.post('/attendance/check-out', data),
  
  requestEarlyCheckout: (data) => api.post('/attendance/request-early-checkout', data),
  
  getAttendance: (params) => api.get('/attendance', { params }),
  
  getCalendarData: (params) => api.get('/attendance/calendar', { params }),
  
  // HR/Admin/Manager operations
  markAttendance: (data) => api.post('/attendance/mark', data),
  
  getAllAttendance: (params) => api.get('/attendance/attendance_list', { params }),
  
  getPendingRequests: () => api.get('/attendance/pending-requests'),
  
  approveEarlyCheckout: (data) => api.post('/attendance/approve-early-checkout', data),
};

export const leaveAPI = {
  apply: (data) => api.post('/leave/apply', data),
  getRequests: (params) => api.get('/leave/requests', { params }),
  getPending: (params) => api.get('/leave/pending', { params }),
  getStats: () => api.get('/leave/stats'),
  approve: (data) => api.put('/leave/approve', data),
  reject: (data) => api.put('/leave/reject', data),
    // --- ADDED: defaults & holidays & balances
  // default leaves
  getDefaults: () => api.get('/leave/defaults'),
  updateDefaults: (data) => api.put('/leave/defaults', data),

  // employee balances
  getBalances: (employeeId) => api.get(`/employees/${employeeId}/balances`),
};

export const payrollAPI = {
  generate: (data) => api.post('/payroll/generate', data),
  getPayroll: (params) => api.get('/payroll', { params }),
  process: (data) => api.post('/payroll/process', data),
  pay: (data) => api.post('/payroll/pay', data),
};

export const performanceAPI = {
  create: (data) => api.post('/performance/create', data),
  getReviews: (params) => api.get('/performance', { params }),
  update: (id, data) => api.put(`/performance/${id}`, data),
  submit: (data) => api.post('/performance/submit', data),
};

export default api;
