const { Team, TeamMember, User, Project } = require('../models');
const { Op } = require('sequelize');

// Get all teams
exports.getTeams = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get teams where user is a member
    const teamMemberships = await TeamMember.findAll({
      where: { user_id: userId },
      include: [{ model: Team, as: 'team' }],
    });

    const teams = teamMemberships.map(tm => tm.team);
    
    res.json({
      success: true,
      data: { teams },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch teams',
      error: error.message,
    });
  }
};

// Get team by ID
exports.getTeamById = async (req, res) => {
  try {
    const { teamId } = req.params;
    const userId = req.user.id;

    // Check if user is a member of the team
    const membership = await TeamMember.findOne({
      where: { team_id: teamId, user_id: userId },
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this team',
      });
    }

    const team = await Team.findByPk(teamId, {
      include: [
        { model: User, as: 'creator', attributes: ['id', 'full_name', 'email'] },
        { 
          model: TeamMember, 
          as: 'members',
          include: [{ model: User, as: 'user', attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'] }],
        },
        { model: Project, as: 'projects' },
      ],
    });

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found',
      });
    }

    res.json({
      success: true,
      data: { team },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch team',
      error: error.message,
    });
  }
};

// Create new team
exports.createTeam = async (req, res) => {
  try {
    const { name, description } = req.body;
    const created_by = req.user.id;

    const team = await Team.create({
      name,
      description,
      created_by,
    });

    // Add creator as owner
    await TeamMember.create({
      team_id: team.id,
      user_id: created_by,
      role: 'owner',
    });

    const teamWithRelations = await Team.findByPk(team.id, {
      include: [
        { model: User, as: 'creator', attributes: ['id', 'full_name', 'email'] },
        { 
          model: TeamMember, 
          as: 'members',
          include: [{ model: User, as: 'user', attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'] }],
        },
      ],
    });

    res.status(201).json({
      success: true,
      message: 'Team created successfully',
      data: { team: teamWithRelations },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create team',
      error: error.message,
    });
  }
};

// Update team
exports.updateTeam = async (req, res) => {
  try {
    const { teamId } = req.params;
    const userId = req.user.id;
    const { name, description } = req.body;

    // Check if user is owner or admin
    const membership = await TeamMember.findOne({
      where: { team_id: teamId, user_id: userId },
    });

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this team',
      });
    }

    const team = await Team.findByPk(teamId);
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found',
      });
    }

    await team.update({ name, description });

    const updatedTeam = await Team.findByPk(teamId, {
      include: [
        { model: User, as: 'creator', attributes: ['id', 'full_name', 'email'] },
      ],
    });

    res.json({
      success: true,
      message: 'Team updated successfully',
      data: { team: updatedTeam },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update team',
      error: error.message,
    });
  }
};

// Delete team
exports.deleteTeam = async (req, res) => {
  try {
    const { teamId } = req.params;
    const userId = req.user.id;

    // Check if user is owner
    const membership = await TeamMember.findOne({
      where: { team_id: teamId, user_id: userId, role: 'owner' },
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        message: 'Only team owner can delete the team',
      });
    }

    const team = await Team.findByPk(teamId);
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found',
      });
    }

    await team.destroy();
    res.json({
      success: true,
      message: 'Team deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete team',
      error: error.message,
    });
  }
};

// Add member to team
exports.addMember = async (req, res) => {
  try {
    const { teamId } = req.params;
    const userId = req.user.id;
    const { user_id, role = 'member' } = req.body;

    // Check if requester is owner or admin
    const requesterMembership = await TeamMember.findOne({
      where: { team_id: teamId, user_id: userId },
    });

    if (!requesterMembership || !['owner', 'admin'].includes(requesterMembership.role)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to add members',
      });
    }

    // Check if user exists
    const user = await User.findByPk(user_id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if already a member
    const existingMember = await TeamMember.findOne({
      where: { team_id: teamId, user_id },
    });

    if (existingMember) {
      return res.status(409).json({
        success: false,
        message: 'User is already a member of this team',
      });
    }

    const membership = await TeamMember.create({
      team_id: teamId,
      user_id,
      role,
    });

    const membershipWithUser = await TeamMember.findByPk(membership.id, {
      include: [{ model: User, as: 'user', attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'] }],
    });

    res.status(201).json({
      success: true,
      message: 'Member added successfully',
      data: { member: membershipWithUser },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to add member',
      error: error.message,
    });
  }
};

// Remove member from team
exports.removeMember = async (req, res) => {
  try {
    const { teamId, memberId } = req.params;
    const userId = req.user.id;

    // Check if requester is owner or admin
    const requesterMembership = await TeamMember.findOne({
      where: { team_id: teamId, user_id: userId },
    });

    if (!requesterMembership || !['owner', 'admin'].includes(requesterMembership.role)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to remove members',
      });
    }

    const membership = await TeamMember.findOne({
      where: { team_id: teamId, user_id: memberId },
    });

    if (!membership) {
      return res.status(404).json({
        success: false,
        message: 'Member not found',
      });
    }

    // Prevent removing owner
    if (membership.role === 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Cannot remove team owner',
      });
    }

    await membership.destroy();
    res.json({
      success: true,
      message: 'Member removed successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to remove member',
      error: error.message,
    });
  }
};

