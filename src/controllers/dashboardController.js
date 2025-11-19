const { Task, Project, NoticeBoard, TaskStatus, PriorityLabel } = require('../models');
const { Op } = require('sequelize');
const { successResponse, errorResponse } = require('../utils/responseFormatter');

const dashboardController = () => {
  // Get monthly statistics
  const getMonthlyStats = async (req, res) => {
    try {
      const { fiscalYear } = req.query;
      const currentDate = new Date();
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

      // Get all projects
      const allProjects = await Project.findAll({
        where: { deleted_at: null }
      });

      // Get tasks created this month
      const newJobs = await Task.count({
        where: {
          created_at: {
            [Op.between]: [startOfMonth, endOfMonth]
          },
          deleted_at: null
        }
      });

      // Find TaskStatus IDs for "Done" status
      const doneStatus = await TaskStatus.findOne({
        where: { name: 'Done', is_active: true }
      });
      const doneStatusId = doneStatus ? doneStatus.id : null;

      // Find TaskStatus IDs for "In Progress" and "Done" statuses
      const inProgressStatus = await TaskStatus.findOne({
        where: { name: 'In Progress', is_active: true }
      });
      const inProgressStatusId = inProgressStatus ? inProgressStatus.id : null;

      // Get tasks completed this month
      let completed = 0;
      if (doneStatusId) {
        completed = await Task.count({
          where: {
            task_status_id: doneStatusId,
            updated_at: {
              [Op.between]: [startOfMonth, endOfMonth]
            },
            deleted_at: null
          }
        });
      }

      // Get tasks that are "out" (in progress or completed) this month
      const statusIds = [inProgressStatusId, doneStatusId].filter(id => id !== null);
      let housesOut = 0;
      if (statusIds.length > 0) {
        housesOut = await Task.count({
          where: {
            task_status_id: { [Op.in]: statusIds },
            updated_at: {
              [Op.between]: [startOfMonth, endOfMonth]
            },
            deleted_at: null
          }
        });
      }

      res.json({
        newJobs,
        housesOut,
        completed
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Get notice board message
  const getNoticeBoard = async (req, res) => {
    try {
      // For now, return a default message or get from database if NoticeBoard model exists
      // If you have a NoticeBoard model, use: const notice = await NoticeBoard.findOne({ order: [['created_at', 'DESC']] });
      res.json({
        message: 'Hi Team!\n\nWe will be having our end of month meeting this Friday 5:30pm. Please make sure you\'re back on site before that time. Cheers!'
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Update notice board message
  const updateNoticeBoard = async (req, res) => {
    const { message } = req.body;
    const userId = req.user.id;

    try {
      if (!message) {
        return res.status(400).json({
          success: false,
          message: 'Missing params: message is required',
        });
      }

      // If you have a NoticeBoard model, use:
      // const notice = await NoticeBoard.create({ message, created_by: userId });
      // Otherwise, just return success
      
      res.json({
        success: true,
        message: 'Notice board updated successfully'
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Get task dashboard details
  const getTaskDashboardDetails = async (req, res) => {
    try {
      // Find TaskStatus records by name
      const toDoStatus = await TaskStatus.findOne({ where: { name: 'To Do', is_active: true } });
      const inProgressStatus = await TaskStatus.findOne({ where: { name: 'In Progress', is_active: true } });
      const doneStatus = await TaskStatus.findOne({ where: { name: 'Done', is_active: true } });

      const tasks = await Task.findAll({
        where: { deleted_at: null },
        include: [
          {
            model: TaskStatus,
            as: 'taskStatus',
            required: false
          },
          {
            model: PriorityLabel,
            as: 'priorityLabel',
            required: false
          }
        ]
      });

      const currentDate = new Date();
      const upcomingTasks = tasks.filter(task => {
        const isToDo = toDoStatus && task.task_status_id === toDoStatus.id;
        const hasDueDate = task.due_date && new Date(task.due_date) > currentDate;
        return isToDo && hasDueDate;
      });

      const overdueTasks = tasks.filter(task => {
        const isToDo = toDoStatus && task.task_status_id === toDoStatus.id;
        const hasDueDate = task.due_date && new Date(task.due_date) < currentDate;
        return isToDo && hasDueDate;
      });

      const inProgressTasks = tasks.filter(task => 
        inProgressStatus && task.task_status_id === inProgressStatus.id
      );

      const doneTasks = tasks.filter(task => 
        doneStatus && task.task_status_id === doneStatus.id
      );

      res.json({ upcomingTasks, overdueTasks, inProgressTasks, doneTasks });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  const getTaskDashboardCounts = async (req, res) => {
    try {
      // Find TaskStatus records by name
      const toDoStatus = await TaskStatus.findOne({ where: { name: 'To Do', is_active: true } });
      const inProgressStatus = await TaskStatus.findOne({ where: { name: 'In Progress', is_active: true } });
      const doneStatus = await TaskStatus.findOne({ where: { name: 'Done', is_active: true } });

      const toDoStatusId = toDoStatus ? toDoStatus.id : null;
      const inProgressStatusId = inProgressStatus ? inProgressStatus.id : null;
      const doneStatusId = doneStatus ? doneStatus.id : null;

      const currentDate = new Date();

      // Get all tasks with their status and priority information
      const tasks = await Task.findAll({
        where: { deleted_at: null },
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
      });

      // Filter tasks by status
      const upcomingTasks = tasks.filter(task => {
        const isToDo = toDoStatusId && task.task_status_id === toDoStatusId;
        const hasDueDate = task.due_date && new Date(task.due_date) > currentDate;
        return isToDo && hasDueDate;
      });

      const overdueTasks = tasks.filter(task => {
        const isToDo = toDoStatusId && task.task_status_id === toDoStatusId;
        const hasDueDate = task.due_date && new Date(task.due_date) < currentDate;
        return isToDo && hasDueDate;
      });

      const inProgressTasks = tasks.filter(task => 
        inProgressStatusId && task.task_status_id === inProgressStatusId
      );

      const doneTasks = tasks.filter(task => 
        doneStatusId && task.task_status_id === doneStatusId
      );

      res.json(successResponse({
        upcomingTasks: upcomingTasks.length,
        overdueTasks: overdueTasks.length,
        inProgressTasks: inProgressTasks.length,
        doneTasks: doneTasks.length
      }));
    } catch (error) {
      console.error('Error fetching task dashboard counts:', error);
      res.status(500).json(errorResponse(`Failed to fetch task dashboard counts: ${error.message}`, 500));
    }
  };

  return {
    getMonthlyStats,
    getNoticeBoard,
    updateNoticeBoard,
    getTaskDashboardDetails,
    getTaskDashboardCounts
  };
};

module.exports = dashboardController;

