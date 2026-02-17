// src/components/DashboardNavbar.js
import React, { useState, useRef, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, Link, useLocation } from "react-router-dom";
// Ensure you have your logo file here or update the path
import logo from '../assets/scss/mematdigi-logo.jpg'; 

const Navbar = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useSelector((state) => state.auth);

  // State for mobile menu
  const [menuOpen, setMenuOpen] = useState(false);
  
  // State for Profile Dropdown
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    dispatch({ type: "LOGOUT" });
    navigate("/login");
  };

  const toggleMenu = () => setMenuOpen((prev) => !prev);

  // Helper to get icons based on label
  const getIcon = (label) => {
    const l = label.toLowerCase();
    if (l.includes("dashboard")) return "bi-grid-fill";
    if (l.includes("attendance")) return "bi-clock";
    if (l.includes("leave")) return "bi-calendar-event";
    if (l.includes("payroll")) return "bi-currency-dollar";
    if (l.includes("employee")) return "bi-people";
    if (l.includes("document")) return "bi-file-earmark-text";
    if (l.includes("performance")) return "bi-graph-up";
    if (l.includes("role")) return "bi-person-badge";
    if (l.includes("profile")) return "bi-person";
    return "bi-circle"; 
  };

  // ---- ROLE-BASED MENU ITEMS ----
  const getMenuItems = () => {
    const baseItems = [{ label: "Dashboard", path: "/dashboard" }];

    // Helper to add 'Profile' link to nav bar if desired (as seen in image)
    const profileItem = { label: 'Profile', path: '/profile-settings' }; 

    if (user?.role === "admin") {
      return [
        ...baseItems,
        { label: 'Attendance', path: '/attendance' },
        { label: 'Leaves', path: '/leave' },
        { label: 'Payroll', path: '/payroll' },
        { label: 'Employees', path: '/employees' },
        { label: 'Roles', path: '/roles', admin: true },
        profileItem
      ];
    }

    if (user?.role === "hr") {
      return [
        ...baseItems,
        { label: 'Attendance', path: '/attendance' },
        { label: 'Leaves', path: '/leave' },
        { label: 'Payroll', path: '/payroll' },
        { label: 'Employees', path: '/employees' },
        profileItem
      ];
    }

    if (user?.role === "manager") {
      return [
        ...baseItems,
        { label: "Attendance", path: "/attendance" },
        { label: "Leaves", path: "/leave" },
        { label: "Employees", path: "/employees" },
        { label: 'Payroll', path: '/payroll' },
        profileItem
      ];
    }

    if (user?.role === "employee") {
      return [
        ...baseItems,
        { label: "Attendance", path: "/attendance" },
        { label: "Leaves", path: "/leave" },
        profileItem
      ];
    }

    return baseItems;
  };

  const menuItems = getMenuItems();

  return (
    <div className="hr-mains">
      {/* TOP ROW */}
      <div className="navbar-row">
        
        {/* LEFT: Logo + Nav Items */}
        <div className="navbar-left-section">
          {/* Logo Block */}
          <Link to="/dashboard" className="text-decoration-none logo-block">
            <div className="logo-icon">
              {/* Use the imported image */}
              <img src={logo} alt="Logo" className="logo-img-inner" />
            </div>
          </Link>

          {/* Vertical Divider */}
          <div className="nav-divider d-none d-lg-block"></div>

          {/* Desktop Navigation */}
          <ul className="nav d-none d-lg-flex nav-custom">
            {menuItems.map((item) => {
              const isActive = location.pathname.startsWith(item.path);
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
                    <i className={`bi ${getIcon(item.label)} me-2`}></i>
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        {/* RIGHT: Notifications + Profile */}
        <div className="navbar-right-section d-none d-lg-flex">
          
          {/* Notification Bell */}
          <div className="icon-btn-wrapper">
             <button className="icon-btn">
                <i className="bi bi-bell"></i>
                <span className="badge-notification">3</span>
             </button>
          </div>

          <div className="nav-divider"></div>

          {/* Profile Dropdown Section */}
          <div 
            className="profile-wrapper" 
            ref={profileRef}
            onClick={() => setIsProfileOpen(!isProfileOpen)} 
            title="Account Settings"
          >
            <div className="profile-avatar">
              {user?.firstName ? user.firstName[0].toUpperCase() : "J"}
              {user?.lastName ? user.lastName[0].toUpperCase() : "S"}
            </div>
            <div className="profile-info">
              <span className="profile-name">
                {user?.firstName ? `${user.firstName} ${user.lastName}` : "John Smith"}
              </span>
              <span className="profile-role">
                {user?.role === "hr" ? "HR Manager" : user?.role || "HR Manager"}
              </span>
            </div>

            {/* Dropdown Menu */}
            <div className={`profile-dropdown ${isProfileOpen ? 'show' : ''}`}>
              <div className="dropdown-header">
                <p className="mb-0 fw-bold">My Account</p>
              </div>
              <Link to="/profile-settings" className="dropdown-item">
                <i className="bi bi-person-gear me-2"></i> Manage Profile
              </Link>
              <div className="dropdown-divider"></div>
              <button onClick={handleLogout} className="dropdown-item text-danger">
                <i className="bi bi-box-arrow-right me-2"></i> Logout
              </button>
            </div>
          </div>
        </div>

        {/* MOBILE: hamburger icon */}
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

      {/* MOBILE DROPDOWN MENU */}
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
                  <i className={`bi ${getIcon(item.label)} me-2`}></i>
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
  );
};

export default Navbar;