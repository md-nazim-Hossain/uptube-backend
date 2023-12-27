import mongoose from "mongoose";
import { Video } from "../models/video.model.js";
import { sendApiResponse } from "../utils/ApiResponse.js";
import { catchAsync } from "../utils/catchAsync.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import StatusCode from "http-status-codes";

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

export const videoController = {
  uploadVideo,
};
