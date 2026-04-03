const User = require('../models/User');

module.exports = async (req, res, next) => {
  try {
    // Get user from database using userId set by is-auth middleware
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if user has admin or sub-admin role
    if (user.role !== 'admin' && user.role !== 'sub-admin') {
      return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
    }
    
    // For specific route access control for sub-admins, you can add additional checks here
    // For now, we allow both admin and sub-admin to access admin routes
    // Sub-admin access control is handled at the frontend level based on accessPermissions
    
    // If user is admin or sub-admin, proceed to next middleware
    next();
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error' });
  }
}; 