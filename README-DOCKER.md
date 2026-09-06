# Panduan Menjalankan Hitung Kilat dengan Docker Compose

Aplikasi **Hitung Kilat** telah dikonfigurasi dengan multi-stage Docker build menggunakan **Node 20 (Alpine)** untuk tahap build dan **Nginx (Alpine)** untuk web server production yang sangat ringan dan cepat.

---

## Prasyarat
- [Docker](https://docs.docker.com/get-docker/) & [Docker Compose](https://docs.docker.com/compose/) sudah terpasang di komputer/server Anda.

---

## Cara Menjalankan di Lokal (Testing)

### 1. Build dan Jalankan Container
Jalankan perintah berikut di direktori proyek:

```bash
docker compose up -d --build
```

> Flag `-d` menjalankan container di background (detached mode), dan `--build` memastikan image dibangun ulang dengan kode terbaru.

### 2. Akses Aplikasi di Browser
Buka browser dan kunjungi:
```
http://localhost:3000
```
*(atau alamat IP host Anda, misalnya `http://192.168.1.x:3000`)*

---

## Perintah Penting Lainnya

### Melihat Log Container
Untuk memantau log aktivitas server Nginx secara real-time:
```bash
docker compose logs -f hitung-kilat
```

### Memeriksa Status Container & Healthcheck
```bash
docker compose ps
```

### Menghentikan Aplikasi
```bash
docker compose down
```

---

## Kustomisasi Port (Opsional)
Secara default, port host diarahkan ke **3000** (`"3000:80"`). Jika ingin menggunakan port 80 langsung (port HTTP standar) atau port lain (misal 8080), Anda dapat mengedit bagian `ports` di file `docker-compose.yml`:

```yaml
ports:
  - "80:80"      # Akses langsung via http://localhost
  # atau
  - "8080:80"    # Akses via http://localhost:8080
```
Lalu jalankan `docker compose up -d` kembali.
