import dotenv from "dotenv";
import connectDB from "./src/db/db.js";
import { app } from "./src/app.js";
import { config } from "./src/config/index.js";

dotenv.config({ path: "./.env" });

connectDB()
  .then(() => {
    app.listen(config.port, () => {
      console.log(`Server running on port ${config.port}`);
    });
  })
  .catch((error) => console.log("MongoDb Connection Failed:", error));
