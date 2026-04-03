const express = require("express");
const router = express.Router();

// Import controllers
const dashboardController = require("../controllers/dashboardController");

// Import middleware
const isAuth = require("../middleware/is-auth");

// Dashboard statistics routes
// GET /api/dashboard/stats - Get all dashboard statistics
router.get("/stats", isAuth, dashboardController.getDashboardStats);

// GET /api/dashboard/stats/users - Get total users count
router.get("/stats/users", isAuth, dashboardController.getTotalUsers);

// GET /api/dashboard/stats/views - Get total views count
router.get("/stats/views", isAuth, dashboardController.getTotalViews);

// GET /api/dashboard/stats/videos - Get total videos count
router.get("/stats/videos", isAuth, dashboardController.getTotalVideos);

// GET /api/dashboard/stats/courses-sold - Get courses sold count
router.get("/stats/courses-sold", isAuth, dashboardController.getCoursesSold);

// GET /api/dashboard/stats/time-based - Get time-based statistics
// Query parameter: ?period=30 (number of days, default: 30)
router.get("/stats/time-based", isAuth, dashboardController.getTimeBasedStats);

module.exports = router;
