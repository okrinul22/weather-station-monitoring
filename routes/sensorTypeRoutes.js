import { Router } from "express";
import { getSensorTypes, getSensorTypeById } from "../controllers/sensorTypeController.js";

const router = Router();

router.get("/", getSensorTypes);
router.get("/:id", getSensorTypeById);

export default router;
