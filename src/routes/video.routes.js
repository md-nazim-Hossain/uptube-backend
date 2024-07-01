import { Router } from "express";
import { videoController } from "../controllers/video.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();
router.route("/get-all-videos").get(videoController.getAllVideos);
router.route("/get-video/:id").get(videoController.getVideoById);

// Protect all routes after this middleware
router.route("/get-all-videos-by-user").get(verifyJWT, videoController.getAllVideosByCurrentUser);
router.route("/upload-video").post(
  verifyJWT,
  upload.fields([
    {
      name: "videoFiles",
      maxCount: 1,
    },
    {
      name: "thumbnail",
      maxCount: 1,
    },
  ]),
  videoController.uploadVideo
);
router.route("/make-copy/:id").post(verifyJWT, videoController.makeACopy);

router.route("/update-video/:id").put(
  verifyJWT,
  upload.fields([
    {
      name: "thumbnail",
      maxCount: 1,
    },
  ]),
  videoController.updateVideo
);
router.route("/delete-video/:id").delete(verifyJWT, videoController.deleteVideo);

export default router;
