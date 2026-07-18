import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import {
  Network, Pencil, X, AlertCircle, ChevronRight, Save, ChevronDown, ChevronUp,
} from 'lucide-react';
import { hierarchyAPI } from '../services/api';

const LEVELS = [
  { value: 1, label: '1 — Admin / Founder' },
  { value: 2, label: '2 — HR / Manager' },
  { value: 3, label: '3 — Team Lead' },
  { value: 4, label: '4 — Senior Employee' },
  { value: 5, label: '5 — Employee / Intern' },
];

const ROLES = [
  { value: 'admin',    label: 'Admin' },
  { value: 'hr',       label: 'HR Manager' },
  { value: 'manager',  label: 'Manager' },
  { value: 'tl',       label: 'Team Lead' },
  { value: 'employee', label: 'Employee' },
];

// When the designation level changes we auto-suggest a matching role.
// Level 2 (HR / Manager) defaults to "manager" — override to "hr" in the Role
// dropdown when needed. The role dropdown always stays editable.
const LEVEL_TO_ROLE = {
  1: 'admin',
  2: 'manager',
  3: 'tl',
  4: 'employee',
  5: 'employee',
};

// ── Only true "isActive === false" is treated as inactive so records that ──
// ── simply lack the field (undefined) are still shown as active.          ──
const isActiveNode = (node) => node?.isActive !== false;

// ── Recursively filters the tree to active employees only. If an inactive ──
// ── node has active children, those children are promoted to sit under    ──
// ── this node's parent instead of disappearing from the chart.            ──
const filterActiveTree = (nodes = []) => {
  let result = [];
  for (const node of nodes) {
    const filteredChildren = filterActiveTree(node.children);
    if (isActiveNode(node)) {
      result.push({ ...node, children: filteredChildren });
    } else {
      // Inactive node dropped, but its active children move up a level.
      result = result.concat(filteredChildren);
    }
  }
  return result;
};

// ── Shared helpers (module scope so the Avatar component can use them too) ──
const getInitials = (first, last) => {
  return `${(first || '')[0] || ''}${(last || '')[0] || ''}`.toUpperCase();
};

const getProfileImageUrl = (imagePath) => {
  if (!imagePath) return null;
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
  if (imagePath.startsWith('data:')) return imagePath;
  return `https://hrms.mematdigi.com/uploads/${imagePath}`;
};

// ── Avatar: shows the employee's profile photo, falls back to initials ──
// ── if there's no photo on record OR the image fails to load.          ──
const Avatar = ({ photo, firstName, lastName }) => {
  const [imgError, setImgError] = useState(false);
  const url = getProfileImageUrl(photo);

  if (url && !imgError) {
    return (
      <img
        src={url}
        alt={`${firstName || ''} ${lastName || ''}`.trim() || 'Employee'}
        onError={() => setImgError(true)}
        style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', display: 'block' }}
      />
    );
  }
  return <>{getInitials(firstName, lastName)}</>;
};

