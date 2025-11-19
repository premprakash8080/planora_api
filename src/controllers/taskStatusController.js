const { TaskStatus, Project, Task } = require('../models');
const { successResponse, errorResponse } = require('../utils/responseFormatter');

const taskStatusController = () => {
  // Get all task statuses (optionally filtered by project)
  const getTaskStatuses = async (req, res) => {
    const { project_id, projectId } = req.body;
    const projectIdValue = project_id || projectId || req.query.project_id || req.query.projectId;

    try {
      const { Op } = require('sequelize');
      
      // If project_id is provided, get both global (null) and project-specific statuses
      // Otherwise, just get global statuses
      const where = { is_active: true };
      if (projectIdValue) {
        where.project_id = {
          [Op.or]: [null, parseInt(projectIdValue)]
        };
      } else {
        // If no project_id, get global statuses (project_id is null)
        where.project_id = null;
      }

      const taskStatuses = await TaskStatus.findAll({
        where,
        include: [
          { model: Project, as: 'project', attributes: ['id', 'name'], required: false }
        ],
        order: [['order', 'ASC'], ['name', 'ASC']],
      });

      res.json(successResponse({ taskStatuses }));
    } catch (error) {
      console.error('Error fetching task statuses:', error);
      res.status(500).json(errorResponse('Failed to fetch task statuses', 500));
    }
  };

  // Get task status by ID
  const getTaskStatusById = async (req, res) => {
    const { id, task_status_id, taskStatusId } = req.body;
    const statusIdValue = id || task_status_id || taskStatusId || req.params.id;

    try {
      if (!statusIdValue || isNaN(parseInt(statusIdValue))) {
        return res.status(400).json(errorResponse('Missing params: id is required', 400));
      }

      const taskStatus = await TaskStatus.findByPk(statusIdValue, {
        include: [
          { model: Project, as: 'project', attributes: ['id', 'name'], required: false }
        ],
      });

      if (!taskStatus) {
        return res.status(404).json(errorResponse('Task status not found', 404));
      }

      res.json(successResponse({ taskStatus }));
    } catch (error) {
      console.error('Error fetching task status:', error);
      res.status(500).json(errorResponse('Failed to fetch task status', 500));
    }
  };

  // Create new task status
  const createTaskStatus = async (req, res) => {
    const { project_id, projectId, name, color, icon, description, order, is_default } = req.body;
    const created_by = req.user.id;

    try {
      if (!name || name.trim().length === 0) {
        return res.status(400).json(errorResponse('Missing params: name is required', 400));
      }

      if (name.length > 150) {
        return res.status(400).json(errorResponse('Task status name must be 150 characters or less', 400));
      }

      const projectIdValue = project_id || projectId || null;

      const taskStatus = await TaskStatus.create({
        project_id: projectIdValue ? parseInt(projectIdValue) : null,
        name: name.trim(),
        color: color || null,
        icon: icon || null,
        description: description || null,
        order: order || 0,
        is_default: is_default || false,
        is_active: true,
        created_by,
      });

      res.status(201).json(successResponse({ taskStatus }, 'Task status created successfully'));
    } catch (error) {
      console.error('Error creating task status:', error);
      res.status(500).json(errorResponse('Failed to create task status', 500));
    }
  };

  // Update task status
  const updateTaskStatus = async (req, res) => {
    const { id, task_status_id, taskStatusId, name, color, icon, description, order, is_default, is_active, project_id, projectId } = req.body;
    const statusIdValue = id || task_status_id || taskStatusId || req.params.id;

    try {
      if (!statusIdValue || isNaN(parseInt(statusIdValue))) {
        return res.status(400).json(errorResponse('Missing params: id is required', 400));
      }

      const taskStatus = await TaskStatus.findByPk(statusIdValue);
      if (!taskStatus) {
        return res.status(404).json(errorResponse('Task status not found', 404));
      }

      const updateData = {};
      if (name !== undefined) {
        if (!name || name.trim().length === 0) {
          return res.status(400).json(errorResponse('Task status name cannot be empty', 400));
        }
        if (name.length > 150) {
          return res.status(400).json(errorResponse('Task status name must be 150 characters or less', 400));
        }
        updateData.name = name.trim();
      }
      if (color !== undefined) updateData.color = color;
      if (icon !== undefined) updateData.icon = icon;
      if (description !== undefined) updateData.description = description;
      if (order !== undefined) updateData.order = order;
      if (is_default !== undefined) updateData.is_default = is_default;
      if (is_active !== undefined) updateData.is_active = is_active;
      if (project_id !== undefined || projectId !== undefined) {
        const projectIdValue = project_id || projectId;
        updateData.project_id = projectIdValue ? parseInt(projectIdValue) : null;
      }

      await taskStatus.update(updateData);

      res.json(successResponse({ taskStatus }, 'Task status updated successfully'));
    } catch (error) {
      console.error('Error updating task status:', error);
      res.status(500).json(errorResponse('Failed to update task status', 500));
    }
  };

  // Delete task status (soft delete by setting is_active to false)
  const deleteTaskStatus = async (req, res) => {
    const { id, task_status_id, taskStatusId } = req.body;
    const statusIdValue = id || task_status_id || taskStatusId || req.params.id;

    try {
      if (!statusIdValue || isNaN(parseInt(statusIdValue))) {
        return res.status(400).json(errorResponse('Missing params: id is required', 400));
      }

      const taskStatus = await TaskStatus.findByPk(statusIdValue);
      if (!taskStatus) {
        return res.status(404).json(errorResponse('Task status not found', 404));
      }

      // Check if any tasks are using this status
      const taskCount = await Task.count({
        where: { task_status_id: parseInt(statusIdValue), deleted_at: null }
      });

      if (taskCount > 0) {
        return res.status(400).json(errorResponse(`Cannot delete task status: ${taskCount} task(s) are using this status`, 400));
      }

      // Soft delete by setting is_active to false
      await taskStatus.update({ is_active: false });
      res.json(successResponse(null, 'Task status deleted successfully'));
    } catch (error) {
      console.error('Error deleting task status:', error);
      res.status(500).json(errorResponse('Failed to delete task status', 500));
    }
  };

  return {
    getTaskStatuses,
    getTaskStatusById,
    createTaskStatus,
    updateTaskStatus,
    deleteTaskStatus,
  };
};

module.exports = taskStatusController;

