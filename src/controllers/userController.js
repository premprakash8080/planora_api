const bcrypt = require('bcryptjs');
const { User } = require('../models');
const { Op, Sequelize } = require('sequelize');
const { issueJWT } = require('../utils/issueJWT');
const { successResponse, errorResponse } = require('../utils/responseFormatter');

// Register new user

const userController = () => {
  const register = async (req, res) => {
    const { full_name, email, password } = req.body;

    try {
      if (!(full_name && email && password)) {
        return res.status(400).json({
          success: false,
          message: 'Missing params: full_name, email, and password are required',
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters',
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

      // Hash password
      const password_hash = await bcrypt.hash(password, 10);

      // Generate initials from full name
      const initials = full_name
        .split(' ')
        .map(n => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase();

      // Generate avatar color (simple hash-based color)
      const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f97316', '#ef4444'];
      const avatar_color = colors[full_name.length % colors.length];

      // Create user
      const user = await User.create({
        full_name,
        email,
        password_hash,
        initials,
        avatar_color,
        status: 'active',
      });

      // Generate JWT token
      const tokenData = issueJWT(user.id, 'user');

      // Remove password from response
      const userResponse = {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        initials: user.initials,
        avatar_color: user.avatar_color,
        avatar_url: user.avatar_url,
        status: user.status,
      };

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user: userResponse,
          token: tokenData.token,
          expires: tokenData.expires,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Registration failed',
        error: error.message,
      });
    }
  };

  // Login user
  const login = async (req, res) => {
    const { email, password } = req.body;

    try {
      if (!(email && password)) {
        return res.status(400).json({
          success: false,
          message: 'Missing params: email and password are required',
        });
      }

      // Find user by email
      const user = await User.findOne({ where: { email } });
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password',
        });
      }

      // Check if user is active
      if (user.status !== 'active') {
        return res.status(403).json({
          success: false,
          message: 'Account is inactive or suspended',
        });
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password',
        });
      }

      // Generate JWT token
      const tokenData = issueJWT(user.id, 'user');

      // Remove password from response
      const userResponse = {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        initials: user.initials,
        avatar_color: user.avatar_color,
        avatar_url: user.avatar_url,
        status: user.status,
      };

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: userResponse,
          token: tokenData.token,
          expires: tokenData.expires,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Login failed',
        error: error.message,
      });
    }
  };

  // Get current user profile
  const getProfile = async (req, res) => {
    try {
      const user = await User.findByPk(req.user.id, {
        attributes: { exclude: ['password_hash', 'deleted_at'] },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      res.json({
        success: true,
        data: { user },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch profile',
        error: error.message,
      });
    }
  };

  // Update user profile
  const updateProfile = async (req, res) => {
    try {
      const { full_name, avatar_url, avatar_color } = req.body;
      const user = await User.findByPk(req.user.id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      const updateData = {};
      if (full_name) {
        updateData.full_name = full_name;
        // Regenerate initials if name changed
        updateData.initials = full_name
          .split(' ')
          .map(n => n[0])
          .join('')
          .substring(0, 2)
          .toUpperCase();
      }
      if (avatar_url !== undefined) updateData.avatar_url = avatar_url;
      if (avatar_color !== undefined) updateData.avatar_color = avatar_color;

      await user.update(updateData);

      const userResponse = {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        initials: user.initials,
        avatar_color: user.avatar_color,
        avatar_url: user.avatar_url,
        status: user.status,
      };

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: { user: userResponse },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to update profile',
        error: error.message,
      });
    }
  };

  // Get all users (for admin/member management)
  const getAllUsers = async (req, res) => {
    try {
      const users = await User.findAll({
        where: { deleted_at: null },
        attributes: { 
          exclude: ['password_hash', 'deleted_at'],
        },
        order: [['created_at', 'DESC']],
      });

      // Map users and include projectsAssigned from project_assign_count column
      const usersWithProjects = users.map(user => {
        const userData = user.toJSON();
        userData.projectsAssigned = userData.project_assign_count || 0;
        return userData;
      });

      res.json(successResponse({ users: usersWithProjects }));
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json(errorResponse(`Failed to fetch users: ${error.message}`, 500));
    }
  };

  // Get user by ID
  const getUserById = async (req, res) => {
    const { userId } = req.params;

    try {
      if (!userId || isNaN(parseInt(userId))) {
        return res.status(400).json(errorResponse('Invalid user ID', 400));
      }

      const user = await User.findByPk(userId, {
        attributes: { exclude: ['password_hash', 'deleted_at'] },
      });

      if (!user) {
        return res.status(404).json(errorResponse('User not found', 404));
      }

      res.json(successResponse({ user }));
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json(errorResponse(`Failed to fetch user: ${error.message}`, 500));
    }
  };

  // Update user (admin operation)
  const updateUser = async (req, res) => {
    const { userId } = req.params;
    const { full_name, email, status, avatar_url, avatar_color } = req.body;

    try {
      if (!userId || isNaN(parseInt(userId))) {
        return res.status(400).json(errorResponse('Invalid user ID', 400));
      }

      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json(errorResponse('User not found', 404));
      }

      const updateData = {};
      if (full_name) {
        updateData.full_name = full_name;
        // Regenerate initials if name changed
        updateData.initials = full_name
          .split(' ')
          .map(n => n[0])
          .join('')
          .substring(0, 2)
          .toUpperCase();
      }
      if (email) {
        // Check if email is already taken by another user
        const existingUser = await User.findOne({ 
          where: { email, id: { [Op.ne]: userId } }
        });
        if (existingUser) {
          return res.status(409).json(errorResponse('Email already in use', 409));
        }
        updateData.email = email;
      }
      if (status !== undefined) updateData.status = status;
      if (avatar_url !== undefined) updateData.avatar_url = avatar_url;
      if (avatar_color !== undefined) updateData.avatar_color = avatar_color;

      await user.update(updateData);

      const userResponse = {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        initials: user.initials,
        avatar_color: user.avatar_color,
        avatar_url: user.avatar_url,
        status: user.status,
      };

      res.json(successResponse({ user: userResponse }, 'User updated successfully'));
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json(errorResponse(`Failed to update user: ${error.message}`, 500));
    }
  };

  // Delete user (soft delete)
  const deleteUser = async (req, res) => {
    const { userId } = req.params;

    try {
      if (!userId || isNaN(parseInt(userId))) {
        return res.status(400).json(errorResponse('Invalid user ID', 400));
      }

      const user = await User.findByPk(userId);
      
      if (!user) {
        return res.status(404).json(errorResponse('User not found', 404));
      }

      // Prevent deleting yourself
      if (user.id === req.user.id) {
        return res.status(400).json(errorResponse('Cannot delete your own account', 400));
      }

      await user.destroy();
      res.json(successResponse(null, 'User deleted successfully'));
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json(errorResponse(`Failed to delete user: ${error.message}`, 500));
    }
  };

  return {
    register,
    login,
    getProfile,
    updateProfile,
    getAllUsers,
    getUserById,
    updateUser,
    deleteUser,
  };

}
module.exports = userController;

