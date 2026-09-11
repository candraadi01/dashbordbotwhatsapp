-- CANDRA Dashboard V5
-- Jalankan seluruh file ini di Supabase > SQL Editor sebelum menjalankan V5.

-- ================================================================
-- 1. LOYALTY CUSTOMER: 1 transaksi sukses = 10 poin
--    10 poin = saldo potongan Rp1.000 untuk transaksi berikutnya.
-- ================================================================

alter table public.customers add column if not exists loyalty_points integer not null default 0;
alter table public.customers add column if not exists lifetime_points integer not null default 0;
alter table public.customers add column if not exists discount_balance bigint not null default 0;

alter table public.transactions add column if not exists original_price bigint not null default 0;
alter table public.transactions add column if not exists discount_amount bigint not null default 0;
alter table public.transactions add column if not exists discount_refunded boolean not null default false;
alter table public.transactions add column if not exists status_source text not null default 'bot';
alter table public.transactions add column if not exists status_sync_state text not null default 'synced';
alter table public.transactions add column if not exists status_changed_by uuid;
alter table public.transactions add column if not exists whatsapp_synced_at timestamptz;

update public.transactions set original_price = price where original_price = 0;

update public.transactions t
set customer_id = c.id
from public.customers c
where t.customer_id is null and c.customer_phone = t.customer_phone;

