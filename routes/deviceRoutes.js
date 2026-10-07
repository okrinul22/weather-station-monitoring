import { Router } from "express";
import { getDevices, getDeviceById, postDevice, patchDevice, deleteDevice, postRotateDeviceCredentials, getDeviceHealthById } from "../controllers/deviceController.js";

const router = Router();

router.get("/", getDevices);
router.post("/", postDevice);
// Endpoint pengelolaan kredensial; autentikasi/otorisasi admin belum tersedia
// pada router management ini. API key device hanya untuk router ingestion.
router.post("/:id/credentials/rotate", postRotateDeviceCredentials);
router.get("/:id/health", getDeviceHealthById);
router.get("/:id", getDeviceById);
router.patch("/:id", patchDevice);
router.delete("/:id", deleteDevice);

export default router;
