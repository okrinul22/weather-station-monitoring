import { sensorListQuerySchema } from "../validators/sensorValidator.js";
import { listSensors } from "../services/sensorService.js";
import sendResponse from "../utils/response.js";

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
