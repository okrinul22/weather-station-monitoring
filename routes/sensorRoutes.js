import { Router } from "express";
import { getsensor, getSensorById, postsensor, patchSensor } from "../controllers/sensorController.js";

const router = Router();

router.get("/", getsensor);
router.get("/:id", getSensorById);
router.patch("/:id", patchSensor);
router.post("/", postsensor);

export default router;
