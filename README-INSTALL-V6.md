# CANDRA Dashboard V6 — Customer CRM Toggle

## Cara replace

1. Stop aplikasi dashboard.
2. Backup folder dashboard lama dan pertahankan file `.env.local`/environment hosting.
3. Extract ZIP ini ke folder aplikasi lalu replace file yang namanya sama.
4. Jalankan `npm install`.
5. Jalankan `npm run build`.
6. Start/deploy kembali dashboard.

Tidak ada SQL tambahan untuk pembaruan V6 ini.

## Fitur V6

- Settings memiliki sakelar terpisah **Score Customer** dan **Poin Reward**.
- Score dapat disembunyikan tanpa memengaruhi kolom lain.
- Poin Reward dapat menyembunyikan saldo poin, saldo diskon, dan tombol kelola poin.
- Tampilan Customer CRM menyesuaikan kembali secara otomatis di desktop maupun mobile.
- Nilai fitur tersimpan di browser admin dan data customer di database tidak dihapus ketika fitur dimatikan.

