// Pisahkan dokumentasi ingestion agar openapi.js tidak terlalu panjang.
// Objek ini hanya dokumentasi; validasi sebenarnya tetap dilakukan oleh Zod.
const now = Math.floor(Date.now() / 1000);
const exampleDeviceId = "DEMO-WS-GRT-001";
const sampleRecord = {
    ts: now, seq: 10432, battery_v: 3.92, rssi: -71,
    readings: [
        { s: "temp_air", v: 27.4 }, { s: "humidity", v: 82.1 },
        { s: "pressure", v: 1008.3 }, { s: "wind_speed", v: 3.2 },
        { s: "wind_dir", v: 217 }, { s: "rain_counter", v: 1043 },
        { s: "solar_rad", v: 512.7 },
    ],
};
const recordProperties = {
    ts: { type: "integer", minimum: 0, maximum: 4102444800, description: "Epoch detik UTC dari device; jam maju lebih dari 5 menit ditolak, buffered data lama boleh diterima jika pemasangan berlaku." },
    seq: { type: "integer", minimum: 0, maximum: 2147483647, description: "Urutan sejak boot; bukan key dedup karena reset saat reboot." },
    battery_v: { type: "number", minimum: 0, maximum: 999.99, multipleOf: 0.01 },
    rssi: { type: "integer", minimum: -200, maximum: 0 },
    readings: {
        type: "array", maxItems: 32,
        description: "Kode s harus unik dalam payload; sensor tidak dikirim diabaikan tanpa membuat row nol/null. Array kosong diizinkan.",
        items: {
            type: "object", additionalProperties: false, required: ["s", "v"],
            properties: {
                s: { type: "string", minLength: 1, maxLength: 50, description: "Kode sensor_type; harus tepat satu pemasangan yang berlaku pada ts." },
                v: { type: "number", minimum: -99999999.9999, maximum: 99999999.9999, multipleOf: 0.0001, description: "Nilai mentah. Rentang fisik diperiksa sesudah kalibrasi dan ditandai, bukan dibuang." },
            },
        },
    },
};
const identity = {
    device_id: { type: "string", minLength: 1, maxLength: 50, description: "Kode device seperti WS-GRT-001, bukan UUID." },
    fw: { type: "string", minLength: 1, maxLength: 50 },
};
const recordSchema = {
    type: "object", additionalProperties: false,
    required: ["ts", "seq", "battery_v", "rssi", "readings"],
    properties: recordProperties,
};
const security = [{ DeviceApiKey: [] }];
const errors = {
    "400": { description: "INVALID_JSON atau PAYLOAD_TOO_LARGE (maksimal body 1 MB)." },
    "401": { description: "UNAUTHORIZED: header X-API-Key tidak ada atau salah untuk device_id." },
    "403": { description: "DEVICE_DECOMMISSIONED: device tidak boleh ingestion. ACTIVE dan MAINTENANCE diterima." },
    "404": { description: "DEVICE_NOT_FOUND: device tidak terdaftar atau sudah soft-delete." },
    "409": { description: "INGEST_CONFLICT: transaksi konflik setelah retry terbatas; ulangi request." },
    "422": {
        description: "Payload/schema, pemasangan, atau timestamp tidak valid. Nilai fisik out-of-range yang masih muat Decimal tetap disimpan dengan flag.",
        content: { "application/json": { example: {
            code: "VALIDATION_ERROR", data: null,
            error: { message: "Payload ingestion tidak valid.", details: [{ field: "ts", message: "ts harus berupa epoch detik bilangan bulat." }] },
            timestamp: "2026-10-06T10:00:00.000Z", request_id: "UUID-REQUEST",
        } } },
    },
    "429": {
        description: "RATE_LIMIT_EXCEEDED: 60 request/menit/device dan 120 request/menit/IP, berbagi limit untuk semua route ingestion. Limiter in-memory satu proses.",
        headers: { "Retry-After": { schema: { type: "integer" }, description: "Tunggu sekian detik sebelum retry." } },
    },
    "500": { description: "DB/server gagal; tidak memberi ACK sukses. Device harus menyimpan buffer dan retry. Chunk yang sudah commit aman dikirim ulang." },
};

export const ingestSecuritySchemes = {
    DeviceApiKey: { type: "apiKey", in: "header", name: "X-API-Key", description: "API key asli dari POST device. Seeder memakai demo-only-<deviceCode>, misalnya demo-only-DEMO-WS-GRT-001; contoh demo saja, bukan key untuk production. Gunakan HTTPS saat deployment." },
};

