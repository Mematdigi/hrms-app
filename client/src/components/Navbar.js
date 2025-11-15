import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';

function Navbar() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);

  const [menuOpen, setMenuOpen] = useState(false);  // State to toggle menu visibility on small screens

  const handleLogout = () => {
    localStorage.removeItem('token');
    dispatch({ type: 'LOGOUT' });
    navigate('/login');
  };

  // Determine which menu items to show based on role
  const getMenuItems = () => {
    const baseItems = [
      { label: 'Dashboard', path: '/dashboard' }
    ];

    if (user?.role === 'admin') {
      return [
        ...baseItems,
        { label: 'Employees', path: '/employees' },
        { label: 'Attendance', path: '/attendance' },
        { label: 'Leave', path: '/leave' },
        { label: 'Payroll', path: '/payroll' },
        { label: 'Performance', path: '/performance' },
        { label: 'Roles', path: '/roles', admin: true }
      ];
    }

    if (user?.role === 'hr') {
      return [
        ...baseItems,
        { label: 'Employees', path: '/employees' },
        { label: 'Attendance', path: '/attendance' },
        { label: 'Leave', path: '/leave' },
        { label: 'Payroll', path: '/payroll' },
        { label: 'Performance', path: '/performance' }
      ];
    }

    if (user?.role === 'manager') {
      return [
        ...baseItems,
        { label: 'Employees', path: '/employees' },
        { label: 'Attendance', path: '/attendance' },
        { label: 'Leave', path: '/leave' }
      ];
    }

    if (user?.role === 'employee') {
      return [
        ...baseItems,
        { label: 'Attendance', path: '/attendance' },
        { label: 'Leave', path: '/leave' },
        { label: 'Performance', path: '/performance' }
      ];
    }

    return baseItems;
  };

  const menuItems = getMenuItems();

  const toggleMenu = () => setMenuOpen(!menuOpen);  // Toggle menu on small screen

  return (
    <nav className="navbar fixed-top m-2 rounded">
      <div className="navbar-container">
        <Link to="/dashboard" className="navbar-logo">
          HRMS
        </Link>

        {/* Hamburger Menu Icon for Small Screens */}
        <div className="menu-icon" onClick={toggleMenu}>
          <span className="bar"></span>
          <span className="bar"></span>
          <span className="bar"></span>
        </div>

        <ul className={`nav-menu ${menuOpen ? 'active' : ''}`}>
          {menuItems.map((item) => (
            <li key={item.path} className="nav-item text-white">
              <Link to={item.path} className={`nav-link ${item.admin ? 'admin-link' : ''}`}>
                {item.label}
              </Link>
            </li>
          ))}
          <li className="nav-item user-info">
            <span>{user?.firstName} {user?.lastName}</span>
            <span className={`user-role role-${user?.role}`}>{user?.role}</span>
            <button onClick={handleLogout} className="logout-btn">Logout</button>
          </li>
        </ul>
      </div>
    </nav>
  );
}

export default Navbar;
