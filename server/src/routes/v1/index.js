/*
 * Memat Digi Inc.
 * www.mematdigi.com
 */

const express = require('express');
const router = express.Router();

// v1 route modules (same folder)
const authRoutes          = require('./authRoutes');
const employeeRoutes      = require('./employeeRoutes');
const attendanceRoutes    = require('./attendanceRoutes');
const leaveRoutes         = require('./leaveRoutes');
const payrollRoutes       = require('./payrollRoutes');
const performanceRoutes   = require('./performanceRoutes');
const roleRoutes          = require('./roleRoutes');
const holidayRoutes       = require('./holidayRoutes');
const notificationRoutes  = require('./notificationRoutes');
const officeDocument      = require('./officeDocumentRoutes');
const personalDocument    = require('./personalDocumentRoutes');
const resignationRoutes   = require('./resignationRoutes'); 
const offboardingRoutes = require('./offboardingRoutes');
const regularizationRoutes = require('./regularizationRoutes');
const hierarchyRoutes      = require('./hierarchyRoutes');
const taskReportRoutes     = require('./taskReportRoutes');
const weeklyReportRoutes   = require('./weeklyReportRoutes');
const scoringRoutes        = require('./scoringRoutes');

// Mount all v1 routes here
const defaultRoutes = [
  { path: '/auth',               route: authRoutes },
  { path: '/employees',          route: employeeRoutes },
  { path: '/attendance',         route: attendanceRoutes },
  { path: '/leave',              route: leaveRoutes },
  { path: '/payroll',            route: payrollRoutes },
  { path: '/performance',        route: performanceRoutes },
  { path: '/roles',              route: roleRoutes },
  { path: '/holidays',           route: holidayRoutes },
  { path: '/notifications',      route: notificationRoutes },
  { path: '/office-documents',   route: officeDocument },
  { path: '/personal-documents', route: personalDocument },
  { path: '/resignations',       route: resignationRoutes }, 
  { path: '/offboarding', route: offboardingRoutes },
  { path: '/regularization',     route: regularizationRoutes },
  { path: '/hierarchy',          route: hierarchyRoutes },
  { path: '/task-report',        route: taskReportRoutes },
  { path: '/weekly-report',      route: weeklyReportRoutes },
  { path: '/scoring',            route: scoringRoutes },
];

defaultRoutes.forEach(({ path, route }) => router.use(path, route));

module.exports = router;