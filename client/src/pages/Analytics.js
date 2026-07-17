// src/pages/Analytics.js
//
// EMPLOYEE ANALYTICS — the scoring engine's front end.
//
//   Employee view:            own score only
//   TL view:                  own team + self
//   Manager / HR / Admin:     company-wide, filterable, with leaderboards
//
// All data is read from the cached MonthlyScore / Nakshatra endpoints — the
// frontend NEVER recomputes scores from raw collections.

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement,
  LineElement, ArcElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';
import {
  BarChart3, TrendingUp, Trophy, Lightbulb, RefreshCw, AlertCircle,
  Star, Sparkles, Target, Award,
} from 'lucide-react';
import { scoringAPI } from '../services/api';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, PointElement,
  LineElement, ArcElement, Title, Tooltip, Legend, Filler
);

// Design tokens (kept in sync with _variables.scss)
const C = {
  secondary: '#1976D2',
  secondaryAlt: '#3F51B5',
  accent: '#FF7043',
  accentLight: '#FFA726',
  success: '#2E7D32',
  danger: '#D32F2F',
  text: '#333333',
  muted: '#6B7280',
  border: '#E5E7EB',
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const BUCKETS = [
  { key: 'taskSheetPoints',      label: 'Task Sheet',      max: 50 },
  { key: 'behaviourPoints',      label: 'Behaviour',       max: 10 },
  { key: 'attendancePoints',     label: 'Leaves & Punct.', max: 20 },
  { key: 'recommendationPoints', label: 'Recommendations', max: 20 },
];

const scoreBand = (t) =>
  t >= 85 ? 'excellent' : t >= 70 ? 'good' : t >= 50 ? 'average' : 'poor';
const bandLabel = (t) =>
  t >= 85 ? 'Excellent' : t >= 70 ? 'Good' : t >= 50 ? 'Average' : 'Needs Improvement';

// ═══════════════════════════════════════════════════════════════════════════
// "Area of Improvement" — 100% data-driven. Every line is generated from the
// actual numbers in MonthlyScore.breakdown, never from static copy.
// ═══════════════════════════════════════════════════════════════════════════
const buildImprovements = (score) => {
  if (!score) return [];
  const b = score.breakdown || {};
  const tips = [];

  if (b.incompleteTasks > 0) {
    tips.push({
      text: `Your Team Lead logged ${b.incompleteTasks} incomplete task${b.incompleteTasks > 1 ? 's' : ''} this month, costing you ${(b.incompleteTasks * 2).toFixed(0)} points from the 50-point Task bucket.`,
      gain: `Closing them out recovers up to ${(b.incompleteTasks * 2).toFixed(0)} pts`,
      weight: b.incompleteTasks * 2,
    });
  }
  if (b.unfilledTaskSheetDays > 0) {
    tips.push({
      text: `${b.unfilledTaskSheetDays} working day${b.unfilledTaskSheetDays > 1 ? 's were' : ' was'} not covered by any task report from your TL — that's a −${b.unfilledTaskSheetDays} point gap.`,
      gain: `Ask your TL to log those periods: up to ${b.unfilledTaskSheetDays} pts`,
      weight: b.unfilledTaskSheetDays,
    });
  }

  const nf = b.negativeFeedback || {};
  const negTotal = (nf.employee || 0) + (nf.tl || 0) + (nf.hr || 0) + (nf.manager || 0);
  if (negTotal > 0) {
    const cost = (nf.employee || 0) * 1 + (nf.tl || 0) * 2 + (nf.hr || 0) * 2 + (nf.manager || 0) * 4;
    const parts = [];
    if (nf.manager)  parts.push(`${nf.manager} from your Manager`);
    if (nf.tl)       parts.push(`${nf.tl} from your TL`);
    if (nf.hr)       parts.push(`${nf.hr} from HR`);
    if (nf.employee) parts.push(`${nf.employee} from peers`);
    tips.push({
      text: `${negTotal} negative feedback ${negTotal > 1 ? 'entries' : 'entry'} this month (${parts.join(', ')}), costing ${cost} points from the 10-point Behaviour bucket.`,
      gain: `Following up on flagged items can recover up to ${cost} pts`,
      weight: cost,
    });
  }

  if (b.lateArrivals >= 3) {
    const cost = Math.floor(b.lateArrivals / 3) * 0.5;
    tips.push({
      text: `${b.lateArrivals} late arrivals this month — that's a −${cost} point punctuality deduction.`,
      gain: `Arriving on time protects up to ${cost} pts next month`,
      weight: cost,
    });
  }
  if (b.unpaidFullDayLeaves > 0) {
    tips.push({
      text: `${b.unpaidFullDayLeaves} unpaid full-day leave${b.unpaidFullDayLeaves > 1 ? 's' : ''} taken, costing ${b.unpaidFullDayLeaves * 2} points from the Leaves & Punctuality bucket.`,
      gain: `A leave-free month is worth the full 20 pts`,
      weight: b.unpaidFullDayLeaves * 2,
    });
  }

  const recs = b.recommendations || {};
  const recTotal = (recs.tl || 0) + (recs.hr || 0) + (recs.manager || 0);
  if (recTotal === 0 && score.recommendationPoints < 20) {
    tips.push({
      text: `You have no recommendations logged this month — the Recommendations & Conduct bucket is at ${score.recommendationPoints}/20.`,
      gain: 'A Manager recommendation is worth +10 pts, TL or HR +5 pts',
      weight: 10,
    });
  }
  if (b.dressCodeWeeksTotal > 0 && b.dressCodeWeeksFollowed < b.dressCodeWeeksTotal) {
    tips.push({
      text: `Dress code was marked as not followed in ${b.dressCodeWeeksTotal - b.dressCodeWeeksFollowed} of ${b.dressCodeWeeksTotal} weekly reports — you lose the +5 dress-code bonus unless every week is clean.`,
      gain: 'A full clean month is worth +5 pts',
      weight: 5,
    });
  }

  // Heaviest point loss first — the thing that actually moves the needle
  return tips.sort((a, b2) => b2.weight - a.weight).slice(0, 4);
};

// ═══════════════════════════════════════════════════════════════════════════
const Analytics = () => {
  const { user } = useSelector((state) => state.auth);
  const role = user?.role;
  const isEmployee = role === 'employee';
  const isTL       = role === 'tl';
  const isLeader   = ['hr', 'manager', 'admin'].includes(role);
  const canSeeBoard = isTL || isLeader;

  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [myScores, setMyScores]     = useState([]);
  const [board, setBoard]           = useState([]);
  const [nakshatra, setNakshatra]   = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [recalcing, setRecalcing]   = useState(false);
  const [deptFilter, setDeptFilter] = useState('');

  // Simulator state
  const [simCompleted, setSimCompleted] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const calls = [scoringAPI.getMine({ months: 12 })];
      if (canSeeBoard) {
        calls.push(isTL
          ? scoringAPI.getTeam({ year, month })
          : scoringAPI.getCompany({ year, month, department: deptFilter || undefined }));
      }
      calls.push(scoringAPI.getNakshatra());

      const res = await Promise.all(calls);
      setMyScores(res[0].data?.data || []);
      if (canSeeBoard) {
        setBoard(res[1].data?.data || []);
        setNakshatra(res[2].data || null);
      } else {
        setNakshatra(res[1].data || null);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load analytics');
    } finally {
      setLoading(false);
    }
  }, [canSeeBoard, isTL, year, month, deptFilter]);

  useEffect(() => { load(); }, [load]);

  const handleRecalculate = async () => {
    setRecalcing(true);
    try {
      await scoringAPI.recalculate({ year, month });
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Recalculation failed');
    } finally {
      setRecalcing(false);
    }
  };

  // ── Current month score ───────────────────────────────────────────────────
  const current = useMemo(
    () => myScores.find((s) => s.year === year && s.month === month) || myScores[myScores.length - 1] || null,
    [myScores, year, month]
  );

  useEffect(() => {
    if (current) setSimCompleted(current.breakdown?.incompleteTasks || 0);
  }, [current]);

  const improvements = useMemo(() => buildImprovements(current), [current]);

  // Weakest bucket — the one furthest below its cap
  const weakestKey = useMemo(() => {
    if (!current) return null;
    return BUCKETS
      .map((b) => ({ key: b.key, gap: b.max - (current[b.key] || 0) }))
      .sort((a, b) => b.gap - a.gap)[0]?.key;
  }, [current]);

  // ── Charts ────────────────────────────────────────────────────────────────
  const breakdownData = useMemo(() => ({
    labels: BUCKETS.map((b) => `${b.label} (/${b.max})`),
    datasets: [
      {
        label: 'Points earned',
        data: BUCKETS.map((b) => (current ? current[b.key] || 0 : 0)),
        backgroundColor: BUCKETS.map((b) =>
          b.key === weakestKey ? C.accent : C.secondary),
        borderRadius: 6,
        barThickness: 34,
      },
      {
        label: 'Points available',
        data: BUCKETS.map((b) => b.max - (current ? current[b.key] || 0 : 0)),
        backgroundColor: C.border,
        borderRadius: 6,
        barThickness: 34,
      },
    ],
  }), [current, weakestKey]);

  const breakdownOpts = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    scales: {
      x: { stacked: true, max: 50, grid: { color: C.border }, ticks: { color: C.muted } },
      y: { stacked: true, grid: { display: false }, ticks: { color: C.text, font: { size: 12 } } },
    },
    plugins: {
      legend: { position: 'bottom', labels: { color: C.muted, boxWidth: 12, font: { size: 11 } } },
      tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.raw} pts` } },
    },
  };

  const trendData = useMemo(() => ({
    labels: myScores.map((s) => `${MONTHS[s.month - 1]} ${String(s.year).slice(2)}`),
    datasets: [{
      label: 'Monthly score',
      data: myScores.map((s) => s.totalPoints),
      borderColor: C.secondary,
      backgroundColor: 'rgba(25,118,210,0.12)',
      pointBackgroundColor: myScores.map((s) => (s.isEmployeeOfMonth ? C.accent : C.secondary)),
      pointRadius: myScores.map((s) => (s.isEmployeeOfMonth ? 6 : 4)),
      borderWidth: 2.5,
      tension: 0.35,
      fill: true,
    }],
  }), [myScores]);

  const trendOpts = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: { min: 0, max: 100, grid: { color: C.border }, ticks: { color: C.muted, stepSize: 20 } },
      x: { grid: { display: false }, ticks: { color: C.muted } },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          afterLabel: (ctx) =>
            myScores[ctx.dataIndex]?.isEmployeeOfMonth ? '🏆 Employee of the Month' : '',
        },
      },
    },
  };

  // ── Nakshatra progress ────────────────────────────────────────────────────
  const myNak = useMemo(() => {
    if (!nakshatra) return null;
    const myId = user?.id || user?._id;
    const row = nakshatra.me
      || (nakshatra.leaderboard || []).find((r) => String(r._id) === String(myId));
    return row || null;
  }, [nakshatra, user]);

  const nakPct = myNak && nakshatra?.target
    ? Math.min(100, Math.round(((myNak.basePoints + myNak.bonusPoints) / nakshatra.target) * 100))
    : 0;

  // ── Simulator ─────────────────────────────────────────────────────────────
  const simScore = useMemo(() => {
    if (!current) return 0;
    const incomplete = current.breakdown?.incompleteTasks || 0;
    const recovered = Math.min(simCompleted, incomplete) * 2;
    const newTask = Math.min(50, (current.taskSheetPoints || 0) + recovered);
    return Math.round(
      (newTask + current.behaviourPoints + current.attendancePoints + current.recommendationPoints) * 10
    ) / 10;
  }, [current, simCompleted]);

  // ── Department list for the HR filter ────────────────────────────────────
  const departments = useMemo(
    () => [...new Set(board.map((s) => s.employee?.department).filter(Boolean))],
    [board]
  );

  // ═══════════════════════════════════════════════════════════════════════════
  if (loading) {
    return (
      <div className="page-container analytics-page">
        <div className="state-block">
          <div className="spinner" />
          <div className="state-msg">Loading your analytics…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container analytics-page">
      <div className="page-header">
        <div>
          <div className="page-title">
            <span className="page-title-icon"><BarChart3 size={21} /></span>
            <h1>Analytics</h1>
          </div>
          <p className="page-subtitle">
            {isEmployee && 'Your monthly performance score and how to improve it.'}
            {isTL && 'Your team\'s scores, plus your own.'}
            {isLeader && 'Company-wide scoring, leaderboards and the Nakshatra Award race.'}
          </p>
        </div>

        <div className="page-actions">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            style={{ padding: '8px 11px', border: `1px solid ${C.border}`, borderRadius: 6, color: C.text }}
          >
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            style={{ padding: '8px 11px', border: `1px solid ${C.border}`, borderRadius: 6, color: C.text }}
          >
            {[now.getFullYear(), now.getFullYear() - 1].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          {['hr', 'admin'].includes(role) && (
            <button className="btn-primary-cta" onClick={handleRecalculate} disabled={recalcing}>
              <RefreshCw size={15} style={{ verticalAlign: -3, marginRight: 5 }} />
              {recalcing ? 'Recalculating…' : 'Recalculate Now'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="state-block error" style={{ padding: '20px' }}>
          <AlertCircle size={22} className="state-icon" />
          <div className="state-title">{error}</div>
          <button className="btn-outline-cta" onClick={load}>Retry</button>
        </div>
      )}

      {/* ══ Score hero ══════════════════════════════════════════════════ */}
      {!current ? (
        <div className="card state-block">
          <Target size={34} className="state-icon" />
          <div className="state-title">No score computed yet for {MONTHS[month - 1]} {year}</div>
          <div className="state-msg">
            Scores are recomputed nightly once your TL has logged task reports and weekly reports.
          </div>
        </div>
      ) : (
        <div className="score-hero">
          <div className="score-ring">
            <Doughnut
              data={{
                labels: ['Earned', 'Remaining'],
                datasets: [{
                  data: [current.totalPoints, Math.max(0, 100 - current.totalPoints)],
                  backgroundColor: [
                    current.totalPoints >= 85 ? C.success
                      : current.totalPoints >= 70 ? C.secondary
                      : current.totalPoints >= 50 ? C.accentLight : C.danger,
                    C.border,
                  ],
                  borderWidth: 0,
                  cutout: '76%',
                }],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { enabled: false } },
              }}
            />
            <div className="score-ring-value">
              <div className="srv-num">{current.totalPoints}</div>
              <div className="srv-max">out of 100</div>
            </div>
          </div>

          <div className="score-hero-body">
            <h2 style={{ margin: 0 }}>
              {MONTHS[current.month - 1]} {current.year}
              {current.isEmployeeOfMonth && (
                <span style={{ marginLeft: 10, fontSize: 14, color: C.accent, fontWeight: 700 }}>
                  <Trophy size={16} style={{ verticalAlign: -3 }} /> Employee of the Month
                </span>
              )}
            </h2>
            <div className="score-band">
              <span className={`score-pill ${scoreBand(current.totalPoints)}`}>
                {bandLabel(current.totalPoints)}
              </span>
              {current.isFinalized && (
                <span className="status-chip approved" style={{ marginLeft: 8 }}>Finalized</span>
              )}
            </div>

            <div className="score-buckets">
              {BUCKETS.map((b) => (
                <div
                  key={b.key}
                  className={`sb-item ${b.key === weakestKey ? 'weakest' : ''}`}
                >
                  <div className="sb-label">{b.label}</div>
                  <div className="sb-value">
                    {current[b.key] || 0}<span style={{ fontSize: 12, color: C.muted }}>/{b.max}</span>
                  </div>
                  <div className="sb-bar">
                    <i style={{ width: `${((current[b.key] || 0) / b.max) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══ Charts row ══════════════════════════════════════════════════ */}
      <div className="an-grid">
        <div className="an-card">
          <h3>Score Breakdown</h3>
          <p className="an-card-sub">
            Where your 100 points come from — the orange bar is your weakest bucket.
          </p>
          <div className="an-chart-box">
            {current
              ? <Bar data={breakdownData} options={breakdownOpts} />
              : <div className="state-block"><div className="state-msg">No data for this month</div></div>}
          </div>
        </div>

        <div className="an-card">
          <h3>Score Trend</h3>
          <p className="an-card-sub">
            Your monthly total over the last 12 months. Orange dots = Employee of the Month wins.
          </p>
          <div className="an-chart-box">
            {myScores.length > 1
              ? <Line data={trendData} options={trendOpts} />
              : (
                <div className="state-block">
                  <TrendingUp size={30} className="state-icon" />
                  <div className="state-msg">
                    Not enough history yet — the trend appears once you have two or more scored months.
                  </div>
                </div>
              )}
          </div>
        </div>
      </div>

      {/* ══ Nakshatra + Improvement ═════════════════════════════════════ */}
      <div className="an-grid">
        <div className="nakshatra-card">
          <div className="nk-head">
            <div>
              <h3 style={{ margin: 0 }}>
                <Sparkles size={17} style={{ verticalAlign: -3, color: C.accent, marginRight: 6 }} />
                Nakshatra Award
              </h3>
              <p className="an-card-sub" style={{ marginBottom: 0 }}>
                Cumulative score across the award period (12 × 100 = 1200 base ceiling).
              </p>
            </div>
            {myNak?.rank && (
              <span className="status-chip info">Rank #{myNak.rank}</span>
            )}
          </div>

          {myNak ? (
            <>
              <div className="nk-total">
                {Math.round(myNak.basePoints + myNak.bonusPoints)}
                <span> / {nakshatra?.target || 1200} pts</span>
              </div>
              <div className="nk-track" style={{ marginTop: 12 }}>
                <div className="nk-fill" style={{ width: `${nakPct}%` }} />
              </div>
              <div className="nk-legend">
                <span>{nakPct}% of the base ceiling</span>
                <span>{myNak.monthsCounted} month{myNak.monthsCounted !== 1 ? 's' : ''} counted</span>
              </div>
              {myNak.bonusPoints > 0 && (
                <div className="nk-bonus">
                  <Star size={13} />
                  +{myNak.bonusPoints} bonus pts
                  {myNak.eomWins > 0 && ` · ${myNak.eomWins} EOM win${myNak.eomWins > 1 ? 's' : ''}`}
                </div>
              )}
            </>
          ) : (
            <div className="state-block" style={{ padding: '30px 10px' }}>
              <div className="state-msg">No Nakshatra points accumulated yet this period.</div>
            </div>
          )}
        </div>

        <div className="improvement-card">
          <h3>
            <Lightbulb size={17} style={{ verticalAlign: -3, color: C.accent, marginRight: 6 }} />
            Area of Improvement
          </h3>
          <p className="an-card-sub">
            Generated from your actual numbers this month — ordered by how many points each one costs you.
          </p>

          {improvements.length === 0 ? (
            <div className="imp-empty">
              ✅ No point leaks detected this month. You're on track across every bucket — keep it up!
            </div>
          ) : (
            improvements.map((tip, i) => (
              <div className="imp-item" key={i}>
                <div className="imp-icon"><Target size={16} /></div>
                <div>
                  <div className="imp-text">{tip.text}</div>
                  <div className="imp-gain">↑ {tip.gain}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ══ Simulator ═══════════════════════════════════════════════════ */}
      {current && (current.breakdown?.incompleteTasks || 0) > 0 && (
        <div className="simulator-card" style={{ marginBottom: 20 }}>
          <h3>What Would Move the Needle</h3>
          <p className="an-card-sub">
            Drag to see what happens if those incomplete tasks get closed out.
          </p>

          <div className="sim-row">
            <span style={{ fontSize: 13 }}>
              Incomplete tasks closed out
              <strong style={{ marginLeft: 8, color: C.accent }}>
                {simCompleted} / {current.breakdown.incompleteTasks}
              </strong>
            </span>
          </div>
          <input
            type="range"
            min="0"
            max={current.breakdown.incompleteTasks}
            value={simCompleted}
            onChange={(e) => setSimCompleted(Number(e.target.value))}
          />

          <div className="sim-result">
            <div className="sim-score">{simScore} / 100</div>
            <div className="sim-delta">
              {simScore > current.totalPoints
                ? `+${(simScore - current.totalPoints).toFixed(1)} points vs your current ${current.totalPoints}`
                : `Same as your current score of ${current.totalPoints}`}
            </div>
          </div>
        </div>
      )}

      {/* ══ Leaderboard (TL / Manager / HR / Admin) ═════════════════════ */}
      {canSeeBoard && (
        <div className="leaderboard-card">
          <div className="lb-head">
            <div>
              <h3 style={{ margin: 0 }}>
                <Award size={17} style={{ verticalAlign: -3, color: C.accent, marginRight: 6 }} />
                {isTL ? 'Team Leaderboard' : 'Company Leaderboard'}
              </h3>
              <p className="an-card-sub" style={{ marginBottom: 0 }}>
                {MONTHS[month - 1]} {year} · ranked by monthly total
              </p>
            </div>

            {isLeader && departments.length > 0 && (
              <div className="lb-filters">
                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  style={{ padding: '7px 11px', border: `1px solid ${C.border}`, borderRadius: 6, color: C.text }}
                >
                  <option value="">All departments</option>
                  {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            )}
          </div>

          {board.length === 0 ? (
            <div className="state-block">
              <Trophy size={30} className="state-icon" />
              <div className="state-title">No scores for {MONTHS[month - 1]} {year}</div>
              <div className="state-msg">
                Scores appear once TLs have logged task reports and the nightly job has run.
              </div>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>Rank</th>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Task /50</th>
                  <th>Behaviour /10</th>
                  <th>Leaves /20</th>
                  <th>Recs /20</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {board.map((s, i) => {
                  const isMe = String(s.employee?._id) === String(user?.id || user?._id);
                  return (
                    <tr key={s._id} className={isMe ? 'lb-me' : ''}>
                      <td>
                        <span className={`lb-rank ${i < 3 ? `top-${i + 1}` : ''}`}>
                          {i + 1}
                        </span>
                      </td>
                      <td>
                        <strong>{s.employee?.firstName} {s.employee?.lastName}</strong>
                        {s.isEmployeeOfMonth && (
                          <Trophy size={13} style={{ marginLeft: 6, color: C.accent, verticalAlign: -2 }} />
                        )}
                        {isMe && <span style={{ marginLeft: 6, fontSize: 11, color: C.accent, fontWeight: 700 }}>You</span>}
                      </td>
                      <td style={{ color: C.muted }}>{s.employee?.department || '—'}</td>
                      <td>{s.taskSheetPoints}</td>
                      <td>{s.behaviourPoints}</td>
                      <td>{s.attendancePoints}</td>
                      <td>{s.recommendationPoints}</td>
                      <td>
                        <span className={`score-pill ${scoreBand(s.totalPoints)}`}>
                          {s.totalPoints}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ══ Nakshatra leaderboard ═══════════════════════════════════════ */}
      {canSeeBoard && nakshatra?.leaderboard?.length > 0 && (
        <div className="leaderboard-card" style={{ marginTop: 20 }}>
          <div className="lb-head">
            <div>
              <h3 style={{ margin: 0 }}>
                <Sparkles size={17} style={{ verticalAlign: -3, color: C.accent, marginRight: 6 }} />
                Nakshatra Award Race
              </h3>
              <p className="an-card-sub" style={{ marginBottom: 0 }}>
                Cumulative total (monthly scores + bonus points) across the award period.
              </p>
            </div>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 60 }}>Rank</th>
                <th>Employee</th>
                <th>Base Points</th>
                <th>Bonus</th>
                <th>EOM Wins</th>
                <th>Progress</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {nakshatra.leaderboard.map((r, i) => {
                const total = Math.round(r.basePoints + r.bonusPoints);
                const pct = Math.min(100, Math.round((total / (nakshatra.target || 1200)) * 100));
                return (
                  <tr key={r._id}>
                    <td><span className={`lb-rank ${i < 3 ? `top-${i + 1}` : ''}`}>{i + 1}</span></td>
                    <td><strong>{r.employee?.firstName} {r.employee?.lastName}</strong></td>
                    <td>{Math.round(r.basePoints)}</td>
                    <td style={{ color: C.accent, fontWeight: 600 }}>+{r.bonusPoints}</td>
                    <td>{r.eomWins || 0}</td>
                    <td style={{ minWidth: 130 }}>
                      <div className="nk-track" style={{ height: 7 }}>
                        <div className="nk-fill" style={{ width: `${pct}%` }} />
                      </div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{pct}%</div>
                    </td>
                    <td><strong>{total}</strong> <span style={{ color: C.muted, fontSize: 12 }}>/ {nakshatra.target}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Analytics;
