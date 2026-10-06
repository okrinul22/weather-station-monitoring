import { Router } from "express";
import { getsensor } from "../controllers/sensorController.js";

const router = Router();

router.get("/", getsensor);

export default router;
