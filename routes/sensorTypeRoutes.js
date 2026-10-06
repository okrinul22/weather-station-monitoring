import { Router } from "express";
import { getSensorTypes, getSensorTypeById, postSensorType } from "../controllers/sensorTypeController.js";

const router = Router();

router.get("/", getSensorTypes);
router.post("/", postSensorType);
router.get("/:id", getSensorTypeById);

export default router;
