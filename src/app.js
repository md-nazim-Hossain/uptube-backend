import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { config } from "./config/index.js";
const app = express();

// =========== app configurations ============== //
app.use(express.static("public"));
app.use(express.json({ limit: config.constants.limit }));
app.use(express.urlencoded({ extended: true, limit: config.constants.limit }));
app.use(cors({ origin: config.cors_origin, credentials: true }));
app.use(cookieParser());

//routes import ;
import userRoutes from "./routes/user.routes.js";

// routes declaration
app.use("/api/v1/users", userRoutes);
export { app };
