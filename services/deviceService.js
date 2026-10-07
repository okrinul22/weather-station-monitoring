import prisma from "../utils/prisma.js";
import { randomBytes, createHash } from "node:crypto";

// Registrasi dan rotasi memakai sumber acak kriptografis yang sama:
// 32 byte = 256 bit, ditulis sebagai 64 karakter hex, bukan dari deviceCode/waktu.
// Simpan hanya SHA-256(key) di database. Hash bukan key untuk dikirim firmware.
function generateCredentials() {
    const apiKey = randomBytes(32).toString("hex");
    const apiKeyHash = createHash("sha256").update(apiKey).digest("hex");
    return { apiKey, apiKeyHash };
}

// POST /api/v1/devices/{id}/credentials/rotate tanpa body; id adalah UUID.
// Simpan data.apiKey dari respons ke konfigurasi firmware; GET tidak bisa
// mengambil key asli lagi. Jika respons hilang, lakukan rotasi ulang.
// Penggunaan firmware: kirim header X-API-Key berisi key ASLI pada POST
// /api/v1/ingest/telemetry, /telemetry/batch, atau /heartbeat. Body device_id
// berisi deviceCode (mis. WS-GRT-001), bukan UUID pada URL rotasi.
// Backend ingestion memverifikasi SHA-256(key) terhadap hash device tersebut.
// Jangan kirim hash sebagai key; gunakan HTTPS dan jangan simpan key di log/Git.
// Update hash langsung mencabut key lama untuk autentikasi request berikutnya;
// request yang sudah lolos autentikasi sebelum rotasi dapat tetap selesai.
export async function rotateDeviceCredentials(id) {
    const { apiKey, apiKeyHash } = generateCredentials();
    const device = await prisma.device.update({
        where: { id, deletedAt: null },
        data: { apiKeyHash },
        select: { id: true, deviceCode: true },
    });
    return { ...device, apiKey };
}

export async function softDeleteDevice(id) {
    return prisma.$transaction(async (tx) => {
        const device = await tx.device.findFirst({
            where: { id, deletedAt: null }, select: { id: true },
        });
        if (!device) {
            const error = new Error("Device tidak ditemukan.");
            error.code = "DEVICE_NOT_FOUND";
            throw error;
        }
        const installation = await tx.sensorInstallation.findFirst({
            where: { deviceId: id, removedAt: null }, select: { id: true },
        });
        if (installation) {
            const error = new Error("Device masih memiliki sensor terpasang. Lepaskan semua sensor terlebih dahulu.");
            error.code = "DEVICE_STILL_HAS_SENSORS";
            throw error;
        }

        // Soft-delete tidak mengubah status lifecycle atau menghapus riwayat.
        return tx.device.update({
            where: { id, deletedAt: null },
            data: { deletedAt: new Date() },
            select: { id: true, deviceCode: true, name: true, deletedAt: true },
        });
    }, { isolationLevel: "Serializable" });
}

export async function updateDevice(id, { device_code, name, location_id, status }) {
    // Satu transaksi menjaga perubahan device dan riwayat status tetap konsisten.
    return prisma.$transaction(async (tx) => {
        const current = await tx.device.findFirst({
            where: { id, deletedAt: null },
            select: { id: true, status: true },
        });
        if (!current) {
            const error = new Error("Device tidak ditemukan.");
            error.code = "DEVICE_NOT_FOUND";
            throw error;
        }

        if (location_id !== undefined) {
            const location = await tx.location.findUnique({
                where: { id: location_id },
                select: { id: true },
            });
            if (!location) {
                const error = new Error("Lokasi tidak ditemukan.");
                error.code = "LOCATION_NOT_FOUND";
                throw error;
            }
        }

        // Field yang tidak dikirim tidak ikut diubah.
        const data = {};
        if (device_code !== undefined) data.deviceCode = device_code;
        if (name !== undefined) data.name = name;
        if (location_id !== undefined) data.locationId = location_id;
        if (status !== undefined && status !== current.status) {
            data.status = status;
            data.statusHistory = {
                create: {
                    fromStatus: current.status,
                    toStatus: status,
                    reason: "Status device diperbarui.",
                },
            };
        }

        return tx.device.update({
            where: { id, deletedAt: null },
            data,
            select: {
                id: true, deviceCode: true, name: true, status: true,
                locationId: true, lastSeenAt: true, createdAt: true, updatedAt: true,
                location: {
                    select: { id: true, name: true, latitude: true, longitude: true, altitudeM: true },
                },
            },
        });
    }, { isolationLevel: "Serializable" });
}

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

    const { apiKey, apiKeyHash } = generateCredentials();

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
