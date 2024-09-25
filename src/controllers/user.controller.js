import ApiError from "../utils/ApiError.js";
import { catchAsync } from "../utils/catchAsync.js";
import StatusCode from "http-status-codes";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { User } from "../models/user.model.js";
import { sendApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import { config } from "../config/index.js";
import mongoose from "mongoose";
import { getUserIdFromToken } from "../utils/jwt.js";
import { sendEmail } from "../utils/send-email.js";
import { paginationHelpers } from "../utils/paginationHelpers.js";
import { Subscription } from "../models/subscriptions.model.js";

const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      StatusCode.INTERNAL_SERVER_ERROR,
      "Something went wrong,when generating access and refresh token"
    );
  }
};

const getChannelProfile = async (req, username, id) => {
  let userId = id || getUserIdFromToken(req);
  if (userId) userId = new mongoose.Types.ObjectId(userId);
  let matcher;
  if (username) {
    const isContainSymbol = username.includes("@");
    matcher = { username: isContainSymbol ? username.toLowerCase() : "@" + username?.toLowerCase() };
  }
  if (id) {
    matcher = { _id: new mongoose.Types.ObjectId(id) };
  }

  return await User.aggregate([
    { $match: matcher },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo",
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "_id",
        foreignField: "owner",
        as: "videos",
        pipeline: [
          {
            $sort: { createdAt: -1 },
          },
        ],
      },
    },
    {
      $addFields: {
        subscribersCount: { $size: "$subscribers" },
        channelSubscribedToCount: { $size: "$subscribedTo" },
        isSubscribed: {
          $cond: {
            if: { $in: [userId, "$subscribers.subscriber"] },
            then: true,
            else: false,
          },
        },
        totalVideos: {
          $filter: {
            input: "$videos",
            as: "video",
            cond: { $eq: ["$$video.type", "video"] },
          },
        },
        totalViews: {
          $sum: "$videos.views",
        },
      },
    },

    {
      $project: {
        fullName: 1,
        username: 1,
        avatar: 1,
        subscribersCount: 1,
        channelSubscribedToCount: 1,
        isSubscribed: 1,
        email: 1,
        coverImage: 1,
        description: 1,
        totalVideos: { $size: "$totalVideos" },
        totalViews: 1,
        createdAt: 1,
        isVerified: 1,
      },
    },
  ]);
};

const registerUser = catchAsync(async (req, res) => {
  const { username, email, password, fullName } = req.body;
  if (!username || !email || !password || !fullName) {
    throw new ApiError(StatusCode.BAD_REQUEST, "All fields are required");
  } else if ([username, email, password, fullName].some((field) => field?.trim() === "")) {
    throw new ApiError(StatusCode.BAD_REQUEST, "All fields are required");
  } else if (!email.includes("@") || !email.includes(".")) {
    throw new ApiError(StatusCode.BAD_REQUEST, "Email is not valid");
  }
  const verifyCode = Math.floor(100000 + Math.random() * 900000);
  const verifyCodeExpiry = Date.now() + 10 * 60 * 1000;
  const addPrefixInUserName = username?.startsWith("@") ? username : "@" + username;
  const userIsExist = await User.findOne({ $or: [{ email }, { username: addPrefixInUserName }] });
  if (userIsExist) {
    throw new ApiError(409, "User already exists with this email or username");
  }
  const avatarLocalPath = req.files?.avatar?.[0]?.path;
  const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

  let avatar;
  if (avatarLocalPath) {
    avatar = await uploadOnCloudinary(avatarLocalPath);
  }
  let coverImage;
  if (coverImageLocalPath) {
    coverImage = await uploadOnCloudinary(coverImageLocalPath);
  }

  const user = await User.create({
    username: addPrefixInUserName?.toLowerCase(),
    email,
    password,
    fullName,
    avatar: avatar?.url || "",
    coverImage: coverImage?.url || "",
    verifyCode,
    verifyCodeExpiry,
  });

  if (!user || !user._id) {
    throw new ApiError(StatusCode.INTERNAL_SERVER_ERROR, "Failed to create user");
  }
  user.password = undefined;
  user.refreshToken = undefined;
  user.watchHistory = undefined;
  user.verifyCodeExpiry = undefined;
  user.verifyCode = undefined;
  const { error } = await sendEmail(
    email,
    "Verify your account",
    `<div>
      <h1>Welcome, ${fullName}</h1>
      <br/> </br>
      <p>You are registered successfully on UPTube.Please verify your account for the going to be a part of UPTube.</p>
      <p>Your verification code is: ${verifyCode}</p>
      <br/<br/>
      <p>Thank you.</p>
    </div>`
  );
  if (error) {
    throw new ApiError(StatusCode.INTERNAL_SERVER_ERROR, "Failed to send email.Please contact us our support team");
  }
  return sendApiResponse({
    data: user,
    res,
    message: "User registered successfully",
    statusCode: StatusCode.CREATED,
  });
});

