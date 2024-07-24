import { Router } from "express";
import { videoController } from "../controllers/video.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";
// import { cache } from "../middlewares/cache.middleware.js";

const router = Router();
router.route("/get-all-content-by-type").get(videoController.getAllContentsByType);
router.route("/get-all-shorts").get(videoController.getAllShorts);
router.route("/get-video/:id").get(videoController.getVideoById);
router.route("/get-video-by-user-id/:id").get(videoController.getVideoByUserId);
router.route("/get-all-search-content").get(videoController.getAllSearchContent);
router.route("/update-view-count/:id").get(videoController.updateViewCount);

// Protect all routes after this middleware
router.route("/get-all-user-content-by-type").get(verifyJWT, videoController.getAllUserContentByType);
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
