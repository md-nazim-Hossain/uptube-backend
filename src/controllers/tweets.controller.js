import mongoose from "mongoose";
import { Tweet } from "../models/tweets.model.js";
import { sendApiResponse } from "../utils/ApiResponse.js";
import { catchAsync } from "../utils/catchAsync.js";
import StatusCode from "http-status-codes";

const getAllUserTweets = catchAsync(async (req, res) => {
  const tweets = await Tweet.aggregate([
    { $match: { author: new mongoose.Types.ObjectId(req.user._id) } },
    { $lookup: { from: "likes", localField: "_id", foreignField: "tweet", as: "likes" } },
    { $lookup: { from: "comments", localField: "_id", foreignField: "tweet", as: "comments" } },
    {
      $addFields: {
        likes: { $size: "$likes" },
        comments: { $size: "$comments" },
      },
    },
    { $sort: { createdAt: -1 } },
  ]);
  if (!tweets || tweets.length === 0)
    return sendApiResponse({
      res,
      statusCode: StatusCode.OK,
      data: [],
      message: "No tweets found",
    });
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: tweets,
    message: "Tweets found successfully",
  });
});
const createTweet = catchAsync(async (req, res) => {
  const { content } = req.body;
  if (!content) throw new Error("Content is required");
  const tweet = await Tweet.create({ content, author: new mongoose.Types.ObjectId(req.user._id) });
  if (!tweet) throw new Error("Error creating tweet");
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: tweet,
    message: "Tweet created successfully",
  });
});

const updateTweet = catchAsync(async (req, res) => {
  if (!req.body.content) throw new Error("Content is required");
  const tweet = await Tweet.findByIdAndUpdate(req.params.id, { content: req.body.content }, { new: true });
  if (!tweet) throw new Error("Tweet not found");
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: tweet,
    message: "Tweet updated successfully",
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
  getAllUserTweets,
  createTweet,
  deleteTweet,
  updateTweet,
};
