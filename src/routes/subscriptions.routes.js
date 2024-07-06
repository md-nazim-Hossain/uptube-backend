import { Router } from "express";
import { subscriptionsController } from "../controllers/subscriptions.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();
router.route("/get-all-subscribed-channel").get(verifyJWT, subscriptionsController.getAllSubscribedChannel);
router
  .route("/create-subscribe-and-unsubscribe")
  .post(verifyJWT, subscriptionsController.createSubscribeAndUnsubscribe);
export default router;
