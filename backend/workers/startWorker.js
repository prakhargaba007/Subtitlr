require('dotenv').config();
const mongoose = require('mongoose');
const videoProcessingWorker = require('./videoProcessor');

console.log('Starting video processing worker...');

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_ID)
  .then(() => {
    console.log('Connected to MongoDB');
    console.log('Video processing worker is running');
    
    // Handle process termination
    process.on('SIGTERM', async () => {
      console.log('SIGTERM received, closing worker...');
      await videoProcessingWorker.close();
      console.log('Worker closed');
      process.exit(0);
    });
    
    process.on('SIGINT', async () => {
      console.log('SIGINT received, closing worker...');
      await videoProcessingWorker.close();
      console.log('Worker closed');
      process.exit(0);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
  }); 