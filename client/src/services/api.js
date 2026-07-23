import axios from 'axios';

const API_BASE_URL = 'https://hrms.mematdigi.com/v1';

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

// If token expires/invalid => force logout + redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;

    if (status === 401) {
      // Clear client auth state
      localStorage.removeItem('token');
      localStorage.removeItem('user');

      // Hard redirect to login so Router guard picks it up immediately
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);


export const authAPI = {
  register:   (data) => api.post('/auth/register', data),
  login:      (data) => api.post('/auth/login', data),
  getProfile: ()     => api.get('/auth/profile'),
};

export const employeeAPI = {
  getAll:    ()         => api.get('/employees'),
  getById:   (id)       => api.get(`/employees/${id}`),
  create:    (data)     => api.post('/employees', data),
  update:    (id, data) => api.put(`/employees/${id}`, data),
  delete:    (id)       => api.delete(`/employees/${id}`),
  bulkDelete: (ids)     => api.delete('/employees/bulk/delete', { data: { ids } }),
  getPayrolls: ()       => api.get('/employees/all/payrolls'),
  bulkImport: (formData) => api.post('/employees/bulk-import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  downloadUploadedExcel: (filename) =>
    api.get(`/employees/bulk-import/download/${filename}`, { responseType: 'blob' }),
};

export const previousEmploymentAPI = {
  getByEmployee: (employeeId)       => api.get(`/previous-employment/${employeeId}`),
  upsert:        (employeeId, data) => api.put(`/previous-employment/${employeeId}`, data),
};

export const attendanceAPI = {
  checkIn:               (data)   => api.post('/attendance/check-in', data),
  checkOut:              (data)   => api.post('/attendance/check-out', data),
  requestEarlyCheckout:  (data)   => api.post('/attendance/request-early-checkout', data),
  getAttendance:         (params) => api.get('/attendance', { params }),
  getCalendarData:       (params) => api.get('/attendance/calendar', { params }),
  markAttendance:        (data)   => api.post('/attendance/mark', data),
  getAllAttendance:       (params) => api.get('/attendance/attendance_list', { params }),
  getPendingRequests:    ()       => api.get('/attendance/pending-requests'),
  approveEarlyCheckout:  (data)   => api.post('/attendance/approve-early-checkout', data),
};

// ── Attendance Regularization ────────────────────────────────────────────────
export const regularizationAPI = {
  /** Employee: submit a new regularization request — { employeeId, date, reason } */
  submit: (data) => api.post('/regularization', data),
  /** Employee: view own requests */
  getMine: (employeeId) => api.get('/regularization/my', { params: { employeeId } }),
  /** HR/Admin: view all requests, optional { status: 'pending' | 'approved' | 'rejected' } */
  getAll: (params) => api.get('/regularization', { params }),
  /**
   * HR/Admin: approve — { hrId, checkInTime: 'HH:mm', checkOutTime: 'HH:mm', status }
   * checkInTime/checkOutTime are 24-hour "HH:mm" strings (IST wall-clock).
   * Working hours are calculated server-side from the two times.
   */
  approve: (id, data) => api.put(`/regularization/${id}/approve`, data),
  /** HR/Admin: reject — { hrId, rejectionReason } */
  reject: (id, data) => api.put(`/regularization/${id}/reject`, data),
};

export const leaveAPI = {
  apply:          (data)       => api.post('/leave/apply', data),
  getRequests:    (params)     => api.get('/leave/requests', { params }),
  getPending:     (params)     => api.get('/leave/pending', { params }),
  getStats:       ()           => api.get('/leave/stats'),
  approve:        (data)       => api.put('/leave/approve', data),
  reject:         (data)       => api.put('/leave/reject', data),
  getDefaults:    ()           => api.get('/leave/defaults'),
  updateDefaults: (data)       => api.put('/leave/defaults', data),
  getBalances:    (employeeId) => api.get(`/leave/balances/${employeeId}`),
  downloadTemplate: ()         => api.get('/leave/bulk/template', { responseType: 'blob' }),
  bulkUpload: (formData)       => api.post('/leave/bulk/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  getAllHR: (params) => api.get('/leave/hr/all', { params }),
};

export const payrollAPI = {
  generate:                   (data)      => api.post('/payroll/generate', data),
  generateAll:                (data)      => api.post('/payroll/generate-all', data),
  getPayroll:                 (params)    => api.get('/payroll', { params }),
  getBreakdown:               (payrollId) => api.get(`/payroll/breakdown/${payrollId}`),
  process:                    (data)      => api.post('/payroll/process', data),
  pay:                        (data)      => api.post('/payroll/pay', data),
  requestDownload:            (data)      => api.post('/payroll/download-requests', data),
  getMyDownloadRequests:      ()          => api.get('/payroll/download-requests/my'),
  checkDownloadPermission:    (payrollId) => api.get(`/payroll/download-requests/check/${payrollId}`),
  getPendingDownloadRequests: (params)    => api.get('/payroll/download-requests', { params }),
  approveDownloadRequest:     (data)      => api.post('/payroll/download-requests/approve', data),
  rejectDownloadRequest:      (data)      => api.post('/payroll/download-requests/reject', data),
};

export const performanceAPI = {
  create:     (data)     => api.post('/performance/create', data),
  getReviews: (params)   => api.get('/performance', { params }),
  update:     (id, data) => api.put(`/performance/${id}`, data),
  submit:     (data)     => api.post('/performance/submit', data),
};

export const holidayAPI = {
  getAll:     (params)   => api.get('/holidays', { params }),
  getById:    (id)       => api.get(`/holidays/${id}`),
  create:     (data)     => api.post('/holidays', data),
  bulkCreate: (formData) => api.post('/holidays/bulk', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  update:   (id, data) => api.put(`/holidays/${id}`, data),
  delete:   (id)       => api.delete(`/holidays/${id}`),
  check:    (date)     => api.get('/holidays/check', { params: { date } }),
  getStats: (year)     => api.get('/holidays/stats', { params: { year } }),
};

export const notificationAPI = {
  getAll:         (params) => api.get('/notifications', { params }),
  getUnreadCount: ()       => api.get('/notifications/unread-count'),
  markAsRead:     (id)     => api.put(`/notifications/${id}/read`),
  markAllRead:    ()       => api.put('/notifications/mark-all-read'),
  deleteOne:      (id)     => api.delete(`/notifications/${id}`),
  clearAll:       ()       => api.delete('/notifications/clear-all'),
};

// ── Office Documents (company-wide, admin/HR manages) ─────────────────────────
export const officeDocumentAPI = {
  /** Get all documents with optional filters: { category, department, search, isActive } */
  getAll:    (params) => api.get('/office-documents', { params }),
  getById:   (id)     => api.get(`/office-documents/${id}`),
  getStats:  ()       => api.get('/office-documents/stats'),
  create:    (formData) => api.post('/office-documents', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  update: (id, formData) => api.put(`/office-documents/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  delete:   (id) => api.delete(`/office-documents/${id}`),
  /** Download — triggers browser "Save As" dialog (responseType: blob) */
  download: (id) => api.get(`/office-documents/${id}/download`, { responseType: 'blob' }),
  /** Preview — for rendering in browser (PDF/images), responseType: blob */
  preview:  (id) => api.get(`/office-documents/${id}/preview`,  { responseType: 'blob' }),
};

// ── Personal Documents (private per-employee storage) ─────────────────────────
// Each user can only see their OWN documents.
// Even admin/HR cannot browse another employee's personal docs via the frontend.
export const personalDocumentAPI = {
  /** Get current user's documents. Optional filters: { category, search } */
  getAll:   (params) => api.get('/personal-documents', { params }),
  getById:  (id)     => api.get(`/personal-documents/${id}`),
  getStats: ()       => api.get('/personal-documents/stats'),
  create:   (formData) => api.post('/personal-documents', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  update: (id, formData) => api.put(`/personal-documents/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  delete:   (id) => api.delete(`/personal-documents/${id}`),
  /** Download — triggers browser "Save As" dialog (responseType: blob) */
  download: (id) => api.get(`/personal-documents/${id}/download`, { responseType: 'blob' }),
  /** Preview — for rendering in browser (PDF/images), responseType: blob */
  preview:  (id) => api.get(`/personal-documents/${id}/preview`,  { responseType: 'blob' }),
};

// ── Resignation ───────────────────────────────────────────────────────────────
export const resignationAPI = {
  /** Employee: submit a resignation */
  submit:       (data) => api.post('/resignations', data),

  /** Employee: get own latest resignation */
  getMine:      ()     => api.get('/resignations/my'),

  /** Employee: withdraw own pending resignation */
  withdrawMine: ()     => api.delete('/resignations/my'),

  /** HR/Admin: list all (optional ?status=pending|accepted|rejected) */
  getAll:       (params) => api.get('/resignations', { params }),

  /** HR/Admin: get one by id */
  getById:      (id)   => api.get(`/resignations/${id}`),

  /** HR/Admin: accept */
  accept:       (id)   => api.put(`/resignations/${id}/accept`),

  /** HR/Admin: reject — body: { rejectionReason } */
  reject:       (id, data) => api.put(`/resignations/${id}/reject`, data),
};

// ── Add this block to api.js (after resignationAPI) ─────────────────────────

export const offboardingAPI = {
  /** Get all offboarding records. Optional: { status: 'pending' | 'completed' } */
  getAll:         (params) => api.get('/offboarding', { params }),

  /** Get offboarding record for a specific employee */
  getByEmployee:  (employeeId) => api.get(`/offboarding/employee/${employeeId}`),

  /** Get single record by offboarding record ID */
  getById:        (id) => api.get(`/offboarding/${id}`),

  /** Create new offboarding record (also deactivates employee) */
  create:         (data) => api.post('/offboarding', data),

  /** Update existing offboarding record */
  update:         (id, data) => api.put(`/offboarding/${id}`, data),

  /** Mark offboarding as completed */
  markComplete:   (id) => api.patch(`/offboarding/${id}/complete`),

  /** Delete offboarding record (admin only) */
  delete:         (id) => api.delete(`/offboarding/${id}`),
};

export default api;

// ═══════════════════════════════════════════════════════════════════════════
// NEW: Hierarchy / Task Report / Weekly Report / Scoring
// ═══════════════════════════════════════════════════════════════════════════

// ── Company Hierarchy ────────────────────────────────────────────────────────
export const hierarchyAPI = {
  /** Full org tree (nested). All roles can read; only admin/hr/manager can edit. */
  getTree:     ()               => api.get('/hierarchy/tree'),
  /** Requesting user's own reporting line: self → TL → manager → ... → root */
  getMyBranch: ()               => api.get('/hierarchy/my-branch'),
  /** TL/Manager: my direct team roster */
  getMyTeam:   ()               => api.get('/hierarchy/my-team'),
  /** admin/hr/manager: flat list of active users for the Reporting Manager /
   *  Team Lead dropdowns — returns User._id enriched with Employee display data */
  getAssignableUsers: ()        => api.get('/hierarchy/assignable'),
  /** admin/hr/manager: reassign — { reportingManager_id, teamLead_id, designationLevel } */
  update:      (userId, data)   => api.put(`/hierarchy/${userId}`, data),
};

// ── Task Report (TEAM LEAD owned — employees can only READ their own) ────────
export const taskReportAPI = {
  /** EMPLOYEE: read-only view of what their TL logged. Optional { month, year } */
  getMine:     (params)       => api.get('/task-report/my', { params }),
  /** TL: create — { employee, startDate, endDate, totalTasks, completedTasks, remarks } */
  create:      (data)         => api.post('/task-report', data),
  /** TL: edit own report */
  update:      (id, data)     => api.put(`/task-report/${id}`, data),
  /** TL: delete own report */
  delete:      (id)           => api.delete(`/task-report/${id}`),
  /** TL (own team) / HR / Manager / Admin (all). Optional { employeeId, month, year } */
  getTeam:     (params)       => api.get('/task-report/team', { params }),
};

// ── TL Weekly Report ─────────────────────────────────────────────────────────
export const weeklyReportAPI = {
  /** TL: submit — { employee, weekStartDate, dressCodeFollowed, behaviourNotes,
   *   negativeFeedbackFlag, recommendation, weekendClientMeeting: { occurred, count } } */
  submit:   (data)     => api.post('/weekly-report', data),
  /** TL: edit own report inside the configurable edit window (default 3 days) */
  update:   (id, data) => api.put(`/weekly-report/${id}`, data),
  /** TL → own; HR/Manager/Admin → all. Optional { teamLead, employee, week } */
  getAll:   (params)   => api.get('/weekly-report', { params }),
  /** HR/Manager: annotate only — never silently alters TL input — { hrNote } */
  annotate: (id, data) => api.put(`/weekly-report/${id}/annotate`, data),
};

// ── Scoring engine / Analytics ───────────────────────────────────────────────
export const scoringAPI = {
  /** Own score history (all roles). Optional { months } */
  getMine:        (params) => api.get('/scoring/me', { params }),
  /** TL/Manager: team scores for a month. Optional { year, month } */
  getTeam:        (params) => api.get('/scoring/team', { params }),
  /** HR/Manager/Admin: company-wide. Optional { year, month, department, teamLead } */
  getCompany:     (params) => api.get('/scoring/company', { params }),
  /** One employee's full trend (TL scoped to own team server-side) */
  getEmployee:    (id)     => api.get(`/scoring/employee/${id}`),
  /** Nakshatra Award leaderboard. Optional { start, end } */
  getNakshatra:   (params) => api.get('/scoring/nakshatra-leaderboard', { params }),

  /** Admin/HR: manual recompute — { year, month } */
  recalculate:    (data)   => api.post('/scoring/recalculate', data),
  /** Admin: lock month + auto-pick Employee of the Month — { year, month } */
  finalize:       (data)   => api.post('/scoring/finalize', data),

  /** Admin-editable scoring rules (every weight is tunable without a redeploy) */
  getConfig:      ()       => api.get('/scoring/config'),
  updateConfig:   (data)   => api.put('/scoring/config', data),

  /** Log feedback — { employee, sentiment: 'positive'|'negative', comment } */
  addFeedback:       (data) => api.post('/scoring/feedback', data),
  /** TL/HR/Manager/Admin: recommend — { employee, comment } */
  addRecommendation: (data) => api.post('/scoring/recommendation', data),
  /** Feedback + recommendations for one employee */
  getFeedback:       (employeeId) => api.get(`/scoring/feedback/${employeeId}`),
};