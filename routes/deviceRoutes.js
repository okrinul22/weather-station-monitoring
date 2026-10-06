import { Router } from "express";
import { getDevices, getDeviceById, postDevice } from "../controllers/deviceController.js";

const router = Router();

router.get("/", getDevices);
router.post("/", postDevice);
router.get("/:id", getDeviceById);

export default router;
