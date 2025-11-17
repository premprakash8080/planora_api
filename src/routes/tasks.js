const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { authenticate } = require('../middleware/auth');
const { validateTask, validateTaskId, validateProjectId } = require('../middleware/validator');

const { getTasksByProject, getTaskById, createTask, updateTask, deleteTask, toggleTaskCompletion } = taskController();

// All routes require authentication
router.use(authenticate);

// Task routes
router.get('/project/:projectId', validateProjectId, getTasksByProject);
router.get('/:taskId', validateTaskId, getTaskById);
router.post('/', validateTask, createTask);
router.put('/:taskId', validateTaskId, validateTask, updateTask);
router.delete('/:taskId', validateTaskId, deleteTask);
router.patch('/:taskId/toggle-completion', validateTaskId, toggleTaskCompletion);

module.exports = router;

