import { Schema, model } from "mongoose";

const commentsSchema = new Schema(
  {
    content: {
      type: String,
      required: true,
    },
    video: {
      type: Schema.Types.ObjectId,
      ref: "Video",
    },
    tweet: {
      type: Schema.Types.ObjectId,
      ref: "Tweet",
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
    parentComment: {
      type: Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
    },
    replies: [
      {
        type: Schema.Types.ObjectId,
        ref: "Comment",
      },
    ],
    lastEditedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

commentsSchema.pre("find", function (next) {
  this.populate({
    path: "replies",
    options: { sort: { createdAt: -1 } },
    populate: { path: "owner", select: "-refreshToken -password -lastPasswordChange -watchHistory" },
  });
  next();
});

export const Comment = model("Comment", commentsSchema);
