const { Project, Section, Task, User, ProjectMember, ProjectFavorite } = require('../models');
const { Op } = require('sequelize');

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
    
    res.json(projectsWithFavorites);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get project by ID
  const getProjectById = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;
    
    const project = await Project.findByPk(projectId, {
      include: [
        { model: User, as: 'creator', attributes: ['id', 'full_name', 'email'] },
        { model: Section, as: 'sections', include: [{ model: Task, as: 'tasks' }] },
        { model: ProjectMember, as: 'members', include: [{ model: User, as: 'user' }] },
      ],
    });
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const favorite = await ProjectFavorite.findOne({
      where: { user_id: userId, project_id: projectId },
    });
    
    res.json({
      ...project.toJSON(),
      is_favorite: !!favorite,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Create new project
  const createProject = async (req, res) => {
  try {
    const { name, description, color, team_id, status, due_date } = req.body;
    const created_by = req.user.id;
    
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
    
    res.status(201).json(projectWithRelations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update project
  const updateProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const updateData = req.body;
    
    const project = await Project.findByPk(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    await project.update(updateData);
    
    const updatedProject = await Project.findByPk(projectId, {
      include: [
        { model: User, as: 'creator', attributes: ['id', 'full_name', 'email'] },
      ],
    });
    
    res.json(updatedProject);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete project (soft delete)
  const deleteProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const project = await Project.findByPk(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    await project.destroy();
    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Toggle project favorite
  const toggleProjectFavorite = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;
    
    const favorite = await ProjectFavorite.findOne({
      where: { user_id: userId, project_id: projectId },
    });
    
    if (favorite) {
      await favorite.destroy();
      res.json({ is_favorite: false });
    } else {
      await ProjectFavorite.create({
        user_id: userId,
        project_id: projectId,
      });
      res.json({ is_favorite: true });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

return {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  toggleProjectFavorite,
};
};
module.exports = projectController;
