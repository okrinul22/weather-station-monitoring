import { Router } from "express";
import deviceAuth from "../middlewares/deviceAuth.js";
import { ingestRateLimit } from "../middlewares/ingestRateLimit.js";
import { postTelemetry, postTelemetryBatch, postHeartbeat } from "../controllers/ingestController.js";

const router = Router();
// IP dibatasi sebelum query autentikasi; device dibatasi setelah key terverifikasi.
// Limit request, bukan row. Batas 500 record/batch membatasi pekerjaan setiap request.
router.use(ingestRateLimit((req) => `ip:${req.ip}`, 120));
router.use(deviceAuth);
router.use(ingestRateLimit((req) => `device:${req.device.id}`, 60));
router.post("/telemetry", postTelemetry);
router.post("/telemetry/batch", postTelemetryBatch);
router.post("/heartbeat", postHeartbeat);

export default router;
