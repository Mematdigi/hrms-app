const User = require('../models/User');
const Employee = require('../models/Employee');
const { createNotification } = require('./Notificationcontroller');
const cacheMiddleware = require('../middleware/cacheMiddleware');

/**
 * Company Hierarchy — structural fields (reportingManager_id, teamLead_id,
 * designationLevel, role) live on User. Display fields (department,
 * designation, profilePhoto) live on Employee. The two collections are
 * joined by the shared `employeeId` field — there is no direct _id link.
 */
class HierarchyController {

  // ── Enrich a list of lean User docs with matching Employee display data ──
  // Falls back to the User's own department/designation/profileImage if no
  // Employee record is found for that employeeId (keeps things from breaking
  // rather than showing blank cards).
  enrichWithEmployeeData = async (users) => {
    const employeeIds = users.map(u => u.employeeId).filter(Boolean);
    const employees = await Employee.find({ employeeId: { $in: employeeIds } })
      .select('employeeId department designation profilePhoto')
      .lean();
    const byEmployeeId = new Map(employees.map(e => [e.employeeId, e]));

    return users.map(u => {
      const emp = byEmployeeId.get(u.employeeId);
      return {
        ...u,
        department: emp?.department || u.department || '',
        designation: emp?.designation || u.designation || '',
        profilePhoto: emp?.profilePhoto || u.profileImage || null,
      };
    });
  };

