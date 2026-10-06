import { deviceListQuerySchema, deviceIdParamsSchema } from "../validators/deviceValidator.js";
import { listDevices, findDeviceById } from "../services/deviceService.js";
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
export async function getDeviceById(req, res, next) {
    const result = deviceIdParamsSchema.safeParse(req.params);

    if (!result.success) {
        return sendResponse(res, {
            status: 422,
            code: "VALIDATION_ERROR",
            error: {
                message: "ID device tidak valid.",
                details: result.error.issues.map((issue) => ({
                    field: issue.path.join("."),
                    message: issue.message,
                })),
            },
        });
    }

    try {
        const device = await findDeviceById(result.data.id);

        if (!device) {
            return sendResponse(res, {
                status: 404,
                code: "DEVICE_NOT_FOUND",
                error: "Device tidak ditemukan.",
            });
        }

        return sendResponse(res, {
            status: 200,
            code: "DEVICE_FETCHED",
            data: device,
        });
    } catch (error) {
        return next(error);
    }
}
