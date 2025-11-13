import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import api from '../services/api';
// import '../styles/RoleManagement.css';

const RoleManagement = () => {
  const { user } = useSelector(state => state.auth);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedRole, setSelectedRole] = useState({});

  useEffect(() => {
    if (user && user.role === 'admin') {
      fetchUsers();
    }
  }, [user]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/roles/users');
      setUsers(response.data);
      setError('');
    } catch (err) {
      setError('Failed to fetch users');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = (userId, newRole) => {
    setSelectedRole({
      ...selectedRole,
      [userId]: newRole
    });
  };

  const updateRole = async (userId) => {
    try {
      const newRole = selectedRole[userId];
      if (!newRole) {
        setError('Please select a role');
        return;
      }

      await api.put(`/roles/users/${userId}/role`, { role: newRole });
      setSuccess('Role updated successfully');
      setError('');
      fetchUsers();
      setSelectedRole({});
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update role');
      setSuccess('');
    }
  };

  if (user && user.role !== 'admin') {
    return (
      <div className="role-management-container">
        <div className="error-message">
          Only admins can manage user roles
        </div>
      </div>
    );
  }

  return (
    <div className="role-management-container">
      <div className="role-header">
        <h1>Role Management</h1>
        <p>Manage user roles and permissions</p>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {loading ? (
        <div className="loading">Loading users...</div>
      ) : (
        <div className="role-table-container">
          <table className="role-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Current Role</th>
                <th>New Role</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u._id}>
                  <td>{u.firstName} {u.lastName}</td>
                  <td>{u.email}</td>
                  <td>
                    <span className={`role-badge role-${u.role}`}>
                      {u.role}
                    </span>
                  </td>
                  <td>
                    <select
                      value={selectedRole[u._id] || u.role}
                      onChange={(e) => handleRoleChange(u._id, e.target.value)}
                      className="role-select"
                    >
                      <option value="admin">Admin</option>
                      <option value="hr">HR Manager</option>
                      <option value="manager">Manager</option>
                      <option value="employee">Employee</option>
                    </select>
                  </td>
                  <td>
                    <button
                      onClick={() => updateRole(u._id)}
                      className="update-btn"
                      disabled={!selectedRole[u._id] || selectedRole[u._id] === u.role}
                    >
                      Update
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="role-info">
        <h3>Role Descriptions:</h3>
        <ul>
          <li><strong>Admin:</strong> Full system access, manage all users and settings</li>
          <li><strong>HR Manager:</strong> Manage employees, attendance, leave, and payroll</li>
          <li><strong>Manager:</strong> View team members, approve leave requests</li>
          <li><strong>Employee:</strong> View personal data, apply for leave, check attendance</li>
        </ul>
      </div>
    </div>
  );
};

export default RoleManagement;
