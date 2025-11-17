const { Task, Section, Project, User, TaskComment, Subtask } = require('../models');
const { Op } = require('sequelize');

const taskController = () => {
  // Get all tasks for a project
  const getTasksByProject = async (req, res) => {
    try {
      const { projectId } = req.params;
      const tasks = await Task.findAll({
        where: { project_id: projectId, deleted_at: null },
        include: [
          { model: Section, as: 'section' },
          { model: User, as: 'assignee', attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'] },
          { model: User, as: 'creator', attributes: ['id', 'full_name', 'email'] },
        ],
        order: [['position', 'ASC']],
      });
      res.json(tasks);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Get task by ID
  const getTaskById = async (req, res) => {
    try {
      const { taskId } = req.params;
      const task = await Task.findByPk(taskId, {
        include: [
          { model: Section, as: 'section' },
          { model: User, as: 'assignee', attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'] },
          { model: User, as: 'creator', attributes: ['id', 'full_name', 'email'] },
          { model: Project, as: 'project' },
          { model: Subtask, as: 'subtasks' },
          { model: TaskComment, as: 'comments', include: [{ model: User, as: 'user', attributes: ['id', 'full_name', 'email', 'avatar_url'] }] },
        ],
      });
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      res.json(task);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Create new task
  const createTask = async (req, res) => {
    try {
      const { project_id, section_id, title, description, assigned_to, priority, status, due_date, position } = req.body;
      const created_by = req.user.id;

      const task = await Task.create({
        project_id,
        section_id,
        title,
        description,
        created_by,
        assigned_to,
        priority: priority || 'Medium',
        status: status || 'To Do',
        due_date,
        position: position || 0,
        completed: false,
      });

      const taskWithRelations = await Task.findByPk(task.id, {
        include: [
          { model: Section, as: 'section' },
          { model: User, as: 'assignee', attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'] },
        ],
      });

      res.status(201).json(taskWithRelations);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Update task
  const updateTask = async (req, res) => {
    try {
      const { taskId } = req.params;
      const updateData = req.body;

      const task = await Task.findByPk(taskId);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      await task.update(updateData);

      const updatedTask = await Task.findByPk(taskId, {
        include: [
          { model: Section, as: 'section' },
          { model: User, as: 'assignee', attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'] },
        ],
      });

      res.json(updatedTask);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Delete task (soft delete)
  const deleteTask = async (req, res) => {
    try {
      const { taskId } = req.params;
      const task = await Task.findByPk(taskId);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      await task.destroy();
      res.json({ message: 'Task deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Toggle task completion
  const toggleTaskCompletion = async (req, res) => {
    try {
      const { taskId } = req.params;
      const task = await Task.findByPk(taskId);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      await task.update({ completed: !task.completed });
      res.json(task);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  return {
    getTasksByProject,
    getTaskById,
    createTask,
    updateTask,
    deleteTask,
    toggleTaskCompletion,
  };
};
module.exports = taskController;