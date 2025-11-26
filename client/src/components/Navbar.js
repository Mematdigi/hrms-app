// src/components/DashboardNavbar.js
import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, Link, useLocation } from "react-router-dom";
// import "bootstrap/dist/css/bootstrap.min.css";

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

  const toggleMenu = () => setMenuOpen(!menuOpen);

  // ---- ROLE-BASED MENU ITEMS (from your original Navbar) ----
  const getMenuItems = () => {
    const baseItems = [{ label: "Dashboard", path: "/dashboard" }];

    if (user?.role === "admin") {
      return [
        ...baseItems,
        { label: "Employees", path: "/employees" },
        { label: "Attendance", path: "/attendance" },
        { label: "Leave", path: "/leave" },
        { label: "Payroll", path: "/payroll" },
        { label: "Performance", path: "/performance" },
        { label: "Roles", path: "/roles", admin: true },
      ];
    }

    if (user?.role === "hr") {
      return [
        ...baseItems,
        { label: "Employees", path: "/employees" },
        { label: "Attendance", path: "/attendance" },
        { label: "Leave", path: "/leave" },
        { label: "Payroll", path: "/payroll" },
        { label: "Performance", path: "/performance" },
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
        { label: "Performance", path: "/performance" },
      ];
    }

    return baseItems;
  };

  const menuItems = getMenuItems();

  return (
    <div className=" hr-mains m-3 p-3">
      {/* TOP ROW – HR style + hamburger + search + user info */}
      <div className="d-flex justify-content-between align-items-center">
        {/* LEFT: Logo + menu (desktop) */}
        <div className="d-flex align-items-center gap-3">
          <Link to="/dashboard" className="text-decoration-none">
            <div className="logo-circle">
              <span className="logo-icon">★</span>
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

        {/* RIGHT: Search + icons + user info (desktop) */}
        <div className="d-none d-lg-flex align-items-center gap-3">
          <form onSubmit={handleSearchSubmit} className="search-box">
            <i className="bi bi-search" />
            <input
              type="text"
              placeholder="Search"
              className="form-control search-input"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
          </form>

          <button className="icon-btn" title="Notifications">
            <i className="bi bi-bell" />
          </button>
          <button className="icon-btn" title="Settings">
            <i className="bi bi-gear" />
          </button>

          <div className="d-flex align-items-center gap-2">
            <div className="avatar-circle" title="Profile">
              <span>
                {(user?.firstName && user.firstName[0]?.toUpperCase()) ||
                  (user?.role?.[0]?.toUpperCase() || "U")}
              </span>
            </div>
            <div className="d-flex flex-column">
              <span className="small fw-semibold">
                {user?.firstName} {user?.lastName}
              </span>
              <span className={`small text-muted text-capitalize`}>
                {user?.role}
              </span>
            </div>
            <button onClick={handleLogout} className="btn btn-sm btn-outline-danger ms-2">
              Logout
            </button>
          </div>
        </div>

        {/* MOBILE: hamburger icon */}
        <div className="d-lg-none">
          <div className="menu-icon" onClick={toggleMenu}>
            <span className="bar" />
            <span className="bar" />
            <span className="bar" />
          </div>
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
                    "nav-link d-block py-1 px-2 rounded" +
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

        <div className="d-flex align-items-center justify-content-between mt-2">
          <div className="d-flex align-items-center gap-2">
            <div className="avatar-circle" title="Profile">
              <span>
                {(user?.firstName && user.firstName[0]?.toUpperCase()) ||
                  (user?.role?.[0]?.toUpperCase() || "U")}
              </span>
            </div>
            <div className="d-flex flex-column">
              <span className="small fw-semibold">
                {user?.firstName} {user?.lastName}
              </span>
              <span className={`small text-muted text-capitalize`}>
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
