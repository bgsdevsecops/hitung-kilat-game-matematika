# 🚀 Panduan Lengkap: Firebase Setup & Deployment ke Server

Dokumen ini menjelaskan langkah demi langkah cara mengonfigurasi **Firebase (Auth & Firestore)** serta cara men-deploy aplikasi **Hitung Kilat** ke berbagai platform hosting (Vercel, Netlify, Docker / VPS, atau Cloud Run).

---

## Bagian 1: Pengaturan Firebase di Firebase Console

Jika Anda ingin menghubungkan aplikasi ini ke proyek Firebase milik Anda sendiri di [Firebase Console](https://console.firebase.google.com/), ikuti langkah-langkah berikut:

### 1. Buat Proyek Firebase Baru
1. Buka [console.firebase.google.com](https://console.firebase.google.com/).
2. Klik **"Add project"** (Tambah proyek).
3. Beri nama proyek, misalnya `hitung-kilat-game`.
4. Nonaktifkan atau aktifkan Google Analytics (opsional, pilih nonaktifkan jika ingin cepat).
5. Klik **"Create project"**.

### 2. Daftarkan Web App & Ambil Konfigurasi
1. Pada halaman overview proyek, klik ikon **Web (`</>`)**.
2. Masukkan App nickname, misal `Hitung Kilat Web`.
3. Klik **"Register app"**.
4. Anda akan melihat objek `firebaseConfig`:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "hitung-kilat.firebaseapp.com",
     projectId: "hitung-kilat",
     storageBucket: "hitung-kilat.appspot.com",
     messagingSenderId: "...",
     appId: "..."
   };
   ```
5. Salin konfigurasi ini ke file `firebase-applet-config.json` di root proyek atau simpan di Environment Variables.

### 3. Aktifkan Firebase Authentication
1. Di menu sidebar kiri, klik **Build** > **Authentication**.
2. Klik **"Get started"**.
3. Di tab **Sign-in method**, aktifkan:
   - **Google**: Klik Google > Geser switch **Enable** > Pilih Support email > Klik **Save**.
   - **Anonymous (Tamu)**: Klik Anonymous > Geser switch **Enable** > Klik **Save** (memungkinkan user bermain tanpa login akun Google terlebih dahulu).

### 4. Buat Database Cloud Firestore
1. Di menu sidebar kiri, klik **Build** > **Firestore Database**.
2. Klik **"Create database"**.
3. Pilih lokasi database (misal `asia-southeast2` untuk Jakarta atau `asia-southeast1` untuk Singapura).
4. Pilih **"Start in production mode"**.
5. Masuk ke tab **Rules** dan tempel aturan keamanan berikut:
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       // Hanya pemilik data yang berhak membaca dan menulis dokumen progresnya
       match /users/{userId} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
     }
   }
   ```
6. Klik **Publish**.

---

## Bagian 2: Cara Kerja Sinkronisasi di Aplikasi

- **Offline-First**: Aplikasi tetap berjalan normal menggunakan `localStorage` tanpa internet ataupun tanpa login.
- **Login Google & Tamu (Guest)**: Tombol **Cloud / Tersimpan** di pojok kanan atas membuka modal akun.
- **Smart Merge Algorithm**: Saat user login di perangkat baru:
  - Level tertinggi yang terbuka digabungkan (`Math.max`).
  - Bintang level dan skor terbaik tidak akan hilang atau tertimpa data kosong.
  - Akurasi 7 hari dan streak harian disinkronkan secara mulus.
  - Setiap kali pemain menyelesaikan level atau tantangan, progres otomatis dikirim ke Cloud Firestore.

---

## Bagian 3: Pilihan Deployment ke Server

### Opsi A: Deploy ke Vercel (Paling Mudah & Gratis)
1. Push kode ke GitHub / GitLab.
2. Buka [vercel.com](https://vercel.com/) dan buat akun.
3. Klik **"Add New..."** > **"Project"** > Hubungkan repositori GitHub Anda.
4. Framework Preset akan otomatis terdeteksi sebagai **Vite**.
5. Build Command: `npm run build`
6. Output Directory: `dist`
7. Klik **"Deploy"**. Selesai dalam 1 menit!
8. *Catatan Firebase Auth*: Di Firebase Console > Authentication > Settings > **Authorized domains**, tambahkan domain Vercel Anda (misal `hitung-kilat.vercel.app`).

---

### Opsi B: Deploy ke Netlify (Gratis)
1. Buka [netlify.com](https://netlify.com/) dan hubungkan repositori Anda.
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Pastikan file `public/_redirects` berisi `/*  /index.html  200` agar URL SPA bekerja dengan baik saat di-refresh.
5. Tambahkan domain Netlify ke **Authorized domains** di Firebase Console.

---

### Opsi C: Deploy dengan Docker & Nginx (VPS / Cloud Server Pribadi)
Aplikasi ini sudah dilengkapi dengan `Dockerfile`, `nginx.conf`, dan `docker-compose.yml`.

1. Jalankan di VPS atau server lokal:
   ```bash
   docker compose up -d --build
   ```
2. Aplikasi otomatis berjalan di port `80` (atau port yang ditentukan di `docker-compose.yml`) dengan Nginx melayani file build statis dengan kompresi gzip dan caching optimal.

---

### Opsi D: Deploy ke Google Cloud Run
1. Buat image container:
   ```bash
   gcloud builds submit --tag gcr.io/[PROJECT-ID]/hitung-kilat
   ```
2. Deploy ke Cloud Run:
   ```bash
   gcloud run deploy hitung-kilat \
     --image gcr.io/[PROJECT-ID]/hitung-kilat \
     --platform managed \
     --region asia-southeast2 \
     --allow-unauthenticated \
     --port 80
   ```
