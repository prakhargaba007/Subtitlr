const User = require("../models/User");
const Video = require("../models/Video");
const VideoHistory = require("../models/VideoHistory");
const CourseEnrollment = require("../models/CourseEnrollment");

// Get dashboard statistics
exports.getDashboardStats = async (req, res) => {
  try {
    // Get all statistics in parallel for better performance
    const [
      totalUsers,
      totalVideos,
      totalViews,
      coursesSold,
    ] = await Promise.all([
      // Total Users - count all active, non-deleted users
      User.countDocuments({ 
        isActive: true, 
        isDeleted: false 
      }),
      
      // Total Videos - count all videos
      Video.countDocuments(),
      
      // Total Views - count all video history entries (each represents a view)
      VideoHistory.countDocuments(),
      
      // Courses Sold - count all course enrollments
      CourseEnrollment.countDocuments(),
    ]);

    // Additional statistics that might be useful
    const [
      activeUsers,
      publishedVideos,
      completedCourses,
      paidEnrollments,
    ] = await Promise.all([
      // Active Users - users who logged in recently (last 30 days)
      User.countDocuments({
        isActive: true,
        isDeleted: false,
        lastLogin: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      }),
      
      // Published Videos - videos that are public
      Video.countDocuments({ isPublic: true }),
      
      // Completed Courses - completed enrollments
      CourseEnrollment.countDocuments({ status: "completed" }),
      
      // Paid Enrollments - paid course enrollments
      CourseEnrollment.countDocuments({ paymentStatus: "paid" }),
    ]);

    const stats = {
      overview: {
        totalUsers,
        totalVideos,
        totalViews,
        coursesSold,
      },
      detailed: {
        activeUsers,
        publishedVideos,
        completedCourses,
        paidEnrollments,
      },
      timestamp: new Date().toISOString(),
    };

    res.status(200).json({
      success: true,
      message: "Dashboard statistics retrieved successfully",
      data: stats,
    });
  } catch (error) {
    console.error("Error fetching dashboard statistics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard statistics",
      error: error.message,
    });
  }
};

// Get individual statistics (useful for specific metric requests)
exports.getTotalUsers = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ 
      isActive: true, 
      isDeleted: false 
    });

    res.status(200).json({
      success: true,
      message: "Total users retrieved successfully",
      data: { totalUsers },
    });
  } catch (error) {
    console.error("Error fetching total users:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch total users",
      error: error.message,
    });
  }
};

exports.getTotalViews = async (req, res) => {
  try {
    const totalViews = await VideoHistory.countDocuments();

    res.status(200).json({
      success: true,
      message: "Total views retrieved successfully",
      data: { totalViews },
    });
  } catch (error) {
    console.error("Error fetching total views:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch total views",
      error: error.message,
    });
  }
};

exports.getTotalVideos = async (req, res) => {
  try {
    const totalVideos = await Video.countDocuments();

    res.status(200).json({
      success: true,
      message: "Total videos retrieved successfully",
      data: { totalVideos },
    });
  } catch (error) {
    console.error("Error fetching total videos:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch total videos",
      error: error.message,
    });
  }
};

exports.getCoursesSold = async (req, res) => {
  try {
    const coursesSold = await CourseEnrollment.countDocuments();

    res.status(200).json({
      success: true,
      message: "Courses sold retrieved successfully",
      data: { coursesSold },
    });
  } catch (error) {
    console.error("Error fetching courses sold:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch courses sold",
      error: error.message,
    });
  }
};

// Get time-based statistics (last 30 days, 7 days, etc.)
exports.getTimeBasedStats = async (req, res) => {
  try {
    const { period = "30" } = req.query; // Default to 30 days
    const days = parseInt(period);
    
    if (isNaN(days) || days < 1) {
      return res.status(400).json({
        success: false,
        message: "Invalid period. Please provide a valid number of days.",
      });
    }

    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [
      newUsers,
      newViews,
      newVideos,
      newEnrollments,
    ] = await Promise.all([
      // New users in the specified period
      User.countDocuments({
        isActive: true,
        isDeleted: false,
        createdAt: { $gte: startDate }
      }),
      
      // New views in the specified period
      VideoHistory.countDocuments({
        createdAt: { $gte: startDate }
      }),
      
      // New videos in the specified period
      Video.countDocuments({
        createdAt: { $gte: startDate }
      }),
      
      // New enrollments in the specified period
      CourseEnrollment.countDocuments({
        enrollmentDate: { $gte: startDate }
      }),
    ]);

    const timeBasedStats = {
      period: `${days} days`,
      startDate: startDate.toISOString(),
      endDate: new Date().toISOString(),
      stats: {
        newUsers,
        newViews,
        newVideos,
        newEnrollments,
      },
      timestamp: new Date().toISOString(),
    };

    res.status(200).json({
      success: true,
      message: `Statistics for the last ${days} days retrieved successfully`,
      data: timeBasedStats,
    });
  } catch (error) {
    console.error("Error fetching time-based statistics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch time-based statistics",
      error: error.message,
    });
  }
};
