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
import videosRoutes from "./routes/video.routes.js";
import tweetsRoutes from "./routes/tweet.routes.js";
import likesRoutes from "./routes/like.routes.js";
import commentsRoutes from "./routes/like.routes.js";
import playlistsRoutes from "./routes/playlist.routes.js";
import errorHandler from "./middlewares/error.middleware.js";

// routes declaration

app.use("/api/v1/users", userRoutes);
app.use("/api/v1/videos", videosRoutes);
app.use("/api/v1/tweets", tweetsRoutes);
app.use("/api/v1/likes", likesRoutes);
app.use("/api/v1/comments", commentsRoutes);
app.use("/api/v1/playlists", playlistsRoutes);
app.use(errorHandler);

export { app };
