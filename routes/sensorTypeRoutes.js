import { Router } from "express";
import { getSensorTypes, getSensorTypeById, postSensorType, patchSensorType, deleteSensorType } from "../controllers/sensorTypeController.js";

const router = Router();

router.get("/", getSensorTypes);
router.post("/", postSensorType);
router.get("/:id", getSensorTypeById);
router.patch("/:id", patchSensorType);
router.delete("/:id", deleteSensorType);

export default router;
