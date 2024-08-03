import mongoose from "mongoose";
import { Video } from "../models/video.model.js";
import { sendApiResponse } from "../utils/ApiResponse.js";
import { catchAsync } from "../utils/catchAsync.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import StatusCode from "http-status-codes";
import ApiError from "../utils/ApiError.js";
import { getUserIdFromToken } from "../utils/jwt.js";
import { Comment } from "../models/comment.model.js";
import { Like } from "../models/like.model.js";
import { generateThumbnails } from "../utils/generate-thumbnails.js";
import { paginationHelpers } from "../utils/paginationHelpers.js";

const getAllContentsByType = catchAsync(async (req, res) => {
  const type = req.query.type || "video";
  const totalContent = await Video.countDocuments({ isPublished: true, type });
  const { limit, meta, skip } = paginationHelpers(req, totalContent);

  const content = await Video.aggregate([
    { $match: { isPublished: true, type } },
    { $sort: { createdAt: -1 } },
    { $skip: skip },
    { $limit: limit },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
        pipeline: [
          { $project: { password: 0, refreshToken: 0, watchHistory: 0, lastPasswordChange: 0 } },
          {
            $lookup: {
              from: "subscriptions",
              localField: "_id",
              foreignField: "channel",
              as: "subscribers",
            },
          },
          { $addFields: { subscribersCount: { $size: "$subscribers" } } },
          { $project: { subscribers: 0 } },
        ],
      },
    },
    { $addFields: { owner: { $arrayElemAt: ["$owner", 0] } } },
  ]);

  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: content,
    meta,
    message: content?.length > 0 ? "Content found successfully" : "No content found",
  });
});

const getAllTrandingContent = catchAsync(async (req, res) => {
  const isMusic = req.query.isMusic;
  let query = {
    isPublished: true,
    views: {
      $gte: 100,
    },
  };
  if (isMusic) {
    query.type = "video";
  } else {
    query.createdAt = {
      $gte: new Date(new Date().getTime() - 30 * 24 * 60 * 60 * 1000),
    };
  }
  const trendingContent = await Video.find(query)
    .populate("owner", "avatar fullName isVerified username")
    .sort({ views: -1 })
    .limit(30);
  if (!trendingContent || !trendingContent.length)
    return sendApiResponse({
      res,
      data: [],
      message: "Not Trending Video found",
      statusCode: StatusCode.OK,
    });
  return sendApiResponse({
    res,
    data: trendingContent,
    message: "Trending Video found",
    statusCode: StatusCode.OK,
  });
});

const getAllShorts = catchAsync(async (req, res) => {
  let userId = getUserIdFromToken(req);
  if (userId) userId = new mongoose.Types.ObjectId(userId);

  const totalShorts = await Video.countDocuments({ type: "short", isPublished: true });
  const { limit, meta, skip } = paginationHelpers(req, totalShorts);
  const video = await Video.aggregate([
    { $match: { type: "short", isPublished: true } },
    { $sort: { createdAt: -1 } },
    { $skip: skip },
    { $limit: limit },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
        pipeline: [
          { $lookup: { from: "subscriptions", localField: "_id", foreignField: "channel", as: "subscribers" } },
          { $project: { password: 0, refreshToken: 0, accessToken: 0, watchHistory: 0 } },
          {
            $addFields: {
              subscribersCount: { $size: "$subscribers" },
              isSubscribed: {
                $cond: {
                  if: { $in: [userId, "$subscribers.subscriber"] },
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
    { $addFields: { owner: { $arrayElemAt: ["$owner", 0] } } },
    { $lookup: { from: "likes", localField: "_id", foreignField: "video", as: "likes" } },
    {
      $addFields: {
        likes: { $size: "$likes" },
        isLiked: {
          $cond: { if: { $in: [userId, "$likes.likedBy"] }, then: true, else: false },
        },
      },
    },
  ]);
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: video,
    message: video?.length > 0 ? "Content found successfully" : "No content found",
    meta,
  });
});

const getVideoById = catchAsync(async (req, res) => {
  if (!req.params.id) throw new Error("Id is required");
  let userId = getUserIdFromToken(req);
  if (userId) userId = new mongoose.Types.ObjectId(userId);
  const video = await Video.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(req.params.id) } },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
        pipeline: [
          { $lookup: { from: "subscriptions", localField: "_id", foreignField: "channel", as: "subscribers" } },
          { $project: { password: 0, refreshToken: 0, accessToken: 0, watchHistory: 0, lastPasswordChange: 0 } },
          {
            $addFields: {
              subscribersCount: { $size: "$subscribers" },
              isSubscribed: {
                $cond: {
                  if: { $in: [userId, "$subscribers.subscriber"] },
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

    { $lookup: { from: "likes", localField: "_id", foreignField: "video", as: "likes" } },
    {
      $addFields: {
        likes: { $size: "$likes" },
        isLiked: {
          $cond: { if: { $in: [userId, "$likes.likedBy"] }, then: true, else: false },
        },
      },
    },
    { $addFields: { owner: { $arrayElemAt: ["$owner", 0] } } },
  ]);

  if (!video || video.length === 0 || !video?.[0]?.isPublished)
    return sendApiResponse({
      res,
      statusCode: StatusCode.OK,
      data: null,
      message: "No video found or video is not published",
    });
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: video[0],
    message: "Video found successfully",
  });
});

const getVideoByUserId = catchAsync(async (req, res) => {
  if (!req.params.id) throw new ApiError(StatusCode.BAD_REQUEST, "User id is required");
  const type = req.query.type || "video";
  const totalVideos = await Video.countDocuments({ owner: req.params.id, isPublished: true, type });
  const { limit, skip, meta } = paginationHelpers(req, totalVideos);
  const videos = await Video.find({ owner: req.params.id, isPublished: true, type })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("owner", "-password -refreshToken -watchHistory -lastPasswordChange")
    .lean();

  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: videos,
    meta,
    message: videos?.length > 0 ? "Videos found successfully" : "No videos found",
  });
});

