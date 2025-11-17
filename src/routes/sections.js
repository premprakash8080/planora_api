const express = require('express');
const router = express.Router();
const sectionController = require('../controllers/sectionController');
const { authenticate } = require('../middleware/auth');
const { validateSection, validateSectionId, validateProjectId } = require('../middleware/validator');

const { getSectionsByProject, createSection, updateSection, deleteSection, updateSectionTitle } = sectionController();
// All routes require authentication
router.use(authenticate);

// Section routes
router.get('/project/:projectId', validateProjectId, getSectionsByProject);
router.post('/', validateSection, createSection);
router.put('/:sectionId', validateSectionId, validateSection, updateSection);
router.patch('/:sectionId/title', validateSectionId, updateSectionTitle);
router.delete('/:sectionId', validateSectionId, deleteSection);

module.exports = router;

