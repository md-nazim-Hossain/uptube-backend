import mongoose from "mongoose";
import { Like } from "../models/like.model.js";
import { sendApiResponse } from "../utils/ApiResponse.js";
import { catchAsync } from "../utils/catchAsync.js";
import StatusCode from "http-status-codes";

const createLike = catchAsync(async (req, res) => {
  const { tweetId, commentId, videoId } = req.body;
  if (!videoId) throw new Error("Video id is required");
  const like = await Like.create({
    likedBy: new mongoose.Types.ObjectId(req.user._id),
    video: new mongoose.Types.ObjectId(videoId),
    tweet: new mongoose.Types.ObjectId(tweetId),
    comment: new mongoose.Types.ObjectId(commentId),
  });
  if (!like) throw new Error("Error creating a like");
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: like,
    message: "Like created successfully",
  });
});

const disLike = catchAsync(async (req, res) => {
  const like = await Like.findByIdAndDelete(req.params.id);
  if (!like) throw new Error("Like not found");
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: like,
    message: "Like deleted successfully",
  });
});

export const likeController = { createLike, disLike };