  // ── GET /hierarchy/tree ──────────────────────────────────────────────────
  // Full org tree (nested JSON, roots = users with no reporting manager).
  // Read access: all logged-in roles (employee/tl see it read-only in the UI).
  getTree = async (req, res) => {
    try {
      const users = await User.find({ isActive: true })
        .select('firstName lastName email employeeId role department designation designationLevel reportingManager_id teamLead_id profileImage')
        .lean();

      const enriched = await this.enrichWithEmployeeData(users);

      const byId = new Map(enriched.map(u => [u._id.toString(), { ...u, children: [] }]));
      const roots = [];

      for (const u of byId.values()) {
        const mgrId = u.reportingManager_id ? u.reportingManager_id.toString() : null;
        if (mgrId && byId.has(mgrId) && mgrId !== u._id.toString()) {
          byId.get(mgrId).children.push(u);
        } else {
          roots.push(u);
        }
      }

      // Sort roots and children by designationLevel then name for stable rendering
      const sortNodes = (nodes) => {
        nodes.sort((a, b) => (a.designationLevel || 5) - (b.designationLevel || 5) || a.firstName.localeCompare(b.firstName));
        nodes.forEach(n => sortNodes(n.children));
      };
      sortNodes(roots);

      res.json({ success: true, data: roots });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  };

  // ── GET /hierarchy/my-branch ────────────────────────────────────────────
  // Requesting user's own reporting line: self → TL → manager → ... → root
  getMyBranch = async (req, res) => {
    try {
      const branch = [];
      const seen = new Set();
      let currentId = req.user.id || req.user._id;

      while (currentId && !seen.has(currentId.toString())) {
        seen.add(currentId.toString());
        const user = await User.findById(currentId)
          .select('firstName lastName employeeId role department designation designationLevel reportingManager_id teamLead_id profileImage')
          .lean();
        if (!user) break;
        branch.push(user);
        // Prefer TL as the immediate next hop when set and not already visited
        const next = (user.teamLead_id && !seen.has(user.teamLead_id.toString()))
          ? user.teamLead_id
          : user.reportingManager_id;
        currentId = next;
      }

      const enrichedBranch = await this.enrichWithEmployeeData(branch);
      res.json({ success: true, data: enrichedBranch });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  };

  // ── GET /hierarchy/my-team ──────────────────────────────────────────────
  // TL: employees where teamLead_id === me. Manager: reportingManager_id === me.
  getMyTeam = async (req, res) => {
    try {
      const myId = req.user.id || req.user._id;
      const filter = req.user.role === 'tl'
        ? { teamLead_id: myId, isActive: true }
        : { $or: [{ teamLead_id: myId }, { reportingManager_id: myId }], isActive: true };

      const team = await User.find(filter)
        .select('firstName lastName email employeeId role department designation designationLevel profileImage')
        .sort({ firstName: 1 })
        .lean();

      const enrichedTeam = await this.enrichWithEmployeeData(team);
      res.json({ success: true, count: enrichedTeam.length, data: enrichedTeam });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  };

  // ── GET /hierarchy/assignable ───────────────────────────────────────────
  // Flat list of active users for the Reporting Manager / Team Lead dropdowns.
  // IMPORTANT: this returns User._id (not Employee._id) since that's what
  // reportingManager_id / teamLead_id actually reference.
  getAssignableUsers = async (req, res) => {
    try {
      const users = await User.find({ isActive: true })
        .select('firstName lastName employeeId role department designation profileImage')
        .sort({ firstName: 1 })
        .lean();

      const enriched = await this.enrichWithEmployeeData(users);
      res.json({ success: true, data: enriched });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  };

  // ── PUT /hierarchy/:userId ──────────────────────────────────────────────
  // admin/hr/manager only — reassign reportingManager_id / teamLead_id /
  // designationLevel / role. Validates against circular reporting.
  // Operates on User, since that's where these fields live.
  updateHierarchy = async (req, res) => {
    try {
      const { userId } = req.params;
      const { reportingManager_id, teamLead_id, designationLevel, role } = req.body;

      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });

      // ── Role validation (only if a role is being set) ──
      const validRoles = ['admin', 'hr', 'manager', 'tl', 'employee'];
      if (role !== undefined && role !== null && role !== '' && !validRoles.includes(role)) {
        return res.status(400).json({ success: false, message: 'Invalid role' });
      }

      // ── Circular-reporting validation ──
      const wouldBeCircular = async (startId, newParentId) => {
        if (!newParentId) return false;
        if (newParentId.toString() === startId.toString()) return true;
        const seen = new Set([startId.toString()]);
        let cur = newParentId;
        while (cur) {
          const curStr = cur.toString();
          if (seen.has(curStr)) return true; // loops back
          seen.add(curStr);
          const parent = await User.findById(cur).select('reportingManager_id').lean();
          cur = parent ? parent.reportingManager_id : null;
        }
        return false;
      };

      if (reportingManager_id !== undefined && reportingManager_id !== null) {
        if (await wouldBeCircular(userId, reportingManager_id)) {
          return res.status(400).json({
            success: false,
            message: 'Circular reporting detected — a user cannot (directly or indirectly) report to themselves',
          });
        }
      }
      if (teamLead_id !== undefined && teamLead_id !== null) {
        if (teamLead_id.toString() === userId.toString()) {
          return res.status(400).json({ success: false, message: 'A user cannot be their own Team Lead' });
        }
      }

      // Capture the old role BEFORE the update so we can detect a real change
      const oldRole = user.role;

      const update = {};
      if (reportingManager_id !== undefined) update.reportingManager_id = reportingManager_id || null;
      if (teamLead_id !== undefined)         update.teamLead_id = teamLead_id || null;
      if (designationLevel !== undefined)    update.designationLevel = Number(designationLevel);
      if (role !== undefined && role)        update.role = role;
      update.updatedAt = new Date();

      const updated = await User.findByIdAndUpdate(userId, { $set: update }, { new: true })
        .select('-password');

      const roleChanged = !!update.role && update.role !== oldRole;

      // 🔔 Notify the affected user that their reporting line changed
      await createNotification({
        recipient: userId,
        sender:    req.user.id || req.user._id,
        type:      'hierarchy_updated',
        title:     'Your Reporting Line Was Updated',
        message:   'Your reporting manager / team lead / designation level has been updated. Check the Hierarchy page for your new reporting line.',
        refId:     userId,
        refModel:  'User',
      });

      // 🔔 If the role actually changed, notify separately (this one requires re-login)
      if (roleChanged) {
        await createNotification({
          recipient: userId,
          sender:    req.user.id || req.user._id,
          type:      'role_changed',
          title:     'Your Role Was Updated',
          message:   `Your role was updated to "${update.role.toUpperCase()}". Your menu and permissions have changed — please log out and log back in.`,
          refId:     userId,
          refModel:  'User',
        });
      }

      // Invalidate the cached org tree so the change shows up immediately
      cacheMiddleware.invalidate('cache:');

      res.json({ success: true, message: 'Hierarchy updated successfully', data: updated });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  };
}

module.exports = new HierarchyController();