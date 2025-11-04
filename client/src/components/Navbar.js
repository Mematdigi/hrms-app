import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import '../styles/Navbar.css';

function Navbar() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);

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

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/dashboard" className="navbar-logo">
          HRMS
        </Link>
        <ul className="nav-menu">
          {menuItems.map((item) => (
            <li key={item.path} className="nav-item">
              <Link 
                to={item.path} 
                className={`nav-link ${item.admin ? 'admin-link' : ''}`}
              >
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
