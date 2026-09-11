# CANDRA Dashboard V8 — Mobile Sidebar, Logo & Notifikasi

Paket ini **khusus dashboard website**. Jangan ditempatkan di folder bot WhatsApp/Pterodactyl.

## Cara replace

1. Backup file `.env` dashboard lama.
2. Buka folder dashboard yang berisi `package.json`.
3. Upload dan ekstrak seluruh isi ZIP ini ke folder tersebut, lalu pilih **overwrite/replace**.
4. Pastikan `.env` lama tetap ada dan berisi koneksi Supabase yang benar.
5. Jalankan:

   ```bash
   npm install
   npm run build
   ```

6. Restart aplikasi dashboard dari panel hosting.

Tidak ada SQL tambahan untuk pembaruan ini.

## Perubahan utama

- Tombol hamburger di HP membuka sidebar dengan animasi geser.
- Sidebar mobile berisi semua menu sesuai role, status koneksi, dan logout.
- Logo CANDRA BOT baru dipakai di login, header, sidebar, favicon, dan ikon aplikasi.
- PWA manifest dan service worker sudah tersedia untuk pemasangan ke layar utama HP.
- Notifikasi transaksi tetap realtime dan hanya memakai satu koneksi pusat notifikasi.
- Jenis notifikasi bisa diaktifkan/nonaktifkan secara terpisah:
  - transaksi baru;
  - status berhasil;
  - status pending;
  - status gagal.
- Tersedia suara Lembut, Chime, Digital, Pop, Prioritas, atau Tanpa Suara.
- Volume dapat diatur dan suara dapat diuji langsung.
- Audio sendiri dapat diimpor dari HP (maksimal 1,5 MB).

## Lokasi pengaturan notifikasi

Masuk ke **Dashboard → Settings → Pusat notifikasi**.

Audio custom tersimpan pada browser/perangkat yang digunakan. Jika dashboard dibuka dari HP lain, pilih kembali file audionya pada HP tersebut.

## Memperbarui ikon di HP

Setelah dashboard baru online, hapus shortcut/aplikasi web CANDRA BOT yang lama dari HP, buka kembali dashboard melalui browser, lalu pilih **Tambahkan ke layar utama / Install app**. Ini memastikan ikon baru tidak tertahan cache versi lama.
