import mongoose from "mongoose";
import { config } from "../config/index.js";
import { DB_NAME } from "../constants.js";

async function connectDB() {
  try {
    const connectionInstance = await mongoose.connect(`${config.db_url}/${DB_NAME}`);
    console.log(`Connected to database !! DB_HOST:${connectionInstance.connection.host}`);
  } catch (error) {
    console.error("MongoDb Connection Failed:", error);
    process.exit(1);
  }
}

export default connectDB;
