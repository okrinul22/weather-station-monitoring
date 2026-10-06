const openapi = {
    openapi: "3.0.3",

    info: {
        title: "Weather Station Monitoring API",
        version: "1.0.0",
        description: "Dokumentasi API monitoring stasiun cuaca.",
    },

    servers: [
        { url: "http://localhost:3000" },
    ],

    paths: {
        "/health": {
            get: {
                summary: "Memeriksa apakah API dapat merespons",
                tags: ["Health"],

                responses: {
                    "200": {
                        description: "API berhasil merespons",
                        content: {
                            "application/json": {
                                example: {
                                    code: "OK",
                                    data: { status: "ok" },
                                    error: null,
                                    timestamp: "2026-10-06T10:00:00.000Z",
                                },
                            },
                        },
                    },
                },
            },
        },

        "/api/v1/devices": {
            get: {
                summary: "Mengambil daftar device",
                description: "Daftar device yang belum di-soft-delete, terbaru terlebih dahulu. Filter digabungkan dengan AND; q mencari sebagian nama device, kode device, atau nama lokasi tanpa membedakan huruf besar/kecil. Pagination menggunakan page dan limit. Hasil kosong atau halaman di luar hasil tetap mendapat 200 dengan items kosong. Nilai koordinat dan altitude dikirim sebagai string desimal.",
                tags: ["Devices"],

                parameters: [
                    {
                        name: "status",
                        in: "query",
                        description: "Filter status device.",
                        schema: { type: "string", enum: ["ACTIVE", "MAINTENANCE", "DECOMMISSIONED"] },
                    },
                    {
                        name: "location_id",
                        in: "query",
                        description: "Filter berdasarkan UUID lokasi.",
                        schema: { type: "string", format: "uuid" },
                    },
                    {
                        name: "q",
                        in: "query",
                        description: "Cari nama device, kode device, atau nama lokasi; spasi di awal/akhir dihapus.",
                        schema: { type: "string", maxLength: 100 },
                        example: "Garut",
                    },
                    {
                        name: "page",
                        in: "query",
                        description: "Nomor halaman, mulai dari 1.",
                        schema: { type: "integer", minimum: 1, maximum: 100000, default: 1 },
                    },
                    {
                        name: "limit",
                        in: "query",
                        description: "Jumlah device per halaman.",
                        schema: { type: "integer", minimum: 1, maximum: 200 },
                    },
                ],

                responses: {
                    "200": {
                        description: "Daftar device berhasil diambil. total adalah jumlah hasil setelah seluruh filter, sebelum pagination; totalPages adalah jumlah halaman dan bernilai 0 jika tidak ada hasil. API key hash tidak dikirim.",
                        content: {
                            "application/json": {
                                example: {
                                    code: "DEVICES_FETCHED",
                                    data: {
                                        items: [{
                                            id: "550e8400-e29b-41d4-a716-446655440000",
                                            deviceCode: "WS-GRT-001",
                                            name: "Stasiun Garut",
                                            status: "ACTIVE",
                                            locationId: "550e8400-e29b-41d4-a716-446655440001",
                                            lastSeenAt: null,
                                            createdAt: "2026-10-06T00:00:00.000Z",
                                            updatedAt: "2026-10-06T00:00:00.000Z",
                                            location: {
                                                id: "550e8400-e29b-41d4-a716-446655440001",
                                                name: "Garut",
                                                latitude: "-7.2167",
                                                longitude: "107.9",
                                                altitudeM: "717",
                                            },
                                        }],
                                        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
                                    },
                                    error: null,
                                    timestamp: "2026-10-06T10:00:00.000Z",
                                },
                            },
                        },
                    },
                    "422": {
                        description: "Query tidak valid, misalnya status di luar pilihan, UUID salah, atau pagination di luar batas.",
                        content: {
                            "application/json": {
                                example: {
                                    code: "VALIDATION_ERROR",
                                    data: null,
                                    error: {
                                        message: "Parameter query tidak valid.",
                                        details: [{ field: "location_id", message: "location_id harus berupa UUID yang valid." }],
                                    },
                                    timestamp: "2026-10-06T10:00:00.000Z",
                                },
                            },
                        },
                    },
                    "500": {
                        description: "Kesalahan internal atau kegagalan akses database.",
                        content: {
                            "application/json": {
                                example: {
                                    code: "INTERNAL_SERVER_ERROR",
                                    data: null,
                                    error: "Terjadi kesalahan pada server.",
                                    timestamp: "2026-10-06T10:00:00.000Z",
                                },
                            },
                        },
                    },
                },
            },
        },
    },
};

export default openapi;
