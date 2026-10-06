import prisma from "../utils/prisma.js";

export async function softDeleteSensorType(id) {
    return prisma.$transaction(async (tx) => {
        const type = await tx.sensorType.findFirst({
            where: { id, deletedAt: null }, select: { id: true },
        });
        if (!type) {
            const error = new Error("Tipe sensor tidak ditemukan.");
            error.code = "SENSOR_TYPE_NOT_FOUND";
            throw error;
        }
        const sensor = await tx.sensor.findFirst({
            where: { sensorTypeId: id, deletedAt: null }, select: { id: true },
        });
        if (sensor) {
            const error = new Error("Tipe sensor masih digunakan oleh sensor yang belum di-soft-delete.");
            error.code = "SENSOR_TYPE_IN_USE";
            throw error;
        }

        return tx.sensorType.update({
            where: { id, deletedAt: null },
            data: { deletedAt: new Date() },
            select: { id: true, code: true, name: true, deletedAt: true },
        });
    }, { isolationLevel: "Serializable" });
}

export async function updateSensorType(id, { code, name, unit, valid_min, valid_max, precision }) {
    return prisma.$transaction(async (tx) => {
        const current = await tx.sensorType.findFirst({
            where: { id, deletedAt: null },
            select: { id: true, validMin: true, validMax: true },
        });
        if (!current) {
            const error = new Error("Tipe sensor tidak ditemukan.");
            error.code = "SENSOR_TYPE_NOT_FOUND";
            throw error;
        }

        // PATCH boleh mengirim satu batas saja: bandingkan dengan batas tersimpan.
        const nextMin = valid_min ?? current.validMin.toNumber();
        const nextMax = valid_max ?? current.validMax.toNumber();
        if (nextMin >= nextMax) {
            const error = new Error("valid_max harus lebih besar dari valid_min.");
            error.code = "INVALID_SENSOR_TYPE_RANGE";
            throw error;
        }

        const data = {};
        if (code !== undefined) data.code = code;
        if (name !== undefined) data.name = name;
        if (unit !== undefined) data.unit = unit;
        if (valid_min !== undefined) data.validMin = valid_min;
        if (valid_max !== undefined) data.validMax = valid_max;
        if (precision !== undefined) data.precision = precision;

        return tx.sensorType.update({
            where: { id, deletedAt: null },
            data,
            select: {
                id: true, code: true, name: true, unit: true,
                validMin: true, validMax: true, precision: true,
                createdAt: true, updatedAt: true,
            },
        });
    }, { isolationLevel: "Serializable" });
}

export async function createSensorType({
    code,
    name,
    unit,
    valid_min,
    valid_max,
    precision,
}) {
    return prisma.sensorType.create({
        data: {
            code,
            name,
            unit,
            validMin: valid_min,
            validMax: valid_max,
            precision,
        },
        select: {
            id: true,
            code: true,
            name: true,
            unit: true,
            validMin: true,
            validMax: true,
            precision: true,
            createdAt: true,
            updatedAt: true,
        },
    });
}

export async function listSensorTypes({ q, page, limit }) {
    const where = { deletedAt: null };

    if (q) {
        const search = {
            contains: q.replace(/[\\%_]/g, "\\$&"),
            mode: "insensitive",
        };

        where.OR = [
            { name: search },
            { code: search },
            { sensors: { some: { name: search } } },
        ];
    }

    const [total, items] = await prisma.$transaction([
        prisma.sensorType.count({ where }),

        prisma.sensorType.findMany({
            where,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: [
                { createdAt: "desc" },
                { id: "asc" },
            ],
            select: {
                id: true,
                code: true,
                name: true,
                unit: true,
                validMin: true,
                validMax: true,
                precision: true,
                createdAt: true,
                updatedAt: true,

                sensors: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        },
        ),
    ], {
        isolationLevel: "RepeatableRead",
    });

    return {
        items,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}
export async function findSensorTypeById(id) {
    return prisma.sensorType.findFirst({
        where: {
            id,
            deletedAt: null,
        },
        select: {
            id: true,
            code: true,
            name: true,
            unit: true,
            validMin: true,
            validMax: true,
            precision: true,
            createdAt: true,
            updatedAt: true,
        },
    });
}
