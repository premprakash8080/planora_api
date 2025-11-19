const express = require('express');
const router = express.Router();
const insightsController = require('../controllers/insightsController');
const { authenticate } = require('../middleware/auth');

const {
  getProductivityMetrics,
  getProductivityTrends,
  getReportMetrics,
  getTaskStatusAnalytics,
  getProjectPerformance,
  getTeamMetrics,
  getTeamMemberPerformance,
  getTimeTrackingSummary,
  getDailyTimeBreakdown,
  getTimeEntries
} = insightsController();

// All routes require authentication
router.use(authenticate);

// Productivity Overview routes
router.get('/productivity/metrics', getProductivityMetrics);
router.get('/productivity/trends', getProductivityTrends);

// Report routes
router.get('/reports/metrics', getReportMetrics);
router.get('/reports/task-status', getTaskStatusAnalytics);
router.get('/reports/project-performance', getProjectPerformance);

// Team Performance routes
router.get('/team/metrics', getTeamMetrics);
router.get('/team/members', getTeamMemberPerformance);

// Time Tracking routes
router.get('/time-tracking/summary', getTimeTrackingSummary);
router.get('/time-tracking/daily-breakdown', getDailyTimeBreakdown);
router.get('/time-tracking/entries', getTimeEntries);

module.exports = router;

