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
                description: "Rencana endpoint; belum diimplementasikan.",
                tags: ["Devices"],

                responses: {
                    "200": {
                        description: "Contoh rencana response daftar device",
                        content: {
                            "application/json": {
                                example: {
                                    code: "DEVICES_FETCHED",
                                    data: [
                                        {
                                            id: "550e8400-e29b-41d4-a716-446655440000",
                                            deviceCode: "WS-GRT-001",
                                            name: "Stasiun Garut",
                                            status: "ACTIVE",
                                        },
                                    ],
                                    error: null,
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