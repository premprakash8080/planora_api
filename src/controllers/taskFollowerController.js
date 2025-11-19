const { TaskFollower, Task, User } = require('../models');
const { successResponse, errorResponse } = require('../utils/responseFormatter');

const taskFollowerController = () => {
  // Get all followers for a task
  const getTaskFollowers = async (req, res) => {
    const { task_id, taskId } = req.body;
    const taskIdValue = task_id || taskId || req.params.taskId;

    try {
      if (!taskIdValue || isNaN(parseInt(taskIdValue))) {
        return res.status(400).json(errorResponse('Missing params: task_id is required', 400));
      }

      const followers = await TaskFollower.findAll({
        where: { task_id: parseInt(taskIdValue), is_active: true },
        include: [
          { model: User, as: 'user', attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'], required: true }
        ],
        order: [['created_at', 'ASC']],
      });

      res.json(successResponse({ followers }));
    } catch (error) {
      console.error('Error fetching task followers:', error);
      res.status(500).json(errorResponse('Failed to fetch task followers', 500));
    }
  };

  // Follow a task
  const followTask = async (req, res) => {
    const { task_id, taskId } = req.body;
    const taskIdValue = task_id || taskId;
    const userId = req.user.id;

    try {
      if (!taskIdValue || isNaN(parseInt(taskIdValue))) {
        return res.status(400).json(errorResponse('Missing params: task_id is required', 400));
      }

      // Check if already following
      const existing = await TaskFollower.findOne({
        where: {
          task_id: parseInt(taskIdValue),
          user_id: userId,
        },
      });

      if (existing) {
        if (!existing.is_active) {
          // Reactivate if previously unfollowed
          await existing.update({ is_active: true });
          return res.json(successResponse({ follower: existing }, 'Task follow reactivated'));
        }
        return res.status(400).json(errorResponse('Already following this task', 400));
      }

      const follower = await TaskFollower.create({
        task_id: parseInt(taskIdValue),
        user_id: userId,
        is_active: true,
      });

      res.status(201).json(successResponse({ follower }, 'Task followed successfully'));
    } catch (error) {
      console.error('Error following task:', error);
      res.status(500).json(errorResponse('Failed to follow task', 500));
    }
  };

  // Unfollow a task
  const unfollowTask = async (req, res) => {
    const { task_id, taskId } = req.body;
    const taskIdValue = task_id || taskId;
    const userId = req.user.id;

    try {
      if (!taskIdValue || isNaN(parseInt(taskIdValue))) {
        return res.status(400).json(errorResponse('Missing params: task_id is required', 400));
      }

      const follower = await TaskFollower.findOne({
        where: {
          task_id: parseInt(taskIdValue),
          user_id: userId,
        },
      });

      if (!follower) {
        return res.status(404).json(errorResponse('Not following this task', 404));
      }

      await follower.update({ is_active: false });
      res.json(successResponse(null, 'Task unfollowed successfully'));
    } catch (error) {
      console.error('Error unfollowing task:', error);
      res.status(500).json(errorResponse('Failed to unfollow task', 500));
    }
  };

  // Get tasks followed by user
  const getFollowedTasks = async (req, res) => {
    const userId = req.user.id;

    try {
      const followedTasks = await TaskFollower.findAll({
        where: { user_id: userId, is_active: true },
        include: [
          { model: Task, as: 'task', required: true, where: { deleted_at: null } }
        ],
        order: [['created_at', 'DESC']],
      });

      res.json(successResponse({ followedTasks }));
    } catch (error) {
      console.error('Error fetching followed tasks:', error);
      res.status(500).json(errorResponse('Failed to fetch followed tasks', 500));
    }
  };

  return {
    getTaskFollowers,
    followTask,
    unfollowTask,
    getFollowedTasks,
  };
};

module.exports = taskFollowerController;

