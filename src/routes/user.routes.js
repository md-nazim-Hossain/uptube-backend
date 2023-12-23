import { Router } from "express";
import { userController } from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();
router.route("/register").post(
  upload.fields([
    { name: "avatar", maxCount: 1 },
    { name: "coverImage", maxCount: 1 },
  ]),
  userController.registerUser
);
router.route("/login").post(userController.loginUser);

// Protect all routes after this middleware
router.route("/profile").get(verifyJWT, userController.getCurrentUser);
router.route("/channel-profile").get(verifyJWT, userController.getUserChannelProfile);
router.route("/logout").post(verifyJWT, userController.logoutUser);
router.route("/refresh-token").post(userController.refreshAccessToken);
router.route("/reset-password").post(verifyJWT, userController.changeCurrentPassword);
router.route("/update-user-details").post(verifyJWT, userController.updateUserAccountDetails);
router.route("/update-user-avatar").post(verifyJWT, upload.single("avatar"), userController.updateUserAvatar);
router.route("/update-user-cover").post(verifyJWT, upload.single("coverImage"), userController.updateUserCoverImage);
export default router;