const verifyUser = catchAsync(async (req, res) => {
  const { email, verifyCode } = req.body;
  if (!email) {
    throw new ApiError(StatusCode.BAD_REQUEST, "Email is required");
  }
  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiError(StatusCode.NOT_FOUND, "User not found");
  }

  if (user.verifyCode !== verifyCode) {
    throw new ApiError(StatusCode.BAD_REQUEST, "Invalid verification code");
  }
  if (user.verifyCodeExpiry < Date.now()) {
    throw new ApiError(StatusCode.BAD_REQUEST, "Verification code expired");
  }

  if (user.isVerified) {
    return sendApiResponse({
      res,
      statusCode: StatusCode.OK,
      message: "User already verified",
    });
  }
  user.isVerified = true;
  user.verifyCode = undefined;
  user.verifyCodeExpiry = undefined;
  await user.save();
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    message: "User verified successfully",
  });
});

const checkUserNameIsUnique = catchAsync(async (req, res) => {
  const { username } = req.params;
  if (!username) {
    throw new ApiError(StatusCode.BAD_REQUEST, "Username is required");
  }
  const addPrefixInUserName = username?.startsWith("@") ? username : "@" + username;
  const user = await User.findOne({ username: addPrefixInUserName.toLowerCase(), isVerified: true });
  if (!user) {
    return sendApiResponse({
      res,
      statusCode: StatusCode.OK,
      message: "username is available",
    });
  }
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    message: "username is not available",
  });
});

const get = catchAsync(async (req, res) => {
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    message: "User found",
  });
});

const loginUser = catchAsync(async (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier) {
    throw new ApiError(StatusCode.BAD_REQUEST, "Username or email is required");
  } else if (!password) {
    throw new ApiError(StatusCode.BAD_REQUEST, "Password are required");
  }
  const isContainSymbol = identifier.startsWith("@");
  const findUser = await User.findOne({
    $or: [{ email: identifier }, { username: isContainSymbol ? identifier : "@" + identifier }],
  });

  if (!findUser) {
    throw new ApiError(StatusCode.NOT_FOUND, "User not found");
  }
  if (!(await findUser.isPasswordCorrect(password))) {
    throw new ApiError(StatusCode.BAD_REQUEST, "Invalid credentials");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(findUser._id);
  findUser.refreshToken = undefined;
  findUser.password = undefined;
  findUser.watchHistory = undefined;
  findUser.lastPasswordChange = undefined;
  const options = {
    httpOnly: true,
    secure: true,
  };
  // res.cookie("accessToken", accessToken, options);
  // res.cookie("refreshToken", refreshToken, options);
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    message: "User logged in successfully",
    data: {
      user: findUser,
      accessToken,
      refreshToken,
    },
  });
});

const logoutUser = catchAsync(async (req, res) => {
  await User.findOneAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: null,
      },
    },
    {
      new: true,
    }
  );
  const options = {
    expires: new Date(0),
  };
  return res.status(StatusCode.OK).clearCookie("accessToken", options).clearCookie("refreshToken", options).json({
    success: true,
    message: "User logged out successfully",
    data: null,
  });
});

