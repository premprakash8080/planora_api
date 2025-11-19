const { Section, Project, Task, User, TaskComment } = require('../models');
const { successResponse, errorResponse } = require('../utils/responseFormatter');

const sectionController = () => {
  // Get all sections for a project
  const getSectionsByProject = async (req, res) => {
    const { project_id, projectId } = req.body; // Support both project_id and projectId
    const projectIdValue = project_id || projectId;

    try {
      if (!projectIdValue) {
        return res.status(400).json(errorResponse('Missing params: project_id is required', 400));
      }

      if (isNaN(parseInt(projectIdValue))) {
        return res.status(400).json(errorResponse('Invalid project ID', 400));
      }

      const sections = await Section.findAll({
        where: { project_id: projectIdValue },
        include: [
          { 
            model: Task, 
            as: 'tasks', 
            where: { 
              deleted_at: null
            },
            required: false,
            include: [
              { 
                model: User, 
                as: 'assignee', 
                attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'], 
                required: false 
              },
              { 
                model: TaskComment, 
                as: 'comments', 
                required: false,
                include: [{ 
                  model: User, 
                  as: 'user', 
                  attributes: ['id', 'full_name', 'email', 'avatar_url'] 
                }]
              },
              // Note: childTasks (subtasks) removed - parent_id column doesn't exist in database
            ],
            order: [['position', 'ASC']]
          },
        ],
        order: [['position', 'ASC']],
      });
      
      res.json(successResponse({ sections }));
    } catch (error) {
      console.error('Error fetching sections:', error);
      console.error('Error stack:', error.stack);
      res.status(500).json(errorResponse(`Failed to fetch sections: ${error.message}`, 500));
    }
  };

  // Create new section
  const createSection = async (req, res) => {
    const { project_id, title, name, position } = req.body;

    try {
      if (!project_id || isNaN(parseInt(project_id))) {
        return res.status(400).json(errorResponse('Missing params: project_id is required', 400));
      }

      if (!(title || name) || (!title && !name) || (title && title.trim().length === 0) || (name && name.trim().length === 0)) {
        return res.status(400).json(errorResponse('Missing params: section name is required', 400));
      }

      const sectionTitle = title || name;
      if (sectionTitle.length > 150) {
        return res.status(400).json(errorResponse('Section name must be 150 characters or less', 400));
      }

      const section = await Section.create({
        project_id,
        name: title || name, // Support both title and name for compatibility
        position: position || 0,
      });

      const sectionWithTasks = await Section.findByPk(section.id, {
        include: [{ 
          model: Task, 
          as: 'tasks',
          where: { deleted_at: null },
          required: false,
          include: [
            { model: User, as: 'assignee', attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'], required: false },
            { model: TaskComment, as: 'comments', required: false, include: [{ model: User, as: 'user', attributes: ['id', 'full_name', 'email', 'avatar_url'] }] },
            // Note: childTasks removed - parent_id column doesn't exist in database
          ]
        }],
      });

      res.status(201).json(successResponse({ section: sectionWithTasks }, 'Section created successfully'));
    } catch (error) {
      console.error('Error creating section:', error);
      res.status(500).json(errorResponse('Failed to create section', 500));
    }
  };

  // Update section
  const updateSection = async (req, res) => {
    const { section_id, sectionId } = req.body; // Support both section_id and sectionId
    const sectionIdValue = section_id || sectionId;
    const updateData = req.body;

    try {
      if (!sectionIdValue || isNaN(parseInt(sectionIdValue))) {
        return res.status(400).json(errorResponse('Missing params: section_id is required', 400));
      }

      const section = await Section.findByPk(sectionIdValue);
      if (!section) {
        return res.status(404).json(errorResponse('Section not found', 404));
      }

      // Remove section_id/sectionId from updateData to avoid updating the ID
      const { section_id: _, sectionId: __, ...cleanUpdateData } = updateData;
      await section.update(cleanUpdateData);

      const updatedSection = await Section.findByPk(sectionIdValue, {
        include: [{ 
          model: Task, 
          as: 'tasks',
          where: { deleted_at: null },
          required: false,
          include: [
            { model: User, as: 'assignee', attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'], required: false },
            // Note: childTasks removed - parent_id column doesn't exist in database
          ]
        }],
      });

      res.json(successResponse({ section: updatedSection }, 'Section updated successfully'));
    } catch (error) {
      console.error('Error updating section:', error);
      res.status(500).json(errorResponse('Failed to update section', 500));
    }
  };

  // Delete section
  const deleteSection = async (req, res) => {
    const { section_id, sectionId } = req.body; // Support both section_id and sectionId
    const sectionIdValue = section_id || sectionId;

    try {
      if (!sectionIdValue || isNaN(parseInt(sectionIdValue))) {
        return res.status(400).json(errorResponse('Missing params: section_id is required', 400));
      }

      const section = await Section.findByPk(sectionIdValue);
      if (!section) {
        return res.status(404).json(errorResponse('Section not found', 404));
      }

      await section.destroy();
      res.json(successResponse(null, 'Section deleted successfully'));
    } catch (error) {
      console.error('Error deleting section:', error);
      res.status(500).json(errorResponse('Failed to delete section', 500));
    }
  };

  // Update section title
  const updateSectionTitle = async (req, res) => {
    const { section_id, sectionId } = req.body; // Support both section_id and sectionId
    const sectionIdValue = section_id || sectionId;
    const { name, title } = req.body;

    try {
      if (!sectionIdValue || isNaN(parseInt(sectionIdValue))) {
        return res.status(400).json(errorResponse('Missing params: section_id is required', 400));
      }

      if (!(name || title) || (!name && !title) || (name && name.trim().length === 0) || (title && title.trim().length === 0)) {
        return res.status(400).json(errorResponse('Missing params: section name is required', 400));
      }

      const sectionTitle = name || title;
      if (sectionTitle.length > 150) {
        return res.status(400).json(errorResponse('Section name must be 150 characters or less', 400));
      }

      const section = await Section.findByPk(sectionIdValue);
      if (!section) {
        return res.status(404).json(errorResponse('Section not found', 404));
      }

      await section.update({ name: name || title }); // Support both title and name
      
      const updatedSection = await Section.findByPk(sectionIdValue, {
        include: [{ 
          model: Task, 
          as: 'tasks', 
          where: { deleted_at: null }, 
          required: false,
          include: [
            { model: User, as: 'assignee', attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'], required: false },
            // Note: childTasks removed - parent_id column doesn't exist in database
          ]
        }],
      });
      
      res.json(successResponse({ section: updatedSection }, 'Section title updated successfully'));
    } catch (error) {
      console.error('Error updating section title:', error);
      res.status(500).json(errorResponse('Failed to update section title', 500));
    }
  };

  // Batch update sections (for reordering, etc.)
  const batchUpdateSections = async (req, res) => {
    const { updates } = req.body; // Array of { id, updates } objects

    try {
      if (!updates || !Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json(errorResponse('Missing params: updates array is required', 400));
      }

      const results = await Promise.all(
        updates.map(async ({ id, ...updateData }) => {
          const section = await Section.findByPk(id);
          if (section) {
            await section.update(updateData);
            return { id, success: true };
          }
          return { id, success: false, error: 'Section not found' };
        })
      );

      res.json(successResponse({ results }, 'Sections updated successfully'));
    } catch (error) {
      console.error('Error batch updating sections:', error);
      res.status(500).json(errorResponse('Failed to batch update sections', 500));
    }
  };

  return {
    getSectionsByProject,
    createSection,
    updateSection,
    deleteSection,
    updateSectionTitle,
    batchUpdateSections,
  };
};
module.exports = sectionController;
