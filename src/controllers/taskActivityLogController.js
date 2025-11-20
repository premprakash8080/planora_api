const { TaskActivityLog, Task, Project, User } = require('../models');
const { Op } = require('sequelize');

const taskActivityLogController = () => {
  // Helper function to get project IDs for a user
  // const getProjectIdsForUser = async (userId) => {
  //   const { Project, ProjectMember, Task } = require('../models');
    
  //   // Get projects where user is creator
  //   const createdProjects = await Project.findAll({
  //     where: { created_by: userId },
  //     attributes: ['id']
  //   });

  //   // Get projects where user is a member
  //   const memberProjects = await ProjectMember.findAll({
  //     where: { user_id: userId },
  //     attributes: ['project_id']
  //   });

  //   // Get projects where user has assigned tasks
  //   const assignedTasks = await Task.findAll({
  //     where: { assigned_to: userId },
  //     attributes: ['project_id'],
  //     group: ['project_id']
  //   });

  //   const projectIds = new Set();
  //   createdProjects.forEach(p => projectIds.add(p.id));
  //   memberProjects.forEach(p => projectIds.add(p.project_id));
  //   assignedTasks.forEach(t => projectIds.add(t.project_id));

  //   return Array.from(projectIds);
  // };

  // Get activity logs for inbox (all activities for current user's projects)
  const getInboxActivities = async (req, res) => {
    const userId = req.user.id;
    const { limit = 50, offset = 0 } = req.query;
    const formatDateTime = req.formatDateTime || ((date) => date);

    try {
      // Get all projects the user is involved in (as creator, member, or assigned tasks)
      const projectIds = await getProjectIdsForUser(userId);
      
      // If user has no projects, return empty array
      if (projectIds.length === 0) {
        return res.json({
          success: true,
          data: { activities: [] }
        });
      }

      const activities = await TaskActivityLog.findAll({
        where: {
          project_id: {
            [Op.in]: projectIds
          }
        },
        include: [
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
            required: false
          },
          {
            model: User,
            as: 'user',
            attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'],
            required: false
          }
        ],
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
      const formattedActivities = activities.map((activity) => {
        const plain = activity.toJSON();
        const createdAt = plain.created_at || plain.createdAt;
        console.log(createdAt);
        return {
          ...plain,
          created_at: createdAt? formatDateTime(createdAt, 'YYYY-MM-DD HH'): null,
        };
      });

      res.json({
        success: true,
        data: { activities: formattedActivities }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch activity logs',
        error: error.message
      });
    }
  };

  // Get activity logs for a specific task
  const getTaskActivities = async (req, res) => {
    const { taskId } = req.params;
    const formatDateTime = req.formatDateTime || ((date) => date);

    try {
      if (!taskId || isNaN(parseInt(taskId))) {
        return res.status(400).json({
          success: false,
          message: 'Invalid task ID',
        });
      }

      const activities = await TaskActivityLog.findAll({
        where: { task_id: taskId },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials']
          }
        ],
        order: [['created_at', 'DESC']]
      });

      const formattedActivities = activities.map((activity) => {
        const plain = activity.toJSON();
        const createdAt = plain.created_at || plain.createdAt;
        return {
          ...plain,
          created_at: createdAt
            ? formatDateTime(createdAt, 'YYYY-MM-DD HH:mm:ss')
            : null,
        };
      });

      res.json({
        success: true,
        data: { activities: formattedActivities }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch task activities',
        error: error.message
      });
    }
  };

  // Create activity log (usually called from task update hooks)
  const createActivityLog = async (req, res) => {
    const { task_id, project_id, activity_type, description, old_value, new_value } = req.body;
    const updated_by = req.user.id;

    try {
      if (!(task_id && project_id && activity_type && description)) {
        return res.status(400).json({
          success: false,
          message: 'Missing params: task_id, project_id, activity_type, and description are required',
        });
      }

      const activityLog = await TaskActivityLog.create({
        task_id,
        project_id,
        activity_type,
        description,
        old_value,
        new_value,
        updated_by
      });

      const activityWithRelations = await TaskActivityLog.findByPk(activityLog.id, {
        include: [
          {
            model: Task,
            as: 'task',
            attributes: ['id', 'title']
          },
          {
            model: Project,
            as: 'project',
            attributes: ['id', 'name']
          },
          {
            model: User,
            as: 'user',
            attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials']
          }
        ]
      });

      res.status(201).json({
        success: true,
        data: { activity: activityWithRelations }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to create activity log',
        error: error.message
      });
    }
  };

  // Helper function to get project IDs for a user
  const getProjectIdsForUser = async (userId) => {
    const { Project, ProjectMember, Task } = require('../models');
    
    // Get projects where user is creator
    const createdProjects = await Project.findAll({
      where: { created_by: userId },
      attributes: ['id']
    });

    // Get projects where user is a member
    const memberProjects = await ProjectMember.findAll({
      where: { user_id: userId },
      attributes: ['project_id']
    });

    // Get projects where user has assigned tasks
    const assignedTasks = await Task.findAll({
      where: { assigned_to: userId },
      attributes: ['project_id'],
      group: ['project_id']
    });

    const projectIds = new Set();
    createdProjects.forEach(p => projectIds.add(p.id));
    memberProjects.forEach(p => projectIds.add(p.project_id));
    assignedTasks.forEach(t => projectIds.add(t.project_id));

    return Array.from(projectIds);
  };

  return {
    getInboxActivities,
    getTaskActivities,
    createActivityLog
  };
};

module.exports = taskActivityLogController;

