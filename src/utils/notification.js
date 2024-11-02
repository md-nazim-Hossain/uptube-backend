import mongoose from "mongoose";
import { Subscription } from "../models/subscriptions.model.js";
import { Notification } from "../models/notification.model.js";

export const createNotifications = async (userId, videoId, tweetId) => {
  try {
    // Fetch followers of the video owner
    const subscriber = await Subscription.find({ channel: userId });
    const notifications = subscriber.map((follower) => ({
      recipient: new mongoose.Types.ObjectId(follower.subscriber),
      sender: new mongoose.Types.ObjectId(userId),
      videoId,
      tweetId,
      type: tweetId ? "tweet" : "upload",
      message: `New ${tweetId ? "tweet created" : "video uploaded"} by ${userId}`,
      isRead: false,
    }));
    // // Insert notifications for followers
    await Notification.insertMany(notifications);
    console.log("Notifications created for followers");
  } catch (error) {
    console.error("Error creating notifications:", error);
  }
};
