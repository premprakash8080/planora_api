const { User, Project, Task, TeamMember, ProjectMember } = require('../models');
const { Op } = require('sequelize');
const { successResponse, errorResponse } = require('../utils/responseFormatter');

const memberController = () => {
  // Get all members (users)
  const getMembers = async (req, res) => {
    try {
      const users = await User.findAll({
        where: { deleted_at: null },
        attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials', 'status'],
        order: [['full_name', 'ASC']],
      });

      // Get project counts for each user
      const membersWithCounts = await Promise.all(
        users.map(async (user) => {
          // Count projects where user is creator or member
          const createdProjects = await Project.count({
            where: { created_by: user.id, deleted_at: null }
          });

          const memberProjects = await ProjectMember.count({
            where: { user_id: user.id }
          });

          const totalProjects = createdProjects + memberProjects;

          return {
            id: user.id,
            full_name: user.full_name,
            email: user.email,
            avatar_url: user.avatar_url,
            avatar_color: user.avatar_color,
            initials: user.initials,
            status: user.status,
            projectsAssigned: totalProjects
          };
        })
      );

      res.json(successResponse({ members: membersWithCounts }));
    } catch (error) {
      console.error('Error fetching members:', error);
      res.status(500).json(errorResponse(`Failed to fetch members: ${error.message}`, 500));
    }
  };

  // Get member by ID
  const getMemberById = async (req, res) => {
    const { id, member_id, memberId } = req.body;
    const memberIdValue = id || member_id || memberId || req.params.id;

    try {
      if (!memberIdValue || isNaN(parseInt(memberIdValue))) {
        return res.status(400).json(errorResponse('Missing params: id is required', 400));
      }

      const user = await User.findByPk(memberIdValue, {
        attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials', 'status', 'created_at', 'updated_at'],
      });

      if (!user) {
        return res.status(404).json(errorResponse('Member not found', 404));
      }

      // Get project count
      const createdProjects = await Project.count({
        where: { created_by: user.id, deleted_at: null }
      });

      const memberProjects = await ProjectMember.count({
        where: { user_id: user.id }
      });

      const member = {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        avatar_url: user.avatar_url,
        avatar_color: user.avatar_color,
        initials: user.initials,
        status: user.status,
        projectsAssigned: createdProjects + memberProjects,
        created_at: user.created_at,
        updated_at: user.updated_at
      };

      res.json(successResponse({ member }));
    } catch (error) {
      console.error('Error fetching member:', error);
      res.status(500).json(errorResponse(`Failed to fetch member: ${error.message}`, 500));
    }
  };

  // Get member's projects count
  const getMemberProjectsCount = async (req, res) => {
    const { id, member_id, memberId } = req.body;
    const memberIdValue = id || member_id || memberId || req.params.id;

    try {
      if (!memberIdValue || isNaN(parseInt(memberIdValue))) {
        return res.status(400).json(errorResponse('Missing params: id is required', 400));
      }

      const createdProjects = await Project.count({
        where: { created_by: memberIdValue, deleted_at: null }
      });

      const memberProjects = await ProjectMember.count({
        where: { user_id: memberIdValue }
      });

      res.json(successResponse({ count: createdProjects + memberProjects }));
    } catch (error) {
      console.error('Error fetching project count:', error);
      res.status(500).json(errorResponse(`Failed to fetch project count: ${error.message}`, 500));
    }
  };

  // Create/Invite member (register new user)
  const createMember = async (req, res) => {
    const { full_name, email, password, role, status } = req.body;

    try {
      if (!(full_name && email)) {
        return res.status(400).json({
          success: false,
          message: 'Missing params: full_name and email are required',
        });
      }

      if (full_name.length < 2 || full_name.length > 150) {
        return res.status(400).json({
          success: false,
          message: 'Full name must be between 2 and 150 characters',
        });
      }

      // Check if user already exists
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'User with this email already exists',
        });
      }

      // Generate initials
      const initials = full_name
        .split(' ')
        .map(n => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase();

      // Generate avatar color
      const colors = ['#6C5CE7', '#00B894', '#0984E3', '#E17055', '#D63031', '#E84393', '#00CEC9', '#FDCB6E'];
      const avatar_color = colors[full_name.length % colors.length];

      // Note: In a real app, you would send an invitation email
      // For now, we'll create the user directly
      // Password should be generated and sent via email in production

      const bcrypt = require('bcryptjs');
      const password_hash = password 
        ? await bcrypt.hash(password, 10)
        : await bcrypt.hash('temp_password_' + Date.now(), 10); // Temporary password

      const user = await User.create({
        full_name,
        email,
        password_hash,
        initials,
        avatar_color,
        status: status || 'active',
      });

      const member = {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        avatar_url: user.avatar_url,
        avatar_color: user.avatar_color,
        initials: user.initials,
        status: user.status,
        projectsAssigned: 0
      };

      res.status(201).json(successResponse({ member }, 'Member invited successfully'));
    } catch (error) {
      console.error('Error creating member:', error);
      res.status(500).json(errorResponse(`Failed to invite member: ${error.message}`, 500));
    }
  };

  // Update member
  const updateMember = async (req, res) => {
    const { id, member_id, memberId, full_name, email, status, avatar_color } = req.body;
    const memberIdValue = id || member_id || memberId || req.params.id;

    try {
      if (!memberIdValue || isNaN(parseInt(memberIdValue))) {
        return res.status(400).json(errorResponse('Missing params: id is required', 400));
      }

      if (full_name && (full_name.length < 2 || full_name.length > 150)) {
        return res.status(400).json(errorResponse('Full name must be between 2 and 150 characters', 400));
      }

      const user = await User.findByPk(memberIdValue);
      if (!user) {
        return res.status(404).json(errorResponse('Member not found', 404));
      }

      // Update fields
      if (full_name) {
        user.full_name = full_name;
        // Update initials if name changed
        user.initials = full_name
          .split(' ')
          .map(n => n[0])
          .join('')
          .substring(0, 2)
          .toUpperCase();
      }
      if (email) user.email = email;
      if (status) user.status = status;
      if (avatar_color) user.avatar_color = avatar_color;

      await user.save();

      // Get project count
      const createdProjects = await Project.count({
        where: { created_by: user.id, deleted_at: null }
      });

      const memberProjects = await ProjectMember.count({
        where: { user_id: user.id }
      });

      const member = {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        avatar_url: user.avatar_url,
        avatar_color: user.avatar_color,
        initials: user.initials,
        status: user.status,
        projectsAssigned: createdProjects + memberProjects
      };

      res.json(successResponse({ member }, 'Member updated successfully'));
    } catch (error) {
      console.error('Error updating member:', error);
      res.status(500).json(errorResponse(`Failed to update member: ${error.message}`, 500));
    }
  };

  // Delete member (soft delete)
  const deleteMember = async (req, res) => {
    const { id, member_id, memberId } = req.body;
    const memberIdValue = id || member_id || memberId || req.params.id;

    try {
      if (!memberIdValue || isNaN(parseInt(memberIdValue))) {
        return res.status(400).json(errorResponse('Missing params: id is required', 400));
      }

      const user = await User.findByPk(memberIdValue);
      if (!user) {
        return res.status(404).json(errorResponse('Member not found', 404));
      }

      // Soft delete
      await user.update({ deleted_at: new Date() });

      res.json(successResponse(null, 'Member removed successfully'));
    } catch (error) {
      console.error('Error deleting member:', error);
      res.status(500).json(errorResponse(`Failed to remove member: ${error.message}`, 500));
    }
  };

  // Get available members for a project (users not already in the project)
  const getAvailableMembersForProject = async (req, res) => {
    const { project_id, projectId } = req.body;
    const projectIdValue = project_id || projectId;

    try {
      if (!projectIdValue || isNaN(parseInt(projectIdValue))) {
        return res.status(400).json({
          success: false,
          message: 'Missing params: project_id is required',
        });
      }

      // Get all active users
      const allUsers = await User.findAll({
        where: { deleted_at: null },
        attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials', 'status'],
        order: [['full_name', 'ASC']],
      });

      // Get project members
      const projectMembers = await ProjectMember.findAll({
        where: { project_id: projectIdValue },
        attributes: ['user_id'],
      });

      const memberIds = new Set(projectMembers.map(pm => pm.user_id));

      // Filter out users who are already members
      const availableMembers = allUsers
        .filter(user => !memberIds.has(user.id))
        .map(user => ({
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          avatar_url: user.avatar_url,
          avatar_color: user.avatar_color,
          initials: user.initials,
          status: user.status,
        }));

      res.json(successResponse({ members: availableMembers }));
    } catch (error) {
      console.error('Error fetching available members:', error);
      res.status(500).json(errorResponse(`Failed to fetch available members: ${error.message}`, 500));
    }
  };

  return {
    getMembers,
    getMemberById,
    getMemberProjectsCount,
    createMember,
    updateMember,
    deleteMember,
    getAvailableMembersForProject,
  };
};

module.exports = memberController;

