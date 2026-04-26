const fs = require("fs");
const path = require("path");
const { pipeline } = require("stream/promises");
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

/**
 * Storage adapter interface
 * This adapter can be implemented for different storage providers (local, S3, etc.)
 */
class StorageAdapter {
  /**
   * Save a file to storage
   * @param {Buffer|Stream} fileData - File data to save
   * @param {string} filePath - Path where to save the file
   * @returns {Promise<string>} - URL or path to the saved file
   */
  async saveFile(fileData, filePath) {
    throw new Error("Method not implemented");
  }

  /**
   * Get a file from storage
   * @param {string} filePath - Path to the file
   * @returns {Promise<Buffer|Stream>} - File data
   */
  async getFile(filePath) {
    throw new Error("Method not implemented");
  }

  /**
   * Delete a file from storage
   * @param {string} filePath - Path to the file
   * @returns {Promise<boolean>} - True if deleted successfully
   */
  async deleteFile(filePath) {
    throw new Error("Method not implemented");
  }

  /**
   * Check if a file exists in storage
   * @param {string} filePath - Path to the file
   * @returns {Promise<boolean>} - True if file exists
   */
  async fileExists(filePath) {
    throw new Error("Method not implemented");
  }

  /**
   * Get a public URL for a file
   * @param {string} filePath - Path to the file
   * @returns {Promise<string>} - Public URL
   */
  async getPublicUrl(filePath) {
    throw new Error("Method not implemented");
  }
}

/**
 * Local file system storage adapter
 */
class LocalStorageAdapter extends StorageAdapter {
  constructor(basePath = "") {
    super();
    this.basePath = basePath;
  }

  /**
   * Get the full path to a file
   * @param {string} filePath - Relative file path
   * @returns {string} - Full file path
   */
  _getFullPath(filePath) {
    return path.join(this.basePath, filePath);
  }

  /**
   * Save a file to local storage
   * @param {Buffer|Stream} fileData - File data to save
   * @param {string} filePath - Path where to save the file
   * @returns {Promise<string>} - Path to the saved file
   */
  async saveFile(fileData, filePath) {
    const fullPath = this._getFullPath(filePath);

    // Create directory if it doesn't exist
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    return new Promise((resolve, reject) => {
      if (Buffer.isBuffer(fileData)) {
        // If fileData is a Buffer
        fs.writeFile(fullPath, fileData, (err) => {
          if (err) return reject(err);
          resolve(filePath);
        });
      } else {
        // If fileData is a Stream
        const writeStream = fs.createWriteStream(fullPath);
        fileData.pipe(writeStream);

        writeStream.on("finish", () => {
          resolve(filePath);
        });

        writeStream.on("error", (err) => {
          reject(err);
        });
      }
    });
  }

  /**
   * Get a file from local storage
   * @param {string} filePath - Path to the file
   * @returns {Promise<Buffer>} - File data
   */
  async getFile(filePath) {
    const fullPath = this._getFullPath(filePath);
    return fs.promises.readFile(fullPath);
  }

  /**
   * Delete a file from local storage
   * @param {string} filePath - Path to the file
   * @returns {Promise<boolean>} - True if deleted successfully
   */
  async deleteFile(filePath) {
    const fullPath = this._getFullPath(filePath);

    if (await this.fileExists(filePath)) {
      await fs.promises.unlink(fullPath);
      return true;
    }

    return false;
  }

  /**
   * Check if a file exists in local storage
   * @param {string} filePath - Path to the file
   * @returns {Promise<boolean>} - True if file exists
   */
  async fileExists(filePath) {
    const fullPath = this._getFullPath(filePath);

    try {
      await fs.promises.access(fullPath, fs.constants.F_OK);
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Get a public URL for a file in local storage
   * @param {string} filePath - Path to the file
   * @returns {Promise<string>} - Public URL
   */
  async getPublicUrl(filePath) {
    // For local storage, we just return the path as is
    // In a real app, you would prepend the base URL
    return filePath;
  }
}

/**
 * AWS S3 storage adapter (placeholder for future implementation)
 * To implement this, you would need to install the AWS SDK:
 * npm install aws-sdk
 */
class S3StorageAdapter extends StorageAdapter {
  constructor() {
    super();
    this.bucket = process.env.S3_BUCKET;
    this.region = process.env.AWS_REGION;
    this.publicBaseUrl = process.env.S3_PUBLIC_BASE_URL || "";
    this.client = new S3Client({
      region: this.region,
      credentials:
        process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
          ? {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID,
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            }
          : undefined,
    });
  }

  async saveFile(fileData, filePath, contentType = "application/octet-stream") {
    const body = Buffer.isBuffer(fileData) ? fileData : fileData;
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: filePath,
      Body: body,
      ContentType: contentType,
    });
    await this.client.send(command);
    return filePath;
  }

