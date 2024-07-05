import { Router } from "express";
import { subscriptionsController } from "../controllers/subscriptions.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();
router.route("/get-all-followers").get(verifyJWT, subscriptionsController.getAllFollowers);
router
  .route("/create-subscribe-and-unsubscribe")
  .post(verifyJWT, subscriptionsController.createSubscribeAndUnsubscribe);
export default router;
