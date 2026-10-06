# Jawaban Esai Singkat

Jawaban mengikuti desain project PostgreSQL; fitur yang disebut sebagai rencana belum seluruhnya diimplementasikan.

## 1. Kenapa data time-series sebaiknya tidak di-UPDATE dan lebih baik append-only?

Data sensor mencatat kejadian pada waktu tertentu, sehingga nilai mentah perlu dipertahankan untuk audit.
Menimpa nilai lama akan menghilangkan bukti data yang dikirim device.
Saya menyimpan nilai mentah, hasil koreksi, dan referensi kalibrasi agar hasilnya dapat ditelusuri.
Perubahan kalibrasi tidak otomatis mengubah data lama; koreksi historis dapat dicatat sebagai versi terpisah.
Append-only berlaku pada pembacaan, sementara metadata device dan aggregate tetap boleh diperbarui.

## 2. Apa itu hypertable dan continuous aggregate di TimescaleDB, dan bagaimana mencapai efek yang sama dengan PostgreSQL biasa?

Hypertable membagi tabel time-series secara otomatis menjadi bagian berdasarkan waktu, seperti dijelaskan dalam [dokumentasi TimescaleDB](https://www.tigerdata.com/docs/learn/hypertables/understand-hypertables).
Continuous aggregate menyimpan ringkasan dan memperbarui bagian yang terdampak perubahan data, sesuai [dokumentasi agregasi](https://www.tigerdata.com/learn/continuous-aggregates-timescaledb).
Project ini memakai PostgreSQL biasa, dengan rencana partisi bulanan berdasarkan `device_time` saat volume meningkat.
Worker terjadwal dapat mengisi `reading_aggregate` dan menghitung ulang periode yang menerima data terlambat.
Pendekatan ini menghindari extension tambahan, tetapi partisi dan proses agregasinya harus dikelola sendiri.

## 3. Apa perbedaan menghitung rata-rata arah angin dengan rata-rata suhu, dan bagaimana cara yang benar?

Suhu memakai rata-rata aritmetika, sedangkan arah angin bersifat melingkar karena 0° dan 360° menunjukkan arah yang sama.
Rata-rata arah 350° dan 10° seharusnya sekitar 0°, bukan 180°.
Saya mengubah sudut ke radian, lalu merata-ratakan komponen `cos(θ)` dan `sin(θ)`.
Hasilnya dihitung dengan `atan2(rata_rata_sin, rata_rata_cos)` dan dikonversi ke derajat dalam rentang 0° hingga kurang dari 360°.
Jika vektor hasil hampir nol, arah rata-rata tidak dapat ditentukan dengan baik dan tidak boleh dipaksakan menjadi 0°.

## 4. Bandingkan insert satu per satu dengan bulk insert/batching untuk 50 device × 7 sensor tiap menit.

Dengan satu baris per sensor, 50 device × 7 sensor menghasilkan 350 baris per menit.
Insert satu per satu membutuhkan banyak perjalanan komunikasi dan, jika transaksinya terpisah, banyak commit.
Batching menggabungkan baris dalam lebih sedikit perintah, sehingga mengurangi biaya tersebut seperti dijelaskan dalam [dokumentasi PostgreSQL](https://www.postgresql.org/docs/14/populate.html).
Sebagai ilustrasi, pada latensi 5 ms, komunikasi untuk 350 insert berurutan memerlukan sekitar 1,75 detik, sedangkan satu batch hanya membutuhkan satu perjalanan.
Saya merencanakan `createMany` dengan batch terbatas, tetapi peningkatan kinerja sebenarnya harus diuji karena penulisan data dan index tetap membutuhkan waktu.

## 5. Index apa yang dibuat di sensor_reading, bagaimana urutan kolomnya, dan kenapa urutan itu penting?

Schema memiliki primary key `id`, unique index `(installation_id, device_time)`, serta index pada `device_time` dan `server_time`.
Unique index mencegah pembacaan duplikat pada pemasangan dan waktu yang sama.
Urutan pemasangan lalu waktu cocok untuk query yang menyaring satu pemasangan kemudian rentang waktu, sesuai prinsip [multicolumn index](https://www.postgresql.org/docs/14/indexes-multicolumn.html).
Index `device_time` membantu pencarian berdasarkan waktu pengukuran, sedangkan `server_time` membantu pemeriksaan waktu penerimaan.
Saya akan menggunakan `EXPLAIN ANALYZE` untuk mengevaluasi manfaat index karena setiap index menambah ruang penyimpanan dan pekerjaan saat insert.

## 6. Bagaimana mendeteksi sensor macet yang mengirim nilai identik selama enam jam?

Saya akan memeriksa apakah nilai mentah sensor tetap sama selama enam jam berdasarkan `device_time`.
Jumlah sampel dan jeda pengiriman harus sesuai interval normal agar sedikit data tidak dianggap sebagai sensor macet.
Heartbeat membantu memastikan device masih mengirim data.
Aturan disesuaikan dengan tipe sensor karena rain counter yang tetap saat tidak hujan merupakan kondisi normal.
Hasilnya ditandai sebagai dugaan gangguan untuk diperiksa, tanpa menghapus pembacaan mentah.

## 7. Di lapisan mana logika alert curah hujan >20 mm/jam ditempatkan, dan kenapa?

Saya akan menempatkan logika alert di service backend atau worker agar tetap berjalan tanpa dashboard dibuka.
Curah hujan dihitung dari selisih counter × 0,2 mm, dengan penanganan reset agar hasil tidak negatif.
Untuk MVP, batas 20 mm diperiksa per jam kalender, dengan identitas alert unik per device dan periode agar tidak berulang.
Data terlambat memicu perhitungan ulang periode terkait dan pemeriksaan alert kembali.
Pengiriman notifikasi dipisahkan dari transaksi ingestion agar kegagalannya tidak menggagalkan penyimpanan data.

## 8. Apa risiko keamanan endpoint ingestion yang terbuka ke internet, dan bagaimana mitigasinya?

Risikonya mencakup pemalsuan device, pencurian kredensial, payload berbahaya, dan banjir request.
Saya merencanakan HTTPS, API key per device yang disimpan sebagai hash, serta pemeriksaan kesesuaian identitas payload dengan kredensial.
Key dapat dirotasi atau dicabut, dan secret tidak boleh dicatat dalam log.
Validasi payload, batas ukuran batch, query terparameterisasi, dan rate limiting per device serta IP membatasi penyalahgunaan.
Unique key mencegah data duplikat, sedangkan pembatasan pekerjaan bersamaan dan izin database minimum membatasi dampak serangan.
