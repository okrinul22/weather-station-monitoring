import { Router } from "express";
import { getSensorTypes } from "../controllers/sensorTypeController.js";

const router = Router();

router.get("/", getSensorTypes);

export default router;
