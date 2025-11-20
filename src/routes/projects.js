const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const { authenticate } = require('../middleware/auth');

const {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  toggleProjectFavorite,
  addProjectMember,
  removeProjectMember,
  getProjectActivities,
  getDashboardData,
  getBoardViewData,
  getProjectOverview,
  updateProjectOverview,
  getCalendarViewData,
  createMessage,
  getMessages,
  updateMessage,
  pinMessage,
  deleteMessage,
} = projectController();
// All routes require authentication
router.use(authenticate);

// Project routes
router.get('/', getProjects);
router.get('/:projectId', getProjectById);
router.get('/:projectId/overview', getProjectOverview);
router.get('/:projectId/activities', getProjectActivities);
router.get('/:projectId/getDashboardData', getDashboardData);
router.get('/:projectId/getCalendarViewData', getCalendarViewData);
router.post('/', createProject);
router.put('/:projectId', updateProject);
router.patch('/:projectId/overview', updateProjectOverview);
router.delete('/:projectId', deleteProject);
router.patch('/:projectId/toggle-favorite', toggleProjectFavorite);

// Project member routes
router.post('/:projectId/members', addProjectMember);
router.delete('/:projectId/members/:memberId', removeProjectMember);

// Project message routes
router.post('/:projectId/messages', createMessage);
router.get('/:projectId/getMessages', getMessages);

module.exports = router;

