import mongoose from "mongoose";
import { Subscription } from "../models/subscriptions.model.js";
import { sendApiResponse } from "../utils/ApiResponse.js";
import { catchAsync } from "../utils/catchAsync.js";
import StatusCode from "http-status-codes";

const getAllSubscribedChannel = catchAsync(async (req, res) => {
  const subscriptions = await Subscription.find({ subscriber: req.user._id }).populate(
    "channel",
    "-password -refreshToken -watchHistory"
  );
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: subscriptions,
    message: "Subscriptions found successfully",
  });
});

const createSubscribeAndUnsubscribe = catchAsync(async (req, res) => {
  const { channelId, state } = req.body;
  if (!channelId || !state) throw new Error("Channel id and state is required");
  const channel = new mongoose.Types.ObjectId(channelId);
  const subscriber = new mongoose.Types.ObjectId(req.user._id);
  const subscription = await (state === "subscribe"
    ? Subscription.create({
        channel,
        subscriber,
      })
    : Subscription.findOneAndDelete({
        channel,
        subscriber,
      }));
  if (!subscription) throw new Error(`Error ${state == "subscribe" ? "creating" : "delete"} subscription`);
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: subscription,
    message: `Subscription ${state == "subscribe" ? "created" : "deleted"} successfully`,
  });
});

export const subscriptionsController = {
  getAllSubscribedChannel,
  createSubscribeAndUnsubscribe,
};
