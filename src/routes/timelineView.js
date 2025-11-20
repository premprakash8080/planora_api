const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const { authenticate } = require('../middleware/auth');

const {
  getTimelineViewData,
  updateTimelineViewTask,
} = projectController();

router.use(authenticate);

router.get('/projects/:projectId/data', getTimelineViewData);
router.patch('/tasks/:taskId', updateTimelineViewTask);

module.exports = router;


