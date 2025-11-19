const express = require('express');
const router = express.Router();
const activityLogController = require('../controllers/activityLogController');
const { authenticate } = require('../middleware/auth');

const { getTaskActivityLogs, getProjectActivityLogs, getRecentActivityLogs, getInboxActivities } = activityLogController();

// All routes require authentication
router.use(authenticate);

// Activity log routes
router.get('/inbox', getInboxActivities);
router.get('/task/:taskId', getTaskActivityLogs);
router.get('/project/:projectId', getProjectActivityLogs);
router.get('/recent', getRecentActivityLogs);

module.exports = router;

