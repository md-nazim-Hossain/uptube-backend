import ApiError from "../utils/ApiError.js";
import { catchAsync } from "../utils/catchAsync.js";
import StatusCode from "http-status-codes";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { User } from "../models/user.model.js";
import { sendApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import { config } from "../config/index.js";
import mongoose from "mongoose";

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

const getChannelProfile = async (username, id) => {
  let matcher;
  if (username && id) {
    const isContainSymbol = username.includes("@");
    matcher = { username: isContainSymbol ? username.toLowerCase() : "@" + username?.toLowerCase() };
  } else if (!username && id) {
    matcher = { _id: new mongoose.Types.ObjectId(id) };
  } else {
    matcher = {};
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
            $group: {
              _id: "$_id",
              totalViews: { $sum: "$views" },
            },
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
            if: { $in: [id, "$subscribers.subscriber"] },
            then: true,
            else: false,
          },
        },
        totalVideos: { $size: "$videos" },
        totalViews: {
          $sum: "$videos.totalViews",
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
        totalVideos: 1,
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

  const userIsExist = await User.findOne({ $or: [{ email }, { username }] });
  if (userIsExist) {
    throw new ApiError(409, "User already exists with this email or username");
  }
  const avatarLocalPath = req.files?.avatar?.[0]?.path;
  const coverImageLocalPath = req.files?.coverImage?.[0]?.path;
  // if (!avatarLocalPath) {
  //   throw new ApiError(StatusCode.BAD_REQUEST, "Avatar is required");
  // }

  let avatar;
  if (avatarLocalPath) {
    avatar = await uploadOnCloudinary(avatarLocalPath);
  }
  let coverImage;
  if (coverImageLocalPath) {
    coverImage = await uploadOnCloudinary(coverImageLocalPath);
  }
  // if (!avatar) {
  //   throw new ApiError(StatusCode.BAD_REQUEST, "Failed to upload images");
  // }
  const user = await User.create({
    username: "@" + username.toLowerCase(),
    email,
    password,
    fullName,
    avatar: avatar?.url || "",
    coverImage: coverImage?.url || "",
  });

  if (!user || !user._id) {
    throw new ApiError(StatusCode.INTERNAL_SERVER_ERROR, "Failed to create user");
  }
  user.password = undefined;
  user.refreshToken = undefined;
  user.watchHistory = undefined;
  user.likeVideos = undefined;

  return sendApiResponse({
    data: user,
    res,
    message: "User registered successfully",
    statusCode: StatusCode.CREATED,
  });
});

const checkUserNameIsUnique = catchAsync(async (req, res) => {
  const { username } = req.params;
  const user = await User.findOne({ username: "@" + username, isVerified: true });
  if (!user) {
    return sendApiResponse({
      res,
      statusCode: StatusCode.OK,
      message: "User not found",
    });
  }
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    message: "User found",
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
  findUser.likeVideos = undefined;
  const options = {
    httpOnly: true,
    secure: true,
  };
  return res
    .status(StatusCode.OK)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json({
      success: true,
      message: "User logged in successfully",
      data: findUser,
    });
});

const logoutUser = catchAsync(async (req, res) => {
  await User.findOneAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    {
      new: true,
    }
  );
  const options = {
    httpOnly: true,
    secure: true,
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
    throw new ApiError(StatusCode.UNAUTHORIZED, "Refresh token is not valid or expired");
  }
  const options = { httpOnly: true, secure: true };
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

const changeCurrentPassword = catchAsync(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id);
  if (!user) {
    throw new ApiError(StatusCode.NOT_FOUND, "User not found");
  }
  if (!(await user.isPasswordCorrect(currentPassword))) {
    throw new ApiError(StatusCode.UNAUTHORIZED, "Current password is incorrect");
  }
  user.password = newPassword;
  await user.save({ validateBeforeSave: false });
  return sendApiResponse({
    res,
    data: null,
    message: "Password changed successfully",
    statusCode: StatusCode.OK,
  });
});

const getCurrentUserProfile = catchAsync(async (req, res) => {
  if (!req?.user) {
    throw new ApiError(StatusCode.UNAUTHORIZED, "Unauthorized request");
  }
  const profile = await getChannelProfile("", req.user._id);
  if (!profile || !profile.length) {
    throw new ApiError(StatusCode.NOT_FOUND, "Profile not found");
  }
  return sendApiResponse({
    res,
    data: profile[0],
    message: "User profile fetched successfully",
    statusCode: StatusCode.OK,
  });
});

const getCurrentUser = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id).select("-password -refreshToken -watchHistory -likeVideos");
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

const updateUserAccountDetails = catchAsync(async (req, res) => {
  const { fullName, email } = req.body;
  if (!(fullName || email)) {
    throw new ApiError(StatusCode.BAD_REQUEST, "Full name and email are required");
  }
  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        fullName,
        email,
      },
    },
    {
      new: true,
    }
  ).select("-password -refreshToken");

  if (!user) {
    throw new ApiError(StatusCode.NOT_FOUND, "User not found");
  }
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
  ).select("-password -refreshToken");
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
  ).select("-password -refreshToken");

  return sendApiResponse({
    res,
    data: user,
    message: "Cover image updated successfully",
    statusCode: StatusCode.OK,
  });
});

const getUserChannelProfile = catchAsync(async (req, res) => {
  const { username } = req.params;
  if (!username?.trim()) {
    throw new ApiError(StatusCode.BAD_REQUEST, "Username is required");
  }
  const channel = await getChannelProfile(username, req?.user?._id ?? "");
  if (!channel || !channel.length) {
    throw new ApiError(StatusCode.NOT_FOUND, "Channel not found");
  }
  return sendApiResponse({
    res,
    data: channel[0],
    message: "User channel fetched successfully",
    statusCode: StatusCode.OK,
  });
});

const getUserWatchHistory = catchAsync(async (req, res) => {
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
  });
});

const getUserLikeVideos = catchAsync(async (req, res) => {
  const id = req.user._id;
  if (!id) throw new ApiError(StatusCode.UNAUTHORIZED, "Unauthorized request");
  const videos = await User.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(id) } },
    {
      $lookup: {
        from: "videos",
        localField: "likeVideos",
        foreignField: "_id",
        as: "likeVideos",
        pipeline: [
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
  if (!videos || !videos.length) throw new ApiError(StatusCode.NOT_FOUND, "Videos not found");
  return sendApiResponse({
    res,
    data: videos[0].likeVideos,
    message: "User likes videos fetched successfully",
    statusCode: StatusCode.OK,
  });
});

export const userController = {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateUserAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfile,
  getUserWatchHistory,
  checkUserNameIsUnique,
  getUserLikeVideos,
  getCurrentUserProfile,
  get,
};
