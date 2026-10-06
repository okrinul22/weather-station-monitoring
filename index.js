import express from "express";
import { pathToFileURL } from "node:url";
import sendResponse from "./utils/response.js";
import healthRoutes from "./routes/healthRoutes.js";
import swaggerUi from "swagger-ui-express";
import openapi from "./docs/openapi.js";

const app = express();
const PORT = 3000;

app.use(express.json());

app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(openapi)
);

app.use("/health", healthRoutes);

app.use((req, res) => {
    return sendResponse(res, {
        status: 404,
        code: "NOT_FOUND",
        error: "Endpoint tidak ditemukan.",
    });
});

app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);

    if (err.type === "entity.parse.failed") {
        return sendResponse(res, {
            status: 400,
            code: "INVALID_JSON",
            error: "Format JSON tidak valid.",
        });
    }

    console.error(err);
    return sendResponse(res, {
        status: 500,
        code: "INTERNAL_SERVER_ERROR",
        error: "Terjadi kesalahan pada server.",
    });
});

// Jalankan server hanya ketika file ini dipanggil langsung: node index.js.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    app.listen(PORT, () => {
        console.log(`Server berjalan di http://localhost:${PORT}`);
    });
}

export default app;
