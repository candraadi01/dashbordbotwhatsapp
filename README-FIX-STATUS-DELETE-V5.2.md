# Perbaikan Kritis Dashboard V5.2

Paket ini memperbaiki dua masalah:

- **Pembersihan database** tidak lagi gagal dengan pesan `DELETE requires a WHERE clause`.
- **Status transaksi** dapat diubah menjadi Pending, Berhasil, atau Gagal dari dashboard dan ditandai untuk disinkronkan ke bot WhatsApp.

## Langkah pemasangan wajib

1. Hentikan terminal dashboard.
2. Extract ZIP ke folder dashboard dan izinkan semua file ditimpa.
3. Jangan menimpa atau menghapus `.env.local` milik Anda.
4. Buka **Supabase > SQL Editor > New query**.
5. Salin seluruh isi file berikut lalu klik **Run**:

   ```text
   supabase/CRITICAL-FIX-STATUS-DELETE.sql
   ```

6. Hasil paling bawah harus menampilkan:

   ```text
   PERBAIKAN V5.2 BERHASIL
   fungsi_hapus = true
   fungsi_status = true
   ```

7. Jalankan dashboard:

   ```powershell
   npm install
   npm run build
   npm run dev
   ```

8. Di browser tekan `Ctrl + F5`, lalu logout dan login kembali.

## Pemeriksaan

- Buka **Settings > Pusat Pembersihan Data**, pilih target, ketik `HAPUS`, lalu tekan **Hapus permanen**.
- Buka **Transactions**, tekan **Status**, pilih status, lalu **Simpan dan sinkronkan**.
- Status baris berubah segera. Jika bot online, teks sinkronisasi berubah dari **Menunggu bot WhatsApp** menjadi **WhatsApp tersinkron**.
- Memilih status yang sama tetap dapat digunakan untuk mengirim ulang perintah sinkronisasi.

Pembersihan data hanya dapat digunakan akun `OWNER`. Perubahan status dapat digunakan akun `OWNER` atau `ADMIN`.
