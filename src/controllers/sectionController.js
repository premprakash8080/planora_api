const { Section, Project, Task } = require('../models');

// Get all sections for a project
exports.getSectionsByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const sections = await Section.findAll({
      where: { project_id: projectId },
      include: [
        { model: Task, as: 'tasks', where: { deleted_at: null }, required: false },
      ],
      order: [['position', 'ASC']],
    });
    res.json(sections);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Create new section
exports.createSection = async (req, res) => {
  try {
    const { project_id, name, position } = req.body;
    
    const section = await Section.create({
      project_id,
      name,
      position: position || 0,
    });
    
    const sectionWithTasks = await Section.findByPk(section.id, {
      include: [{ model: Task, as: 'tasks' }],
    });
    
    res.status(201).json(sectionWithTasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update section
exports.updateSection = async (req, res) => {
  try {
    const { sectionId } = req.params;
    const updateData = req.body;
    
    const section = await Section.findByPk(sectionId);
    if (!section) {
      return res.status(404).json({ error: 'Section not found' });
    }
    
    await section.update(updateData);
    
    const updatedSection = await Section.findByPk(sectionId, {
      include: [{ model: Task, as: 'tasks' }],
    });
    
    res.json(updatedSection);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete section
exports.deleteSection = async (req, res) => {
  try {
    const { sectionId } = req.params;
    const section = await Section.findByPk(sectionId);
    if (!section) {
      return res.status(404).json({ error: 'Section not found' });
    }
    
    await section.destroy();
    res.json({ message: 'Section deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update section title
exports.updateSectionTitle = async (req, res) => {
  try {
    const { sectionId } = req.params;
    const { name } = req.body;
    
    const section = await Section.findByPk(sectionId);
    if (!section) {
      return res.status(404).json({ error: 'Section not found' });
    }
    
    await section.update({ name });
    res.json(section);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