const refreshAccessToken = catchAsync(async (req, res) => {
  const incomingRefreshToken =
    req.cookies?.refreshToken || req.headers?.Authorization?.split(" ")[1] || req.body?.refreshToken;
  if (!incomingRefreshToken) {
    throw new ApiError(StatusCode.UNAUTHORIZED, "Unauthorized request");
  }
  const verifyRefreshToken = jwt.verify(incomingRefreshToken, config.jwt.refresh_token_secret);
  if (!verifyRefreshToken || !verifyRefreshToken._id) {
    throw new ApiError(StatusCode.UNAUTHORIZED, "Invalid refresh token");
  }
  const user = await User.findById(verifyRefreshToken._id);
  if (!user) {
    throw new ApiError(StatusCode.UNAUTHORIZED, "Invalid refresh token");
  }

  if (incomingRefreshToken !== user.refreshToken) {
    throw new ApiError(StatusCode.UNAUTHORIZED, "Refresh token is not valid");
  }
  const options = {
    httpOnly: process.env.NODE_ENV === "production",
    secure: true,
    sameSite: "None",
    expires: new Date(new Date().setDate(new Date().getDate() + 3)),
    domail: process.env.NODE_ENV === "production" ? ".vercel.app" : "localhost",
  };
  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id);
  return res
    .status(StatusCode.OK)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json({
      success: true,
      message: "Access token refreshed successfully",
    });
});

const getCurrentUser = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id).select("-password -refreshToken -watchHistory -lastPasswordChange");
  if (!user) {
    throw new ApiError(StatusCode.NOT_FOUND, "User not found");
  }
  return sendApiResponse({
    res,
    data: user,
    message: "User fetched successfully",
    statusCode: StatusCode.OK,
  });
});

const getUserChannelProfile = catchAsync(async (req, res) => {
  const { username } = req.params;
  if (!username?.trim()) {
    throw new ApiError(StatusCode.BAD_REQUEST, "Username is required");
  }
  const channel = await getChannelProfile(req, username, "");
  if (!channel || !channel.length) {
    return sendApiResponse({
      res,
      data: null,
      message: "User channel not found",
      statusCode: StatusCode.OK,
    });
  }
  return sendApiResponse({
    res,
    data: channel[0],
    message: "User channel fetched successfully",
    statusCode: StatusCode.OK,
  });
});

const getAllChannelSubscriber = catchAsync(async (req, res) => {
  const userId = new mongoose.Types.ObjectId(req.user._id);
  const totalSubscribers = await Subscription.countDocuments({ channel: userId });
  const { limit, meta, skip } = paginationHelpers(req, totalSubscribers);
  const channel = await User.aggregate([
    {
      $match: {
        _id: userId,
      },
    },

    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
        pipeline: [
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: "users",
              localField: "subscriber",
              foreignField: "_id",
              as: "subscriber",
              pipeline: [
                {
                  $lookup: {
                    from: "subscriptions",
                    localField: "_id",
                    foreignField: "channel",
                    as: "channelSubscribers",
                  },
                },
                {
                  $addFields: {
                    isSubscribed: {
                      $cond: {
                        if: { $in: [userId, "$channelSubscribers.subscriber"] },
                        then: true,
                        else: false,
                      },
                    },
                  },
                },
                { $project: { password: 0, refreshToken: 0, watchHistory: 0, channelSubscribers: 0 } },
              ],
            },
          },
          { $addFields: { subscriber: { $arrayElemAt: ["$subscriber", 0] } } },
        ],
      },
    },
    { $project: { subscribers: 1 } },
  ]);

  if (!channel || !channel.length || !channel[0]?.subscribers?.length) {
    return sendApiResponse({
      res,
      data: null,
      message: "User channel not found",
      statusCode: StatusCode.OK,
      meta,
    });
  }
  return sendApiResponse({
    res,
    data: channel[0].subscribers,
    message: "User channel fetched successfully",
    statusCode: StatusCode.OK,
    meta,
  });
});

const getUserWatchHistory = catchAsync(async (req, res) => {
  const getUserWatchHistory = await User.findById(req.user._id).select("watchHistory -_id");
  const watchHistoryCount = getUserWatchHistory?.watchHistory?.length;
  const { limit, meta, skip } = paginationHelpers(req, watchHistoryCount);

  if (!watchHistoryCount) {
    return sendApiResponse({
      res,
      data: [],
      message: "User watch history not found",
      statusCode: StatusCode.OK,
      meta,
    });
  }
  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user._id),
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  $project: {
                    fullName: 1,
                    username: 1,
                    avatar: 1,
                    email: 1,
                    isVerified: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              owner: {
                $arrayElemAt: ["$owner", 0],
              },
            },
          },
        ],
      },
    },
  ]);
  if (!user || !user.length) {
    throw new ApiError(StatusCode.NOT_FOUND, "User not found");
  }
  return sendApiResponse({
    res,
    data: user[0].watchHistory,
    message: "User watch history fetched successfully",
    statusCode: StatusCode.OK,
    meta,
  });
});

