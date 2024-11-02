import mongoose from "mongoose";
import { Comment } from "../models/comment.model.js";
import { sendApiResponse } from "../utils/ApiResponse.js";
import { catchAsync } from "../utils/catchAsync.js";
import StatusCode from "http-status-codes";
import ApiError from "../utils/ApiError.js";
import { Notification } from "../models/notification.model.js";

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

  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: comments,
    message: comments?.length > 0 ? "Comments found successfully" : "Comments not found",
  });
});

const createComment = catchAsync(async (req, res) => {
  const { content, videoId, tweetId, commentId, isReplay, contentOwnerId } = req.body;
  if (!(videoId || tweetId)) throw new ApiError(StatusCode.BAD_REQUEST, "Video id or tweet id is required");
  if (!content) throw new ApiError(StatusCode.BAD_REQUEST, "Content is required");
  if (!contentOwnerId) throw new ApiError(StatusCode.BAD_REQUEST, "Content owner id is required");
  const commentData = {
    content,
    owner: new mongoose.Types.ObjectId(req.user._id),
  };
  if (videoId) commentData.video = new mongoose.Types.ObjectId(videoId);
  if (tweetId) commentData.tweet = new mongoose.Types.ObjectId(tweetId);
  if (isReplay) commentData.parentComment = new mongoose.Types.ObjectId(commentId);
  const newComment = await Comment.create(commentData);
  if (!newComment) throw new ApiError(StatusCode.BAD_REQUEST, "Error creating a comment");
  if (isReplay) {
    await Comment.findByIdAndUpdate(commentId, { $push: { replies: newComment._id } }, { new: true }).lean();
  }
  if (contentOwnerId.toString() !== req.user._id.toString()) {
    await Notification.create({
      sender: new mongoose.Types.ObjectId(req.user._id),
      recipient: new mongoose.Types.ObjectId(contentOwnerId),
      message: `${req.user.name} ${
        isReplay ? "replied to your comment" : `commented on your ${videoId ? "video" : "tweet"}`
      }`,
      type: isReplay ? "reply" : "comment",
      comment: newComment._id,
    });
  }

  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: newComment,
    message: "Comment created successfully",
  });
});

const commentLikeDislike = catchAsync(async (req, res) => {
  const { state, id, contentOwnerId } = req.body;
  if (!id || !contentOwnerId) throw new ApiError(StatusCode.BAD_REQUEST, "Comment id and content owner id is required");
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
  if (contentOwnerId.toString() !== req.user._id.toString()) {
    await Notification.create({
      sender: new mongoose.Types.ObjectId(req.user._id),
      recipient: new mongoose.Types.ObjectId(contentOwnerId),
      message: `${req.user.name} ${state === "like" ? "liked your comment" : "unliked your comment"}`,
      type: state === "like" ? "like" : "unlike",
      comment: comment._id,
    });
  }
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
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const comment = await Comment.findById(req.params.id).lean();
    await Comment.deleteMany({ _id: { $in: comment.replies } }, { multi: true, session });
    await Comment.deleteOne({ _id: req.params.id }, { session });
    await Notification.deleteMany({ comment: new mongoose.Types.ObjectId(req.params.id) }, { session });
    await session.commitTransaction();
    await session.endSession();
    return sendApiResponse({
      res,
      statusCode: StatusCode.OK,
      data: null,
      message: "Comment deleted successfully",
    });
  } catch (error) {
    await session.abortTransaction();
    await session.endSession();
    throw new ApiError(StatusCode.INTERNAL_SERVER_ERROR, "Error deleting comment");
  }
});

export const commentController = {
  createComment,
  deleteComment,
  updateComment,
  getAllCommnetsByContentId,
  commentLikeDislike,
};
