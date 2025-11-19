const { Project, Section, Task, User, ProjectMember, ProjectFavorite, TaskStatus, PriorityLabel } = require('../models');
const { Op } = require('sequelize');
const { successResponse, errorResponse } = require('../utils/responseFormatter');

const projectController = () => {
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

  return {
    getProjects,
    getProjectById,
    createProject,
    updateProject,
    deleteProject,
    toggleProjectFavorite,
    addProjectMember,
    removeProjectMember,
  };
};
module.exports = projectController;
