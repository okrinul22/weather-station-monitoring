# Weather Station Monitoring

Backend API untuk sistem monitoring stasiun cuaca. Project ini dibuat untuk Tes Teknis Fullstack Developer Luwes Inovasi Mandiri.

## Teknologi

- Node.js
- Express.js
- PostgreSQL
- Prisma ORM 7.10
- CommonJS

## Yang Sudah Dibuat

- Server Express sederhana.
- Endpoint `GET /` dengan response `Hello World`.
- Desain database dan ERD.
- Prisma schema untuk 10 entitas utama.
- Migration awal PostgreSQL.
- Seeder: 3 device demo, 7 tipe sensor, dan data historis 7 hari.

## Arsitektur

```text
Sensor fisik
    ↓
Firmware device
    ↓ HTTP
Express API
    ↓ Prisma ORM
PostgreSQL
    ↓ REST API
Next.js Dashboard
```

Backend akan menerima telemetry dan heartbeat dari device. Data divalidasi, dideduplikasi, dikalibrasi, kemudian disimpan sebagai data time-series dan aggregate.

## Persyaratan

- Node.js 22 atau lebih baru
- npm
- PostgreSQL
- Docker, jika PostgreSQL dijalankan melalui container

## Setup

### 1. Install dependency

```bash
npm install
```

### 2. Jalankan PostgreSQL dengan Docker

```bash
docker run \
  --name weather-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=weather_station \
  -p 5432:5432 \
  -d postgres:18-trixie
```

Jika container sudah pernah dibuat, jalankan kembali dengan:

```bash
docker start weather-postgres
```

### 3. Siapkan environment variable

```bash
cp .env.example .env
```

