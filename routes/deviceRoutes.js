import { Router } from "express";
import { getDevices, getDeviceById } from "../controllers/deviceController.js";

const router = Router();

router.get("/", getDevices);
router.get("/:id", getDeviceById);

export default router;
