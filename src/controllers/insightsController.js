const { Task, Project, User, ProjectMember, TaskActivityLog } = require('../models');
const { Op, Sequelize } = require('sequelize');
const { successResponse, errorResponse } = require('../utils/responseFormatter');

const insightsController = () => {
  /**
   * Get productivity overview metrics
   * Returns: tasks completed today, average completion time, productivity score, focus time
   */
  const getProductivityMetrics = async (req, res) => {
    try {
      const userId = req.user.id;
      const { period = 'week' } = req.query; // week, month, quarter

      // Calculate date range based on period
      const now = new Date();
      let startDate;
      if (period === 'week') {
        startDate = new Date(now.setDate(now.getDate() - 7));
      } else if (period === 'month') {
        startDate = new Date(now.setMonth(now.getMonth() - 1));
      } else if (period === 'quarter') {
        startDate = new Date(now.setMonth(now.getMonth() - 3));
      }

      // Get user's projects
      const userProjects = await ProjectMember.findAll({
        where: { user_id: userId },
        attributes: ['project_id']
      });
      const projectIds = userProjects.map(pm => pm.project_id);

      // Tasks completed today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayEnd = new Date(today);
      todayEnd.setHours(23, 59, 59, 999);

      const tasksCompletedToday = await Task.count({
        where: {
          assigned_to: userId,
          status: 'Done',
          completed: true,
          updated_at: {
            [Op.between]: [today, todayEnd]
          },
          deleted_at: null
        }
      });

      // Average completion time (in hours) - approximate based on created_at to updated_at
      const completedTasksForAvg = await Task.findAll({
        where: {
          assigned_to: userId,
          status: 'Done',
          completed: true,
          updated_at: {
            [Op.gte]: startDate
          },
          deleted_at: null
        },
        attributes: ['id', 'created_at', 'updated_at'],
        raw: false
      });

      let avgCompletionTime = 0;
      if (completedTasksForAvg.length > 0) {
        const totalHours = completedTasksForAvg.reduce((sum, task) => {
          const created = new Date(task.created_at);
          const updated = new Date(task.updated_at);
          const hoursDiff = (updated - created) / (1000 * 60 * 60);
          return sum + (hoursDiff || 0);
        }, 0);
        avgCompletionTime = totalHours / completedTasksForAvg.length;
      }

      // Productivity score (percentage of tasks completed vs assigned in period)
      const tasksAssigned = await Task.count({
        where: {
          assigned_to: userId,
          created_at: { [Op.gte]: startDate },
          deleted_at: null
        }
      });

      const tasksCompleted = await Task.count({
        where: {
          assigned_to: userId,
          status: 'Done',
          completed: true,
          updated_at: { [Op.gte]: startDate },
          deleted_at: null
        }
      });

      const productivityScore = tasksAssigned > 0 ? Math.round((tasksCompleted / tasksAssigned) * 100) : 0;

      // Focus time (approximate - hours worked based on task activity)
      const focusTime = avgCompletionTime * tasksCompleted || 0;

      // Calculate changes (compare with previous period)
      const prevStartDate = new Date(startDate);
      const prevEndDate = new Date(startDate);
      if (period === 'week') {
        prevStartDate.setDate(prevStartDate.getDate() - 7);
      } else if (period === 'month') {
        prevStartDate.setMonth(prevStartDate.getMonth() - 1);
      } else if (period === 'quarter') {
        prevStartDate.setMonth(prevStartDate.getMonth() - 3);
      }

      const prevTasksCompleted = await Task.count({
        where: {
          assigned_to: userId,
          status: 'Done',
          completed: true,
          updated_at: {
            [Op.between]: [prevStartDate, prevEndDate]
          },
          deleted_at: null
        }
      });

      const tasksChange = prevTasksCompleted > 0 
        ? Math.round(((tasksCompletedToday - prevTasksCompleted) / prevTasksCompleted) * 100)
        : 0;

      const metrics = [
        {
          id: '1',
          label: 'Tasks Completed Today',
          value: tasksCompletedToday,
          unit: 'tasks',
          change: Math.abs(tasksChange),
          changeType: tasksChange >= 0 ? 'increase' : 'decrease',
          icon: 'check_circle',
          color: '#4caf50'
        },
        {
          id: '2',
          label: 'Average Completion Time',
          value: parseFloat(avgCompletionTime.toFixed(1)),
          unit: 'hours',
          change: 8, // Placeholder - would need historical data
          changeType: 'decrease',
          icon: 'schedule',
          color: '#2196f3'
        },
        {
          id: '3',
          label: 'Productivity Score',
          value: productivityScore,
          unit: '%',
          change: 5, // Placeholder
          changeType: 'increase',
          icon: 'trending_up',
          color: '#9c27b0'
        },
        {
          id: '4',
          label: 'Focus Time',
          value: parseFloat(focusTime.toFixed(1)),
          unit: 'hours',
          change: 12, // Placeholder
          changeType: 'increase',
          icon: 'timer',
          color: '#ff9800'
        }
      ];

      res.json(successResponse({ metrics }));
    } catch (error) {
      console.error('Error fetching productivity metrics:', error);
      res.status(500).json(errorResponse(`Failed to fetch productivity metrics: ${error.message}`, 500));
    }
  };

  /**
   * Get productivity trends (daily breakdown)
   */
  const getProductivityTrends = async (req, res) => {
    try {
      const userId = req.user.id;
      const { period = 'week' } = req.query;

      // Get last 7 days
      const trends = [];
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);

        const tasksCompleted = await Task.count({
          where: {
            assigned_to: userId,
            status: 'Done',
            completed: true,
            updated_at: {
              [Op.between]: [dayStart, dayEnd]
            },
            deleted_at: null
          }
        });

        // Approximate hours worked (based on tasks completed)
        const hoursWorked = tasksCompleted * 0.5; // Rough estimate

        // Efficiency (percentage based on completion rate)
        const tasksAssigned = await Task.count({
          where: {
            assigned_to: userId,
            created_at: {
              [Op.between]: [dayStart, dayEnd]
            },
            deleted_at: null
          }
        });

        const efficiency = tasksAssigned > 0 ? Math.round((tasksCompleted / tasksAssigned) * 100) : 0;

        trends.push({
          day: days[date.getDay()],
          tasksCompleted,
          hoursWorked: parseFloat(hoursWorked.toFixed(1)),
          efficiency: efficiency || 70
        });
      }

      res.json(successResponse({ trends }));
    } catch (error) {
      console.error('Error fetching productivity trends:', error);
      res.status(500).json(errorResponse(`Failed to fetch productivity trends: ${error.message}`, 500));
    }
  };

  /**
   * Get report metrics (total tasks, completed, in progress, overdue)
   */
  const getReportMetrics = async (req, res) => {
    try {
      const userId = req.user.id;

      // Get user's projects
      const userProjects = await ProjectMember.findAll({
        where: { user_id: userId },
        attributes: ['project_id']
      });
      const projectIds = userProjects.map(pm => pm.project_id);

      // Total tasks
      const totalTasks = await Task.count({
        where: {
          project_id: { [Op.in]: projectIds },
          deleted_at: null
        }
      });

      // Completed tasks
      const completedTasks = await Task.count({
        where: {
          project_id: { [Op.in]: projectIds },
          status: 'Done',
          completed: true,
          deleted_at: null
        }
      });

      // In progress tasks
      const inProgressTasks = await Task.count({
        where: {
          project_id: { [Op.in]: projectIds },
          status: 'In Progress',
          deleted_at: null
        }
      });

      // Overdue tasks
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const overdueTasks = await Task.count({
        where: {
          project_id: { [Op.in]: projectIds },
          status: { [Op.ne]: 'Done' },
          due_date: { [Op.lt]: today },
          deleted_at: null
        }
      });

      // Calculate changes (compare with previous period)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const prevTotalTasks = await Task.count({
        where: {
          project_id: { [Op.in]: projectIds },
          created_at: { [Op.lt]: thirtyDaysAgo },
          deleted_at: null
        }
      });

      const prevCompletedTasks = await Task.count({
        where: {
          project_id: { [Op.in]: projectIds },
          status: 'Done',
          completed: true,
          updated_at: { [Op.lt]: thirtyDaysAgo },
          deleted_at: null
        }
      });

      const totalChange = prevTotalTasks > 0 
        ? Math.round(((totalTasks - prevTotalTasks) / prevTotalTasks) * 100)
        : 0;
      const completedChange = prevCompletedTasks > 0
        ? Math.round(((completedTasks - prevCompletedTasks) / prevCompletedTasks) * 100)
        : 0;

      const metrics = [
        {
          id: '1',
          metric: 'Total Tasks',
          value: totalTasks,
          change: Math.abs(totalChange),
          changeType: totalChange >= 0 ? 'increase' : 'decrease',
          icon: 'task',
          color: '#2196f3'
        },
        {
          id: '2',
          metric: 'Completed Tasks',
          value: completedTasks,
          change: Math.abs(completedChange),
          changeType: completedChange >= 0 ? 'increase' : 'decrease',
          icon: 'check_circle',
          color: '#4caf50'
        },
        {
          id: '3',
          metric: 'In Progress',
          value: inProgressTasks,
          change: 5, // Placeholder
          changeType: 'decrease',
          icon: 'hourglass_empty',
          color: '#ff9800'
        },
        {
          id: '4',
          metric: 'Overdue Tasks',
          value: overdueTasks,
          change: 3, // Placeholder
          changeType: 'increase',
          icon: 'warning',
          color: '#f44336'
        }
      ];

      res.json(successResponse({ metrics }));
    } catch (error) {
      console.error('Error fetching report metrics:', error);
      res.status(500).json(errorResponse(`Failed to fetch report metrics: ${error.message}`, 500));
    }
  };

  /**
   * Get task status analytics
   */
  const getTaskStatusAnalytics = async (req, res) => {
    try {
      const userId = req.user.id;

      // Get user's projects
      const userProjects = await ProjectMember.findAll({
        where: { user_id: userId },
        attributes: ['project_id']
      });
      const projectIds = userProjects.map(pm => pm.project_id);

      const totalTasks = await Task.count({
        where: {
          project_id: { [Op.in]: projectIds },
          deleted_at: null
        }
      });

      if (totalTasks === 0) {
        return res.json(successResponse({ analytics: [] }));
      }

      const statuses = ['To Do', 'In Progress', 'Done', 'On Track', 'At Risk', 'Off Track'];
      const analytics = [];

      for (const status of statuses) {
        const count = await Task.count({
          where: {
            project_id: { [Op.in]: projectIds },
            status,
            deleted_at: null
          }
        });

        if (count > 0) {
          const percentage = Math.round((count / totalTasks) * 100 * 10) / 10;
          const colorMap = {
            'To Do': '#9e9e9e',
            'In Progress': '#ff9800',
            'Done': '#4caf50',
            'On Track': '#4caf50',
            'At Risk': '#ff9800',
            'Off Track': '#f44336'
          };

          analytics.push({
            status,
            count,
            percentage,
            color: colorMap[status] || '#9e9e9e'
          });
        }
      }

      res.json(successResponse({ analytics }));
    } catch (error) {
      console.error('Error fetching task status analytics:', error);
      res.status(500).json(errorResponse(`Failed to fetch task status analytics: ${error.message}`, 500));
    }
  };

  /**
   * Get project performance
   */
  const getProjectPerformance = async (req, res) => {
    try {
      const userId = req.user.id;

      // Get user's projects
      const userProjects = await ProjectMember.findAll({
        where: { user_id: userId },
        include: [
          {
            model: Project,
            as: 'project',
            attributes: ['id', 'name', 'status']
          }
        ]
      });

      const performance = [];

      for (const userProject of userProjects) {
        const project = userProject.project;
        if (!project) continue;

        const totalTasks = await Task.count({
          where: {
            project_id: project.id,
            deleted_at: null
          }
        });

        const completed = await Task.count({
          where: {
            project_id: project.id,
            status: 'Done',
            completed: true,
            deleted_at: null
          }
        });

        const completionRate = totalTasks > 0 
          ? Math.round((completed / totalTasks) * 100 * 10) / 10
          : 0;

        // Determine status based on completion rate
        let status = 'On Track';
        if (completionRate < 50) {
          status = 'Delayed';
        } else if (completionRate < 70) {
          status = 'At Risk';
        }

        performance.push({
          projectName: project.name,
          totalTasks,
          completed,
          completionRate,
          status
        });
      }

      res.json(successResponse({ performance }));
    } catch (error) {
      console.error('Error fetching project performance:', error);
      res.status(500).json(errorResponse(`Failed to fetch project performance: ${error.message}`, 500));
    }
  };

  /**
   * Get team metrics
   */
  const getTeamMetrics = async (req, res) => {
    try {
      const userId = req.user.id;

      // Get user's projects and team members
      const userProjects = await ProjectMember.findAll({
        where: { user_id: userId },
        attributes: ['project_id']
      });
      const projectIds = userProjects.map(pm => pm.project_id);

      // Get all team members from projects
      const teamMembers = await ProjectMember.findAll({
        where: { project_id: { [Op.in]: projectIds } },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'status'],
            required: true
          }
        ],
        attributes: ['user_id']
      });

      const uniqueMemberIds = [...new Set(teamMembers.map(tm => tm.user_id))];
      const activeMembers = teamMembers.filter(tm => tm.user?.status === 'active').length;

      // Calculate team productivity (average completion rate)
      const allTasks = await Task.count({
        where: {
          project_id: { [Op.in]: projectIds },
          deleted_at: null
        }
      });

      const completedTasks = await Task.count({
        where: {
          project_id: { [Op.in]: projectIds },
          status: 'Done',
          completed: true,
          deleted_at: null
        }
      });

      const teamProductivity = allTasks > 0 
        ? Math.round((completedTasks / allTasks) * 100)
        : 0;

      // Average completion rate (placeholder calculation)
      const avgCompletionRate = teamProductivity;

      // Team collaboration score (based on comments/activity)
      const recentActivity = await TaskActivityLog.count({
        where: {
          project_id: { [Op.in]: projectIds },
          created_at: {
            [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
          }
        }
      });

      const collaborationScore = Math.min(100, Math.round((recentActivity / (uniqueMemberIds.length * 10)) * 100));

      const metrics = [
        {
          id: '1',
          label: 'Team Productivity',
          value: teamProductivity,
          unit: '%',
          icon: 'trending_up',
          color: '#4caf50'
        },
        {
          id: '2',
          label: 'Average Completion Rate',
          value: avgCompletionRate,
          unit: '%',
          icon: 'check_circle',
          color: '#2196f3'
        },
        {
          id: '3',
          label: 'Active Team Members',
          value: activeMembers,
          unit: 'members',
          icon: 'people',
          color: '#9c27b0'
        },
        {
          id: '4',
          label: 'Team Collaboration Score',
          value: collaborationScore,
          unit: '%',
          icon: 'group',
          color: '#ff9800'
        }
      ];

      res.json(successResponse({ metrics }));
    } catch (error) {
      console.error('Error fetching team metrics:', error);
      res.status(500).json(errorResponse(`Failed to fetch team metrics: ${error.message}`, 500));
    }
  };

  /**
   * Get team member performance
   */
  const getTeamMemberPerformance = async (req, res) => {
    try {
      const userId = req.user.id;

      // Get user's projects
      const userProjects = await ProjectMember.findAll({
        where: { user_id: userId },
        attributes: ['project_id']
      });
      const projectIds = userProjects.map(pm => pm.project_id);

      // Get all team members from projects
      const teamMembers = await ProjectMember.findAll({
        where: { project_id: { [Op.in]: projectIds } },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials', 'status'],
            required: true
          }
        ],
        attributes: ['user_id']
      });

      // Get unique members
      const memberMap = new Map();
      teamMembers.forEach(tm => {
        if (tm.user && !memberMap.has(tm.user.id)) {
          memberMap.set(tm.user.id, tm.user);
        }
      });

      const members = [];

      for (const [memberId, user] of memberMap) {
        const tasksAssigned = await Task.count({
          where: {
            assigned_to: memberId,
            project_id: { [Op.in]: projectIds },
            deleted_at: null
          }
        });

        const tasksCompleted = await Task.count({
          where: {
            assigned_to: memberId,
            project_id: { [Op.in]: projectIds },
            status: 'Done',
            completed: true,
            deleted_at: null
          }
        });

        const completionRate = tasksAssigned > 0
          ? Math.round((tasksCompleted / tasksAssigned) * 100 * 10) / 10
          : 0;

        // Productivity score (based on completion rate and activity)
        const recentTasks = await Task.count({
          where: {
            assigned_to: memberId,
            project_id: { [Op.in]: projectIds },
            updated_at: {
              [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            },
            deleted_at: null
          }
        });

        const productivityScore = Math.min(100, Math.round(completionRate * 0.7 + (recentTasks > 0 ? 30 : 0)));

        // Get user role (placeholder - would need role field)
        const role = 'Team Member'; // Default

        members.push({
          id: user.id.toString(),
          name: user.full_name,
          avatarInitials: user.initials || user.full_name.substring(0, 2).toUpperCase(),
          avatarColor: user.avatar_color || '#2563eb',
          avatarUrl: user.avatar_url,
          role,
          tasksCompleted,
          tasksAssigned,
          completionRate,
          productivityScore,
          status: user.status || 'active'
        });
      }

      res.json(successResponse({ members }));
    } catch (error) {
      console.error('Error fetching team member performance:', error);
      res.status(500).json(errorResponse(`Failed to fetch team member performance: ${error.message}`, 500));
    }
  };

  /**
   * Get time tracking summary
   * Note: Since there's no time tracking model, we'll approximate based on tasks
   */
  const getTimeTrackingSummary = async (req, res) => {
    try {
      const userId = req.user.id;
      const { period = 'week' } = req.query;

      // Calculate date range
      const now = new Date();
      let startDate;
      if (period === 'week') {
        startDate = new Date(now.setDate(now.getDate() - 7));
      } else if (period === 'month') {
        startDate = new Date(now.setMonth(now.getMonth() - 1));
      }

      // Get user's projects
      const userProjects = await ProjectMember.findAll({
        where: { user_id: userId },
        attributes: ['project_id']
      });
      const projectIds = userProjects.map(pm => pm.project_id);

      // Approximate time based on tasks completed - get all tasks and group manually
      const completedTasks = await Task.findAll({
        where: {
          assigned_to: userId,
          project_id: { [Op.in]: projectIds },
          status: 'Done',
          completed: true,
          updated_at: { [Op.gte]: startDate },
          deleted_at: null
        },
        include: [
          {
            model: Project,
            as: 'project',
            attributes: ['id', 'name'],
            required: true
          }
        ],
        raw: false
      });

      // Group by project
      const projectMap = new Map();
      completedTasks.forEach(task => {
        const project = task.project;
        if (!project) return;

        if (!projectMap.has(project.id)) {
          projectMap.set(project.id, {
            project,
            tasks: [],
            totalHours: 0
          });
        }

        const created = new Date(task.created_at);
        const updated = new Date(task.updated_at);
        const hoursDiff = (updated - created) / (1000 * 60 * 60);
        const hours = hoursDiff || 0.5; // Default to 0.5 hours if no time difference

        projectMap.get(project.id).tasks.push(task);
        projectMap.get(project.id).totalHours += hours;
      });

      const summary = [];
      let totalHours = 0;
      let totalBillable = 0;
      let totalNonBillable = 0;

      const colors = ['#2196f3', '#4caf50', '#ff9800', '#9c27b0', '#f44336', '#00bcd4'];
      let colorIndex = 0;

      for (const [projectId, projectData] of projectMap) {
        const project = projectData.project;
        const taskCount = projectData.tasks.length;
        const projectHours = projectData.totalHours;

        // Assume 90% billable (placeholder logic)
        const billableHours = projectHours * 0.9;
        const nonBillableHours = projectHours * 0.1;

        totalHours += projectHours;
        totalBillable += billableHours;
        totalNonBillable += nonBillableHours;

        summary.push({
          projectName: project.name,
          totalHours: parseFloat(projectHours.toFixed(2)),
          billableHours: parseFloat(billableHours.toFixed(2)),
          nonBillableHours: parseFloat(nonBillableHours.toFixed(2)),
          tasksCount: taskCount,
          color: colors[colorIndex % colors.length]
        });
        colorIndex++;
      }

      res.json(successResponse({
        summary,
        totals: {
          totalHours: parseFloat(totalHours.toFixed(2)),
          billableHours: parseFloat(totalBillable.toFixed(2)),
          nonBillableHours: parseFloat(totalNonBillable.toFixed(2))
        }
      }));
    } catch (error) {
      console.error('Error fetching time tracking summary:', error);
      res.status(500).json(errorResponse(`Failed to fetch time tracking summary: ${error.message}`, 500));
    }
  };

  /**
   * Get daily time breakdown
   */
  const getDailyTimeBreakdown = async (req, res) => {
    try {
      const userId = req.user.id;

      const breakdown = [];
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);

        const tasksCompleted = await Task.count({
          where: {
            assigned_to: userId,
            status: 'Done',
            completed: true,
            updated_at: {
              [Op.between]: [dayStart, dayEnd]
            },
            deleted_at: null
          }
        });

        // Approximate hours (0.5 hours per task)
        const hours = tasksCompleted * 0.5;
        const billableHours = hours * 0.9;
        const nonBillableHours = hours * 0.1;

        breakdown.push({
          day: days[date.getDay()],
          hours: parseFloat(hours.toFixed(2)),
          billableHours: parseFloat(billableHours.toFixed(2)),
          nonBillableHours: parseFloat(nonBillableHours.toFixed(2))
        });
      }

      res.json(successResponse({ breakdown }));
    } catch (error) {
      console.error('Error fetching daily time breakdown:', error);
      res.status(500).json(errorResponse(`Failed to fetch daily time breakdown: ${error.message}`, 500));
    }
  };

  /**
   * Get time entries (recent task completions as time entries)
   */
  const getTimeEntries = async (req, res) => {
    try {
      const userId = req.user.id;
      const { limit = 50 } = req.query;

      const tasks = await Task.findAll({
        where: {
          assigned_to: userId,
          status: 'Done',
          completed: true,
          deleted_at: null
        },
        include: [
          {
            model: Project,
            as: 'project',
            attributes: ['id', 'name']
          }
        ],
        order: [['updated_at', 'DESC']],
        limit: parseInt(limit)
      });

      const entries = tasks.map(task => {
        const created = new Date(task.created_at);
        const updated = new Date(task.updated_at);
        const hoursDiff = (updated - created) / (1000 * 60 * 60);
        const hours = Math.floor(hoursDiff);
        const minutes = Math.round((hoursDiff - hours) * 60);

        return {
          id: task.id.toString(),
          projectName: task.project?.name || 'Unknown',
          taskName: task.title || 'Untitled Task',
          date: new Date(task.updated_at).toISOString().split('T')[0],
          hours: hours || 0,
          minutes: minutes || 0,
          billable: true, // Default to billable
          description: task.description || null
        };
      });

      res.json(successResponse({ entries }));
    } catch (error) {
      console.error('Error fetching time entries:', error);
      res.status(500).json(errorResponse(`Failed to fetch time entries: ${error.message}`, 500));
    }
  };

  return {
    getProductivityMetrics,
    getProductivityTrends,
    getReportMetrics,
    getTaskStatusAnalytics,
    getProjectPerformance,
    getTeamMetrics,
    getTeamMemberPerformance,
    getTimeTrackingSummary,
    getDailyTimeBreakdown,
    getTimeEntries
  };
};

module.exports = insightsController;

