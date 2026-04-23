const bcrypt = require("bcryptjs");
const { validationResult } = require("express-validator");
const User = require("../models/User.js");
const SubtitleJob = require("../models/Subtitle.js");
const { createOTP, sendOTPEmail, verifyOTP } = require("../utils/otpUtils");
const { OAuth2Client } = require("google-auth-library");
const { addCredits, DEFAULT_CREDITS, SIGNUP_CREDITS } = require("../utils/creditUtils");
const { generateTokens } = require("../utils/authTokens");
const RefreshToken = require("../models/RefreshToken");
const crypto = require("crypto");

exports.optGenerte = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const first = errors.array()[0];
      return res.status(400).json({
        success: false,
        message: first?.msg || "Valid email is required",
        errors: errors.array(),
      });
    }

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
      await addCredits(user._id, DEFAULT_CREDITS, "signup_bonus", "Welcome credits");
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
    await addCredits(user._id, SIGNUP_CREDITS, "signup_bonus", "Welcome credits");

    await generateTokens(user, req, res);

    res.json({
      success: true,
      message: "User created successfully",
      userId: user._id,
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
        await addCredits(user._id, DEFAULT_CREDITS, "signup_bonus", "Welcome credits");

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

    await generateTokens(user, req, res);

    res.json({
      success: true,
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
  } catch (err) {
    next(err);
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
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const first = errors.array()[0];
    return res.status(400).json({
      success: false,
      message: first?.msg || "Validation failed",
      errors: errors.array(),
    });
  }

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

    // If tempUserId is provided, decide how to merge the temp session
    if (tempUserId && tempUserId !== user._id.toString()) {
      const tempUser = await User.findById(tempUserId);
      if (tempUser && tempUser.tempUser) {

        if (user.isVerified && !user.tempUser) {
          // RETURNING USER: real account already exists.
          // Migrate any subtitle jobs created during the temp session then discard the temp user.
          await SubtitleJob.updateMany({ user: tempUser._id }, { user: user._id });
          await User.findByIdAndDelete(tempUser._id);
          // `user` keeps pointing to the real account — no reassignment needed.
        } else {
          // NEW USER: no prior verified account. Promote the temp user to the real account
          // so all references (jobs, credits) follow the same document ID.
          tempUser.email = email.toLowerCase();
          tempUser.isVerified = true;
          tempUser.tempUser = false;
          if (user.name && !tempUser.name) tempUser.name = user.name;
          if (user.profilePicture && !tempUser.profilePicture) tempUser.profilePicture = user.profilePicture;
          await tempUser.save();
          await User.findByIdAndDelete(user._id);
          user = tempUser;
        }
      }
    } else if (tempUserId && tempUserId === user._id.toString()) {
      // Same document — temp user is verifying their own account
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

    // Top up credits to SIGNUP_CREDITS for newly verified accounts
    if ((user.credits ?? 0) < SIGNUP_CREDITS) {
      const toAdd = SIGNUP_CREDITS - (user.credits ?? 0);
      await addCredits(user._id, toAdd, "signup_bonus", "Welcome credits top-up");
      user.credits = SIGNUP_CREDITS;
    }

    await generateTokens(user, req, res);

    res.json({
      success: true,
      message: "OTP verified successfully",
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
    
    // If tempUserId is provided, decide how to merge the temp session
    if (tempUserId && (!user || user._id.toString() !== tempUserId)) {
      const tempUser = await User.findById(tempUserId);
      if (tempUser && tempUser.tempUser) {

        if (user && user.isVerified && !user.tempUser) {
          // RETURNING USER: real account already exists.
          // Migrate any subtitle jobs created during the temp session then discard the temp user.
          await SubtitleJob.updateMany({ user: tempUser._id }, { user: user._id });
          await User.findByIdAndDelete(tempUser._id);
          // `user` keeps pointing to the real account — update profile details from Google.
          if (picture && !user.profilePicture) user.profilePicture = picture;
          if (displayName && !user.name) user.name = displayName;
        } else if (user && user._id.toString() !== tempUserId) {
          // NEW USER: unverified placeholder exists. Promote temp user, delete placeholder.
          tempUser.email = email;
          tempUser.name = displayName || tempUser.name;
          tempUser.profilePicture = picture || tempUser.profilePicture;
          tempUser.isVerified = true;
          tempUser.tempUser = false;
          if (user.profilePicture && !tempUser.profilePicture) tempUser.profilePicture = user.profilePicture;
          await tempUser.save();
          await User.findByIdAndDelete(user._id);
          user = tempUser;
        } else if (!user) {
          // No user with this email at all — convert temp user to verified account.
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
      await addCredits(user._id, SIGNUP_CREDITS, "signup_bonus", "Welcome credits");
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
      // Top up credits to SIGNUP_CREDITS for first-time Google sign-in
      if ((user.credits ?? 0) < SIGNUP_CREDITS) {
        const toAdd = SIGNUP_CREDITS - (user.credits ?? 0);
        await addCredits(user._id, toAdd, "signup_bonus", "Welcome credits top-up");
      }
    }

    await generateTokens(user, req, res);

    res.json({
      success: true,
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
  } catch (err) {
    next(err);
  }
};

exports.refresh = async (req, res, next) => {
  try {
    const rawToken = req.cookies?.refreshToken;
    if (!rawToken) return res.status(401).json({ message: "No refresh token" });

    // Hash token to query DB
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    
    // ATOMIC OPERATION: Claim the unrevoked token
    const tokenDoc = await RefreshToken.findOneAndUpdate(
      { tokenHash, isRevoked: false },
      { isRevoked: true }, // Atomically mark it as used
      { new: false } // Return the original document
    ).populate('user');

    if (!tokenDoc) {
      // It didn't exist OR it was already revoked (Reuse)
      const existingToken = await RefreshToken.findOne({ tokenHash });
      
      if (existingToken && existingToken.isRevoked) {
        console.warn(`[CRITICAL] Refresh Token Reuse Detected! Family: ${existingToken.familyId}, IP: ${req.ip}`);
        
        // 1. Revoke the entire token family
        await RefreshToken.updateMany({ familyId: existingToken.familyId }, { isRevoked: true });
        
        // 2. Increment user tokenVersion to kill all active access tokens
        if (existingToken.user) {
           await User.findByIdAndUpdate(existingToken.user, { $inc: { tokenVersion: 1 } });
        }

        res.clearCookie("accessToken"); res.clearCookie("refreshToken"); res.clearCookie("csrfToken");
        return res.status(401).json({ message: "Security violation detected. Please log in again." });
      }

      // Token doesn't exist at all
      res.clearCookie("accessToken"); res.clearCookie("refreshToken"); res.clearCookie("csrfToken");
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    // 2. ENFORCE DEVICE / IP VALIDATION & 8. ANOMALY DETECTION
    if (tokenDoc.ipAddress !== req.ip || tokenDoc.userAgent !== req.get('User-Agent')) {
      console.warn(`[ANOMALY] IP or Device change detected for user ${tokenDoc.user._id}. Old IP: ${tokenDoc.ipAddress}, New: ${req.ip}`);
      // Stub for notification system
      console.log(`[Notification Stub] Alerting user ${tokenDoc.user._id} about new login location/device.`);
    }

    // Generate new tokens using the SAME familyId
    await generateTokens(tokenDoc.user, req, res, tokenDoc.familyId);

    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.logout = async (req, res, next) => {
  try {
    const rawToken = req.cookies?.refreshToken;
    if (rawToken) {
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const tokenDoc = await RefreshToken.findOne({ tokenHash });
      if (tokenDoc) {
        // Revoke entire device family on logout
        await RefreshToken.updateMany({ familyId: tokenDoc.familyId }, { isRevoked: true });
      }
    }

    // Clear all cookies
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken", { path: "/api/auth" });
    res.clearCookie("csrfToken");

    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.logoutAllDevices = async (req, res, next) => {
  try {
    // Revoke all refresh tokens for user
    await RefreshToken.updateMany({ user: req.userId }, { isRevoked: true });
    // Invalidate all access tokens
    await User.findByIdAndUpdate(req.userId, { $inc: { tokenVersion: 1 } });
    
    res.clearCookie("accessToken"); res.clearCookie("refreshToken", { path: "/api/auth" }); res.clearCookie("csrfToken");
    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.getSessions = async (req, res, next) => {
  try {
    const sessions = await RefreshToken.find({ user: req.userId, isRevoked: false })
      .select('ipAddress userAgent createdAt lastUsedAt familyId');
    res.status(200).json({ success: true, sessions });
  } catch (err) { 
    next(err); 
  }
};

exports.revokeSession = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    await RefreshToken.findOneAndUpdate(
      { _id: sessionId, user: req.userId },
      { isRevoked: true }
    );
    res.status(200).json({ success: true, message: "Session revoked" });
  } catch (err) { 
    next(err); 
  }
};
