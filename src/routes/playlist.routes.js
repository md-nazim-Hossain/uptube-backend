import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { playlistController } from "../controllers/playlist.controller.js";

const router = Router();

router.route("/get-all-playlists").get(verifyJWT, playlistController.getAllPlaylists);
router.route("/playlist/:id").get(verifyJWT, playlistController.getPlayListById);
router.route("/create-playlist").post(verifyJWT, playlistController.createPlaylist);
router.route("/playlist/:id").put(verifyJWT, playlistController.updatePlaylist);
router.route("/playlist/:id").delete(verifyJWT, playlistController.deletePlaylist);

export default router;
