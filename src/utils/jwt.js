import jwt from "jsonwebtoken";
import { config } from "../config/index.js";

export const getUserIdFromToken = (req) => {
  if (!(req.cookies.accessToken || req.headers?.Authorization || req.headers.authorization)) return null;
  const token =
    req.cookies?.accessToken || req.headers?.Authorization?.split(" ")[1] || req.headers.authorization.split(" ")[1];
  if (!token) {
    return null;
  }
  const payload = jwt.verify(token, config.jwt.access_token_secret);
  if (!payload || !payload._id) {
    return null;
  }
  return payload._id;
};
