-- ==============================================================================
-- SKRIP OTOMATIS: TRIGGER WEBHOOK WEB PUSH REALTIME TRANSAKSI KE HP
-- ==============================================================================
-- Jalankan skrip ini 1x di Supabase SQL Editor.
-- Jangan lupa ganti [DOMAIN-VERCEL-ANDA] dengan domain Vercel Anda!
-- (Contoh: dashbordbotwhatsapp-candra.vercel.app)
-- ==============================================================================

-- 1. Aktifkan ekstensi pg_net bawaan Supabase (untuk HTTP Request asinkron cepat)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. Aktifkan REPLICA IDENTITY FULL agar event UPDATE (dibatalkan) & DELETE (dihapus)
--    mengirimkan seluruh data lama transaksi ke notifikasi HP
ALTER TABLE public.transactions REPLICA IDENTITY FULL;

-- 3. Buat Fungsi Pengirim Sinyal Web Push ke API Vercel
CREATE OR REPLACE FUNCTION public.send_push_notification_webhook()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  -- GANTI DENGAN URL DOMAIN DASHBOARD VERCEL ANDA:
  v_url text := 'https://[DOMAIN-VERCEL-ANDA]/api/push/send';
  v_payload jsonb;
BEGIN
  -- Susun payload persis sesuai format yang diterima oleh route /api/push/send
  v_payload := jsonb_build_object(
    'type', TG_OP,
    'table', TG_TABLE_NAME,
    'schema', TG_TABLE_SCHEMA,
    'record', CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE null END,
    'old_record', CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN row_to_json(OLD) ELSE null END
  );

  -- Eksekusi HTTP POST asinkron (tidak memblokir transaksi database)
  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := v_payload
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Cegah rollback transaksi utama jika ada gangguan koneksi webhook
  RAISE WARNING 'Web Push webhook failed: %', SQLERRM;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Pasang Trigger Otomatis pada Tabel transactions
DROP TRIGGER IF EXISTS trg_push_transaction_webhook ON public.transactions;

CREATE TRIGGER trg_push_transaction_webhook
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.send_push_notification_webhook();
