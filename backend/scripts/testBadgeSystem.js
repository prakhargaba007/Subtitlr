const mongoose = require('mongoose');
const { createXPMilestoneBadges } = require('./createXPMilestoneBadges');
const { checkAndAwardBadges } = require('../utils/badgeUtils');
const User = require('../models/User');
const XP = require('../models/XP');
const UserBadge = require('../models/UserBadge');
const Badge = require('../models/Badge');

async function testBadgeSystem() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/monster-poker', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    // Step 1: Create XP milestone badges if they don't exist
    console.log('\n=== Creating XP Milestone Badges ===');
    await createXPMilestoneBadges();

    // Step 2: Find a test user or create one
    let testUser = await User.findOne();
    if (!testUser) {
      console.log('No users found. Please create a user first.');
      return;
    }

    console.log(`\n=== Testing with user: ${testUser.name || testUser.email} ===`);

    // Step 3: Get or create XP data for the user
    let xpData = await XP.findOne({ userId: testUser._id });
    if (!xpData) {
      xpData = new XP({
        userId: testUser._id,
        currentXP: 0,
        totalXP: 0,
        streakCount: 0,
      });
      await xpData.save();
    }

    console.log(`Current XP: ${xpData.currentXP}`);

    // Step 4: Test badge awarding by adding XP
    const testXPAmounts = [50, 100, 250, 500, 1000, 2500];
    
    for (const amount of testXPAmounts) {
      console.log(`\n--- Adding ${amount} XP ---`);
      
      // Add XP
      xpData.currentXP += amount;
      xpData.totalXP += amount;
      xpData.xpHistory.push({
        source: 'admin_granted',
        amount: amount,
        description: `Test XP addition: ${amount}`,
        earnedAt: new Date(),
      });
      await xpData.save();

      // Check for badges
      const badgeResult = await checkAndAwardBadges(testUser._id, "xp_earned", {
        amount: amount,
        source: 'admin_granted',
        description: `Test XP addition: ${amount}`,
        newTotalXP: xpData.currentXP,
        previousXP: xpData.currentXP - amount
      });

      console.log(`New XP Total: ${xpData.currentXP}`);
      console.log(`Badges Awarded: ${badgeResult.badgesAwarded.length}`);
      console.log(`Badges Updated: ${badgeResult.badgesUpdated.length}`);

      if (badgeResult.badgesAwarded.length > 0) {
        for (const userBadge of badgeResult.badgesAwarded) {
          await userBadge.populate('badge');
          console.log(`  🏆 New Badge: ${userBadge.badge.name} (${userBadge.badge.criteria.xp} XP)`);
        }
      }
    }

    // Step 5: Show final results
    console.log('\n=== Final Results ===');
    const userBadges = await UserBadge.find({ user: testUser._id, isEarned: true })
      .populate('badge');
    
    console.log(`Total XP: ${xpData.currentXP}`);
    console.log(`Earned Badges: ${userBadges.length}`);
    
    userBadges.forEach(userBadge => {
      console.log(`  🏆 ${userBadge.badge.name}: ${userBadge.badge.criteria.xp} XP (${userBadge.badge.level})`);
    });

  } catch (error) {
    console.error('Error testing badge system:', error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
}

// Run the test
if (require.main === module) {
  testBadgeSystem();
}

module.exports = { testBadgeSystem };
