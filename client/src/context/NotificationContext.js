// src/context/NotificationContext.js
import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { notificationAPI } from '../services/api';

// ─────────────────────────────────────────────────────────────────────────────
// Notification type → display config (color, icon, label)
// ─────────────────────────────────────────────────────────────────────────────
export const NOTIF_COLORS = {
  leave_applied:    { bg: '#eff6ff', border: '#3b82f6', icon: '#1d4ed8' },
  leave_approved:   { bg: '#f0fdf4', border: '#22c55e', icon: '#15803d' },
  leave_rejected:   { bg: '#fef2f2', border: '#ef4444', icon: '#b91c1c' },
  payslip_requested:{ bg: '#fff7ed', border: '#f97316', icon: '#c2410c' },
  payslip_approved: { bg: '#f0fdf4', border: '#22c55e', icon: '#15803d' },
  payslip_rejected: { bg: '#fef2f2', border: '#ef4444', icon: '#b91c1c' },
  birthday:         { bg: '#fdf4ff', border: '#a855f7', icon: '#7e22ce' },
  // ── New: TL / task report / weekly report / scoring / regularization ──
  regularization_applied:   { bg: 'rgba(25,118,210,0.08)',  border: '#1976D2', icon: '#1976D2' },
  regularization_approved:  { bg: 'rgba(46,125,50,0.09)',   border: '#2E7D32', icon: '#2E7D32' },
  regularization_rejected:  { bg: 'rgba(211,47,47,0.07)',   border: '#D32F2F', icon: '#D32F2F' },
  early_checkout_requested: { bg: 'rgba(255,112,67,0.08)',  border: '#FF7043', icon: '#FF7043' },
  early_checkout_approved:  { bg: 'rgba(46,125,50,0.09)',   border: '#2E7D32', icon: '#2E7D32' },
  early_checkout_rejected:  { bg: 'rgba(211,47,47,0.07)',   border: '#D32F2F', icon: '#D32F2F' },
  task_report_updated:      { bg: 'rgba(25,118,210,0.08)',  border: '#1976D2', icon: '#1976D2' },
  weekly_report_submitted:  { bg: 'rgba(63,81,181,0.08)',   border: '#3F51B5', icon: '#3F51B5' },
  feedback_received:        { bg: 'rgba(255,167,38,0.12)',  border: '#FFA726', icon: '#C2410C' },
  recommendation_received:  { bg: 'rgba(255,112,67,0.09)',  border: '#FF7043', icon: '#FF7043' },
  employee_of_month:        { bg: 'rgba(255,112,67,0.12)',  border: '#FF7043', icon: '#C2410C' },
  role_changed:             { bg: 'rgba(63,81,181,0.08)',   border: '#3F51B5', icon: '#3F51B5' },
  hierarchy_updated:        { bg: 'rgba(25,118,210,0.08)',  border: '#1976D2', icon: '#1976D2' },
  resignation_submitted:    { bg: 'rgba(255,112,67,0.08)',  border: '#FF7043', icon: '#FF7043' },
  resignation_accepted:     { bg: 'rgba(46,125,50,0.09)',   border: '#2E7D32', icon: '#2E7D32' },
  resignation_rejected:     { bg: 'rgba(211,47,47,0.07)',   border: '#D32F2F', icon: '#D32F2F' },
  general:          { bg: '#f8fafc', border: '#94a3b8', icon: '#475569' },
};

export const NOTIF_ICONS = {
  leave_applied:    '📋',
  leave_approved:   '✅',
  leave_rejected:   '❌',
  payslip_requested:'📄',
  payslip_approved: '✅',
  payslip_rejected: '❌',
  birthday:         '🎂',
  regularization_applied:   '🕒',
  regularization_approved:  '✅',
  regularization_rejected:  '❌',
  early_checkout_requested: '🚪',
  early_checkout_approved:  '✅',
  early_checkout_rejected:  '❌',
  task_report_updated:      '📊',
  weekly_report_submitted:  '🗓️',
  feedback_received:        '💬',
  recommendation_received:  '⭐',
  employee_of_month:        '🏆',
  role_changed:             '🔑',
  hierarchy_updated:        '🏢',
  resignation_submitted:    '📤',
  resignation_accepted:     '✅',
  resignation_rejected:     '❌',
  general:          '🔔',
};