const getChannelAnalytics = catchAsync(async (req, res) => {
  const _id = new mongoose.Types.ObjectId(req.user._id);
  const analytics = await User.aggregate([
    {
      $match: {
        _id,
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "_id",
        foreignField: "owner",
        as: "videos",
        pipeline: [
          { $match: { owner: _id } },
          {
            $lookup: {
              from: "likes",
              foreignField: "video",
              localField: "_id",
              as: "likes",
            },
          },
          {
            $lookup: {
              from: "comments",
              foreignField: "video",
              localField: "_id",
              as: "comments",
            },
          },
          { $addFields: { likes: { $size: "$likes" }, comments: { $size: "$comments" } } },
          {
            $sort: {
              views: -1,
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
        pipeline: [{ $match: { channel: _id } }],
      },
    },
    {
      $project: {
        subscribers: {
          $size: "$subscribers",
        },
        totalViews: {
          $sum: "$videos.views",
        },
        topVideo: { $arrayElemAt: ["$videos", 0] },
        totalLikes: {
          $size: "$videos.likes",
        },
        totalComments: {
          $size: "$videos.comments",
        },
      },
    },
  ]);
  if (!analytics || !analytics.length) {
    return sendApiResponse({
      res,
      data: null,
      message: "Channel Not found",
      statusCode: StatusCode.NOT_FOUND,
    });
  }
  return sendApiResponse({
    res,
    data: analytics[0],
    message: "Get Channel analytics successfully",
    statusCode: StatusCode.OK,
  });
});

const updateUserWatchHistory = catchAsync(async (req, res) => {
  if (!req.query.id) throw new ApiError(StatusCode.BAD_REQUEST, "Video Id is required");
  const videoId = new mongoose.Types.ObjectId(req.query.id);
  const updateWatchHistory = await User.findByIdAndUpdate(req.user?._id, {
    $addToSet: {
      watchHistory: videoId,
    },
  });
  if (!updateWatchHistory) {
    throw new ApiError(StatusCode.NOT_FOUND, "User not found");
  }

  return sendApiResponse({
    res,
    data: null,
    message: "Added video watch history successfully",
    statusCode: StatusCode.OK,
  });
});

const updateUserAccountDetails = catchAsync(async (req, res) => {
  const { fullName, email, description, country } = req.body;
  if (!(fullName || email || description || country)) {
    throw new ApiError(StatusCode.BAD_REQUEST, "FullName, email or description are required");
  }
  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        fullName,
        email,
        description,
        country,
      },
    },
    {
      new: true,
    }
  ).select("-password -refreshToken -watchHistory -lastPasswordChange");

  if (!user) {
    throw new ApiError(StatusCode.NOT_FOUND, "User not found");
  }
  await redis.setEx(`users-${req.user._id}`, user);
  return sendApiResponse({
    res,
    data: user,
    message: "User updated successfully",
    statusCode: StatusCode.OK,
  });
});

const updateUserAvatar = catchAsync(async (req, res) => {
  const avatarLocalPath = req.file?.path;
  if (!avatarLocalPath) {
    throw new ApiError(StatusCode.BAD_REQUEST, "Profile picture are required");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  if (!avatar?.url) {
    throw new ApiError(StatusCode.BAD_REQUEST, "Failed to upload profile picture");
  }
  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    {
      new: true,
    }
  ).select("-password -refreshToken -watchHistory -lastPasswordChange");
  await redis.setEx(`users-${req.user._id}`, user);

  return sendApiResponse({
    res,
    data: user,
    message: "Profile picture updated successfully",
    statusCode: StatusCode.OK,
  });
});

