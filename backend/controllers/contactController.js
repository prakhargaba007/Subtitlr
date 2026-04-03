const Contact = require("../models/Contact");
const { validationResult } = require("express-validator");
const sendEmail = require("../utils/mailer");

// Submit a new contact message
exports.submitContact = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { 
      name, 
      email, 
      phone, 
      message, 
      typeOfService, 
      brandName = "Resume OS",
      ownerEmail = process.env.OWNER_EMAIL || "prakhargaba@gmail.com"
    } = req.body;

    const newContact = new Contact({
      name,
      email,
      phone,
      message,
      typeOfService,
    });

    await newContact.save();

    // Send email notification to site owner

    const ownerHtml = `
      <h2>New Contact Form Submission</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${phone}</p>
      <p><strong>Type of Service:</strong> ${typeOfService ? typeOfService.join(', ') : 'Not specified'}</p>
      <p><strong>Message:</strong></p>
      <p>${message}</p>
    `;

    // Send confirmation email to the user
    // console.log(2);
    const userHtml = `
    <div style="max-width: 600px; margin: auto; padding: 20px; font-family: 'Segoe UI', Arial, sans-serif; color: #333; background-color: #ffffff; border: 1px solid #ddd; border-radius: 8px;">
      <h2 style="color: #0066cc; font-size: 24px; margin-bottom: 10px;">Thank you for contacting ${brandName}</h2>
      <p style="font-size: 16px;">Hello ${name},</p>
      <p style="font-size: 16px;">Thank you for reaching out! I've received your message and will get back to you as soon as possible.</p>
  
      <p style="font-size: 16px; margin-top: 30px; font-weight: 500;">Here's a copy of your message:</p>
      <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #0066cc; margin: 10px 0; border-radius: 4px;">
        <p style="margin: 0; font-size: 15px; line-height: 1.5;">${message}</p>
      </div>
  
      <p style="font-size: 16px; margin-top: 30px;">Best regards,<br><strong>${brandName}</strong></p>
  
      <hr style="border: none; border-top: 1px solid #eee; margin: 40px 0 20px;">
      <p style="font-size: 12px; color: #999; text-align: center;">This is an automated response. Please do not reply to this email.</p>
    </div>
  `;

    // console.log(3);

    res.status(201).json({
      success: true,
      message: "Contact message submitted successfully",
    });
    try {
      // console.log(4);
      // Send email to site owner
      await sendEmail(
        ownerEmail,
        `New Contact Form Submission - ${brandName}`,
        `New contact from ${name}. Email: ${email}, Phone: ${phone}, Type of Service: ${typeOfService ? typeOfService.join(', ') : 'Not specified'}, Message: ${message}`,
        ownerHtml,
        [],
        3,
        brandName
      );
      // console.log(5);
      // Send confirmation email to user
      await sendEmail(
        email,
        `Thank you for contacting ${brandName}`,
        `Thank you for reaching out to ${brandName}! I've received your message and will get back to you as soon as possible.`,
        userHtml,
        [],
        3,
        brandName
      );
      // console.log(6);
      // console.log("Contact emails sent successfully");
    } catch (emailError) {
      console.error("Error sending contact emails:", emailError);
      // We still return success since the contact was saved to DB
      // But we log the email error for debugging
    }
  } catch (error) {
    console.error("Error submitting contact:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while submitting contact message",
    });
  }
};

// Get all contact messages (admin only)
exports.getAllContacts = async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: contacts.length,
      data: contacts,
    });
  } catch (error) {
    console.error("Error fetching contacts:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching contacts",
    });
  }
};
