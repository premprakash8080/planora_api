const bcrypt = require('bcryptjs');
const { User } = require('../models');
const { issueJWT } = require('../utils/issueJWT');

// Register new user

const userController = () => {
const register = async (req, res) => {
  try {
    const { full_name, email, password } = req.body;

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
  try {
    const { email, password } = req.body;

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

return {
  register,
  login,
  getProfile,
  updateProfile,
};

}
module.exports = userController;