export const NOTIF_LABELS = {
  leave_applied:    'Leave Request',
  leave_approved:   'Leave Approved',
  leave_rejected:   'Leave Rejected',
  payslip_requested:'Payslip Request',
  payslip_approved: 'Payslip Approved',
  payslip_rejected: 'Payslip Rejected',
  birthday:         'Birthday 🎉',
  general:          'Notification',
  regularization_applied:   'Regularization Request',
  regularization_approved:  'Regularization Approved',
  regularization_rejected:  'Regularization Rejected',
  early_checkout_requested: 'Early Checkout Request',
  early_checkout_approved:  'Early Checkout Approved',
  early_checkout_rejected:  'Early Checkout Rejected',
  task_report_updated:      'Task Report Updated',
  weekly_report_submitted:  'Weekly Report',
  feedback_received:        'Feedback Received',
  recommendation_received:  'Recommendation',
  employee_of_month:        'Employee of the Month',
  role_changed:             'Role Updated',
  hierarchy_updated:        'Reporting Line Updated',
  resignation_submitted:    'Resignation Submitted',
  resignation_accepted:     'Resignation Accepted',
  resignation_rejected:     'Resignation Rejected',

};

export const NOTIF_TYPES = {
  LEAVE_APPLIED:     'leave_applied',
  LEAVE_APPROVED:    'leave_approved',
  LEAVE_REJECTED:    'leave_rejected',
  PAYSLIP_REQUESTED: 'payslip_requested',
  PAYSLIP_APPROVED:  'payslip_approved',
  PAYSLIP_REJECTED:  'payslip_rejected',
  BIRTHDAY:          'birthday',
  GENERAL:           'general',
};

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────
const NotificationContext = createContext(null);

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used inside NotificationProvider');
  return ctx;
};

// ─────────────────────────────────────────────────────────────────────────────
// Toast component (self-contained, no external library needed)
// ─────────────────────────────────────────────────────────────────────────────
const ToastItem = ({ toast, onDismiss }) => {
  const col = NOTIF_COLORS[toast.type] || NOTIF_COLORS.general;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Animate in
    const t = setTimeout(() => setVisible(true), 20);
    return () => clearTimeout(t);
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(() => onDismiss(toast.id), 300);
  };

  return (
    <div
      onClick={handleDismiss}
      style={{
        display:       'flex',
        alignItems:    'flex-start',
        gap:           '10px',
        background:    '#ffffff',
        border:        `1px solid ${col.border}`,
        borderLeft:    `4px solid ${col.border}`,
        borderRadius:  '12px',
        padding:       '12px 14px',
        boxShadow:     '0 8px 30px rgba(0,0,0,0.12)',
        cursor:        'pointer',
        marginBottom:  '8px',
        maxWidth:      '360px',
        width:         '100%',
        transition:    'all 0.3s cubic-bezier(0.34,1.56,0.64,1)',
        opacity:       visible ? 1 : 0,
        transform:     visible ? 'translateX(0)' : 'translateX(120%)',
        pointerEvents: 'all',
      }}
    >
      {/* Icon */}
      <div style={{
        width: '36px', height: '36px', borderRadius: '9px',
        background: col.bg, display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: '16px', flexShrink: 0,
      }}>
        {NOTIF_ICONS[toast.type] || '🔔'}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: '700', color: col.icon, lineHeight: '1.3', marginBottom: '2px' }}>
          {toast.title}
        </div>
        <div style={{ fontSize: '12px', color: '#4b5563', lineHeight: '1.4' }}>
          {toast.message}
        </div>
        <div style={{
          fontSize: '10px', fontWeight: '700', marginTop: '5px',
          color: col.icon, background: col.bg,
          display: 'inline-block', padding: '2px 7px', borderRadius: '20px',
        }}>
          {NOTIF_LABELS[toast.type] || toast.type}
        </div>
      </div>

      {/* Close btn */}
      <button
        onClick={(e) => { e.stopPropagation(); handleDismiss(); }}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#9ca3af', fontSize: '13px', padding: '0', flexShrink: 0,
          lineHeight: 1,
        }}
      >✕</button>

      {/* Progress bar */}
      <div style={{
        position:  'absolute', bottom: 0, left: 0, right: 0,
        height:    '3px', borderRadius: '0 0 12px 12px',
        background: col.bg, overflow: 'hidden',
      }}>
        <div style={{
          height:     '100%',
          background: col.border,
          animation:  `__toastProgress ${toast.duration || 5000}ms linear forwards`,
        }} />
      </div>
    </div>
  );
};

