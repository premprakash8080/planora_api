const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { authenticate } = require('../middleware/auth');

const { getTasksByProject, getTaskById, createTask, updateTask, deleteTask, toggleTaskCompletion, batchUpdateTasks } = taskController();

// All routes require authentication
router.use(authenticate);

// Task routes
// IMPORTANT: Specific routes must come before parameterized routes
router.get('/get-task-by-project/:projectId', getTasksByProject);
router.get('/gettaskbyid/:taskId', getTaskById);
router.post('/createtask', createTask);
// Update task - using PUT with taskId in body
router.put('/updatetask', updateTask);
// Alternative: Keep PUT with params for backward compatibility
router.put('/updatetaskbyid/:taskId', updateTask);
router.delete('/deletetaskbyid/:taskId', deleteTask); // deleteTask supports both req.body and req.params
router.patch('/:taskId/toggle-completion', toggleTaskCompletion);
router.post('/batchupdatetask', batchUpdateTasks);

module.exports = router;

