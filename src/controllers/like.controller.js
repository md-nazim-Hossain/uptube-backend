import mongoose from "mongoose";
import { Like } from "../models/like.model.js";
import { sendApiResponse } from "../utils/ApiResponse.js";
import { catchAsync } from "../utils/catchAsync.js";
import StatusCode from "http-status-codes";
import { paginationHelpers } from "../utils/paginationHelpers.js";

const getUserLikeVideos = catchAsync(async (req, res) => {
  const likeVideoCount = await Like.countDocuments({
    likedBy: new mongoose.Types.ObjectId(req.user._id),
    video: { $ne: null },
  });
  if (!likeVideoCount)
    return sendApiResponse({ res, statusCode: StatusCode.OK, data: [], message: "No like videos found" });

  const { meta, skip, limit } = paginationHelpers(req, likeVideoCount);
  const videoMatcher = [
    { $match: { isPublished: true } },

    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
        pipeline: [{ $project: { username: 1, fullName: 1, avatar: 1, isVerified: 1, views: 1, createdAt: 1 } }],
      },
    },
    { $addFields: { owner: { $arrayElemAt: ["$owner", 0] } } },
  ];
  const type = req.query.type;
  if (type && type === "video") {
    videoMatcher.push({ $match: { type } });
  }

  const likeVideos = await Like.aggregate([
    { $match: { likedBy: new mongoose.Types.ObjectId(req.user._id), video: { $ne: null } } },

    { $sort: { createdAt: -1 } },
    {
      $lookup: {
        from: "videos",
        localField: "video",
        foreignField: "_id",
        as: "video",
        pipeline: videoMatcher,
      },
    },
    { $addFields: { video: { $arrayElemAt: ["$video", 0] } } },
    { $unwind: "$video" },
    { $limit: limit },
    { $skip: skip },
  ]);

  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: likeVideos,
    message: !likeVideos || !likeVideos.length ? "No like videos found" : "Like videos found successfully",
    meta,
  });
});

const likeDislike = catchAsync(async (req, res) => {
  const { tweetId, videoId, state } = req.body;
  if (!(videoId || tweetId)) throw new Error("Video id, tweet id is required");
  let likeDislikeObj = {};
  if (state === "like") likeDislikeObj.likedBy = new mongoose.Types.ObjectId(req.user._id);
  if (videoId) likeDislikeObj.video = new mongoose.Types.ObjectId(videoId);
  if (tweetId) likeDislikeObj.tweet = new mongoose.Types.ObjectId(tweetId);
  const like = await (state === "like" ? Like.create(likeDislikeObj) : Like.findOneAndDelete(likeDislikeObj));
  if (!like) throw new Error(`Error ${state == "like" ? "creating" : "delete"} a like`);
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: null,
    message: `${state == "like" ? "Like created" : "Removed like"} successfully`,
  });
});

export const likeController = { likeDislike, getUserLikeVideos };
