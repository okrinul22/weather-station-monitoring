import sendResponse from "../utils/response.js";

export function getHealth(req, res) {
    return sendResponse(res, {
        status: 200,
        code: "OK",
        data: { status: "ok" },
    });
}


