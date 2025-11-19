const express = require('express');
const router = express.Router();
const sectionController = require('../controllers/sectionController');
const { authenticate } = require('../middleware/auth');

const { getSectionsByProject, createSection, updateSection, deleteSection, updateSectionTitle, batchUpdateSections } = sectionController();
// All routes require authentication
router.use(authenticate);

// Section routes - All using POST with req.body instead of req.params
router.post('/project', getSectionsByProject); // Changed from GET /project/:projectId to POST /project
router.post('/', createSection);
router.put('/', updateSection); // Changed from PUT /:sectionId to PUT / (sectionId in body)
router.patch('/title', updateSectionTitle); // Changed from PATCH /:sectionId/title to PATCH /title (sectionId in body)
router.delete('/', deleteSection); // Changed from DELETE /:sectionId to DELETE / (sectionId in body)
router.post('/batch', batchUpdateSections);

module.exports = router;
