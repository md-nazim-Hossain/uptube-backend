import mongoose from "mongoose";
import { Comment } from "../models/comment.model.js";
import { sendApiResponse } from "../utils/ApiResponse.js";
import { catchAsync } from "../utils/catchAsync.js";
import StatusCode from "http-status-codes";

const createComment = catchAsync(async (req, res) => {
  const { content, videoId, tweetId, isReplay } = req.body;
  if (!(videoId || tweetId)) throw new Error("Video id or tweet id is required");
  if (!content) throw new Error("Content is required");
  const commentData = {
    content,
    owner: new mongoose.Types.ObjectId(req.user._id),
  };
  if (videoId) commentData.video = new mongoose.Types.ObjectId(videoId);
  if (tweetId) commentData.tweet = new mongoose.Types.ObjectId(tweetId);
  const comment = await Comment.create(commentData);
  if (!comment) throw new Error("Error creating a comment");
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: comment,
    message: "Comment created successfully",
  });
});

const updateComment = catchAsync(async (req, res) => {
  const { content } = req.body;
  if (!content) throw new Error("Content is required");
  const comment = await Comment.findByIdAndUpdate(
    req.params.id,
    { content, isEdited: true, lastEditedAt: new Date().toISOString() },
    { new: true }
  );
  if (!comment) throw new Error("Comment not found");
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: comment,
    message: "Comment updated successfully",
  });
});

const deleteComment = catchAsync(async (req, res) => {
  const comment = await Comment.findByIdAndDelete(req.params.id);
  if (!comment) throw new Error("Comment not found");
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: comment,
    message: "Comment deleted successfully",
  });
});

export const commentController = { createComment, deleteComment, updateComment };
