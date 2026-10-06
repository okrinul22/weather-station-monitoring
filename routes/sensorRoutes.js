import { Router } from "express";
import { getsensor, getSensorById, postsensor, patchSensor, deleteSensor } from "../controllers/sensorController.js";

const router = Router();

router.get("/", getsensor);
router.get("/:id", getSensorById);
router.patch("/:id", patchSensor);
router.delete("/:id", deleteSensor);
router.post("/", postsensor);

export default router;
