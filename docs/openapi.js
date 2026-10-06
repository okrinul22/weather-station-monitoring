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
        "/api/v1/sensors/{id}": {
            get: {
                summary: "Mengambil detail sensor",
                description: "Mengambil sensor yang belum di-soft-delete beserta tipe sensornya.",
                tags: ["Sensors"],
                parameters: [{
                    name: "id",
                    in: "path",
                    required: true,
                    description: "ID sensor, bukan serial number.",
                    schema: { type: "string", format: "uuid" },
                }],
                responses: {
                    "200": { description: "Sensor ditemukan. Response berisi code SENSOR_FETCHED, data objek sensor, error null, dan timestamp." },
                    "404": { description: "Sensor tidak ditemukan atau sudah di-soft-delete. Code SENSOR_NOT_FOUND." },
                    "422": { description: "ID bukan UUID yang valid. Code VALIDATION_ERROR." },
                    "500": { description: "Kesalahan internal server. Code INTERNAL_SERVER_ERROR." },
                },
            },
        },
        "/api/v1/sensor-types/{id}": {
            get: {
                summary: "Mengambil detail tipe sensor",
                description: "Mengambil tipe sensor yang belum di-soft-delete beserta satuan, rentang valid, dan presisinya.",
                tags: ["Sensor Types"],
                parameters: [{
                    name: "id",
                    in: "path",
                    required: true,
                    description: "ID tipe sensor, bukan kode tipe sensor.",
                    schema: { type: "string", format: "uuid" },
                }],
                responses: {
                    "200": { description: "Tipe sensor ditemukan. Response berisi code SENSOR_TYPE_FETCHED, data objek tipe sensor, error null, dan timestamp." },
                    "404": { description: "Tipe sensor tidak ditemukan atau sudah di-soft-delete. Code SENSOR_TYPE_NOT_FOUND." },
                    "422": { description: "ID bukan UUID yang valid. Code VALIDATION_ERROR." },
                    "500": { description: "Kesalahan internal server. Code INTERNAL_SERVER_ERROR." },
                },
            },
        },
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
            post: {
                summary: "Membuat device baru",
                description: "Lokasi harus sudah tersedia. Status default ACTIVE. API key dibuat otomatis, hanya hash disimpan di database. Simpan data.apiKey dari response ini karena tidak tersedia pada endpoint GET. Status awal dicatat di device_status_history. Endpoint ini belum dilindungi autentikasi admin.",
                tags: ["Devices"],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                additionalProperties: false,
                                required: ["device_code", "name", "location_id"],
                                properties: {
                                    device_code: { type: "string", minLength: 1, maxLength: 50 },
                                    name: { type: "string", minLength: 1, maxLength: 150 },
                                    location_id: { type: "string", format: "uuid" },
                                    status: { type: "string", enum: ["ACTIVE", "MAINTENANCE", "DECOMMISSIONED"], default: "ACTIVE" },
                                },
                            },
                            example: {
                                device_code: "WS-GRT-004",
                                name: "Weather Station Garut 4",
                                location_id: "550e8400-e29b-41d4-a716-446655440000",
                                status: "ACTIVE",
                            },
                        },
                    },
                },
                responses: {
                    "201": {
                        description: "Device berhasil dibuat. API key asli hanya dikembalikan pada response pembuatan.",
                        headers: {
                            Location: { description: "URL detail device baru.", schema: { type: "string" } },
                        },
                        content: {
                            "application/json": {
                                example: {
                                    code: "DEVICE_CREATED",
                                    data: {
                                        id: "550e8400-e29b-41d4-a716-446655440001",
                                        deviceCode: "WS-GRT-004",
                                        name: "Weather Station Garut 4",
                                        status: "ACTIVE",
                                        locationId: "550e8400-e29b-41d4-a716-446655440000",
                                        lastSeenAt: null,
                                        createdAt: "2026-10-06T10:00:00.000Z",
                                        updatedAt: "2026-10-06T10:00:00.000Z",
                                        location: {
                                            id: "550e8400-e29b-41d4-a716-446655440000",
                                            name: "Garut",
                                            latitude: "-7.200000",
                                            longitude: "107.900000",
                                            altitudeM: "700.00",
                                        },
                                        apiKey: "CONTOH_KEY_SIMPAN_KEY_ASLI_DARI_RESPONSE",
                                    },
                                    error: null,
                                    timestamp: "2026-10-06T10:00:00.000Z",
                                },
                            },
                        },
                    },
                    "400": { description: "Format JSON tidak valid. Code INVALID_JSON." },
                    "404": { description: "Lokasi tidak ditemukan. Code LOCATION_NOT_FOUND." },
                    "409": { description: "Kode device sudah digunakan, termasuk oleh device soft-delete. Code DEVICE_CODE_EXISTS." },
                    "422": { description: "Body tidak valid atau berisi field yang tidak dikenal. Code VALIDATION_ERROR." },
                    "500": { description: "Kesalahan internal server. Code INTERNAL_SERVER_ERROR." },
                },
            },
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
        "/api/v1/sensors": {
            post: {
                summary: "Membuat sensor baru",
                description: "Tipe sensor harus sudah tersedia. Serial number unik di seluruh sensor, termasuk yang sudah di-soft-delete. Endpoint ini belum dilindungi autentikasi admin.",
                tags: ["Sensors"],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                additionalProperties: false,
                                required: ["serial_number", "name", "sensor_type_id"],
                                properties: {
                                    serial_number: { type: "string", minLength: 1, maxLength: 50 },
                                    name: { type: "string", minLength: 1, maxLength: 150 },
                                    sensor_type_id: { type: "string", format: "uuid" },
                                },
                            },
                            example: {
                                serial_number: "SEN-GRT-001",
                                name: "Sensor Suhu Garut",
                                sensor_type_id: "550e8400-e29b-41d4-a716-446655440000",
                            },
                        },
                    },
                },
                responses: {
                    "201": {
                        description: "Sensor berhasil dibuat.",
                        headers: {
                            Location: { description: "URL detail sensor baru.", schema: { type: "string" } },
                        },
                        content: {
                            "application/json": {
                                example: {
                                    code: "SENSOR_CREATED",
                                    data: {
                                        id: "550e8400-e29b-41d4-a716-446655440001",
                                        serialNumber: "SEN-GRT-001",
                                        name: "Sensor Suhu Garut",
                                        sensorTypeId: "550e8400-e29b-41d4-a716-446655440000",
                                        createdAt: "2026-10-06T10:00:00.000Z",
                                        updatedAt: "2026-10-06T10:00:00.000Z",
                                        sensorType: {
                                            id: "550e8400-e29b-41d4-a716-446655440000",
                                            code: "TEMP",
                                            name: "Temperature Sensor",
                                            unit: "°C",
                                        },
                                    },
                                    error: null,
                                    timestamp: "2026-10-06T10:00:00.000Z",
                                },
                            },
                        },
                    },
                    "400": { description: "Format JSON tidak valid. Code INVALID_JSON." },
                    "404": { description: "Tipe sensor tidak ditemukan. Code SENSOR_TYPE_NOT_FOUND." },
                    "409": { description: "Serial number sudah digunakan, termasuk oleh sensor soft-delete. Code SENSOR_SERIAL_NUMBER_EXISTS." },
                    "422": { description: "Body tidak valid atau berisi field yang tidak dikenal. Code VALIDATION_ERROR." },
                    "500": { description: "Kesalahan internal server. Code INTERNAL_SERVER_ERROR." },
                },
            },
            get: {
                summary: "Mengambil daftar sensor",
                description: "Daftar sensor yang belum di-soft-delete, terbaru terlebih dahulu. Filter digabungkan dengan AND; q mencari sebagian nama sensor, kode sensor, atau nama lokasi tanpa membedakan huruf besar/kecil. Pagination menggunakan page dan limit. Hasil kosong atau halaman di luar hasil tetap mendapat 200 dengan items kosong.",
                tags: ["Sensors"],

                parameters: [
                    {
                        name: "q",
                        in: "query",
                        description: "Cari nama sensor, kode sensor, atau nama lokasi; spasi di awal/akhir dihapus.",
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
                        description: "Jumlah sensor per halaman.",
                        schema: { type: "integer", minimum: 1, maximum: 200 },
                    },
                ],

                responses: {
                    "200": {
                        description: "Daftar sensor berhasil diambil. total adalah jumlah hasil setelah seluruh filter, sebelum pagination; totalPages adalah jumlah halaman dan bernilai 0 jika tidak ada hasil.",
                        content: {
                            "application/json": {
                                example: {
                                    code: "SENSORS_FETCHED",
                                    data: {
                                        items: [{
                                            id: "550e8400-e29b-41d4-a716-446655440000",
                                            sensorCode: "SEN-GRT-001",
                                            name: "Sensor Suhu Garut",
                                            deviceId: "550e8400-e29b-41d4-a716-446655440001",
                                            sensorTypeId: "550e8400-e29b-41d4-a716-446655440002",
                                            lastSeenAt: null,
                                            createdAt: "2026-10-06T00:00:00.000Z",
                                            updatedAt: "2026-10-06T00:00:00.000Z",
                                            sensorType: {
                                                id: "550e8400-e29b-41d4-a716-446655440002",
                                                name: "Temperature Sensor",
                                                unit: "°C",
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
                        description: "Query tidak valid, misalnya pagination di luar batas.",
                        content: {
                            "application/json": {
                                example: {
                                    code: "VALIDATION_ERROR",
                                    data: null,
                                    error: {
                                        message: "Parameter query tidak valid.",
                                        details: [{ field: "page", message: "Nomor halaman harus antara 1 dan 100000." }],
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
        }, "/api/v1/sensor-types": {
            post: {
                summary: "Membuat tipe sensor baru",
                description: "Kode harus unik, termasuk terhadap tipe sensor soft-delete. valid_min harus lebih kecil dari valid_max. Rentang disimpan sebagai Decimal(12,4), presisi 0 sampai 4 angka desimal. Endpoint belum dilindungi autentikasi admin.",
                tags: ["Sensor Types"],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                additionalProperties: false,
                                required: ["code", "name", "unit", "valid_min", "valid_max", "precision"],
                                properties: {
                                    code: { type: "string", minLength: 1, maxLength: 50 },
                                    name: { type: "string", minLength: 1, maxLength: 100 },
                                    unit: { type: "string", minLength: 1, maxLength: 30 },
                                    valid_min: { type: "number", minimum: -99999999.9999, maximum: 99999999.9999, multipleOf: 0.0001 },
                                    valid_max: { type: "number", minimum: -99999999.9999, maximum: 99999999.9999, multipleOf: 0.0001 },
                                    precision: { type: "integer", minimum: 0, maximum: 4 },
                                },
                            },
                            example: { code: "temp_soil", name: "Suhu Tanah", unit: "°C", valid_min: -40, valid_max: 85, precision: 2 },
                        },
                    },
                },
                responses: {
                    "201": {
                        description: "Tipe sensor berhasil dibuat. Nilai Decimal dikembalikan sebagai string.",
                        headers: { Location: { description: "URL detail tipe sensor baru.", schema: { type: "string" } } },
                        content: {
                            "application/json": {
                                example: {
                                    code: "SENSOR_TYPE_CREATED",
                                    data: {
                                        id: "550e8400-e29b-41d4-a716-446655440000",
                                        code: "temp_soil", name: "Suhu Tanah", unit: "°C",
                                        validMin: "-40", validMax: "85", precision: 2,
                                        createdAt: "2026-10-06T10:00:00.000Z", updatedAt: "2026-10-06T10:00:00.000Z",
                                    },
                                    error: null,
                                    timestamp: "2026-10-06T10:00:00.000Z",
                                },
                            },
                        },
                    },
                    "400": { description: "Format JSON tidak valid. Code INVALID_JSON." },
                    "409": { description: "Kode tipe sensor sudah digunakan. Code SENSOR_TYPE_CODE_EXISTS." },
                    "422": { description: "Body tidak valid. Code VALIDATION_ERROR." },
                    "500": { description: "Kesalahan internal server. Code INTERNAL_SERVER_ERROR." },
                },
            },
            get: {
                summary: "Mengambil daftar tipe sensor",
                description: "Daftar tipe sensor yang belum di-soft-delete, terbaru terlebih dahulu. Filter digabungkan dengan AND; q mencari sebagian nama tipe sensor tanpa membedakan huruf besar/kecil. Pagination menggunakan page dan limit. Hasil kosong atau halaman di luar hasil tetap mendapat 200 dengan items kosong.",
                tags: ["Sensor Types"],

                parameters: [
                    {
                        name: "q",
                        in: "query",
                        description: "Cari nama tipe sensor; spasi di awal/akhir dihapus.",
                        schema: { type: "string", maxLength: 100 },
                        example: "Temperature",
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
                        description: "Jumlah tipe sensor per halaman.",
                        schema: { type: "integer", minimum: 1, maximum: 200 },
                    },
                ],

                responses: {
                    "200": {
                        description: "Daftar tipe sensor berhasil diambil. total adalah jumlah hasil setelah seluruh filter, sebelum pagination; totalPages adalah jumlah halaman dan bernilai 0 jika tidak ada hasil.",
                        content: {
                            "application/json": {
                                example: {
                                    code: "SENSOR_TYPES_FETCHED",
                                    data: {
                                        items: [{
                                            id: "550e8400-e29b-41d4-a716-446655440000",
                                            name: "Temperature Sensor",
                                            unit: "°C",
                                            createdAt: "2026-10-06T00:00:00.000Z",
                                            updatedAt: "2026-10-06T00:00:00.000Z",
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
                        description: "Query tidak valid, misalnya pagination di luar batas.",
                        content: {
                            "application/json": {
                                example: {
                                    code: "VALIDATION_ERROR",
                                    data: null,
                                    error: {
                                        message: "Parameter query tidak valid.",
                                        details: [{ field: "page", message: "Nomor halaman harus antara 1 dan 100000." }],
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
            }
        },
        "/api/v1/devices/{id}": {
            get: {
                summary: "Mengambil detail device berdasarkan ID",
                description: "Mengambil detail device yang belum di-soft-delete berdasarkan ID. Nilai koordinat dan altitude dikirim sebagai string desimal.",
                tags: ["Devices"],

                parameters: [
                    {
                        name: "id",
                        in: "path",
                        description: "UUID device.",
                        required: true,
                        schema: { type: "string", format: "uuid" },
                    },
                ],

                responses: {
                    "200": {
                        description: "Detail device berhasil diambil.",
                        content: {
                            "application/json": {
                                example: {
                                    code: "DEVICE_FETCHED",
                                    data: {
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
                                    },
                                    error: null,
                                    timestamp: "2026-10-06T10:00:00.000Z",
                                },
                            },
                        },
                    },
                    "404": {
                        description: "Device tidak ditemukan.",
                        content: {
                            "application/json": {
                                example: {
                                    code: "DEVICE_NOT_FOUND",
                                    data: null,
                                    error: "Device tidak ditemukan.",
                                    timestamp: "2026-10-06T10:00:00.000Z",
                                },
                            },
                        },
                    },
                    "422": {
                        description: "ID device tidak valid.",
                        content: {
                            "application/json": {
                                example: {
                                    code: "VALIDATION_ERROR",
                                    data: null,
                                    error: {
                                        message: "ID device tidak valid.",
                                        details: [{ field: "id", message: "ID device harus berupa UUID yang valid." }],
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
            }
        }

    },
};

export default openapi;
