import { z } from "zod";

// Firmware memakai epoch detik. Batas ini juga mencegah Date tidak valid.
const timestamp = z.number().int().min(0).max(4102444800);
const battery = z.number().min(0).max(999.99).multipleOf(0.01);
const rssi = z.number().int().min(-200).max(0);

const readings = z.array(z.strictObject({
    s: z.string().min(1).max(50),
    // Batas penyimpanan Decimal(12,4), bukan rentang fisik sensor.
    // Nilai seperti humidity 150 tetap lolos agar disimpan dengan quality flag.
    v: z.number().min(-99999999.9999).max(99999999.9999).multipleOf(0.0001),
})).max(32).refine((items) => new Set(items.map((item) => item.s)).size === items.length, {
    message: "Satu payload tidak boleh mengulang kode sensor yang sama.",
});

export const telemetryRecordSchema = z.strictObject({
    ts: timestamp,
    seq: z.number().int().min(0).max(2147483647),
    battery_v: battery,
    rssi,
    readings,
});

export const telemetrySchema = telemetryRecordSchema.extend({
    device_id: z.string().min(1).max(50),
    fw: z.string().min(1).max(50),
});

export const telemetryBatchSchema = z.strictObject({
    device_id: z.string().min(1).max(50),
    fw: z.string().min(1).max(50),
    // Validasi isi satu per satu di controller agar satu record rusak
    // tidak membatalkan record lain. Lebih dari 500 ditolak sebelum insert.
    batch: z.array(z.unknown()).min(1).max(500),
});

export const heartbeatSchema = z.strictObject({
    device_id: z.string().min(1).max(50),
    ts: timestamp,
    fw: z.string().min(1).max(50),
    battery_v: battery,
    rssi,
    uptime_s: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
});
