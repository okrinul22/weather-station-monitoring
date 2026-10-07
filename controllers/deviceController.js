import { deviceListQuerySchema, deviceIdParamsSchema, createDeviceSchema, updateDeviceSchema } from "../validators/deviceValidator.js";
import { listDevices, findDeviceById, createDevice, updateDevice, softDeleteDevice, rotateDeviceCredentials } from "../services/deviceService.js";
import sendResponse from "../utils/response.js";

export async function postRotateDeviceCredentials(req, res, next) {
    const result = deviceIdParamsSchema.safeParse(req.params);
    if (!result.success) {
        return sendResponse(res, {
            status: 422, code: "VALIDATION_ERROR",
            error: {
                message: "ID device tidak valid.",
                details: result.error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })),
            },
        });
    }
    try {
        const data = await rotateDeviceCredentials(result.data.id);
        res.set("Cache-Control", "no-store");
        return sendResponse(res, { status: 200, code: "DEVICE_CREDENTIALS_ROTATED", data });
    } catch (error) {
        if (error.code === "P2025") {
            return sendResponse(res, { status: 404, code: "DEVICE_NOT_FOUND", error: "Device tidak ditemukan atau sudah di-soft-delete." });
        }
        return next(error);
    }
}

export async function deleteDevice(req, res, next) {
    const result = deviceIdParamsSchema.safeParse(req.params);
    if (!result.success) {
        return sendResponse(res, {
            status: 422, code: "VALIDATION_ERROR",
            error: {
                message: "ID device tidak valid.",
                details: result.error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })),
            },
        });
    }
    try {
        const data = await softDeleteDevice(result.data.id);
        return sendResponse(res, { status: 200, code: "DEVICE_DELETED", data });
    } catch (error) {
        if (error.code === "DEVICE_NOT_FOUND" || error.code === "P2025") {
            return sendResponse(res, { status: 404, code: "DEVICE_NOT_FOUND", error: "Device tidak ditemukan atau sudah di-soft-delete." });
        }
        if (error.code === "DEVICE_STILL_HAS_SENSORS") {
            return sendResponse(res, { status: 409, code: "DEVICE_STILL_HAS_SENSORS", error: error.message });
        }
        if (error.code === "P2034") {
            return sendResponse(res, { status: 409, code: "DEVICE_DELETE_CONFLICT", error: "Terjadi konflik pembaruan bersamaan. Silakan ulangi request." });
        }
        return next(error);
    }
}

export async function patchDevice(req, res, next) {
    const params = deviceIdParamsSchema.safeParse(req.params);
    const body = updateDeviceSchema.safeParse(req.body);

    if (!params.success || !body.success) {
        const issues = [
            ...(!params.success ? params.error.issues : []),
            ...(!body.success ? body.error.issues : []),
        ];
        return sendResponse(res, {
            status: 422,
            code: "VALIDATION_ERROR",
            error: {
                message: "ID atau data device tidak valid.",
                details: issues.map((issue) => ({
                    field: issue.path.join("."),
                    message: issue.message,
                })),
            },
        });
    }

    try {
        const data = await updateDevice(params.data.id, body.data);
        return sendResponse(res, { status: 200, code: "DEVICE_UPDATED", data });
    } catch (error) {
        if (error.code === "DEVICE_NOT_FOUND" || error.code === "P2025") {
            return sendResponse(res, { status: 404, code: "DEVICE_NOT_FOUND", error: "Device tidak ditemukan." });
        }
        if (error.code === "LOCATION_NOT_FOUND" || error.code === "P2003") {
            return sendResponse(res, { status: 404, code: "LOCATION_NOT_FOUND", error: "Lokasi tidak ditemukan." });
        }
        if (error.code === "P2002") {
            return sendResponse(res, { status: 409, code: "DEVICE_CODE_EXISTS", error: "Kode device sudah digunakan, termasuk oleh device yang sudah di-soft-delete." });
        }
        if (error.code === "P2034") {
            return sendResponse(res, { status: 409, code: "DEVICE_UPDATE_CONFLICT", error: "Terjadi konflik pembaruan bersamaan. Silakan ulangi request." });
        }
        return next(error);
    }
}

export async function postDevice(req, res, next) {
    const result = createDeviceSchema.safeParse(req.body);

    if (!result.success) {
        return sendResponse(res, {
            status: 422,
            code: "VALIDATION_ERROR",
            error: {
                message: "Data device tidak valid.",
                details: result.error.issues.map((issue) => ({
                    field: issue.path.join("."),
                    message: issue.message,
                })),
            },
        });
    }

    try {
        const data = await createDevice(result.data);
        res.set("Cache-Control", "no-store");
        res.location(`/api/v1/devices/${data.id}`);
        return sendResponse(res, { status: 201, code: "DEVICE_CREATED", data });
    } catch (error) {
        if (error.code === "P2002") {
            return sendResponse(res, {
                status: 409,
                code: "DEVICE_CODE_EXISTS",
                error: "Kode device sudah digunakan, termasuk oleh device yang sudah di-soft-delete.",
            });
        }
        if (error.code === "LOCATION_NOT_FOUND" || error.code === "P2003") {
            return sendResponse(res, {
                status: 404,
                code: "LOCATION_NOT_FOUND",
                error: "Lokasi tidak ditemukan.",
            });
        }
        return next(error);
    }
}

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
