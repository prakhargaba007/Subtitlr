const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const blogSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
    },
    content: {
      type: String,
      required: true,
    },
    featuredImage: {
      type: String,
      default: "",
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    categories: {
      type: Schema.Types.ObjectId,
      ref: "LessonCategory",
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "published",
    },
    likes: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    dislikes: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    viewCount: {
      type: Number,
      default: 0,
    },
    readingTime: {
      type: Number,
      default: 0,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    allowComments: {
      type: Boolean,
      default: true,
    },
    metaTitle: String,
    metaDescription: String,
  },
  { timestamps: true },
);

// Virtual for comment count
blogSchema.virtual("commentCount", {
  ref: "Comment",
  localField: "_id",
  foreignField: "blog",
  count: true,
});

// Virtual for like count
blogSchema.virtual("likeCount").get(function () {
  return this.likes ? this.likes.length : 0;
});

// Virtual for dislike count
blogSchema.virtual("dislikeCount").get(function () {
  return this.dislikes ? this.dislikes.length : 0;
});

// Methods
blogSchema.methods.addLike = function (userId) {
  if (!this.likes.includes(userId)) {
    // Remove from dislikes if present
    this.dislikes = this.dislikes.filter(
      (id) => id.toString() !== userId.toString(),
    );
    this.likes.push(userId);
  }
  return this.save();
};

blogSchema.methods.addDislike = function (userId) {
  if (!this.dislikes.includes(userId)) {
    // Remove from likes if present
    this.likes = this.likes.filter((id) => id.toString() !== userId.toString());
    this.dislikes.push(userId);
  }
  return this.save();
};

blogSchema.methods.removeLike = function (userId) {
  this.likes = this.likes.filter((id) => id.toString() !== userId.toString());
  return this.save();
};

blogSchema.methods.removeDislike = function (userId) {
  this.dislikes = this.dislikes.filter(
    (id) => id.toString() !== userId.toString(),
  );
  return this.save();
};

// Set options to include virtuals when converting to JSON
blogSchema.set("toJSON", { virtuals: true });
blogSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Blog", blogSchema);
