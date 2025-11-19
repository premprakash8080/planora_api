const { TaskActivityLog, Task, Project, User } = require('../models');
const { Op } = require('sequelize');
const { successResponse, errorResponse, paginationMeta } = require('../utils/responseFormatter');

const activityLogController = () => {
  /**
   * Get activity logs for a task
   */
  const getTaskActivityLogs = async (req, res) => {
    const { taskId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    try {
      if (!taskId || isNaN(parseInt(taskId))) {
        return res.status(400).json(errorResponse('Invalid task ID', 400));
      }

      const offset = (parseInt(page) - 1) * parseInt(limit);

      const { count, rows: logs } = await TaskActivityLog.findAndCountAll({
        where: { task_id: taskId },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials']
          },
          {
            model: Task,
            as: 'task',
            attributes: ['id', 'title']
          },
          {
            model: Project,
            as: 'project',
            attributes: ['id', 'name']
          }
        ],
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        offset
      });

      const meta = paginationMeta(page, limit, count);

      res.json(successResponse({ logs }, null, meta));
    } catch (error) {
      res.status(500).json(errorResponse('Failed to fetch activity logs', 500));
    }
  };

  /**
   * Get activity logs for a project
   */
  const getProjectActivityLogs = async (req, res) => {
    const { projectId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    try {
      if (!projectId || isNaN(parseInt(projectId))) {
        return res.status(400).json(errorResponse('Invalid project ID', 400));
      }

      const offset = (parseInt(page) - 1) * parseInt(limit);

      const { count, rows: logs } = await TaskActivityLog.findAndCountAll({
        where: { project_id: projectId },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials']
          },
          {
            model: Task,
            as: 'task',
            attributes: ['id', 'title'],
            required: false
          },
          {
            model: Project,
            as: 'project',
            attributes: ['id', 'name']
          }
        ],
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        offset
      });

      const meta = paginationMeta(page, limit, count);

      res.json(successResponse({ logs }, null, meta));
    } catch (error) {
      res.status(500).json(errorResponse('Failed to fetch activity logs', 500));
    }
  };

  /**
   * Get recent activity logs for current user
   */
  const getRecentActivityLogs = async (req, res) => {
    try {
      const userId = req.user.id;
      const { limit = 20 } = req.query;

      const logs = await TaskActivityLog.findAll({
        where: {
          project_id: {
            [Op.in]: require('sequelize').literal(
              `(SELECT project_id FROM project_members WHERE user_id = ${userId})`
            )
          }
        },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials']
          },
          {
            model: Task,
            as: 'task',
            attributes: ['id', 'title'],
            required: false
          },
          {
            model: Project,
            as: 'project',
            attributes: ['id', 'name']
          }
        ],
        order: [['created_at', 'DESC']],
        limit: parseInt(limit)
      });

      res.json(successResponse({ logs }));
    } catch (error) {
      console.error('Error fetching recent activity logs:', error);
      res.status(500).json(errorResponse('Failed to fetch recent activity logs', 500));
    }
  };

  /**
   * Get inbox activities for current user
   * Returns activities from projects where user is a member
   */
  const getInboxActivities = async (req, res) => {
    try {
      const userId = req.user.id;
      const { limit = 50, offset = 0 } = req.query;

      const { count, rows: activities } = await TaskActivityLog.findAndCountAll({
        where: {
          project_id: {
            [Op.in]: require('sequelize').literal(
              `(SELECT project_id FROM project_members WHERE user_id = ${userId})`
            )
          }
        },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'],
            required: true
          },
          {
            model: Task,
            as: 'task',
            attributes: ['id', 'title', 'status', 'priority'],
            required: false
          },
          {
            model: Project,
            as: 'project',
            attributes: ['id', 'name'],
            required: true
          }
        ],
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      const meta = paginationMeta(req.query.page || 1, limit, count);

      res.json(successResponse({ activities }, null, meta));
    } catch (error) {
      console.error('Error fetching inbox activities:', error);
      res.status(500).json(errorResponse(`Failed to fetch inbox activities: ${error.message}`, 500));
    }
  };

  return {
    getTaskActivityLogs,
    getProjectActivityLogs,
    getRecentActivityLogs,
    getInboxActivities
  };
};

module.exports = activityLogController;

