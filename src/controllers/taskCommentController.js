const { TaskComment, Task, User } = require('../models');

const taskCommentController = () => {
  // Get all comments for a task
  const getTaskComments = async (req, res) => {
  try {
    const { taskId } = req.params;

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
  try {
    const { commentId } = req.params;

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
  try {
    const { task_id, message } = req.body;
    const user_id = req.user.id;

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
      ],
    });

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
  try {
    const { commentId } = req.params;
    const { message } = req.body;
    const user_id = req.user.id;

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
  try {
    const { commentId } = req.params;
    const user_id = req.user.id;

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
