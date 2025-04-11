import mongoose from "mongoose";
import { Tweet } from "../models/tweets.model.js";
import { sendApiResponse } from "../utils/ApiResponse.js";
import { catchAsync } from "../utils/catchAsync.js";
import StatusCode from "http-status-codes";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import ApiError from "../utils/ApiError.js";
import { paginationHelpers } from "../utils/paginationHelpers.js";
import { getUserIdFromToken } from "../utils/jwt.js";
import { Like } from "../models/like.model.js";
import { Comment } from "../models/comment.model.js";
import { Notification } from "../models/notification.model.js";
import { createNotifications } from "../utils/notification.js";

const getAllUserTweets = catchAsync(async (req, res) => {
  const userId = new mongoose.Types.ObjectId(req.user._id);
  const totalTweets = await Tweet.countDocuments({ author: userId });
  const { limit, skip, meta, sortBy, sortOrder } = paginationHelpers(req, totalTweets);

  const tweets = await Tweet.aggregate([
    { $match: { author: userId } },
    { $lookup: { from: "likes", localField: "_id", foreignField: "tweet", as: "likes" } },
    { $lookup: { from: "comments", localField: "_id", foreignField: "tweet", as: "comments" } },
    {
      $addFields: {
        likes: { $size: "$likes" },
        comments: { $size: "$comments" },
      },
    },
    { $sort: { [sortBy]: sortOrder === "asc" ? 1 : -1 } },
    { $skip: skip },
    { $limit: limit },
  ]);

  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: tweets,
    message: tweets?.length > 0 ? "Tweets found successfully" : "No tweets found",
    meta,
  });
});

const getAllLatestTweets = catchAsync(async (req, res) => {
  const date = new Date(new Date().getTime() - 30 * 24 * 60 * 60 * 1000);
  const id = getUserIdFromToken(req);
  const totalLatestTweets = await Tweet.countDocuments({
    createdAt: { $gte: date },
    isPublished: true,
  });

  if (totalLatestTweets === 0)
    return sendApiResponse({ res, statusCode: StatusCode.OK, data: [], message: "No tweets found" });

  const { limit, skip, meta } = paginationHelpers(req, totalLatestTweets);

  const tweets = await Tweet.aggregate([
    { $match: { createdAt: { $gte: date }, isPublished: true } },
    { $sort: { createdAt: -1 } },
    { $limit: limit },
    { $skip: skip },
    {
      $lookup: {
        from: "users",
        localField: "author",
        foreignField: "_id",
        as: "author",
        pipeline: [
          { $project: { password: 0, refreshToken: 0, watchHistory: 0, lastPasswordChange: 0 } },
          { $lookup: { from: "subscriptions", localField: "_id", foreignField: "channel", as: "subscribers" } },
          {
            $addFields: {
              subscribersCount: { $size: "$subscribers" },
              isSubscribed: {
                $cond: {
                  if: { $in: [new mongoose.Types.ObjectId(id), "$subscribers.subscriber"] },
                  then: true,
                  else: false,
                },
              },
            },
          },
          { $project: { subscribers: 0 } },
        ],
      },
    },
    { $lookup: { from: "likes", localField: "_id", foreignField: "tweet", as: "likes" } },
    { $lookup: { from: "comments", localField: "_id", foreignField: "tweet", as: "comments" } },

    {
      $addFields: {
        likes: { $size: "$likes" },
        comments: { $size: "$comments" },
        isLiked: {
          $cond: { if: { $in: [new mongoose.Types.ObjectId(id), "$likes.likedBy"] }, then: true, else: false },
        },

        author: { $arrayElemAt: ["$author", 0] },
      },
    },
  ]);

  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: tweets,
    meta,
    message: tweets?.length > 0 ? "Tweets found successfully" : "No tweets found",
  });
});

