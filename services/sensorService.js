import prisma from "../utils/prisma.js";

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
