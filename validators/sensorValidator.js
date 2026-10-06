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
