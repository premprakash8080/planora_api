const { Project, Section, Task, User, ProjectMember, ProjectFavorite, TaskStatus, PriorityLabel, TaskActivityLog } = require('../models');
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
    getProjectOverview,
    updateProjectOverview,
  };
};
module.exports = projectController;
