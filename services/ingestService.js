import prisma from "../utils/prisma.js";
import { validateDeviceTime, correctReading } from "../utils/ingestProcessing.js";

function readingKey(row) {
    return `${row.installationId}:${row.deviceTime.getTime()}`;
}

function prepareRecord(record, installations, serverTime) {
    const deviceTime = validateDeviceTime(record.ts, serverTime);
    const rows = [];
    for (const reading of record.readings) {
        // Cocokkan pemasangan pada WAKTU PENGUKURAN, bukan pemasangan sekarang.
        // Batas removedAt eksklusif: data tepat saat pindah masuk pemasangan baru.
        const matches = installations.filter((installation) =>
            installation.sensor.sensorType.code === reading.s &&
            installation.installedAt <= deviceTime &&
            (!installation.removedAt || deviceTime < installation.removedAt) &&
            (!installation.sensor.deletedAt || deviceTime < installation.sensor.deletedAt) &&
            (!installation.sensor.sensorType.deletedAt || deviceTime < installation.sensor.sensorType.deletedAt));
        if (matches.length !== 1) {
            const error = new Error(matches.length ?
                `Pemasangan ${reading.s} ambigu; firmware hanya mengirim kode tipe, bukan ID sensor.` :
                `Tidak ada pemasangan ${reading.s} yang berlaku pada ts tersebut.`);
            error.status = 422;
            error.code = "SENSOR_INSTALLATION_INVALID";
            error.field = "readings";
            throw error;
        }

        const installation = matches[0];
        // Daftar sudah diurutkan newest-first. Kalibrasi hari ini tidak dipakai
        // untuk buffered reading kemarin; tanpa kalibrasi gunakan scale 1 + offset 0.
        const calibration = installation.sensor.calibrations.find((item) => item.effectiveFrom <= deviceTime);
        rows.push({
            installationId: installation.id,
            calibrationId: calibration?.id ?? null,
            deviceTime,
            serverTime,
            seq: record.seq,
            ...correctReading(reading, installation.sensor.sensorType, calibration),
        });
    }
    // Sensor yang tidak dikirim tidak dibuatkan nilai 0/null: tidak ada row.
    // rain_counter tetap berupa counter; selisih dalam urutan deviceTime ×0.2 mm
    // dihitung di query/agregasi, jangan menjumlahkan counter kumulatif.
    return { record, deviceTime, rows };
}

async function updateDeviceHealth(tx, deviceId, fw, record, serverTime) {
    const deviceTime = new Date(record.ts * 1000);
    // lastSeenAt = waktu diterima, sehingga buffered upload menunjukkan device hidup.
    // updateMany bersyarat mencegah request yang lebih lama memundurkan timestamp.
    await tx.device.updateMany({
        where: { id: deviceId, deletedAt: null, OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: serverTime } }] },
        data: { lastSeenAt: serverTime },
    });
    // Metadata kesehatan mengikuti event terbaru, bukan urutan kedatangan.
    // Telemetry tanpa uptime tidak menghapus uptime heartbeat yang sudah tersimpan.
    await tx.device.updateMany({
        where: { id: deviceId, deletedAt: null, OR: [{ lastDeviceTime: null }, { lastDeviceTime: { lt: deviceTime } }] },
        data: {
            lastDeviceTime: deviceTime,
            firmwareVersion: fw,
            batteryV: record.battery_v,
            rssi: record.rssi,
            ...(record.uptime_s !== undefined ? { uptimeS: BigInt(record.uptime_s) } : {}),
        },
    });
}

async function checkDevice(tx, deviceId) {
    const device = await tx.device.findFirst({
        where: { id: deviceId, deletedAt: null }, select: { id: true, status: true },
    });
    if (!device || device.status === "DECOMMISSIONED") {
        const error = new Error("Device tidak tersedia untuk ingestion.");
        error.status = device ? 403 : 404;
        error.code = device ? "DEVICE_DECOMMISSIONED" : "DEVICE_NOT_FOUND";
        throw error;
    }
}

