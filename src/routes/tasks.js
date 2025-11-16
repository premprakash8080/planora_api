const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { authenticate } = require('../middleware/auth');
const { validateTask, validateTaskId, validateProjectId } = require('../middleware/validator');

// All routes require authentication
router.use(authenticate);

// Task routes
router.get('/project/:projectId', validateProjectId, taskController.getTasksByProject);
router.get('/:taskId', validateTaskId, taskController.getTaskById);
router.post('/', validateTask, taskController.createTask);
router.put('/:taskId', validateTaskId, validateTask, taskController.updateTask);
router.delete('/:taskId', validateTaskId, taskController.deleteTask);
router.patch('/:taskId/toggle-completion', validateTaskId, taskController.toggleTaskCompletion);

module.exports = router;

