const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const NotificationHistorySchema = new Schema(
  {
    title: { 
      type: String, 
      required: true 
    },
    body: { 
      type: String, 
      required: true 
    },
    data: { 
      type: Object, 
      default: {} 
    },
    imageUrl: { 
      type: String 
    },
    tokens: [{ 
      type: String 
    }],
    sentTo: [{ 
      type: String 
    }],
    sentBy: { 
      type: Schema.Types.ObjectId, 
      ref: "User" 
    },
    status: { 
      type: String, 
      enum: ["success", "partial", "failed"], 
      default: "success" 
    },
    successCount: { 
      type: Number, 
      default: 0 
    },
    failureCount: { 
      type: Number, 
      default: 0 
    },
    targetRole: { 
      type: String 
    },
    onlyLoggedIn: { 
      type: Boolean, 
      default: true 
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("NotificationHistory", NotificationHistorySchema); 