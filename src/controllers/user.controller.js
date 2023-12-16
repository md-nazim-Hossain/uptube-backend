import ApiError from "../utils/ApiError.js";
import { catchAsync } from "../utils/catchAsync.js";
import StatusCode from "http-status-codes";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { User } from "../models/user.model.js";
import { sendApiResponse } from "../utils/ApiResponse.js";

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
  // get user details from frontend
  // validation
  // check if user exists: email, username
  // check for images,check for avatar
  // upload images to cloudinary
  // create user object
  // save user to database
  // remove password and refreshToken from user object response;
  // check for user creation
  // send response

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
  // get user email and password data from frontend
  // validation is email and password
  // check if user exists
  // check for password
  // create access token and refresh token
  // send cookies
  // send response
  const { email, password, username } = req.body;
  if (!username || !email) {
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
  // get access token
  // check if token is valid
  // delete access token
  // send response
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
  });
});

export const userController = {
  registerUser,
  loginUser,
  logoutUser,
};
