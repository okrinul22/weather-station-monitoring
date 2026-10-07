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
cd /Users/okri/dev/py/simulator
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

Mode yang dipilih berlaku untuk semua device. Ganti base URL sesuai backend.
Hentikan dengan **Ctrl+C**.
