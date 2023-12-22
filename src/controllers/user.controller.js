import ApiError from "../utils/ApiError.js";
import { catchAsync } from "../utils/catchAsync.js";
import StatusCode from "http-status-codes";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { User } from "../models/user.model.js";
import { sendApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import { config } from "../config/index.js";

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

  if (!avatarLocalPath) {
    throw new ApiError(StatusCode.BAD_REQUEST, "Avatar is required");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  let coverImage;
  if (coverImageLocalPath) {
    coverImage = await uploadOnCloudinary(coverImageLocalPath);
  }
  if (!avatar) {
    throw new ApiError(StatusCode.BAD_REQUEST, "Failed to upload images");
  }
  const user = await User.create({
    username: username.toLowerCase(),
    email,
    password,
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
  });

  if (!user || !user._id) {
    throw new ApiError(StatusCode.INTERNAL_SERVER_ERROR, "Failed to create user");
  }
  user.password = undefined;
  user.refreshToken = undefined;

  return sendApiResponse({
    data: user,
    res,
    message: "User registered successfully",
    statusCode: StatusCode.CREATED,
  });
});

const loginUser = catchAsync(async (req, res) => {
  const { email, password, username } = req.body;
  if (!(username || email)) {
    throw new ApiError(StatusCode.BAD_REQUEST, "Username or email is required");
  } else if (!password) {
    throw new ApiError(StatusCode.BAD_REQUEST, "Password are required");
  }

  const findUser = await User.findOne({ $or: [{ email }, { username }] });

  if (!findUser) {
    throw new ApiError(StatusCode.NOT_FOUND, "User not found");
  }
  if (!(await findUser.isPasswordCorrect(password))) {
    throw new ApiError(StatusCode.UNAUTHORIZED, "Invalid credentials");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(findUser._id);
  findUser.refreshToken = undefined;
  findUser.password = undefined;
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

const getCurrentUser = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id).select("-password -refreshToken");
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
  if (!fullName || !email) {
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
};
