import axios from 'axios';

const API_BASE_URL = 'https://hrms-app-wtlz.onrender.com/v1';

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
  bulkImport: (formData) => api.post('/employees/bulk-import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
};

export const attendanceAPI = {
  checkIn: (data) => api.post('/attendance/check-in', data),
  checkOut: (data) => api.post('/attendance/check-out', data),
  requestEarlyCheckout: (data) => api.post('/attendance/request-early-checkout', data),
  getAttendance: (params) => api.get('/attendance', { params }),
  getCalendarData: (params) => api.get('/attendance/calendar', { params }),
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
  getDefaults: () => api.get('/leave/defaults'),
  updateDefaults: (data) => api.put('/leave/defaults', data),
  getBalances: (employeeId) => api.get(`/leave/balances/${employeeId}`),
};

export const payrollAPI = {
  generate: (data) => api.post('/payroll/generate', data),
  generateAll: (data) => api.post('/payroll/generate-all', data),
  getPayroll: (params) => api.get('/payroll', { params }),
  getBreakdown: (payrollId) => api.get(`/payroll/breakdown/${payrollId}`),
  process: (data) => api.post('/payroll/process', data),
  pay: (data) => api.post('/payroll/pay', data),
  requestDownload: (data) => api.post('/payroll/download-requests', data),
  getMyDownloadRequests: () => api.get('/payroll/download-requests/my'),
  checkDownloadPermission: (payrollId) => api.get(`/payroll/download-requests/check/${payrollId}`),
  getPendingDownloadRequests: (params) => api.get('/payroll/download-requests', { params }),
  approveDownloadRequest: (data) => api.post('/payroll/download-requests/approve', data),
  rejectDownloadRequest: (data) => api.post('/payroll/download-requests/reject', data),
};

export const performanceAPI = {
  create: (data) => api.post('/performance/create', data),
  getReviews: (params) => api.get('/performance', { params }),
  update: (id, data) => api.put(`/performance/${id}`, data),
  submit: (data) => api.post('/performance/submit', data),
};

export const holidayAPI = {
  getAll: (params) => api.get('/holidays', { params }),
  getById: (id) => api.get(`/holidays/${id}`),
  create: (data) => api.post('/holidays', data),
  bulkCreate: (formData) => api.post('/holidays/bulk', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  update: (id, data) => api.put(`/holidays/${id}`, data),
  delete: (id) => api.delete(`/holidays/${id}`),
  check: (date) => api.get('/holidays/check', { params: { date } }),
  getStats: (year) => api.get('/holidays/stats', { params: { year } }),
};

export default api;