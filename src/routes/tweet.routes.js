import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { tweetsController } from "../controllers/tweets.controller.js";

const router = Router();

router.route("/create-tweet").post(verifyJWT, tweetsController.createTweet);
router.route("/update-tweet/:id").put(verifyJWT, tweetsController.updateTweet);
router.route("/delete-tweet/:id").delete(verifyJWT, tweetsController.deleteTweet);

export default router;
