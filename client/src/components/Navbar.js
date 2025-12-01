// src/components/DashboardNavbar.js
import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, Link, useLocation } from "react-router-dom";
import logo from '../assets/scss/mematdigi-logo.jpg';


const Navbar = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useSelector((state) => state.auth);

  const [menuOpen, setMenuOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const handleLogout = () => {
    localStorage.removeItem("token");
    dispatch({ type: "LOGOUT" });
    navigate("/login");
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    console.log("Searching for:", searchValue);
    // hook real search later
  };

  const toggleMenu = () => setMenuOpen((prev) => !prev);

  // ---- ROLE-BASED MENU ITEMS ----
  const getMenuItems = () => {
    const baseItems = [{ label: "Dashboard", path: "/dashboard" }];

    if (user?.role === "admin") {
      return [
        ...baseItems,
        { label: 'Employees', path: '/employees' },
        { label: 'My Attendance', path: '/attendance' },
        { label: 'Leave', path: '/leave' },
        { label: 'Payroll', path: '/payroll' },
        { label: 'Performance', path: '/performance' },
        { label: 'Roles', path: '/roles', admin: true },
        {label:'Employee Attendance',path:'/all_employee_attendance'}
      ];
    }

    if (user?.role === "hr") {
      return [
        ...baseItems,
        { label: 'Employees', path: '/employees' },
        { label: 'My Attendance', path: '/attendance' },
        { label: 'Leave', path: '/leave' },
        { label: 'Payroll', path: '/payroll' },
        // { label: 'Performance', path: '/performance' },
        {label:'Employee Attendance',path:'/all_employee_attendance'}
      ];
    }

    if (user?.role === "manager") {
      return [
        ...baseItems,
        { label: "Employees", path: "/employees" },
        { label: "Attendance", path: "/attendance" },
        { label: "Leave", path: "/leave" },
      ];
    }

    if (user?.role === "employee") {
      return [
        ...baseItems,
        { label: "Attendance", path: "/attendance" },
        { label: "Leave", path: "/leave" },
        // { label: "Performance", path: "/performance" },
      ];
    }

    return baseItems;
  };

  const menuItems = getMenuItems();

  return (
    <div className="hr-mains m-3 p-3">
      {/* TOP ROW – logo + menu + search + profile */}
      <div className="navbar-row">
        {/* LEFT: Logo + desktop menu */}
        <div className="navbar-left">
          <Link to="/dashboard" className="text-decoration-none">
  <div className="logo-circle p-2">
    <img src={logo} alt="HRMS Logo" className="logo-img" />
  </div>
</Link>


          {/* Desktop menu (HR tabs style) */}
          <ul className="nav nav-pills hr-tabs d-none d-lg-flex">
            {menuItems.map((item) => {
              const isActive = location.pathname.startsWith(item.path);
              return (
                <li className="nav-item" key={item.path}>
                  <Link
                    to={item.path}
                    className={
                      "nav-link" +
                      (isActive ? " active" : "") +
                      (item.admin ? " admin-link" : "")
                    }
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        {/* RIGHT: Desktop search + icons + profile */}
        <div className="navbar-right d-none d-lg-flex">
          <form onSubmit={handleSearchSubmit} className="search-boxes">
            <i className="bi bi-search" />
            <input
              type="text"
              placeholder="Search"
              className="form-control search-input"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
          </form>

          <div className="navbar-profile">
            <div className="avatar-circle" title="Profile">
              <span>
                {(user?.firstName && user.firstName[0]?.toUpperCase()) ||
                  (user?.role?.[0]?.toUpperCase() || "U")}
              </span>
            </div>
            <div className="navbar-profile-text">
              <span className="small fw-semibold">
                {user?.firstName} {user?.lastName}
              </span>
              <span className="small text-muted text-capitalize">
                {user?.role}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="btn btn-sm btn-outline-danger ms-2"
            >
              Logout
            </button>
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
        <form onSubmit={handleSearchSubmit} className="search-box mb-2">
          <i className="bi bi-search" />
          <input
            type="text"
            placeholder="Search"
            className="form-control search-input"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
          />
        </form>

        <ul className="list-unstyled mb-2">
          {menuItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <li key={item.path} className="mb-1">
                <Link
                  to={item.path}
                  className={
                    "nav-link nav-link-mobile" +
                    (isActive ? " active" : "") +
                    (item.admin ? " admin-link" : "")
                  }
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="navbar-mobile-footer">
          <div className="navbar-mobile-profile">
            <div className="avatar-circle" title="Profile">
              <span>
                {(user?.firstName && user.firstName[0]?.toUpperCase()) ||
                  (user?.role?.[0]?.toUpperCase() || "U")}
              </span>
            </div>
            <div className="navbar-profile-text">
              <span className="small fw-semibold">
                {user?.firstName} {user?.lastName}
              </span>
              <span className="small text-muted text-capitalize">
                {user?.role}
              </span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="btn btn-sm btn-outline-danger"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
};

export default Navbar;
