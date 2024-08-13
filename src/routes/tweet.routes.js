import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { tweetsController } from "../controllers/tweets.controller.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

router.route("/get-all-tweets").get(tweetsController.getAllLatestTweets);
router.route("/get-all-user-tweets").get(verifyJWT, tweetsController.getAllUserTweets);
router.route("/create-tweet").post(verifyJWT, upload.single("thumbnail"), tweetsController.createTweet);
router.route("/update-tweet/:id").patch(verifyJWT, upload.single("thumbnail"), tweetsController.updateTweet);
router.route("/delete-tweet/:id").delete(verifyJWT, tweetsController.deleteTweet);

export default router;
