import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { likeController } from "../controllers/like.controller.js";

const router = Router();

router.route("/like").post(verifyJWT, likeController.createLike);
router.route("/dislike/:id").delete(verifyJWT, likeController.disLike);
