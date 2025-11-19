const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');

const { register, login, getProfile, updateProfile, getAllUsers, getUserById, updateUser, deleteUser } = userController();

// Public routes
router.post('/register', register);
router.post('/login', login);

// Protected routes - Profile (current user)
router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, updateProfile);

// Protected routes - User management (admin operations)
router.get('/', authenticate, getAllUsers);
router.get('/:userId', authenticate, getUserById);
router.put('/:userId', authenticate, updateUser);
router.delete('/:userId', authenticate, deleteUser);

module.exports = router;

