
## A. Device Management

### 1. Apa yang terjadi pada data historis saat device di-decommission?

Data historis tetap disimpan; decommission hanya menghentikan penerimaan data baru.
ketika device diset decommission API akan mennghasilkan status 403
dengan response seperti ini
2026-10-07 11:08:58,539 WIB WARNING DEMO-WS-BDG-002 POST /api/v1/ingest/telemetry HTTP 403
Response:
{
  "code": "DEVICE_DECOMMISSIONED",
  "data": null,
  "error": "Device decommissioned tidak boleh mengirim data.",
  "timestamp": "2026-10-07T04:08:58.538Z",
  "request_id": "9dbb1174-8947-4c2c-9bee-2d26bfd1f971"
}

### 2. Bagaimana membedakan device mati dan jaringan putus?

Saya melihat last_seen_at dari telemetry atau heartbeat untuk mengetahui kapan device terakhir terhubung. Jika kiriman berhenti, penyebabnya belum bisa dipastikan: device bisa mati atau jaringan putus. Setelah terhubung lagi, data buffered dan uptime_s membantu menilai apakah device tetap berjalan atau sempat restart; baterai dan RSSI menjadi petunjuk tambahan.

## B. Sensor Management

### 1. Sensor dipindah dari A ke B pada 1 Juni: bagaimana data lama tetap milik A?

secara database saya sudah buat dengan field removeAt dan installed at sehinnga data sebelum pemindahan itu dicocokan dengan periode installed_at ≤ device_time < removed_at, ketika sudah cocok baru  data tersebut di taruh di sensor reading berdasarkan installation id yang sudah di validasi

### 2. Kalibrasi diubah hari ini: apakah data lama ikut berubah?

Tidak;
setiap pembacaan menyimpan raw_value, corrected_value, dan calibration_id yang berlaku saat pengukuran.


## C. ERD dan Pertumbuhan Data

### 1. Tabel mana paling cepat tumbuh, dan berapa baris per tahun?

sensor_reading
 tumbuh paling cepat karena satu pembacaan sensor menjadi satu baris. Dengan perkiraan data 1 tahun 183.960.000 baris

### 2. Strategi pertumbuhan dan trade-off-nya?

Saya memilih downsampling melalui tabel `reading_aggregate` untuk menyimpan ringkasan data per jam atau hari. Tujuannya agar grafik dengan rentang panjang tidak perlu membaca seluruh data mentah. Trade-off-nya, ringkasan tidak menampilkan detail setiap pengukuran dan perlu dihitung ulang jika ada data terlambat. Tabelnya sudah dibuat, tetapi proses agregasinya belum sempat saya selesaikan. Cara ini membantu query, tetapi tidak mengurangi jumlah data mentah yang disimpan.

### 3. Mengapa memilih narrow/long dibanding wide?

Saya memilih narrow/long, yaitu satu baris untuk satu pembacaan sensor.
Format ini memudahkan penambahan tipe sensor tanpa menambah kolom dan pencatatan kalibrasi tiap sensor.
 Dibanding wide, jumlah barisnya lebih banyak dan perlu query tambahan karena data disimpan dalam bentuk json yang cukup rumit untuk di query



## D. Alur Data Device → Database

ada di file data documentation/Data Flow Diagram Weather Station Monitoring.drawio.pdf

### 1. Bagaimana menjamin idempotensi?

Saya menggunakan skipDuplicates: true saat insert melalui Prisma, dengan unique constraint pada (installation_id, device_time atau ts di payload). Jadi, ketika device mengirim ulang data yang sama, reading yang sudah tersimpan dilewati dan tidak menjadi dobel.

### 2. Bagaimana menangani 180 record terlambat dan tidak berurutan?

Data diterima lewat batch dan diproses berdasarkan device_time, jadi tetap sesuai waktu pengukuran meskipun datang terlambat atau tidak berurutan. Agregat yang terdampak perlu dihitung ulang, tetapi bagian ini belum selesai saya kerjakan.

### 3. Bagaimana menangani backpressure saat device mengirim bersamaan?
Saya memakai bulk insert per 100 record dan rate limit agar request yang masuk tetap dibatasi. Ini membantu mengurangi beban database saat banyak device mengirim bersamaan.

### 4. Apa perbedaan device_time dan server_time, serta penanganan clock drift?


### 5. Di mana konversi UTC → WIB dilakukan?

konversi dilakukan di frontend , tapi untuk saat frontend belum diselasaikan

### 6. Apa yang terjadi jika database down?

Backend mengembalikan error, lalu device menyimpan data di buffer dan mencoba mengirim ulang. Data yang sudah masuk tidak menjadi dobel karena ada unique constraint dan skipDuplicates

## E. API: Endpoint dan Response

### 1. Bagaimana mencegah response readings membengkak untuk rentang satu tahun?

Saya merencanakan penggunaan data agregat harian dan batas jumlah hasil agar respons satu tahun tidak berisi seluruh reading mentah. Tabel `reading_aggregate` sudah dibuat, tetapi proses agregasi dan endpoint query-nya belum selesai saya kerjakan.

### 2. Apakah autentikasi device dan user dashboard sama?

beda
rencana saya user menggunakan bearer token dan device menggunakan x-api-key

### 3. Bagaimana rancangan rate limiting ingestion dan response-nya?




# Jawaban Esai Singkat

Jawaban mengikuti desain project PostgreSQL; fitur yang disebut sebagai rencana belum seluruhnya diimplementasikan.

## 1. Kenapa data time-series sebaiknya tidak di-UPDATE dan lebih baik append-only?

Data time-series mencatat kondisi sensor pada waktu tertentu. Saya memilih append-only agar nilai asli tetap tersimpan untuk audit dan tidak hilang karena ditimpa. Jika ada perubahan kalibrasi, reading lama tetap dipertahankan sehingga hasil sebelumnya bisa ditelusuri.

## 2. Apa itu hypertable dan continuous aggregate di TimescaleDB, dan bagaimana mencapai efek yang sama dengan PostgreSQL biasa?

saya belum paham penggunaan timescaleDB dan hypertable

## 3. Apa perbedaan menghitung rata-rata arah angin dengan rata-rata suhu, dan bagaimana cara yang benar?

## 4. Bandingkan insert satu per satu dengan bulk insert/batching untuk 50 device × 7 sensor tiap menit.

50 device × 7 sensor menghasilkan 350 reading per menit. Insert satu per satu membutuhkan 350 operasi insert, sedangkan bulk insert menggabungkan banyak reading dalam lebih sedikit operasi sehingga komunikasi ke database berkurang. Saya memakai batching agar penyimpanan lebih efisien.

## 5. Index apa yang dibuat di sensor_reading, bagaimana urutan kolomnya, dan kenapa urutan itu penting?

Schema memiliki primary key id, unique index (installation_id, device_time), serta index pada device_time dan server_time.

Unique index mencegah pembacaan duplikat pada pemasangan dan waktu yang sama.

## 6. Bagaimana mendeteksi sensor macet yang mengirim nilai identik selama enam jam?

Saya akan memeriksa apakah nilai mentah sensor tetap sama selama enam jam berdasarkan device_time.
Jumlah sampel dan jeda pengiriman harus sesuai interval normal agar sedikit data tidak dianggap sebagai sensor macet.
Heartbeat membantu memastikan device masih mengirim data.untuk hal diatas sudah dihandle di api telemetry dan heartbead

## 7. Di lapisan mana logika alert curah hujan >20 mm/jam ditempatkan, dan kenapa?



## 8. Apa risiko keamanan endpoint ingestion yang terbuka ke internet, dan bagaimana mitigasinya?
