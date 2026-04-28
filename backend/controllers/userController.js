const User = require("../models/User");
const bcrypt = require("bcryptjs");

// Function to get user profile
exports.getUserProfile = async (req, res, next) => {
  try {
    // console.log("req.userId", req.userId);
    // Fetch user details using req.userId
    const user = await User.findById(req.userId).select(
      [
        "_id",
        "name",
        "email",
        "phoneNumber",
        "userName",
        "tempUser",
        "gender",
        "dateOfBirth",
        "language",
        "lastLogin",
        "isActive",
        "isDeleted",
        "isVerified",
        "hasUpdatedProfile",
        "interests",
        "profilePicture",
        "bio",
        "role",
        "accessPermissions",
        "credits",
        "welcomeCreditsGranted",
        "organizationId",
        "activeSubscriptionId",
        "enterpriseManual",
        "preferences",
        "createdAt",
        "updatedAt",
      ].join(" ")
    );
    // console.log("user", user);
    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }
    // Return user data
    res.json(user);
  } catch (err) {
    next(err); // Pass error to error handling middleware
  }
};

// Function to get user details by ID (public endpoint)
exports.getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Fetch user details by ID
    const user = await User.findById(id).select("-password -accessPermissions");
    if (!user || user.isDeleted) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    // Return user data (excluding sensitive information)
    res.json({
      _id: user._id,
      name: user.name,
      userName: user.userName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      gender: user.gender,
      dateOfBirth: user.dateOfBirth,
      profilePicture: user.profilePicture,
      bio: user.bio,
      role: user.role,
      isVerified: user.isVerified,
      isActive: user.isActive,
      socialLinks: user.socialLinks,
      badges: user.badges,
      streakCount: user.streakCount,
      skillLevel: user.skillLevel,
      language: user.language,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  } catch (err) {
    next(err); // Pass error to error handling middleware
  }
};

// Function to update user profile
exports.updateUserProfile = async (req, res, next) => {
  const {
    name,
    email,
    phoneNumber,
    userName,
    bio,
    role,
    password,
    gender,
    dateOfBirth,
    language,
    skillLevel,
    preferences,
  } = req.body;
  let socialLinks = {};
  let accessPermissions = [];
  let parsedPreferences = undefined;

  try {
    // Parse socialLinks if provided as string
    if (req.body.socialLinks) {
      try {
        socialLinks = JSON.parse(req.body.socialLinks);
      } catch (e) {
        // If parsing fails, use the original value
        socialLinks = req.body.socialLinks;
      }
    }

    // Parse preferences if provided as string
    if (typeof preferences !== "undefined") {
      try {
        parsedPreferences =
          typeof preferences === "string"
            ? JSON.parse(preferences)
            : preferences;
      } catch (e) {
        parsedPreferences = preferences;
      }
    }

    // Parse accessPermissions if provided as string
    if (req.body.accessPermissions) {
      try {
        accessPermissions = JSON.parse(req.body.accessPermissions);
      } catch (e) {
        // If parsing fails, use the original value
        accessPermissions = req.body.accessPermissions;
      }
    }

    // Fetch user by userId or by provided ID for admin operations
    const userId = req.params.id || req.userId;
    const isAdminUpdate = Boolean(req.params.id);
    let user = await User.findById(userId);

    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    // Update user details
    if (name) user.name = name;
    if (email) user.email = email;
    if (phoneNumber) user.phoneNumber = phoneNumber;
    if (userName) user.userName = userName;
    if (bio) user.bio = bio;
    if (gender) user.gender = gender;
    if (dateOfBirth) user.dateOfBirth = new Date(dateOfBirth);
    if (language) user.language = language;
    if (skillLevel) user.skillLevel = skillLevel;

    // Update nested preferences if present (supports partial updates)
    if (parsedPreferences && typeof parsedPreferences === "object") {
      user.preferences = {
        ...user.preferences,
        ...["emailNotifications", "pushNotifications", "darkMode"].reduce(
          (acc, key) => {
            if (Object.prototype.hasOwnProperty.call(parsedPreferences, key)) {
              acc[key] = parsedPreferences[key];
            }
            return acc;
          },
          {}
        ),
      };
    }
    // Role/accessPermissions updates should never be allowed on self-update.
    // Only allow role changes on the admin path (`/update-profile/:id`).
    if (
      isAdminUpdate &&
      role &&
      ["instructor", "influencer", "admin", "sub-admin"].includes(role)
    ) {
      user.role = role;

      // Handle access permissions for sub-admin
      if (role === "sub-admin" && Array.isArray(accessPermissions)) {
        user.accessPermissions = accessPermissions;
      } else if (role !== "sub-admin") {
        // Clear permissions for non-sub-admin roles
        user.accessPermissions = [];
      }
    }

    // Update social links if provided
    if (Object.keys(socialLinks).length > 0) {
      user.socialLinks = {
        ...user.socialLinks,
        ...socialLinks,
      };
    }

    // Update password if provided
    if (password && password.trim() !== "") {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
    }

    // Update profile picture if uploaded
    if (req.file) {
      // Store S3 object key when available; fall back to local path in non-S3 mode
      user.profilePicture = (req.file.s3Key || req.file.path || "").replace(/\\/g, "/");
    }

    // Check if this is the first profile update using the hasUpdatedProfile field
    const isFirstProfileUpdate = !user.hasUpdatedProfile;
    
    // Save updated user data
    user = await user.save();

    // Award XP for first-time profile update and mark as updated
    if (isFirstProfileUpdate && (bio || gender || dateOfBirth || language || skillLevel || req.file)) {
      try {
        
        // Mark that user has updated their profile
        user.hasUpdatedProfile = true;
        await user.save();
      } catch (xpError) {
        console.error("Error awarding profile update XP:", xpError);
        // Don't fail the profile update if XP award fails
      }
    }

    // Return updated user data
    res.status(200).json({
      message: "Profile updated successfully",
      user,
    });
  } catch (err) {
    next(err); // Pass error to error handling middleware
  }
};

