import mongoose from "mongoose";
import { Tweet } from "../models/tweets.model.js";
import { sendApiResponse } from "../utils/ApiResponse.js";
import { catchAsync } from "../utils/catchAsync.js";
import StatusCode from "http-status-codes";

const createTweet = catchAsync(async (req, res) => {
  const { content } = req.body;
  if (!content) throw new Error("Content is required");
  const tweet = await Tweet.create({ content, owner: new mongoose.Types.ObjectId(req.user._id) });
  if (!tweet) throw new Error("Error creating tweet");
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: tweet,
    message: "Tweet created successfully",
  });
});

const deleteTweet = catchAsync(async (req, res) => {
  const tweet = await Tweet.findByIdAndDelete(req.params.id);
  if (!tweet) throw new Error("Tweet not found");
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: tweet,
    message: "Tweet deleted successfully",
  });
});

export const tweetsController = {
  createTweet,
  deleteTweet,
};
