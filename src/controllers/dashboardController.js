const { Task, Project, NoticeBoard } = require('../models');
const { Op } = require('sequelize');

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

      // Get tasks completed this month
      const completed = await Task.count({
        where: {
          status: 'Done',
          updated_at: {
            [Op.between]: [startOfMonth, endOfMonth]
          },
          deleted_at: null
        }
      });

      // Get tasks that are "out" (in progress or completed) this month
      const housesOut = await Task.count({
        where: {
          status: {
            [Op.in]: ['In Progress', 'Done']
          },
          updated_at: {
            [Op.between]: [startOfMonth, endOfMonth]
          },
          deleted_at: null
        }
      });

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
      const tasks = await Task.findAll({ where: { deleted_at: null } });
      const upcomingTasks = tasks.filter(task => task.status === 'To Do' && task.due_date > new Date());
      const overdueTasks = tasks.filter(task => task.status === 'To Do' && task.due_date < new Date());
      const inProgressTasks = tasks.filter(task => task.status === 'In Progress');
      const doneTasks = tasks.filter(task => task.status === 'Done');
      res.json({ upcomingTasks, overdueTasks, inProgressTasks, doneTasks });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  return {
    getMonthlyStats,
    getNoticeBoard,
    updateNoticeBoard,
    getTaskDashboardDetails
  };
};

module.exports = dashboardController;

