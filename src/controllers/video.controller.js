import crypto from "crypto";
import fs from "fs";
import mongoose from "mongoose";
import { Video } from "../models/video.model.js";
import { sendApiResponse } from "../utils/ApiResponse.js";
import { catchAsync } from "../utils/catchAsync.js";
import { deleteOnCloudinary, uploadOnCloudinary } from "../utils/cloudinary.js";
import StatusCode from "http-status-codes";
import ApiError from "../utils/ApiError.js";
import { getUserIdFromToken } from "../utils/jwt.js";
import { Comment } from "../models/comment.model.js";
import { Like } from "../models/like.model.js";
import { generateThumbnails } from "../utils/generate-thumbnails.js";
import { paginationHelpers } from "../utils/paginationHelpers.js";
import { Notification } from "../models/notification.model.js";
import { createNotifications } from "../utils/notification.js";
import logger from "../utils/logger.js";

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
  let { limit, meta, skip, queryId, page } = paginationHelpers(req, totalShorts);
  const _id = new mongoose.Types.ObjectId(queryId);
  const aggregration = [
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
        pipeline: [
          { $lookup: { from: "subscriptions", localField: "_id", foreignField: "channel", as: "subscribers" } },
          { $project: { password: 0, refreshToken: 0, lastPasswordChange: 0 } },
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
  ];

  const rootMatcher = [{ $match: { isPublished: true, type: "short" } }];
  const relatedMatcher = [];

  if (queryId && page === 1) {
    skip = skip > 0 ? skip - 1 : skip;
    limit -= 1;
    rootMatcher[0]["$match"]._id = _id;
    relatedMatcher.push(
      {
        $lookup: {
          from: "videos",
          localField: "type",
          foreignField: "type",
          as: "related",
          pipeline: [
            { $match: { isPublished: true, type: "short", _id: { $ne: _id } } },
            { $sort: { createdAt: -1 } },
            ...aggregration,
          ],
        },
      },
      {
        $addFields: { related: { $slice: ["$related", skip, limit] } },
      }
    );
  } else {
    relatedMatcher.push({ $sort: { createdAt: -1 } }, { $skip: skip }, { $limit: limit });
  }
  const videos = await Video.aggregate([...rootMatcher, ...relatedMatcher, ...aggregration]);

  if (!videos || !videos.length)
    return sendApiResponse({ res, statusCode: StatusCode.OK, data: [], message: "No content found", meta });
  let newVideoArray = [];
  if (queryId && page === 1) {
    newVideoArray = videos?.[0]?.related || [];
    delete videos?.[0]?.related;
    newVideoArray.unshift(videos?.[0]);
  } else {
    newVideoArray = videos;
  }
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: newVideoArray,
    message: "Content found successfully",
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
  const totalContent = await Video.countDocuments({ isPublished: true, type, owner: userId });
  const { limit, meta, skip, sortBy, sortOrder } = paginationHelpers(req, totalContent);
  const videos = await Video.aggregate([
    { $match: { owner: userId, type } },

    { $sort: { [sortBy]: sortOrder === "asc" ? 1 : -1 } },
    { $skip: skip },
    { $limit: limit },
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
    meta,
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

const getAllContentByHashTag = catchAsync(async (req, res) => {
  const { hashtag } = req?.params;
  const hashtagTrim = hashtag.trim();
  const type = req?.query?.type;

  if (!hashtagTrim) throw new ApiError(StatusCode.BAD_REQUEST, "Hashtag is required");

  const hashtagText = hashtagTrim.startsWith("#") ? hashtagTrim : `#${hashtagTrim}`;
  const query = new RegExp(hashtagText, "i");
  const searchQuery = {
    $or: [{ title: { $regex: query } }, { description: { $regex: query } }],
    isPublished: true,
  };

  if (type) {
    searchQuery.type = type;
  }

  const totalContent = await Video.countDocuments(searchQuery);
  const { limit, meta, skip } = paginationHelpers(req, totalContent);

  const videos = await Video.find(searchQuery)
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip)
    .populate("owner", "-password -refreshToken -watchHistory -lastPasswordChange")
    .lean();

  return sendApiResponse({
    res,
    data: videos,
    message: videos?.length > 0 ? "Data found successfully" : `No ${hashtagTrim} hashtag found`,
    statusCode: StatusCode.OK,
    meta,
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

  // Generate SHA256 Hash
  const generatedHash = await new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(videoFilesLocalPath);
    stream.on("data", (data) => hash.update(data));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", (error) => reject(error));
  });

  // Check for Duplicates in Database
  const existingVideo = await Video.findOne({ videoHash: generatedHash });

  if (existingVideo) {
    // Delete the temporary local video file
    if (fs.existsSync(videoFilesLocalPath)) {
      fs.unlinkSync(videoFilesLocalPath);
    }
    // also delete thumbnail if it exists
    if (thumbnailFilesLocalPath && fs.existsSync(thumbnailFilesLocalPath)) {
        fs.unlinkSync(thumbnailFilesLocalPath);
    }
    throw new ApiError(StatusCode.CONFLICT, "This video already exists.");
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
    // If Cloudinary upload fails, and a thumbnail was uploaded, attempt to delete it.
    if (thumbnail && thumbnail.public_id) {
        await deleteOnCloudinary(thumbnail.public_id, "image");
    }
    throw new ApiError(StatusCode.INTERNAL_SERVER_ERROR, "Error uploading video file to cloudinary");
  }
  const { url, duration } = videoFiles;

  const uploadVideos = await Video.create({
    description,
    title,
    videoFile: url,
    videoHash: generatedHash, // Add the generated hash
    thumbnail: thumbnail?.url || null,
    duration,
    isPublished,
    type,
    owner: new mongoose.Types.ObjectId(req.user._id),
  });

  if (!uploadVideos) {
    // If saving to DB fails, attempt to delete video and thumbnail from Cloudinary
    if (videoFiles && videoFiles.public_id) {
        await deleteOnCloudinary(videoFiles.public_id, "video");
    }
    if (thumbnail && thumbnail.public_id) {
        await deleteOnCloudinary(thumbnail.public_id, "image");
    }
    throw new ApiError(StatusCode.INTERNAL_SERVER_ERROR, "Error save to uploading video into db");
  }

  sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: uploadVideos,
    message: "Video uploaded successfully",
  });
  await createNotifications(req.user._id, new mongoose.Types.ObjectId(uploadVideos._id), null);
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

    const deletePreviousThumbnail = await deleteOnCloudinary(thumbnail, "image");
    if (!deletePreviousThumbnail.success) {
      throw new ApiError(StatusCode.INTERNAL_SERVER_ERROR, "Error deleting thumbnail from Cloudinary");
    }
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

    const otherVideosUsingSameFile = await Video.countDocuments({
      videoFile: video.videoFile,
      _id: { $ne: id },
    }).session(session);

    await Comment.deleteMany({ video: new mongoose.Types.ObjectId(id) }, { session });
    await Like.deleteMany({ video: new mongoose.Types.ObjectId(id) }, { session });
    await Notification.deleteMany({ video: new mongoose.Types.ObjectId(id) }, { session });

    if (!otherVideosUsingSameFile) {
      const cloudinaryResult = await deleteOnCloudinary(video.videoFile, "video");
      const deleteThumbnail = await deleteOnCloudinary(video.thumbnail, "image");
      if (!deleteThumbnail?.success || !cloudinaryResult?.success) {
        throw new ApiError(StatusCode.INTERNAL_SERVER_ERROR, "Error deleting video or thumbnail from Cloudinary");
      }
    }

    await session.commitTransaction();
    return sendApiResponse({
      res,
      statusCode: StatusCode.OK,
      data: video,
      message: "Video deleted successfully",
    });
  } catch (error) {
    await session.abortTransaction();
    logger.error("Error deleting video:", error?.message);
    throw error;
  } finally {
    await session.endSession();
  }
});

const attachAdsInVideo = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { ads } = req.body;
  if (!ads.length) throw new ApiError(StatusCode.BAD_REQUEST, "Ads is required");
  const video = await Video.findById(id);
  if (!video) throw new ApiError(StatusCode.NOT_FOUND, "Video not found");

  const existingAds = new Set(video.ads.map(String));
  const duplicateAds = ads.filter((ad) => existingAds.has(String(ad)));
  if (duplicateAds.length > 0) {
    throw new ApiError(StatusCode.BAD_REQUEST, `Ads already exist in the video: ${duplicateAds.join(", ")}`);
  }

  video.ads = [...ads, ...video.ads];
  await video.save();
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: video,
    message: "Video updated successfully",
  });
});

const detachAdsInVideo = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { ads } = req.body;
  if (!ads.length) throw new ApiError(StatusCode.BAD_REQUEST, "Ads is required");
  const video = await Video.findById(id);
  if (!video) throw new ApiError(StatusCode.NOT_FOUND, "Video not found");
  video.ads = video.ads.filter((ad) => !ads.includes(ad));
  await video.save();
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: video,
    message: "Video updated successfully",
  });
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
  getAllContentByHashTag,
  attachAdsInVideo,
  detachAdsInVideo,
};
