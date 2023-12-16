import mongoose from "mongoose";
import { config } from "../config/index.js";

async function connectDB() {
  try {
    const connectionInstance = await mongoose.connect(`${config.db_url}/${config.constants.db_name}`);
    console.log(`Connected to database !! DB_HOST:${connectionInstance.connection.host}`);
  } catch (error) {
    console.error("MongoDb Connection Failed:", error);
    process.exit(1);
  }
}

export default connectDB;
