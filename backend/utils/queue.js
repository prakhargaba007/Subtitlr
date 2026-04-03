const { Queue } = require("bullmq");
const path = require("path");

// Redis connection configuration
// In production, you would use environment variables for these settings
const redisConfig = {
  connection: {
    host: process.env.REDIS_HOST || "localhost",
    port: process.env.REDIS_PORT || 6379,
    // Add authentication if needed in production
    // password: process.env.REDIS_PASSWORD
  },
};

// Create a video processing queue
const videoQueue = new Queue("video-processing", {
  connection: redisConfig.connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: false,
    removeOnFail: false,
  },
});

// Function to add a video processing job to the queue
const addVideoProcessingJob = async (videoData) => {
  return await videoQueue.add("process-video", videoData, {
    // Job options
    priority: 1,
    attempts: 3,
    timeout: 18000000, // 5 hour timeout
  });
};

// Function to get the queue instance (useful for monitoring)
const getVideoQueue = () => {
  return videoQueue;
};

module.exports = {
  videoQueue,
  addVideoProcessingJob,
  getVideoQueue,
  redisConfig,
};
