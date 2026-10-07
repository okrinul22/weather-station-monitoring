# Weather Device Simulator

Isi `devices.json` dengan `device_id` dan `api_key` dari backend untuk 3 device.
API key dikirim lewat header `X-API-Key`.

Payload dan response semua device disimpan dalam satu file per sesi:
`simulator/logs/log-YYYYMMDD-HHMMSS-microseconds.log`. Nama file dan timestamp
isi log memakai Asia/Jakarta (WIB). Lokasi file ditampilkan saat simulator mulai.
Terminal tetap menampilkan ringkasan status HTTP; file memuat JSON payload,
body response sukses/error (termasuk 401/422), atau keterangan jika koneksi gagal.
API key tidak dicatat, dan folder `logs/` diabaikan Git. Setiap menjalankan ulang
simulator membuat file baru; data langsung ditulis setelah tiap catatan log.

Masuk ke folder:

```sh
cd /home/ubuntu/weather-station-monitoring/simulator
```

## Normal — kirim periodik tiap 60 detik

```sh
python3.11 simulator.py --base-url http://localhost:3000 --interval 60 --mode normal
```

## Offline lalu batch

Offline 3 siklus, lalu kirim batch berisi 4 record pada siklus ke-4; berulang.

```sh
python3.11 simulator.py --base-url http://localhost:3000 --interval 60 --mode offline --offline-cycles 3
```

## Duplikat

Setiap payload dikirim dua kali dengan isi identik setelah request pertama sukses.

```sh
python3.11 simulator.py --base-url http://localhost:3000 --interval 60 --mode duplicate
```

## Heartbeat — kirim kondisi device tanpa reading sensor

```sh
python3.11 simulator.py --base-url http://localhost:3000 --interval 60 --mode heartbeat
```

Setiap device mengirim `POST /api/v1/ingest/heartbeat` setiap 60 detik, memakai
API key yang sama dari `devices.json`. Respons sukses adalah HTTP 200
`HEARTBEAT_ACCEPTED`. Backend memperbarui health di tabel `device`, termasuk
`last_seen_at` dan `uptime_s`; tidak membuat baris `sensor_reading`.

Contoh payload (ts dan uptime dibuat saat pengiriman):

```json
{
  "device_id": "DEMO-WS-GRT-001",
  "ts": 1791345263,
  "fw": "1.4.2",
  "battery_v": 3.9,
  "rssi": -70,
  "uptime_s": 60
}
```

`uptime_s` dihitung sejak device virtual dibuat oleh simulator, bukan uptime
Ubuntu. Nilai mulai sekitar 0 dan bertambah selama proses berjalan; menjalankan
ulang simulator meniru device boot ulang. Jika pengiriman gagal, siklus berikutnya
mengirim heartbeat baru. Payload dan respons dicatat di file log yang sama.

Untuk melihat hasilnya, panggil `GET /api/v1/devices/{id}/health` dengan UUID
device; field `uptimeS` ditampilkan sebagai string. Mode heartbeat ini hanya
mengirim health, sehingga tidak menambah telemetry pada siklus yang sama.

Mode yang dipilih berlaku untuk semua device. Untuk mode berbeda per device,
isi field `mode` di `devices.json` dengan normal/offline/duplicate/heartbeat dan
jalankan `--mode mixed` (default). Ganti base URL sesuai backend.
Hentikan dengan **Ctrl+C**.
