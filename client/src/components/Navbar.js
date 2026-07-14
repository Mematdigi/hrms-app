// src/components/Navbar.js
import React, { useState, useRef, useEffect, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, Link, useLocation } from "react-router-dom";
import logo from '../assets/scss/mematdigi-logo.jpg';
import { notificationAPI } from '../services/api';

// ─────────────────────────────────────────────────────────────────────────────
// Notification display config — colors, icons, labels per type
// ─────────────────────────────────────────────────────────────────────────────
export const NOTIF_COLORS = {
  leave_applied:     { bg: '#eff6ff', border: '#3b82f6', icon: '#1d4ed8' },
  leave_approved:    { bg: '#f0fdf4', border: '#22c55e', icon: '#15803d' },
  leave_rejected:    { bg: '#fef2f2', border: '#ef4444', icon: '#b91c1c' },
  payslip_requested: { bg: '#fff7ed', border: '#f97316', icon: '#c2410c' },
  payslip_approved:  { bg: '#f0fdf4', border: '#22c55e', icon: '#15803d' },
  payslip_rejected:  { bg: '#fef2f2', border: '#ef4444', icon: '#b91c1c' },
  birthday:          { bg: '#fdf4ff', border: '#a855f7', icon: '#7e22ce' },
  general:           { bg: '#f8fafc', border: '#94a3b8', icon: '#475569' },
};

export const NOTIF_ICONS = {
  leave_applied:     '📋',
  leave_approved:    '✅',
  leave_rejected:    '❌',
  payslip_requested: '📄',
  payslip_approved:  '✅',
  payslip_rejected:  '❌',
  birthday:          '🎂',
  general:           '🔔',
};

