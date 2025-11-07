import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { authAPI } from '../services/api';
import '../styles/Auth.css';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;           // prevent double submit
    setLoading(true);
    setError('');

    try {
      const res = await authAPI.login({ email, password });
      // Expecting { token, user } — adjust if your shape differs
      const { token, user } = res.data.data;
      console.log('Login successful:', token,user);
      console.log('User information:', res.data.data);
      // persist token
      localStorage.setItem('token', token);

      // (optional) keep user for quick access
      localStorage.setItem('hrmsUser', JSON.stringify(user));

      // redux
      dispatch({ type: 'LOGIN_SUCCESS', payload: { token, user } });

      navigate('/dashboard');
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        'Login failed';
      setError(msg);
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>HRMS Login</h1>

        {error && <div className="error-message">{error}</div>}

        {/* Let browsers help: */}
        <form onSubmit={handleSubmit} autoComplete="on">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="username"                  // important for heuristics
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              inputMode="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"  // fixes your warning
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" disabled={loading}>
            {loading ? 'Logging in…' : 'Login'}
          </button>
        </form>

        <p>
          Don&apos;t have an account? <Link to="/register">Register here</Link>
        </p>
      </div>
    </div>
  );
}

export default Login;
