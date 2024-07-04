import { Router } from "express";
import { subscriptionsController } from "../controllers/subscriptions.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();
router.route("/get-all-subscriptions").get(verifyJWT, subscriptionsController.getAllSubscriptions);
export default router;
