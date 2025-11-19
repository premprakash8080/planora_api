const { PriorityLabel, Project, Task } = require('../models');
const { successResponse, errorResponse } = require('../utils/responseFormatter');

const priorityLabelController = () => {
  // Get all priority labels (optionally filtered by project)
  const getPriorityLabels = async (req, res) => {
    const { project_id, projectId } = req.body;
    const projectIdValue = project_id || projectId || req.query.project_id || req.query.projectId;

    try {
      const { Op } = require('sequelize');
      
      // If project_id is provided, get both global (null) and project-specific labels
      // Otherwise, just get global labels
      const where = { is_active: true };
      if (projectIdValue) {
        where.project_id = {
          [Op.or]: [null, parseInt(projectIdValue)]
        };
      } else {
        // If no project_id, get global labels (project_id is null)
        where.project_id = null;
      }

      const priorityLabels = await PriorityLabel.findAll({
        where,
        include: [
          { model: Project, as: 'project', attributes: ['id', 'name'], required: false }
        ],
        order: [['order', 'ASC'], ['name', 'ASC']],
      });

      res.json(successResponse({ priorityLabels }));
    } catch (error) {
      console.error('Error fetching priority labels:', error);
      res.status(500).json(errorResponse('Failed to fetch priority labels', 500));
    }
  };

  // Get priority label by ID
  const getPriorityLabelById = async (req, res) => {
    const { id, priority_label_id, priorityLabelId } = req.body;
    const labelIdValue = id || priority_label_id || priorityLabelId || req.params.id;

    try {
      if (!labelIdValue || isNaN(parseInt(labelIdValue))) {
        return res.status(400).json(errorResponse('Missing params: id is required', 400));
      }

      const priorityLabel = await PriorityLabel.findByPk(labelIdValue, {
        include: [
          { model: Project, as: 'project', attributes: ['id', 'name'], required: false }
        ],
      });

      if (!priorityLabel) {
        return res.status(404).json(errorResponse('Priority label not found', 404));
      }

      res.json(successResponse({ priorityLabel }));
    } catch (error) {
      console.error('Error fetching priority label:', error);
      res.status(500).json(errorResponse('Failed to fetch priority label', 500));
    }
  };

  // Create new priority label
  const createPriorityLabel = async (req, res) => {
    const { project_id, projectId, name, color, icon, description, order, is_default } = req.body;
    const created_by = req.user.id;

    try {
      if (!name || name.trim().length === 0) {
        return res.status(400).json(errorResponse('Missing params: name is required', 400));
      }

      if (name.length > 150) {
        return res.status(400).json(errorResponse('Priority label name must be 150 characters or less', 400));
      }

      const projectIdValue = project_id || projectId || null;

      const priorityLabel = await PriorityLabel.create({
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

      res.status(201).json(successResponse({ priorityLabel }, 'Priority label created successfully'));
    } catch (error) {
      console.error('Error creating priority label:', error);
      res.status(500).json(errorResponse('Failed to create priority label', 500));
    }
  };

  // Update priority label
  const updatePriorityLabel = async (req, res) => {
    const { id, priority_label_id, priorityLabelId, name, color, icon, description, order, is_default, is_active, project_id, projectId } = req.body;
    const labelIdValue = id || priority_label_id || priorityLabelId || req.params.id;

    try {
      if (!labelIdValue || isNaN(parseInt(labelIdValue))) {
        return res.status(400).json(errorResponse('Missing params: id is required', 400));
      }

      const priorityLabel = await PriorityLabel.findByPk(labelIdValue);
      if (!priorityLabel) {
        return res.status(404).json(errorResponse('Priority label not found', 404));
      }

      const updateData = {};
      if (name !== undefined) {
        if (!name || name.trim().length === 0) {
          return res.status(400).json(errorResponse('Priority label name cannot be empty', 400));
        }
        if (name.length > 150) {
          return res.status(400).json(errorResponse('Priority label name must be 150 characters or less', 400));
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

      await priorityLabel.update(updateData);

      res.json(successResponse({ priorityLabel }, 'Priority label updated successfully'));
    } catch (error) {
      console.error('Error updating priority label:', error);
      res.status(500).json(errorResponse('Failed to update priority label', 500));
    }
  };

  // Delete priority label (soft delete by setting is_active to false)
  const deletePriorityLabel = async (req, res) => {
    const { id, priority_label_id, priorityLabelId } = req.body;
    const labelIdValue = id || priority_label_id || priorityLabelId || req.params.id;

    try {
      if (!labelIdValue || isNaN(parseInt(labelIdValue))) {
        return res.status(400).json(errorResponse('Missing params: id is required', 400));
      }

      const priorityLabel = await PriorityLabel.findByPk(labelIdValue);
      if (!priorityLabel) {
        return res.status(404).json(errorResponse('Priority label not found', 404));
      }

      // Check if any tasks are using this priority label
      const taskCount = await Task.count({
        where: { priority_label_id: parseInt(labelIdValue), deleted_at: null }
      });

      if (taskCount > 0) {
        return res.status(400).json(errorResponse(`Cannot delete priority label: ${taskCount} task(s) are using this priority label`, 400));
      }

      // Soft delete by setting is_active to false
      await priorityLabel.update({ is_active: false });
      res.json(successResponse(null, 'Priority label deleted successfully'));
    } catch (error) {
      console.error('Error deleting priority label:', error);
      res.status(500).json(errorResponse('Failed to delete priority label', 500));
    }
  };

  return {
    getPriorityLabels,
    getPriorityLabelById,
    createPriorityLabel,
    updatePriorityLabel,
    deletePriorityLabel,
  };
};

module.exports = priorityLabelController;

