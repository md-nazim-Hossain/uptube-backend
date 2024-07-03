import mongoose from "mongoose";
import { Like } from "../models/like.model.js";
import { sendApiResponse } from "../utils/ApiResponse.js";
import { catchAsync } from "../utils/catchAsync.js";
import StatusCode from "http-status-codes";

const getUserLikeVideos = catchAsync(async (req, res) => {
  const likeVideos = await Like.aggregate([
    { $match: { likedBy: new mongoose.Types.ObjectId(req.user._id) } },
    {
      $lookup: {
        from: "videos",
        localField: "video",
        foreignField: "_id",
        as: "video",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [{ $project: { password: 0, refreshToken: 0, accessToken: 0 } }],
            },
          },
          { $addFields: { owner: { $arrayElemAt: ["$owner", 0] } } },
        ],
      },
    },
    { $addFields: { video: { $arrayElemAt: ["$video", 0] } } },
    { $sort: { createdAt: -1 } },
  ]);
  if (!likeVideos || likeVideos.length === 0)
    return sendApiResponse({
      res,
      statusCode: StatusCode.OK,
      data: [],
      message: "No likes found",
    });
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: likeVideos,
    message: "Likes found successfully",
  });
});
const createLike = catchAsync(async (req, res) => {
  const { tweetId, commentId, videoId } = req.body;
  if (!(videoId || tweetId || commentId)) throw new Error("Video id, tweet id or comment id is required");
  const createdObj = { likedBy: new mongoose.Types.ObjectId(req.user._id) };
  if (videoId) createdObj.video = new mongoose.Types.ObjectId(videoId);
  if (tweetId) createdObj.tweet = new mongoose.Types.ObjectId(tweetId);
  if (commentId) createdObj.comment = new mongoose.Types.ObjectId(commentId);
  const like = await Like.create(createdObj);
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
  console.log(like);
  if (!like) throw new Error("Like not found");
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: like,
    message: "Like deleted successfully",
  });
});

export const likeController = { createLike, disLike, getUserLikeVideos };
