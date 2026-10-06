import { Router } from "express";
import { getDevices, getDeviceById, postDevice, patchDevice } from "../controllers/deviceController.js";

const router = Router();

router.get("/", getDevices);
router.post("/", postDevice);
router.get("/:id", getDeviceById);
router.patch("/:id", patchDevice);

export default router;
