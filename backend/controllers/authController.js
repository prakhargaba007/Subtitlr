const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { validationResult } = require("express-validator");
const User = require("../models/User.js");
const { createOTP, sendOTPEmail, verifyOTP } = require("../utils/otpUtils");
const { OAuth2Client } = require("google-auth-library");

// Function to create a temporary user
exports.createTempUser = async (req, res, next) => {
  try {
    console.log("createTempUser endpoint called");

    // Generate a unique username for temp user
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    let userName = `TEMP_${timestamp}_${randomStr}`;
    console.log(`Generated initial temp username: ${userName}`);

    // Ensure username uniqueness
    let suffix = 0;
    while (await User.findOne({ userName: userName.toUpperCase() })) {
      suffix += 1;
      userName = `TEMP_${timestamp}_${randomStr}_${suffix}`;
      console.log(`Temp username already exists, trying: ${userName}`);
    }

    // Create temporary user
    const tempUser = new User({
      name: `Guest User`,
      userName: userName,
      tempUser: true,
      isVerified: false,
    });

    console.log("Saving tempUser to database:", tempUser);

    await tempUser.save();

    console.log(`Temp user saved. ID: ${tempUser._id}, Username: ${tempUser.userName}`);

    // Create JWT token
    const payload = {
      user: {
        id: tempUser._id,
        role: tempUser.role,
        accessPermissions: tempUser.accessPermissions || [],
      },
    };

    console.log("JWT payload:", payload);

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      (err, token) => {
        if (err) {
          console.error("JWT sign error:", err);
          next(err);
        } else {
          res.json({
            success: true,
            message: "Temporary user created successfully",
            token,
            userId: tempUser._id,
            user: {
              _id: tempUser._id,
              name: tempUser.name,
              userName: tempUser.userName,
              tempUser: tempUser.tempUser,
              role: tempUser.role,
              accessPermissions: tempUser.accessPermissions || [],
            },
          });
        }
      }
    );
  } catch (error) {
    console.error("Error creating temporary user:", error);
    next(error);
  }
};

exports.optGenerte = async (req, res, next) => {
  try {
    const { email, purpose = "email_verification" } = req.body;
    // console.log("req.body");

    if (!email) {
      const error = new Error("Email is required");
      error.statusCode = 400;
      throw error;
    }

    // Find user by email
    let user = await User.findOne({ email: email.toLowerCase() });
    
    // If user doesn't exist, create a temporary user for OTP verification
    if (!user) {
      // Generate a temporary username from email
      const baseUserName = email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "");
      let candidateUserName = baseUserName || "USER";
      let suffix = 0;
      
      // Ensure username uniqueness
      while (await User.findOne({ userName: candidateUserName.toUpperCase() })) {
        suffix += 1;
        candidateUserName = `${baseUserName}${suffix}`;
      }

      // Create temporary user
      user = new User({
        name: baseUserName,
        email: email.toLowerCase(),
        userName: candidateUserName,
        isVerified: false, // Will be verified after OTP confirmation
      });
      await user.save();
    }

    // Create and send OTP
    const otpDoc = await createOTP(user._id, email, purpose);
    await sendOTPEmail(email, otpDoc.otp, purpose, user.name);

    res.status(200).json({
      success: true,
      message: "OTP sent successfully to your email",
    });
  } catch (error) {
    console.error("Error generating OTP:", error);
    next(error);
  }
};

// Function to handle user signup
exports.signup = async (req, res, next) => {
  // Extract validation errors from the request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, email, password, phoneNumber, userName } = req.body;

  try {
    // Check for required fields
    if (!userName) {
      const error = new Error("Username is required");
      error.statusCode = 400;
      throw error;
    }

    if (!name) {
      const error = new Error("Name is required");
      error.statusCode = 400;
      throw error;
    }

    if (!email) {
      const error = new Error("Email is required");
      error.statusCode = 400;
      throw error;
    }

    if (!password) {
      const error = new Error("Password is required");
      error.statusCode = 400;
      throw error;
    }

    // Check if the user already exists by email
    let user = await User.findOne({ email });
    if (user) {
      const error = new Error("User already exists with this email");
      error.statusCode = 400;
      throw error;
    }

    // Check if the username already exists
    user = await User.findOne({ userName: userName.toUpperCase() });
    if (user) {
      const error = new Error("Username already exists");
      error.statusCode = 400;
      throw error;
    }

    // Create a new user instance
    user = new User({
      name,
      email: email.toLowerCase(),
      password,
      phoneNumber,
      userName,
    });

    // Generate salt and hash the password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    // Save the user to the database
    await user.save();


    const payload = {
      user: {
        id: user._id,
        // role: user.role,
      },
    };

    jwt.sign(payload, process.env.JWT_SECRET, (err, token) => {
      if (err) {
        next(err); // Pass error to error handling middleware
      } else {
        res.json({
          message: "User created successfully",
          token,
          userId: user._id,
          user: {
            _id: user._id,
            name: user.name,
            email: user.email,
            userName: user.userName,
            // role: user.role,
          },
        });
      }
    });

    // res.status(200).json(user);
  } catch (err) {
    next(err); // Pass error to error handling middleware
  }
};

