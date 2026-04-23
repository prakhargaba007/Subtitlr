/**
 * Example usage of the notification system
 * This file demonstrates how to use the notification utility in other parts of the application
 */

const notifications = require("../utils/notifications");

// Example 1: Send notification to a specific user
async function sendWelcomeNotification(userId) {
  const result = await notifications.sendToUser(userId, {
    title: "Welcome to Kili Labs!",
    body: "Thank you for joining our platform. Start exploring Kili Labs now!",
  });

  console.log("Welcome notification result:", result);
  return result;
}

// Example 2: Send notification to multiple users
async function notifyAboutNewCourse(courseId, courseTitle, instructorIds) {
  const result = await notifications.sendToUsers(instructorIds, {
    title: "New Course Published",
    body: `Your course "${courseTitle}" is now live!`,
    data: {
      screen: "CourseDetails",
      params: { courseId },
    },
  });

  console.log("Course notification result:", result);
  return result;
}

// Example 3: Send notification to all users with a specific role
async function notifyStudentsAboutNewFeature() {
  const result = await notifications.sendToRole("student", {
    title: "New Feature Available",
    body: "Check out our new practice mode to improve your skills!",
    data: {
      screen: "Features",
      params: { highlight: "practice-mode" },
    },
  });

  console.log("Feature notification result:", result);
  return result;
}

// Example 4: Broadcast notification to all users
async function broadcastMaintenanceAlert(startTime, duration) {
  const result = await notifications.sendToAll({
    title: "Scheduled Maintenance",
    body: `Our service will be unavailable on ${startTime} for approximately ${duration} minutes.`,
    data: {
      type: "maintenance",
      startTime,
      duration,
    },
  });

  console.log("Maintenance notification result:", result);
  return result;
}

// Example 5: Using notifications in a controller function
async function courseCompletionController(req, res, next) {
  try {
    const { userId, courseId } = req.params;

    // Process course completion logic...

    // Send notification to the user
    await notifications.sendToUser(userId, {
      title: "Course Completed!",
      body: "Congratulations on completing the course. Check out your certificate!",
      data: {
        screen: "Certificate",
        params: { courseId },
      },
    });

    // Also notify the instructor
    const course = await Course.findById(courseId).populate("instructor");
    if (course && course.instructor) {
      await notifications.sendToUser(course.instructor._id, {
        title: "Student Completed Course",
        body: `A student has completed your course "${course.title}"`,
        data: {
          screen: "CourseStats",
          params: { courseId },
        },
      });
    }

    res.status(200).json({ message: "Course completed successfully" });
  } catch (error) {
    next(error);
  }
}

// Example 6: Using notifications in a scheduled job
async function sendDailyReminders() {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    // Find users who haven't logged in for a day
    const User = require("../models/User");
    const DeviceToken = require("../models/DeviceToken");

    const inactiveUsers = await User.find({
      lastLogin: { $lt: yesterday },
      isActive: true,
    }).select("_id");

    const userIds = inactiveUsers.map((user) => user._id);

    // Send reminder notification
    await notifications.sendToUsers(userIds, {
      title: "We Miss You!",
      body: "Continue your learning journey today. New content is waiting for you!",
      data: {
        screen: "Home",
      },
    });

    console.log(`Sent reminders to ${userIds.length} users`);
  } catch (error) {
    console.error("Error sending daily reminders:", error);
  }
}

module.exports = {
  sendWelcomeNotification,
  notifyAboutNewCourse,
  notifyStudentsAboutNewFeature,
  broadcastMaintenanceAlert,
  courseCompletionController,
  sendDailyReminders,
};
