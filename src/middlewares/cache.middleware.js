import { redisClient } from "../db/redisClient.js";
import { sendApiResponse } from "../utils/ApiResponse.js";

export const cache = async (req, res, next) => {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
    const key = req.originalUrl;
    const data = await redisClient.get(key);
    if (data !== null) {
      return sendApiResponse({
        res,
        statusCode: 200,
        data: JSON.parse(data),
        message: "Data found in cache",
      });
    } else {
      next();
    }
  } catch (error) {
    throw new Error("Error caching data");
  }
};
