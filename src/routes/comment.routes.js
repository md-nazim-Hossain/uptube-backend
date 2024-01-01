import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { commentController } from "../controllers/comment.controller.js";

const router = Router();

router.route("/comment").post(verifyJWT, commentController.createComment);
router.route("/comment/:id").delete(verifyJWT, commentController.deleteComment);
