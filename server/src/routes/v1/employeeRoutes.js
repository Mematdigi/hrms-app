const express = require('express');
const employeeController = require('../../controllers/employeeController');
const { authMiddleware, roleMiddleware } = require('../../middleware/auth');

const router = express.Router();

router.get('/', 
     authMiddleware, 
    employeeController.getAllEmployees);
    
router.get('/:id', authMiddleware, employeeController.getEmployeeById);
router.post('/', authMiddleware, roleMiddleware(['admin', 'hr']), employeeController.createEmployee);
router.put('/:id', authMiddleware, roleMiddleware(['admin', 'hr']), employeeController.updateEmployee);
router.delete('/:id', authMiddleware, roleMiddleware(['admin']), employeeController.deleteEmployee);
router.get('/all/payrolls', authMiddleware ,roleMiddleware(['admin','hr']),employeeController.getEmployeePayrolls);

module.exports = router;
