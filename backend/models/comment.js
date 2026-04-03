const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const commentSchema = new Schema(
  {
    content: {
      type: String,
      required: true,
      trim: true
    },
    blog: {
      type: Schema.Types.ObjectId,
      ref: 'Blog',
      required: true
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    parent: {
      type: Schema.Types.ObjectId,
      ref: 'Comment',
      default: null
    },
    isDeleted: {
      type: Boolean,
      default: false
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for replies (children comments)
commentSchema.virtual('replies', {
  ref: 'Comment',
  localField: '_id',
  foreignField: 'parent'
});

module.exports = mongoose.model('Comment', commentSchema); 