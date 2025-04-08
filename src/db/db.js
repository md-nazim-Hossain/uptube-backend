import mongoose from "mongoose";
import { config } from "../config/index.js";
import logger from "../utils/logger.js";

async function connectDB() {
  try {
    const connectionInstance = await mongoose.connect(`${config.db_url}/${config.constants.db_name}`);
    logger.info(`Connected to database !! DB_HOST:${connectionInstance.connection.host}`);
  } catch (error) {
    logger.error("MongoDb Connection Failed:", error);
    process.exit(1);
  }
}

export default connectDB;
