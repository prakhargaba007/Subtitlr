const mongoose = require("mongoose");

const errorLogSchema = new mongoose.Schema(
  {
    message: { type: String, required: true },
    stack: { type: String },
    statusCode: { type: Number },
    path: { type: String },
    method: { type: String },
    body: { type: mongoose.Schema.Types.Mixed },
    query: { type: mongoose.Schema.Types.Mixed },
    params: { type: mongoose.Schema.Types.Mixed },
    ip: { type: String },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ErrorLog", errorLogSchema);
