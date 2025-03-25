import { model, Schema } from "mongoose";

const adsSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    videoFile: {
      type: String,
    },
    thumbnail: {
      type: String,
    },
    duration: {
      type: Number,
    },
    redirectUrl: {
      type: String,
      required: true,
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
    adsShowPostion: {
      type: String,
      enum: ["start", "middle", "end"],
    },
    brandLogo: {
      type: String,
      required: true,
    },
    brandName: {
      type: String,
      required: true,
    },
    actionText: {
      type: String,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

export const Ads = model("Ads", adsSchema);