Nilai default untuk development:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/weather_station?schema=public"
```

Sesuaikan username, password, host, port, dan nama database dengan PostgreSQL yang digunakan. Jangan commit file `.env`.

### 4. Validasi Prisma schema

```bash
npm run prisma:validate
```

### 5. Jalankan migration

```bash
npm run db:deploy
```

### 6. Generate Prisma Client

```bash
npm run db:generate
```

### 7. Periksa status migration

```bash
npm run db:status
```

### 8. Jalankan backend

```bash
npm start
```

Server berjalan di:

```text
http://localhost:3000
```

## Endpoint Saat Ini

### Hello World

```http
GET /
```

Response:

```text
Hello World
```

Tes menggunakan curl:

```bash
curl http://localhost:3000/
```

## Database

Schema saat ini mempunyai 10 entitas utama:

- `users`
- `location`
- `device`
- `device_status_history`
- `sensor_type`
- `sensor`
- `sensor_installation`
- `sensor_calibration`
- `sensor_reading`
- `reading_aggregate`

Migration awal berada di:

```text
prisma/migrations/20261006000100_init/migration.sql
```

### Membuat migration baru

Setelah mengubah `prisma/schema.prisma`, jalankan:

```bash
npm run db:migrate -- --name nama_perubahan
```

Contoh:

```bash
npm run db:migrate -- --name add_sensor_status
```

`db:migrate` digunakan saat development untuk membuat migration. `db:deploy` digunakan untuk menjalankan migration yang sudah tersedia.

## Seeder (Data Awal)

Setelah PostgreSQL berjalan dan `DATABASE_URL` di `.env` sesuai, jalankan:

```bash
npm install
npm run db:deploy
npm run db:generate
npm run db:seed
```

Migration membuat struktur tabel, `db:generate` membuat Prisma Client, sedangkan seeder mengisi data contoh. Prisma 7 memerlukan seeder dijalankan secara eksplisit; migration tidak otomatis menjalankannya.

Kode seeder berada di `prisma/seed.js`. Perintahnya didaftarkan pada `prisma.config.ts` dan script `db:seed` di `package.json`. Koneksi memakai `.env` dan adapter PostgreSQL `@prisma/adapter-pg`.

Data yang dibuat pada database kosong:

| Data | Jumlah |
|---|---:|
| User operator demo | 1 |
| Lokasi demo Garut, Bandung, Tasikmalaya | 3 |
| Device dengan awalan `DEMO-WS-` | 3 |
| Riwayat status awal `ACTIVE` | 3 |
| Tipe sensor | 7 |
| Sensor, pemasangan, dan kalibrasi awal | Masing-masing 21 |
| Pembacaan per jam selama 7 hari | 3.528 |
| Aggregate harian per device dan tipe sensor | 147 |

Tipe sensor: `temp_air`, `humidity`, `pressure`, `wind_speed`, `wind_dir`, `rain_counter`, dan `solar_rad`. Satuan dan rentang valid merupakan asumsi demo. `rain_counter` adalah penghitung kumulatif, bukan curah hujan dalam mm; jumlah nilai counter pada aggregate bukan total curah hujan.

Periode data adalah 7 hari kalender UTC sebelum hari seeder dijalankan. Misalnya, jika dijalankan pada 6 Oktober UTC, pembacaan mencakup 29 September pukul 00:00 sampai 5 Oktober pukul 23:00 UTC. Timestamp disimpan dalam UTC.

Setiap device mempunyai 7 sensor dengan offset awal `0` dan scale `1`. Ada 21 pembacaan suhu `OUT_OF_RANGE` (satu per device per hari), tetap tersimpan bersama nilai mentahnya. Aggregate hanya memakai pembacaan `GOOD`.

Seeder tidak menghapus data atau memperbarui record yang sudah ada. `upsert`, ID tetap, dan `skipDuplicates` mencegah duplikasi saat dijalankan ulang pada hari UTC yang sama. Jika dijalankan pada hari berikutnya, periode bergeser dan data hari baru ditambahkan. Jangan gunakan seeder demo untuk memperbaiki aggregate setelah pembacaan diedit; record aggregate yang sudah ada dilewati.

User demo mempunyai email `operator.demo@example.com` dan password development `DemoWeather123!`. Password disimpan sebagai hash scrypt dengan salt acak, dalam format `scrypt$<salt>$<hash>`, bukan plaintext. Endpoint login belum tersedia; implementasi login nantinya harus memverifikasi format hash ini. Seeder tidak mengganti nama atau password user yang sudah ada dengan email tersebut. Riwayat status device yang baru dibuat mengacu ke user demo; riwayat yang sudah ada tetap dipertahankan.

API key demo adalah `demo-only-<device_code>`, misalnya `demo-only-DEMO-WS-GRT-001`, dan disimpan sebagai SHA-256. Ini hanya data contoh; autentikasi device belum diimplementasikan.

Pemeriksaan data dilakukan per record, bukan dengan melewati seluruh tabel jika tabel sudah terisi. User dicari berdasarkan email, device berdasarkan kode, tipe sensor berdasarkan kode, sensor berdasarkan nomor seri, sedangkan lokasi, pemasangan, dan kalibrasi demo menggunakan ID tetap. Jika record ditemukan, record dipakai tanpa diubah dan proses lanjut ke record berikutnya. Jika belum ditemukan, record dibuat. Dengan demikian, seed yang baru terisi sebagian bisa dilengkapi tanpa menghapus data lain.

Untuk memeriksa hasil di Navicat pada schema `public`:

```sql
SELECT device_code, name FROM device WHERE device_code LIKE 'DEMO-WS-%';
SELECT code, unit FROM sensor_type ORDER BY code;
SELECT quality_flag, COUNT(*) FROM sensor_reading GROUP BY quality_flag;
SELECT MIN(device_time), MAX(device_time), COUNT(*) FROM sensor_reading;
```

Jika muncul `P1001`, selesaikan koneksi PostgreSQL terlebih dahulu. Jika Prisma Client belum ditemukan, jalankan `npm run db:generate`.

## Keputusan Desain

- Device dan sensor menggunakan soft delete melalui `deleted_at` agar data historis tidak hilang.
- Riwayat pemasangan disimpan di `sensor_installation`, sehingga perpindahan sensor tidak mengubah data lama.
- Nilai asli disimpan di `raw_value`; hasil kalibrasi disimpan di `corrected_value`.
- Reading di luar rentang tetap disimpan dengan `quality_flag`.
- `device_time` dan `server_time` disimpan terpisah.
- Semua timestamp disimpan dalam UTC dan nantinya ditampilkan dalam zona waktu `Asia/Jakarta`.
- API key device disimpan sebagai hash, bukan plaintext.

## Dokumentasi

- [ERD Weather Station Monitoring](ERD_Weather_Monitoring.pdf)

## Struktur Project

```text
weather-station-monitoring/
├── prisma/
│   ├── migrations/
│   ├── seed.js
│   └── schema.prisma
├── .env.example
├── .gitignore
├── ERD_Weather_Monitoring.pdf
├── index.js
├── package.json
├── prisma.config.ts
└── README.md
```

## Yang Belum Selesai

- CRUD device dan sensor.
- Endpoint telemetry dan heartbeat.
- Autentikasi device dan user.
- Kalibrasi, quality flag, dan agregasi pada service layer.
- Device simulator.
- Unit test.
- Dokumentasi REST API.
- File sumber ERD `.dbml`.
- Diagram alur data dan file sumbernya.
- Docker Compose.
- Frontend Next.js.

Project masih dalam tahap pengembangan.
