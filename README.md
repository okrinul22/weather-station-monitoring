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
- Seeder dan data historis tujuh hari.
- Device simulator.
- Unit test.
- Dokumentasi REST API.
- File sumber ERD `.dbml`.
- Diagram alur data dan file sumbernya.
- Docker Compose.
- Frontend Next.js.

Project masih dalam tahap pengembangan.
