const { TaskActivityLog, Task, Project, User, TaskStatus, PriorityLabel } = require('../models');
const { Op } = require('sequelize');
const { successResponse, errorResponse, paginationMeta } = require('../utils/responseFormatter');
const { formatTaskDate, formatTaskRelativeTime } = require('../utils/taskHelpers');

const mapActivityTypeToUpdateType = (activityType) => {
  switch (activityType) {
    case 'created':
      return 'created';
    case 'completed':
      return 'completed';
    case 'assigned':
      return 'assigned';
    case 'comment':
      return 'comment';
    case 'status_changed':
    case 'priority_changed':
    case 'due_date_changed':
    case 'updated':
      return 'updated';
    default:
      return 'updated';
  }
};

const getUpdateIcon = (updateType) => {
  const iconMap = {
    created: 'add_circle',
    updated: 'edit',
    completed: 'check_circle',
    assigned: 'person_add',
    comment: 'comment',
  };
  return iconMap[updateType] || 'info';
};

const getUpdateIconColor = (updateType) => {
  const colorMap = {
    created: '#9c27b0',
    updated: '#2196f3',
    completed: '#4caf50',
    assigned: '#ff9800',
    comment: '#3f51b5',
  };
  return colorMap[updateType] || '#9e9e9e';
};

const getUpdateIconBackground = (updateType) => {
  const backgroundMap = {
    created: '#f3e5f5',
    updated: '#e3f2fd',
    completed: '#e8f5e9',
    assigned: '#fff3e0',
    comment: '#e8eaf6',
  };
  return backgroundMap[updateType] || '#f5f5f5';
};

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

      const formattedLogs = logs.map((log) => {
        const plain = log.toJSON ? log.toJSON() : log;
        const createdAt = plain.created_at || plain.createdAt;
        return {
          ...plain,
          created_at: createdAt ? formatTaskDate(createdAt, 'DD MM YY') : null,
        };
      });

      res.json(successResponse({ logs: formattedLogs }, null, meta));
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
    const formatDate = req.formatDate || ((date, format = 'DD MM YY') => date);

    const formatLogs = (items) =>
      items.map((log) => {
        const plain = log.toJSON ? log.toJSON() : log;
        const createdAt = plain.created_at || plain.createdAt;
        return {
          ...plain,
          created_at: createdAt ? formatDate(createdAt, 'DD MM YY') : null,
        };
      });

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

      const formattedLogs = formatLogs(logs);
      res.json(successResponse({ logs: formattedLogs }, null, meta));
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
      const formatDate = req.formatDate || ((date, format = 'DD MM YY') => date);

      const formatLogs = (items) =>
        items.map((log) => {
          const plain = log.toJSON ? log.toJSON() : log;
          const createdAt = plain.created_at || plain.createdAt;
          return {
            ...plain,
            created_at: createdAt ? formatDate(createdAt, 'DD MM YY') : null,
          };
        });

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

      const formattedLogs = formatLogs(logs);
      res.json(successResponse({ logs: formattedLogs }));
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
            attributes: ['id', 'title', 'task_status_id', 'priority_label_id'],
            required: false,
            include: [
              {
                model: TaskStatus,
                as: 'taskStatus',
                attributes: ['id', 'name', 'color'],
                required: false
              },
              {
                model: PriorityLabel,
                as: 'priorityLabel',
                attributes: ['id', 'name', 'color'],
                required: false
              }
            ]
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
      const timezone = req.app?.locals?.timezone;

      const formattedActivities = activities.map((activity) => {
        const plain = activity.toJSON ? activity.toJSON() : activity;
        const createdAt = plain.created_at || plain.createdAt;
        const updateType = mapActivityTypeToUpdateType(plain.activity_type);
        const userName = plain.user?.full_name || 'Unknown User';
        const initials =
          plain.user?.initials ||
          (userName ? userName.split(' ').map((n) => n.charAt(0)).join('').substring(0, 2).toUpperCase() : 'U');

        return {
          id: plain.id.toString(),
          taskName: plain.task?.title || 'Unknown Task',
          projectName: plain.project?.name || 'Unknown Project',
          updateType,
          updateDescription: plain.description,
          time: createdAt ? formatTaskDate(createdAt, 'DD MMM YY', timezone) : null,
          timeAgo: createdAt ? formatTaskRelativeTime(createdAt, timezone) : null,
          userName,
          userAvatar: plain.user?.avatar_url || null,
          userInitials: initials,
          icon: getUpdateIcon(updateType),
          iconColor: getUpdateIconColor(updateType),
          iconBackground: getUpdateIconBackground(updateType),
        };
      });

      res.json(successResponse({ activities: formattedActivities }, null, meta));
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

