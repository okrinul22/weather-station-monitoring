import prisma from "../utils/prisma.js";

export async function updateSensor(id, { name, serial_number, sensor_type_id }) {
    return prisma.$transaction(async (tx) => {
        const current = await tx.sensor.findFirst({
            where: { id, deletedAt: null },
            select: { id: true },
        });
        if (!current) {
            const error = new Error("Sensor tidak ditemukan.");
            error.code = "SENSOR_NOT_FOUND";
            throw error;
        }

        if (sensor_type_id !== undefined) {
            const type = await tx.sensorType.findFirst({
                where: { id: sensor_type_id, deletedAt: null },
                select: { id: true },
            });
            if (!type) {
                const error = new Error("Tipe sensor tidak ditemukan.");
                error.code = "SENSOR_TYPE_NOT_FOUND";
                throw error;
            }
        }

        const data = {};
        if (name !== undefined) data.name = name;
        if (serial_number !== undefined) data.serialNumber = serial_number;
        if (sensor_type_id !== undefined) data.sensorTypeId = sensor_type_id;

        return tx.sensor.update({
            where: { id, deletedAt: null },
            data,
            select: {
                id: true, serialNumber: true, name: true, sensorTypeId: true,
                createdAt: true, updatedAt: true,
                sensorType: { select: { id: true, code: true, name: true, unit: true } },
            },
        });
    }, { isolationLevel: "Serializable" });
}

export async function createSensor({ name, serial_number, sensor_type_id }) {
    return prisma.sensor.create({
        data: {
            name,
            serialNumber: serial_number,
            sensorTypeId: sensor_type_id,
        },
        select: {
            id: true,
            serialNumber: true,
            name: true,
            sensorTypeId: true,
            createdAt: true,
            updatedAt: true,
            sensorType: {
                select: { id: true, code: true, name: true, unit: true },
            },
        },
    });
}

export async function findSensorById(id) {
    return prisma.sensor.findFirst({
        where: { id, deletedAt: null },
        select: {
            id: true,
            serialNumber: true,
            name: true,
            sensorTypeId: true,
            createdAt: true,
            updatedAt: true,
            sensorType: {
                select: { id: true, code: true, name: true, unit: true },
            },
        },
    });
}

export async function listSensors({ q, page, limit }) {
    const where = { deletedAt: null };

    if (q) {
        // Escape karakter LIKE agar % dan _ dicari sebagai teks biasa.
        const search = { contains: q.replace(/[\\%_]/g, "\\$&"), mode: "insensitive" };
        where.OR = [
            { name: search },
            { serialNumber: search },
            { sensorType: { is: { name: search } } },
        ];
    }

    // Kedua query membaca snapshot yang sama agar total cocok dengan items.
    const [total, items] = await prisma.$transaction([
        prisma.sensor.count({ where }),
        prisma.sensor.findMany({
            where,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: [{ createdAt: "desc" }, { id: "asc" }],
            select: {
                id: true,
                serialNumber: true,
                name: true,
                sensorTypeId: true,
                createdAt: true,
                updatedAt: true,
                sensorType: {
                    select: {
                        id: true,
                        name: true,
                        unit: true,
                    },
                },
            },
        }),
    ], { isolationLevel: "RepeatableRead" });

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
