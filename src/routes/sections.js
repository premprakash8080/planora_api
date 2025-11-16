const express = require('express');
const router = express.Router();
const sectionController = require('../controllers/sectionController');
const { authenticate } = require('../middleware/auth');
const { validateSection, validateSectionId, validateProjectId } = require('../middleware/validator');

// All routes require authentication
router.use(authenticate);

// Section routes
router.get('/project/:projectId', validateProjectId, sectionController.getSectionsByProject);
router.post('/', validateSection, sectionController.createSection);
router.put('/:sectionId', validateSectionId, validateSection, sectionController.updateSection);
router.patch('/:sectionId/title', validateSectionId, sectionController.updateSectionTitle);
router.delete('/:sectionId', validateSectionId, sectionController.deleteSection);

module.exports = router;

