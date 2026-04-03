/**
 * Notifications utility module
 * Provides easy access to notification functions from anywhere in the application
 */

const deviceTokenController = require('../controllers/deviceTokenController');

/**
 * Send a notification to a specific user
 * @param {string} userId - The ID of the user to send the notification to
 * @param {Object} notification - The notification object
 * @param {string} notification.title - The notification title
 * @param {string} notification.body - The notification body
 * @param {Object} notification.data - Additional data to send with the notification
 * @returns {Promise<Object>} - Result of the notification send operation
 */
exports.sendToUser = async (userId, notification) => {
  return await deviceTokenController.sendNotificationToUser(userId, notification);
};

/**
 * Send a notification to multiple users
 * @param {Array<string>} userIds - Array of user IDs to send the notification to
 * @param {Object} notification - The notification object
 * @param {string} notification.title - The notification title
 * @param {string} notification.body - The notification body
 * @param {Object} notification.data - Additional data to send with the notification
 * @returns {Promise<Object>} - Result of the notification send operation
 */
exports.sendToUsers = async (userIds, notification) => {
  const results = {
    sent: 0,
    successful: 0,
    failed: 0,
    errors: []
  };

  // Send to each user individually
  for (const userId of userIds) {
    try {
      const result = await deviceTokenController.sendNotificationToUser(userId, notification);
      
      if (result.success) {
        results.sent += result.sent || 0;
        results.successful += result.successful || 0;
        results.failed += result.failed || 0;
      } else {
        results.errors.push({ userId, error: result.message || result.error });
      }
    } catch (error) {
      results.errors.push({ userId, error: error.message });
    }
  }

  return results;
};

/**
 * Send a notification to users with a specific role
 * @param {string} role - The role of users to send the notification to (e.g., "student", "instructor", "influencer", "admin")
 * @param {Object} notification - The notification object
 * @param {string} notification.title - The notification title
 * @param {string} notification.body - The notification body
 * @param {Object} notification.data - Additional data to send with the notification
 * @param {boolean} onlyLoggedIn - Whether to send only to logged-in users
 * @returns {Promise<Object>} - Result of the notification send operation
 */
exports.sendToRole = async (role, notification, onlyLoggedIn = true) => {
  // This is a wrapper around the broadcastNotification controller function
  // We're not calling it directly to avoid circular dependencies
  // Instead, we'll use the DeviceToken model to get the tokens
  
  const DeviceToken = require('../models/DeviceToken');
  const User = require('../models/User');
  
  try {
    // Find users with the specified role
    const users = await User.find({ role, isActive: true }).select('_id');
    const userIds = users.map(user => user._id);
    
    // Build query for device tokens
    const query = { userId: { $in: userIds } };
    
    // Filter by login status if specified
    if (onlyLoggedIn) {
      query.isLoggedIn = true;
    }
    
    // Get tokens
    const deviceTokens = await DeviceToken.find(query);
    const tokens = deviceTokens.map(token => token.expoPushToken);
    
    if (tokens.length === 0) {
      return {
        success: false,
        message: "No device tokens found matching the criteria"
      };
    }
    
    // Send notification
    const result = await deviceTokenController.sendPushNotifications(tokens, notification);
    
    return {
      success: true,
      recipientCount: tokens.length,
      ...result
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Send a notification to all users
 * @param {Object} notification - The notification object
 * @param {string} notification.title - The notification title
 * @param {string} notification.body - The notification body
 * @param {Object} notification.data - Additional data to send with the notification
 * @param {boolean} onlyLoggedIn - Whether to send only to logged-in users
 * @returns {Promise<Object>} - Result of the notification send operation
 */
exports.sendToAll = async (notification, onlyLoggedIn = true) => {
  const DeviceToken = require('../models/DeviceToken');
  
  try {
    // Build query for device tokens
    const query = {};
    
    // Filter by login status if specified
    if (onlyLoggedIn) {
      query.isLoggedIn = true;
    }
    
    // Get tokens
    const deviceTokens = await DeviceToken.find(query);
    const tokens = deviceTokens.map(token => token.expoPushToken);
    
    if (tokens.length === 0) {
      return {
        success: false,
        message: "No device tokens found"
      };
    }
    
    // Send notification
    const result = await deviceTokenController.sendPushNotifications(tokens, notification);
    
    return {
      success: true,
      recipientCount: tokens.length,
      ...result
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Send a notification to specific device tokens
 * @param {Array<string>} tokens - Array of Expo push tokens
 * @param {Object} notification - The notification object
 * @param {string} notification.title - The notification title
 * @param {string} notification.body - The notification body
 * @param {Object} notification.data - Additional data to send with the notification
 * @returns {Promise<Object>} - Result of the notification send operation
 */
exports.sendToTokens = async (tokens, notification) => {
  if (!tokens || tokens.length === 0) {
    return {
      success: false,
      message: "No tokens provided"
    };
  }
  
  try {
    const result = await deviceTokenController.sendPushNotifications(tokens, notification);
    
    return {
      success: true,
      ...result
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}; 