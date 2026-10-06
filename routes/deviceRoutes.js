import { Router } from "express";
import { getDevices } from "../controllers/deviceController.js";

const router = Router();

router.get("/", getDevices);

export default router;
