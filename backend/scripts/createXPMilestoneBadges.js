const mongoose = require('mongoose');
const Badge = require('../models/Badge');

// XP Milestone badges configuration
const xpMilestoneBadges = [
  {
    name: "First Steps",
    description: "Earn your first 100 XP",
    icon: "🥉",
    level: "Bronze",
    category: "xp_milestone",
    criteria: { xp: 100 },
    isActive: true,
  },
  {
    name: "Getting Started",
    description: "Reach 500 XP",
    icon: "🥉",
    level: "Bronze",
    category: "xp_milestone",
    criteria: { xp: 500 },
    isActive: true,
  },
  {
    name: "On the Rise",
    description: "Accumulate 1,000 XP",
    icon: "🥈",
    level: "Silver",
    category: "xp_milestone",
    criteria: { xp: 1000 },
    isActive: true,
  },
  {
    name: "Rising Star",
    description: "Achieve 2,500 XP",
    icon: "🥈",
    level: "Silver",
    category: "xp_milestone",
    criteria: { xp: 2500 },
    isActive: true,
  },
  {
    name: "XP Champion",
    description: "Reach 5,000 XP",
    icon: "🥇",
    level: "Gold",
    category: "xp_milestone",
    criteria: { xp: 5000 },
    isActive: true,
  },
  {
    name: "XP Master",
    description: "Accumulate 10,000 XP",
    icon: "🥇",
    level: "Gold",
    category: "xp_milestone",
    criteria: { xp: 10000 },
    isActive: true,
  },
  {
    name: "XP Legend",
    description: "Reach the legendary 25,000 XP",
    icon: "💎",
    level: "Diamond",
    category: "xp_milestone",
    criteria: { xp: 25000 },
    isActive: true,
  },
  {
    name: "XP Grandmaster",
    description: "Achieve the ultimate 50,000 XP",
    icon: "💎",
    level: "Diamond",
    category: "xp_milestone",
    criteria: { xp: 50000 },
    isActive: true,
  },
  {
    name: "XP Supreme",
    description: "Reach the pinnacle of 100,000 XP",
    icon: "👑",
    level: "Diamond",
    category: "xp_milestone",
    criteria: { xp: 100000 },
    isActive: true,
  }
];

async function createXPMilestoneBadges() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/monster-poker', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    // Check if badges already exist
    const existingBadges = await Badge.find({ category: 'xp_milestone' });
    if (existingBadges.length > 0) {
      console.log(`Found ${existingBadges.length} existing XP milestone badges. Skipping creation.`);
      return;
    }

    // Create badges
    const createdBadges = [];
    for (const badgeData of xpMilestoneBadges) {
      try {
        const badge = new Badge(badgeData);
        await badge.save();
        createdBadges.push(badge);
        console.log(`Created badge: ${badge.name} (${badge.criteria.xp} XP)`);
      } catch (error) {
        console.error(`Error creating badge ${badgeData.name}:`, error.message);
      }
    }

    console.log(`\nSuccessfully created ${createdBadges.length} XP milestone badges:`);
    createdBadges.forEach(badge => {
      console.log(`- ${badge.name}: ${badge.criteria.xp} XP (${badge.level})`);
    });

  } catch (error) {
    console.error('Error creating XP milestone badges:', error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
}

// Run the script
if (require.main === module) {
  createXPMilestoneBadges();
}

module.exports = { createXPMilestoneBadges, xpMilestoneBadges };
