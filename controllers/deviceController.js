import { deviceListQuerySchema } from "../validators/deviceValidator.js";
import { listDevices } from "../services/deviceService.js";
import sendResponse from "../utils/response.js";

export async function getDevices(req, res, next) {
    const result = deviceListQuerySchema.safeParse(req.query);

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
        const data = await listDevices(result.data);
        return sendResponse(res, { status: 200, code: "DEVICES_FETCHED", data });
    } catch (error) {
        return next(error);
    }
}
