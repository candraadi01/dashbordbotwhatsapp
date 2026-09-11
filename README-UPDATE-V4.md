# Dashboard CANDRA V4

Perubahan versi ini:

- filter Overview: Hari, 7 Hari, Bulan, Tahun, dan rentang tanggal;
- semua card serta transaksi terbaru mengikuti filter;
- pusat pembersihan data khusus akun `OWNER`;
- pilihan hapus transaksi, customer, atau seluruh data penjualan;
- konfirmasi aman dengan mengetik `HAPUS`;
- produk tidak pernah ikut dihapus oleh pusat pembersihan;
- daftar keuntungan produk diterapkan melalui SQL;
- seluruh penyempurnaan halaman Product versi sebelumnya tetap disertakan.

## Instalasi

1. Simpan `.env.local` lama Anda di tempat aman.
2. Extract ZIP dashboard ke folder project.
3. Kembalikan `.env.local` jika folder lama Anda dihapus.
4. Buka Supabase > SQL Editor.
5. Jalankan seluruh isi `supabase/overview-maintenance-and-profit.sql` satu kali.
6. Di terminal project jalankan `npm install`, lalu `npm run build`.
7. Jika build sukses, jalankan `npm run dev` untuk lokal atau deploy ulang ke Vercel.

Untuk membersihkan data lama, login sebagai `OWNER`, buka **Overview**, tekan
**Kelola data**, pilih jenis data, lalu ketik `HAPUS`. Tindakan ini permanen.
