import { Notification } from "../models/notification.model.js";
import { paginationHelpers } from "../utils/paginationHelpers.js";
import { sendApiResponse } from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import StatusCode from "http-status-codes";

const getAllUserNotifications = async (req, res) => {
  const totalContent = await Notification.countDocuments({ isPublished: true, type });
  const { limit, meta, skip, sortBy, sortOrder } = paginationHelpers(req, totalContent);
  const notifications = await Notification.find({ recipient: req.user._id })
    .populate([
      { path: "sender", select: "fullName avatar" },
      { path: "videoId", select: "title thumbnail" },
      { path: "tweetId", select: "content thumbnail" },
    ])
    .sort({ [sortBy]: sortOrder })
    .skip(skip)
    .limit(limit)
    .lean();

  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: notifications || [],
    message: notifications?.length > 0 ? "Notifications found successfully" : "Notifications not found",
    meta,
  });
};

export const hideNotification = async (req, res) => {
  const { id } = req.params;
  const notification = await Notification.findById(id);
  if (!notification) throw new ApiError("Notification not found");
  if (notification.isHide) {
    return sendApiResponse({
      res,
      statusCode: StatusCode.OK,
      data: notification,
      message: "Notification already hidden",
    });
  }

  notification.isHide = true;
  await notification.save();
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: notification,
    message: "Notification hidden successfully",
  });
};

const deleteNotification = async (req, res) => {
  const { id } = req.params;
  const notification = await Notification.findByIdAndDelete(id);
  if (!notification) throw new ApiError("Notification not found");
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: notification,
    message: "Notification deleted successfully",
  });
};

export const notificationController = { getAllUserNotifications, hideNotification, deleteNotification };
