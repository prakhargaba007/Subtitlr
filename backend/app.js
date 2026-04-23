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

// Dodo webhooks need raw body for signature verification (must run before JSON parser)
app.use(
  "/api/webhooks/dodo",
  express.raw({ type: "application/json", limit: "1mb" }),
  require("./routes/dodoWebhookRoutes")
);

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
const projectRoutes = require("./routes/projectRoutes");
const transcribeTestRoutes = require("./routes/transcribeTestRoutes");
const planRoutes = require("./routes/planRoutes");
const billingRoutes = require("./routes/billingRoutes");
const adminBillingRoutes = require("./routes/adminBillingRoutes");
const adminPlanRoutes = require("./routes/adminPlanRoutes");
const feedbackRoutes = require("./routes/feedbackRoutes");
const comingSoonRoutes = require("./routes/comingSoonRoutes");
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
app.use("/api/projects", projectRoutes);
app.use("/api/transcribe", transcribeTestRoutes);
app.use("/api/plans", planRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/admin/billing", adminBillingRoutes);
app.use("/api/admin/plans", adminPlanRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/coming-soon", comingSoonRoutes);
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
  .then(async () => {
    try {
      const { seedPlanCatalogFromEnv } = require("./utils/planCatalogSeed");
      const out = await seedPlanCatalogFromEnv();
      if (out.seeded) console.log(`[plan catalog] upserted ${out.seeded} row(s) from env`);
    } catch (e) {
      console.warn("[plan catalog seed]", e.message);
    }
    // Start the stuck-job reaper (cleans up crashed jobs + refunds reserved usage).
    // Only run in persistent server environments, not in serverless.
    if (!isServerlessEnvironment) {
      require("./workers/stuckJobReaper").startReaper();
    }
    app.listen(port);
    console.log(`App listening on port ${port}!`);
  })
  .catch((err) => {
    console.log(err);
  });
