import mongoose from "mongoose";
import { Comment } from "../models/comment.model.js";
import { sendApiResponse } from "../utils/ApiResponse.js";
import { catchAsync } from "../utils/catchAsync.js";
import StatusCode from "http-status-codes";
import ApiError from "../utils/ApiError.js";
import { Like } from "../models/like.model.js";
import { getUserIdFromToken } from "../utils/jwt.js";

const getAllComment = catchAsync(async (req, res) => {
  const id = new mongoose.Types.ObjectId(req.params.id);
  let userId = getUserIdFromToken(req);
  if (userId) userId = new mongoose.Types.ObjectId(userId);
  const comments = await Comment.aggregate([
    {
      $match: {
        $and: [{ parentComment: null }, { video: id }],
      },
    },
    {
      $graphLookup: {
        from: "comments",
        connectToField: "_id",
        connectFromField: "replies",
        startWith: "$replies",
        as: "replies",
        maxDepth: 100,
      },
    },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "comment",
        as: "likes",
      },
    },

    {
      $addFields: {
        likes: { $size: "$likes" },
        isLiked: {
          $cond: { if: { $in: [userId, "$likes.likedBy"] }, then: true, else: false },
        },
      },
    },
  ]);

  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: comments,
    message: "Comments found successfully",
  });
});
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
  if (isReplay) await Comment.findByIdAndUpdate(commentId, { $push: { replies: newComment._id } });
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: newComment,
    message: "Comment created successfully",
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
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    await Comment.deleteMany({ _id: { $in: comment.replies } }, { multi: true, session });
    const deleteComment = await Comment.deleteOne({ _id: req.params.id }, { session });
    if (!deleteComment) throw new ApiError(StatusCode.BAD_REQUEST, "Failed to delete comment");
    const likes = await Like.deleteMany(
      {
        comment: { $in: [...comment.replies, new mongoose.Types.ObjectId(req.params.id)] },
      },
      { session }
    );

    if (!likes) throw new ApiError(StatusCode.BAD_REQUEST, "Failed to delete comment likes");

    await session.commitTransaction();
    await session.endSession();
    return sendApiResponse({
      res,
      statusCode: StatusCode.OK,
      data: comment,
      message: "Comment deleted successfully",
    });
  } catch (error) {
    await session.abortTransaction();
    await session.endSession();
    throw error;
  }
});

export const commentController = {
  getAllComment,
  createComment,
  deleteComment,
  updateComment,
  getAllCommnetsByContentId,
};