const updateUserCoverImage = catchAsync(async (req, res) => {
  const coverImageLocalPath = req.file?.path;
  if (!coverImageLocalPath) {
    throw new ApiError(StatusCode.BAD_REQUEST, "Cover image are required");
  }

  const coverImage = await uploadOnCloudinary(coverImageLocalPath);
  if (!coverImage?.url) {
    throw new ApiError(StatusCode.BAD_REQUEST, "Failed to upload profile picture");
  }
  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    {
      new: true,
    }
  ).select("-password -refreshToken -watchHistory -lastPasswordChange");
  await redis.setEx(`users-${req.user._id}`, user);

  return sendApiResponse({
    res,
    data: user,
    message: "Cover image updated successfully",
    statusCode: StatusCode.OK,
  });
});

const resetPassword = catchAsync(async (req, res) => {
  const { password, token } = req.body;
  if (!password) {
    throw new ApiError(StatusCode.BAD_REQUEST, "Password is required");
  }
  if (!token) {
    throw new ApiError(StatusCode.BAD_REQUEST, "Token is required");
  }
  const verifyToken = jwt.verify(token, config.jwt.reset_password_token_secret);
  if (!verifyToken || !verifyToken.email) {
    throw new ApiError(StatusCode.BAD_REQUEST, "Invalid token or expired");
  }

  const user = await User.findOne({ email: verifyToken.email });
  if (!user) {
    throw new ApiError(StatusCode.NOT_FOUND, "User not found");
  }

  if (!user.isVerified) {
    throw new ApiError(StatusCode.BAD_REQUEST, "User is not verified");
  }

  user.password = password;
  user.lastPasswordChange = new Date().toISOString();
  await user.save();

  return sendApiResponse({
    res,
    message: "Password reset successfully",
    statusCode: StatusCode.OK,
  });
});

const forgotPassword = catchAsync(async (req, res) => {
  const { email } = req.body;
  if (!email) {
    throw new ApiError(StatusCode.BAD_REQUEST, "Email is required");
  }

  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiError(StatusCode.NOT_FOUND, "User not found");
  }

  if (!user.isVerified) {
    throw new ApiError(StatusCode.BAD_REQUEST, "User is not verified");
  }

  const token = jwt.sign({ email }, config.jwt.reset_password_token_secret, {
    expiresIn: "10m",
  });
  const resetPasswordLink = `${config.clientUrl}/reset-password?token=${token}`;
  const { error, info } = await sendEmail(
    email,
    "Reset Password",
    `<div>
    Click here to reset your password: <a target="_blank" href="${resetPasswordLink}">Reset Password</a></div>`
  );

  if (error) {
    throw new ApiError(StatusCode.INTERNAL_SERVER_ERROR, "Failed to send email");
  }
  return sendApiResponse({
    res,
    data: info,
    message: "Password reset link sent successfully",
    statusCode: StatusCode.OK,
  });
});

const changeCurrentPassword = catchAsync(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword && !newPassword) {
    throw new ApiError(StatusCode.BAD_REQUEST, "Old and new password is required");
  }

  const user = await User.findById(req.user._id).select("+password");
  if (!user) {
    throw new ApiError(StatusCode.NOT_FOUND, "User not found");
  }

  if (!(await user.isPasswordCorrect(currentPassword))) {
    throw new ApiError(StatusCode.UNAUTHORIZED, "Current password is incorrect");
  }

  user.password = newPassword;
  user.lastPasswordChange = new Date().toISOString();
  await user.save({ validateBeforeSave: false });

  return sendApiResponse({
    res,
    message: "Password updated successfully",
    statusCode: StatusCode.OK,
  });
});

const deleteUserWatchHistory = catchAsync(async (req, res) => {
  const id = new mongoose.Types.ObjectId(req.params.id);
  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $pull: {
        watchHistory: id,
      },
    },
    { new: true }
  );
  if (!user) throw new ApiError(StatusCode.NOT_FOUND, "User not found");
  // const cachedData = ((await redis.get(`history-${req.user._id}`)) ?? [])?.filter((h) => h._id !== req.params.id);
  // await redis.setEx(`history-${req.user._id}`, cachedData);
  return sendApiResponse({
    res,
    data: null,
    message: "Video remove from user watchhistory",
    statusCode: StatusCode.OK,
  });
});

export const userController = {
  registerUser,
  verifyUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateUserAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfile,
  getAllChannelSubscriber,
  getUserWatchHistory,
  checkUserNameIsUnique,
  resetPassword,
  forgotPassword,
  get,
  getChannelAnalytics,
  updateUserWatchHistory,
  deleteUserWatchHistory,
};
