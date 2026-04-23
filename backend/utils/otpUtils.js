const crypto = require("crypto");
const OTP = require("../models/OTP");
const sendEmail = require("./mailer");

/**
 * Generate a random OTP
 * @param {number} length - Length of the OTP (default: 6)
 * @returns {string} - Generated OTP
 */
const generateOTP = (length = 6) => {
  const digits = "0123456789";
  let otp = "";

  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }

  return otp;
};

/**
 * Create and save OTP to database
 * @param {string} userId - User ID
 * @param {string} email - User email
 * @param {string} purpose - Purpose of OTP (password_reset, email_verification, etc.)
 * @param {number} expiryMinutes - OTP expiry time in minutes (default: 10)
 * @returns {Promise<Object>} - Created OTP object
 */
const createOTP = async (
  userId,
  email,
  purpose = "password_reset",
  expiryMinutes = 10,
) => {
  try {
    // Delete any existing unused OTPs for this user and purpose
    await OTP.deleteMany({
      userId,
      purpose,
      isUsed: false,
    });

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    const otpDoc = new OTP({
      userId,
      email: email.toLowerCase(),
      otp,
      purpose,
      expiresAt,
    });

    await otpDoc.save();
    return otpDoc;
  } catch (error) {
    throw new Error(`Failed to create OTP: ${error.message}`);
  }
};

/**
 * Verify OTP
 * @param {string} email - User email
 * @param {string} otp - OTP to verify
 * @param {string} purpose - Purpose of OTP
 * @returns {Promise<Object>} - Verification result with success status and user info
 */
const verifyOTP = async (email, otp, purpose = "password_reset") => {
  try {
    const otpDoc = await OTP.findOne({
      email: email.toLowerCase(),
      purpose,
      isUsed: false,
    }).populate("userId");

    if (!otpDoc) {
      return {
        success: false,
        message: "Invalid or expired OTP",
      };
    }

    // Check if OTP has expired
    if (new Date() > otpDoc.expiresAt) {
      await OTP.deleteOne({ _id: otpDoc._id });
      return {
        success: false,
        message: "OTP has expired",
      };
    }

    // Check attempts limit
    if (otpDoc.attempts >= 3) {
      await OTP.deleteOne({ _id: otpDoc._id });
      return {
        success: false,
        message: "Maximum verification attempts exceeded",
      };
    }

    // Verify OTP
    if (otpDoc.otp !== otp) {
      // Increment attempts
      otpDoc.attempts += 1;
      await otpDoc.save();

      return {
        success: false,
        message: `Invalid OTP. ${3 - otpDoc.attempts} attempts remaining`,
      };
    }

    // Mark OTP as used
    otpDoc.isUsed = true;
    await otpDoc.save();

    return {
      success: true,
      message: "OTP verified successfully",
      userId: otpDoc.userId._id,
      user: otpDoc.userId,
    };
  } catch (error) {
    throw new Error(`Failed to verify OTP: ${error.message}`);
  }
};

/**
 * Send OTP via email
 * @param {string} email - Recipient email
 * @param {string} otp - OTP to send
 * @param {string} purpose - Purpose of OTP
 * @param {string} userName - User's name for personalization
 * @returns {Promise<boolean>} - Email sending result
 */
