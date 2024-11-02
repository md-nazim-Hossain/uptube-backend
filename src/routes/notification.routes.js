import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { notificationController } from "../controllers/notification.controller.js";

const router = Router();

router.route("/get-all-notification").get(verifyJWT, notificationController.getAllUserNotifications);
router.route("/hide-notification/:id").put(verifyJWT, notificationController.hideNotification);
router.route("/delete-notification/:id").delete(verifyJWT, notificationController.deleteNotification);
export default router;
