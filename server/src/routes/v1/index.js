/*
 * Memat Digi Inc.
 * www.mematdigi.com
 */

const express = require('express');
const router = express.Router();

// v1 route modules (same folder)
const authRoutes = require('./authRoutes');
const employeeRoutes = require('./employeeRoutes');
const attendanceRoutes = require('./attendanceRoutes');
const leaveRoutes = require('./leaveRoutes');
const payrollRoutes = require('./payrollRoutes');
const performanceRoutes = require('./performanceRoutes');
const roleRoutes = require('./roleRoutes');

// Mount all v1 routes here
const defaultRoutes = [
  { path: '/auth',        route: authRoutes },
  { path: '/employees',   route: employeeRoutes },
  { path: '/attendance',  route: attendanceRoutes },
  { path: '/leaves',      route: leaveRoutes },
  { path: '/payroll',     route: payrollRoutes },
  { path: '/performance', route: performanceRoutes },
  { path: '/roles',       route: roleRoutes },
];

defaultRoutes.forEach(({ path, route }) => router.use(path, route));

module.exports = router;
