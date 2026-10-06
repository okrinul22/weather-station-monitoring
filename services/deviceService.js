import prisma from "../utils/prisma.js";

export async function listDevices({ status, location_id, q, page, limit }) {
    const where = { deletedAt: null };

    if (status) where.status = status;
    if (location_id) where.locationId = location_id;

    if (q) {
        // Escape karakter LIKE agar % dan _ dicari sebagai teks biasa.
        const search = { contains: q.replace(/[\\%_]/g, "\\$&"), mode: "insensitive" };
        where.OR = [
            { name: search },
            { deviceCode: search },
            { location: { is: { name: search } } },
        ];
    }

    // Kedua query membaca snapshot yang sama agar total cocok dengan items.
    const [total, items] = await prisma.$transaction([
        prisma.device.count({ where }),
        prisma.device.findMany({
            where,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: [{ createdAt: "desc" }, { id: "asc" }],
            select: {
                id: true,
                deviceCode: true,
                name: true,
                status: true,
                locationId: true,
                lastSeenAt: true,
                createdAt: true,
                updatedAt: true,
                location: {
                    select: {
                        id: true,
                        name: true,
                        latitude: true,
                        longitude: true,
                        altitudeM: true,
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
