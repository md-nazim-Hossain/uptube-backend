import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware";
import { adsController } from "../controllers/ads.controller";

const router = Router();

router.route("/get-all-my-ads").get(verifyJWT, adsController.getAllMyAds);
router.route("/create-ads").post(verifyJWT, adsController.createAd);
router.route("/update-ads/:id").put(verifyJWT, adsController.updateAd);
router.route("/delete-ads/:id").delete(verifyJWT, adsController.deleteAd);

export default router;
