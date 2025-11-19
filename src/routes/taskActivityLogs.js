const express = require('express');
const router = express.Router();
const taskActivityLogController = require('../controllers/taskActivityLogController');
const { authenticate } = require('../middleware/auth');

const { getInboxActivities, getTaskActivities, createActivityLog } = taskActivityLogController();

// All routes require authentication
router.use(authenticate);

// Activity log routes
router.get('/inbox', getInboxActivities);
router.get('/task/:taskId', getTaskActivities);
router.post('/', createActivityLog);

module.exports = router;