export async function ingestTelemetry(deviceId, fw, entries, serverTime) {
    const results = [];
    // Maksimal 100 payload per transaksi (hingga 3.200 row). Bulk insert mengurangi
    // round-trip DB tanpa broker/worker. Setiap chunk commit sendiri agar transaksi pendek.
    for (let start = 0; start < entries.length; start += 100) {
        const chunk = entries.slice(start, start + 100);
        // Serializable menjaga pemasangan/kalibrasi dan penyimpanan konsisten.
        // Konflik sementara diulang maksimal 3 kali; tidak memakai retry tanpa batas.
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                const chunkResults = await prisma.$transaction(async (tx) => {
                    await checkDevice(tx, deviceId);
                    const installations = await tx.sensorInstallation.findMany({
                        where: { deviceId },
                        include: {
                            sensor: {
                                include: {
                                    sensorType: true,
                                    calibrations: { orderBy: [{ effectiveFrom: "desc" }, { id: "desc" }] },
                                },
                            },
                        },
                    });
                    const prepared = [];
                    const rejected = [];
                    for (const entry of chunk) {
                        try {
                            prepared.push({ index: entry.index, ...prepareRecord(entry.record, installations, serverTime) });
                        } catch (error) {
                            if (error.status !== 422) throw error;
                            rejected.push({ index: entry.index, status: "rejected", code: error.code, error: error.message, field: error.field });
                        }
                    }

                    const rows = prepared.flatMap((entry) => entry.rows);
                    // Unique(installationId, deviceTime) adalah pengaman dedup di DB.
                    // seq tidak dijadikan key karena reset ketika device reboot.
                    // First-write-wins: replay tidak mengubah raw atau kalibrasi lama.
                    const inserted = rows.length ? await tx.sensorReading.createManyAndReturn({
                        data: rows,
                        skipDuplicates: true,
                        select: { installationId: true, deviceTime: true },
                    }) : [];
                    const insertedKeys = new Set(inserted.map(readingKey));
                    const accepted = prepared.map((entry) => {
                        let acceptedReadings = 0;
                        const qualityFlags = [];
                        for (const row of entry.rows) {
                            if (insertedKeys.delete(readingKey(row))) {
                                acceptedReadings++;
                                qualityFlags.push(row.qualityFlag);
                            }
                        }
                        return {
                            index: entry.index,
                            ts: entry.record.ts,
                            status: acceptedReadings || !entry.rows.length ? "accepted" : "duplicate",
                            accepted_readings: acceptedReadings,
                            duplicate_readings: entry.rows.length - acceptedReadings,
                            // Flag dipaparkan agar device/reviewer tahu nilai abnormal tetap diterima.
                            quality_flags: qualityFlags,
                        };
                    });

                    if (prepared.length) {
                        const newest = prepared.reduce((latest, entry) => entry.deviceTime > latest.deviceTime ? entry : latest);
                        await updateDeviceHealth(tx, deviceId, fw, newest.record, serverTime);
                    }
                    return [...accepted, ...rejected];
                }, { isolationLevel: "Serializable", timeout: 15_000 });
                results.push(...chunkResults);
                break;
            } catch (error) {
                if (error.code !== "P2034" || attempt === 2) throw error;
            }
        }
    }
    // Bila DB down setelah chunk awal commit, response gagal (bukan ACK sukses).
    // Device perlu retry batch; unique key membuat chunk yang sudah commit aman diulang.
    return results.sort((a, b) => a.index - b.index);
}

export async function ingestHeartbeat(deviceId, payload, serverTime) {
    const deviceTime = validateDeviceTime(payload.ts, serverTime);
    await prisma.$transaction(async (tx) => {
        await checkDevice(tx, deviceId);
        await updateDeviceHealth(tx, deviceId, payload.fw, payload, serverTime);
    }, { isolationLevel: "Serializable" });
    // Tidak mengembalikan BigInt Prisma secara langsung karena JSON tidak mendukungnya.
    // Heartbeat tidak membuat sensor_reading dan tidak mengubah status lifecycle.
    return { device_id: payload.device_id, device_time: deviceTime, received_at: serverTime };
}
