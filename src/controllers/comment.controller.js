import mongoose from "mongoose";
import { Comment } from "../models/comment.model.js";
import { sendApiResponse } from "../utils/ApiResponse.js";
import { catchAsync } from "../utils/catchAsync.js";
import StatusCode from "http-status-codes";
import ApiError from "../utils/ApiError.js";

const getAllCommnetsByContentId = catchAsync(async (req, res) => {
  const { id } = req.params;
  if (!id) throw new ApiError(StatusCode.BAD_REQUEST, "Video id or tweet id is required");
  const query = {
    parentComment: null,
    $or: [{ video: new mongoose.Types.ObjectId(id) }, { tweet: new mongoose.Types.ObjectId(id) }],
  };
  const comments = await Comment.find(query)
    .sort({ createdAt: -1 })
    .populate("owner", "-password -refreshToken -watchHistory -lastPasswordChange")
    .populate({ path: "replies", options: { sort: { createdAt: -1 } } })
    .lean();

  if (!comments || comments.length === 0)
    return sendApiResponse({
      res,
      statusCode: StatusCode.OK,
      data: [],
      message: "No comments found",
    });

  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: comments,
    message: "Comments found successfully",
  });
});

const createComment = catchAsync(async (req, res) => {
  const { content, videoId, tweetId, commentId, isReplay } = req.body;
  if (!(videoId || tweetId)) throw new ApiError(StatusCode.BAD_REQUEST, "Video id or tweet id is required");
  if (!content) throw new ApiError(StatusCode.BAD_REQUEST, "Content is required");
  const commentData = {
    content,
    owner: new mongoose.Types.ObjectId(req.user._id),
  };
  if (videoId) commentData.video = new mongoose.Types.ObjectId(videoId);
  if (tweetId) commentData.tweet = new mongoose.Types.ObjectId(tweetId);
  if (isReplay) commentData.parentComment = new mongoose.Types.ObjectId(commentId);
  const newComment = await Comment.create(commentData);
  if (!newComment) throw new ApiError(StatusCode.BAD_REQUEST, "Error creating a comment");
  if (isReplay)
    await Comment.findByIdAndUpdate(commentId, { $push: { replies: newComment._id } }, { new: true }).lean();
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: newComment,
    message: "Comment created successfully",
  });
});

const commentLikeDislike = catchAsync(async (req, res) => {
  const { state, id } = req.body;
  if (!id) throw new ApiError(StatusCode.BAD_REQUEST, "Comment id is required");
  if (!state) throw new ApiError(StatusCode.BAD_REQUEST, "State is required");
  const likeObj = {};
  if (state === "like") {
    likeObj["$addToSet"] = {
      likes: new mongoose.Types.ObjectId(req.user._id),
    };
  } else {
    likeObj["$pull"] = {
      likes: new mongoose.Types.ObjectId(req.user._id),
    };
  }
  const comment = await Comment.findByIdAndUpdate(id, likeObj, { new: true });
  if (!comment) throw new ApiError(StatusCode.NOT_FOUND, "Comment not found");
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: comment,
    message: `${state == "like" ? "Like created" : "Removed like"} successfully`,
  });
});

const updateComment = catchAsync(async (req, res) => {
  const { content } = req.body;
  if (!content) throw new ApiError(StatusCode.BAD_REQUEST, "Content is required");
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
  const comment = await Comment.findById(req.params.id).lean();
  if (!comment) throw new ApiError(StatusCode.NOT_FOUND, "Comment not found");
  await Comment.deleteMany({ _id: { $in: comment.replies } }, { multi: true });
  const deleteComment = await Comment.deleteOne({ _id: req.params.id });
  if (!deleteComment) throw new ApiError(StatusCode.BAD_REQUEST, "Failed to delete comment");
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: null,
    message: "Comment deleted successfully",
  });
});

export const commentController = {
  createComment,
  deleteComment,
  updateComment,
  getAllCommnetsByContentId,
  commentLikeDislike,
};
