import { sensorListTypeQuerySchema } from "../validators/sensorTypeValidator.js";
import { listSensorTypes } from "../services/sensorTypeService.js";
import sendResponse from "../utils/response.js";

export async function getSensorTypes(req, res, next) {
    const result = sensorListTypeQuerySchema.safeParse(req.query);

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
        const data = await listSensorTypes(result.data);
        return sendResponse(res, { status: 200, code: "SENSOR_TYPES_FETCHED", data });
    } catch (error) {
        return next(error);
    }
}
