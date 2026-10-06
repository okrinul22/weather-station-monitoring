import { z } from "zod";

// Query URL berupa string; terima angka bulat positif, lalu ubah ke number.
function positiveInteger(max, defaultValue) {
    return z.string()
        .regex(/^\d+$/, "Harus berupa angka bulat positif.")
        .transform(Number)
        .pipe(z.number().int().min(1).max(max))
        .default(defaultValue);
}

export const sensorListQuerySchema = z.object({
    q: z.string().trim().max(100, "Pencarian maksimal 100 karakter.").default(""),
    page: positiveInteger(100000, 1),
    limit: positiveInteger(200, 10),
});

export const sensorIdParamsSchema = z.object({
    id: z.uuid({ error: "ID sensor harus berupa UUID yang valid." }),
});

export const createsensorSchema = z.strictObject({
    name: z.string().trim().min(1, "Nama sensor wajib diisi.").max(150, "Nama sensor maksimal 150 karakter."),
    serial_number: z.string().trim().min(1, "Serial number sensor wajib diisi.").max(50, "Serial number sensor maksimal 50 karakter."),
    sensor_type_id: z.uuid({ error: "sensor_type_id harus berupa UUID yang valid." }),
});

export const updateSensorSchema = createsensorSchema.partial().refine(
    (data) => Object.values(data).some((value) => value !== undefined),
    { message: "Kirim minimal satu field yang ingin diubah." },
);
