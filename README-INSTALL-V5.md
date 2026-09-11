# CANDRA Dashboard V5.2 — Cara Replace

## Yang sudah diperbaiki

- Overview profesional dengan 4 KPI, grafik, status ringkas, dan filter Hari Ini/Kemarin/7 Hari/1–6 Bulan.
- Pembersihan transaksi/customer dipindahkan ke **Settings** dan hanya dapat dipakai OWNER.
- Customer memperoleh 10 poin setiap transaksi sukses.
- Admin dapat menambah, mengurangi, atau menukar poin di Customer CRM.
- Setiap 10 poin dapat ditukar menjadi saldo diskon Rp1.000 untuk transaksi berikutnya.
- Status transaksi hanya Pending/Berhasil/Gagal dan tersinkron dua arah dengan bot.
- Tampilan Customer CRM dan Transaction nyaman untuk ponsel.

## Urutan pemasangan

1. Backup folder dashboard lama dan file `.env.local`.
2. Extract ZIP ini ke folder dashboard. Timpa semua file lama, tetapi pertahankan `.env.local` Anda.
3. Buka Supabase → SQL Editor → New Query.
4. Salin seluruh isi `supabase/dashboard-v5-upgrade.sql`, lalu klik **Run**.
5. Jalankan seluruh isi `supabase/CRITICAL-FIX-STATUS-DELETE.sql`. Langkah ini wajib agar hapus data dan status transaksi berfungsi.
6. Jika daftar keuntungan belum pernah dipasang, jalankan juga `supabase/overview-maintenance-and-profit.sql` satu kali.
7. Di terminal folder dashboard jalankan:

   ```powershell
   npm install
   npm run build
   npm run dev
   ```

8. Setelah dashboard hidup, tekan `Ctrl + F5`, lalu logout dan login kembali.
9. Pastikan bot versi V5 di Pterodactyl sedang online.

## Catatan penting

- Jangan menghapus `.env.local` karena berisi koneksi Supabase dan Cloudinary.
- Jalankan SQL V5 **sebelum** menyalakan bot V5.
- Jangan menjalankan `npm run migrate` untuk pemasangan ini.
- Saldo diskon dipotong otomatis saat transaksi baru dibuat oleh bot.
- Jika dashboard mengubah status, bot memprosesnya melalui realtime dan fallback polling setiap 8 detik.
