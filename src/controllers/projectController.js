const { Project, Section, Task, User, ProjectMember, ProjectFavorite, TaskStatus, PriorityLabel, TaskActivityLog, ProjectMessage } = require('../models');
const { Op } = require('sequelize');
const { successResponse, errorResponse } = require('../utils/responseFormatter');
const { formatTaskDate, formatTaskDateTime, formatTaskRelativeTime } = require('../utils/taskHelpers');

const projectController = () => {
  const getDateFormatters = (req) => {
    const timezone = req.app?.locals?.timezone || process.env.APP_TIMEZONE || 'UTC';
    return {
      timezone,
      formatDate: req.formatDate || ((date, format = 'DD MMM YY') => formatTaskDate(date, format, timezone)),
      formatDateTime: req.formatDateTime || ((date, format = 'YYYY-MM-DD HH:mm:ss') => formatTaskDateTime(date, format, timezone)),
      formatRelativeTime: req.formatRelativeTime || ((date) => formatTaskRelativeTime(date, timezone)),
    };
  };

  const formatBoardViewTask = (task, formatters) => {
    if (!task) {
      return null;
    }
    const plain = task.toJSON ? task.toJSON() : task;
    const startDate = plain.start_date || plain.startDate || null;
    const dueDate = plain.due_date || plain.dueDate || null;
    const assignee = plain.assignee || null;
    const priorityLabel = plain.priorityLabel || null;
    const taskStatus = plain.taskStatus || null;

    const initials = assignee?.initials
      || (assignee?.full_name
        ? assignee.full_name
            .split(' ')
            .map(part => part.charAt(0))
            .join('')
            .substring(0, 2)
            .toUpperCase()
        : null);

    return {
      id: plain.id?.toString(),
      sectionId: plain.section_id ? plain.section_id.toString() : null,
      title: plain.title,
      description: plain.description || '',
      completed: !!plain.completed,
      order: typeof plain.position === 'number' ? plain.position : 0,
      startDate,
      startDateDisplay: startDate ? formatters.formatDate(startDate, 'MMM D, YYYY') : null,
      dueDate,
      dueDateDisplay: dueDate ? formatters.formatDate(dueDate, 'MMM D, YYYY') : null,
      dueDateRelative: dueDate ? formatters.formatRelativeTime(dueDate) : null,
      assigneeName: assignee?.full_name || null,
      assigneeInitials: initials,
      assigneeColor: assignee?.avatar_color || null,
      userAvatar: assignee?.avatar_url || null,
      priorityLabel: priorityLabel
        ? {
            id: priorityLabel.id?.toString(),
            name: priorityLabel.name,
            color: priorityLabel.color || null,
          }
        : null,
      status: taskStatus
        ? {
            id: taskStatus.id?.toString(),
            name: taskStatus.name,
            color: taskStatus.color || null,
          }
        : null,
      attachmentCount: plain.attachment_count || null,
    };
  };

  const formatBoardViewSection = (section, formatters) => {
    if (!section) {
      return null;
    }
    const plain = section.toJSON ? section.toJSON() : section;
    const tasks = Array.isArray(plain.tasks) ? plain.tasks : [];
    return {
      id: plain.id?.toString(),
      title: plain.name,
      order: typeof plain.position === 'number' ? plain.position : 0,
      taskCount: tasks.length,
      tasks: tasks
        .map(task => formatBoardViewTask(task, formatters))
        .filter(Boolean),
    };
  };

  const normalizeTaskPositions = async (sectionId, transaction) => {
    if (!sectionId) {
      return;
    }
    const tasks = await Task.findAll({
      where: { section_id: sectionId },
      order: [
        ['position', 'ASC'],
        ['updated_at', 'ASC'],
      ],
      transaction,
    });

    for (let index = 0; index < tasks.length; index += 1) {
      const task = tasks[index];
      if (task.position !== index) {
        await task.update(
          { position: index },
          { transaction, silent: true }
        );
      }
    }
  };

  const reorderProjectSections = async (projectId, sectionId, targetPosition, transaction) => {
    if (!projectId || !sectionId) {
      return;
    }
    const sections = await Section.findAll({
      where: { project_id: projectId },
      order: [
        ['position', 'ASC'],
        ['updated_at', 'ASC'],
      ],
      transaction,
    });

    if (!sections.length) {
      return;
    }

    const movingIndex = sections.findIndex(section => section.id === parseInt(sectionId, 10));
    if (movingIndex === -1) {
      return;
    }

    const [movingSection] = sections.splice(movingIndex, 1);
    const clampedPosition = Math.max(0, Math.min(Number(targetPosition) || 0, sections.length));
    sections.splice(clampedPosition, 0, movingSection);

    for (let index = 0; index < sections.length; index += 1) {
      const section = sections[index];
      if (section.position !== index) {
        await section.update(
          { position: index },
          { transaction, silent: true }
        );
      }
    }
  };

  const boardViewTaskIncludes = [
    {
      model: User,
      as: 'assignee',
      attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'],
      required: false,
    },
    {
      model: TaskStatus,
      as: 'taskStatus',
      attributes: ['id', 'name', 'color'],
      required: false,
    },
    {
      model: PriorityLabel,
      as: 'priorityLabel',
      attributes: ['id', 'name', 'color'],
      required: false,
    },
  ];

  const formatTimelineTask = (task, formatters) => {
    if (!task) {
      return null;
    }

    const plain = task.toJSON ? task.toJSON() : task;
    const startDateValue = plain.start_date || plain.startDate || plain.due_date || plain.created_at || new Date();
    const dueDateValue = plain.due_date || plain.dueDate || startDateValue;
    const assignee = plain.assignee || null;
    const priorityLabel = plain.priorityLabel || null;
    const taskStatus = plain.taskStatus || null;

    const startDate = startDateValue ? formatters.formatDateTime(startDateValue, 'YYYY-MM-DD') : null;
    const dueDate = dueDateValue ? formatters.formatDateTime(dueDateValue, 'YYYY-MM-DD') : null;
    const initials = assignee?.initials
      || (assignee?.full_name
        ? assignee.full_name
            .split(' ')
            .map(part => part.charAt(0))
            .join('')
            .substring(0, 2)
            .toUpperCase()
        : null);

    return {
      id: plain.id?.toString(),
      sectionId: plain.section_id ? plain.section_id.toString() : null,
      title: plain.title,
      description: plain.description || '',
      completed: !!plain.completed,
      order: typeof plain.position === 'number' ? plain.position : 0,
      startDate,
      startDateDisplay: startDateValue ? formatters.formatDate(startDateValue, 'MMM D, YYYY') : null,
      dueDate,
      dueDateDisplay: dueDateValue ? formatters.formatDate(dueDateValue, 'MMM D, YYYY') : null,
      dueDateRelative: dueDateValue ? formatters.formatRelativeTime(dueDateValue) : null,
      assigneeName: assignee?.full_name || null,
      assigneeInitials: initials,
      assigneeColor: assignee?.avatar_color || null,
      userAvatar: assignee?.avatar_url || null,
      priorityLabel: priorityLabel
        ? {
            id: priorityLabel.id?.toString(),
            name: priorityLabel.name,
            color: priorityLabel.color || null,
          }
        : null,
      status: taskStatus
        ? {
            id: taskStatus.id?.toString(),
            name: taskStatus.name,
            color: taskStatus.color || null,
          }
        : null,
    };
  };

  const formatCalendarTask = (task, formatters, fallbackProject = null) => {
    if (!task) {
      return null;
    }

    const plain = task.toJSON ? task.toJSON() : task;
    const assignee = plain.assignee || null;
    const startDateValue = plain.start_date || plain.startDate || plain.due_date || plain.created_at || null;
    const dueDateValue = plain.due_date || plain.dueDate || startDateValue;
    const projectColor = plain.project?.color || fallbackProject?.color || '#3b82f6';
    const initials = assignee?.initials
      || (assignee?.full_name
        ? assignee.full_name
            .split(' ')
            .map(part => part.charAt(0))
            .join('')
            .substring(0, 2)
            .toUpperCase()
        : null);

    return {
      id: plain.id?.toString(),
      title: plain.title,
      completed: !!plain.completed,
      startDate: startDateValue ? formatters.formatDateTime(startDateValue, 'YYYY-MM-DD') : null,
      dueDate: dueDateValue ? formatters.formatDateTime(dueDateValue, 'YYYY-MM-DD') : null,
      projectColor,
      assignee: assignee
        ? {
            id: assignee.id?.toString(),
            name: assignee.full_name,
            initials,
            color: assignee.avatar_color || '#94a3b8',
          }
        : null,
      description: plain.description || '',
      sectionId: plain.section_id ? plain.section_id.toString() : null,
    };
  };

  const normalizeDate = (value) => {
    if (!value) {
      return null;
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    date.setHours(0, 0, 0, 0);
    return date;
  };

  const buildCompletionTrend = (tasks, formatters, rangeDays = 10) => {
    const today = normalizeDate(new Date());
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - (rangeDays - 1));

    const createdMap = new Map();
    const completedMap = new Map();

    tasks.forEach(task => {
      const createdAt = normalizeDate(task.created_at || task.createdAt || task.createdAt);
      if (createdAt && createdAt >= startDate) {
        const key = createdAt.toISOString().slice(0, 10);
        createdMap.set(key, (createdMap.get(key) || 0) + 1);
      }

      if (task.completed) {
        const completedAt = normalizeDate(task.updated_at || task.updatedAt || task.due_date || task.dueDate);
        if (completedAt && completedAt >= startDate) {
          const key = completedAt.toISOString().slice(0, 10);
          completedMap.set(key, (completedMap.get(key) || 0) + 1);
        }
      }
    });

    const data = [];
    const cursor = new Date(startDate);
    let totalCount = 0;
    let completedCount = 0;
    const maxDate = new Date(today);

    while (cursor <= maxDate) {
      const key = cursor.toISOString().slice(0, 10);
      totalCount += createdMap.get(key) || 0;
      completedCount += completedMap.get(key) || 0;
      data.push({
        date: key,
        label: formatters.formatDate(cursor, 'D MMM'),
        total: totalCount,
        completed: completedCount,
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    return {
      start: formatters.formatDate(startDate, 'D MMM'),
      end: formatters.formatDate(maxDate, 'D MMM'),
      data,
    };
  };

  const buildUpcomingByAssignee = (tasks) => {
    const today = normalizeDate(new Date());
    const futureLimit = new Date(today);
    futureLimit.setDate(futureLimit.getDate() + 30);

    const buckets = new Map();
    tasks.forEach(task => {
      if (task.completed || !task.due_date) {
        return;
      }
      const dueDate = normalizeDate(task.due_date);
      if (!dueDate || dueDate < today || dueDate > futureLimit) {
        return;
      }
      const assignee = task.assignee;
      const bucketKey = assignee?.id ? `user-${assignee.id}` : 'unassigned';
      if (!buckets.has(bucketKey)) {
        buckets.set(bucketKey, {
          id: bucketKey,
          name: assignee?.full_name || 'Unassigned',
          initials: assignee?.initials || (assignee?.full_name
            ? assignee.full_name
                .split(' ')
                .map(part => part.charAt(0))
                .join('')
                .substring(0, 2)
                .toUpperCase()
            : 'NA'),
          color: assignee?.avatar_color || '#c4b5fd',
          count: 0,
        });
      }
      buckets.get(bucketKey).count += 1;
    });

    return Array.from(buckets.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  };

  const getDashboardData = async (req, res) => {
    const { projectId } = req.params;
    const formatters = getDateFormatters(req);

    try {
      if (!projectId || Number.isNaN(parseInt(projectId, 10))) {
        return res.status(400).json(errorResponse('Invalid project ID', 400));
      }

      const project = await Project.findByPk(projectId, {
        attributes: ['id', 'name', 'color'],
      });

      if (!project) {
        return res.status(404).json(errorResponse('Project not found', 404));
      }

      const tasks = await Task.findAll({
        where: { project_id: projectId },
        include: [
          {
            model: Section,
            as: 'section',
            attributes: ['id', 'name'],
            required: false,
          },
          {
            model: User,
            as: 'assignee',
            attributes: ['id', 'full_name', 'avatar_color', 'initials'],
            required: false,
          },
        ],
        order: [
          ['created_at', 'ASC'],
        ],
      });

      const totalTasks = tasks.length;
      const completedTasks = tasks.filter(task => !!task.completed).length;
      const incompleteTasks = totalTasks - completedTasks;
      const today = normalizeDate(new Date());
      const overdueTasks = tasks.filter(task =>
        !task.completed &&
        task.due_date &&
        normalizeDate(task.due_date) &&
        normalizeDate(task.due_date) < today
      ).length;

      const statCards = [
        {
          id: 'completed',
          title: 'Total completed tasks',
          value: completedTasks,
          helperText: '1 Filter',
        },
        {
          id: 'incomplete',
          title: 'Total incomplete tasks',
          value: incompleteTasks,
          helperText: '1 Filter',
        },
        {
          id: 'overdue',
          title: 'Total overdue tasks',
          value: overdueTasks,
          helperText: '1 Filter',
        },
        {
          id: 'total',
          title: 'Total tasks',
          value: totalTasks,
          helperText: 'No Filters',
        },
      ];

      const incompleteBySectionMap = new Map();
      tasks.forEach(task => {
        if (task.completed) {
          return;
        }
        const sectionName = task.section?.name || 'Untitled';
        incompleteBySectionMap.set(sectionName, (incompleteBySectionMap.get(sectionName) || 0) + 1);
      });

      const incompleteBySection = Array.from(incompleteBySectionMap.entries())
        .map(([label, value]) => ({
          label,
          value,
        }))
        .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));

      if (!incompleteBySection.length) {
        incompleteBySection.push({ label: 'To do', value: 0 });
      }

      const completionStatus = [
        {
          label: 'Completed',
          value: completedTasks,
          color: '#8b5cf6',
        },
        {
          label: 'Incomplete',
          value: incompleteTasks,
          color: '#d8cffd',
        },
      ];

      const upcomingByAssignee = buildUpcomingByAssignee(tasks);
      const completionTrend = buildCompletionTrend(tasks, formatters, 12);

      return res.json(successResponse({
        project: {
          id: project.id.toString(),
          name: project.name,
          color: project.color || null,
        },
        stats: {
          cards: statCards,
        },
        charts: {
          incompleteBySection: {
            title: 'Total incomplete tasks by section',
            filtersLabel: '2 Filters',
            seeAll: true,
            data: incompleteBySection,
          },
          completionStatus: {
            title: 'Total tasks by completion status',
            filtersLabel: '1 Filter',
            seeAll: true,
            total: totalTasks,
            data: completionStatus,
          },
          upcomingByAssignee: {
            title: 'Total upcoming tasks by assignee',
            filtersLabel: '2 Filters',
            data: upcomingByAssignee,
          },
          completionTrend: {
            title: 'Task completion over time',
            filtersLabel: 'No Filters',
            seeAll: true,
            data: completionTrend,
          },
        },
      }));
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      return res.status(500).json(errorResponse(`Failed to fetch dashboard data: ${error.message}`, 500));
    }
  };

  const determineTimelineBounds = (sections) => {
    let minDate = null;
    let maxDate = null;

    sections.forEach(section => {
      const tasks = Array.isArray(section.tasks) ? section.tasks : [];
      tasks.forEach(task => {
        const taskStart = task.start_date || task.startDate || task.due_date || task.created_at;
        const taskDue = task.due_date || task.dueDate || taskStart;

        if (taskStart) {
          const startTime = new Date(taskStart);
          if (!minDate || startTime < minDate) {
            minDate = startTime;
          }
        }

        if (taskDue) {
          const dueTime = new Date(taskDue);
          if (!maxDate || dueTime > maxDate) {
            maxDate = dueTime;
          }
        }
      });
    });

    const today = new Date();
    if (!minDate) {
      minDate = new Date(today);
      minDate.setDate(minDate.getDate() - 7);
    }

    if (!maxDate) {
      maxDate = new Date(today);
      maxDate.setDate(maxDate.getDate() + 21);
    }

    // Expand range slightly for context
    minDate.setHours(0, 0, 0, 0);
    maxDate.setHours(0, 0, 0, 0);
    minDate.setDate(minDate.getDate() - 2);
    maxDate.setDate(maxDate.getDate() + 7);

    return { minDate, maxDate };
  };

  const buildTimelineDays = (startDate, endDate, formatters) => {
    const days = [];
    const cursor = new Date(startDate);
    const finalDate = new Date(endDate);

    while (cursor <= finalDate) {
      days.push({
        date: formatters.formatDateTime(cursor, 'YYYY-MM-DD'),
        label: formatters.formatDate(cursor, 'MMM D'),
        weekday: formatters.formatDate(cursor, 'ddd'),
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    return days;
  };
  // Get all projects
  const getProjects = async (req, res) => {
    try {
      const userId = req.user.id;
      const { includeArchived } = req.query;

      const whereClause = { deleted_at: null };
      if (includeArchived !== 'true') {
        whereClause.is_archived = false;
      }

      const projects = await Project.findAll({
        where: whereClause,
        include: [
          { model: User, as: 'creator', attributes: ['id', 'full_name', 'email'] },
          { model: Section, as: 'sections' },
        ],
        order: [['created_at', 'DESC']],
      });

      // Check favorites for each project
      const projectIds = projects.map(p => p.id);
      const favorites = await ProjectFavorite.findAll({
        where: { user_id: userId, project_id: { [Op.in]: projectIds } },
      });
      const favoriteMap = new Map(favorites.map(f => [f.project_id, true]));

      const projectsWithFavorites = projects.map(project => ({
        ...project.toJSON(),
        is_favorite: favoriteMap.has(project.id),
      }));

      res.json(successResponse({ projects: projectsWithFavorites }));
    } catch (error) {
      console.error('Error fetching projects:', error);
      res.status(500).json(errorResponse(`Failed to fetch projects: ${error.message}`, 500));
    }
  };

  // Get project by ID
  const getProjectById = async (req, res) => {
    const { projectId } = req.params;
    const userId = req.user.id;

    try {
      if (!projectId || isNaN(parseInt(projectId))) {
        return res.status(400).json(errorResponse('Invalid project ID', 400));
      }

      const project = await Project.findByPk(projectId, {
        include: [
          { model: User, as: 'creator', attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'] },
          { 
            model: Section, 
            as: 'sections', 
            include: [
              { 
                model: Task, 
                as: 'tasks',
                include: [
                  { model: User, as: 'assignee', attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'], required: false },
                  { model: TaskStatus, as: 'taskStatus', required: false },
                  { model: PriorityLabel, as: 'priorityLabel', required: false },
                ]
              }
            ] 
          },
          {
            model: ProjectMember,
            as: 'members',
            include: [
              {
                model: User,
                as: 'user',
                attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'],
              },
            ],
          },
        ],
      });

      if (!project) {
        return res.status(404).json(errorResponse('Project not found', 404));
      }

      const favorite = await ProjectFavorite.findOne({
        where: { user_id: userId, project_id: projectId },
      });

      res.json(successResponse({
        project: {
          ...project.toJSON(),
          is_favorite: !!favorite,
        }
      }));
    } catch (error) {
      console.error('Error fetching project:', error);
      res.status(500).json(errorResponse(`Failed to fetch project: ${error.message}`, 500));
    }
  };

  // Create new project
  const createProject = async (req, res) => {
    const { name, description, color, team_id, status, due_date } = req.body;
    const created_by = req.user.id;

    try {
      if (!name || name.trim().length === 0) {
        return res.status(400).json(errorResponse('Missing params: name is required', 400));
      }

      if (name.length > 255) {
        return res.status(400).json(errorResponse('Project name must be 255 characters or less', 400));
      }

      if (status && !['not-started', 'in-progress', 'on-hold', 'completed'].includes(status)) {
        return res.status(400).json(errorResponse('Invalid project status', 400));
      }

      if (color && color.length > 20) {
        return res.status(400).json(errorResponse('Color must be 20 characters or less', 400));
      }

      const project = await Project.create({
        name,
        description,
        color,
        team_id,
        created_by,
        status: status || 'not-started',
        due_date,
        is_archived: false,
      });

      // Create welcome message
      try {
        await ProjectMessage.create({
          project_id: project.id,
          author_id: created_by,
          content: 'Welcome to the project! Use this space for updates.',
          pinned: false,
        });
      } catch (msgError) {
        // Log but don't fail project creation if message creation fails
        console.warn('Failed to create welcome message:', msgError);
      }

      const projectWithRelations = await Project.findByPk(project.id, {
        include: [
          { model: User, as: 'creator', attributes: ['id', 'full_name', 'email'] },
        ],
      });

      res.status(201).json(successResponse({ project: projectWithRelations }, 'Project created successfully'));
    } catch (error) {
      console.error('Error creating project:', error);
      res.status(500).json(errorResponse(`Failed to create project: ${error.message}`, 500));
    }
  };

  // Update project
  const updateProject = async (req, res) => {
    const { projectId } = req.params;
    const updateData = req.body;

    try {
      if (!projectId || isNaN(parseInt(projectId))) {
        return res.status(400).json(errorResponse('Invalid project ID', 400));
      }

      if (updateData.name !== undefined && (!updateData.name || updateData.name.trim().length === 0)) {
        return res.status(400).json(errorResponse('Project name cannot be empty', 400));
      }

      if (updateData.name && updateData.name.length > 255) {
        return res.status(400).json(errorResponse('Project name must be 255 characters or less', 400));
      }

      if (updateData.status && !['not-started', 'in-progress', 'on-hold', 'completed'].includes(updateData.status)) {
        return res.status(400).json(errorResponse('Invalid project status', 400));
      }

      if (updateData.color && updateData.color.length > 20) {
        return res.status(400).json(errorResponse('Color must be 20 characters or less', 400));
      }

      const project = await Project.findByPk(projectId);
      if (!project) {
        return res.status(404).json(errorResponse('Project not found', 404));
      }

      await project.update(updateData);

      const updatedProject = await Project.findByPk(projectId, {
        include: [
          { model: User, as: 'creator', attributes: ['id', 'full_name', 'email'] },
        ],
      });

      res.json(successResponse({ project: updatedProject }, 'Project updated successfully'));
    } catch (error) {
      console.error('Error updating project:', error);
      res.status(500).json(errorResponse(`Failed to update project: ${error.message}`, 500));
    }
  };

  // Delete project (soft delete)
  const deleteProject = async (req, res) => {
    const { projectId } = req.params;

    try {
      if (!projectId || isNaN(parseInt(projectId))) {
        return res.status(400).json(errorResponse('Invalid project ID', 400));
      }

      const project = await Project.findByPk(projectId);
      if (!project) {
        return res.status(404).json(errorResponse('Project not found', 404));
      }

      await project.destroy();
      res.json(successResponse(null, 'Project deleted successfully'));
    } catch (error) {
      console.error('Error deleting project:', error);
      res.status(500).json(errorResponse(`Failed to delete project: ${error.message}`, 500));
    }
  };

  // Toggle project favorite
  const toggleProjectFavorite = async (req, res) => {
    const { projectId } = req.params;
    const userId = req.user.id;

    try {
      if (!projectId || isNaN(parseInt(projectId))) {
        return res.status(400).json(errorResponse('Invalid project ID', 400));
      }

      const favorite = await ProjectFavorite.findOne({
        where: { user_id: userId, project_id: projectId },
      });

      if (favorite) {
        await favorite.destroy();
        res.json(successResponse({ is_favorite: false }, 'Project unfavorited'));
      } else {
        await ProjectFavorite.create({
          user_id: userId,
          project_id: projectId,
        });
        res.json(successResponse({ is_favorite: true }, 'Project favorited'));
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      res.status(500).json(errorResponse(`Failed to toggle favorite: ${error.message}`, 500));
    }
  };

  // Add member to project
  const addProjectMember = async (req, res) => {
    const { projectId } = req.params;
    const { user_id, role = 'member' } = req.body;

    try {
      if (!projectId || isNaN(parseInt(projectId))) {
        return res.status(400).json(errorResponse('Invalid project ID', 400));
      }

      if (!user_id || isNaN(parseInt(user_id))) {
        return res.status(400).json(errorResponse('Missing params: user_id is required', 400));
      }

      // Check if project exists
      const project = await Project.findByPk(projectId);
      if (!project) {
        return res.status(404).json(errorResponse('Project not found', 404));
      }

      // Check if user exists
      const user = await User.findByPk(user_id);
      if (!user) {
        return res.status(404).json(errorResponse('User not found', 404));
      }

      // Check if already a member
      const existingMember = await ProjectMember.findOne({
        where: { project_id: projectId, user_id },
      });

      if (existingMember) {
        return res.status(409).json(errorResponse('User is already a member of this project', 409));
      }

      // Add member
      const member = await ProjectMember.create({
        project_id: projectId,
        user_id,
        role,
      });

      // Fetch member with user details
      const memberWithUser = await ProjectMember.findByPk(member.id, {
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'],
          },
        ],
      });

      res.status(201).json(successResponse({ member: memberWithUser }, 'Member added successfully'));
    } catch (error) {
      console.error('Error adding project member:', error);
      res.status(500).json(errorResponse(`Failed to add member: ${error.message}`, 500));
    }
  };

  // Remove member from project
  const removeProjectMember = async (req, res) => {
    const { projectId, memberId } = req.params;

    try {
      if (!projectId || isNaN(parseInt(projectId))) {
        return res.status(400).json(errorResponse('Invalid project ID', 400));
      }

      if (!memberId || isNaN(parseInt(memberId))) {
        return res.status(400).json(errorResponse('Invalid member ID', 400));
      }

      // Check if project exists
      const project = await Project.findByPk(projectId);
      if (!project) {
        return res.status(404).json(errorResponse('Project not found', 404));
      }

      // Find and remove member
      const member = await ProjectMember.findOne({
        where: { project_id: projectId, user_id: memberId },
      });

      if (!member) {
        return res.status(404).json(errorResponse('Member not found in this project', 404));
      }

      // Prevent removing project creator
      if (project.created_by === parseInt(memberId)) {
        return res.status(403).json(errorResponse('Cannot remove project creator', 403));
      }

      await member.destroy();
      res.json(successResponse(null, 'Member removed successfully'));
    } catch (error) {
      console.error('Error removing project member:', error);
      res.status(500).json(errorResponse(`Failed to remove member: ${error.message}`, 500));
    }
  };

  // Get project activities for overview
  const getProjectActivities = async (req, res) => {
    const { projectId } = req.params;
    const { limit = 50 } = req.query;

    try {
      if (!projectId || isNaN(parseInt(projectId))) {
        return res.status(400).json(errorResponse('Invalid project ID', 400));
      }

      // Check if project exists
      const project = await Project.findByPk(projectId);
      if (!project) {
        return res.status(404).json(errorResponse('Project not found', 404));
      }

      // Get recent activities for this project
      const activities = await TaskActivityLog.findAll({
        where: { project_id: projectId },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'full_name', 'initials', 'avatar_color'],
            required: false,
          },
          {
            model: Task,
            as: 'task',
            attributes: ['id', 'title'],
            required: false,
          },
        ],
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
      });

      // Format activities for frontend
      const formattedActivities = activities.map((activity) => {
        const user = activity.user;
        const task = activity.task;
        
        // Determine activity icon and type
        let icon = 'info';
        let type = 'update';
        
        switch (activity.activity_type) {
          case 'created':
            icon = 'add_circle';
            type = 'create';
            break;
          case 'completed':
            icon = 'check_circle';
            type = 'status';
            break;
          case 'assigned':
            icon = 'person_add';
            type = 'assign';
            break;
          case 'status_changed':
            icon = 'swap_horiz';
            type = 'status';
            break;
          case 'priority_changed':
            icon = 'flag';
            type = 'status';
            break;
          case 'comment':
            icon = 'comment';
            type = 'comment';
            break;
          default:
            icon = 'edit';
            type = 'update';
        }

        // Format message
        let message = activity.description;
        if (task) {
          message = message.replace(task.title, `<strong>${task.title}</strong>`);
        }

        // Format time (relative or absolute)
        const createdAt = new Date(activity.created_at);
        const now = new Date();
        const diffMs = now - createdAt;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        let timeStr = '';
        if (diffMins < 1) {
          timeStr = 'Just now';
        } else if (diffMins < 60) {
          timeStr = `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
        } else if (diffHours < 24) {
          timeStr = `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
        } else if (diffDays < 7) {
          timeStr = `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
        } else {
          timeStr = createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: createdAt.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
        }

        return {
          id: activity.id.toString(),
          type,
          icon,
          message,
          userInitials: user?.initials || 'U',
          userColor: user?.avatar_color || '#6b7280',
          time: timeStr,
        };
      });

      res.json(successResponse({ activities: formattedActivities }));
    } catch (error) {
      console.error('Error fetching project activities:', error);
      res.status(500).json(errorResponse(`Failed to fetch activities: ${error.message}`, 500));
    }
  };

  const getBoardViewData = async (req, res) => {
    const { projectId } = req.params;
    const formatters = getDateFormatters(req);

    try {
      if (!projectId || isNaN(parseInt(projectId, 10))) {
        return res.status(400).json(errorResponse('Invalid project ID', 400));
      }

      const project = await Project.findByPk(projectId, {
        attributes: ['id', 'name', 'color'],
      });

      if (!project) {
        return res.status(404).json(errorResponse('Project not found', 404));
      }

      const sections = await Section.findAll({
        where: { project_id: projectId },
        include: [
          {
            model: Task,
            as: 'tasks',
            include: boardViewTaskIncludes,
            required: false,
          },
        ],
        order: [
          ['position', 'ASC'],
          [{ model: Task, as: 'tasks' }, 'position', 'ASC'],
          [{ model: Task, as: 'tasks' }, 'updated_at', 'ASC'],
        ],
      });

      const columns = sections
        .map(section => formatBoardViewSection(section, formatters))
        .filter(Boolean);

      return res.json(successResponse({
        project: {
          id: project.id.toString(),
          name: project.name,
          color: project.color || null,
        },
        columns,
      }));
    } catch (error) {
      console.error('Error fetching board view data:', error);
      return res.status(500).json(errorResponse(`Failed to fetch board view data: ${error.message}`, 500));
    }
  };

  const updateBoardViewTask = async (req, res) => {
    const { taskId } = req.params;
    const { target_section_id: targetSectionIdRaw, target_position: targetPositionRaw } = req.body || {};

    if (!taskId || isNaN(parseInt(taskId, 10))) {
      return res.status(400).json(errorResponse('Invalid task ID', 400));
    }

    try {
      const task = await Task.findByPk(taskId);
      if (!task) {
        return res.status(404).json(errorResponse('Task not found', 404));
      }

      const targetSectionId = targetSectionIdRaw !== undefined
        ? parseInt(targetSectionIdRaw, 10)
        : task.section_id;

      if (!targetSectionId || Number.isNaN(targetSectionId)) {
        return res.status(400).json(errorResponse('A valid target section ID is required', 400));
      }

      const section = await Section.findOne({
        where: { id: targetSectionId, project_id: task.project_id },
      });

      if (!section) {
        return res.status(404).json(errorResponse('Target section not found in this project', 404));
      }

      const transaction = await Task.sequelize.transaction();
      const formatters = getDateFormatters(req);

      try {
        const previousSectionId = task.section_id;
        const parsedTargetPosition = targetPositionRaw !== undefined ? parseInt(targetPositionRaw, 10) : undefined;
        const safePosition = Number.isInteger(parsedTargetPosition)
          ? Math.max(0, parsedTargetPosition)
          : Number.MAX_SAFE_INTEGER;

        await task.update(
          {
            section_id: targetSectionId,
            position: safePosition,
          },
          { transaction }
        );

        await normalizeTaskPositions(targetSectionId, transaction);
        if (previousSectionId && previousSectionId !== targetSectionId) {
          await normalizeTaskPositions(previousSectionId, transaction);
        }

        const updatedTask = await Task.findByPk(taskId, {
          include: boardViewTaskIncludes,
          transaction,
        });

        await transaction.commit();

        return res.json(successResponse({
          task: formatBoardViewTask(updatedTask, formatters),
        }, 'Board view task updated successfully'));
      } catch (error) {
        await transaction.rollback();
        console.error('Error updating board view task:', error);
        return res.status(500).json(errorResponse(`Failed to update board view task: ${error.message}`, 500));
      }
    } catch (error) {
      console.error('Error updating board view task:', error);
      return res.status(500).json(errorResponse(`Failed to update board view task: ${error.message}`, 500));
    }
  };

  const createBoardViewSection = async (req, res) => {
    const { projectId } = req.params;
    const { name } = req.body || {};
    const formatters = getDateFormatters(req);

    try {
      if (!projectId || isNaN(parseInt(projectId, 10))) {
        return res.status(400).json(errorResponse('Invalid project ID', 400));
      }

      if (!name || !name.trim()) {
        return res.status(400).json(errorResponse('Section name is required', 400));
      }

      const project = await Project.findByPk(projectId);
      if (!project) {
        return res.status(404).json(errorResponse('Project not found', 404));
      }

      const maxPosition = await Section.max('position', { where: { project_id: projectId } });
      const section = await Section.create({
        project_id: projectId,
        name: name.trim(),
        position: Number.isInteger(maxPosition) ? maxPosition + 1 : 0,
      });

      const sectionWithTasks = await Section.findByPk(section.id, {
        include: [
          {
            model: Task,
            as: 'tasks',
            include: boardViewTaskIncludes,
            required: false,
          },
        ],
      });

      return res.status(201).json(successResponse({
        section: formatBoardViewSection(sectionWithTasks, formatters),
      }, 'Board view section created successfully'));
    } catch (error) {
      console.error('Error creating board view section:', error);
      return res.status(500).json(errorResponse(`Failed to create board view section: ${error.message}`, 500));
    }
  };

  const updateBoardViewSection = async (req, res) => {
    const { sectionId } = req.params;
    const { name, order } = req.body || {};
    const formatters = getDateFormatters(req);

    if (!sectionId || isNaN(parseInt(sectionId, 10))) {
      return res.status(400).json(errorResponse('Invalid section ID', 400));
    }

    try {
      const section = await Section.findByPk(sectionId);
      if (!section) {
        return res.status(404).json(errorResponse('Section not found', 404));
      }

      const transaction = await Section.sequelize.transaction();

      try {
        if (name !== undefined) {
          if (!name || !name.trim()) {
            await transaction.rollback();
            return res.status(400).json(errorResponse('Section name cannot be empty', 400));
          }
          await section.update({ name: name.trim() }, { transaction });
        }

        if (order !== undefined) {
          await reorderProjectSections(section.project_id, section.id, Number(order), transaction);
        }

        const updatedSection = await Section.findByPk(sectionId, {
          include: [
            {
              model: Task,
              as: 'tasks',
              include: boardViewTaskIncludes,
              required: false,
            },
          ],
          transaction,
        });

        await transaction.commit();

        return res.json(successResponse({
          section: formatBoardViewSection(updatedSection, formatters),
        }, 'Board view section updated successfully'));
      } catch (error) {
        await transaction.rollback();
        console.error('Error updating board view section:', error);
        return res.status(500).json(errorResponse(`Failed to update board view section: ${error.message}`, 500));
      }
    } catch (error) {
      console.error('Error updating board view section:', error);
      return res.status(500).json(errorResponse(`Failed to update board view section: ${error.message}`, 500));
    }
  };

  const getTimelineViewData = async (req, res) => {
    const { projectId } = req.params;
    const formatters = getDateFormatters(req);

    try {
      if (!projectId || isNaN(parseInt(projectId, 10))) {
        return res.status(400).json(errorResponse('Invalid project ID', 400));
      }

      const project = await Project.findByPk(projectId, {
        attributes: ['id', 'name', 'color'],
      });

      if (!project) {
        return res.status(404).json(errorResponse('Project not found', 404));
      }

      const sections = await Section.findAll({
        where: { project_id: projectId },
        include: [
          {
            model: Task,
            as: 'tasks',
            include: boardViewTaskIncludes,
            required: false,
          },
        ],
        order: [
          ['position', 'ASC'],
          [{ model: Task, as: 'tasks' }, 'position', 'ASC'],
          [{ model: Task, as: 'tasks' }, 'updated_at', 'ASC'],
        ],
      });

      const { minDate, maxDate } = determineTimelineBounds(sections);
      const timelineDays = buildTimelineDays(minDate, maxDate, formatters);

      const groups = sections.map((section) => {
        const formatted = formatBoardViewSection(section, formatters);
        return {
          id: formatted?.id || section.id?.toString(),
          title: formatted?.title || section.name,
          order: formatted?.order ?? (section.position || 0),
          taskCount: formatted?.taskCount || (section.tasks?.length || 0),
          tasks: (section.tasks || [])
            .map((task) => formatTimelineTask(task, formatters))
            .filter(Boolean),
        };
      });

      return res.json(successResponse({
        project: {
          id: project.id.toString(),
          name: project.name,
          color: project.color || null,
        },
        timeline: {
          startDate: formatters.formatDateTime(minDate, 'YYYY-MM-DD'),
          endDate: formatters.formatDateTime(maxDate, 'YYYY-MM-DD'),
          dayCount: timelineDays.length,
          days: timelineDays,
        },
        groups,
      }));
    } catch (error) {
      console.error('Error fetching timeline view data:', error);
      return res.status(500).json(errorResponse(`Failed to fetch timeline view data: ${error.message}`, 500));
    }
  };

  const updateTimelineViewTask = async (req, res) => {
    const { taskId } = req.params;
    const { start_date, due_date, target_section_id: targetSectionIdRaw } = req.body || {};

    try {
      if (!taskId || isNaN(parseInt(taskId, 10))) {
        return res.status(400).json(errorResponse('Invalid task ID', 400));
      }

      const task = await Task.findByPk(taskId);
      if (!task) {
        return res.status(404).json(errorResponse('Task not found', 404));
      }

      const updates = {};

      if (start_date !== undefined) {
        if (start_date && Number.isNaN(Date.parse(start_date))) {
          return res.status(400).json(errorResponse('Invalid start date', 400));
        }
        updates.start_date = start_date || null;
      }

      if (due_date !== undefined) {
        if (due_date && Number.isNaN(Date.parse(due_date))) {
          return res.status(400).json(errorResponse('Invalid due date', 400));
        }
        updates.due_date = due_date || null;
      }

      if (updates.start_date && updates.due_date && new Date(updates.start_date) > new Date(updates.due_date)) {
        return res.status(400).json(errorResponse('Start date cannot be after due date', 400));
      }

      if (targetSectionIdRaw !== undefined && targetSectionIdRaw !== null) {
        const parsedSectionId = parseInt(targetSectionIdRaw, 10);
        if (Number.isNaN(parsedSectionId)) {
          return res.status(400).json(errorResponse('Invalid section ID', 400));
        }
        const section = await Section.findOne({
          where: { id: parsedSectionId, project_id: task.project_id },
        });
        if (!section) {
          return res.status(404).json(errorResponse('Section not found in this project', 404));
        }
        updates.section_id = parsedSectionId;
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json(errorResponse('No valid fields provided to update', 400));
      }

      await task.update(updates);

      const updatedTask = await Task.findByPk(taskId, {
        include: boardViewTaskIncludes,
      });

      return res.json(successResponse({
        task: formatTimelineTask(updatedTask, getDateFormatters(req)),
      }, 'Timeline task updated successfully'));
    } catch (error) {
      console.error('Error updating timeline view task:', error);
      return res.status(500).json(errorResponse(`Failed to update timeline view task: ${error.message}`, 500));
    }
  };

  const getCalendarViewData = async (req, res) => {
    const { projectId } = req.params;
    const formatters = getDateFormatters(req);

    try {
      if (!projectId || isNaN(parseInt(projectId, 10))) {
        return res.status(400).json(errorResponse('Invalid project ID', 400));
      }

      const project = await Project.findByPk(projectId, {
        attributes: ['id', 'name', 'color'],
      });

      if (!project) {
        return res.status(404).json(errorResponse('Project not found', 404));
      }

      const tasks = await Task.findAll({
        where: { project_id: projectId },
        include: [
          {
            model: User,
            as: 'assignee',
            attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'],
            required: false,
          },
          {
            model: Project,
            as: 'project',
            attributes: ['id', 'name', 'color'],
            required: false,
          },
        ],
        order: [
          ['due_date', 'ASC'],
          ['start_date', 'ASC'],
          ['updated_at', 'DESC'],
        ],
      });

      const calendarTasks = tasks
        .map(task => formatCalendarTask(task, formatters, project))
        .filter(Boolean);

      return res.json(successResponse({
        project: {
          id: project.id.toString(),
          name: project.name,
          color: project.color || null,
        },
        tasks: calendarTasks,
      }));
    } catch (error) {
      console.error('Error fetching calendar view data:', error);
      return res.status(500).json(errorResponse(`Failed to fetch calendar data: ${error.message}`, 500));
    }
  };

  const updateCalendarTask = async (req, res) => {
    const { taskId } = req.params;
    const { startDate, dueDate } = req.body || {};

    try {
      if (!taskId || isNaN(parseInt(taskId, 10))) {
        return res.status(400).json(errorResponse('Invalid task ID', 400));
      }

      const task = await Task.findByPk(taskId);
      if (!task) {
        return res.status(404).json(errorResponse('Task not found', 404));
      }

      const updates = {};

      if (startDate !== undefined) {
        if (startDate && Number.isNaN(Date.parse(startDate))) {
          return res.status(400).json(errorResponse('Invalid start date', 400));
        }
        updates.start_date = startDate || null;
      }

      if (dueDate !== undefined) {
        if (dueDate && Number.isNaN(Date.parse(dueDate))) {
          return res.status(400).json(errorResponse('Invalid due date', 400));
        }
        updates.due_date = dueDate || null;
      }

      const startValue = updates.start_date ?? task.start_date ?? updates.due_date ?? task.due_date;
      const endValue = updates.due_date ?? task.due_date ?? updates.start_date ?? task.start_date;

      if (startValue && endValue && new Date(startValue) > new Date(endValue)) {
        return res.status(400).json(errorResponse('Start date cannot be after due date', 400));
      }

      await task.update(updates);

      const updatedTask = await Task.findByPk(taskId, {
        include: [
          {
            model: User,
            as: 'assignee',
            attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'],
            required: false,
          },
          {
            model: Project,
            as: 'project',
            attributes: ['id', 'name', 'color'],
            required: false,
          },
        ],
      });

      return res.json(successResponse({
        task: formatCalendarTask(updatedTask, getDateFormatters(req), updatedTask?.project),
      }, 'Calendar task updated successfully'));
    } catch (error) {
      console.error('Error updating calendar task:', error);
      return res.status(500).json(errorResponse(`Failed to update calendar task: ${error.message}`, 500));
    }
  };

  // Get project overview data
  const getProjectOverview = async (req, res) => {
    const { projectId } = req.params;
    const userId = req.user.id;
    const formatDate = req.formatDate || ((date) => date);
    const formatDateTime = req.formatDateTime || ((date) => date);
    const formatRelativeTime = req.formatRelativeTime || ((date) => date);
    const timezone = req.app?.locals?.timezone || 'UTC';

    try {
      if (!projectId || isNaN(parseInt(projectId))) {
        return res.status(400).json(errorResponse('Invalid project ID', 400));
      }

      // Get project with all necessary data
      const project = await Project.findByPk(projectId, {
        include: [
          {
            model: ProjectMember,
            as: 'members',
            include: [
              {
                model: User,
                as: 'user',
                attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'],
              },
            ],
          },
        ],
      });

      if (!project) {
        return res.status(404).json(errorResponse('Project not found', 404));
      }

      // Format members for frontend
      const members = (project.members || []).map((member) => ({
        id: member.user.id.toString(),
        name: member.user.full_name,
        initials: member.user.initials || member.user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2),
        color: member.user.avatar_color || '#6b7280',
        role: member.role || 'member',
      }));

      // Get recent activities
      const activities = await TaskActivityLog.findAll({
        where: { project_id: projectId },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'full_name', 'initials', 'avatar_color'],
            required: false,
          },
          {
            model: Task,
            as: 'task',
            attributes: ['id', 'title'],
            required: false,
          },
        ],
        order: [['created_at', 'DESC']],
        limit: 50,
      });

      // Format activities
      const formattedActivities = activities.map((activity) => {
        const user = activity.user;
        const task = activity.task;
        
        let icon = 'info';
        let type = 'update';
        
        switch (activity.activity_type) {
          case 'created':
            icon = 'add_circle';
            type = 'create';
            break;
          case 'completed':
            icon = 'check_circle';
            type = 'status';
            break;
          case 'assigned':
            icon = 'person_add';
            type = 'assign';
            break;
          case 'status_changed':
            icon = 'swap_horiz';
            type = 'status';
            break;
          case 'priority_changed':
            icon = 'flag';
            type = 'status';
            break;
          case 'comment':
            icon = 'comment';
            type = 'comment';
            break;
          default:
            icon = 'edit';
            type = 'update';
        }

        let message = activity.description;
        if (task) {
          message = message.replace(task.title, `<strong>${task.title}</strong>`);
        }

        const timeAbsolute =
          activity.created_at
            ? formatDateTime(activity.created_at, 'YYYY-MM-DD HH:mm:ss')
            : null;
        const timeRelative =
          formatRelativeTime(activity.created_at) || 'Just now';

        return {
          id: activity.id.toString(),
          type,
          icon,
          message,
          userInitials: user?.initials || 'U',
          userColor: user?.avatar_color || '#6b7280',
          time: timeRelative,
          timeAbsolute,
        };
      });

      // Get project health status (on-track, at-risk, off-track)
      const healthStatus = project.health_status || 'on-track';
      const dueDateRaw = project.due_date || null;
      const dueDateISO = dueDateRaw
        ? formatDateTime(project.due_date, 'YYYY-MM-DD')
        : null;
      const dueDateDisplay = dueDateRaw
        ? formatDate(project.due_date, 'MMM D, YYYY')
        : null;
      const dueDateRelative = dueDateRaw
        ? formatRelativeTime(project.due_date)
        : null;

      res.json(successResponse({
        description: project.description || '',
        members,
        status: healthStatus, // 'on-track' | 'at-risk' | 'off-track'
        dueDate: dueDateRaw,
        dueDateISO,
        dueDateDisplay,
        dueDateRelative,
        timezone,
        activities: formattedActivities,
      }));
    } catch (error) {
      console.error('Error fetching project overview:', error);
      res.status(500).json(errorResponse(`Failed to fetch project overview: ${error.message}`, 500));
    }
  };

  // Update project overview data
  const updateProjectOverview = async (req, res) => {
    const { projectId } = req.params;
    const { description, health_status, due_date } = req.body;

    try {
      if (!projectId || isNaN(parseInt(projectId))) {
        return res.status(400).json(errorResponse('Invalid project ID', 400));
      }

      // Validate health_status if provided
      if (health_status && !['on-track', 'at-risk', 'off-track'].includes(health_status)) {
        return res.status(400).json(errorResponse('Invalid health status. Must be: on-track, at-risk, or off-track', 400));
      }

      const project = await Project.findByPk(projectId);
      if (!project) {
        return res.status(404).json(errorResponse('Project not found', 404));
      }

      // Build update data
      const updateData = {};
      if (description !== undefined) {
        updateData.description = description;
      }
      if (health_status !== undefined) {
        updateData.health_status = health_status;
      }
      if (due_date !== undefined) {
        updateData.due_date = due_date || null;
      }

      await project.update(updateData);

      const updatedProject = await Project.findByPk(projectId, {
        include: [
          {
            model: ProjectMember,
            as: 'members',
            include: [
              {
                model: User,
                as: 'user',
                attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'],
              },
            ],
          },
        ],
      });

      // Format response
      const members = (updatedProject.members || []).map((member) => ({
        id: member.user.id.toString(),
        name: member.user.full_name,
        initials: member.user.initials || member.user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2),
        color: member.user.avatar_color || '#6b7280',
        role: member.role || 'member',
      }));

      res.json(successResponse({
        description: updatedProject.description || '',
        members,
        status: updatedProject.health_status || 'on-track',
        dueDate: updatedProject.due_date || null,
      }, 'Project overview updated successfully'));
    } catch (error) {
      console.error('Error updating project overview:', error);
      res.status(500).json(errorResponse(`Failed to update project overview: ${error.message}`, 500));
    }
  };

  // Create a new project message
  const createMessage = async (req, res) => {
    const { projectId } = req.params;
    const { content } = req.body;
    const authorId = req.user.id;

    try {
      if (!projectId || isNaN(parseInt(projectId, 10))) {
        return res.status(400).json(errorResponse('Invalid project ID', 400));
      }

      if (!content || !content.trim()) {
        return res.status(400).json(errorResponse('Message content is required', 400));
      }

      // Check if project exists
      const project = await Project.findByPk(projectId);
      if (!project) {
        return res.status(404).json(errorResponse('Project not found', 404));
      }

      // Check if user is a project member
      const isMember = await ProjectMember.findOne({
        where: { project_id: projectId, user_id: authorId },
      });

      if (!isMember && project.created_by !== authorId) {
        return res.status(403).json(errorResponse('Only project members can post messages', 403));
      }

      const message = await ProjectMessage.create({
        project_id: parseInt(projectId, 10),
        author_id: authorId,
        content: content.trim(),
        pinned: false,
      });

      const messageWithAuthor = await ProjectMessage.findByPk(message.id, {
        include: [
          {
            model: User,
            as: 'author',
            attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'],
          },
        ],
      });

      const formatted = formatProjectMessage(messageWithAuthor);

      res.status(201).json(successResponse({ message: formatted }, 'Message created successfully'));
    } catch (error) {
      console.error('Error creating message:', error);
      res.status(500).json(errorResponse(`Failed to create message: ${error.message}`, 500));
    }
  };

  // Get project messages (paginated)
  const getMessages = async (req, res) => {
    const { projectId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const offset = (pageNum - 1) * limitNum;

    try {
      if (!projectId || isNaN(parseInt(projectId, 10))) {
        return res.status(400).json(errorResponse('Invalid project ID', 400));
      }

      // Check if project exists
      const project = await Project.findByPk(projectId);
      if (!project) {
        return res.status(404).json(errorResponse('Project not found', 404));
      }

      const { count, rows } = await ProjectMessage.findAndCountAll({
        where: { project_id: projectId },
        include: [
          {
            model: User,
            as: 'author',
            attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'],
          },
        ],
        order: [
          ['pinned', 'DESC'],
          ['created_at', 'DESC'],
        ],
        limit: limitNum,
        offset,
      });

      const messages = rows.map(msg => formatProjectMessage(msg));

      res.json(successResponse({
        messages,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: count,
          totalPages: Math.ceil(count / limitNum),
        },
      }));
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json(errorResponse(`Failed to fetch messages: ${error.message}`, 500));
    }
  };

  // Update a project message
  const updateMessage = async (req, res) => {
    const { messageId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    try {
      if (!messageId || isNaN(parseInt(messageId, 10))) {
        return res.status(400).json(errorResponse('Invalid message ID', 400));
      }

      if (!content || !content.trim()) {
        return res.status(400).json(errorResponse('Message content is required', 400));
      }

      const message = await ProjectMessage.findByPk(messageId);
      if (!message) {
        return res.status(404).json(errorResponse('Message not found', 404));
      }

      // Check if user is author or project admin
      const project = await Project.findByPk(message.project_id);
      const isAuthor = message.author_id === userId;
      const isAdmin = project?.created_by === userId;

      if (!isAuthor && !isAdmin) {
        return res.status(403).json(errorResponse('Only the author or project admin can edit messages', 403));
      }

      await message.update({ content: content.trim() });

      const updatedMessage = await ProjectMessage.findByPk(messageId, {
        include: [
          {
            model: User,
            as: 'author',
            attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'],
          },
        ],
      });

      res.json(successResponse({ message: formatProjectMessage(updatedMessage) }, 'Message updated successfully'));
    } catch (error) {
      console.error('Error updating message:', error);
      res.status(500).json(errorResponse(`Failed to update message: ${error.message}`, 500));
    }
  };

  // Pin/unpin a project message
  const pinMessage = async (req, res) => {
    const { messageId } = req.params;
    const userId = req.user.id;

    try {
      if (!messageId || isNaN(parseInt(messageId, 10))) {
        return res.status(400).json(errorResponse('Invalid message ID', 400));
      }

      const message = await ProjectMessage.findByPk(messageId);
      if (!message) {
        return res.status(404).json(errorResponse('Message not found', 404));
      }

      // Check if user is project admin
      const project = await Project.findByPk(message.project_id);
      const isAdmin = project?.created_by === userId;

      if (!isAdmin) {
        return res.status(403).json(errorResponse('Only project admin can pin messages', 403));
      }

      await message.update({ pinned: !message.pinned });

      const updatedMessage = await ProjectMessage.findByPk(messageId, {
        include: [
          {
            model: User,
            as: 'author',
            attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'],
          },
        ],
      });

      res.json(successResponse({ message: formatProjectMessage(updatedMessage) }, 'Message pin status updated'));
    } catch (error) {
      console.error('Error pinning message:', error);
      res.status(500).json(errorResponse(`Failed to pin message: ${error.message}`, 500));
    }
  };

  // Delete a project message (soft delete)
  const deleteMessage = async (req, res) => {
    const { messageId } = req.params;
    const userId = req.user.id;

    try {
      if (!messageId || isNaN(parseInt(messageId, 10))) {
        return res.status(400).json(errorResponse('Invalid message ID', 400));
      }

      const message = await ProjectMessage.findByPk(messageId);
      if (!message) {
        return res.status(404).json(errorResponse('Message not found', 404));
      }

      // Check if user is author or project admin
      const project = await Project.findByPk(message.project_id);
      const isAuthor = message.author_id === userId;
      const isAdmin = project?.created_by === userId;

      if (!isAuthor && !isAdmin) {
        return res.status(403).json(errorResponse('Only the author or project admin can delete messages', 403));
      }

      await message.destroy();

      res.json(successResponse(null, 'Message deleted successfully'));
    } catch (error) {
      console.error('Error deleting message:', error);
      res.status(500).json(errorResponse(`Failed to delete message: ${error.message}`, 500));
    }
  };

  // Helper to format project message for response
  const formatProjectMessage = (message) => {
    if (!message) {
      return null;
    }

    const plain = message.toJSON ? message.toJSON() : message;
    const author = plain.author || null;

    return {
      id: plain.id?.toString(),
      content: plain.content,
      pinned: !!plain.pinned,
      createdAt: plain.created_at || plain.createdAt,
      updatedAt: plain.updated_at || plain.updatedAt,
      author: author
        ? {
            id: author.id?.toString(),
            fullName: author.full_name,
            email: author.email,
            avatarUrl: author.avatar_url || null,
            avatarColor: author.avatar_color || null,
            initials: author.initials || null,
          }
        : null,
    };
  };

  return {
    getProjects,
    getProjectById,
    createProject,
    updateProject,
    deleteProject,
    toggleProjectFavorite,
    addProjectMember,
    removeProjectMember,
    getProjectActivities,
    getBoardViewData,
    updateBoardViewTask,
    createBoardViewSection,
    updateBoardViewSection,
    getCalendarViewData,
    updateCalendarTask,
    getDashboardData,
    getTimelineViewData,
    updateTimelineViewTask,
    getProjectOverview,
    updateProjectOverview,
    createMessage,
    getMessages,
    updateMessage,
    pinMessage,
    deleteMessage,
  };
};
module.exports = projectController;
