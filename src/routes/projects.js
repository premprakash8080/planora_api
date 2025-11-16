const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const { authenticate } = require('../middleware/auth');
const { validateProject, validateProjectId } = require('../middleware/validator');

// All routes require authentication
router.use(authenticate);

// Project routes
router.get('/', projectController.getProjects);
router.get('/:projectId', validateProjectId, projectController.getProjectById);
router.post('/', validateProject, projectController.createProject);
router.put('/:projectId', validateProjectId, validateProject, projectController.updateProject);
router.delete('/:projectId', validateProjectId, projectController.deleteProject);
router.patch('/:projectId/toggle-favorite', validateProjectId, projectController.toggleProjectFavorite);

module.exports = router;