// Function to handle user login
exports.login = async (req, res, next) => {
  // Extract validation errors from the request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id, password, provider, idToken, name, photo } = req.body;
  console.log(req.body);

  try {
    // Determine if id is email or username
    let user = null;
    if (id && typeof id === "string" && id.includes("@")) {
      // id is an email
      user = await User.findOne({ email: id.toLowerCase() });
    } else if (id && typeof id === "string") {
      // id is a username
      user = await User.findOne({ userName: id.toUpperCase() });
    }

    if (!user) {
      // If provider is google, auto-provision the user
      if (provider === "google") {
        if (!id || !id.includes("@")) {
          const error = new Error("Valid email required for Google login");
          error.statusCode = 400;
          throw error;
        }

        // Create user with minimal fields. Use email local-part as base username.
        const baseUserName = id.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "");
        let candidateUserName = baseUserName || "USER";
        // Ensure username uniqueness by appending a counter if needed
        let suffix = 0;
        // usernames are stored uppercased as per schema setter
        while (
          await User.findOne({ userName: candidateUserName.toUpperCase() })
        ) {
          suffix += 1;
          candidateUserName = `${baseUserName}${suffix}`;
        }

        user = new User({
          name: name || baseUserName,
          email: id.toLowerCase(),
          userName: candidateUserName,
          isVerified: true,
          profilePicture: photo,
        });
        await user.save();

      } else {
        const error = new Error("Invalid credentials");
        error.statusCode = 400;
        throw error;
      }
    }

    // Validate the password for non-google logins
    if (provider !== "google") {
      const isMatch = await bcrypt.compare(password, user.password || "");
      if (!isMatch) {
        const error = new Error("Invalid Password");
        error.statusCode = 400;
        throw error;
      }
    }

    // Create and return a JWT token
    const payload = {
      user: {
        id: user._id,
        role: user.role,
        accessPermissions: user.accessPermissions || [],
      },
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      // { expiresIn: "1h" },
      (err, token) => {
        if (err) {
          next(err); // Pass error to error handling middleware
        } else {
          res.json({
            token,
            userId: user._id,
            user: {
              _id: user._id,
              name: user.name,
              email: user.email,
              userName: user.userName,
              profilePicture: user.profilePicture,
              role: user.role,
              accessPermissions: user.accessPermissions || [],
            },
          });
        }
      }
    );
  } catch (err) {
    next(err); // Pass error to error handling middleware
  }
};

// Function to handle forgot password
exports.forgotPassword = async (req, res, next) => {
  // Extract validation errors from the request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email } = req.body;
  let id = email;

  try {
    let user = null;
    user = await User.findOne({ email: id.toLowerCase() });

    if (!user) {
      const error = new Error("User not found with this email");
      error.statusCode = 404;
      throw error;
    }

    // Create and send OTP for password reset
    const otpDoc = await createOTP(user._id, user.email, "password_reset");
    await sendOTPEmail(user.email, otpDoc.otp, "password_reset", user.name);

    res.status(200).json({
      success: true,
      message: "Password reset OTP sent to your email",
      email: user.email, // Send back the email for frontend reference
    });
  } catch (err) {
    console.error("Error in forgot password:", err);
    next(err);
  }
};

// Function to handle reset password (for logged in users)
exports.resetPassword = async (req, res, next) => {
  // Extract validation errors from the request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { currentPassword, newPassword } = req.body;

  try {
    // Find the user by req.userId (from auth middleware)
    const userId = req.userId;
    const user = await User.findById(userId);

    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    if (!user.password) {
      const error = new Error("User password is undefined");
      error.statusCode = 400;
      throw error;
    }

    // Verify the current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      const error = new Error("Current password is incorrect");
      error.statusCode = 400;
      throw error;
    }

    // Check if the new password is the same as the current password
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      const error = new Error(
        "New password must be different from the current password"
      );
      error.statusCode = 400;
      throw error;
    }

    // Hash the new password and save it to the user's document
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password has been reset successfully",
    });
  } catch (err) {
    next(err); // Pass error to error handling middleware
  }
};

