import { model, Schema } from "mongoose";

const notificationSchema = new Schema(
  {
    recipient: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    message: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["like", "unlike", "comment", "subscribe", "tweet", "upload", "unsubscribe", "reply"],
      required: true,
    },
    videoId: {
      type: Schema.Types.ObjectId,
      ref: "Video",
    },
    tweetId: {
      type: Schema.Types.ObjectId,
      ref: "Tweet",
    },
    commentId: {
      type: Schema.Types.ObjectId,
      ref: "Comment",
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    isHide: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export const Notification = model("Notification", notificationSchema);
