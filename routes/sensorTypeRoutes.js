import { Router } from "express";
import { getSensorTypes, getSensorTypeById, postSensorType, patchSensorType } from "../controllers/sensorTypeController.js";

const router = Router();

router.get("/", getSensorTypes);
router.post("/", postSensorType);
router.get("/:id", getSensorTypeById);
router.patch("/:id", patchSensorType);

export default router;
