import { Router } from "express";
import { getsensor, getSensorById, postsensor } from "../controllers/sensorController.js";

const router = Router();

router.get("/", getsensor);
router.get("/:id", getSensorById);
router.post("/", postsensor);

export default router;