// Function to create a new user (admin only)
exports.createUser = async (req, res, next) => {
  const {
    name,
    email,
    userName,
    phoneNumber,
    password,
    role,
    bio,
    gender,
    dateOfBirth,
  } = req.body;
  let socialLinks = {};
  let accessPermissions = [];

  try {
    // Parse socialLinks if provided as string
    if (req.body.socialLinks) {
      try {
        socialLinks = JSON.parse(req.body.socialLinks);
      } catch (e) {
        // If parsing fails, use the original value
        socialLinks = req.body.socialLinks;
      }
    }

    // Parse accessPermissions if provided as string
    if (req.body.accessPermissions) {
      try {
        accessPermissions = JSON.parse(req.body.accessPermissions);
      } catch (e) {
        // If parsing fails, use the original value
        accessPermissions = req.body.accessPermissions;
      }
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      email: email.toLowerCase(),
    });

    // Create new user
    const user = new User({
      name,
      email: email.toLowerCase(),
      userName,
      phoneNumber,
      bio,
      gender: gender || "prefer-not-to-say",
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      role: role || "instructor",
      socialLinks,
      isVerified: true, // Auto-verify users created by admin
    });

    // Handle access permissions for sub-admin
    if (role === "sub-admin" && Array.isArray(accessPermissions)) {
      user.accessPermissions = accessPermissions;
    }

    // Hash password
    if (password && password.trim() !== "") {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
    }

    // Add profile picture if uploaded
    if (req.file) {
      // Store S3 object key when available; fall back to local path in non-S3 mode
      user.profilePicture = (req.file.s3Key || req.file.path || "").replace(/\\/g, "/");
    }

    // Save user
    await user.save();

    res.status(201).json({
      message: "User created successfully",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        userName: user.userName,
        role: user.role,
        accessPermissions: user.accessPermissions,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Function to update user language preference
exports.updateLanguage = async (req, res, next) => {
  const { language } = req.body;

  try {
    let user = await User.findById(req.userId);
    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    user.language = language;
    user = await user.save();

    res.status(200).json({ message: "Language updated successfully", user });
  } catch (err) {
    next(err);
  }
};

// Function to update user skill level
exports.updateSkillLevel = async (req, res, next) => {
  const { skillLevel } = req.body;

  try {
    let user = await User.findById(req.userId);
    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    user.skillLevel = skillLevel;
    user = await user.save();

    res.status(200).json({ message: "Skill level updated successfully", user });
  } catch (err) {
    next(err);
  }
};

// Function to award a badge to user
exports.awardBadge = async (req, res, next) => {
  const { badge } = req.body;

  try {
    let user = await User.findById(req.userId);
    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    // Check if badge already exists
    if (!user.badges.includes(badge)) {
      user.badges.push(badge);
      user = await user.save();
    }

    res
      .status(200)
      .json({ message: "Badge awarded successfully", badges: user.badges });
  } catch (err) {
    next(err);
  }
};

// Function to remove a badge from user
exports.removeBadge = async (req, res, next) => {
  const { badge } = req.body;

  try {
    let user = await User.findById(req.userId);
    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    user.badges = user.badges.filter((b) => b !== badge);
    user = await user.save();

    res
      .status(200)
      .json({ message: "Badge removed successfully", badges: user.badges });
  } catch (err) {
    next(err);
  }
};

// Function to update user streak count
exports.updateStreak = async (req, res, next) => {
  const { streakCount } = req.body;

  try {
    let user = await User.findById(req.userId);
    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    user.streakCount = streakCount;
    user = await user.save();

    res
      .status(200)
      .json({
        message: "Streak updated successfully",
        streakCount: user.streakCount,
      });
  } catch (err) {
    next(err);
  }
};

// Function to increment streak count
exports.incrementStreak = async (req, res, next) => {
  try {
    let user = await User.findById(req.userId);
    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    user.streakCount += 1;
    user.lastLogin = new Date();
    user = await user.save();

    res
      .status(200)
      .json({
        message: "Streak incremented successfully",
        streakCount: user.streakCount,
      });
  } catch (err) {
    next(err);
  }
};

// Function to verify user
exports.verifyUser = async (req, res, next) => {
  try {
    const userId = req.params.id || req.userId;
    let user = await User.findById(userId);
    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    user.isVerified = true;
    user = await user.save();

    res.status(200).json({ message: "User verified successfully", user });
  } catch (err) {
    next(err);
  }
};

// Function to deactivate user account
exports.deactivateAccount = async (req, res, next) => {
  try {
    const userId = req.body.userId || req.userId;
    let user = await User.findById(userId);
    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    user.isActive = false;
    user = await user.save();

    res.status(200).json({ message: "Account deactivated successfully" });
  } catch (err) {
    next(err);
  }
};

// Function to reactivate user account
exports.reactivateAccount = async (req, res, next) => {
  try {
    const userId = req.body.userId || req.userId;
    let user = await User.findById(userId);
    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    user.isActive = true;
    user = await user.save();

    res.status(200).json({ message: "Account reactivated successfully", user });
  } catch (err) {
    next(err);
  }
};

// Function to delete user account (soft delete)
exports.deleteAccount = async (req, res, next) => {
  try {
    const userId = req.params.id || req.userId;
    let user = await User.findById(userId);
    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    user.isDeleted = true;
    user.isActive = false;
    user = await user.save();

    res.status(200).json({ message: "Account deleted successfully" });
  } catch (err) {
    next(err);
  }
};

// Function for admin to get all users with filters/pagination/sorting
exports.getAllUsers = async (req, res, next) => {
  try {
    const {
      role,
      userName,
      email,
      isActive,
      isVerified,
      search,
      createdAfter,
      createdBefore,
      excludeStudents,
      page = 1,
      limit = 20,
      sort = "createdAt",
      order = "desc",
    } = req.query;
    console.log("req.query", req.query);

    // Include users where isDeleted is false or where isDeleted does not exist (so those users are not soft-deleted)
    const filter = { $or: [ { isDeleted: false }, { isDeleted: { $exists: false } } ] };

    // Handle role filtering
    if (excludeStudents === "true") {
      filter.role = { $nin: ["student", "admin"] };
    } else if (role) {
      filter.role = role;
    }
    if (typeof userName === "string" && userName.trim() !== "") {
      filter.userName = userName.trim().toUpperCase();
    }
    if (typeof email === "string" && email.trim() !== "") {
      filter.email = email.trim().toLowerCase();
    }
    if (typeof isActive !== "undefined") {
      if (["true", "false", true, false].includes(isActive)) {
        filter.isActive = String(isActive) === "true";
      }
    }
    if (typeof isVerified !== "undefined") {
      if (["true", "false", true, false].includes(isVerified)) {
        filter.isVerified = String(isVerified) === "true";
      }
    }

    // Text search across name, email, userName
    if (typeof search === "string" && search.trim() !== "") {
      const term = search.trim();
      filter.$or = [
        { name: { $regex: term, $options: "i" } },
        { email: { $regex: term, $options: "i" } },
        { userName: { $regex: term.toUpperCase(), $options: "i" } },
      ];
    }

    // Date range on createdAt
    if (createdAfter || createdBefore) {
      filter.createdAt = {};
      if (createdAfter) filter.createdAt.$gte = new Date(createdAfter);
      if (createdBefore) filter.createdAt.$lte = new Date(createdBefore);
    }

    const numericLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const numericPage = Math.max(1, parseInt(page, 10) || 1);
    const skip = (numericPage - 1) * numericLimit;

    const sortDir = String(order).toLowerCase() === "asc" ? 1 : -1;
    const sortSpec = { [sort]: sortDir };

    console.log("filter", filter);

    const [total, users] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter).sort(sortSpec).skip(skip).limit(numericLimit),
    ]);
    console.log("total", total);

    res.status(200).json({
      data: users,
      page: numericPage,
      limit: numericLimit,
      total,
      totalPages: Math.ceil(total / numericLimit) || 1,
      sort,
      order: sortDir === 1 ? "asc" : "desc",
      filter,
    });
  } catch (err) {
    next(err);
  }
};

// Function to get users by role
exports.getUsersByRole = async (req, res, next) => {
  const { role } = req.params;

  try {
    if (
      !["student", "instructor", "influencer", "admin", "sub-admin"].includes(
        role
      )
    ) {
      const error = new Error("Invalid role specified");
      error.statusCode = 400;
      throw error;
    }

    const users = await User.find({ role, isDeleted: false });
    res.status(200).json(users);
  } catch (err) {
    next(err);
  }
};
