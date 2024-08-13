import { Schema, model } from "mongoose";

export const tweetSchema = new Schema(
  {
    content: {
      type: String,
      required: true,
    },
    thumbnail: {
      type: String,
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Tweet = model("Tweet", tweetSchema);
