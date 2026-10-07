import sendResponse from "../utils/response.js";

const windows = new Map();
const WINDOW_MS = 60_000;

// Untuk satu proses Node, Map cukup mudah dipahami dan tidak perlu Redis.
// Saat backend memakai banyak instance, limiter ini perlu diganti shared store.
export function ingestRateLimit(keyForRequest, maximum) {
    return (req, res, next) => {
        const now = Date.now();
        // Bersihkan key kedaluwarsa agar Map tidak tumbuh tanpa batas.
        for (const [key, value] of windows) {
            if (value.expiresAt <= now) windows.delete(key);
        }
        const key = keyForRequest(req);
        let window = windows.get(key);
        if (!window) {
            window = { count: 0, expiresAt: now + WINDOW_MS };
            windows.set(key, window);
        }
        window.count++;
        if (window.count > maximum) {
            res.set("Retry-After", String(Math.ceil((window.expiresAt - now) / 1000)));
            return sendResponse(res, {
                status: 429, code: "RATE_LIMIT_EXCEEDED",
                error: "Batas request ingestion tercapai. Coba lagi setelah Retry-After.",
            });
        }
        next();
    };
}
