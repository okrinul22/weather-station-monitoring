import prisma from "../utils/prisma.js";

export async function findSensorTypeById(id) {
    return prisma.sensorType.findFirst({
        where: { id, deletedAt: null },
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
