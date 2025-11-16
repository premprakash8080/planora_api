const express = require('express');
const router = express.Router();
const teamController = require('../controllers/teamController');
const { authenticate } = require('../middleware/auth');
const { validateTeam, validateTeamId } = require('../middleware/validator');

// All routes require authentication
router.use(authenticate);

// Team routes
router.get('/', teamController.getTeams);
router.get('/:teamId', validateTeamId, teamController.getTeamById);
router.post('/', validateTeam, teamController.createTeam);
router.put('/:teamId', validateTeamId, validateTeam, teamController.updateTeam);
router.delete('/:teamId', validateTeamId, teamController.deleteTeam);

// Team member routes
router.post('/:teamId/members', validateTeamId, teamController.addMember);
router.delete('/:teamId/members/:memberId', validateTeamId, teamController.removeMember);

module.exports = router;

