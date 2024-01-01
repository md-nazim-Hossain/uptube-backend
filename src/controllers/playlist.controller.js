import { catchAsync } from "../utils/catchAsync.js";
import { PlayList } from "../models/playlist.model.js";
import { sendApiResponse } from "../utils/ApiResponse.js";

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
};