export const ingestPaths = {
    "/api/v1/ingest/telemetry": {
        post: {
            summary: "Menerima satu payload telemetry", tags: ["Ingestion"], security,
            description: "Format firmware mengikuti PDF F.1. Dedup menggunakan installationId + deviceTime (first-write-wins), bukan seq. Kalibrasi dipilih berdasarkan effectiveFrom <= ts. -999 pada temp_air menjadi INVALID, humidity di luar rentang menjadi OUT_OF_RANGE. Raw reading tidak ditimpa. Saat ini hanya menyimpan reading dan health; reading_aggregate belum otomatis diperbarui. Rain counter mentah tetap count, bukan mm. Contoh ts dibuat saat server start; sesuaikan jika di luar periode pemasangan.",
            requestBody: { required: true, content: { "application/json": {
                schema: { ...recordSchema, required: [...recordSchema.required, "device_id", "fw"], properties: { ...identity, ...recordProperties } },
                example: { device_id: exampleDeviceId, fw: "1.4.2", ...sampleRecord },
            } } },
            responses: {
                "201": { description: "TELEMETRY_ACCEPTED: reading baru disimpan.", content: { "application/json": { example: {
                    code: "TELEMETRY_ACCEPTED",
                    data: { device_id: exampleDeviceId, index: 0, ts: now, status: "accepted", accepted_readings: 7, duplicate_readings: 0, quality_flags: ["GOOD", "GOOD", "GOOD", "GOOD", "GOOD", "GOOD", "GOOD"] },
                    error: null, timestamp: "2026-10-06T10:00:00.000Z", request_id: "UUID-REQUEST",
                } } } },
                "200": { description: "TELEMETRY_DUPLICATE: semua reading sudah ada; atau TELEMETRY_ACCEPTED untuk readings kosong. quality_flags hanya untuk reading baru, bukan duplikat." },
                ...errors,
            },
        },
    },
    "/api/v1/ingest/telemetry/batch": {
        post: {
            summary: "Menerima buffered telemetry", tags: ["Ingestion"], security,
            description: "1–500 record/request. Chunk 100 payload per transaksi dan bulk insert. Validasi isi per record; record dengan pemasangan invalid ditolak seluruhnya. accepted/duplicates/rejected menghitung payload, accepted_readings/duplicate_readings menghitung row sensor. Campuran accepted+duplicate atau accepted/duplicate+rejected mendapat 207. Urutan hasil memakai index asli. Tidak memperbarui aggregate otomatis; tidak ada queue durable di server.",
            requestBody: { required: true, content: { "application/json": {
                schema: { type: "object", additionalProperties: false, required: ["device_id", "fw", "batch"], properties: { ...identity, batch: { type: "array", minItems: 1, maxItems: 500, items: recordSchema } } },
                example: { device_id: exampleDeviceId, fw: "1.4.2", batch: [
                    { ...sampleRecord, ts: now - 60, readings: [{ s: "temp_air", v: 27.4 }, { s: "rain_counter", v: 1043 }] },
                    { ...sampleRecord, seq: 10433, readings: [{ s: "temp_air", v: 27.6 }, { s: "rain_counter", v: 1045 }] },
                ] },
            } } },
            responses: {
                "201": { description: "BATCH_ACCEPTED: semua payload diterima." },
                "200": { description: "BATCH_ACCEPTED: seluruh payload duplikat; retry aman." },
                "207": { description: "BATCH_PARTIAL_SUCCESS: hasil campuran, periksa results per index.", content: { "application/json": { example: {
                    code: "BATCH_PARTIAL_SUCCESS", data: {
                        device_id: exampleDeviceId, accepted: 8, duplicates: 2, rejected: 0,
                        accepted_readings: 56, duplicate_readings: 14,
                        results: Array.from({ length: 10 }, (_, index) => ({
                            index, ts: now - index * 60, status: index < 8 ? "accepted" : "duplicate",
                            accepted_readings: index < 8 ? 7 : 0,
                            duplicate_readings: index < 8 ? 0 : 7,
                            quality_flags: index < 8 ? Array(7).fill("GOOD") : [],
                        })),
                    }, error: null, timestamp: "2026-10-06T10:00:00.000Z", request_id: "UUID-REQUEST",
                } } } },
                ...errors,
            },
        },
    },
    "/api/v1/ingest/heartbeat": {
        post: {
            summary: "Menerima heartbeat device", tags: ["Ingestion"], security,
            description: "Tanpa sensor_reading. Memperbarui lastSeenAt dengan waktu server. Metadata fw/battery/rssi/uptime dan lastDeviceTime hanya maju jika ts lebih baru. Telemetry tidak menghapus uptime. Heartbeat tidak mengubah lifecycle menjadi ACTIVE dan duplikat tidak memundurkan metadata.",
            requestBody: { required: true, content: { "application/json": {
                schema: { type: "object", additionalProperties: false, required: ["device_id", "ts", "fw", "battery_v", "rssi", "uptime_s"], properties: {
                    ...identity, ts: recordProperties.ts, battery_v: recordProperties.battery_v, rssi: recordProperties.rssi,
                    uptime_s: { type: "integer", minimum: 0, maximum: Number.MAX_SAFE_INTEGER },
                } },
                example: { device_id: exampleDeviceId, ts: now, fw: "1.4.2", battery_v: 3.90, rssi: -70, uptime_s: 864321 },
            } } },
            responses: {
                "200": { description: "HEARTBEAT_ACCEPTED.", content: { "application/json": { example: {
                    code: "HEARTBEAT_ACCEPTED", data: { device_id: exampleDeviceId, device_time: "2026-10-06T10:00:00.000Z", received_at: "2026-10-06T10:00:02.000Z" },
                    error: null, timestamp: "2026-10-06T10:00:02.000Z", request_id: "UUID-REQUEST",
                } } } },
                ...errors,
            },
        },
    },
};