const sendOTPEmail = async (
  email,
  otp,
  purpose = "password_reset",
  userName = "",
) => {
  try {
    let subject, htmlContent;

    switch (purpose) {
      case "password_reset":
        subject = "Password Reset OTP - Kili Labs";
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #333; margin-bottom: 10px;">Kili Labs</h1>
              <h2 style="color: #666; font-weight: normal;">Password Reset Request</h2>
            </div>
            
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <p style="color: #333; font-size: 16px; margin-bottom: 15px;">
                ${userName ? `Hello ${userName},` : "Hello,"}
              </p>
              <p style="color: #333; font-size: 16px; margin-bottom: 15px;">
                We received a request to reset your password. Use the following OTP to reset your password:
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <div style="background-color: #007bff; color: white; font-size: 32px; font-weight: bold; padding: 15px 30px; border-radius: 8px; display: inline-block; letter-spacing: 5px;">
                  ${otp}
                </div>
              </div>
              
              <p style="color: #666; font-size: 14px; margin-bottom: 10px;">
                This OTP will expire in 10 minutes for security reasons.
              </p>
              <p style="color: #666; font-size: 14px;">
                If you didn't request this password reset, please ignore this email or contact support if you have concerns.
              </p>
            </div>
            
            <div style="text-align: center; color: #999; font-size: 12px; margin-top: 30px;">
              <p>This is an automated email. Please do not reply to this email.</p>
              <p>&copy; 2025 Kili Labs. All rights reserved.</p>
            </div>
          </div>
        `;
        break;

      case "email_verification":
        subject = "Email Verification OTP - Kili Labs";
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #333; margin-bottom: 10px;">Kili Labs</h1>
              <h2 style="color: #666; font-weight: normal;">Email Verification</h2>
            </div>
            
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <p style="color: #333; font-size: 16px; margin-bottom: 15px;">
                ${userName ? `Hello ${userName},` : "Hello,"}
              </p>
              <p style="color: #333; font-size: 16px; margin-bottom: 15px;">
                Please verify your email address using the following OTP:
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <div style="background-color: #28a745; color: white; font-size: 32px; font-weight: bold; padding: 15px 30px; border-radius: 8px; display: inline-block; letter-spacing: 5px;">
                  ${otp}
                </div>
              </div>
              
              <p style="color: #666; font-size: 14px; margin-bottom: 10px;">
                This OTP will expire in 10 minutes.
              </p>
            </div>
            
            <div style="text-align: center; color: #999; font-size: 12px; margin-top: 30px;">
              <p>This is an automated email. Please do not reply to this email.</p>
              <p>&copy; 2025 Kili Labs. All rights reserved.</p>
            </div>
          </div>
        `;
        break;

      default:
        subject = "Verification OTP - Kili Labs";
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #333; margin-bottom: 10px;">Kili Labs</h1>
              <h2 style="color: #666; font-weight: normal;">Verification Required</h2>
            </div>
            
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <p style="color: #333; font-size: 16px; margin-bottom: 15px;">
                ${userName ? `Hello ${userName},` : "Hello,"}
              </p>
              <p style="color: #333; font-size: 16px; margin-bottom: 15px;">
                Your verification OTP is:
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <div style="background-color: #6f42c1; color: white; font-size: 32px; font-weight: bold; padding: 15px 30px; border-radius: 8px; display: inline-block; letter-spacing: 5px;">
                  ${otp}
                </div>
              </div>
              
              <p style="color: #666; font-size: 14px; margin-bottom: 10px;">
                This OTP will expire in 10 minutes.
              </p>
            </div>
            
            <div style="text-align: center; color: #999; font-size: 12px; margin-top: 30px;">
              <p>This is an automated email. Please do not reply to this email.</p>
              <p>&copy; 2025 Kili Labs. All rights reserved.</p>
            </div>
          </div>
        `;
    }

    // Use the mailer utility to send email
    await sendEmail(
      email,
      subject,
      `Your OTP is: ${otp}. This OTP will expire in 10 minutes.`,
      htmlContent,
    );

    return true;
  } catch (error) {
    console.error("Failed to send OTP email:", error);
    throw new Error(`Failed to send OTP email: ${error.message}`);
  }
};

/**
 * Clean up expired OTPs (optional cleanup function)
 * @returns {Promise<number>} - Number of deleted expired OTPs
 */
const cleanupExpiredOTPs = async () => {
  try {
    const result = await OTP.deleteMany({
      expiresAt: { $lt: new Date() },
    });
    return result.deletedCount;
  } catch (error) {
    console.error("Failed to cleanup expired OTPs:", error);
    return 0;
  }
};

module.exports = {
  generateOTP,
  createOTP,
  verifyOTP,
  sendOTPEmail,
  cleanupExpiredOTPs,
};
