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

-- Izinkan anon & authenticated untuk mendaftarkan dan menghapus subscription sendiri
CREATE POLICY "Allow public insert and update push subscriptions"
ON public.push_subscriptions
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- ==============================================================================
-- PANDUAN AKTIFKAN SUPABASE DATABASE WEBHOOK (Agar notifikasi masuk saat browser tutup)
-- ==============================================================================
-- 1. Buka Supabase Dashboard -> Project Anda
-- 2. Masuk ke menu "Database" -> "Webhooks" -> klik "Create a new hook"
-- 3. Isi form sebagai berikut:
--    - Name: "push_on_new_transaction"
--    - Table: "transactions"
--    - Events: Centang "Insert" (dan opsional "Update")
--    - Type of webhook: "HTTP Request"
--    - Method: "POST"
--    - URL: https://[DOMAIN-DASHBOARD-ANDA]/api/push/send
--    - HTTP Headers:
--        Content-Type: application/json
-- 4. Klik "Create Webhook".
-- Selesai! Setiap ada transaksi baru dari WhatsApp Bot, Supabase akan langsung
-- menembak endpoint /api/push/send, dan HP Anda akan langsung berdering / bergetar
-- menampilkan notifikasi transaksi baru meskipun browser sedang ditutup.
