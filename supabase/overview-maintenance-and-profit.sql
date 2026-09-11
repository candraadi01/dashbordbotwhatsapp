-- CANDRA Dashboard - pusat pembersihan data + daftar keuntungan
-- Jalankan SATU KALI di Supabase > SQL Editor.
-- Aman dijalankan ulang: fungsi akan diperbarui dan nilai keuntungan disinkronkan lagi.

create or replace function public.dashboard_purge_data(p_target text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_transactions integer := 0;
  v_customers integer := 0;
  v_logs integer := 0;
begin
  if not exists (
    select 1
    from public.user_roles
    where id = auth.uid() and role = 'OWNER'
  ) then
    raise exception 'Hanya OWNER yang boleh membersihkan database'
      using errcode = '42501';
  end if;

  if p_target not in ('transactions', 'customers', 'sales_data') then
    raise exception 'Target pembersihan tidak valid';
  end if;

  if p_target in ('transactions', 'sales_data') then
    -- Kondisi eksplisit diperlukan pada project yang mengaktifkan
    -- pgsafeupdate. Semua UUID valid pasti bukan null.
    delete from public.transactions as t where t.id is not null;
    get diagnostics v_transactions = row_count;

    -- Trigger audit membuat log DELETE. Bersihkan sesudah transaksi agar tidak
    -- meninggalkan baris audit lama maupun baris audit dari proses ini.
    delete from public.transaction_logs as l where l.id is not null;
    get diagnostics v_logs = row_count;
  end if;

  if p_target in ('customers', 'sales_data') then
    delete from public.customers as c where c.id is not null;
    get diagnostics v_customers = row_count;
  end if;

  return jsonb_build_object(
    'deleted_transactions', v_transactions,
    'deleted_customers', v_customers,
    'deleted_logs', v_logs
  );
end;
$$;

revoke all on function public.dashboard_purge_data(text) from public;
grant execute on function public.dashboard_purge_data(text) to authenticated;

-- Daftar keuntungan dari pemilik. Kolom cost dihitung sebagai harga jual
-- dikurangi keuntungan; trigger products kemudian mengisi profit_amount.
with profit_map(service_key, category_key, duration_key, profit) as (
  values
    ('NETFLIX', '1P1U', '1 BULAN', 14000::bigint),
    ('NETFLIX', '1P1U', '2 BULAN', 28000::bigint),
    ('NETFLIX', '1P1U', '3 BULAN', 42000::bigint),
    ('NETFLIX', '1P2U', '1 BULAN', 10000::bigint),
    ('NETFLIX', '1P2U', '2 BULAN', 20000::bigint),
    ('NETFLIX', '1P2U', '3 BULAN', 30000::bigint),
    ('NETFLIX', 'SEMPRIV 1P2U', '1 BULAN', 20000::bigint),
    ('NETFLIX', 'SEMPRIV 1P2U', '2 BULAN', 40000::bigint),
    ('NETFLIX', 'PRIVATE', '1 BULAN', 70000::bigint),
    ('NETFLIX', 'SEMPRIV 1P1U', '1 BULAN', 28000::bigint),
    ('VIU', 'PREMIUM BIASA', '3 BULAN', 16000::bigint),
    ('VIU', 'PREMIUM BIASA', '6 BULAN', 20000::bigint),
    ('VIU', 'PREMIUM BIASA', '1 TAHUN', 30000::bigint),
    ('VIU', 'PREMIUM ANTI LIMIT', '1 BULAN', 12000::bigint),
    ('VIU', 'PREMIUM ANTI LIMIT', '3 BULAN', 20000::bigint),
    ('VIU', 'PREMIUM ANTI LIMIT', '4 BULAN', 26000::bigint),
    ('VIU', 'PREMIUM ANTI LIMIT', '6 BULAN', 30000::bigint),
    ('VIU', 'PREMIUM ANTI LIMIT', '1 TAHUN', 40000::bigint),
    ('VIDIO', 'VIDIO SHARING HP', '1 BULAN', 12000::bigint),
    ('VIDIO', 'VIDIO PRIVAT HP', '1 BULAN', 14000::bigint),
    ('VIDIO', 'VIDIO SHARING TV', '1 TAHUN', 40000::bigint),
    ('VIDIO', 'VIDIO PRIVAT TV', '1 TAHUN', 60000::bigint),
    ('IQIYI', 'IQIYI PRIVAT', '1 BULAN', 20000::bigint),
    ('IQIYI', 'IQIYI SHARING', '1 BULAN', 10000::bigint),
    ('IQIYI', 'IQIYI SHARING', '1 TAHUN', 20000::bigint),
    ('PRIME', 'SHARING 6U', '1 BULAN', 10000::bigint),
    ('PRIME', 'SHARING 4U', '1 BULAN', 14000::bigint),
    ('PRIME', 'PRIME PRIVAT', '1 BULAN', 20000::bigint),
    ('CAPCUT', 'CAPCUT PRIVAT', '1 BULAN', 10000::bigint)
)
update public.products as p
set cost = p.price - m.profit,
    updated_at = now()
from profit_map as m
where upper(p.name) like '%' || m.service_key || '%'
  and upper(regexp_replace(trim(p.category), '\s+', ' ', 'g')) = m.category_key
  and upper(regexp_replace(trim(p.duration), '\s+', ' ', 'g')) = m.duration_key
  and p.price >= m.profit;

-- Hasil ini tampil otomatis setelah SQL dijalankan. Gunakan untuk memeriksa
-- angka keuntungan yang sudah masuk tanpa mengubah data lagi.
select name, category, duration, price, cost, profit_amount
from public.products
order by sort_order, category_sort_order, variant_sort_order, name, category, duration;
