const mongoose = require("mongoose");
const User = require("../models/User");
const { incrementGamePlayed } = require("../utils/gameUtils");
const { createGamePlayBadges } = require("./createGamePlayBadges");
require("dotenv").config();

const testGamePlayBadges = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    // First, create game play badges if they don't exist
    console.log("Creating game play badges...");
    await createGamePlayBadges();

    // Find a test user (or create one for testing)
    let testUser = await User.findOne({ email: "test@example.com" });
    if (!testUser) {
      testUser = new User({
        name: "Test User",
        email: "test@example.com",
        userName: "TESTUSER",
        password: "test123",
        gamePlayed: 0
      });
      await testUser.save();
      console.log("Created test user");
    }

    console.log(`Testing with user: ${testUser.userName} (Current games: ${testUser.gamePlayed})`);

    // Check existing badges first
    const Badge = require("../models/Badge");
    const UserBadge = require("../models/UserBadge");
    
    console.log("\n--- Checking Existing Game Play Badges ---");
    const gamePlayBadges = await Badge.find({ category: "game_play" });
    console.log(`Found ${gamePlayBadges.length} game play badges:`);
    gamePlayBadges.forEach(badge => {
      console.log(`  - ${badge.name} (${badge.level}): ${badge.criteria.count} games required`);
    });

    // Check user's current badges
    const currentUserBadges = await UserBadge.find({ user: testUser._id }).populate("badge");
    console.log(`\nUser currently has ${currentUserBadges.length} badges:`);
    currentUserBadges.forEach(badge => {
      console.log(`  - ${badge.badge.name}: ${badge.isEarned ? 'EARNED' : 'IN PROGRESS'} (${badge.progress.current}/${badge.progress.target})`);
    });

    // Test incrementing game play count
    console.log("\n--- Testing Game Play Increment ---");
    for (let i = 1; i <= 5; i++) {
      console.log(`\nPlaying game ${i}...`);
      const result = await incrementGamePlayed(testUser._id, "test_game", {
        gameName: `Test Game ${i}`,
        difficulty: "Easy"
      });

      console.log(`Result: ${result.badgesAwarded.length} badges awarded, ${result.badgesUpdated.length} badges updated`);
      
      if (result.badgesAwarded.length > 0) {
        console.log("🎉 NEW BADGES AWARDED:");
        result.badgesAwarded.forEach(badge => {
          console.log(`  - ${badge.badge.name} (${badge.badge.level})`);
        });
      }

      // Refresh user data
      await testUser.save();
      testUser = await User.findById(testUser._id);
      console.log(`Total games played: ${testUser.gamePlayed}`);
    }

    console.log("\n--- Final Results ---");
    console.log(`Final game count: ${testUser.gamePlayed}`);
    
    // Get user badges
    const UserBadge = require("../models/UserBadge");
    const userBadges = await UserBadge.find({ 
      user: testUser._id, 
      isEarned: true 
    }).populate("badge");
    
    console.log(`Total badges earned: ${userBadges.length}`);
    userBadges.forEach(badge => {
      console.log(`  - ${badge.badge.name} (${badge.badge.level}) - Earned: ${badge.earnedAt}`);
    });

  } catch (error) {
    console.error("Error testing game play badges:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB");
  }
};

// Run the script if called directly
if (require.main === module) {
  testGamePlayBadges();
}

module.exports = { testGamePlayBadges };
