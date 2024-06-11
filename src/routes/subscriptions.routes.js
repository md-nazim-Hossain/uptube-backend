import { Router } from "express";
import { subscriptionsController } from "../controllers/subscriptions.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();
router.get("/get-all-subscriptions", verifyJWT, subscriptionsController.getAllSubscriptions);
export default router;
