import { redisClient } from "../db/redisClient.js";

const catchAsync = (fn) => async (req, res, next) => {
  try {
    if (!redisClient.isOpen) await redisClient.connect();
    return await fn(req, res, next);
  } catch (error) {
    next(error);
  }
};

export { catchAsync };
