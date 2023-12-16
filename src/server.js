import dotenv from "dotenv";
import connectDB from "./db/db.js";
import { app } from "./app.js";
import { config } from "./config/index.js";

dotenv.config({ path: "./.env" });

connectDB()
  .then(() => {
    app.listen(config.port, () => {
      console.log(`Server running on port ${config.port}`);
    });
  })
  .catch((error) => console.log("MongoDb Connection Failed:", error));