const getTweetById = catchAsync(async (req, res) => {
  if (!req.params.id) throw new ApiError(StatusCode.BAD_REQUEST, "Tweet id is required");
  const id = getUserIdFromToken(req);
  const tweet = await Tweet.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(req.params.id) } },
    {
      $lookup: {
        from: "users",
        localField: "author",
        foreignField: "_id",
        as: "author",
        pipeline: [
          { $project: { password: 0, refreshToken: 0, watchHistory: 0, lastPasswordChange: 0 } },
          { $lookup: { from: "subscriptions", localField: "_id", foreignField: "channel", as: "subscribers" } },
          {
            $addFields: {
              subscribersCount: { $size: "$subscribers" },
              isSubscribed: {
                $cond: {
                  if: { $in: [new mongoose.Types.ObjectId(id), "$subscribers.subscriber"] },
                  then: true,
                  else: false,
                },
              },
            },
          },
          { $project: { subscribers: 0 } },
        ],
      },
    },
    { $lookup: { from: "likes", localField: "_id", foreignField: "tweet", as: "likes" } },
    { $lookup: { from: "comments", localField: "_id", foreignField: "tweet", as: "comments" } },

    {
      $addFields: {
        likes: { $size: "$likes" },
        comments: { $size: "$comments" },
        isLiked: {
          $cond: { if: { $in: [new mongoose.Types.ObjectId(id), "$likes.likedBy"] }, then: true, else: false },
        },

        author: { $arrayElemAt: ["$author", 0] },
      },
    },
  ]);

  if (!tweet || tweet.length === 0) throw new ApiError(StatusCode.NOT_FOUND, "Tweet not found");

  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: tweet[0],
    message: "Tweet found successfully",
  });
});

const createTweet = catchAsync(async (req, res) => {
  const { content, isPublished } = req.body;
  const thumbnailFilesLocalPath = req.file?.path;
  if (!content) throw new ApiError(StatusCode.BAD_REQUEST, "Content is required");

  let thumbnail;
  if (thumbnailFilesLocalPath) {
    thumbnail = await uploadOnCloudinary(thumbnailFilesLocalPath);
    if (!thumbnail) {
      throw new ApiError(StatusCode.INTERNAL_SERVER_ERROR, "Error uploading files to cloudinary");
    }
  }

  const tweet = await Tweet.create({
    content,
    thumbnail: thumbnail?.url ?? "",
    isPublished,
    author: new mongoose.Types.ObjectId(req.user._id),
  });

  if (!tweet) throw new ApiError(StatusCode.INTERNAL_SERVER_ERROR, "Error creating tweet");

  sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: tweet,
    message: "Tweet created successfully",
  });
  await createNotifications(req.user._id, null, new mongoose.Types.ObjectId(tweet._id));
});

const updateTweet = catchAsync(async (req, res) => {
  const { content } = req.body;
  const thumbnailFilesLocalPath = req.file?.path;
  if (!content) throw new ApiError(StatusCode.BAD_REQUEST, "Content is required");

  if (thumbnailFilesLocalPath) {
    const uploadThumbnail = await uploadOnCloudinary(thumbnailFilesLocalPath);
    if (!uploadThumbnail) {
      throw new ApiError(StatusCode.INTERNAL_SERVER_ERROR, "Error uploading files to cloudinary");
    }
    req.body.thumbnail = uploadThumbnail.url;
  }

  const tweet = await Tweet.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!tweet) throw new ApiError(StatusCode.NOT_IMPLEMENTED, "Tweet not found");
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: tweet,
    message: "Tweet updated successfully",
  });
});

const deleteTweet = catchAsync(async (req, res) => {
  const id = req.params.id;
  if (!id) throw new ApiError(StatusCode.BAD_REQUEST, "Tweet id is required");
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const tweet = await Tweet.findByIdAndDelete(id, { session });
    if (!tweet) throw new ApiError(StatusCode.NOT_FOUND, "Tweet not found");
    await Comment.deleteMany({ tweet: new mongoose.Types.ObjectId(id) }, { session });
    await Like.deleteMany({ tweet: new mongoose.Types.ObjectId(id) }, { session });
    await Notification.deleteMany({ tweet: new mongoose.Types.ObjectId(id) }, { session });
    const deleteImage = await deleteOnCloudinary(tweet.thumbnail, "image");
    if (!deleteImage?.success) {
      throw new ApiError(StatusCode.INTERNAL_SERVER_ERROR, "Error deleting image from Cloudinary");
    }
    await session.commitTransaction();
    return sendApiResponse({
      res,
      statusCode: StatusCode.OK,
      data: null,
      message: "Tweet deleted successfully",
    });
  } catch (error) {
    await session.abortTransaction();
    throw new ApiError(StatusCode.INTERNAL_SERVER_ERROR, "Error deleting tweet");
  } finally {
    await session.endSession();
  }
});

export const tweetsController = {
  getAllUserTweets,
  getAllLatestTweets,
  createTweet,
  deleteTweet,
  updateTweet,
  getTweetById,
};
