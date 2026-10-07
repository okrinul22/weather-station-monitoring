import { telemetrySchema, telemetryBatchSchema, telemetryRecordSchema, heartbeatSchema } from "../validators/ingestValidator.js";
import { ingestTelemetry, ingestHeartbeat } from "../services/ingestService.js";
import sendResponse from "../utils/response.js";

function validationError(res, issues) {
    return sendResponse(res, {
        status: 422, code: "VALIDATION_ERROR",
        error: {
            message: "Payload ingestion tidak valid.",
            details: issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })),
        },
    });
}

function handleError(error, res, next) {
    if (error.status) {
        return sendResponse(res, {
            status: error.status, code: error.code,
            error: { message: error.message, ...(error.field ? { details: [{ field: error.field, message: error.message }] } : {}) },
        });
    }
    if (error.code === "P2034") {
        return sendResponse(res, { status: 409, code: "INGEST_CONFLICT", error: "Konflik transaksi. Ulangi payload; data tersimpan tidak akan dobel." });
    }
    return next(error);
}

export async function postTelemetry(req, res, next) {
    const parsed = telemetrySchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed.error.issues);
    const { device_id, fw, ...record } = parsed.data;
    try {
        const [result] = await ingestTelemetry(req.device.id, fw, [{ index: 0, record }], res.locals.receivedAt);
        if (result.status === "rejected") {
            return sendResponse(res, { status: 422, code: result.code, error: { message: result.error, details: [{ field: result.field, message: result.error }] } });
        }
        return sendResponse(res, {
            status: result.accepted_readings ? 201 : 200,
            code: result.status === "duplicate" ? "TELEMETRY_DUPLICATE" : "TELEMETRY_ACCEPTED",
            data: { device_id, ...result },
        });
    } catch (error) {
        return handleError(error, res, next);
    }
}

export async function postTelemetryBatch(req, res, next) {
    const parsed = telemetryBatchSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed.error.issues);
    const { device_id, fw, batch } = parsed.data;
    const entries = [];
    const rejected = [];
    // Loop biasa dipilih agar alur partial success bisa diikuti tanpa Promise.all
    // yang mengirim ratusan query bersamaan dan memenuhi connection pool.
    batch.forEach((record, index) => {
        const item = telemetryRecordSchema.safeParse(record);
        if (item.success) entries.push({ index, record: item.data });
        else rejected.push({ index, status: "rejected", code: "VALIDATION_ERROR", error: "Record batch tidak valid.", details: item.error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })) });
    });
    try {
        const saved = await ingestTelemetry(req.device.id, fw, entries, res.locals.receivedAt);
        const results = [...saved, ...rejected].sort((a, b) => a.index - b.index);
        const accepted = results.filter((item) => item.status === "accepted").length;
        const duplicates = results.filter((item) => item.status === "duplicate").length;
        const rejectedCount = results.filter((item) => item.status === "rejected").length;
        const duplicateReadings = saved.reduce((sum, item) => sum + (item.duplicate_readings ?? 0), 0);
        const mixed = rejectedCount > 0 || (accepted > 0 && duplicateReadings > 0);
        // Count accepted/duplicates/rejected = JUMLAH PAYLOAD, bukan jumlah sensor.
        // All-duplicate adalah sukses idempotent; campuran memakai 207 sesuai PDF.
        const status = rejectedCount === batch.length ? 422 : mixed ? 207 : accepted ? 201 : 200;
        return sendResponse(res, {
            status,
            code: status === 422 ? "BATCH_REJECTED" : status === 207 ? "BATCH_PARTIAL_SUCCESS" : "BATCH_ACCEPTED",
            data: {
                device_id, accepted, duplicates, rejected: rejectedCount,
                accepted_readings: saved.reduce((sum, item) => sum + (item.accepted_readings ?? 0), 0),
                duplicate_readings: duplicateReadings,
                results,
            },
            error: rejectedCount ? { message: "Sebagian atau seluruh record ditolak; lihat results berdasarkan index." } : null,
        });
    } catch (error) {
        return handleError(error, res, next);
    }
}

export async function postHeartbeat(req, res, next) {
    const parsed = heartbeatSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed.error.issues);
    try {
        const data = await ingestHeartbeat(req.device.id, parsed.data, res.locals.receivedAt);
        return sendResponse(res, { status: 200, code: "HEARTBEAT_ACCEPTED", data });
    } catch (error) {
        return handleError(error, res, next);
    }
}