create table if not exists public.transaction_point_awards (
  transaction_id uuid primary key references public.transactions(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  points integer not null default 10,
  applied boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.customer_point_logs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  transaction_id uuid references public.transactions(id) on delete set null,
  action text not null,
  points_delta integer not null,
  discount_delta bigint not null default 0,
  note text,
  actor_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists customer_point_logs_customer_idx
  on public.customer_point_logs(customer_id, created_at desc);

-- Daftarkan transaksi lama yang sudah sukses. Kolom applied membuat backfill
-- aman apabila SQL ini dijalankan ulang.
insert into public.transaction_point_awards(transaction_id, customer_id, points, applied)
select t.id, c.id, 10, false
from public.transactions t
join public.customers c on c.customer_phone = t.customer_phone
where t.status = 'success'
on conflict (transaction_id) do nothing;

with pending_awards as (
  select customer_id, sum(points)::integer as points
  from public.transaction_point_awards
  where applied = false
  group by customer_id
)
update public.customers c
set loyalty_points = c.loyalty_points + p.points,
    lifetime_points = c.lifetime_points + p.points,
    updated_at = now()
from pending_awards p
where c.id = p.customer_id;

update public.transaction_point_awards set applied = true where applied = false;

create or replace function public.sync_transaction_loyalty_points()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid;
  v_award_id uuid;
  v_points integer;
begin
  if tg_op = 'DELETE' then
    if old.status = 'success' then
      delete from public.transaction_point_awards
      where transaction_id = old.id
      returning customer_id, points into v_customer_id, v_points;

      if v_customer_id is not null then
        update public.customers
        set loyalty_points = greatest(loyalty_points - v_points, 0),
            lifetime_points = greatest(lifetime_points - v_points, 0),
            updated_at = now()
        where id = v_customer_id;
        insert into public.customer_point_logs(customer_id, transaction_id, action, points_delta, note)
        values (v_customer_id, null, 'REVERSAL', -v_points, 'Transaksi sukses dihapus');
      end if;
    end if;
    return old;
  end if;

  select c.id into v_customer_id
  from public.customers c
  where c.id = new.customer_id or c.customer_phone = new.customer_phone
  order by (c.id = new.customer_id) desc
  limit 1;

  if v_customer_id is null then return new; end if;

  if new.status = 'success' and (tg_op = 'INSERT' or old.status <> 'success') then
    insert into public.transaction_point_awards(transaction_id, customer_id, points, applied)
    values (new.id, v_customer_id, 10, true)
    on conflict (transaction_id) do nothing
    returning transaction_id into v_award_id;

    if v_award_id is not null then
      update public.customers
      set loyalty_points = loyalty_points + 10,
          lifetime_points = lifetime_points + 10,
          updated_at = now()
      where id = v_customer_id;
      insert into public.customer_point_logs(customer_id, transaction_id, action, points_delta, note)
      values (v_customer_id, new.id, 'EARN', 10, 'Bonus transaksi berhasil');
    end if;
  elsif tg_op = 'UPDATE' and old.status = 'success' and new.status <> 'success' then
    delete from public.transaction_point_awards
    where transaction_id = new.id
    returning points into v_points;

    if v_points is not null then
      update public.customers
      set loyalty_points = greatest(loyalty_points - v_points, 0),
          lifetime_points = greatest(lifetime_points - v_points, 0),
          updated_at = now()
      where id = v_customer_id;
      insert into public.customer_point_logs(customer_id, transaction_id, action, points_delta, note)
      values (v_customer_id, new.id, 'REVERSAL', -v_points, 'Status transaksi tidak lagi berhasil');
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_transaction_loyalty_points on public.transactions;
create trigger trg_transaction_loyalty_points
after insert or update of status on public.transactions
for each row execute function public.sync_transaction_loyalty_points();
drop trigger if exists trg_transaction_loyalty_points_delete on public.transactions;
create trigger trg_transaction_loyalty_points_delete
before delete on public.transactions
for each row execute function public.sync_transaction_loyalty_points();

create or replace function public.manage_customer_loyalty(
  p_customer_id uuid,
  p_action text,
  p_points integer,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer public.customers;
  v_discount bigint := 0;
  v_delta integer := 0;
begin
  if public.current_role() not in ('OWNER', 'ADMIN') then
    raise exception 'Akses ditolak: hanya OWNER atau ADMIN' using errcode = '42501';
  end if;
  if p_points <= 0 or mod(p_points, 10) <> 0 then
    raise exception 'Poin harus kelipatan 10 dan lebih besar dari 0';
  end if;

  select * into v_customer from public.customers where id = p_customer_id for update;
  if not found then raise exception 'Customer tidak ditemukan'; end if;

  if upper(p_action) = 'ADD' then
    v_delta := p_points;
    update public.customers
    set loyalty_points = loyalty_points + p_points,
        lifetime_points = lifetime_points + p_points,
        updated_at = now()
    where id = p_customer_id returning * into v_customer;
  elsif upper(p_action) = 'DEDUCT' then
    if v_customer.loyalty_points < p_points then raise exception 'Poin customer tidak mencukupi'; end if;
    v_delta := -p_points;
    update public.customers
    set loyalty_points = loyalty_points - p_points, updated_at = now()
    where id = p_customer_id returning * into v_customer;
  elsif upper(p_action) = 'REDEEM' then
    if v_customer.loyalty_points < p_points then raise exception 'Poin customer tidak mencukupi'; end if;
    v_delta := -p_points;
    v_discount := (p_points / 10) * 1000;
    update public.customers
    set loyalty_points = loyalty_points - p_points,
        discount_balance = discount_balance + v_discount,
        updated_at = now()
    where id = p_customer_id returning * into v_customer;
  else
    raise exception 'Aksi poin tidak valid';
  end if;

  insert into public.customer_point_logs(customer_id, action, points_delta, discount_delta, note, actor_id)
  values (p_customer_id, upper(p_action), v_delta, v_discount, nullif(trim(p_note), ''), auth.uid());

  return jsonb_build_object(
    'loyalty_points', v_customer.loyalty_points,
    'lifetime_points', v_customer.lifetime_points,
    'discount_balance', v_customer.discount_balance
  );
end;
$$;

revoke all on function public.manage_customer_loyalty(uuid, text, integer, text) from public;
grant execute on function public.manage_customer_loyalty(uuid, text, integer, text) to authenticated;

-- Saldo diskon yang sudah ditukar dipakai otomatis pada transaksi baru.
create or replace function public.apply_customer_discount()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer public.customers;
  v_discount bigint;
begin
  if tg_op = 'INSERT' then
    if new.transaction_id is not null and exists (
      select 1 from public.transactions where transaction_id = new.transaction_id
    ) then
      return new;
    end if;

    select * into v_customer
    from public.customers
    where id = new.customer_id or customer_phone = new.customer_phone
    order by (id = new.customer_id) desc
    limit 1 for update;

    new.original_price := case when new.original_price > 0 then new.original_price else new.price end;
    if v_customer.id is not null and v_customer.discount_balance > 0 then
      v_discount := least(v_customer.discount_balance, new.price);
      new.customer_id := coalesce(new.customer_id, v_customer.id);
      new.discount_amount := v_discount;
      new.price := new.price - v_discount;
      new.profit_amount := greatest(new.price - new.cost, 0);
      new.profit_percentage := case when new.price > 0 then round((new.profit_amount::numeric / new.price::numeric) * 100, 2) else 0 end;
      update public.customers set discount_balance = discount_balance - v_discount, updated_at = now() where id = v_customer.id;
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.status <> 'cancelled' and new.status = 'cancelled' and new.discount_amount > 0 and not old.discount_refunded then
      update public.customers set discount_balance = discount_balance + new.discount_amount, updated_at = now()
      where id = coalesce(new.customer_id, old.customer_id);
      new.discount_refunded := true;
    elsif old.status = 'cancelled' and new.status <> 'cancelled' and old.discount_refunded and new.discount_amount > 0 then
      select * into v_customer from public.customers where id = new.customer_id for update;
      if v_customer.discount_balance < new.discount_amount then
        raise exception 'Saldo diskon customer tidak cukup untuk membuka kembali transaksi';
      end if;
      update public.customers set discount_balance = discount_balance - new.discount_amount, updated_at = now() where id = v_customer.id;
      new.discount_refunded := false;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.status <> 'success' and old.discount_amount > 0 and not old.discount_refunded then
      update public.customers set discount_balance = discount_balance + old.discount_amount, updated_at = now()
      where id = old.customer_id;
    end if;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_apply_customer_discount on public.transactions;
create trigger trg_apply_customer_discount
before insert or update of status or delete on public.transactions
for each row execute function public.apply_customer_discount();

-- ================================================================
-- 2. STATUS TRANSAKSI DASHBOARD <-> WHATSAPP
-- ================================================================

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
  if public.current_role() not in ('OWNER', 'ADMIN') then
    raise exception 'Akses ditolak: hanya OWNER atau ADMIN' using errcode = '42501';
  end if;

  select * into v_current from public.transactions where id = p_transaction_id for update;
  if not found then raise exception 'Transaksi tidak ditemukan'; end if;
  -- Status yang sama tetap ditulis ulang. Ini berfungsi sebagai perintah
  -- sinkronisasi ulang bila bot belum menerima perubahan sebelumnya.
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

alter table public.transaction_point_awards enable row level security;
alter table public.customer_point_logs enable row level security;
grant select on public.transaction_point_awards to authenticated;
grant select on public.customer_point_logs to authenticated;
drop policy if exists "dashboard reads point awards" on public.transaction_point_awards;
create policy "dashboard reads point awards" on public.transaction_point_awards for select to authenticated
using (public.current_role() in ('OWNER', 'ADMIN', 'STAFF'));
drop policy if exists "dashboard reads point logs" on public.customer_point_logs;
create policy "dashboard reads point logs" on public.customer_point_logs for select to authenticated
using (public.current_role() in ('OWNER', 'ADMIN', 'STAFF'));

do $$ begin alter publication supabase_realtime add table public.customers; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.transactions; exception when duplicate_object then null; end $$;

select 'Dashboard V5 berhasil dipasang' as result;
