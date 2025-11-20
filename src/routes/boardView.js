const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const { authenticate } = require('../middleware/auth');

const {
  getBoardViewData,
  updateBoardViewTask,
  createBoardViewSection,
  updateBoardViewSection,
} = projectController();

router.use(authenticate);

router.get('/projects/:projectId/data', getBoardViewData);
router.post('/projects/:projectId/sections', createBoardViewSection);
router.patch('/sections/:sectionId', updateBoardViewSection);
router.patch('/tasks/:taskId', updateBoardViewTask);

module.exports = router;


