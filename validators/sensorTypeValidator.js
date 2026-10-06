import { z } from "zod";

// Query URL berupa string; terima angka bulat positif, lalu ubah ke number.
function positiveInteger(max, defaultValue) {
    return z.string()
        .regex(/^\d+$/, "Harus berupa angka bulat positif.")
        .transform(Number)
        .pipe(z.number().int().min(1).max(max))
        .default(defaultValue);
}

export const sensorListTypeQuerySchema = z.object({
    q: z.string().trim().max(100, "Pencarian maksimal 100 karakter.").default(""),
    page: positiveInteger(100000, 1),
    limit: positiveInteger(200, 10),
});

export const sensorTypeIdParamsSchema = z.object({
    id: z.uuid({ error: "ID tipe sensor harus berupa UUID yang valid." }),
});

// Decimal(12, 4): maksimal 8 digit sebelum koma dan 4 digit desimal.
const sensorRangeValue = z.number()
    .min(-99999999.9999, "Nilai di bawah batas penyimpanan database.")
    .max(99999999.9999, "Nilai melebihi batas penyimpanan database.")
    .multipleOf(0.0001, "Nilai maksimal memiliki 4 angka desimal.");

export const updateSensorTypeSchema = z.strictObject({
    code: z.string().trim().min(1, "Kode tidak boleh kosong.").max(50).optional(),
    name: z.string().trim().min(1, "Nama tidak boleh kosong.").max(100).optional(),
    unit: z.string().trim().min(1, "Satuan tidak boleh kosong.").max(30).optional(),
    valid_min: sensorRangeValue.optional(),
    valid_max: sensorRangeValue.optional(),
    precision: z.number().int().min(0).max(4).optional(),
}).refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "Kirim minimal satu field yang ingin diubah.",
}).refine((data) => data.valid_min === undefined || data.valid_max === undefined || data.valid_min < data.valid_max, {
    path: ["valid_max"],
    message: "valid_max harus lebih besar dari valid_min.",
});

export const createSensorTypeSchema = z.strictObject({
    code: z.string().trim().min(1, "Kode tipe sensor wajib diisi.").max(50, "Kode maksimal 50 karakter."),
    name: z.string().trim().min(1, "Nama tipe sensor wajib diisi.").max(100, "Nama maksimal 100 karakter."),
    unit: z.string().trim().min(1, "Satuan wajib diisi.").max(30, "Satuan maksimal 30 karakter."),
    valid_min: sensorRangeValue,
    valid_max: sensorRangeValue,
    precision: z.number().int("Presisi harus berupa bilangan bulat.").min(0).max(4),
}).refine((data) => data.valid_min < data.valid_max, {
    path: ["valid_max"],
    message: "valid_max harus lebih besar dari valid_min.",
});
export const sensorTypeCreateBodySchema = z.object({
    code: z.string().trim().min(1, "Kode tipe sensor tidak boleh kosong.").max(20, "Kode tipe sensor maksimal 20 karakter."),
    name: z.string().trim().min(1, "Nama tipe sensor tidak boleh kosong.").max(100, "Nama tipe sensor maksimal 100 karakter."),
    unit: z.string().trim().min(1, "Satuan tipe sensor tidak boleh kosong.").max(20, "Satuan tipe sensor maksimal 20 karakter."),
});
