import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { likeController } from "../controllers/like.controller.js";

const router = Router();

router.route("/get-user-like-videos").get(verifyJWT, likeController.getUserLikeVideos);
router.route("/like-dislike").post(verifyJWT, likeController.likeDislike);

export default router;
