const { validationResult } = require("express-validator");
const DeviceToken = require("../models/DeviceToken");
const User = require("../models/User");
const NotificationHistory = require("../models/NotificationHistory");
const { Expo } = require("expo-server-sdk");

// Initialize Expo SDK
const expo = new Expo();

/**
 * Register a new device token
 * @route POST /api/device-tokens/register
 */
exports.registerDeviceToken = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { expoPushToken, deviceInfo } = req.body;

    // Validate the Expo push token format
    if (!Expo.isExpoPushToken(expoPushToken)) {
      return res.status(400).json({
        message: "Invalid Expo push token format",
      });
    }

    // Check if token already exists
    let deviceToken = await DeviceToken.findOne({ expoPushToken });

    if (deviceToken) {
      // Update existing token
      deviceToken.lastSeen = new Date();

      // If user is logged in, update userId
      if (req.userId) {
        deviceToken.userId = req.userId;
        deviceToken.isLoggedIn = true;
      }

      // Update device info if provided
      if (deviceInfo) {
        deviceToken.deviceInfo = deviceInfo;
      }

      await deviceToken.save();

      return res.status(200).json({
        message: "Device token updated successfully",
        deviceToken,
      });
    }

    // Create new token
    deviceToken = new DeviceToken({
      expoPushToken,
      deviceInfo: deviceInfo || {},
      lastSeen: new Date(),
      isNewUser: true,
    });

    // If user is logged in, associate with user
    if (req.userId) {
      deviceToken.userId = req.userId;
      deviceToken.isLoggedIn = true;
    }

    await deviceToken.save();

    res.status(201).json({
      message: "Device token registered successfully",
      deviceToken,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update device token when user logs in
 * @route PUT /api/device-tokens/login
 */
exports.loginUser = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { expoPushToken } = req.body;

    // Find the device token
    const deviceToken = await DeviceToken.findOne({ expoPushToken });

    if (!deviceToken) {
      return res.status(404).json({ message: "Device token not found" });
    }

    // Update with user info
    deviceToken.userId = req.userId;
    deviceToken.isLoggedIn = true;
    deviceToken.lastSeen = new Date();

    await deviceToken.save();

    res.status(200).json({
      message: "Device token updated with user login",
      deviceToken,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update device token when user logs out
 * @route PUT /api/device-tokens/logout
 */
exports.logoutUser = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { expoPushToken } = req.body;

    // Find the device token
    const deviceToken = await DeviceToken.findOne({ expoPushToken });

    if (!deviceToken) {
      return res.status(404).json({ message: "Device token not found" });
    }

    // Update to remove user association but keep the token
    deviceToken.isLoggedIn = false;
    deviceToken.lastSeen = new Date();
    // Don't remove userId to maintain history

    await deviceToken.save();

    res.status(200).json({
      message: "Device token updated with user logout",
      deviceToken,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Deregister a device token
 * @route DELETE /api/device-tokens/deregister
 */
exports.deregisterDeviceToken = async (req, res, next) => {
  try {
    const { expoPushToken } = req.body;

    // Delete the token
    const result = await DeviceToken.deleteOne({ expoPushToken });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Device token not found" });
    }

    res.status(200).json({
      message: "Device token deregistered successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all device tokens (admin only)
 * @route GET /api/device-tokens
 */
exports.getAllDeviceTokens = async (req, res, next) => {
  try {
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Filters
    const filter = {};
    if (req.query.isLoggedIn) {
      filter.isLoggedIn = req.query.isLoggedIn === "true";
    }
    if (req.query.userId) {
      filter.userId = req.query.userId;
    }

    const tokens = await DeviceToken.find(filter)
      .populate("userId", "name email userName role")
      .sort({ lastSeen: -1 })
      .skip(skip)
      .limit(limit);

    const total = await DeviceToken.countDocuments(filter);

    res.status(200).json({
      deviceTokens: tokens,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get device tokens for a specific user
 * @route GET /api/device-tokens/user/:userId
 */
exports.getUserDeviceTokens = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const tokens = await DeviceToken.find({ userId }).sort({ lastSeen: -1 });

    res.status(200).json({
      deviceTokens: tokens,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Send notification to specific devices
 * @route POST /api/device-tokens/send-notification
 */
exports.sendNotification = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, body, data, tokens } = req.body;

    // Handle uploaded image file
    let imageUrl = null;
    if (req.file) {
      if (req.file.s3Url) {
        // S3 mode
        imageUrl = req.file.s3Url;
      } else {
        // Local mode - construct URL
        const protocol = req.protocol;
        const host = req.get("host");
        const uploadType = req.body.uploadType || "notifications";
        imageUrl = `${protocol}://${host}/uploads/${uploadType}/${req.file.filename}`;
      }
    }

    // Validate tokens
    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      return res.status(400).json({
        message: "At least one device token is required",
      });
    }

    // Send notification
    const result = await sendPushNotifications(tokens, {
      title,
      body,
      data: data || {},
      imageUrl,
    });

    // Save notification history
    const notificationHistory = new NotificationHistory({
      title,
      body,
      data: data || {},
      imageUrl,
      tokens,
      sentTo: ["Specific Devices"],
      sentBy: req.userId || null,
      status:
        result.failed > 0
          ? result.successful > 0
            ? "partial"
            : "failed"
          : "success",
      successCount: result.successful,
      failureCount: result.failed,
    });

    await notificationHistory.save();

    res.status(200).json({
      message: "Notifications sent",
      result,
      notificationId: notificationHistory._id,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Send notification to all users or filtered by role
 * @route POST /api/device-tokens/broadcast
 */
exports.broadcastNotification = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, body, data, role, onlyLoggedIn } = req.body;

    // Handle uploaded image file
    let imageUrl = null;
    if (req.file) {
      if (req.file.s3Url) {
        // S3 mode
        imageUrl = req.file.s3Url;
      } else {
        // Local mode - construct URL
        const protocol = req.protocol;
        const host = req.get("host");
        const uploadType = req.body.uploadType || "notifications";
        imageUrl = `${protocol}://${host}/uploads/${uploadType}/${req.file.filename}`;
      }
    }

    // Build query for device tokens
    const query = {};

    // Filter by role if specified
    if (role) {
      // First find users with the specified role
      const users = await User.find({ role, isActive: true }).select("_id");
      const userIds = users.map((user) => user._id);
      query.userId = { $in: userIds };
    }

    // Filter by login status if specified
    if (onlyLoggedIn) {
      query.isLoggedIn = true;
    }

    // Get tokens
    const deviceTokens = await DeviceToken.find(query);
    const tokens = deviceTokens.map((token) => token.expoPushToken);

    if (tokens.length === 0) {
      return res.status(404).json({
        message: "No device tokens found matching the criteria",
      });
    }

    // Send notification
    const result = await sendPushNotifications(tokens, {
      title,
      body,
      data: data || {},
      imageUrl,
    });

    // Determine recipients description
    let sentTo = ["All Users"];
    if (role) {
      sentTo = [`All ${role.charAt(0).toUpperCase() + role.slice(1)}s`];
    }
    if (onlyLoggedIn) {
      sentTo = sentTo.map((recipient) => `${recipient} (Logged In)`);
    }

    // Save notification history
    const notificationHistory = new NotificationHistory({
      title,
      body,
      data: data || {},
      imageUrl,
      tokens,
      sentTo,
      sentBy: req.userId || null,
      status:
        result.failed > 0
          ? result.successful > 0
            ? "partial"
            : "failed"
          : "success",
      successCount: result.successful,
      failureCount: result.failed,
      targetRole: role,
      onlyLoggedIn,
    });

    await notificationHistory.save();

    res.status(200).json({
      message: "Broadcast sent",
      recipientCount: tokens.length,
      result,
      notificationId: notificationHistory._id,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get notification history
 * @route GET /api/device-tokens/notification-history
 */
exports.getNotificationHistory = async (req, res, next) => {
  try {
    // Pagination and filtering
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const { search, status, sort = "createdAt", order = "desc" } = req.query;

    // Build query
    let query = {};

    // Search functionality
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { body: { $regex: search, $options: "i" } },
      ];
    }
    // Status filter
    if (status) {
      query.status = status;
    }

    // Build sort object
    const sortObj = {};
    sortObj[sort] = order === "asc" ? 1 : -1;

    // Fetch notifications and total count in parallel for speed
    const [notifications, total] = await Promise.all([
      NotificationHistory.find(query)
        .select("title body imageUrl createdAt status sentBy sentTo successCount failureCount targetRole onlyLoggedIn") // select only required fields for speed
        .populate({ path: "sentBy", select: "name email userName" })
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .lean(), // use lean for faster reads, returns plain JS objects
      NotificationHistory.countDocuments(query)
    ]);

    res.status(200).json({
      notifications,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalCount: total,
        limit: limit,
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Utility function to send push notifications
 * This can be used anywhere in the backend
 */
// assume `expo` is new Expo() from expo-server-sdk
const sendPushNotifications = async (
  tokens,
  { title, body, data = {}, imageUrl }
) => {
  const messages = [];

  for (let pushToken of tokens) {
    if (!Expo.isExpoPushToken(pushToken)) {
      console.warn(`Invalid Expo push token: ${pushToken}`);
      continue;
    }

    const message = {
      to: pushToken,
      sound: "default",
      title,
      body,
      data,
      badge: 1,
      priority: "high",
      // Tell iOS to call a Notification Service Extension
      mutableContent: true,
    };

    // Use Expo's richContent object for media
    if (imageUrl) {
      message.richContent = { image: imageUrl }; // <- important
    }

    messages.push(message);
  }

  const chunks = expo.chunkPushNotifications(messages);
  const tickets = [];

  for (let chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    } catch (err) {
      console.error("Error sending push notifications:", err);
    }
  }

  // receipts handling (same idea as you already have)...
  return {
    sent: tickets.length,
    successful: tickets.filter((t) => t.status === "ok").length,
    failed: tickets.filter((t) => t.status === "error").length,
  };
};

// Export the utility function for use elsewhere in the app
exports.sendPushNotifications = sendPushNotifications;

// Utility function to send notification to a specific user
exports.sendNotificationToUser = async (
  userId,
  { title, body, data = {}, imageUrl }
) => {
  try {
    // Find all device tokens for this user
    const deviceTokens = await DeviceToken.find({
      userId,
      isLoggedIn: true,
    });

    if (!deviceTokens || deviceTokens.length === 0) {
      return {
        success: false,
        message: "No active devices found for this user",
      };
    }

    const tokens = deviceTokens.map((token) => token.expoPushToken);

    // Send the notification
    const result = await sendPushNotifications(tokens, {
      title,
      body,
      data,
      imageUrl,
    });

    return {
      success: true,
      ...result,
    };
  } catch (error) {
    console.error("Error sending notification to user:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};
