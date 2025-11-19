const express = require('express');
const router = express.Router();
const memberController = require('../controllers/memberController');
const { authenticate } = require('../middleware/auth');

const {
  getMembers,
  getMemberById,
  getMemberProjectsCount,
  createMember,
  updateMember,
  deleteMember,
  getAvailableMembersForProject
} = memberController();

// All routes require authentication
router.use(authenticate);

// Member routes
router.get('/', getMembers);
router.get('/:id', getMemberById); // getMemberById supports both req.body and req.params
router.post('/:id', getMemberById); // Alternative POST route for req.body support
router.get('/:id/projects/count', getMemberProjectsCount); // Supports both req.body and req.params
router.post('/:id/projects/count', getMemberProjectsCount); // Alternative POST route for req.body support
router.post('/', createMember); // createMember uses req.body for params
router.post('/available-for-project', getAvailableMembersForProject); // Uses req.body for params
router.put('/:id', updateMember); // updateMember supports both req.body and req.params
router.delete('/:id', deleteMember); // deleteMember supports both req.body and req.params

module.exports = router;

