const express = require('express');
const router = express.Router();
const taskCommentController = require('../controllers/taskCommentController');
const { authenticate } = require('../middleware/auth');
const { validateTaskComment, validateCommentId, validateTaskId } = require('../middleware/validator');

// All routes require authentication
router.use(authenticate);

// Comment routes
router.get('/task/:taskId', validateTaskId, taskCommentController.getTaskComments);
router.get('/:commentId', validateCommentId, taskCommentController.getCommentById);
router.post('/', validateTaskComment, taskCommentController.createComment);
router.put('/:commentId', validateCommentId, taskCommentController.updateComment);
router.delete('/:commentId', validateCommentId, taskCommentController.deleteComment);

module.exports = router;

