const nodemailer = require("nodemailer");
require("dotenv").config();

// Create transporter once and reuse
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.hostinger.com",
  port: process.env.SMTP_PORT || 465,
  secure: process.env.SECURE,
  auth: {
    user: process.env.SMTP_USER || "founder.resumeos@prakhargaba.com",
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Send an email with retry mechanism
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} body - Plain text email body
 * @param {string} html - HTML email body
 * @param {Array} attachments - Array of email attachments
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {string} brandName - Brand name for the email (defaults to "Resume OS")
 * @returns {Promise<boolean>} - Returns true if email sent successfully
 * @throws {Error} - Throws error if all retry attempts fail
 */
const sendEmail = async (
  to,
  subject,
  body,
  html,
  attachments = [],
  maxRetries = 3,
  brandName = "Resume OS"
) => {
  let attempts = 0;

  while (attempts < maxRetries) {
    try {

      const mailOptions = {
        from: `${brandName} <founder.resumeos@prakhargaba.com>`,
        to,
        subject,
        text: body,
        html,
        attachments,
      };

      // console.log("Sending email:", mailOptions);

      const result = await transporter.sendMail(mailOptions);
      // console.log("Email sent successfully:", result);
      return true;
    } catch (error) {
      attempts++;
      console.error(`Email sending attempt ${attempts} failed:`, error.message);

      // Add exponential backoff delay between retries
      if (attempts < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, attempts * 1000));
      } else {
        throw new Error(
          `Failed to send email after ${maxRetries} attempts: ${error.message}`
        );
      }
    }
  }
};

module.exports = sendEmail;
