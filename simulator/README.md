# Weather Device Simulator

Isi `devices.json` dengan `device_id` dan `api_key` dari backend untuk 3 device.
API key dikirim lewat header `X-API-Key`.

Masuk ke folder:

```sh
cd /Users/okri/dev/py/simulator
```

## Normal — kirim periodik tiap 60 detik

```sh
python3.11 simulator.py --base-url http://localhost:8000 --interval 60 --mode normal
```

## Offline lalu batch

Offline 3 siklus, lalu kirim batch berisi 4 record pada siklus ke-4; berulang.

```sh
python3.11 simulator.py --base-url http://localhost:8000 --interval 60 --mode offline --offline-cycles 3
```

## Duplikat

Setiap payload dikirim dua kali dengan isi identik setelah request pertama sukses.

```sh
python3.11 simulator.py --base-url http://localhost:8000 --interval 60 --mode duplicate
```

Mode yang dipilih berlaku untuk semua device. Ganti base URL sesuai backend.
Hentikan dengan **Ctrl+C**.
