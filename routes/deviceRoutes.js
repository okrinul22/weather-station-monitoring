import { Router } from "express";
import { getDevices, getDeviceById, postDevice, patchDevice, deleteDevice } from "../controllers/deviceController.js";

const router = Router();

router.get("/", getDevices);
router.post("/", postDevice);
router.get("/:id", getDeviceById);
router.patch("/:id", patchDevice);
router.delete("/:id", deleteDevice);

export default router;
