const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticate } = require('../middleware/auth');

const { getMonthlyStats, getNoticeBoard, updateNoticeBoard, getTaskDashboardCounts } = dashboardController();

// All routes require authentication
router.use(authenticate);

// Dashboard routes
router.get('/monthly-stats', getMonthlyStats);
router.get('/notice-board', getNoticeBoard);
router.post('/notice-board', updateNoticeBoard);
router.get('/task-dashboard-counts', getTaskDashboardCounts);
module.exports = router;

