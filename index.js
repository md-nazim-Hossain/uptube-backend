import dotenv from "dotenv";
import connectDB from "./src/db/db.js";
import { app } from "./src/app.js";
import { config } from "./src/config/index.js";
import logger from "./src/utils/logger.js";

dotenv.config({ path: "./.env" });

connectDB()
  .then(() => {
    app.listen(config.port, () => {
      logger.info(`Server running on port ${config.port}`);
    });
  })
  .catch((error) => logger.error("MongoDb Connection Failed:", error));
