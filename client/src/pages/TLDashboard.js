// src/pages/TLDashboard.js
//
// TEAM LEAD DASHBOARD — the TL's landing page after login.
//
// Answers, at a glance: who's on my team, whose weekly report have I not
// submitted yet, how is my team scoring, and who needs attention.

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import {
  Users, ClipboardList, CalendarCheck, BarChart3, Network,
  TrendingUp, TrendingDown, AlertCircle, Trophy,
} from 'lucide-react';
import { hierarchyAPI, scoringAPI, weeklyReportAPI } from '../services/api';

const weekStart = (d) => {
  const x = new Date(d);
  const day = x.getDay();
  x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day));
  x.setHours(0, 0, 0, 0);
  return x;
};
const iso = (d) => new Date(d).toISOString().slice(0, 10);

const scoreBand = (t) =>
  t >= 85 ? 'excellent' : t >= 70 ? 'good' : t >= 50 ? 'average' : 'poor';

const TLDashboard = () => {
  const { user } = useSelector((state) => state.auth);

  const [team, setTeam]       = useState([]);
  const [scores, setScores]   = useState([]);
  const [weekly, setWeekly]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const now = new Date();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [teamRes, scoreRes, weekRes] = await Promise.all([
        hierarchyAPI.getMyTeam(),
        scoringAPI.getTeam({ year: now.getFullYear(), month: now.getMonth() + 1 }),
        weeklyReportAPI.getAll({ week: iso(weekStart(new Date())) }),
      ]);
      setTeam(teamRes.data?.data || []);
      setScores(scoreRes.data?.data || []);
      setWeekly(weekRes.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load your team dashboard');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Derived stats ─────────────────────────────────────────────────────────
  const pendingWeekly = useMemo(() => {
    const done = new Set(weekly.map((r) => String(r.employee?._id || r.employee)));
    return team.filter((m) => !done.has(String(m._id)));
  }, [team, weekly]);

  const avgScore = useMemo(() => {
    if (!scores.length) return null;
    return Math.round(
      (scores.reduce((s, x) => s + (x.totalPoints || 0), 0) / scores.length) * 10
    ) / 10;
  }, [scores]);

  const sorted = useMemo(
    () => [...scores].sort((a, b) => b.totalPoints - a.totalPoints),
    [scores]
  );
  const top    = sorted[0];
  const bottom = sorted.length > 1 ? sorted[sorted.length - 1] : null;

  if (loading) {
    return (
      <div className="page-container tl-dashboard">
        <div className="state-block">
          <div className="spinner" />
          <div className="state-msg">Loading your team dashboard…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container tl-dashboard">
      <div className="page-header">
        <div>
          <div className="page-title">
            <span className="page-title-icon"><Users size={21} /></span>
            <h1>Team Lead Dashboard</h1>
          </div>
          <p className="page-subtitle">
            Welcome back, {user?.firstName || 'there'} — here's where your team stands this month.
          </p>
        </div>
      </div>

      {error && (
        <div className="card state-block error" style={{ marginBottom: 20 }}>
          <AlertCircle size={26} className="state-icon" />
          <div className="state-title">{error}</div>
          <button className="btn-outline-cta" onClick={load}>Retry</button>
        </div>
      )}

      {/* ── Pending weekly reports nudge ─────────────────────────────── */}
      {pendingWeekly.length > 0 && (
        <div className="tld-pending-alert">
          <AlertCircle size={19} style={{ color: '#FF7043', flexShrink: 0 }} />
          <div className="tldpa-text">
            You have <strong>{pendingWeekly.length} weekly report{pendingWeekly.length > 1 ? 's' : ''}</strong> still
            to submit for this week
            {pendingWeekly.length <= 3 && (
              <> — {pendingWeekly.map((m) => m.firstName).join(', ')}</>
            )}.
          </div>
          <Link to="/weekly-report" className="btn-primary-cta" style={{ textDecoration: 'none', whiteSpace: 'nowrap' }}>
            Submit now
          </Link>
        </div>
      )}

      {/* ── Stat cards ───────────────────────────────────────────────── */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon"><Users size={21} /></div>
          <div>
            <div className="stat-value">{team.length}</div>
            <div className="stat-label">Team Members</div>
          </div>
        </div>

        <div className="stat-card accent">
          <div className="stat-icon"><CalendarCheck size={21} /></div>
          <div>
            <div className="stat-value">{pendingWeekly.length}</div>
            <div className="stat-label">Weekly Reports Pending</div>
          </div>
        </div>

        <div className="stat-card success">
          <div className="stat-icon"><BarChart3 size={21} /></div>
          <div>
            <div className="stat-value">{avgScore !== null ? avgScore : '—'}</div>
            <div className="stat-label">Team Avg Score (/100)</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon"><ClipboardList size={21} /></div>
          <div>
            <div className="stat-value">{scores.length}</div>
            <div className="stat-label">Members Scored This Month</div>
          </div>
        </div>
      </div>

      <div className="tld-grid">
        {/* ── Team roster ───────────────────────────────────────────── */}
        <div className="tld-card">
          <h3>My Team</h3>
          <p className="tld-sub">Current month's score for each of your direct reports.</p>

          {team.length === 0 ? (
            <div className="state-block">
              <Users size={30} className="state-icon" />
              <div className="state-title">No team members yet</div>
              <div className="state-msg">
                Ask HR or an admin to assign members to you on the Company Hierarchy page.
              </div>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Task /50</th>
                  <th>Score</th>
                  <th>Weekly Report</th>
                </tr>
              </thead>
              <tbody>
                {team.map((m) => {
                  const s = scores.find(
                    (x) => String(x.employee?._id || x.employee) === String(m._id)
                  );
                  const hasWeekly = weekly.some(
                    (r) => String(r.employee?._id || r.employee) === String(m._id)
                  );
                  return (
                    <tr key={m._id}>
                      <td>
                        <strong>{m.firstName} {m.lastName}</strong>
                        <div style={{ fontSize: 12, color: '#6B7280' }}>
                          {m.employeeId || m.designation || '—'}
                        </div>
                      </td>
                      <td style={{ color: '#6B7280' }}>{m.department || '—'}</td>
                      <td>{s ? s.taskSheetPoints : '—'}</td>
                      <td>
                        {s
                          ? <span className={`score-pill ${scoreBand(s.totalPoints)}`}>{s.totalPoints}</span>
                          : <span style={{ color: '#9CA3AF' }}>Not scored</span>}
                      </td>
                      <td>
                        <span className={`status-chip ${hasWeekly ? 'approved' : 'pending'}`}>
                          {hasWeekly ? 'Submitted' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Right column ──────────────────────────────────────────── */}
        <div>
          <div className="tld-card" style={{ marginBottom: 20 }}>
            <h3>Performance Spotlight</h3>
            <p className="tld-sub">This month, based on the 100-point score.</p>

            {!top ? (
              <div className="state-block" style={{ padding: '28px 10px' }}>
                <div className="state-msg">
                  No scores yet this month — they appear once you've logged task reports.
                </div>
              </div>
            ) : (
              <>
                <div className="tld-perf top">
                  <div className="tldp-icon"><Trophy size={18} /></div>
                  <div>
                    <div className="tldp-name">
                      {top.employee?.firstName} {top.employee?.lastName}
                    </div>
                    <div className="tldp-meta">
                      <TrendingUp size={11} style={{ verticalAlign: -1, marginRight: 3 }} />
                      Top performer
                    </div>
                  </div>
                  <div className="tldp-score" style={{ color: '#2E7D32' }}>{top.totalPoints}</div>
                </div>

                {bottom && (
                  <div className="tld-perf bottom">
                    <div className="tldp-icon"><TrendingDown size={18} /></div>
                    <div>
                      <div className="tldp-name">
                        {bottom.employee?.firstName} {bottom.employee?.lastName}
                      </div>
                      <div className="tldp-meta">Needs your attention</div>
                    </div>
                    <div className="tldp-score" style={{ color: '#FF7043' }}>{bottom.totalPoints}</div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="tld-card">
            <h3>Quick Actions</h3>
            <p className="tld-sub">Jump straight into your weekly routine.</p>

            <div className="tld-quick-links">
              <Link to="/task-report" className="tld-link">
                <ClipboardList size={21} />
                Log Task Report
              </Link>
              <Link to="/weekly-report" className="tld-link">
                <CalendarCheck size={21} />
                Weekly Report
              </Link>
              <Link to="/analytics" className="tld-link">
                <BarChart3 size={21} />
                Team Analytics
              </Link>
              <Link to="/hierarchy" className="tld-link">
                <Network size={21} />
                Hierarchy
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TLDashboard;
