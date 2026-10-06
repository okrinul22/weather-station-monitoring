import { sensorListQuerySchema, sensorIdParamsSchema } from "../validators/sensorValidator.js";
import { listSensors, findSensorById } from "../services/sensorService.js";
import sendResponse from "../utils/response.js";

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
