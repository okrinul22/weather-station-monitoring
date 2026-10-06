import { sensorListQuerySchema, sensorIdParamsSchema, createsensorSchema, updateSensorSchema } from "../validators/sensorValidator.js";
import { listSensors, findSensorById, createSensor, updateSensor, softDeleteSensor } from "../services/sensorService.js";
import sendResponse from "../utils/response.js";

export async function deleteSensor(req, res, next) {
    const result = sensorIdParamsSchema.safeParse(req.params);
    if (!result.success) {
        return sendResponse(res, {
            status: 422, code: "VALIDATION_ERROR",
            error: {
                message: "ID sensor tidak valid.",
                details: result.error.issues.map((issue) => ({
                    field: issue.path.join("."), message: issue.message,
                })),
            },
        });
    }

    try {
        const data = await softDeleteSensor(result.data.id);
        return sendResponse(res, { status: 200, code: "SENSOR_DELETED", data });
    } catch (error) {
        if (error.code === "SENSOR_NOT_FOUND" || error.code === "P2025") {
            return sendResponse(res, { status: 404, code: "SENSOR_NOT_FOUND", error: "Sensor tidak ditemukan atau sudah di-soft-delete." });
        }
        if (error.code === "SENSOR_STILL_INSTALLED") {
            return sendResponse(res, { status: 409, code: "SENSOR_STILL_INSTALLED", error: error.message });
        }
        if (error.code === "P2034") {
            return sendResponse(res, { status: 409, code: "SENSOR_DELETE_CONFLICT", error: "Terjadi konflik pembaruan bersamaan. Silakan ulangi request." });
        }
        return next(error);
    }
}

export async function patchSensor(req, res, next) {
    const params = sensorIdParamsSchema.safeParse(req.params);
    const body = updateSensorSchema.safeParse(req.body);
    if (!params.success || !body.success) {
        const issues = [
            ...(!params.success ? params.error.issues : []),
            ...(!body.success ? body.error.issues : []),
        ];
        return sendResponse(res, {
            status: 422, code: "VALIDATION_ERROR",
            error: {
                message: "ID atau data sensor tidak valid.",
                details: issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })),
            },
        });
    }

    try {
        const data = await updateSensor(params.data.id, body.data);
        return sendResponse(res, { status: 200, code: "SENSOR_UPDATED", data });
    } catch (error) {
        if (error.code === "SENSOR_NOT_FOUND" || error.code === "P2025") {
            return sendResponse(res, { status: 404, code: "SENSOR_NOT_FOUND", error: "Sensor tidak ditemukan." });
        }
        if (error.code === "SENSOR_TYPE_NOT_FOUND" || error.code === "P2003") {
            return sendResponse(res, { status: 404, code: "SENSOR_TYPE_NOT_FOUND", error: "Tipe sensor tidak ditemukan." });
        }
        if (error.code === "P2002") {
            return sendResponse(res, { status: 409, code: "SENSOR_SERIAL_NUMBER_EXISTS", error: "Serial number sensor sudah digunakan, termasuk oleh sensor yang sudah di-soft-delete." });
        }
        if (error.code === "P2034") {
            return sendResponse(res, { status: 409, code: "SENSOR_UPDATE_CONFLICT", error: "Terjadi konflik pembaruan bersamaan. Silakan ulangi request." });
        }
        return next(error);
    }
}

export async function postsensor(req, res, next) {
    const result = createsensorSchema.safeParse(req.body);

    if (!result.success) {
        return sendResponse(res, {
            status: 422,
            code: "VALIDATION_ERROR",
            error: {
                message: "Data sensor tidak valid.",
                details: result.error.issues.map((issue) => ({
                    field: issue.path.join("."),
                    message: issue.message,
                })),
            },
        });
    }

    try {
        const data = await createSensor(result.data);
        res.set("Cache-Control", "no-store");
        res.location(`/api/v1/sensors/${data.id}`);
        return sendResponse(res, { status: 201, code: "SENSOR_CREATED", data });
    } catch (error) {
        if (error.code === "P2034") {
            return sendResponse(res, { status: 409, code: "SENSOR_CREATE_CONFLICT", error: "Terjadi konflik pembaruan bersamaan. Silakan ulangi request." });
        }
        if (error.code === "P2002") {
            return sendResponse(res, {
                status: 409,
                code: "SENSOR_SERIAL_NUMBER_EXISTS",
                error: "Serial number sensor sudah digunakan, termasuk oleh sensor yang sudah di-soft-delete.",
            });
        }
        if (error.code === "SENSOR_TYPE_NOT_FOUND" || error.code === "P2003") {
            return sendResponse(res, {
                status: 404,
                code: "SENSOR_TYPE_NOT_FOUND",
                error: "Tipe sensor tidak ditemukan.",
            });
        }
        return next(error);
    }
}

export async function getSensorById(req, res, next) {
    const result = sensorIdParamsSchema.safeParse(req.params);

    if (!result.success) {
        return sendResponse(res, {
            status: 422,
            code: "VALIDATION_ERROR",
            error: {
                message: "ID sensor tidak valid.",
                details: result.error.issues.map((issue) => ({
                    field: issue.path.join("."),
                    message: issue.message,
                })),
            },
        });
    }

    try {
        const sensor = await findSensorById(result.data.id);
        if (!sensor) {
            return sendResponse(res, {
                status: 404,
                code: "SENSOR_NOT_FOUND",
                error: "Sensor tidak ditemukan.",
            });
        }
        return sendResponse(res, { status: 200, code: "SENSOR_FETCHED", data: sensor });
    } catch (error) {
        return next(error);
    }
}

export async function getsensor(req, res, next) {
    const result = sensorListQuerySchema.safeParse(req.query);

    if (!result.success) {
        return sendResponse(res, {
            status: 422,
            code: "VALIDATION_ERROR",
            error: {
                message: "Parameter query tidak valid.",
                details: result.error.issues.map((issue) => ({
                    field: issue.path.join("."),
                    message: issue.message,
                })),
            },
        });
    }

    try {
        const data = await listSensors(result.data);
        return sendResponse(res, { status: 200, code: "SENSORS_FETCHED", data });
    } catch (error) {
        return next(error);
    }
}
