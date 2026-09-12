-- ==============================================================================
-- SKEMA WEB PUSH NOTIFICATION (SUPABASE WEBHOOK + VAPID)
-- ==============================================================================
-- Jalankan script ini di Supabase SQL Editor jika Anda ingin menyimpan
-- subscription push langsung ke database Supabase dan mengaktifkan Database Webhook.

-- 1. Buat Tabel push_subscriptions
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint TEXT UNIQUE NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index untuk mempercepat query
CREATE INDEX IF NOT EXISTS idx_push_subs_endpoint ON public.push_subscriptions(endpoint);

-- Aktifkan RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Izinkan anon & authenticated untuk mendaftarkan dan membaca subscription
CREATE POLICY "Allow public insert and update push subscriptions"
ON public.push_subscriptions
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- 2. Aktifkan REPLICA IDENTITY FULL pada tabel transactions
-- (Sangat penting agar event UPDATE & DELETE mengirimkan data lengkap customer, produk, dan ID ke notifikasi HP)
ALTER TABLE public.transactions REPLICA IDENTITY FULL;

-- ==============================================================================
-- CARA AKTIFKAN NOTIFIKASI REAL-TIME KE HP (SUPABASE DATABASE WEBHOOK)
-- Agar notifikasi HP berdering real-time saat HP mati / aplikasi ditutup:
-- ==============================================================================
-- 1. Buka Supabase Dashboard -> https://supabase.com/dashboard/project/_/database/hooks
-- 2. Klik "Create a new hook" (atau "Enable Webhooks" jika belum aktif)
-- 3. Isi form sebagai berikut:
--    - Name: push_realtime_transactions
--    - Table: transactions
--    - Events: Centang SEMUA -> [x] Insert, [x] Update, [x] Delete
--    - Type of webhook: HTTP Request
--    - Method: POST
--    - URL: https://[DOMAIN-DASHBOARD-ANDA]/api/push/send
--           (Contoh: https://dashbordbotwhatsapp-candra.vercel.app/api/push/send)
--    - HTTP Headers:
--        Key: Content-Type
--        Value: application/json
-- 4. Klik "Create Webhook".
--
-- Hasil: Begitu transaksi MASUK, DIBATALKAN, atau DIHAPUS (baik via WhatsApp Bot
-- maupun Dashboard), Supabase akan otomatis mengirim sinyal Web Push ke HP Anda
-- secara seketika (realtime) walau HP mati atau aplikasi ditutup!

