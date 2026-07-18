const express = require('express');
const router = express.Router();

const hierarchyController = require('../../controllers/hierarchyController');
const { authMiddleware, roleMiddleware } = require('../../middleware/auth');
const cacheMiddleware = require('../../middleware/cacheMiddleware');

// ── Full org tree — read access for every logged-in role (UI decides edit vs read-only)
// Cached: the tree changes rarely.
router.get('/tree', authMiddleware, cacheMiddleware(300), hierarchyController.getTree);

// ── Own reporting line (self → TL → manager → ... → root)
router.get('/my-branch', authMiddleware, hierarchyController.getMyBranch);

// ── TL/Manager: my direct team roster
router.get(
  '/my-team',
  authMiddleware,
  roleMiddleware(['tl', 'manager', 'hr', 'admin']),
  hierarchyController.getMyTeam
);

// ── Flat list of active users for the Reporting Manager / Team Lead dropdowns
// (returns User._id, enriched with Employee display data) — admin/hr/manager only.
// MUST come before '/:userId' or Express will treat "assignable" as a userId param.
router.get(
  '/assignable',
  authMiddleware,
  roleMiddleware(['admin', 'hr', 'manager']),
  hierarchyController.getAssignableUsers
);

// ── Reassign reporting line — admin/hr/manager only
router.put(
  '/:userId',
  authMiddleware,
  roleMiddleware(['admin', 'hr', 'manager']),
  hierarchyController.updateHierarchy
);

module.exports = router;