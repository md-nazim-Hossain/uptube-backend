import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { commentController } from "../controllers/comment.controller.js";

const router = Router();

router.route("/get-all-comment-by-id/:id").get(commentController.getAllCommnetsByContentId);
router.route("/get-all-comment/:id").get(commentController.getAllComment);
// Protect all routes after this middleware
router.route("/create-comment").post(verifyJWT, commentController.createComment);
router.route("/update-comment/:id").put(verifyJWT, commentController.updateComment);
router.route("/delete-comment/:id").delete(verifyJWT, commentController.deleteComment);

export default router;
