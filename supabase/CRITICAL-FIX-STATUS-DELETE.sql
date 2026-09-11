-- CANDRA Dashboard V5.2 - perbaikan kritis status transaksi dan hapus data
-- Jalankan SELURUH file ini SATU KALI di Supabase > SQL Editor.
-- Aman dijalankan ulang dan tidak menghapus data saat instalasi.

begin;

-- Kolom sinkronisasi dipastikan tersedia untuk instalasi lama.
alter table public.transactions add column if not exists status_source text not null default 'bot';
alter table public.transactions add column if not exists status_sync_state text not null default 'synced';
alter table public.transactions add column if not exists status_changed_by uuid;
alter table public.transactions add column if not exists whatsapp_synced_at timestamptz;
alter table public.transactions add column if not exists updated_at timestamptz not null default now();

-- Pembersihan hanya boleh dijalankan OWNER. Setiap DELETE memiliki WHERE
-- eksplisit agar tidak ditolak oleh pengaman pgsafeupdate Supabase.
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
    where id = auth.uid() and upper(role) = 'OWNER'
  ) then
    raise exception 'Hanya OWNER yang boleh membersihkan database'
      using errcode = '42501';
  end if;

  if p_target not in ('transactions', 'customers', 'sales_data') then
    raise exception 'Target pembersihan tidak valid';
  end if;

  if p_target in ('transactions', 'sales_data') then
    delete from public.transactions as t where t.id is not null;
    get diagnostics v_transactions = row_count;

    -- Audit DELETE dibuat oleh trigger transaksi, sehingga log dibersihkan
    -- setelah transaksi selesai dihapus.
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

-- Update status dijalankan atomik di database. Parameter waktu lama tetap
-- dipertahankan agar dashboard versi sebelumnya tidak rusak, tetapi aksi
-- terakhir admin menjadi sumber kebenaran dan tidak dibuat macet oleh
-- perubahan heartbeat/realtime yang terjadi bersamaan.
create or replace function public.dashboard_set_transaction_status(
  p_transaction_id uuid,
  p_status public.transaction_status,
  p_expected_updated_at timestamptz
)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current public.transactions;
  v_result public.transactions;
begin
  if not exists (
    select 1
    from public.user_roles
    where id = auth.uid() and upper(role) in ('OWNER', 'ADMIN')
  ) then
    raise exception 'Akses ditolak: hanya OWNER atau ADMIN'
      using errcode = '42501';
  end if;

  select * into v_current
  from public.transactions
  where id = p_transaction_id
  for update;

  if not found then
    raise exception 'Transaksi tidak ditemukan';
  end if;

  update public.transactions
  set status = p_status,
      status_source = 'dashboard',
      status_sync_state = 'pending',
      status_changed_by = auth.uid(),
      whatsapp_synced_at = null,
      updated_at = now()
  where id = p_transaction_id
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on function public.dashboard_set_transaction_status(uuid, public.transaction_status, timestamptz) from public;
grant execute on function public.dashboard_set_transaction_status(uuid, public.transaction_status, timestamptz) to authenticated;

-- Pastikan perubahan tabel transaksi dikirim melalui Supabase Realtime.
do $$
begin
  alter publication supabase_realtime add table public.transactions;
exception
  when duplicate_object then null;
end
$$;

-- Minta PostgREST memuat ulang fungsi yang baru diperbarui.
notify pgrst, 'reload schema';

commit;

select
  'PERBAIKAN V5.2 BERHASIL' as hasil,
  public.current_role() as role_login,
  to_regprocedure('public.dashboard_purge_data(text)') is not null as fungsi_hapus,
  to_regprocedure('public.dashboard_set_transaction_status(uuid,public.transaction_status,timestamp with time zone)') is not null as fungsi_status;
