import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { playlistController } from "../controllers/playlist.controller.js";

const router = Router();

router.route("/create-playlist").post(verifyJWT, playlistController.createPlaylist);
router.route("/playlist/:id").delete(verifyJWT, playlistController.deletePlaylist);
