import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import Attendance from './pages/Attendance';
import Leave from './pages/Leave';
import Payroll from './pages/Payroll';
import Performance from './pages/Performance';
import RoleManagement from './pages/RoleManagement';
import Navbar from './components/Navbar';
import AllEmployeesAttendance from './pages/AllEmployeeAttendance';
import './assets/scss/main.scss'
import Notfound from './pages/Notfound';
import EmployeeDetails from './pages/EmployeeDetails';
import 'bootstrap-icons/font/bootstrap-icons.css';

function App() {
  const { token } = useSelector((state) => state.auth);

  return (
    <Router>
      {token && <Navbar />}z
      <Routes>
        <Route path="/login" element={!token ? <Login /> : <Navigate to="/dashboard" />} />
        <Route path="/register" element={!token ? <Register /> : <Navigate to="/dashboard" />} />
        <Route path="/dashboard" element={token ? <Dashboard /> : <Navigate to="/login" />} />
        <Route path="/employees" element={token ? <Employees /> : <Navigate to="/login" />} />
        <Route path="/attendance" element={token ? <Attendance /> : <Navigate to="/login" />} />
        <Route path="/leave" element={token ? <Leave /> : <Navigate to="/login" />} />
        <Route path="/payroll" element={token ? <Payroll /> : <Navigate to="/login" />} />
        <Route path="/performance" element={token ? <Performance /> : <Navigate to="/login" />} />
        <Route path="/roles" element={token ? <RoleManagement /> : <Navigate to="/login" />} />
        <Route path="/all_employee_attendance" element={token ? <AllEmployeesAttendance /> : <Navigate to="/login" />} />
        <Route path="/" element={<Navigate to={"/login"} />} />
        <Route path="/EmployeeDetails/:id" element={<EmployeeDetails />} />
        <Route path="*" element={<Notfound/>}/>
      </Routes>
    </Router>
  );
}

export default App;
