const User = require('../models/User');

// Get all users
exports.getAllUsers = async (req, res) => {
  try {
    // Only admin can view all users
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can view all users' });
    }

    const users = await User.find({}, { password: 0 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update user role
exports.updateUserRole = async (req, res) => {
  try {
    // Only admin can update roles
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can update roles' });
    }

    const {role} = req.body;
    const userId = req.params.userId;

    // Validate role
    const validRoles = ['admin', 'hr', 'manager', 'employee'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { role },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'Role updated successfully', user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get user by ID
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id, { password: 0 });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
