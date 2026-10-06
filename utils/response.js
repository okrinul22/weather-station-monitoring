// HTTP status mengatur status request; code menjelaskan hasil untuk aplikasi.
/*
Cara penggunaan di route/controller:
import sendResponse from "../utils/response.js";
Sesuaikan path import dengan lokasi file yang memanggil helper; sertakan .js.
Semua response memiliki code, data, error, dan timestamp UTC otomatis.
Field data dan error yang tidak diberikan akan menjadi null.
Contoh berikut adalah alternatif pemakaian, bukan dijalankan semuanya sekaligus.

200: berhasil mengambil atau memperbarui data.
return sendResponse(res, { status: 200, code: "OK", data: device });

201: gunakan setelah data baru berhasil disimpan.
return sendResponse(res, { status: 201, code: "DEVICE_CREATED", data: device });

207: batch memiliki hasil campuran; data dan error dapat sama-sama terisi.
return sendResponse(res, {
  status: 207,
  code: "BATCH_PARTIAL_SUCCESS",
  data: { accepted: 8, duplicates: 2, rejected: 1 },
  error: "Satu record gagal validasi; duplikat dilewati.",
});

400: request tidak valid, misalnya format JSON rusak.
return sendResponse(res, { status: 400, code: "BAD_REQUEST", error: "Request tidak valid." });

401: kredensial tidak tersedia atau salah.
return sendResponse(res, { status: 401, code: "UNAUTHORIZED", error: "API key tidak valid." });

403: identitas dikenali, tetapi tidak mempunyai izin.
return sendResponse(res, { status: 403, code: "FORBIDDEN", error: "Akses tidak diizinkan." });

404: endpoint atau data tidak ditemukan.
return sendResponse(res, { status: 404, code: "DEVICE_NOT_FOUND", error: "Device tidak ditemukan." });

409: request bertentangan dengan data yang sudah ada.
return sendResponse(res, { status: 409, code: "DEVICE_CODE_EXISTS", error: "Kode device sudah digunakan." });

422: payload bisa dibaca, tetapi nilainya gagal validasi.
return sendResponse(res, { status: 422, code: "VALIDATION_ERROR", error: "Nama device wajib diisi." });

429: gunakan setelah pemeriksaan rate limit menyatakan batas terlampaui.
res.set("Retry-After", "60"); // Lama menunggu dalam detik; sesuaikan dengan limiter.
return sendResponse(res, { status: 429, code: "RATE_LIMIT_EXCEEDED", error: "Coba lagi setelah 60 detik." });

500: kesalahan internal; jangan tampilkan detail sensitif kepada klien.
return sendResponse(res, { status: 500, code: "INTERNAL_SERVER_ERROR", error: "Terjadi kesalahan pada server." });
*/
function sendResponse(res, { status = 200, code = "OK", data = null, error = null } = {}) {
  return res.status(status).json({
    code,
    data,
    error,
    timestamp: new Date().toISOString(),
  });
}

export default sendResponse;
