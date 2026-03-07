// src/context/NotificationContext.js
import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { employeeAPI } from '../services/api';

// ─────────────────────────────────────────────────────────────────────────────
// Notification Types
// ─────────────────────────────────────────────────────────────────────────────
export const NOTIF_TYPES = {
  LEAVE_APPLIED:       'leave_applied',
  LEAVE_APPROVED:      'leave_approved',
  LEAVE_REJECTED:      'leave_rejected',
  PAYSLIP_REQUESTED:   'payslip_requested',
  PAYSLIP_APPROVED:    'payslip_approved',
  PAYSLIP_REJECTED:    'payslip_rejected',
  BIRTHDAY:            'birthday',
};

export const NOTIF_ICONS = {
  leave_applied:     '📋',
  leave_approved:    '✅',
  leave_rejected:    '❌',
  payslip_requested: '📄',
  payslip_approved:  '💚',
  payslip_rejected:  '🚫',
  birthday:          '🎂',
};

export const NOTIF_COLORS = {
  leave_applied:     { bg: '#eff6ff', border: '#3b82f6', icon: '#2563eb' },
  leave_approved:    { bg: '#f0fdf4', border: '#22c55e', icon: '#16a34a' },
  leave_rejected:    { bg: '#fef2f2', border: '#ef4444', icon: '#dc2626' },
  payslip_requested: { bg: '#fefce8', border: '#eab308', icon: '#ca8a04' },
  payslip_approved:  { bg: '#f0fdf4', border: '#22c55e', icon: '#16a34a' },
  payslip_rejected:  { bg: '#fef2f2', border: '#ef4444', icon: '#dc2626' },
  birthday:          { bg: '#fdf4ff', border: '#a855f7', icon: '#9333ea' },
};

export const NOTIF_LABELS = {
  leave_applied:     'Leave Applied',
  leave_approved:    'Leave Approved',
  leave_rejected:    'Leave Rejected',
  payslip_requested: 'Payslip Requested',
  payslip_approved:  'Payslip Approved',
  payslip_rejected:  'Payslip Rejected',
  birthday:          'Birthday 🎂',
};

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────
const NotificationContext = createContext(null);

let _idCounter = 0;
const genId = () => `notif_${Date.now()}_${++_idCounter}`;

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────
export const NotificationProvider = ({ children }) => {
  const [toasts,     setToasts]     = useState([]);
  const [bellNotifs, setBellNotifs] = useState([]);
  const { user }                    = useSelector((state) => state.auth);
  const birthdayChecked             = useRef(false);

  // ── Push a notification ────────────────────────────────────────────────────
  const pushNotification = useCallback(({ type, title, message, meta = {} }) => {
    const id        = genId();
    const timestamp = new Date();
    const notif     = { id, type, title, message, meta, timestamp, read: false };

    // Show as toast (auto-dismiss after 5s)
    setToasts(prev => [...prev, notif]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);

    // Add to bell panel
    setBellNotifs(prev => [notif, ...prev].slice(0, 50));
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const markAllRead = useCallback(() => {
    setBellNotifs(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => {
    setBellNotifs([]);
  }, []);

  // ── Birthday check (once per HR login) ────────────────────────────────────
  useEffect(() => {
    if (birthdayChecked.current || !user) return;
    if (!['admin', 'hr', 'manager'].includes(user.role)) return;
    birthdayChecked.current = true;

    (async () => {
      try {
        const res  = await employeeAPI.getAll();
        const emps = res.data || [];
        const now  = new Date();
        emps.forEach(emp => {
          if (!emp.dateOfBirth) return;
          const dob = new Date(emp.dateOfBirth);
          if (dob.getMonth() === now.getMonth() && dob.getDate() === now.getDate()) {
            const name = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || 'An employee';
            pushNotification({
              type:    NOTIF_TYPES.BIRTHDAY,
              title:   '🎂 Birthday Today!',
              message: `${name}'s birthday is today — don't forget to wish them!`,
              meta:    { employeeId: emp._id, name },
            });
          }
        });
      } catch (err) {
        console.error('Birthday check failed:', err);
      }
    })();
  }, [user, pushNotification]);

  const unreadCount = bellNotifs.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider value={{
      toasts, bellNotifs, unreadCount,
      pushNotification, dismissToast, markAllRead, clearAll,
    }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </NotificationContext.Provider>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Toast Container — fixed bottom-right
// ─────────────────────────────────────────────────────────────────────────────
const ToastContainer = ({ toasts, onDismiss }) => {
  if (!toasts.length) return null;
  return (
    <div style={{
      position: 'fixed', bottom: '24px', right: '24px',
      zIndex: 999999, display: 'flex', flexDirection: 'column',
      gap: '10px', pointerEvents: 'none',
      maxWidth: '360px', width: '100%',
    }}>
      {toasts.map(t => <Toast key={t.id} toast={t} onDismiss={onDismiss} />)}
    </div>
  );
};

const Toast = ({ toast, onDismiss }) => {
  const [in_, setIn] = useState(false);
  const col = NOTIF_COLORS[toast.type] || NOTIF_COLORS.leave_applied;

  useEffect(() => { const t = setTimeout(() => setIn(true), 10); return () => clearTimeout(t); }, []);

  const close = () => { setIn(false); setTimeout(() => onDismiss(toast.id), 300); };

  return (
    <>
      <style>{`
        @keyframes __toastProg { from{width:100%} to{width:0%} }
      `}</style>
      <div
        onClick={close}
        style={{
          pointerEvents:   'all',
          cursor:          'pointer',
          display:         'flex',
          alignItems:      'flex-start',
          gap:             '12px',
          padding:         '13px 15px 16px',
          borderRadius:    '14px',
          backgroundColor: col.bg,
          borderLeft:      `4px solid ${col.border}`,
          boxShadow:       '0 8px 32px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.06)',
          position:        'relative',
          overflow:        'hidden',
          opacity:         in_ ? 1 : 0,
          transform:       in_ ? 'translateX(0)' : 'translateX(110%)',
          transition:      'opacity 0.3s ease, transform 0.35s cubic-bezier(0.34,1.56,0.64,1)',
          minWidth:        '290px',
          userSelect:      'none',
        }}
      >
        <span style={{ fontSize: '20px', flexShrink: 0, marginTop: '1px' }}>
          {NOTIF_ICONS[toast.type]}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: '700', fontSize: '13px', color: col.icon, marginBottom: '3px' }}>
            {toast.title}
          </div>
          <div style={{ fontSize: '12px', color: '#374151', lineHeight: '1.45' }}>
            {toast.message}
          </div>
        </div>
        <span style={{ color: '#9ca3af', fontSize: '13px', flexShrink: 0, alignSelf: 'flex-start', marginTop: '1px' }}>✕</span>
        <div style={{
          position: 'absolute', bottom: 0, left: 0,
          height: '3px', backgroundColor: col.border,
          animation: '__toastProg 5s linear forwards',
        }} />
      </div>
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────
export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used inside <NotificationProvider>');
  return ctx;
};

export default NotificationContext;