const getAllUserContentByType = catchAsync(async (req, res) => {
  const type = req.query.type || "video";
  const userId = new mongoose.Types.ObjectId(req.user._id);
  const videos = await Video.aggregate([
    { $match: { owner: userId, type } },

    { $sort: { createdAt: -1 } },
    { $lookup: { from: "comments", localField: "_id", foreignField: "video", as: "comments" } },
    { $lookup: { from: "likes", localField: "_id", foreignField: "video", as: "likes" } },
    { $lookup: { from: "playlists", localField: "_id", foreignField: "videos", as: "playlists" } },
    {
      $addFields: {
        likes: { $size: "$likes" },
        comments: { $size: "$comments" },
        isLiked: {
          $cond: { if: { $in: [userId, "$likes.likedBy"] }, then: true, else: false },
        },
      },
    },
  ]);
  if (!videos)
    return sendApiResponse({
      res,
      statusCode: StatusCode.OK,
      data: [],
      message: "No videos found",
    });
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: videos,
    message: "Videos found successfully",
  });
});

const getAllSearchContent = catchAsync(async (req, res) => {
  const { search_query } = req.query;
  if (!search_query?.trim()) {
    throw new ApiError(StatusCode.BAD_REQUEST, "Search query is required");
  }
  const searchQuery = search_query.trim();
  const q = new RegExp(searchQuery, "i");
  const content = await Video.find({
    $or: [{ title: { $regex: q } }, { description: { $regex: q } }],
    isPublished: true,
  })
    .sort({ createdAt: -1 })
    .populate("owner", "-password -refreshToken -watchHistory -lastPasswordChange");

  if (!content || content.length === 0)
    return sendApiResponse({
      res,
      statusCode: StatusCode.OK,
      data: [],
      message: "No videos found",
    });
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: content,
    message: "Videos found successfully",
  });
});

const updateViewCount = catchAsync(async (req, res) => {
  const video = await Video.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } }, { new: true });
  if (!video) throw new ApiError("Video not found");
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: video,
    message: "Video updated successfully",
  });
});

