import mongoose from "mongoose";
import { Video } from "../models/video.model.js";
import { sendApiResponse } from "../utils/ApiResponse.js";
import { catchAsync } from "../utils/catchAsync.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import StatusCode from "http-status-codes";
import ApiError from "../utils/ApiError.js";
import { Like } from "../models/like.model.js";

const getAllVideos = catchAsync(async (req, res) => {
  const limit = req.query.limit || 10;
  const skip = req.query.skip || 0;
  const totalVideos = await Video.countDocuments({});
  const videos = await Video.aggregate([
    { $match: { isPublished: true } },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
        pipeline: [
          { $project: { password: 0, refreshToken: 0, accessToken: 0 } },
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
    { $skip: skip },
    { $limit: limit },
    { $sort: { createdAt: -1 } },
    { $addFields: { owner: { $arrayElemAt: ["$owner", 0] } } },
  ]);
  if (!videos || videos.length === 0)
    return sendApiResponse({
      res,
      statusCode: StatusCode.OK,
      data: {
        data: [],
        total: totalVideos,
      },
      message: "No videos found",
    });
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: {
      data: videos,
      total: totalVideos,
    },
    message: "Videos found successfully",
  });
});

const getVideoById = catchAsync(async (req, res) => {
  const video = await Video.findById(req.params.id);
  if (!video || !video.isPublished)
    return sendApiResponse({
      res,
      statusCode: StatusCode.OK,
      data: null,
      message: "No video found or video is not published",
    });
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: video,
    message: "Video found successfully",
  });
});

const getVideoByUsername = catchAsync(async (req, res) => {
  if (!req.params.username) throw new ApiError(StatusCode.BAD_REQUEST, "Username is required");
  const videos = await Video.find({ owner: req.params.username, isPublished: true });
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

const getAllVideosByCurrentUser = catchAsync(async (req, res) => {
  const videos = await Video.aggregate([
    { $match: { owner: new mongoose.Types.ObjectId(req.user._id) } },

    { $lookup: { from: "comments", localField: "_id", foreignField: "video", as: "comments" } },
    { $lookup: { from: "likes", localField: "_id", foreignField: "video", as: "likes" } },
    { $lookup: { from: "playlists", localField: "_id", foreignField: "videos", as: "playlists" } },
    {
      $addFields: {
        likes: { $size: "$likes" },
        comments: { $size: "$comments" },
        isLiked: {
          $cond: { if: { $in: [req.user._id, "$likes.likedBy"] }, then: true, else: false },
        },
      },
    },
    { $sort: { createdAt: -1 } },
    { $limit: 10 },
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

const uploadVideo = catchAsync(async (req, res) => {
  const { title, description, isPublished } = req.body;
  if (!title || !description) {
    throw new Error("Title and description are required");
  }
  const videoFilesLocalPath = req.files.videoFiles?.[0]?.path;
  const thumbnailFilesLocalPath = req.files.thumbnail?.[0]?.path;

  if (!videoFilesLocalPath || !thumbnailFilesLocalPath) {
    throw new Error("Video files and thumbnail files are required");
  }

  const videoFiles = await uploadOnCloudinary(videoFilesLocalPath);
  const thumbnail = await uploadOnCloudinary(thumbnailFilesLocalPath);

  if (!videoFiles || !thumbnail) {
    throw new Error("Error uploading files to cloudinary");
  }
  const { url, duration } = videoFiles;

  const uploadVideos = await Video.create({
    description,
    title,
    videoFile: url,
    thumbnail: thumbnail.url,
    duration,
    isPublished,
    owner: new mongoose.Types.ObjectId(req.user._id),
  });

  if (!uploadVideos) {
    throw new Error("Error save to uploading video into db");
  }

  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: uploadVideos,
    message: "Video uploaded successfully",
  });
});

const updateVideo = catchAsync(async (req, res) => {
  const { title, description, isPublished, thumbnail } = req.body;
  if (!title || !description || !thumbnail || !isPublished) {
    throw new Error("One field is required");
  }

  const thumbnailFilesLocalPath = req.files.thumbnail?.[0]?.path;

  if (thumbnailFilesLocalPath) {
    const thumbnail = await uploadOnCloudinary(thumbnailFilesLocalPath);
    if (!thumbnail) {
      throw new Error("Error uploading files to cloudinary");
    }
    req.body.thumbnail = thumbnail.url;
  }

  const video = await Video.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!video) throw new Error("Video not found");
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: video,
    message: "Video updated successfully",
  });
});

const makeACopy = catchAsync(async (req, res) => {
  const video = await Video.findById(req.params.id);
  if (!video) throw new Error("Video not found");
  const newVideo = await Video.create({
    description: video.description,
    title: video.title,
    videoFile: video.videoFile,
    thumbnail: video.thumbnail,
    duration: video.duration,
    isPublished: video.isPublished,
    owner: new mongoose.Types.ObjectId(video.owner),
  });
  if (!newVideo) throw new Error("Error creating new video");
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: newVideo,
    message: "Video copied successfully",
  });
});

const deleteVideo = catchAsync(async (req, res) => {
  const video = await Video.findByIdAndDelete(req.params.id);
  if (!video) throw new Error("Video not found");
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: video,
    message: "Video deleted successfully",
  });
});

export const videoController = {
  uploadVideo,
  deleteVideo,
  getVideoById,
  getAllVideos,
  getVideoByUsername,
  getAllVideosByCurrentUser,
  updateVideo,
  makeACopy,
};
