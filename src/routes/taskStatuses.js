const express = require('express');
const router = express.Router();
const taskStatusController = require('../controllers/taskStatusController');
const { authenticate } = require('../middleware/auth');

const { getTaskStatuses, getTaskStatusById, createTaskStatus, updateTaskStatus, deleteTaskStatus } = taskStatusController();

// All routes require authentication
router.use(authenticate);

// Task Status routes
router.post('/get-task-statuses', getTaskStatuses);
router.post('/get-task-status-by-id', getTaskStatusById);
router.post('/create-task-status', createTaskStatus);
router.put('/update-task-status', updateTaskStatus);
router.delete('/delete-task-status', deleteTaskStatus);

module.exports = router;

