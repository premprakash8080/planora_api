const express = require('express');
const router = express.Router();
const teamController = require('../controllers/teamController');
const { authenticate } = require('../middleware/auth');

const { getTeams, getTeamById, createTeam, updateTeam, deleteTeam, addMember, removeMember } = teamController();

// All routes require authentication
router.use(authenticate);

// Team routes
router.get('/', getTeams);
router.get('/:teamId', getTeamById);
router.post('/', createTeam);
router.put('/:teamId', updateTeam);
router.delete('/:teamId', deleteTeam);

// Team member routes
router.post('/:teamId/members', addMember);
router.delete('/:teamId/members/:memberId', removeMember);

module.exports = router;