// Function to verify OTP and reset password (for forgot password flow)
exports.verifyOTPAndResetPassword = async (req, res, next) => {
  // Extract validation errors from the request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, otp, newPassword } = req.body;

  try {
    if (!email || !otp || !newPassword) {
      const error = new Error("Email, OTP, and new password are required");
      error.statusCode = 400;
      throw error;
    }

    // Verify the OTP
    const otpResult = await verifyOTP(email, otp, "password_reset");

    if (!otpResult.success) {
      const error = new Error(otpResult.message);
      error.statusCode = 400;
      throw error;
    }

    const user = otpResult.user;

    // Check if the new password is the same as the current password
    if (user.password) {
      const isSamePassword = await bcrypt.compare(newPassword, user.password);
      if (isSamePassword) {
        const error = new Error(
          "New password must be different from the current password"
        );
        error.statusCode = 400;
        throw error;
      }
    }

    // Hash the new password and save it to the user's document
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password has been reset successfully",
    });
  } catch (err) {
    console.error("Error in verify OTP and reset password:", err);
    next(err);
  }
};

// Function to verify OTP for sign-in
exports.verifyOTPForSignIn = async (req, res, next) => {
  const { email, otp, purpose = "email_verification", tempUserId } = req.body;

  try {
    if (!email || !otp) {
      const error = new Error("Email and OTP are required");
      error.statusCode = 400;
      throw error;
    }

    // Verify the OTP
    const otpResult = await verifyOTP(email, otp, purpose);

    if (!otpResult.success) {
      const error = new Error(otpResult.message);
      error.statusCode = 400;
      throw error;
    }

    let user = otpResult.user;

    // If tempUserId is provided, check if we should convert temp user to verified
    if (tempUserId && tempUserId !== user._id.toString()) {
      // Check if tempUserId exists and is a temp user
      const tempUser = await User.findById(tempUserId);
      if (tempUser && tempUser.tempUser) {
        // Convert the temp user to a verified user to preserve all references
        
        // Update temp user with verified email and remove temp status
        tempUser.email = email.toLowerCase();
        tempUser.isVerified = true;
        tempUser.tempUser = false;
        
        if (user.name && !tempUser.name) {
          tempUser.name = user.name;
        }
        
        if (user.profilePicture && !tempUser.profilePicture) {
          tempUser.profilePicture = user.profilePicture;
        }
        
        await tempUser.save();
        
        // Delete the old verified user since we're keeping the temp user's ID
        await User.findByIdAndDelete(user._id);
        
        // Use temp user as the final user
        user = tempUser;
      }
    } else if (tempUserId && tempUserId === user._id.toString()) {
      // Same user, just update temp status
      user.tempUser = false;
    }

    // Mark user as verified if they weren't already
    if (!user.isVerified) {
      user.isVerified = true;
    }
    
    // Remove tempUser flag if it exists
    if (user.tempUser) {
      user.tempUser = false;
    }
    
    await user.save();

    // Create and return a JWT token
    const payload = {
      user: {
        id: user._id,
        role: user.role,
        accessPermissions: user.accessPermissions || [],
      },
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      (err, token) => {
        if (err) {
          next(err); // Pass error to error handling middleware
        } else {
          res.json({
            success: true,
            message: "OTP verified successfully",
            token,
            userId: user._id,
            user: {
              _id: user._id,
              name: user.name,
              email: user.email,
              userName: user.userName,
              profilePicture: user.profilePicture,
              role: user.role,
              accessPermissions: user.accessPermissions || [],
              tempUser: false,
            },
          });
        }
      }
    );
  } catch (err) {
    console.error("Error in verify OTP for sign-in:", err);
    next(err);
  }
};

exports.verify = async (req, res, next) => {
  try {
    const user = await User.findOne({
      _id: req.userId,
      role: { $in: ["admin", "sub-admin"] },
    });
    if (!user) {
      const error = new Error("User is not an admin or sub-admin");
      error.statusCode = 400;
      throw error;
    }
    res.status(200).json({
      message: "User verified successfully",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        userName: user.userName,
        role: user.role,
        accessPermissions: user.accessPermissions || [],
      },
    });
  } catch (err) {
    next(err);
  }
};

