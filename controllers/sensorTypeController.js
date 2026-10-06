import { sensorListTypeQuerySchema, sensorTypeIdParamsSchema, createSensorTypeSchema, updateSensorTypeSchema } from "../validators/sensorTypeValidator.js";
import { listSensorTypes, findSensorTypeById, createSensorType, updateSensorType, softDeleteSensorType } from "../services/sensorTypeService.js";
import sendResponse from "../utils/response.js";

export async function deleteSensorType(req, res, next) {
    const result = sensorTypeIdParamsSchema.safeParse(req.params);
    if (!result.success) {
        return sendResponse(res, {
            status: 422, code: "VALIDATION_ERROR",
            error: {
                message: "ID tipe sensor tidak valid.",
                details: result.error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })),
            },
        });
    }
    try {
        const data = await softDeleteSensorType(result.data.id);
        return sendResponse(res, { status: 200, code: "SENSOR_TYPE_DELETED", data });
    } catch (error) {
        if (error.code === "SENSOR_TYPE_NOT_FOUND" || error.code === "P2025") {
            return sendResponse(res, { status: 404, code: "SENSOR_TYPE_NOT_FOUND", error: "Tipe sensor tidak ditemukan atau sudah di-soft-delete." });
        }
        if (error.code === "SENSOR_TYPE_IN_USE") {
            return sendResponse(res, { status: 409, code: "SENSOR_TYPE_IN_USE", error: error.message });
        }
        if (error.code === "P2034") {
            return sendResponse(res, { status: 409, code: "SENSOR_TYPE_DELETE_CONFLICT", error: "Terjadi konflik pembaruan bersamaan. Silakan ulangi request." });
        }
        return next(error);
    }
}

export async function patchSensorType(req, res, next) {
    const params = sensorTypeIdParamsSchema.safeParse(req.params);
    const body = updateSensorTypeSchema.safeParse(req.body);
    if (!params.success || !body.success) {
        const issues = [
            ...(!params.success ? params.error.issues : []),
            ...(!body.success ? body.error.issues : []),
        ];
        return sendResponse(res, {
            status: 422, code: "VALIDATION_ERROR",
            error: {
                message: "ID atau data tipe sensor tidak valid.",
                details: issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })),
            },
        });
    }

    try {
        const data = await updateSensorType(params.data.id, body.data);
        return sendResponse(res, { status: 200, code: "SENSOR_TYPE_UPDATED", data });
    } catch (error) {
        if (error.code === "SENSOR_TYPE_NOT_FOUND" || error.code === "P2025") {
            return sendResponse(res, { status: 404, code: "SENSOR_TYPE_NOT_FOUND", error: "Tipe sensor tidak ditemukan." });
        }
        if (error.code === "INVALID_SENSOR_TYPE_RANGE") {
            return sendResponse(res, {
                status: 422, code: "VALIDATION_ERROR",
                error: {
                    message: "Rentang tipe sensor tidak valid.",
                    details: [{ field: "valid_max", message: error.message }],
                },
            });
        }
        if (error.code === "P2002") {
            return sendResponse(res, { status: 409, code: "SENSOR_TYPE_CODE_EXISTS", error: "Kode tipe sensor sudah digunakan, termasuk oleh tipe sensor yang sudah di-soft-delete." });
        }
        if (error.code === "P2034") {
            return sendResponse(res, { status: 409, code: "SENSOR_TYPE_UPDATE_CONFLICT", error: "Terjadi konflik pembaruan bersamaan. Silakan ulangi request." });
        }
        return next(error);
    }
}

export async function postSensorType(req, res, next) {
    const result = createSensorTypeSchema.safeParse(req.body);

    if (!result.success) {
        return sendResponse(res, {
            status: 422,
            code: "VALIDATION_ERROR",
            error: {
                message: "Data tipe sensor tidak valid.",
                details: result.error.issues.map((issue) => ({
                    field: issue.path.join("."),
                    message: issue.message,
                })),
            },
        });
    }

    try {
        const data = await createSensorType(result.data);
        res.location(`/api/v1/sensor-types/${data.id}`);
        return sendResponse(res, { status: 201, code: "SENSOR_TYPE_CREATED", data });
    } catch (error) {
        if (error.code === "P2002") {
            return sendResponse(res, {
                status: 409,
                code: "SENSOR_TYPE_CODE_EXISTS",
                error: "Kode tipe sensor sudah digunakan, termasuk oleh tipe sensor yang sudah di-soft-delete.",
            });
        }
        return next(error);
    }
}

export async function getSensorTypeById(req, res, next) {
    const result = sensorTypeIdParamsSchema.safeParse(req.params);

    if (!result.success) {
        return sendResponse(res, {
            status: 422,
            code: "VALIDATION_ERROR",
            error: {
                message: "ID tipe sensor tidak valid.",
                details: result.error.issues.map((issue) => ({
                    field: issue.path.join("."),
                    message: issue.message,
                })),
            },
        });
    }

    try {
        const sensorType = await findSensorTypeById(result.data.id);
        if (!sensorType) {
            return sendResponse(res, {
                status: 404,
                code: "SENSOR_TYPE_NOT_FOUND",
                error: "Tipe sensor tidak ditemukan.",
            });
        }
        return sendResponse(res, { status: 200, code: "SENSOR_TYPE_FETCHED", data: sensorType });
    } catch (error) {
        return next(error);
    }
}

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
