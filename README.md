# Weather Station Monitoring

Project tes teknis monitoring stasiun cuaca. Saya memakai Node.js, Express, Prisma, dan PostgreSQL yang diinstal langsung di Windows. Fokus pengerjaan saya ada di backend dan penerimaan data device.

Alur: simulator/device → HTTP API → validasi dan kalibrasi → PostgreSQL.

## Cara menjalankan

Siapkan Node.js 22+, Python 3.11 untuk simulator, dan PostgreSQL di Windows. Buat database `weather_station` melalui pgAdmin atau Navicat, lalu salin `.env.example` menjadi `.env`:

```env
DATABASE_URL="postgresql://postgres:PASSWORD@HOST_WINDOWS:5432/weather_station?schema=public"
```

Dari folder project:

```bash
npm install
npm run db:deploy
npm run db:generate
npm run db:seed
npm start
```

API: `http://localhost:3000`. Dokumentasi endpoint: `http://localhost:3000/api-docs`.


Untuk simulator, salin `simulator/devices.example.json` menjadi `simulator/devices.json`. Isi `device_id` dengan kode device dari API dan `api_key` dengan key registrasi/rotasi. Key awal device demo adalah `demo-only-<device_code>` selama belum dirotasi.

```bash
cd simulator
python3.11 simulator.py --base-url http://localhost:3000 --interval 60 --mode normal
```

Mode offline, duplicate, dan heartbeat dijelaskan di [README simulator](simulator/README.md). Payload dan respons disimpan di folder `simulator/logs`.

## Yang sudah dibuat

- Pengelolaan device, sensor, dan tipe sensor: tambah, list, detail, update, soft delete.
- Rotasi API key, autentikasi device, rate limit, dan endpoint health device.
- Telemetry single/batch dan heartbeat, validasi, kalibrasi, quality flag, serta pencegahan reading duplikat.
- ERD, migration, seeder, Swagger, dan simulator Python.

## Yang belum selesai dan rencananya

- Pemasangan/lepas sensor dan penambahan kalibrasi lewat API: akan dibuat dengan menyimpan riwayat, bukan menimpa pemasangan lama.
- Agregasi dan API readings/summary/overview: tabel `reading_aggregate` sudah ada; saya akan membuat proses ringkasan per jam/hari dan menghitung ulang periode yang menerima data terlambat.
- Dashboard Next.js: akan menampilkan nilai terkini, grafik, status koneksi, serta form pengelolaan device/sensor.
- Login user dan hak akses admin: akan dipasang pada endpoint management. Saat ini autentikasi baru untuk ingestion device.
- Aturan perpindahan status device: riwayat sudah dicatat, tetapi pembatasan transisinya belum dibuat.
- Unit test: akan diprioritaskan untuk kalibrasi, quality flag, dedup, dan konversi rain counter termasuk reset.
- Diagram alur terpisah dan deployment satu perintah belum tersedia; saat ini backend dan PostgreSQL dijalankan manual.

## Dokumen

- [ERD](documentation/ERD_Weather_Monitoring.pdf) dan [sumber DBML](documentation/erd-weather.dbml)
- [Jawaban desain dan esai](documentation/JAWABAN.md)