const Hierarchy = () => {
  const { user } = useSelector((state) => state.auth);
  const role = user?.role;
  const canEdit = ['admin', 'hr', 'manager'].includes(role);
  const myId = String(user?.id || user?._id || '');

  const [tree, setTree]       = useState([]);
  const [branch, setBranch]   = useState([]);
  const [allUsers, setAll]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [toast, setToast]     = useState(null);
  const [view, setView]       = useState('chart'); // 'chart' | 'branch'

  // Collapse State
  const [collapsedIds, setCollapsedIds] = useState(new Set());

  const [editNode, setEditNode] = useState(null);
  const [editForm, setEditForm] = useState({
    reportingManager_id: '',
    teamLead_id: '',
    designationLevel: 5,
    role: 'employee',
  });
  const [saving, setSaving]     = useState(false);

  const flash = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3600);
  };

  // ── EXACT COLLAPSE LOGIC: Keeps Row 1, 2, and 3 open, collapses Row 4 (Team Leads) ──
  const getInitialCollapsedIds = (nodes) => {
    const ids = new Set();
    const traverse = (list, depth) => {
      list.forEach((node) => {
        if (node.children && node.children.length > 0) {
          // Any node at depth 4 or deeper (the Team Lead row) is collapsed by default
          if (depth >= 4) {
            ids.add(node._id);
          }
          traverse(node.children, depth + 1);
        }
      });
    };
    traverse(nodes, 1);
    return ids;
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const calls = [hierarchyAPI.getTree(), hierarchyAPI.getMyBranch()];
      if (canEdit) calls.push(hierarchyAPI.getAssignableUsers());
      const res = await Promise.all(calls);

      const rawTree = res[0].data?.data || [];
      const activeTree = filterActiveTree(rawTree);
      setTree(activeTree);

      // Apply default collapse state (Depth 4+), based on the filtered tree
      setCollapsedIds(getInitialCollapsedIds(activeTree));

      const rawBranch = res[1].data?.data || [];
      setBranch(rawBranch.filter(isActiveNode));

      if (canEdit) {
        const list = res[2].data?.data || [];
        const activeList = (Array.isArray(list) ? list : []).filter(isActiveNode);
        setAll(activeList);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load the company hierarchy');
    } finally {
      setLoading(false);
    }
  }, [canEdit]);

  useEffect(() => { load(); }, [load]);

  const toggleCollapse = (id, e) => {
    e.stopPropagation();
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openEdit = (node, e) => {
    if (e) e.stopPropagation();
    setEditNode(node);
    setEditForm({
      reportingManager_id: node.reportingManager_id || '',
      teamLead_id: node.teamLead_id || '',
      designationLevel: node.designationLevel || 5,
      role: node.role || 'employee',
    });
  };

  // Changing the level auto-updates the role to the matching one (still overridable).
  const handleLevelChange = (e) => {
    const lvl = Number(e.target.value);
    setEditForm((f) => ({
      ...f,
      designationLevel: lvl,
      role: LEVEL_TO_ROLE[lvl] || f.role,
    }));
  };

  const handleSave = async () => {
    if (!editNode) return;
    setSaving(true);
    try {
      await hierarchyAPI.update(editNode._id, {
        reportingManager_id: editForm.reportingManager_id || null,
        teamLead_id: editForm.teamLead_id || null,
        designationLevel: Number(editForm.designationLevel),
        role: editForm.role || undefined,
      });
      flash('success', 'Reporting line updated');
      setEditNode(null);
      load();
    } catch (err) {
      flash('error', err.response?.data?.message || 'Could not update the reporting line');
    } finally {
      setSaving(false);
    }
  };

  const managerOptions = useMemo(
    () => allUsers.filter((u) => String(u._id) !== String(editNode?._id)),
    [allUsers, editNode]
  );
  const tlOptions = useMemo(
    () => allUsers.filter(
      (u) => String(u._id) !== String(editNode?._id) && ['tl', 'manager', 'admin', 'hr'].includes(u.role)
    ),
    [allUsers, editNode]
  );

  // ── Recursive Node Renderer ──
  const renderNode = (node) => {
    const isMe = String(node._id) === myId;
    const hasChildren = node.children && node.children.length > 0;
    const isCollapsed = collapsedIds.has(node._id);

    return (
      <div className="org-node" key={node._id}>
        <div className={`org-card level-${node.designationLevel || 5} ${isMe ? 'is-me' : ''}`}>
          <div className="card-top">
            <div className="user-avatar">
              <Avatar photo={node.profilePhoto} firstName={node.firstName} lastName={node.lastName} />
            </div>

            <div className="user-info">
              <div className="org-name">
                {node.firstName} {node.lastName}
                {isMe && <span className="me-badge">(You)</span>}
              </div>
              <div className="org-meta">
                {node.designation || node.role}
              </div>
            </div>

            {canEdit && (
              <button className="edit-btn" onClick={(e) => openEdit(node, e)} title="Edit reporting line">
                <Pencil size={13} />
              </button>
            )}
          </div>

          <div className="card-bottom">
            <div className="dep-tag">
              {node.department || 'General'}
            </div>

            {hasChildren && (
              <button
                className={`toggle-team-btn ${isCollapsed ? 'collapsed' : 'expanded'}`}
                onClick={(e) => toggleCollapse(node._id, e)}
              >
                <span>{isCollapsed ? 'Show Team' : 'Hide Team'}</span>
                {isCollapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
                <span className="count-badge">{node.children.length}</span>
              </button>
            )}
          </div>
        </div>

        {/* Children render only if this node is NOT in collapsedIds */}
        {hasChildren && !isCollapsed && (
          <div className="org-children">
            {node.children.map((child) => (
              <div className="org-child" key={child._id}>
                {renderNode(child)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="page-container hierarchy-page">
      {toast && (
        <div className={`toast-popup ${toast.type}`}>
          {toast.msg}
        </div>
      )}

      <div className="page-header">
        <div>
          <div className="page-title">
            <span className="page-title-icon"><Network size={20} /></span>
            <h1>Company Hierarchy</h1>
          </div>
          <p className="page-subtitle">
            {canEdit
              ? 'Click the edit icon on any card to reassign its reporting manager, team lead, level or role.'
              : 'Your organisation\'s reporting structure. Your node is automatically highlighted.'}
          </p>
        </div>

        <div className="page-actions">
          <button
            className={view === 'chart' ? 'btn-outline-cta active' : 'btn-secondary-cta'}
            onClick={() => setView('chart')}
          >
            Org Chart
          </button>
          <button
            className={view === 'branch' ? 'btn-outline-cta active' : 'btn-secondary-cta'}
            onClick={() => setView('branch')}
          >
            My Reporting Line
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card state-block">
          <div className="spinner" />
          <div className="state-msg">Loading the org chart…</div>
        </div>
      ) : error ? (
        <div className="card state-block error">
          <AlertCircle size={28} className="state-icon" />
          <div className="state-title">Could not load the hierarchy</div>
          <div className="state-msg">{error}</div>
          <button className="btn-outline-cta" onClick={load}>Try again</button>
        </div>
      ) : view === 'branch' ? (
        /* ── Redesigned My Reporting Line View ── */
        <div className="branch-container">
          <div className="branch-header">
            <h3>Your Reporting Line</h3>
            <p>From you, up through your leads, to the top of the organisation.</p>
          </div>

          {branch.length === 0 ? (
            <div className="state-block"><div className="state-msg">No reporting line set.</div></div>
          ) : (
            <div className="branch-stepper">
              {branch.map((n, i) => (
                <React.Fragment key={n._id}>
                  <div className={`branch-card level-${n.designationLevel || 5} ${i === 0 ? 'is-me' : ''}`}>
                    <div className="branch-level-badge">Level {n.designationLevel || '—'}</div>
                    <div className="branch-avatar">
                      <Avatar photo={n.profilePhoto} firstName={n.firstName} lastName={n.lastName} />
                    </div>
                    <div className="branch-details">
                      <div className="name">
                        {n.firstName} {n.lastName} {i === 0 && <span className="me-badge">You</span>}
                      </div>
                      <div className="role">{n.designation || n.role}</div>
                      <div className="dep">{n.department || 'General'}</div>
                    </div>
                  </div>
                  {i < branch.length - 1 && (
                    <div className="branch-arrow">
                      <ChevronRight size={20} />
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      ) : tree.length === 0 ? (
        <div className="card state-block">
          <Network size={32} className="state-icon" />
          <div className="state-title">The org chart is empty</div>
        </div>
      ) : (
        <div className="org-tree-container">
          <div className="org-tree">
            <div className="org-node-row">
              {tree.map((root) => renderNode(root))}
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editNode && (
        <div className="modal-overlay" onClick={() => setEditNode(null)}>
          <div className="card modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Edit Reporting Line</h3>
                <p>{editNode.firstName} {editNode.lastName} · {editNode.designation || editNode.role}</p>
              </div>
              <button className="btn-icon" onClick={() => setEditNode(null)}><X size={16} /></button>
            </div>

            <div className="form-field">
              <label>Reporting Manager</label>
              <select
                value={editForm.reportingManager_id}
                onChange={(e) => setEditForm({ ...editForm, reportingManager_id: e.target.value })}
              >
                <option value="">— None (top of the tree) —</option>
                {managerOptions.map((u) => (
                  <option key={u._id} value={u._id}>{u.firstName} {u.lastName} ({u.designation || u.role})</option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label>Team Lead</label>
              <select
                value={editForm.teamLead_id}
                onChange={(e) => setEditForm({ ...editForm, teamLead_id: e.target.value })}
              >
                <option value="">— No Team Lead —</option>
                {tlOptions.map((u) => (
                  <option key={u._id} value={u._id}>{u.firstName} {u.lastName} ({u.designation || u.role})</option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label>Designation Level</label>
              <select
                value={editForm.designationLevel}
                onChange={handleLevelChange}
              >
                {LEVELS.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label>Role</label>
              <select
                value={editForm.role}
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              <small className="form-hint">
                Auto-set from the level above; change it here if it should differ (e.g. HR at level 2).
                A role change requires the user to log out and back in.
              </small>
            </div>

            <div className="modal-actions">
              <button className="btn-primary-cta" onClick={handleSave} disabled={saving}>
                <Save size={15} /> {saving ? 'Saving…' : 'Save Changes'}
              </button>
              <button className="btn-secondary-cta" onClick={() => setEditNode(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Hierarchy;