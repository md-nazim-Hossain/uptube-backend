import { catchAsync } from "../utils/catchAsync.js";
import { PlayList } from "../models/playlist.model.js";
import { sendApiResponse } from "../utils/ApiResponse.js";

const getAllPlaylists = catchAsync(async (req, res) => {
  const playlists = await PlayList.find({ owner: req.user._id });
  if (!playlists || playlists.length === 0)
    return sendApiResponse({
      res,
      statusCode: StatusCode.OK,
      data: [],
      message: "No playlists found",
    });
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: playlists,
    message: "Playlists found successfully",
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

const createPlaylist = catchAsync(async (req, res) => {
  const { name, description } = req.body;
  if (!name || !description) throw new Error("Name and description is required");
  const playlist = await PlayList.create({
    name,
    description,
    owner: new mongoose.Types.ObjectId(req.user._id),
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
  const { name, description } = req.body;
  if (!name || !description) throw new Error("Name and description is required");
  const playlist = await PlayList.findByIdAndUpdate(req.params.id, { name, description });
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
};
