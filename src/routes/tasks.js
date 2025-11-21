const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const projectController = require('../controllers/projectController');
const { authenticate } = require('../middleware/auth');

const { getTasksByProject, getTaskById, createTask, updateTask, deleteTask, toggleTaskCompletion, batchUpdateTasks, reorderTasksInSection, moveTaskToSection, moveTask } = taskController();
const { updateCalendarTask } = projectController();

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
router.patch('/:taskId/updateCalendarTask', updateCalendarTask);
router.post('/batchupdatetask', batchUpdateTasks);
router.post('/reorder-tasks', reorderTasksInSection);
router.post('/move-task', moveTaskToSection);
router.patch('/move', moveTask);

module.exports = router;

