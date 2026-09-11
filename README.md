# CANDRA Admin Dashboard — Supabase Realtime

Dashboard Next.js untuk CRUD produk, customer, transaksi, laporan keuangan, upload gambar Cloudinary, dan monitoring heartbeat WhatsApp Bot secara real-time.

## Arsitektur data

- Supabase adalah sumber data utama untuk bot dan dashboard.
- Bot memakai `SUPABASE_SERVICE_ROLE_KEY` hanya di server Pterodactyl.
- Browser dashboard memakai anon key + login Supabase Auth + Row Level Security.
- JSON pada bot hanya cache kompatibilitas dan antrean offline, bukan database kedua.
- Cloudinary menyimpan gambar produk. URL dan public ID tersimpan pada tabel `products`.

## A. Persiapan Supabase (wajib lebih dulu)

1. Buka Supabase Dashboard → SQL Editor → New query.
2. Salin seluruh isi `supabase/schema.sql`, lalu klik Run.
3. File ini aman dijalankan ulang dan memperbaiki error `record NEW has no field updated_at` dari skema lama.
   Jika Monitoring hanya mengeluhkan tabel `bot_instances`, Anda juga dapat menjalankan file ringkas `supabase/heartbeat-hotfix.sql`.
   Jika migrasi katalog mengeluhkan constraint `products_name_key`, jalankan `supabase/product-variants-hotfix.sql`.
   Untuk tampilan katalog terkelompok dan pengaturan urutan, jalankan `supabase/catalog-ordering-hotfix.sql`.
   Untuk memastikan pembersihan data dan status transaksi dashboard berfungsi, jalankan juga `supabase/CRITICAL-FIX-STATUS-DELETE.sql`.
4. Buka Authentication → Users dan buat user dashboard jika belum ada.
5. Salin UUID user tersebut, lalu jalankan SQL berikut dengan UUID dan email Anda:

```sql
insert into public.user_roles (id, email, role)
values ('UUID_USER_AUTH', 'admin@email.com', 'OWNER')
on conflict (id) do update set email = excluded.email, role = excluded.role;
```

Jangan membuat policy anonim untuk bot. Service role pada server bot otomatis melewati RLS.

## B. Menjalankan dashboard lokal / Antigravity

Persyaratan: Node.js 20 atau lebih baru.

1. Ekstrak paket dashboard dan buka foldernya di Antigravity/VS Code.
2. Salin `.env.example` menjadi `.env.local`.
3. Isi variabel berikut tanpa tanda kutip:

```env
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=ANON_KEY
CLOUDINARY_CLOUD_NAME=CLOUD_NAME
CLOUDINARY_API_KEY=API_KEY
CLOUDINARY_API_SECRET=API_SECRET
```

4. Jalankan:

```powershell
npm install
npm run build
npm run dev
```

5. Buka `http://localhost:3000`, lalu login memakai email/password Supabase Auth.

Jika build mengatakan `supabaseUrl is required`, `.env.local` belum ada, salah nama, atau terminal belum direstart setelah file dibuat.

## C. Hubungkan bot Pterodactyl

Gunakan paket bot terpisah yang disertakan bersama dashboard ini. Di server bot, isi `.env`:

```env
SUPABASE_URL=https://PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=SERVICE_ROLE_KEY
BOT_INSTANCE_ID=cakstore-main
BOT_NAME=CAKSTORE Bot
```

Setelah skema selesai, jalankan migrasi JSON lama satu kali dari folder bot: `npm run migrate`. Setelah itu jalankan `npm run check`, lalu start bot. CRUD produk berikutnya dilakukan hanya dari menu Products pada dashboard; bot menerima perubahan melalui Supabase Realtime dan refresh cadangan setiap lima menit.

## D. Deploy dashboard ke Vercel

1. Upload repository ke GitHub atau gunakan Vercel CLI.
2. Import project di Vercel dengan framework Next.js.
3. Tambahkan lima variabel dashboard dari `.env.local` pada Settings → Environment Variables.
4. Deploy. Jangan pernah menambahkan `SUPABASE_SERVICE_ROLE_KEY` ke Vercel/dashboard.

## Pemeriksaan setelah instalasi

- Tambah produk di dashboard; maksimal beberapa detik kemudian katalog bot berubah.
- Buat transaksi percobaan dari WhatsApp; baris muncul di Transactions dan Monitoring.
- Ubah status transaksi di dashboard; data bot selanjutnya membaca status yang sama.
- Monitoring menampilkan ONLINE jika heartbeat bot diterima kurang dari 90 detik lalu.
- Hapus produk; riwayat transaksi tetap ada karena relasi memakai `on delete set null`.

## Manajemen katalog

- Satu layanan seperti Netflix ditampilkan satu kali, lalu dikelompokkan berdasarkan kategori dan durasi.
- Semua layanan tertutup saat halaman Produk pertama dibuka. Klik ikon `>` untuk melihat kategori dan varian.
- Tombol `Tambah varian` pada kartu layanan menambahkan durasi/harga ke kategori yang dipilih.
- Kolom nama layanan dan kategori memberi saran data lama, tetapi tetap menerima nama baru.
- Form menggunakan `Jumlah keuntungan` dan menampilkan persentase keuntungan secara otomatis. Modal internal dihitung dari harga jual dikurangi keuntungan agar data transaksi bot tetap kompatibel.
- Field stok, deskripsi, dan nomor urutan tidak ditampilkan lagi pada form produk.
- Menu `Atur urutan` menampilkan seluruh layanan, kategori, dan varian. Tombol naik/turun menormalkan nomor secara otomatis agar tidak bentrok.
- Urutan layanan, kategori, dan varian diikuti oleh bot WhatsApp.

Catatan: status online menunjukkan proses bot aktif dan heartbeat Supabase berjalan. Status koneksi perangkat WhatsApp tetap mengikuti event koneksi Baileys pada bot.
