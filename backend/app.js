// server.js (or app.js)
const path = require("path");
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const cors = require("cors"); // Import the CORS package
require("dotenv").config();

const app = express();
const port = process.env.PORT || 8080;

// Configure the CORS middleware
app.use(cors());

// Increase body size limits to handle resume/PDF uploads
app.use(bodyParser.json({ limit: "5mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "5mb" }));

// Create necessary directories if not in a serverless environment
const fs = require('fs');

// Check if we're running in a Vercel serverless environment
const isServerlessEnvironment = process.env.VERCEL === '1';

if (!isServerlessEnvironment) {
  try {
    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(__dirname, 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Create images directory if it doesn't exist
    const imagesDir = path.join(__dirname, 'images');
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }

    // Create certificates directory if it doesn't exist
    const certificatesDir = path.join(__dirname, 'public', 'certificates');
    if (!fs.existsSync(certificatesDir)) {
      fs.mkdirSync(certificatesDir, { recursive: true });
    }

    // Create processed videos directories if they don't exist
    const processedDirs = ['1080p', '720p', '480p'];
    const processedBaseDir = path.join(__dirname, 'public', 'uploads', 'processed');
    if (!fs.existsSync(processedBaseDir)) {
      fs.mkdirSync(processedBaseDir, { recursive: true });
    }
    processedDirs.forEach(dir => {
      const fullDir = path.join(processedBaseDir, dir);
      if (!fs.existsSync(fullDir)) {
        fs.mkdirSync(fullDir, { recursive: true });
      }
    });
  } catch (error) {
    console.warn('Warning: Could not create directories. This is expected in some environments:', error.message);
  }
}

// Serve test UI
app.use(express.static(path.join(__dirname, "public")));

// Serve static files - with fallback for serverless environments
app.use("/images", (req, res, next) => {
  const imagePath = path.join(__dirname, "images");
  if (isServerlessEnvironment || fs.existsSync(imagePath)) {
    express.static(imagePath)(req, res, next);
  } else {
    next();
  }
});

app.use("/public/uploads", (req, res, next) => {
  const uploadsPath = path.join(__dirname, "public", "uploads");
  if (isServerlessEnvironment || fs.existsSync(uploadsPath)) {
    express.static(uploadsPath)(req, res, next);
  } else {
    next();
  }
});

app.use("/certificates", (req, res, next) => {
  const certificatesPath = path.join(__dirname, "public", "certificates");
  if (isServerlessEnvironment || fs.existsSync(certificatesPath)) {
    express.static(certificatesPath)(req, res, next);
  } else {
    next();
  }
});

// Set CORS headers manually if needed
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS, PUT, DELETE, PATCH"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});

// Setup Bull Board queue dashboard
// const queueDashboard = require('./utils/queueDashboard');
// app.use('/admin/queues', queueDashboard.getRouter());

// Importing routes
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const tagRoutes = require("./routes/tagRoutes");
const deviceTokenRoutes = require("./routes/deviceTokenRoutes");
const fileRoutes = require("./routes/fileRoutes");
// const dashboardRoutes = require("./routes/dashboardRoutes");
const contactRoutes = require("./routes/contactRoutes");
const blogRoutes = require("./routes/blogRoutes");
const subtitleRoutes = require("./routes/subtitleRoutes");
const dubbingRoutes = require("./routes/dubbingRoutes");
// API routes
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/tags", tagRoutes);
app.use("/api/device-tokens", deviceTokenRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/blog", blogRoutes);
// Likes/Favorites endpoints (mounted under both names for clarity)
// app.use("/api/dashboard", dashboardRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/subtitles", subtitleRoutes);
app.use("/api/dubbing", dubbingRoutes);
// Error handling middleware
app.use((error, req, res, next) => {
  console.log(error);
  const status = error.statusCode || 500;
  const message = error.message;
  const data = error.data;
  res.status(status).send({ message: message, data: data });
});

mongoose
  .connect(process.env.MONGO_ID)
  .then((res) => {
    app.listen(port);
    console.log(`App listening on port ${port}!`);
  })
  .catch((err) => {
    console.log(err);
  });
