const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();

// Import the User model
const User = require("./models/User");

// Admin user details - you can modify these as needed
const adminUser = {
  name: "Admin User",
  email: "admin@subtitle.com",
  userName: "admin",
  password: "1234567", // This will be hashed before saving
  role: "admin",
};

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_ID)
  .then(async () => {
    console.log("Connected to MongoDB");

    try {
      // Check if admin already exists
      const existingAdmin = await User.findOne({
        $or: [{ email: adminUser.email }, { userName: adminUser.userName }],
      });

      if (existingAdmin) {
        console.log("Admin user already exists with this email or username");
        process.exit(0);
      }

      // Hash the password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(adminUser.password, salt);

      // Create the admin user
      const newAdmin = new User({
        name: adminUser.name,
        email: adminUser.email,
        userName: adminUser.userName,
        password: hashedPassword,
        role: adminUser.role,
        isVerified: true,
        isActive: true,
      });

      // Save the admin user
      await newAdmin.save();
      console.log("Admin user created successfully!");
      console.log(`Username: ${adminUser.userName}`);
      console.log(
        `Password: ${adminUser.password} (unencrypted for your reference)`,
      );
    } catch (error) {
      console.error("Error creating admin user:", error);
    } finally {
      // Disconnect from MongoDB
      mongoose.disconnect();
      console.log("Disconnected from MongoDB");
    }
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err);
    process.exit(1);
  });
