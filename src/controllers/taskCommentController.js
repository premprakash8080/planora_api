const { TaskComment, Task, User } = require('../models');
const taskActivityLogger = require('../utils/taskActivityLogger');

const taskCommentController = () => {
  // Get all comments for a task
  const getTaskComments = async (req, res) => {
    const { taskId } = req.params;

    try {
      if (!taskId || isNaN(parseInt(taskId))) {
        return res.status(400).json({
          success: false,
          message: 'Invalid task ID',
        });
      }

      const comments = await TaskComment.findAll({
      where: { task_id: taskId },
      include: [
        { 
          model: User, 
          as: 'user', 
          attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'] 
        },
      ],
      order: [['created_at', 'ASC']],
    });

    res.json({
      success: true,
      data: { comments },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch comments',
      error: error.message,
    });
  }
};

// Get comment by ID
  const getCommentById = async (req, res) => {
    const { commentId } = req.params;

    try {
      if (!commentId || isNaN(parseInt(commentId))) {
        return res.status(400).json({
          success: false,
          message: 'Invalid comment ID',
        });
      }

      const comment = await TaskComment.findByPk(commentId, {
      include: [
        { 
          model: User, 
          as: 'user', 
          attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'] 
        },
        { model: Task, as: 'task' },
      ],
    });

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found',
      });
    }

    res.json({
      success: true,
      data: { comment },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch comment',
      error: error.message,
    });
  }
};

// Create new comment
  const createComment = async (req, res) => {
    const { task_id, message } = req.body;
    const user_id = req.user.id;

    try {
      if (!(task_id && message)) {
        return res.status(400).json({
          success: false,
          message: 'Missing params: task_id and message are required',
        });
      }

      if (isNaN(parseInt(task_id))) {
        return res.status(400).json({
          success: false,
          message: 'Invalid task ID',
        });
      }

      if (!message.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Comment message cannot be empty',
        });
      }

      // Verify task exists
      const task = await Task.findByPk(task_id);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found',
      });
    }

    const comment = await TaskComment.create({
      task_id,
      user_id,
      message,
    });

    // Note: comments_count is automatically updated by database trigger

    const commentWithUser = await TaskComment.findByPk(comment.id, {
      include: [
        { 
          model: User, 
          as: 'user', 
          attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'] 
        },
        { model: Task, as: 'task' },
      ],
    });

    // Log comment activity
    if (commentWithUser.task) {
      await taskActivityLogger.logTaskComment(commentWithUser.task, commentWithUser, user_id);
    }

    res.status(201).json({
      success: true,
      message: 'Comment created successfully',
      data: { comment: commentWithUser },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create comment',
      error: error.message,
    });
  }
};

// Update comment
  const updateComment = async (req, res) => {
    const { commentId } = req.params;
    const { message } = req.body;
    const user_id = req.user.id;

    try {
      if (!commentId || isNaN(parseInt(commentId))) {
        return res.status(400).json({
          success: false,
          message: 'Invalid comment ID',
        });
      }

      if (!message || !message.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Missing params: message is required',
        });
      }

      const comment = await TaskComment.findByPk(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found',
      });
    }

    // Check if user owns the comment
    if (comment.user_id !== user_id) {
      return res.status(403).json({
        success: false,
        message: 'You can only edit your own comments',
      });
    }

    await comment.update({ message });

    const updatedComment = await TaskComment.findByPk(commentId, {
      include: [
        { 
          model: User, 
          as: 'user', 
          attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'] 
        },
      ],
    });

    res.json({
      success: true,
      message: 'Comment updated successfully',
      data: { comment: updatedComment },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update comment',
      error: error.message,
    });
  }
};

// Delete comment
  const deleteComment = async (req, res) => {
    const { commentId } = req.params;
    const user_id = req.user.id;

    try {
      if (!commentId || isNaN(parseInt(commentId))) {
        return res.status(400).json({
          success: false,
          message: 'Invalid comment ID',
        });
      }

      const comment = await TaskComment.findByPk(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found',
      });
    }

    // Check if user owns the comment
    if (comment.user_id !== user_id) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own comments',
      });
    }

    await comment.destroy();
    // Note: comments_count is automatically updated by database trigger

    res.json({
      success: true,
      message: 'Comment deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete comment',
      error: error.message,
    });
  }
};

return {
  getTaskComments,
  getCommentById,
  createComment,
  updateComment,
  deleteComment,
};
};
module.exports = taskCommentController;
