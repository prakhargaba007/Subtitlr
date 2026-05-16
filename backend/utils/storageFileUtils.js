const fs = require("fs");
const os = require("os");
const path = require("path");
const { pipeline } = require("stream/promises");
const { v4: uuidv4 } = require("uuid");

const { storage } = require("./storage");

async function writeBodyToFile(body, destPath) {
  await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
  if (!body) {
    await fs.promises.writeFile(destPath, Buffer.alloc(0));
    return destPath;
  }
  if (Buffer.isBuffer(body)) {
    await fs.promises.writeFile(destPath, body);
    return destPath;
  }
  if (typeof body.transformToByteArray === "function") {
    const arr = await body.transformToByteArray();
    await fs.promises.writeFile(destPath, Buffer.from(arr));
    return destPath;
  }
  await pipeline(body, fs.createWriteStream(destPath));
  return destPath;
}

async function saveLocalFileToStorage(localPath, key, contentType) {
  await storage.saveFile(fs.createReadStream(localPath), key, contentType);
  return key;
}

async function downloadStorageFileToTemp(
  key,
  tmpPaths,
  filenamePrefix = "storage_file",
  ext = ".bin",
) {
  const safeExt = ext && ext.startsWith(".") ? ext : `.${ext || "bin"}`;
  const destPath = path.join(os.tmpdir(), `${filenamePrefix}_${uuidv4()}${safeExt}`);
  const body = await storage.getFile(key);
  await writeBodyToFile(body, destPath);
  if (Array.isArray(tmpPaths)) tmpPaths.push(destPath);
  return destPath;
}

module.exports = {
  downloadStorageFileToTemp,
  saveLocalFileToStorage,
  writeBodyToFile,
};