  async getFile(filePath) {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: filePath,
    });
    const res = await this.client.send(command);
    return res.Body; // stream
  }

  async deleteFile(filePath) {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: filePath,
    });
    await this.client.send(command);
    return true;
  }

  async fileExists(filePath) {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: filePath,
      });
      await this.client.send(command);
      return true;
    } catch (err) {
      return false;
    }
  }

  async getPublicUrl(filePath) {
    if (this.publicBaseUrl) {
      return `${this.publicBaseUrl.replace(/\/$/, "")}/${filePath}`;
    }
    // Fallback to a signed GET URL if no public base URL configured
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: filePath,
    });
    const url = await getSignedUrl(this.client, command, { expiresIn: 3600 });
    return url;
  }
}

// Helper to create a presigned PUT URL for direct browser uploads
const createPresignedPutUrl = async (
  key,
  contentType,
  expiresInSeconds = 900,
) => {
  const { client, bucket } = getRawS3ClientAndBucket();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });
  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: expiresInSeconds,
  });
  const publicBaseUrl = process.env.S3_PUBLIC_BASE_URL || "";
  const publicUrl = publicBaseUrl
    ? `${publicBaseUrl.replace(/\/$/, "")}/${key}`
    : "";
  return { uploadUrl, key, publicUrl };
};

/** @returns {{ client: import("@aws-sdk/client-s3").S3Client, bucket: string }} */
function getRawS3ClientAndBucket() {
  const region = process.env.AWS_REGION;
  const bucket = process.env.S3_BUCKET;
  if (!region || !bucket) {
    throw new Error("AWS_REGION and S3_BUCKET are required for S3 operations.");
  }
  const client = new S3Client({
    region,
    credentials:
      process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          }
        : undefined,
  });
  return { client, bucket };
}

/**
 * HEAD object metadata (size, content type).
 * @param {string} key
 * @returns {Promise<{ contentLength: number, contentType: string | null }>}
 */
async function headS3ObjectMeta(key) {
  const { client, bucket } = getRawS3ClientAndBucket();
  const res = await client.send(
    new HeadObjectCommand({ Bucket: bucket, Key: key }),
  );
  return {
    contentLength: Number(res.ContentLength) || 0,
    contentType: res.ContentType || null,
  };
}

/**
 * Stream S3 object to a local file (no full-file RAM buffer).
 * @param {string} key
 * @param {string} destPath
 */
async function downloadS3ObjectToFile(key, destPath) {
  const { client, bucket } = getRawS3ClientAndBucket();
  const res = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );
  const body = res.Body;
  if (!body) {
    throw new Error(`Empty S3 body for key: ${key}`);
  }
  await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
  await pipeline(body, fs.createWriteStream(destPath));
}

// Create and export the appropriate storage adapter based on the environment
const createStorageAdapter = () => {
  // Use environment variable to determine which storage adapter to use
  const storageType = process.env.STORAGE_TYPE || "local";

  if (storageType === "s3") {
    // For production, use S3
    return new S3StorageAdapter();
  } else {
    // For development, use local storage
    return new LocalStorageAdapter(path.join(__dirname, ".."));
  }
};

module.exports = {
  StorageAdapter,
  LocalStorageAdapter,
  S3StorageAdapter,
  storage: createStorageAdapter(),
  createPresignedPutUrl,
  headS3ObjectMeta,
  downloadS3ObjectToFile,
};
