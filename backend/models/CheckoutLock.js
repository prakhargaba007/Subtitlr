const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const checkoutLockSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  planCatalogKey: { type: String, required: true },
  sessionId: { type: String, required: true, unique: true },
  checkoutUrl: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: { expires: '1m' } }
}, { timestamps: true });

checkoutLockSchema.index({ user: 1 }, { unique: true });

module.exports = mongoose.model("CheckoutLock", checkoutLockSchema);
