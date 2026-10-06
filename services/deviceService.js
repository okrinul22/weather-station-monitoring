import prisma from "../utils/prisma.js";
import { randomBytes, createHash } from "node:crypto";

export async function createDevice({ device_code, name, location_id, status }) {
    const location = await prisma.location.findUnique({
        where: { id: location_id },
        select: { id: true },
    });

    if (!location) {
        const error = new Error("Lokasi tidak ditemukan.");
        error.code = "LOCATION_NOT_FOUND";
        throw error;
    }

    const apiKey = randomBytes(32).toString("hex");
    const apiKeyHash = createHash("sha256").update(apiKey).digest("hex");

    // Nested create: device dan riwayat status disimpan bersama secara atomik.
    const device = await prisma.device.create({
        data: {
            deviceCode: device_code,
            name,
            locationId: location_id,
            status,
            apiKeyHash,
            statusHistory: {
                create: { toStatus: status, reason: "Device dibuat." },
            },
        },
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
                select: { id: true, name: true, latitude: true, longitude: true, altitudeM: true },
            },
        },
    });

    // Key asli hanya dikirim saat pembuatan; GET tidak mengembalikan key/hash.
    return { ...device, apiKey };
}

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
export async function findDeviceById(id) {
    return prisma.device.findFirst({
        where: {
            id,
            deletedAt: null,
        },
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
    });
}