const uploadVideo = catchAsync(async (req, res) => {
  const { title, description, isPublished, type } = req.body;
  if (!title || !description) {
    throw new ApiError(StatusCode.BAD_REQUEST, "Title and description are required");
  }
  const videoFilesLocalPath = req.files.videoFiles?.[0]?.path;
  const thumbnailFilesLocalPath = req.files.thumbnail?.[0]?.path;
  if (!videoFilesLocalPath) {
    throw new ApiError(StatusCode.BAD_REQUEST, "Video file are required");
  }

  let thumbnail;
  if (type === "video") {
    if (thumbnailFilesLocalPath) {
      thumbnail = await uploadOnCloudinary(thumbnailFilesLocalPath);
      if (!thumbnail) {
        throw new ApiError(StatusCode.INTERNAL_SERVER_ERROR, "Error uploading thumbnail to cloudinary");
      }
    } else {
      const result = await generateThumbnails({ url: videoFilesLocalPath });
      if (!result?.success) throw new ApiError(StatusCode.INTERNAL_SERVER_ERROR, "Error generating thumbnail");
      thumbnail = await uploadOnCloudinary(result?.url);
      if (!thumbnail) throw new ApiError(StatusCode.INTERNAL_SERVER_ERROR, "Error uploading thumbnail to cloudinary");
    }
  }

  const videoFiles = await uploadOnCloudinary(videoFilesLocalPath);
  if (!videoFiles) {
    throw new ApiError(StatusCode.INTERNAL_SERVER_ERROR, "Error uploading files to cloudinary");
  }
  const { url, duration } = videoFiles;

  const uploadVideos = await Video.create({
    description,
    title,
    videoFile: url,
    thumbnail: thumbnail?.url || null,
    duration,
    isPublished,
    type,
    owner: new mongoose.Types.ObjectId(req.user._id),
  });

  if (!uploadVideos) {
    throw new ApiError(StatusCode.INTERNAL_SERVER_ERROR, "Error save to uploading video into db");
  }

  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: uploadVideos,
    message: "Video uploaded successfully",
  });
});

const updateVideo = catchAsync(async (req, res) => {
  const { title, description, isPublished, type, thumbnail } = req.body;
  if (!title || !description || !isPublished || !type) {
    throw new ApiError(StatusCode.BAD_REQUEST, "One field is required");
  }

  const thumbnailFilesLocalPath = req.files.thumbnail?.[0]?.path;
  if (!thumbnailFilesLocalPath && !thumbnail && type === "video") {
    throw new ApiError(StatusCode.BAD_REQUEST, "Thumbnail is required");
  }

  if (thumbnailFilesLocalPath && type === "video") {
    const thumbnail = await uploadOnCloudinary(thumbnailFilesLocalPath);
    if (!thumbnail) {
      throw new ApiError(StatusCode.INTERNAL_SERVER_ERROR, "Error uploading files to cloudinary");
    }
    req.body.thumbnail = thumbnail.url;
  }

  const video = await Video.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!video) throw new ApiError(StatusCode.NOT_FOUND, "Video not found");
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: video,
    message: "Video updated successfully",
  });
});

const makeACopy = catchAsync(async (req, res) => {
  const content = await Video.findById(req.params.id);
  if (!content) throw new Error("Video not found");
  const newContent = await Video.create({
    description: content.description,
    title: content.title,
    videoFile: content.videoFile,
    thumbnail: content.thumbnail,
    duration: content.duration,
    isPublished: content.isPublished,
    type: content.type,
    owner: new mongoose.Types.ObjectId(content.owner),
  });
  if (!newContent) throw new Error("Error creating new video");
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: newContent,
    message: "Content copied successfully",
  });
});

const deleteVideo = catchAsync(async (req, res) => {
  const id = req.params.id;
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const video = await Video.findByIdAndDelete(id, { session });
    if (!video) throw new ApiError(StatusCode.NOT_FOUND, "Video not found");
    const comments = await Comment.deleteMany({ video: new mongoose.Types.ObjectId(id) }, { session });
    if (!comments) throw new ApiError(StatusCode.BAD_REQUEST, "Failed to delete video comments");
    const likes = await Like.deleteMany({ video: new mongoose.Types.ObjectId(id) }, { session });
    if (!likes) throw new ApiError(StatusCode.BAD_REQUEST, "Failed to delete video likes");
    await session.commitTransaction();
    await session.endSession();
    return sendApiResponse({
      res,
      statusCode: StatusCode.OK,
      data: video,
      message: "Video deleted successfully",
    });
  } catch (error) {
    await session.abortTransaction();
    await session.endSession();
    throw error;
  }
});

export const videoController = {
  uploadVideo,
  deleteVideo,
  getVideoById,
  getAllContentsByType,
  getVideoByUserId,
  getAllUserContentByType,
  updateVideo,
  makeACopy,
  getAllShorts,
  getAllSearchContent,
  updateViewCount,
  getAllTrandingContent,
};
