const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const { authenticate } = require('../middleware/auth');

const {
  updateMessage,
  pinMessage,
  deleteMessage,
} = projectController();

// All routes require authentication
router.use(authenticate);

// Project message routes
router.patch('/:messageId', updateMessage);
router.patch('/:messageId/pin', pinMessage);
router.delete('/:messageId', deleteMessage);

module.exports = router;

