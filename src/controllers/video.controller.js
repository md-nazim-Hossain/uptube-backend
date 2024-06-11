import mongoose from "mongoose";
import { Video } from "../models/video.model.js";
import { sendApiResponse } from "../utils/ApiResponse.js";
import { catchAsync } from "../utils/catchAsync.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import StatusCode from "http-status-codes";
import ApiError from "../utils/ApiError.js";

const getAllVideos = catchAsync(async (req, res) => {
  const videos = await Video.find({ isPublished: true });
  if (!videos || videos.length === 0)
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
};