// Google OAuth code exchange (GIS oauth2.initCodeClient popup flow)
exports.googleExchange = async (req, res, next) => {
  try {
    const { code, tempUserId } = req.body || {};
    if (!code) {
      const error = new Error("Authorization code is required");
      error.statusCode = 400;
      throw error;
    }
    console.log("env", process.env.GOOGLE_CLIENT_ID, process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);
    

    const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = "postmessage"; // popup/code flow

    if (!clientId || !clientSecret) {
      const error = new Error("Google OAuth client credentials are not configured");
      error.statusCode = 500;
      throw error;
    }

    const oauth2Client = new OAuth2Client({ clientId, clientSecret, redirectUri });

    // Exchange code for tokens
    let tokenResponse;
    try {
      tokenResponse = await oauth2Client.getToken({ code, redirect_uri: redirectUri });
    } catch (e) {
      console.error("Error exchanging code for tokens:", e);
      const error = new Error("Failed to exchange authorization code");
      error.statusCode = 400;
      throw error;
    }

    oauth2Client.setCredentials(tokenResponse.tokens);

    // Verify ID token if available
    let idPayload = null;
    if (tokenResponse.tokens.id_token) {
      try {
        const ticket = await oauth2Client.verifyIdToken({
          idToken: tokenResponse.tokens.id_token,
          audience: clientId,
        });
        idPayload = ticket.getPayload();
      } catch (e) {
        console.warn("ID token verify failed:", e);
      }
    }

    // Fetch user info from Google
    let userInfo;
    try {
      const userInfoRes = await oauth2Client.request({
        url: "https://www.googleapis.com/oauth2/v3/userinfo",
      });
      userInfo = userInfoRes.data || {};
    } catch (e) {
      console.error("Failed to fetch Google userinfo:", e);
      const error = new Error("Failed to fetch Google profile");
      error.statusCode = 400;
      throw error;
    }

    const email = (userInfo.email || idPayload?.email || "").toLowerCase();
    if (!email) {
      const error = new Error("Google account email is missing");
      error.statusCode = 400;
      throw error;
    }

    const displayName = userInfo.name || idPayload?.name || email.split("@")[0];
    const picture = userInfo.picture || idPayload?.picture;

    // Upsert user
    let user = await User.findOne({ email });
    
    // If tempUserId is provided, check if we should convert temp user to verified
    if (tempUserId && (!user || user._id.toString() !== tempUserId)) {
      const tempUser = await User.findById(tempUserId);
      if (tempUser && tempUser.tempUser) {
        // If user exists with email but different ID, convert temp user to verified
        if (user && user._id.toString() !== tempUserId) {
          tempUser.email = email;
          tempUser.name = displayName || tempUser.name;
          tempUser.profilePicture = picture || tempUser.profilePicture;
          tempUser.isVerified = true;
          tempUser.tempUser = false;
          
          // Merge any additional data from the existing user if needed
          if (user.profilePicture && !tempUser.profilePicture) {
            tempUser.profilePicture = user.profilePicture;
          }
          
          await tempUser.save();
          
          // Delete the old verified user since we're keeping the temp user's ID
          // This ensures all existing references remain valid
          await User.findByIdAndDelete(user._id);
          
          // Use temp user as the final user
          user = tempUser;
        } else if (!user) {
          // No user with email exists, convert temp user to verified user
          tempUser.email = email;
          tempUser.name = displayName;
          tempUser.profilePicture = picture;
          tempUser.isVerified = true;
          tempUser.tempUser = false;
          await tempUser.save();
          user = tempUser;
        }
      }
    }
    
    if (!user) {
      // generate unique username based on email local part
      const baseUserName = email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "");
      let candidateUserName = baseUserName || "USER";
      let suffix = 0;
      while (await User.findOne({ userName: candidateUserName.toUpperCase() })) {
        suffix += 1;
        candidateUserName = `${baseUserName}${suffix}`;
      }
      user = new User({
        name: displayName,
        email,
        userName: candidateUserName,
        isVerified: true,
        profilePicture: picture,
      });
      await user.save();
    } else {
      // Update profile image/name if changed
      const shouldUpdate = (picture && user.profilePicture !== picture) || (displayName && user.name !== displayName);
      if (shouldUpdate) {
        user.profilePicture = picture || user.profilePicture;
        user.name = displayName || user.name;
      }
      // Remove tempUser flag if it exists
      if (user.tempUser) {
        user.tempUser = false;
      }
      await user.save();
    }

    // Issue app JWT
    const payload = {
      user: {
        id: user._id,
        role: user.role,
        accessPermissions: user.accessPermissions || [],
      },
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      (err, token) => {
        if (err) {
          next(err);
        } else {
          res.json({
            token,
            userId: user._id,
            user: {
              _id: user._id,
              name: user.name,
              email: user.email,
              userName: user.userName,
              profilePicture: user.profilePicture,
              role: user.role,
              accessPermissions: user.accessPermissions || [],
            },
            // Optionally return Google tokens if needed on client (usually not necessary)
            // googleTokens: tokenResponse.tokens,
          });
        }
      }
    );
  } catch (err) {
    next(err);
  }
};
