import { Comment } from "../models/comment.model.js";
import { sendApiResponse } from "../utils/ApiResponse.js";
import { catchAsync } from "../utils/catchAsync.js";

const createComment = catchAsync(async (req, res) => {
  const { content, videoId } = req.body;
  if (!videoId || !content) throw new Error("Video id and content is required");
  const comment = await Comment.create({
    content,
    owner: new mongoose.Types.ObjectId(req.user._id),
    video: new mongoose.Types.ObjectId(videoId),
  });
  if (!comment) throw new Error("Error creating a comment");
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: comment,
    message: "Comment created successfully",
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

export const commentController = { createComment, deleteComment };
