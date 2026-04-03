const mongoose = require("mongoose");
const Badge = require("../models/Badge");
require("dotenv").config();

const gamePlayBadges = [
  {
    name: "First Game",
    description: "Play your first game",
    icon: "badges/game_play/first_game.png",
    level: "Bronze",
    category: "game_play",
    criteria: { type: "game_played", count: 1 },
  },
  {
    name: "Game Enthusiast",
    description: "Play 10 games",
    icon: "badges/game_play/game_enthusiast.png",
    level: "Bronze",
    category: "game_play",
    criteria: { type: "game_played", count: 10 },
  },
  {
    name: "Gaming Regular",
    description: "Play 25 games",
    icon: "badges/game_play/gaming_regular.png",
    level: "Silver",
    category: "game_play",
    criteria: { type: "game_played", count: 25 },
  },
  {
    name: "Game Master",
    description: "Play 50 games",
    icon: "badges/game_play/game_master.png",
    level: "Silver",
    category: "game_play",
    criteria: { type: "game_played", count: 50 },
  },
  {
    name: "Gaming Champion",
    description: "Play 100 games",
    icon: "badges/game_play/gaming_champion.png",
    level: "Gold",
    category: "game_play",
    criteria: { type: "game_played", count: 100 },
  },
  {
    name: "Ultimate Gamer",
    description: "Play 250 games",
    icon: "badges/game_play/ultimate_gamer.png",
    level: "Gold",
    category: "game_play",
    criteria: { type: "game_played", count: 250 },
  },
  {
    name: "Legendary Player",
    description: "Play 500 games",
    icon: "badges/game_play/legendary_player.png",
    level: "Diamond",
    category: "game_play",
    criteria: { type: "game_played", count: 500 },
  },
];

const createGamePlayBadges = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    // Clear existing game play badges
    await Badge.deleteMany({ category: "game_play" });
    console.log("Cleared existing game play badges");

    // Create new badges
    const createdBadges = await Badge.insertMany(gamePlayBadges);
    console.log(`Created ${createdBadges.length} game play badges:`);

    createdBadges.forEach((badge) => {
      console.log(`- ${badge.name} (${badge.level}): ${badge.description}`);
    });

    console.log("Game play badges created successfully!");
  } catch (error) {
    console.error("Error creating game play badges:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
};

// Run the script if called directly
if (require.main === module) {
  createGamePlayBadges();
}

module.exports = { createGamePlayBadges };
