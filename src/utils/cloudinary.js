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

const deleteOnCloudinary = async (url, resource_type = "video") => {
  try {
    if (!url) throw new Error("url is required");
    const publicId = getPublicIdFromUrl(url);
    if (!publicId || typeof publicId !== "string") {
      throw new Error("Invalid publicId: must be a non-empty string");
    }

    const response = await cloudinary.uploader.destroy(publicId, {
      invalidate: true,
      resource_type,
    });

    if (response.result !== "ok") {
      throw new Error(`Cloudinary deletion failed: ${response.result}`);
    }

    return { ...response, success: true };
  } catch (error) {
    logger.error(`Failed to delete Cloudinary asset ${publicId}:`, error.message);
    return {
      suceess: false,
      error: error.message || "Failed to delete Cloudinary asset",
    };
  }
};

const getPublicIdFromUrl = (url) => {
  return url
    .split("/upload/")[1]
    .split(".")[0]
    ?.replace(/^v\d+\//, "");
};

export { uploadOnCloudinary, deleteOnCloudinary };
