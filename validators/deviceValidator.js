import { z } from "zod";

// Query URL berupa string; terima angka bulat positif, lalu ubah ke number.
function positiveInteger(max, defaultValue) {
    return z.string()
        .regex(/^\d+$/, "Harus berupa angka bulat positif.")
        .transform(Number)
        .pipe(z.number().int().min(1).max(max))
        .default(defaultValue);
}

export const deviceListQuerySchema = z.object({
    status: z.enum(["ACTIVE", "MAINTENANCE", "DECOMMISSIONED"]).optional(),
    location_id: z.uuid({ error: "location_id harus berupa UUID yang valid." }).optional(),
    q: z.string().trim().max(100, "Pencarian maksimal 100 karakter.").default(""),
    page: positiveInteger(100000, 1),
    limit: positiveInteger(200, 10),
});

export const deviceIdParamsSchema = z.object({
    id: z.uuid({
        error: "ID device harus berupa UUID yang valid.",
    }),
});

export const createDeviceSchema = z.strictObject({
    device_code: z.string().trim().min(1, "Kode device wajib diisi.").max(50, "Kode device maksimal 50 karakter."),
    name: z.string().trim().min(1, "Nama device wajib diisi.").max(150, "Nama device maksimal 150 karakter."),
    location_id: z.uuid({ error: "location_id harus berupa UUID yang valid." }),
    status: z.enum(["ACTIVE", "MAINTENANCE", "DECOMMISSIONED"]).default("ACTIVE"),
});

export const updateDeviceSchema = z.strictObject({
    device_code: z.string().trim().min(1, "Kode device tidak boleh kosong.").max(50).optional(),
    name: z.string().trim().min(1, "Nama device tidak boleh kosong.").max(150).optional(),
    location_id: z.uuid({ error: "location_id harus berupa UUID yang valid." }).optional(),
    status: z.enum(["ACTIVE", "MAINTENANCE", "DECOMMISSIONED"]).optional(),
}).refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "Kirim minimal satu field yang ingin diubah.",
});
