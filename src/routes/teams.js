const express = require('express');
const router = express.Router();
const teamController = require('../controllers/teamController');
const { authenticate } = require('../middleware/auth');
const { validateTeam, validateTeamId } = require('../middleware/validator');

const { getTeams, getTeamById, createTeam, updateTeam, deleteTeam, addMember, removeMember } = teamController();

// All routes require authentication
router.use(authenticate);

// Team routes
router.get('/', getTeams);
router.get('/:teamId', validateTeamId, getTeamById);
router.post('/', validateTeam, createTeam);
router.put('/:teamId', validateTeamId, validateTeam, updateTeam);
router.delete('/:teamId', validateTeamId, deleteTeam);

// Team member routes
router.post('/:teamId/members', validateTeamId, addMember);
router.delete('/:teamId/members/:memberId', validateTeamId, removeMember);

module.exports = router;

