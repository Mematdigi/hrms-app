import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { taskSheetAPI } from '../services/api';
import BackButton from '../components/BackButton';

const todayStr = () => new Date().toISOString().slice(0, 10);

const STATUS_CHIP = {
  completed: 'ts-chip--positive',
  incomplete: 'ts-chip--negative',
  pending: 'ts-chip--attention',
};

const TaskSheet = () => {
  const { user } = useSelector((state) => state.auth);
  const isReviewer = ['tl', 'manager', 'hr', 'admin'].includes(user?.role);

  // ── Employee submission state ──
  const [date, setDate] = useState(todayStr());
  const [tasks, setTasks] = useState([{ title: '', status: 'pending', remark: '' }]);
  const [submitting, setSubmitting] = useState(false);
  const [mySheets, setMySheets] = useState([]);
  const [loadingMine, setLoadingMine] = useState(false);

  // ── Reviewer state ──
  const [reviewSheets, setReviewSheets] = useState([]);
  const [loadingReview, setLoadingReview] = useState(false);
  const [reviewMonth, setReviewMonth] = useState(new Date().getMonth() + 1);
  const [reviewYear, setReviewYear] = useState(new Date().getFullYear());

  useEffect(() => {
    fetchMine();
    if (isReviewer) fetchReview();
    // eslint-disable-next-line
  }, [reviewMonth, reviewYear]);

  const fetchMine = async () => {
    try {
      setLoadingMine(true);
      const now = new Date();
      const res = await taskSheetAPI.getMine({ month: now.getMonth() + 1, year: now.getFullYear() });
      setMySheets(res.data.data || []);
      // Preload today's sheet into the form if it exists
      const today = (res.data.data || []).find(s => s.date?.slice(0, 10) === todayStr());
      if (today) setTasks(today.tasks.map(t => ({ title: t.title, status: t.status, remark: t.remark || '' })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMine(false);
    }
  };

  const fetchReview = async () => {
    try {
      setLoadingReview(true);
      const res = await taskSheetAPI.getAll({ month: reviewMonth, year: reviewYear });
      setReviewSheets(res.data.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load team task sheets');
    } finally {
      setLoadingReview(false);
    }
  };

  const updateTask = (idx, field, value) => {
    setTasks(tasks.map((t, i) => (i === idx ? { ...t, [field]: value } : t)));
  };

  const addTask = () => setTasks([...tasks, { title: '', status: 'pending', remark: '' }]);
  const removeTask = (idx) => setTasks(tasks.filter((_, i) => i !== idx));

  const submit = async () => {
    const valid = tasks.filter(t => t.title.trim());
    if (!valid.length) return toast.error('Add at least one task with a title');
    try {
      setSubmitting(true);
      await taskSheetAPI.submit({ date, tasks: valid, filled: true });
      toast.success('Task sheet submitted ✅');
      fetchMine();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="tasksheet-page">
      <div className="tasksheet-page__header">
        <BackButton />
        <div>
          <h2>{isReviewer && user?.role !== 'employee' ? 'Task Sheets' : 'Daily Task Sheet'}</h2>
          <p className="tasksheet-page__sub">
            Fill your task sheet every working day — it drives 50 points of your monthly score.
            Each incomplete task −2, each unfilled day −1.
          </p>
        </div>
      </div>

      {/* ── Submission form (all roles can fill their own) ── */}
      <div className="ts-card">
        <div className="ts-card__row">
          <label>Date</label>
          <input type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)} />
        </div>

        {tasks.map((t, idx) => (
          <div className="ts-task" key={idx}>
            <input
              className="ts-task__title"
              placeholder={`Task ${idx + 1} — what did you work on?`}
              value={t.title}
              onChange={(e) => updateTask(idx, 'title', e.target.value)}
            />
            <select value={t.status} onChange={(e) => updateTask(idx, 'status', e.target.value)}>
              <option value="completed">Completed</option>
              <option value="incomplete">Incomplete</option>
              <option value="pending">Pending</option>
            </select>
            <input
              className="ts-task__remark"
              placeholder="Remark (optional)"
              value={t.remark}
              onChange={(e) => updateTask(idx, 'remark', e.target.value)}
            />
            {tasks.length > 1 && (
              <button className="ts-task__remove" onClick={() => removeTask(idx)} title="Remove">
                <i className="bi bi-x-lg" />
              </button>
            )}
          </div>
        ))}

        <div className="ts-card__actions">
          <button className="btn-outline" onClick={addTask}>
            <i className="bi bi-plus-lg" /> Add Task
          </button>
          <button className="btn-primary" onClick={submit} disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit Task Sheet'}
          </button>
        </div>
      </div>

      {/* ── My recent sheets ── */}
      <h4 className="ts-section-title">My sheets this month</h4>
      {loadingMine ? (
        <div className="ts-state">Loading…</div>
      ) : mySheets.length === 0 ? (
        <div className="ts-state">No sheets submitted yet this month.</div>
      ) : (
        <div className="ts-list">
          {mySheets.map((s) => (
            <div className="ts-list__item" key={s._id}>
              <div className="ts-list__date">{new Date(s.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
              <div className="ts-list__tasks">
                {s.tasks.map((t, i) => (
                  <span key={i} className={`ts-chip ${STATUS_CHIP[t.status]}`}>{t.title}</span>
                ))}
              </div>
              {s.reviewNote && <div className="ts-list__review"><i className="bi bi-chat-left-text" /> {s.reviewNote}</div>}
            </div>
          ))}
        </div>
      )}

      {/* ── Review list (TL sees own team; HR/Manager/Admin see all) ── */}
      {isReviewer && (
        <>
          <h4 className="ts-section-title">
            {user?.role === 'tl' ? 'Team submissions' : 'All submissions'}
            <span className="ts-filters">
              <select value={reviewMonth} onChange={(e) => setReviewMonth(Number(e.target.value))}>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString('en', { month: 'long' })}</option>
                ))}
              </select>
              <select value={reviewYear} onChange={(e) => setReviewYear(Number(e.target.value))}>
                {[reviewYear - 1, reviewYear, reviewYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </span>
          </h4>

          {loadingReview ? (
            <div className="ts-state">Loading…</div>
          ) : reviewSheets.length === 0 ? (
            <div className="ts-state">No task sheets found for this period.</div>
          ) : (
            <div className="ts-table-wrap">
              <table className="ts-table">
                <thead>
                  <tr>
                    <th>Employee</th><th>Date</th><th>Tasks</th><th>Completed</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reviewSheets.map((s) => {
                    const done = s.tasks.filter(t => t.status === 'completed').length;
                    return (
                      <tr key={s._id}>
                        <td>{s.employee?.firstName} {s.employee?.lastName}</td>
                        <td>{new Date(s.date).toLocaleDateString('en-IN')}</td>
                        <td>{s.tasks.length}</td>
                        <td>{done}/{s.tasks.length}</td>
                        <td>
                          <span className={`ts-chip ${s.filled ? 'ts-chip--positive' : 'ts-chip--negative'}`}>
                            {s.filled ? 'Filled' : 'Draft'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TaskSheet;