export const NOTIF_LABELS = {
  leave_applied:     'Leave Request',
  leave_approved:    'Leave Approved',
  leave_rejected:    'Leave Rejected',
  payslip_requested: 'Payslip Request',
  payslip_approved:  'Payslip Approved',
  payslip_rejected:  'Payslip Rejected',
  birthday:          '🎉 Birthday',
  general:           'Notification',
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper — relative time
// ─────────────────────────────────────────────────────────────────────────────
const timeAgo = (date) => {
  const diff = Math.floor((Date.now() - new Date(date)) / 1000);
  if (diff < 60)    return 'Just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

// ─────────────────────────────────────────────────────────────────────────────
// Navbar Component
// ─────────────────────────────────────────────────────────────────────────────
const Navbar = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useSelector((state) => state.auth);

  // ── Bell state ─────────────────────────────────────────────────────────────
  const [bellNotifs,  setBellNotifs]  = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [bellLoading, setBellLoading] = useState(false);
  const [bellError,   setBellError]   = useState('');
  const [bellFilter,  setBellFilter]  = useState('all');

  // ── Birthday toast state ───────────────────────────────────────────────────
  const [birthdayToasts, setBirthdayToasts] = useState([]);
  // Ref so poll always sees latest shown IDs (avoids stale closure)
  const shownBirthdaysRef = useRef(
    (() => { try { return new Set(JSON.parse(sessionStorage.getItem('_bd_shown') || '[]')); } catch { return new Set(); } })()
  );
  const markBirthdaysShown = (ids) => {
    ids.forEach(id => shownBirthdaysRef.current.add(id));
    try { sessionStorage.setItem('_bd_shown', JSON.stringify([...shownBirthdaysRef.current])); } catch {}
  };

  // ── UI state ───────────────────────────────────────────────────────────────
  const [menuOpen,      setMenuOpen]      = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isBellOpen,    setIsBellOpen]    = useState(false);

  const profileRef = useRef(null);
  const bellRef    = useRef(null);
  const pollRef    = useRef(null);

  // ── Fetch notifications ────────────────────────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      setBellLoading(true);
      setBellError('');
      const res    = await notificationAPI.getAll({ limit: 30 });
      const data   = res.data?.notifications ?? [];
      const unread = res.data?.unreadCount   ?? 0;
      setBellNotifs(data.map(n => ({ ...n, read: !!n.isRead })));
      setUnreadCount(unread);

      // Birthday toast on initial load
      const bdToShow = data.filter(n => n.type === 'birthday' && !n.isRead && !shownBirthdaysRef.current.has(n._id));
      if (bdToShow.length) {
        markBirthdaysShown(bdToShow.map(n => n._id));
        setBirthdayToasts(prev => [...prev, ...bdToShow.map(n => ({ id: n._id, title: n.title, message: n.message }))]);
      }
    } catch (err) {
      console.error('fetchNotifications:', err?.response?.data || err.message);
      setBellError('Could not load notifications');
    } finally {
      setBellLoading(false);
    }
  }, [user]);

  // ── Silent background poll every 15s ──────────────────────────────────────
  // Checks for new birthday notifications automatically without opening the bell.
  const silentPoll = useCallback(async () => {
    if (!user) return;
    try {
      const res    = await notificationAPI.getAll({ limit: 30 });
      const data   = res.data?.notifications ?? [];
      const unread = res.data?.unreadCount   ?? 0;

      // Update bell list silently (merge to preserve local read-state)
      setBellNotifs(prev => {
        const prevMap = Object.fromEntries(prev.map(n => [n._id, n]));
        return data.map(n => prevMap[n._id] ?? { ...n, read: !!n.isRead });
      });
      setUnreadCount(unread);

      // Birthday toast trigger (ref-based, no stale closure)
      const bdNew = data.filter(n => n.type === 'birthday' && !n.isRead && !shownBirthdaysRef.current.has(n._id));
      if (bdNew.length) {
        markBirthdaysShown(bdNew.map(n => n._id));
        setBirthdayToasts(prev => [...prev, ...bdNew.map(n => ({ id: n._id, title: n.title, message: n.message }))]);
      }
    } catch { /* silent */ }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchNotifications();
    pollRef.current = setInterval(silentPoll, 300000);
    return () => clearInterval(pollRef.current);
  }, [user, fetchNotifications]);

  

  // ── Close on outside click ─────────────────────────────────────────────────
  useEffect(() => {
    const handle = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setIsProfileOpen(false);
      if (bellRef.current    && !bellRef.current.contains(e.target))    setIsBellOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleLogout = () => {
    clearInterval(pollRef.current);
    localStorage.removeItem('token');
    dispatch({ type: 'LOGOUT' });
    navigate('/login');
  };

  const handleBellToggle = async () => {
    const next = !isBellOpen;
    setIsBellOpen(next);
    setIsProfileOpen(false);
    if (next) await fetchNotifications();
  };

  const handleMarkAllRead = async (e) => {
    e.stopPropagation();
    try {
      await notificationAPI.markAllRead();
      setBellNotifs(prev => prev.map(n => ({ ...n, read: true, isRead: true })));
      setUnreadCount(0);
    } catch (err) { console.error(err); }
  };

  const handleClearAll = async (e) => {
    e.stopPropagation();
    try {
      await notificationAPI.clearAll();
      setBellNotifs([]);
      setUnreadCount(0);
    } catch (err) { console.error(err); }
  };

  const handleMarkOneRead = async (notif, e) => {
    e?.stopPropagation();
    if (notif.read) return;
    try {
      await notificationAPI.markAsRead(notif._id);
      setBellNotifs(prev => prev.map(n => n._id === notif._id ? { ...n, read: true, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) { console.error(err); }
  };

  const handleDeleteOne = async (notif, e) => {
    e.stopPropagation();
    try {
      await notificationAPI.deleteOne(notif._id);
      setBellNotifs(prev => prev.filter(n => n._id !== notif._id));
      if (!notif.read) setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) { console.error(err); }
  };

  const handleDismissBirthdayToast = async (id) => {
    setBirthdayToasts(prev => prev.filter(t => t.id !== id));
    // Mark as read on backend so it never re-toasts (even after page refresh)
    try {
      await notificationAPI.markAsRead(id);
      setBellNotifs(prev => prev.map(n => n._id === id ? { ...n, read: true, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch { /* silent */ }
  };

  // ── Nav helpers ────────────────────────────────────────────────────────────
  const getIcon = (label) => {
    const l = label.toLowerCase();
    if (l.includes('dashboard'))   return 'bi-grid-fill';
    if (l.includes('attendance'))  return 'bi-clock';
    if (l.includes('leave'))       return 'bi-calendar-event';
    if (l.includes('office document')) return 'bi-file-earmark-text';
    if (l.includes('payroll'))     return 'bi-currency-dollar';
    if (l.includes('employee'))    return 'bi-people';
    if (l.includes('document'))    return 'bi-file-earmark-text';
    if (l.includes('performance')) return 'bi-graph-up';
    if (l.includes('role'))        return 'bi-person-badge';
    if (l.includes('profile'))     return 'bi-person';
    return 'bi-circle';
  };

  const getMenuItems = () => {
    const base    = [{ label: 'Dashboard', path: '/dashboard' }];
    const profile = { label: 'Profile',   path: '/profile-settings' };
    if (user?.role === 'admin')    return [...base, { label: 'Attendance', path: '/attendance' }, { label: 'Leaves', path: '/leave' },{ label: 'Office Documents', path: '/office-document-upload' }, { label: 'Payroll', path: '/payroll' }, { label: 'Employees', path: '/employees' }, { label: 'Roles', path: '/roles' }, profile];
    if (user?.role === 'hr')       return [...base, { label: 'Attendance', path: '/attendance' }, { label: 'Leaves', path: '/leave' },{ label: 'Office Documents', path: '/office-document-upload' }, { label: 'Payroll', path: '/payroll' }, { label: 'Employees', path: '/employees' }, profile];
    if (user?.role === 'manager')  return [...base, { label: 'Attendance', path: '/attendance' }, { label: 'Leaves', path: '/leave' },{ label: 'Office Documents', path: '/office-document-upload' }, { label: 'Employees', path: '/employees' }, { label: 'Payroll', path: '/payroll' }, profile];
    if (user?.role === 'employee') return [...base, { label: 'Attendance', path: '/attendance' }, { label: 'Leaves', path: '/leave' },{ label: 'Office Documents', path: '/office-document-upload' }, { label: 'Payroll', path: '/payroll' }, profile];
    return base;
  };

  const menuItems      = getMenuItems();
  const filteredNotifs = bellFilter === 'unread' ? bellNotifs.filter(n => !n.read) : bellNotifs;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes __badgePop   { 0%{transform:scale(0)} 70%{transform:scale(1.2)} 100%{transform:scale(1)} }
        @keyframes __panelSlide { from{opacity:0;transform:translateY(-10px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes __dotPulse   { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes __spin       { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes __bdSlideIn  { from{opacity:0;transform:translateX(110%)} to{opacity:1;transform:translateX(0)} }
        @keyframes __confetti   { 0%{transform:translateY(0) rotate(0deg);opacity:1} 100%{transform:translateY(60px) rotate(720deg);opacity:0} }
        @keyframes __bdShimmer  { 0%{background-position:200% center} 100%{background-position:-200% center} }

        .notif-item               { transition: background 0.15s; }
        .notif-item:hover         { background: #f8fafc !important; }
        .notif-item:hover .ndel   { opacity: 1 !important; }
        .nbtn:hover               { background: #f3f4f6 !important; color: #111827 !important; }
        .nbtn-red:hover           { background: #fee2e2 !important; color: #dc2626 !important; }
        .ntab                     { transition: all 0.15s; }
        .ntab:hover               { color: #0d3a98 !important; }
        .nscroll::-webkit-scrollbar       { width: 4px; }
        .nscroll::-webkit-scrollbar-track { background: transparent; }
        .nscroll::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 4px; }
      `}</style>

      {/* ══════════════ BIRTHDAY TOASTS ══════════════ */}
      {birthdayToasts.length > 0 && (
        <div style={{
          position: 'fixed', top: '80px', right: '20px',
          zIndex: 99999, display: 'flex', flexDirection: 'column', gap: '10px',
          pointerEvents: 'none',
        }}>
          {birthdayToasts.map((toast) => (
            <div key={toast.id} style={{
              pointerEvents: 'auto',
              width: '340px',
              background: 'linear-gradient(135deg, #fdf4ff 0%, #fce7f3 50%, #ede9fe 100%)',
              border: '1.5px solid #d8b4fe',
              borderRadius: '18px',
              boxShadow: '0 20px 60px rgba(168,85,247,0.25), 0 4px 20px rgba(168,85,247,0.15)',
              padding: '16px 18px',
              animation: '__bdSlideIn 0.45s cubic-bezier(0.34,1.56,0.64,1)',
              position: 'relative',
              overflow: 'hidden',
            }}>
              {/* Shimmer bar */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
                background: 'linear-gradient(90deg, #a855f7, #ec4899, #f59e0b, #a855f7)',
                backgroundSize: '200% auto',
                animation: '__bdShimmer 2s linear infinite',
                borderRadius: '18px 18px 0 0',
              }} />

              {/* Confetti dots */}
              {['#f59e0b','#ec4899','#a855f7','#3b82f6','#10b981'].map((c, i) => (
                <div key={i} style={{
                  position: 'absolute',
                  top: `${10 + i * 8}px`,
                  left: `${20 + i * 55}px`,
                  width: '6px', height: '6px',
                  borderRadius: i % 2 === 0 ? '50%' : '2px',
                  background: c, opacity: 0.7,
                  animation: `__confetti ${1.5 + i * 0.3}s ease-out ${i * 0.15}s infinite`,
                }} />
              ))}

              {/* Content row */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                {/* Cake emoji circle */}
                <div style={{
                  width: '46px', height: '46px', borderRadius: '14px', flexShrink: 0,
                  background: 'linear-gradient(135deg, #e9d5ff, #fce7f3)',
                  border: '1.5px solid #d8b4fe',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '24px',
                }}>
                  🎂
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '13px', fontWeight: '800', color: '#6b21a8',
                    marginBottom: '3px', letterSpacing: '-0.2px',
                  }}>
                    {toast.title || '🎉 Birthday Today!'}
                  </div>
                  <div style={{
                    fontSize: '12px', color: '#7c3aed', lineHeight: '1.5',
                    fontWeight: '500',
                  }}>
                    {toast.message}
                  </div>
                </div>

                {/* Close button */}
                <button
                  onClick={() => handleDismissBirthdayToast(toast.id)}
                  style={{
                    background: 'rgba(168,85,247,0.12)', border: 'none',
                    borderRadius: '8px', width: '26px', height: '26px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: '#a855f7', fontSize: '12px',
                    flexShrink: 0, transition: 'background 0.15s',
                  }}
                  title="Dismiss"
                >
                  <i className="bi bi-x-lg" />
                </button>
              </div>

              {/* Bottom label */}
              <div style={{
                marginTop: '10px', paddingTop: '9px',
                borderTop: '1px solid rgba(168,85,247,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{
                  fontSize: '10px', fontWeight: '700', letterSpacing: '0.5px',
                  textTransform: 'uppercase', color: '#a855f7',
                }}>
                  🎉 Birthday Notification
                </span>
                <button
                  onClick={() => handleDismissBirthdayToast(toast.id)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: '11px', fontWeight: '700', color: '#7c3aed', padding: 0,
                  }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* ══════════════ END BIRTHDAY TOASTS ══════════════ */}

      <div className="hr-mains">
        <div className="navbar-row">

          {/* LEFT — Logo + Nav links */}
          <div className="navbar-left-section">
            <Link to="/dashboard" className="text-decoration-none logo-block">
              <div className="logo-icon">
                <img src={logo} alt="Logo" className="logo-img-inner" />
              </div>
            </Link>
            <div className="nav-divider d-none d-lg-block" />
            <ul className="nav d-none d-lg-flex nav-custom">
              {getMenuItems().map((item) => (
                <li className="nav-item" key={item.path}>
                  <Link
                    to={item.path}
                    className={"nav-link-custom " + (location.pathname.startsWith(item.path) ? "active " : "") + (item.path === '/dashboard' ? "dashboard-tab" : "")}
                  >
                    <i className={`bi ${getIcon(item.label)} me-2`} />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* RIGHT — Bell + Profile */}
          <div className="navbar-right-section d-none d-lg-flex" style={{ alignItems: 'center', gap: '8px' }}>

            {/* ══════════════ BELL ══════════════ */}
            <div ref={bellRef} style={{ position: 'relative' }}>

              {/* Bell button */}
              <button
                className="icon-btn"
                onClick={handleBellToggle}
                title="Notifications"
                style={{ position: 'relative' }}
              >
                <i className={`bi ${isBellOpen ? 'bi-bell-fill' : 'bi-bell'}`} />
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute', top: '2px', right: '2px',
                    background: '#ef4444', color: '#fff',
                    fontSize: '9px', fontWeight: '800',
                    minWidth: '16px', height: '16px', padding: '0 3px',
                    borderRadius: '10px', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', border: '2px solid #fff', lineHeight: 1,
                    animation: '__badgePop 0.35s cubic-bezier(0.34,1.56,0.64,1)',
                  }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* ── PANEL ── */}
              {isBellOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 14px)', right: '-8px',
                  width: '400px', background: '#fff',
                  border: '1px solid #e5e7eb', borderRadius: '18px',
                  boxShadow: '0 24px 64px rgba(0,0,0,0.13), 0 4px 20px rgba(0,0,0,0.07)',
                  zIndex: 9999, overflow: 'hidden',
                  animation: '__panelSlide 0.2s cubic-bezier(0.34,1.56,0.64,1)',
                }}>

                  {/* Arrow */}
                  <div style={{
                    position: 'absolute', top: '-6px', right: '22px',
                    width: '12px', height: '12px', background: '#fafafa',
                    borderTop: '1px solid #e5e7eb', borderLeft: '1px solid #e5e7eb',
                    transform: 'rotate(45deg)', zIndex: 1,
                  }} />

                  {/* Header */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 16px 12px',
                    borderBottom: '1px solid #f0f0f0',
                    background: 'linear-gradient(135deg, #fafafa, #f5f7ff)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '30px', height: '30px', borderRadius: '9px',
                        background: 'linear-gradient(135deg,#0d3a98,#4f75e8)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <i className="bi bi-bell-fill" style={{ color: '#fff', fontSize: '13px' }} />
                      </div>
                      <span style={{ fontWeight: '700', fontSize: '14px', color: '#111827' }}>
                        Notifications
                      </span>
                      {unreadCount > 0 && (
                        <span style={{
                          background: 'linear-gradient(135deg,#0d3a98,#4f75e8)',
                          color: '#fff', fontSize: '10px', fontWeight: '700',
                          padding: '2px 9px', borderRadius: '20px',
                        }}>
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '2px' }}>
                      {[
                        { icon: 'bi-check2-all', action: handleMarkAllRead, title: 'Mark all read',  cls: 'nbtn' },
                        { icon: 'bi-trash3',     action: handleClearAll,    title: 'Clear all',      cls: 'nbtn nbtn-red' },
                        { icon: 'bi-x-lg',       action: (e) => { e.stopPropagation(); setIsBellOpen(false); }, title: 'Close', cls: 'nbtn nbtn-red' },
                      ].map(({ icon, action, title, cls }) => (
                        <button key={icon} className={cls} onClick={action} title={title} style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          width: '30px', height: '30px', borderRadius: '8px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#6b7280', fontSize: '13px',
                        }}>
                          <i className={`bi ${icon}`} />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tabs */}
                  <div style={{
                    display: 'flex', padding: '6px 16px 0',
                    borderBottom: '1px solid #f0f0f0',
                    background: '#fafafa', gap: '12px',
                  }}>
                    {[
                      { key: 'all',    label: 'All',    count: bellNotifs.length },
                      { key: 'unread', label: 'Unread', count: unreadCount },
                    ].map(tab => {
                      const active = bellFilter === tab.key;
                      return (
                        <button key={tab.key} className="ntab" onClick={() => setBellFilter(tab.key)} style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          padding: '7px 0', fontSize: '12px', fontWeight: '600',
                          color: active ? '#0d3a98' : '#6b7280',
                          borderBottom: active ? '2px solid #0d3a98' : '2px solid transparent',
                          marginBottom: '-1px',
                          display: 'flex', alignItems: 'center', gap: '5px',
                        }}>
                          {tab.label}
                          <span style={{
                            background: active ? '#0d3a98' : '#e5e7eb',
                            color: active ? '#fff' : '#6b7280',
                            fontSize: '9px', fontWeight: '800',
                            padding: '1px 5px', borderRadius: '10px',
                          }}>
                            {tab.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Notification list */}
                  <div className="nscroll" style={{ maxHeight: '390px', overflowY: 'auto', padding: '8px 8px 4px' }}>

                    {/* Loading */}
                    {bellLoading && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', color: '#9ca3af', gap: '10px' }}>
                        <i className="bi bi-arrow-clockwise" style={{ animation: '__spin 0.8s linear infinite', fontSize: '16px' }} />
                        <span style={{ fontSize: '13px' }}>Loading…</span>
                      </div>
                    )}

                    {/* Error */}
                    {!bellLoading && bellError && (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 20px', gap: '10px', color: '#ef4444' }}>
                        <i className="bi bi-exclamation-circle" style={{ fontSize: '28px', opacity: 0.6 }} />
                        <span style={{ fontSize: '12.5px', fontWeight: '500' }}>{bellError}</span>
                        <button onClick={fetchNotifications} style={{
                          background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px',
                          color: '#1d4ed8', fontSize: '11px', fontWeight: '600', padding: '5px 14px', cursor: 'pointer',
                        }}>
                          Retry
                        </button>
                      </div>
                    )}

                    {/* Empty */}
                    {!bellLoading && !bellError && filteredNotifs.length === 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '44px 20px', gap: '12px' }}>
                        <div style={{
                          width: '56px', height: '56px', borderRadius: '16px',
                          background: 'linear-gradient(135deg, #eff6ff, #f0f9ff)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px',
                        }}>🔔</div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
                            {bellFilter === 'unread' ? 'All caught up!' : 'No notifications yet'}
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#9ca3af' }}>
                            {bellFilter === 'unread'
                              ? 'You have no unread notifications.'
                              : 'Notifications will appear here when there is activity.'}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Items */}
                    {!bellLoading && !bellError && filteredNotifs.map((notif, idx) => {
                      const col = NOTIF_COLORS[notif.type] || NOTIF_COLORS.general;
                      return (
                        <div
                          key={notif._id}
                          className="notif-item"
                          onClick={(e) => handleMarkOneRead(notif, e)}
                          style={{
                            display: 'flex', alignItems: 'flex-start', gap: '11px',
                            padding: '11px 12px',
                            borderRadius: '12px',
                            marginBottom: idx < filteredNotifs.length - 1 ? '3px' : 0,
                            borderLeft: `3px solid ${notif.read ? '#e5e7eb' : col.border}`,
                            background: (!notif.read && notif.type === 'birthday')
                              ? 'linear-gradient(135deg, #fdf4ff, #fce7f3)'
                              : notif.read ? 'transparent' : col.bg,
                            cursor: 'default',
                            position: 'relative',
                            boxShadow: (!notif.read && notif.type === 'birthday')
                              ? '0 2px 12px rgba(168,85,247,0.18)'
                              : 'none',
                          }}
                        >
                          {/* Icon */}
                          <div style={{
                            width: '38px', height: '38px', borderRadius: '11px', flexShrink: 0,
                            background: notif.read ? '#f3f4f6' : col.bg,
                            border: `1px solid ${notif.read ? '#e5e7eb' : col.border}25`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '17px',
                            filter: notif.read ? 'grayscale(50%) opacity(0.7)' : 'none',
                          }}>
                            {NOTIF_ICONS[notif.type] || '🔔'}
                          </div>

                          {/* Body */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: '12.5px', lineHeight: '1.35', marginBottom: '3px',
                              fontWeight: notif.read ? '600' : '700',
                              color: notif.read ? '#374151' : col.icon,
                            }}>
                              {notif.title}
                            </div>
                            <div style={{ fontSize: '11.5px', color: '#6b7280', lineHeight: '1.5', marginBottom: '7px' }}>
                              {notif.message}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                              <span style={{
                                fontSize: '9.5px', fontWeight: '700', letterSpacing: '0.3px',
                                padding: '2px 8px', borderRadius: '20px', textTransform: 'uppercase',
                                color: notif.read ? '#6b7280' : col.icon,
                                background: notif.read ? '#f3f4f6' : col.bg,
                                border: `1px solid ${notif.read ? '#e5e7eb' : col.border}30`,
                              }}>
                                {NOTIF_LABELS[notif.type] || notif.type}
                              </span>
                              <span style={{ fontSize: '10.5px', color: '#9ca3af', fontWeight: '500' }}>
                                {timeAgo(notif.createdAt)}
                              </span>
                            </div>
                          </div>

                          {/* Right: dot + delete */}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                            {!notif.read && (
                              <div style={{
                                width: '8px', height: '8px', borderRadius: '50%',
                                background: col.border, marginTop: '6px',
                                animation: '__dotPulse 2s ease-in-out infinite',
                              }} />
                            )}
                            <button
                              className="ndel nbtn nbtn-red"
                              onClick={(e) => handleDeleteOne(notif, e)}
                              title="Delete"
                              style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                width: '22px', height: '22px', borderRadius: '6px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: '#9ca3af', fontSize: '11px',
                                opacity: 0, transition: 'opacity 0.15s',
                                marginTop: notif.read ? '4px' : '0',
                              }}
                            >
                              <i className="bi bi-x-lg" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Footer */}
                  {!bellLoading && bellNotifs.length > 0 && (
                    <div style={{
                      padding: '10px 16px',
                      borderTop: '1px solid #f0f0f0',
                      background: '#fafafa',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                        {bellNotifs.length} notification{bellNotifs.length !== 1 ? 's' : ''}
                      </span>
                      <button onClick={handleMarkAllRead} style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: '11px', fontWeight: '600', color: '#0d3a98', padding: 0,
                      }}>
                        Mark all read
                      </button>
                    </div>
                  )}

                </div>
              )}
            </div>
            {/* ══════════════ END BELL ══════════════ */}

            <div className="nav-divider" />

            {/* Profile dropdown */}
            <div
              className="profile-wrapper"
              ref={profileRef}
              onClick={() => { setIsProfileOpen(p => !p); setIsBellOpen(false); }}
              title="Account Settings"
            >
              <div className="profile-avatar">
                {user?.firstName ? user.firstName[0].toUpperCase() : 'J'}
                {user?.lastName  ? user.lastName[0].toUpperCase()  : 'S'}
              </div>
              <div className="profile-info">
                <span className="profile-name">
                  {user?.firstName ? `${user.firstName} ${user.lastName}` : 'John Smith'}
                </span>
                <span className="profile-role">
                  {user?.role === 'hr' ? 'HR Manager' : user?.role || 'HR Manager'}
                </span>
              </div>
              <div className={`profile-dropdown ${isProfileOpen ? 'show' : ''}`}>
                <div className="dropdown-header">
                  <p className="mb-0 fw-bold">My Account</p>
                </div>
                <Link to="/profile-settings" className="dropdown-item">
                  <i className="bi bi-person-gear me-2" /> Manage Profile
                </Link>
                <div className="dropdown-divider" />
                <button onClick={handleLogout} className="dropdown-item text-danger">
                  <i className="bi bi-box-arrow-right me-2" /> Logout
                </button>
              </div>
            </div>

          </div>

          {/* Mobile hamburger */}
          <div className="d-lg-none">
            <button
              className={`menu-icon ${menuOpen ? 'open' : ''}`}
              onClick={() => setMenuOpen(p => !p)}
              aria-label="Toggle navigation"
            >
              <span className="bar" /><span className="bar" /><span className="bar" />
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <div className={`nav-menu-mobile d-lg-none ${menuOpen ? 'active' : ''}`}>
          <ul className="list-unstyled mb-2">
            {menuItems.map((item) => (
              <li key={item.path} className="mb-1">
                <Link
                  to={item.path}
                  className={`nav-link-mobile ${location.pathname.startsWith(item.path) ? 'active' : ''}`}
                  onClick={() => setMenuOpen(false)}
                >
                  <i className={`bi ${getIcon(item.label)} me-2`} />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mobile-footer">
            <button onClick={handleLogout} className="btn btn-sm btn-outline-danger w-100">Logout</button>
          </div>
        </div>

      </div>
    </>
  );
};

export default Navbar;