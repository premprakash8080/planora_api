const express = require('express');
const router = express.Router();
const priorityLabelController = require('../controllers/priorityLabelController');
const { authenticate } = require('../middleware/auth');

const { getPriorityLabels, getPriorityLabelById, createPriorityLabel, updatePriorityLabel, deletePriorityLabel } = priorityLabelController();

// All routes require authentication
router.use(authenticate);

// Priority Label routes
router.post('/get-priority-labels', getPriorityLabels);
router.post('/get-priority-label-by-id', getPriorityLabelById);
router.post('/create-priority-label', createPriorityLabel);
router.put('/update-priority-label', updatePriorityLabel);
router.delete('/delete-priority-label', deletePriorityLabel);

module.exports = router;