// Toast Container — fixed bottom-right
const ToastContainer = ({ toasts, onDismiss }) => {
  if (!toasts.length) return null;
  return (
    <>
      <style>{`
        @keyframes __toastProgress {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>
      <div style={{
        position:   'fixed',
        bottom:     '24px',
        right:      '24px',
        zIndex:     99999,
        display:    'flex',
        flexDirection: 'column-reverse',
        alignItems: 'flex-end',
        pointerEvents: 'none',
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{ position: 'relative', pointerEvents: 'all' }}>
            <ToastItem toast={t} onDismiss={onDismiss} />
          </div>
        ))}
      </div>
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────
export const NotificationProvider = ({ children }) => {
  const { user } = useSelector(state => state.auth);

  const [toasts, setToasts] = useState([]);
  const toastCounter = useRef(0);

  // ── Show a toast manually (for actions inside the app) ────────────────────
  const showToast = useCallback(({ type = 'general', title, message, duration = 5000 }) => {
    const id = ++toastCounter.current;
    setToasts(prev => [...prev, { id, type, title, message, duration }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration + 400);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // ── Poll for new unread notifications (show toast for new ones) ───────────
  const lastSeenIdRef = useRef(null);
  const pollRef       = useRef(null);
  const shownIdsRef = useRef(new Set());

const pollNewNotifications = useCallback(async () => {
  if (!user) return;

  try {
    const res = await notificationAPI.getAll({
      limit: 5,
      unread: 'true',
    });

    const list = res.data?.notifications || [];

    if (!list.length) return;

    const newest = list[0];

    // First load: don't show old unread notifications
    if (lastSeenIdRef.current === null) {
      lastSeenIdRef.current = newest._id;

      // Remember existing unread notifications
      list.forEach(n => shownIdsRef.current.add(n._id));

      return;
    }

    // Find notifications that haven't been shown yet
    const newOnes = list.filter(
      n => !shownIdsRef.current.has(n._id)
    );

    if (newOnes.length > 0) {
      // Remember these notifications
      newOnes.forEach(n => shownIdsRef.current.add(n._id));

      lastSeenIdRef.current = newest._id;

      // Show only the newest notification
      const notification = newOnes[0];

      showToast({
        type: notification.type,
        title: notification.title,
        message: notification.message,
      });
    }
  } catch (err) {
    console.error('Notification polling failed:', err);
  }
}, [user, showToast]);

  useEffect(() => {
    if (!user) return;
    // Initial poll — sets lastSeenId without showing toast
    pollNewNotifications();
    // Poll every 30 seconds for new notifications
    pollRef.current = setInterval(pollNewNotifications, 30000);
    return () => clearInterval(pollRef.current);
  }, [user, pollNewNotifications]);

  return (
    <NotificationContext.Provider value={{ showToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </NotificationContext.Provider>
  );
};

export default NotificationProvider;