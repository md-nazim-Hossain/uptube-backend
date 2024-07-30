import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { commentController } from "../controllers/comment.controller.js";

const router = Router();

router.route("/get-all-comment-by-content-id/:id").get(commentController.getAllCommnetsByContentId);
// Protect all routes after this middleware
router.route("/create-comment").post(verifyJWT, commentController.createComment);
router.route("/comment-like-dislike").patch(verifyJWT, commentController.commentLikeDislike);
router.route("/update-comment/:id").put(verifyJWT, commentController.updateComment);
router.route("/delete-comment/:id").delete(verifyJWT, commentController.deleteComment);

export default router;
