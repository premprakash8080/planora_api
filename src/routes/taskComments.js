const express = require('express');
const router = express.Router();
const taskCommentController = require('../controllers/taskCommentController');
const { authenticate } = require('../middleware/auth');

const { getTaskComments, getCommentById, createComment, updateComment, deleteComment } = taskCommentController();

// All routes require authentication
router.use(authenticate);

// Comment routes
router.get('/task/:taskId', getTaskComments);
router.get('/:commentId', getCommentById);
router.post('/', createComment);
router.put('/:commentId', updateComment);
router.delete('/:commentId', deleteComment);

module.exports = router;

