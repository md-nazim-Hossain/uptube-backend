import { config } from "../config/index.js";
import { User } from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import StatusCode from "http-status-codes";

export const verifyJWT = async (req, _, next) => {
  try {
    const token = req.cookies?.accessToken || req.headers?.Authorization?.split(" ")[1];
    if (!token) {
      throw new ApiError(StatusCode.UNAUTHORIZED, "Unauthorized request");
    }
    const payload = await jwt.verify(token, config.jwt.access_token_secret);
    const user = await User.findById(payload._id).select("-password -refreshToken");
    if (!user) {
      throw new ApiError(StatusCode.UNAUTHORIZED, "Unauthorized request");
    }
    req.user = user;
    next();
  } catch (error) {
    throw new ApiError(StatusCode.UNAUTHORIZED, "Invalid token");
  }
};
