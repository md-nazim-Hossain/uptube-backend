import { config } from "../config/index.js";
import { User } from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import StatusCode from "http-status-codes";
import jwt from "jsonwebtoken";
import { sendApiResponse } from "../utils/ApiResponse.js";

export const verifyJWT = async (req, res, next) => {
  console.log("---cookies", req.cookies, "headers----", req.headers);

  try {
    const token =
      req.cookies?.accessToken || req.headers?.Authorization?.split(" ")[1] || req.headers.authorization.split(" ")[1];
    if (!token) {
      throw new ApiError(StatusCode.UNAUTHORIZED, "Unauthorized request");
    }

    const payload = jwt.verify(token, config.jwt.access_token_secret);
    if (!payload || !payload._id) {
      throw new ApiError(StatusCode.UNAUTHORIZED, "Invalid token");
    }

    const user = await User.findById(payload._id).select("-password -refreshToken");
    if (!user) {
      throw new ApiError(StatusCode.UNAUTHORIZED, "Unauthorized request");
    }
    req.user = user;
    next();
  } catch (error) {
    return sendApiResponse({
      res,
      data: null,
      message: "Invalid token or Unauthorized request",
      statusCode: StatusCode.UNAUTHORIZED,
    });
  }
};
