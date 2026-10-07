import { createHash, timingSafeEqual } from "node:crypto";
import prisma from "../utils/prisma.js";
import sendResponse from "../utils/response.js";

/* Cara menggunakan API key dari registrasi atau rotasi:
 * 1. Simpan data.apiKey di konfigurasi rahasia firmware, jangan di log/repo.
 * 2. Kirim key asli lewat header X-API-Key pada telemetry, batch, dan heartbeat.
 *    Body device_id berisi deviceCode (mis. WS-GRT-001), bukan UUID device.
 *    Contoh development (ganti KEY_ASLI dengan data.apiKey):
 *    curl -X POST http://localhost:3000/api/v1/ingest/heartbeat \
 *      -H 'Content-Type: application/json' -H 'X-API-Key: KEY_ASLI' \
 *      -d '{"device_id":"WS-GRT-001","ts":1791320400,"fw":"1.4.2","battery_v":3.9,"rssi":-70,"uptime_s":60}'
 *    Isi ts dengan epoch detik saat pengiriman; gunakan HTTPS di deployment.
 * 3. Backend menghitung SHA-256(key asli), lalu membandingkan hash secara
 *    timing-safe dengan api_key_hash milik device tersebut, bukan plaintext.
 * 4. Setelah rotasi, firmware harus memakai key baru; key lama mendapat 401.
 *    Device DECOMMISSIONED tetap ditolak 403 walaupun key-nya benar.
 */

export default async function deviceAuth(req, res, next) {
    const apiKey = req.get("X-API-Key");
    if (!apiKey || apiKey.length > 256) {
        return sendResponse(res, { status: 401, code: "UNAUTHORIZED", error: "Header X-API-Key wajib diisi dengan key yang valid." });
    }
    if (typeof req.body?.device_id !== "string" || !req.body.device_id || req.body.device_id.length > 50) {
        return sendResponse(res, {
            status: 422, code: "VALIDATION_ERROR",
            error: { message: "Identitas device tidak valid.", details: [{ field: "device_id", message: "device_id harus berupa kode device, misalnya WS-GRT-001." }] },
        });
    }

    try {
        // device_id firmware adalah deviceCode, bukan primary key UUID.
        const device = await prisma.device.findFirst({
            where: { deviceCode: req.body.device_id, deletedAt: null },
            select: { id: true, deviceCode: true, apiKeyHash: true, status: true },
        });
        if (!device) {
            return sendResponse(res, { status: 404, code: "DEVICE_NOT_FOUND", error: "Device tidak terdaftar atau sudah di-soft-delete." });
        }
        const receivedHash = createHash("sha256").update(apiKey).digest();
        const savedHash = Buffer.from(device.apiKeyHash, "hex");
        // Bandingkan hash secara timing-safe; key asli tidak disimpan atau di-log.
        if (savedHash.length !== receivedHash.length || !timingSafeEqual(savedHash, receivedHash)) {
            return sendResponse(res, { status: 401, code: "UNAUTHORIZED", error: "API key tidak cocok dengan device_id." });
        }
        if (device.status === "DECOMMISSIONED") {
            return sendResponse(res, { status: 403, code: "DEVICE_DECOMMISSIONED", error: "Device decommissioned tidak boleh mengirim data." });
        }
        req.device = { id: device.id, deviceCode: device.deviceCode };
        next();
    } catch (error) {
        next(error);
    }
}
