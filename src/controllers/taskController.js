const { Task, Section, Project, User, TaskComment, Subtask } = require('../models');
const { Op } = require('sequelize');
const taskActivityLogger = require('../utils/taskActivityLogger');
const { successResponse, errorResponse } = require('../utils/responseFormatter');

const taskController = () => {
  // Get all tasks for a project
  const getTasksByProject = async (req, res) => {
    // Support both projectId from params and from body
    const { projectId, project_id } = req.body;
    const projectIdValue = projectId || project_id || req.params.projectId;

    try {
      if (!projectIdValue || isNaN(parseInt(projectIdValue))) {
        return res.status(400).json(errorResponse('Missing params: project_id is required', 400));
      }

      const tasks = await Task.findAll({
        where: { project_id: parseInt(projectIdValue), deleted_at: null }, // Note: parent_id column doesn't exist in database
        include: [
          { model: Section, as: 'section' },
          { model: User, as: 'assignee', attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'], required: false },
          { model: User, as: 'creator', attributes: ['id', 'full_name', 'email'] },
          // Note: childTasks removed - parent_id column doesn't exist in database
        ],
        order: [['position', 'ASC']],
      });
      res.json(successResponse({ tasks }));
    } catch (error) {
      res.status(500).json(errorResponse('Failed to fetch tasks', 500));
    }
  };

  // Get task by ID
  const getTaskById = async (req, res) => {
    // Support both taskId from params and from body
    const { taskId, task_id } = req.body;
    const taskIdValue = taskId || task_id || req.params.taskId;

    try {
      if (!taskIdValue || isNaN(parseInt(taskIdValue))) {
        return res.status(400).json(errorResponse('Missing params: task_id is required', 400));
      }

      const task = await Task.findByPk(taskIdValue, {
        include: [
          { model: Section, as: 'section' },
          { model: User, as: 'assignee', attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'], required: false },
          { model: User, as: 'creator', attributes: ['id', 'full_name', 'email'] },
          { model: Project, as: 'project' },
          { 
            model: Subtask, 
            as: 'subtasks', 
            required: false,
            include: [
              { model: User, as: 'assignee', attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'], required: false }
            ]
          },
          // Note: childTasks removed - parent_id column doesn't exist in database
          { model: TaskComment, as: 'comments', include: [{ model: User, as: 'user', attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'] }], required: false, order: [['created_at', 'ASC']] },
        ],
      });
      if (!task) {
        return res.status(404).json(errorResponse('Task not found', 404));
      }
      res.json(successResponse({ task }));
    } catch (error) {
      res.status(500).json(errorResponse('Failed to fetch task', 500));
    }
  };

  // Create new task
  const createTask = async (req, res) => {
    const { project_id, section_id, title, description, assigned_to, priority, status, due_date, position } = req.body;
    const created_by = req.user.id;

    try {
      if (!project_id || isNaN(parseInt(project_id))) {
        return res.status(400).json(errorResponse('Missing params: project_id is required', 400));
      }

      if (!title || title.trim().length === 0) {
        return res.status(400).json(errorResponse('Missing params: title is required', 400));
      }

      if (title && title.length > 255) {
        return res.status(400).json(errorResponse('Task title must be 255 characters or less', 400));
      }

      if (priority && !['Low', 'Medium', 'High'].includes(priority)) {
        return res.status(400).json(errorResponse('Priority must be Low, Medium, or High', 400));
      }

      if (status && !['To Do', 'In Progress', 'Done', 'On Track', 'At Risk', 'Off Track'].includes(status)) {
        return res.status(400).json(errorResponse('Invalid task status', 400));
      }

      const task = await Task.create({
        project_id,
        section_id,
        title: title || 'New Task',
        description,
        created_by,
        assigned_to: assigned_to || null,
        priority: priority || 'Medium',
        status: status || 'To Do',
        due_date: due_date || null,
        position: position || 0,
        completed: false,
        // Note: parent_id removed - column doesn't exist in database
      });

      const taskWithRelations = await Task.findByPk(task.id, {
        include: [
          { model: Section, as: 'section' },
          { model: User, as: 'assignee', attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'], required: false },
          { model: TaskComment, as: 'comments', include: [{ model: User, as: 'user', attributes: ['id', 'full_name', 'email', 'avatar_url'] }], required: false },
          // Note: childTasks removed - parent_id column doesn't exist in database
        ],
      });

      // Log task creation activity
      await taskActivityLogger.logTaskCreated(taskWithRelations, created_by);

      res.status(201).json(successResponse({ task: taskWithRelations }, 'Task created successfully'));
    } catch (error) {
      res.status(500).json(errorResponse('Failed to create task', 500));
    }
  };

  // Update task
  const updateTask = async (req, res) => {
    // Support both taskId from params and from body
    const taskId = req.params.taskId || req.body.task_id;

    try {
      if (!taskId || isNaN(parseInt(taskId))) {
        return res.status(400).json(errorResponse('Missing params: task_id is required', 400));
      }

      // Extract update data, excluding task_id from body
      const { task_id, ...updateData } = req.body;

      if (updateData.title !== undefined && (!updateData.title || updateData.title.trim().length === 0)) {
        return res.status(400).json(errorResponse('Task title cannot be empty', 400));
      }

      if (updateData.title && updateData.title.length > 255) {
        return res.status(400).json(errorResponse('Task title must be 255 characters or less', 400));
      }

      if (updateData.priority && !['Low', 'Medium', 'High'].includes(updateData.priority)) {
        return res.status(400).json(errorResponse('Priority must be Low, Medium, or High', 400));
      }

      if (updateData.status && !['To Do', 'In Progress', 'Done', 'On Track', 'At Risk', 'Off Track'].includes(updateData.status)) {
        return res.status(400).json(errorResponse('Invalid task status', 400));
      }

      const task = await Task.findByPk(taskId);
      if (!task) {
        return res.status(404).json(errorResponse('Task not found', 404));
      }

      // Store old values for activity logging
      const oldTask = { ...task.toJSON() };

      await task.update(updateData);

      const updatedTask = await Task.findByPk(taskId, {
        include: [
          { model: Section, as: 'section' },
          { model: User, as: 'assignee', attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'], required: false },
          { model: TaskComment, as: 'comments', include: [{ model: User, as: 'user', attributes: ['id', 'full_name', 'email', 'avatar_url'] }], required: false },
          // Note: childTasks removed - parent_id column doesn't exist in database
        ],
      });

      // Log task update activity
      await taskActivityLogger.logTaskUpdated(oldTask, updateData, req.user.id);

      res.json(successResponse({ task: updatedTask }, 'Task updated successfully'));
    } catch (error) {
      res.status(500).json(errorResponse('Failed to update task', 500));
    }
  };

  // Delete task (soft delete)
  const deleteTask = async (req, res) => {
    // Support both taskId from params and from body
    const { taskId, task_id } = req.body;
    const taskIdValue = taskId || task_id || req.params.taskId;

    try {
      if (!taskIdValue || isNaN(parseInt(taskIdValue))) {
        return res.status(400).json(errorResponse('Missing params: task_id is required', 400));
      }

      const task = await Task.findByPk(taskIdValue);
      if (!task) {
        return res.status(404).json(errorResponse('Task not found', 404));
      }

      await task.destroy();
      res.json(successResponse(null, 'Task deleted successfully'));
    } catch (error) {
      console.error('Error deleting task:', error);
      res.status(500).json(errorResponse(`Failed to delete task: ${error.message}`, 500));
    }
  };

  // Toggle task completion
  const toggleTaskCompletion = async (req, res) => {
    const { taskId } = req.params;

    try {
      if (!taskId || isNaN(parseInt(taskId))) {
        return res.status(400).json(errorResponse('Invalid task ID', 400));
      }

      const task = await Task.findByPk(taskId);
      if (!task) {
        return res.status(404).json(errorResponse('Task not found', 404));
      }

      const wasCompleted = task.completed;
      await task.update({ completed: !task.completed });

      // Log completion activity
      if (!wasCompleted) {
        await taskActivityLogger.logTaskCompleted(task, req.user.id);
      }

      res.json(successResponse({ task }, 'Task completion toggled'));
    } catch (error) {
      res.status(500).json(errorResponse('Failed to toggle task completion', 500));
    }
  };

  // Get task dashboard details (task status upcoming, overdue, in progress, done) count
  const getTaskDashboardCounts = async (req, res) => {
    try {
      const tasks = await Task.findAll({ where: { deleted_at: null } }); // Note: parent_id column doesn't exist in database
      const upcomingTasks = tasks.filter(task => task.status === 'To Do' && task.due_date && new Date(task.due_date) > new Date());
      const overdueTasks = tasks.filter(task => task.status === 'To Do' && task.due_date && new Date(task.due_date) < new Date());
      const inProgressTasks = tasks.filter(task => task.status === 'In Progress');
      const doneTasks = tasks.filter(task => task.status === 'Done');
      res.json(successResponse({
        upcomingTasks: upcomingTasks.length,
        overdueTasks: overdueTasks.length,
        inProgressTasks: inProgressTasks.length,
        doneTasks: doneTasks.length
      }));
    } catch (error) {
      res.status(500).json(errorResponse('Failed to fetch task dashboard counts', 500));
    }
  };

  // Batch update tasks (for drag-and-drop reordering, etc.)
  const batchUpdateTasks = async (req, res) => {
    try {
      const { updates } = req.body; // Array of { id, updates } objects

      if (!Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json(errorResponse('Invalid updates array', 400));
      }

      const results = await Promise.all(
        updates.map(async ({ id, ...updateData }) => {
          const task = await Task.findByPk(id);
          if (task) {
            await task.update(updateData);
            return { id, success: true };
          }
          return { id, success: false, error: 'Task not found' };
        })
      );

      res.json(successResponse({ results }, 'Tasks updated successfully'));
    } catch (error) {
      res.status(500).json(errorResponse('Failed to batch update tasks', 500));
    }
  };

  return {
    getTasksByProject,
    getTaskById,
    createTask,
    updateTask,
    deleteTask,
    toggleTaskCompletion,
    getTaskDashboardCounts,
    batchUpdateTasks,
  };
};
module.exports = taskController;
