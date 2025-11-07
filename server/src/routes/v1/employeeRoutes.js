const express = require('express');
const { getAllEmployees, getEmployeeById, createEmployee, updateEmployee, deleteEmployee } = require('../../controllers/employeeController');
const { authMiddleware, roleMiddleware } = require('../../middleware/auth');

const router = express.Router();

router.get('/', 
     authMiddleware, 
    getAllEmployees);
router.get('/:id', authMiddleware, getEmployeeById);
router.post('/', authMiddleware, roleMiddleware(['admin', 'hr']), createEmployee);
router.put('/:id', authMiddleware, roleMiddleware(['admin', 'hr']), updateEmployee);
router.delete('/:id', authMiddleware, roleMiddleware(['admin']), deleteEmployee);

module.exports = router;
