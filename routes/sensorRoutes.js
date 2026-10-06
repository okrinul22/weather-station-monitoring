import { Router } from "express";
import { getsensor, getSensorById } from "../controllers/sensorController.js";

const router = Router();

router.get("/", getsensor);
router.get("/:id", getSensorById);

export default router;
