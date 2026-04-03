// Examples of how to integrate XP system into existing controllers

const { 
  awardLessonXP, 
  awardQuizXP, 
  awardCourseXP, 
  awardDailyLoginXP,
  // awardAchievementXP,
  // checkLevelUpRewards 
} = require("../utils/xpUtils");

// Example 1: Award XP when a lesson is completed
const completeLesson = async (req, res) => {
  try {
    const { lessonId } = req.params;
    const userId = req.user.id;
    
    // Your existing lesson completion logic here...
    // const lesson = await Lesson.findById(lessonId);
    // await UserProgress.updateOne({...});
    
    // Award XP for lesson completion
    const xpResult = await awardLessonXP(
      userId, 
      lessonId, 
      "Lesson Name", // Get from lesson object
      5 // Optional bonus XP
    );
    
    // Check for level up rewards
    // const rewards = await checkLevelUpRewards(userId);
    
    res.status(200).json({
      success: true,
      message: "Lesson completed successfully",
      xpAwarded: xpResult.xpAdded,
      // levelUp: xpResult.levelUp,
      // newLevel: xpResult.newLevel,
      // rewards: rewards,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to complete lesson",
      error: error.message,
    });
  }
};

// Example 2: Award XP when a quiz is passed
const submitQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;
    const { answers } = req.body;
    const userId = req.user.id;
    
    // Your existing quiz submission logic here...
    // const quiz = await Quiz.findById(quizId);
    // const score = calculateScore(answers, quiz.questions);
    // await QuizGame.create({...});
    
    const score = 85; // Example score
    const quizName = "Quiz Name"; // Get from quiz object
    
    // Award XP for quiz completion
    const xpResult = await awardQuizXP(
      userId, 
      quizId, 
      quizName, 
      score,
      10 // Optional bonus XP for high score
    );
    
    res.status(200).json({
      success: true,
      message: "Quiz submitted successfully",
      score: score,
      xpAwarded: xpResult.xpAdded,
      // levelUp: xpResult.levelUp,
      // newLevel: xpResult.newLevel,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to submit quiz",
      error: error.message,
    });
  }
};

// Example 3: Award XP when a course is completed
const completeCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;
    
    // Your existing course completion logic here...
    // const course = await Course.findById(courseId);
    // await CourseEnrollment.updateOne({...});
    
    const courseName = "Course Name"; // Get from course object
    
    // Award XP for course completion
    const xpResult = await awardCourseXP(
      userId, 
      courseId, 
      courseName,
      25 // Optional bonus XP for course completion
    );
    
    res.status(200).json({
      success: true,
      message: "Course completed successfully",
      xpAwarded: xpResult.xpAdded,
      // levelUp: xpResult.levelUp,
      // newLevel: xpResult.newLevel,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to complete course",
      error: error.message,
    });
  }
};

// Example 4: Award XP for daily login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Your existing login logic here...
    // const user = await User.findOne({ email });
    // const isValidPassword = await bcrypt.compare(password, user.password);
    
    const userId = "user_id"; // Get from user object
    const streakCount = 5; // Get from XP data or calculate
    
    // Award XP for daily login
    const xpResult = await awardDailyLoginXP(userId, streakCount);
    
    res.status(200).json({
      success: true,
      message: "Login successful",
      xpAwarded: xpResult.xpAdded,
      streakCount: streakCount,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Login failed",
      error: error.message,
    });
  }
};

// Example 5: Award XP for earning an achievement
// const earnAchievement = async (req, res) => {
//   try {
//     const { achievementId } = req.params;
//     const userId = req.user.id;
    
//     // Your existing achievement logic here...
//     // const achievement = await Achievement.findById(achievementId);
//     // await UserBadge.create({...});
    
//     const achievementName = "Achievement Name"; // Get from achievement object
//     const xpAmount = 50; // Get from achievement object or use default
    
//     // Award XP for achievement
//     const xpResult = await awardAchievementXP(
//       userId, 
//       achievementId, 
//       achievementName, 
//       xpAmount
//     );
    
//     res.status(200).json({
//       success: true,
//       message: "Achievement earned successfully",
//       xpAwarded: xpResult.xpAdded,
//       levelUp: xpResult.levelUp,
//       newLevel: xpResult.newLevel,
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: "Failed to earn achievement",
//       error: error.message,
//     });
//   }
// };

// Example 6: Get user's XP data in any controller
const getUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Your existing user profile logic here...
    // const user = await User.findById(userId);
    
    // Get XP data
    const xpStats = await getUserXPStats(userId);
    
    res.status(200).json({
      success: true,
      data: {
        // ... your existing user data
        xp: xpStats,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to get user profile",
      error: error.message,
    });
  }
};

module.exports = {
  completeLesson,
  submitQuiz,
  completeCourse,
  login,
  // earnAchievement,
  getUserProfile,
};
