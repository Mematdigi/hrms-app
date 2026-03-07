// src/components/Navbar.js
import React, { useState, useRef, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, Link, useLocation } from "react-router-dom";
import logo from '../assets/scss/mematdigi-logo.jpg';
import { useNotifications, NOTIF_COLORS, NOTIF_ICONS, NOTIF_LABELS } from '../context/NotificationContext';

// ─────────────────────────────────────────────────────────────────────────────
// Helper — how long ago
// ─────────────────────────────────────────────────────────────────────────────
const timeAgo = (date) => {
  const diff = Math.floor((Date.now() - new Date(date)) / 1000);
  if (diff < 60)    return 'Just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

const Navbar = () => {
  const dispatch   = useDispatch();
  const navigate   = useNavigate();
  const location   = useLocation();
  const { user }   = useSelector((state) => state.auth);

  // ── Notification hook ──────────────────────────────────────────────────────
  const { bellNotifs, unreadCount, markAllRead, clearAll } = useNotifications();

  // ── Local UI state ─────────────────────────────────────────────────────────
  const [menuOpen,       setMenuOpen]       = useState(false);
  const [isProfileOpen,  setIsProfileOpen]  = useState(false);
  const [isBellOpen,     setIsBellOpen]     = useState(false);
  const [bellFilter,     setBellFilter]     = useState('all'); // 'all' | 'unread'

  const profileRef = useRef(null);
  const bellRef    = useRef(null);

  // ── Close dropdowns on outside click ──────────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setIsProfileOpen(false);
      }
      if (bellRef.current && !bellRef.current.contains(e.target)) {
        setIsBellOpen(false);
        markAllRead(); // mark read when closing
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [markAllRead]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    dispatch({ type: "LOGOUT" });
    navigate("/login");
  };

  const toggleMenu = () => setMenuOpen((prev) => !prev);

  const handleBellToggle = () => {
    const next = !isBellOpen;
    setIsBellOpen(next);
    setIsProfileOpen(false);
    if (!next) markAllRead();
  };

  // ── Icons ──────────────────────────────────────────────────────────────────
  const getIcon = (label) => {
    const l = label.toLowerCase();
    if (l.includes("dashboard"))   return "bi-grid-fill";
    if (l.includes("attendance"))  return "bi-clock";
    if (l.includes("leave"))       return "bi-calendar-event";
    if (l.includes("payroll"))     return "bi-currency-dollar";
    if (l.includes("employee"))    return "bi-people";
    if (l.includes("document"))    return "bi-file-earmark-text";
    if (l.includes("performance")) return "bi-graph-up";
    if (l.includes("role"))        return "bi-person-badge";
    if (l.includes("profile"))     return "bi-person";
    return "bi-circle";
  };

  // ── Role-based menu items (unchanged) ─────────────────────────────────────
  const getMenuItems = () => {
    const baseItems  = [{ label: "Dashboard", path: "/dashboard" }];
    const profileItem = { label: 'Profile', path: '/profile-settings' };

    if (user?.role === "admin") {
      return [
        ...baseItems,
        { label: 'Attendance', path: '/attendance' },
        { label: 'Leaves',     path: '/leave' },
        { label: 'Payroll',    path: '/payroll' },
        { label: 'Employees',  path: '/employees' },
        { label: 'Roles',      path: '/roles', admin: true },
        profileItem,
      ];
    }
    if (user?.role === "hr") {
      return [
        ...baseItems,
        { label: 'Attendance', path: '/attendance' },
        { label: 'Leaves',     path: '/leave' },
        { label: 'Payroll',    path: '/payroll' },
        { label: 'Employees',  path: '/employees' },
        profileItem,
      ];
    }
    if (user?.role === "manager") {
      return [
        ...baseItems,
        { label: "Attendance", path: "/attendance" },
        { label: "Leaves",     path: "/leave" },
        { label: "Employees",  path: "/employees" },
        { label: 'Payroll',    path: '/payroll' },
        profileItem,
      ];
    }
    if (user?.role === "employee") {
      return [
        ...baseItems,
        { label: "Attendance", path: "/attendance" },
        { label: "Leaves",     path: "/leave" },
        { label: 'Payroll',    path: '/payroll' },
        profileItem,
      ];
    }
    return baseItems;
  };

  const menuItems     = getMenuItems();
  const filteredNotifs = bellFilter === 'unread'
    ? bellNotifs.filter(n => !n.read)
    : bellNotifs;

  return (
    <>
      {/* ── Inject keyframe animations once ── */}
      <style>{`
        @keyframes __badgePop {
          0%   { transform: scale(0); }
          70%  { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
        @keyframes __panelSlide {
          from { opacity: 0; transform: translateY(-8px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
        @keyframes __dotPulse {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.35; }
        }
        .notif-item-hover:hover { background: #f8fafc !important; }
        .notif-action-hover:hover { background: #f3f4f6 !important; color: #111827 !important; }
        .notif-close-hover:hover  { background: #fee2e2 !important; color: #dc2626 !important; }
        .notif-tab-el { cursor: pointer; transition: all 0.15s ease; border: none; }
        .notif-tab-el:hover { color: #0d3a98 !important; }
        .notif-list-scroll::-webkit-scrollbar       { width: 4px; }
        .notif-list-scroll::-webkit-scrollbar-track  { background: transparent; }
        .notif-list-scroll::-webkit-scrollbar-thumb  { background: #d1d5db; border-radius: 4px; }
      `}</style>

      <div className="hr-mains">
        {/* ── TOP ROW ── */}
        <div className="navbar-row">

          {/* LEFT: Logo + Nav Items */}
          <div className="navbar-left-section">
            <Link to="/dashboard" className="text-decoration-none logo-block">
              <div className="logo-icon">
                <img src={logo} alt="Logo" className="logo-img-inner" />
              </div>
            </Link>

            <div className="nav-divider d-none d-lg-block" />

            <ul className="nav d-none d-lg-flex nav-custom">
              {menuItems.map((item) => {
                const isActive    = location.pathname.startsWith(item.path);
                const isDashboard = item.path === '/dashboard';
                return (
                  <li className="nav-item" key={item.path}>
                    <Link
                      to={item.path}
                      className={
                        "nav-link-custom " +
                        (isActive ? "active " : "") +
                        (isDashboard ? "dashboard-tab" : "")
                      }
                    >
                      <i className={`bi ${getIcon(item.label)} me-2`} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* RIGHT: Bell + Profile */}
          <div className="navbar-right-section d-none d-lg-flex" style={{ alignItems: 'center', gap: '8px' }}>

            {/* ── BELL BUTTON + PANEL ── */}
            <div className="icon-btn-wrapper" ref={bellRef} style={{ position: 'relative' }}>
              <button
                className="icon-btn"
                onClick={handleBellToggle}
                title="Notifications"
                style={{ position: 'relative' }}
              >
                <i className={`bi ${isBellOpen ? 'bi-bell-fill' : 'bi-bell'}`} />
                {unreadCount > 0 && (
                  <span
                    className="badge-notification"
                    style={{
                      position:       'absolute',
                      top:            '2px',
                      right:          '2px',
                      background:     '#ef4444',
                      color:          '#fff',
                      fontSize:       '9px',
                      fontWeight:     '800',
                      minWidth:       '16px',
                      height:         '16px',
                      padding:        '0 3px',
                      borderRadius:   '10px',
                      display:        'flex',
                      alignItems:     'center',
                      justifyContent: 'center',
                      border:         '2px solid #fff',
                      lineHeight:     1,
                      animation:      '__badgePop 0.35s cubic-bezier(0.34,1.56,0.64,1)',
                    }}
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* ── NOTIFICATION PANEL ── */}
              {isBellOpen && (
                <div style={{
                  position:     'absolute',
                  top:          'calc(100% + 12px)',
                  right:        '-8px',
                  width:        '380px',
                  background:   '#ffffff',
                  border:       '1px solid #e5e7eb',
                  borderRadius: '16px',
                  boxShadow:    '0 20px 60px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.07)',
                  zIndex:       9999,
                  overflow:     'hidden',
                  animation:    '__panelSlide 0.22s cubic-bezier(0.34,1.56,0.64,1)',
                }}>
                  {/* Arrow */}
                  <div style={{
                    position:    'absolute',
                    top:         '-6px',
                    right:       '20px',
                    width:       '12px',
                    height:      '12px',
                    background:  '#fff',
                    borderTop:   '1px solid #e5e7eb',
                    borderLeft:  '1px solid #e5e7eb',
                    transform:   'rotate(45deg)',
                    zIndex:      1,
                  }} />

                  {/* Header */}
                  <div style={{
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'space-between',
                    padding:        '14px 16px 12px',
                    borderBottom:   '1px solid #f3f4f6',
                    background:     '#fafafa',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <i className="bi bi-bell-fill" style={{ color: '#0d3a98', fontSize: '13px' }} />
                      <span style={{ fontWeight: '700', fontSize: '14px', color: '#111827' }}>
                        Notifications
                      </span>
                      {unreadCount > 0 && (
                        <span style={{
                          background:   'linear-gradient(135deg,#0d3a98,#4f75e8)',
                          color:        '#fff',
                          fontSize:     '10px',
                          fontWeight:   '700',
                          padding:      '2px 8px',
                          borderRadius: '20px',
                        }}>
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '2px' }}>
                      {/* Mark all read */}
                      <button
                        className="notif-action-hover"
                        onClick={markAllRead}
                        title="Mark all read"
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          width: '28px', height: '28px', borderRadius: '7px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#6b7280', fontSize: '13px',
                        }}
                      >
                        <i className="bi bi-check2-all" />
                      </button>
                      {/* Clear all */}
                      <button
                        className="notif-action-hover"
                        onClick={clearAll}
                        title="Clear all"
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          width: '28px', height: '28px', borderRadius: '7px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#6b7280', fontSize: '13px',
                        }}
                      >
                        <i className="bi bi-trash3" />
                      </button>
                      {/* Close */}
                      <button
                        className="notif-action-hover notif-close-hover"
                        onClick={() => { setIsBellOpen(false); markAllRead(); }}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          width: '28px', height: '28px', borderRadius: '7px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#6b7280', fontSize: '13px',
                        }}
                      >
                        <i className="bi bi-x-lg" />
                      </button>
                    </div>
                  </div>

                  {/* Filter tabs */}
                  <div style={{
                    display:      'flex',
                    padding:      '8px 12px 0',
                    borderBottom: '1px solid #f3f4f6',
                    gap:          '2px',
                  }}>
                    {[
                      { key: 'all',    label: `All (${bellNotifs.length})` },
                      { key: 'unread', label: `Unread (${unreadCount})` },
                    ].map(tab => {
                      const active = bellFilter === tab.key;
                      return (
                        <button
                          key={tab.key}
                          className="notif-tab-el"
                          onClick={() => setBellFilter(tab.key)}
                          style={{
                            background:   'none',
                            padding:      '7px 12px',
                            fontSize:     '12px',
                            fontWeight:   '600',
                            color:        active ? '#0d3a98' : '#6b7280',
                            borderRadius: '7px 7px 0 0',
                            borderBottom: active ? '2px solid #0d3a98' : '2px solid transparent',
                            marginBottom: '-1px',
                          }}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Notification list */}
                  <div
                    className="notif-list-scroll"
                    style={{ maxHeight: '370px', overflowY: 'auto', padding: '6px' }}
                  >
                    {filteredNotifs.length === 0 ? (
                      <div style={{
                        display:        'flex',
                        flexDirection:  'column',
                        alignItems:     'center',
                        justifyContent: 'center',
                        padding:        '40px 20px',
                        gap:            '10px',
                        color:          '#9ca3af',
                      }}>
                        <span style={{ fontSize: '30px', opacity: 0.4 }}>🔔</span>
                        <span style={{ fontSize: '13px', fontWeight: '500' }}>
                          No notifications yet
                        </span>
                      </div>
                    ) : (
                      filteredNotifs.map(notif => {
                        const col = NOTIF_COLORS[notif.type] || NOTIF_COLORS.leave_applied;
                        return (
                          <div
                            key={notif.id}
                            className="notif-item-hover"
                            style={{
                              display:       'flex',
                              alignItems:    'flex-start',
                              gap:           '10px',
                              padding:       '10px 11px',
                              borderRadius:  '10px',
                              marginBottom:  '3px',
                              borderLeft:    `3px solid ${col.border}`,
                              background:    notif.read ? 'transparent' : `${col.bg}99`,
                              cursor:        'default',
                              position:      'relative',
                              transition:    'background 0.15s',
                            }}
                          >
                            {/* Icon */}
                            <div style={{
                              width:          '34px',
                              height:         '34px',
                              borderRadius:   '9px',
                              background:     col.bg,
                              display:        'flex',
                              alignItems:     'center',
                              justifyContent: 'center',
                              fontSize:       '15px',
                              flexShrink:     0,
                            }}>
                              {NOTIF_ICONS[notif.type]}
                            </div>

                            {/* Body */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{
                                fontSize:     '12.5px',
                                fontWeight:   '700',
                                color:        col.icon,
                                marginBottom: '2px',
                                lineHeight:   '1.3',
                              }}>
                                {notif.title}
                              </div>
                              <div style={{
                                fontSize:     '11.5px',
                                color:        '#4b5563',
                                lineHeight:   '1.4',
                                marginBottom: '5px',
                              }}>
                                {notif.message}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                                <span style={{
                                  fontSize:     '10px',
                                  fontWeight:   '700',
                                  padding:      '2px 6px',
                                  borderRadius: '20px',
                                  color:        col.icon,
                                  background:   col.bg,
                                  letterSpacing:'0.2px',
                                }}>
                                  {NOTIF_LABELS[notif.type] || notif.type}
                                </span>
                                <span style={{ fontSize: '10px', color: '#9ca3af', fontWeight: '500' }}>
                                  {timeAgo(notif.timestamp)}
                                </span>
                              </div>
                            </div>

                            {/* Unread dot */}
                            {!notif.read && (
                              <div style={{
                                width:        '7px',
                                height:       '7px',
                                borderRadius: '50%',
                                background:   col.border,
                                flexShrink:   0,
                                alignSelf:    'center',
                                animation:    '__dotPulse 2s ease-in-out infinite',
                              }} />
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="nav-divider" />

            {/* ── PROFILE DROPDOWN (unchanged) ── */}
            <div
              className="profile-wrapper"
              ref={profileRef}
              onClick={() => { setIsProfileOpen(p => !p); setIsBellOpen(false); }}
              title="Account Settings"
            >
              <div className="profile-avatar">
                {user?.firstName ? user.firstName[0].toUpperCase() : "J"}
                {user?.lastName  ? user.lastName[0].toUpperCase()  : "S"}
              </div>
              <div className="profile-info">
                <span className="profile-name">
                  {user?.firstName ? `${user.firstName} ${user.lastName}` : "John Smith"}
                </span>
                <span className="profile-role">
                  {user?.role === "hr" ? "HR Manager" : user?.role || "HR Manager"}
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

          {/* MOBILE: hamburger */}
          <div className="d-lg-none">
            <button
              className={`menu-icon ${menuOpen ? "open" : ""}`}
              onClick={toggleMenu}
              aria-label="Toggle navigation"
            >
              <span className="bar" />
              <span className="bar" />
              <span className="bar" />
            </button>
          </div>
        </div>

        {/* MOBILE DROPDOWN MENU (unchanged) */}
        <div className={`nav-menu-mobile d-lg-none ${menuOpen ? "active" : ""}`}>
          <ul className="list-unstyled mb-2">
            {menuItems.map((item) => {
              const isActive = location.pathname.startsWith(item.path);
              return (
                <li key={item.path} className="mb-1">
                  <Link
                    to={item.path}
                    className={`nav-link-mobile ${isActive ? "active" : ""}`}
                    onClick={() => setMenuOpen(false)}
                  >
                    <i className={`bi ${getIcon(item.label)} me-2`} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="mobile-footer">
            <button onClick={handleLogout} className="btn btn-sm btn-outline-danger w-100">
              Logout
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Navbar;