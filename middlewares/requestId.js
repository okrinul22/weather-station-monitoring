import { randomUUID } from "node:crypto";

export default function requestId(req, res, next) {
    // ID dibuat server agar tracing tidak bergantung pada input pengguna.
    res.locals.requestId = randomUUID();
    res.locals.receivedAt = new Date();
    res.set("X-Request-Id", res.locals.requestId);
    next();
}
