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
