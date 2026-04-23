const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const RefreshTokenSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  familyId: { type: String, required: true, index: true },
  ipAddress: { type: String },
  userAgent: { type: String },
  isRevoked: { type: Boolean, default: false },
  lastUsedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true }
}, { timestamps: true });

// Auto-delete expired tokens to keep DB clean
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("RefreshToken", RefreshTokenSchema);
