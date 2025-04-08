import fs from "fs";
import { v2 as cloudinary } from "cloudinary";
import { config } from "../config/index.js";
import logger from "./logger.js";

cloudinary.config({
  cloud_name: config.cloudinary.cloud_name,
  api_key: config.cloudinary.api_key,
  api_secret: config.cloudinary.api_secret,
});

const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) throw new Error("localFilePath is required");
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
      folder: "uptube",
    });
    fs.unlinkSync(localFilePath);
    return response;
  } catch (error) {
    logger.error("Error uploading file to cloudinary", error);
    fs.unlinkSync(localFilePath);
    return null;
  }
};

export { uploadOnCloudinary };
