const { Worker } = require('bullmq');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const { redisConfig } = require('../utils/queue');
const Video = require('../models/Video');
const { storage } = require('../utils/storage');

// Define output resolutions
const RESOLUTIONS = {
  '1080p': { width: 1920, height: 1080, bitrate: '5000k' },
  '720p': { width: 1280, height: 720, bitrate: '2500k' },
  '480p': { width: 854, height: 480, bitrate: '1000k' }
};

// Create processed directories if they don't exist
Object.keys(RESOLUTIONS).forEach(resolution => {
  const dir = path.join(__dirname, '..', 'public', 'uploads', 'processed', resolution);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Function to process a video into multiple resolutions
const processVideo = async (inputPathOrKey, videoId, filename, isS3 = false) => {
  const baseName = path.basename(filename, path.extname(filename));
  const processedVersions = {};
  
  // Download video from S3 if needed, or use local path
  let localVideoPath;
  if (isS3) {
    // Download from S3 to temp file
    const tempDir = path.join(__dirname, '..', 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    localVideoPath = path.join(tempDir, `input_${videoId}_${Date.now()}.mp4`);
    
    const videoStream = await storage.getFile(inputPathOrKey);
    const writeStream = fs.createWriteStream(localVideoPath);
    videoStream.pipe(writeStream);
    
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });
  } else {
    localVideoPath = inputPathOrKey;
  }
  
  try {
    // Get video information
    const videoInfo = await getVideoInfo(localVideoPath);
    
    // Update video with duration and other metadata
    await Video.findByIdAndUpdate(videoId, {
      duration: videoInfo.duration,
      status: 'processing',
      processingProgress: 10
    });
    
    // Process each resolution
    for (const [resolution, config] of Object.entries(RESOLUTIONS)) {
      try {
        const tempOutputPath = path.join(
          __dirname, 
          '..', 
          'temp', 
          `${baseName}_${resolution}.mp4`
        );
        
        await transcodeVideo(localVideoPath, tempOutputPath, config);
        
        // Get file size
        const stats = fs.statSync(tempOutputPath);
        
        // Upload to storage (S3 or local)
        let finalPath;
        if (isS3) {
          // Upload to S3
          const s3Key = `public/uploads/processed/${resolution}/${baseName}_${resolution}.mp4`;
          await storage.saveFile(fs.readFileSync(tempOutputPath), s3Key, 'video/mp4');
          finalPath = s3Key;
        } else {
          // Save to local
          const outputPath = path.join(
            __dirname, 
            '..', 
            'public', 
            'uploads', 
            'processed', 
            resolution, 
            `${baseName}_${resolution}.mp4`
          );
          
          // Create directory if it doesn't exist
          const dir = path.dirname(outputPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          
          fs.copyFileSync(tempOutputPath, outputPath);
          
          // Convert to relative path for storage in DB
          finalPath = path.join(
            'public', 
            'uploads', 
            'processed', 
            resolution, 
            `${baseName}_${resolution}.mp4`
          ).replace(/\\/g, '/');
        }
        
        // Store processed version info
        processedVersions[resolution] = {
          path: finalPath,
          size: stats.size
        };
        
        // Update processing progress
        const progressPercentage = 10 + (Object.keys(processedVersions).length / Object.keys(RESOLUTIONS).length) * 90;
        await Video.findByIdAndUpdate(videoId, {
          processingProgress: Math.round(progressPercentage)
        });
        
        // Clean up temp file
        if (fs.existsSync(tempOutputPath)) {
          fs.unlinkSync(tempOutputPath);
        }
      } catch (error) {
        console.error(`Error processing ${resolution}:`, error);
        throw error;
      }
    }
    
    // Update video with processed versions and status
    return await Video.findByIdAndUpdate(
      videoId,
      {
        status: 'processed',
        processedVersions,
        processingProgress: 100
      },
      { new: true }
    );
  } finally {
    // Clean up temp input file if it was downloaded from S3
    if (isS3 && localVideoPath && fs.existsSync(localVideoPath)) {
      fs.unlinkSync(localVideoPath);
    }
  }
};

// Function to get video information using ffmpeg
const getVideoInfo = (videoPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        return reject(err);
      }
      
      const { duration, size } = metadata.format;
      
      resolve({
        duration: Math.round(duration),
        size: size
      });
    });
  });
};

// Function to transcode video to specific resolution
const transcodeVideo = (inputPath, outputPath, config) => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        `-c:v libx264`,
        `-b:v ${config.bitrate}`,
        `-maxrate ${config.bitrate}`,
        `-bufsize ${parseInt(config.bitrate) * 2}k`,
        `-vf scale=${config.width}:${config.height}`,
        `-c:a aac`,
        `-b:a 128k`,
        `-movflags +faststart`,
        `-preset medium`,
        `-profile:v main`,
        `-level 4.0`,
        `-crf 23`
      ])
      .output(outputPath)
      .on('end', () => {
        resolve(outputPath);
      })
      .on('error', (err) => {
        reject(err);
      })
      .run();
  });
};

// Create the worker
const videoProcessingWorker = new Worker('video-processing', async (job) => {
  try {
    const { videoId, videoPath, s3Key, originalFilename } = job.data;
    
    console.log(`Processing video: ${videoId}`);
    
    // Determine if using S3 or local storage
    const isS3 = (process.env.STORAGE_TYPE || 'local') === 's3';
    const inputPathOrKey = isS3 ? s3Key : videoPath;
    
    if (!inputPathOrKey) {
      throw new Error(`No input specified. Expected ${isS3 ? 's3Key' : 'videoPath'}`);
    }
    
    // Process the video
    const processedVideo = await processVideo(inputPathOrKey, videoId, originalFilename, isS3);
    
    console.log(`Video processed successfully: ${videoId}`);
    return processedVideo;
  } catch (error) {
    console.error('Error processing video:', error);
    
    // Update video status to failed
    await Video.findByIdAndUpdate(job.data.videoId, {
      status: 'failed',
      processingError: error.message
    });
    
    throw error;
  }
}, { connection: redisConfig.connection });

// Handle worker events
videoProcessingWorker.on('completed', (job) => {
  console.log(`Job ${job.id} completed for video ${job.data.videoId}`);
});

videoProcessingWorker.on('failed', (job, error) => {
  console.error(`Job ${job.id} failed for video ${job.data.videoId}:`, error);
});

module.exports = videoProcessingWorker; 