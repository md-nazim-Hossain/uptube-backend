import { catchAsync } from "../utils/catchAsync.js";
import { PlayList } from "../models/playlist.model.js";
import { sendApiResponse } from "../utils/ApiResponse.js";
import mongoose from "mongoose";
import StatusCode from "http-status-codes";
import { paginationHelpers } from "../utils/paginationHelpers.js";

const getAllPlaylists = catchAsync(async (req, res) => {
  const totalPlaylists = await PlayList.countDocuments({ isPublished: true });
  const { limit, skip, meta, sortBy, sortOrder } = paginationHelpers(req, totalPlaylists);
  const playlists = await PlayList.find({ isPublished: true })
    .sort({ [sortBy]: sortOrder })
    .skip(skip)
    .limit(limit)
    .populate("videos")
    .populate("owner", "-password -refreshToken -watchHistory -lastPasswordChange")
    .lean();
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: playlists,
    message: playlists?.length > 0 ? "Playlists found successfully" : "No playlists found",
    meta,
  });
});

const getPlayListById = catchAsync(async (req, res) => {
  const playlist = await PlayList.findById(req.params.id);
  if (!playlist) throw new Error("Playlist not found");
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: playlist,
    message: "Playlist found successfully",
  });
});

const getAllPlaylistByUserId = catchAsync(async (req, res) => {
  if (!req.params.id) throw new Error("User id is required");
  const totalPlaylists = await PlayList.countDocuments({ owner: req.params.id });
  const { limit, skip, meta, sortBy, sortOrder } = paginationHelpers(req, totalPlaylists);
  const playlists = await PlayList.find({ owner: req.params.id })
    .sort({ [sortBy]: sortOrder })
    .skip(skip)
    .limit(limit)
    .populate("videos")
    .populate("owner", "-password -refreshToken -watchHistory -lastPasswordChange")
    .lean();

  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: playlists,
    message: playlists?.length > 0 ? "Playlists found successfully" : "No playlists found",
    meta,
  });
});

const createPlaylist = catchAsync(async (req, res) => {
  const { name, description, isPublished, videos } = req.body;
  if (!name || !description || !videos?.length) throw new Error("Name, description and one video is required");
  const playlist = await PlayList.create({
    name,
    description,
    isPublished,
    owner: new mongoose.Types.ObjectId(req.user._id),
    videos: videos.map((video) => new mongoose.Types.ObjectId(video)),
  });
  if (!playlist) throw new Error("Error creating playlist");
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: playlist,
    message: "Playlist created successfully",
  });
});

const updatePlaylist = catchAsync(async (req, res) => {
  const { name, description, isPublished, videos } = req.body;
  if (!name || !description || !isPublished || !videos)
    throw new Error("Name, description, isPublished and videos is required");
  const playlist = await PlayList.findByIdAndUpdate(
    req.params.id,
    { name, description, isPublished, videos: videos.map((video) => new mongoose.Types.ObjectId(video)) },
    { new: true }
  );
  if (!playlist) throw new Error("Playlist not found");
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: playlist,
    message: "Playlist updated successfully",
  });
});

const deletePlaylist = catchAsync(async (req, res) => {
  const playlist = await PlayList.findByIdAndDelete(req.params.id);
  if (!playlist) throw new Error("Playlist not found");
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: playlist,
    message: "Playlist deleted successfully",
  });
});

export const playlistController = {
  createPlaylist,
  deletePlaylist,
  getAllPlaylists,
  updatePlaylist,
  getPlayListById,
  getAllPlaylistByUserId,
};
