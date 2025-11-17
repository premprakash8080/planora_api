const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const { authenticate } = require('../middleware/auth');
const { validateProject, validateProjectId } = require('../middleware/validator');

const { getProjects, getProjectById, createProject, updateProject, deleteProject, toggleProjectFavorite } = projectController();
// All routes require authentication
router.use(authenticate);

// Project routes
router.get('/', getProjects);
router.get('/:projectId', validateProjectId, getProjectById);
router.post('/', validateProject, createProject);
router.put('/:projectId', validateProjectId, validateProject, updateProject);
router.delete('/:projectId', validateProjectId, deleteProject);
router.patch('/:projectId/toggle-favorite', validateProjectId, toggleProjectFavorite);

module.exports = router;

