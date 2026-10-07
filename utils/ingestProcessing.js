import { Prisma } from "../generated/prisma/index.js";

export function validateDeviceTime(ts, serverTime) {
    // Data lama boleh masuk (buffered). Jam maju >5 menit ditolak agar
    // pembacaan dari masa depan tidak merusak chart dan lastDeviceTime.
    const deviceTime = new Date(ts * 1000);
    if (deviceTime.getTime() > serverTime.getTime() + 5 * 60 * 1000) {
        const error = new Error("ts lebih dari 5 menit di masa depan. Periksa jam device.");
        error.status = 422;
        error.code = "DEVICE_TIME_IN_FUTURE";
        error.field = "ts";
        throw error;
    }
    return deviceTime;
}

export function correctReading(reading, type, calibration) {
    const rawValue = new Prisma.Decimal(reading.v);
    const scale = calibration?.scale ?? new Prisma.Decimal(1);
    const offset = calibration?.offset ?? new Prisma.Decimal(0);
    const correctedValue = rawValue.mul(scale).plus(offset).toDecimalPlaces(4);
    if (correctedValue.abs().gt("99999999.9999")) {
        const error = new Error("Hasil kalibrasi melebihi kapasitas Decimal(12,4).");
        error.status = 422;
        error.code = "CORRECTED_VALUE_TOO_LARGE";
        error.field = "readings";
        throw error;
    }

    let qualityFlag = "GOOD";
    // -999 adalah kode error suhu pada kasus PDF, bukan suhu sebenarnya.
    // Tetap simpan nilai mentahnya supaya kegagalan sensor bisa diaudit.
    if ((type.code === "temp_air" && reading.v === -999) ||
        (type.code === "rain_counter" && (reading.v < 0 || !Number.isInteger(reading.v)))) {
        qualityFlag = "INVALID";
    } else if (correctedValue.lt(type.validMin) || correctedValue.gt(type.validMax) ||
        (type.code === "wind_dir" && (correctedValue.lt(0) || correctedValue.gte(360)))) {
        qualityFlag = "OUT_OF_RANGE";
    }
    return { rawValue, correctedValue, qualityFlag };
}

export function rainCounterToMm(previous, current) {
    // Ini fungsi untuk query/agregasi berikutnya, bukan mengganti raw counter.
    // Counter turun dianggap reset: gunakan nilai sejak reboot, bukan selisih minus.
    // Sampel pertama belum punya pembanding sehingga hasilnya null, bukan total counter.
    if (previous === null || previous === undefined) return null;
    const before = new Prisma.Decimal(previous);
    const now = new Prisma.Decimal(current);
    const delta = now.lt(before) ? now : now.minus(before);
    return delta.mul("0.2");
}
