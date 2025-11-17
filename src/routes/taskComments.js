const express = require('express');
const router = express.Router();
const taskCommentController = require('../controllers/taskCommentController');
const { authenticate } = require('../middleware/auth');
const { validateTaskComment, validateCommentId, validateTaskId } = require('../middleware/validator');

const { getTaskComments, getCommentById, createComment, updateComment, deleteComment } = taskCommentController();

// All routes require authentication
router.use(authenticate);

// Comment routes
router.get('/task/:taskId', validateTaskId, getTaskComments);
router.get('/:commentId', validateCommentId, getCommentById);
router.post('/', validateTaskComment, createComment);
router.put('/:commentId', validateCommentId, updateComment);
router.delete('/:commentId', validateCommentId, deleteComment);

module.exports = router;

