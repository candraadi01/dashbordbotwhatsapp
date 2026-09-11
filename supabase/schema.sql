-- CANDRA BOT dashboard schema / idempotent migration
create extension if not exists pgcrypto;
do $$ begin create type public.transaction_status as enum ('pending', 'success', 'cancelled'); exception when duplicate_object then null; end $$;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(), customer_name text not null,
  customer_phone text unique not null, first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(), notes text, updated_at timestamptz not null default now()
);
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(), name text not null, category text not null,
  duration text not null default '1 bulan', price bigint not null check (price >= 0),
  cost bigint not null default 0 check (cost >= 0),
  profit_amount bigint not null default 0,
  description text, image_url text, image_public_id text,
  stock integer check (stock is null or stock >= 0),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE')),
  sort_order integer not null default 0,
  category_sort_order integer not null default 0,
  variant_sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), unique (name, category, duration)
);
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(), transaction_id text unique,
  customer_id uuid references public.customers(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  customer_name text not null, customer_phone text not null, product_name text not null,
  category text, duration text not null, price bigint not null default 0, cost bigint not null default 0,
  profit_amount bigint not null default 0, profit_percentage numeric(7,2) not null default 0,
  status public.transaction_status not null default 'pending', created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.transaction_logs (
  id uuid primary key default gen_random_uuid(), transaction_id uuid references public.transactions(id) on delete set null,
  action text not null, old_data jsonb, new_data jsonb, actor_id uuid, created_at timestamptz not null default now()
);
create table if not exists public.user_roles (
  id uuid primary key references auth.users(id) on delete cascade, email text not null,
  role text not null default 'STAFF' check (role in ('OWNER','ADMIN','STAFF')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- Upgrade installations created with an earlier dashboard version.
alter table public.customers add column if not exists notes text;
alter table public.customers add column if not exists updated_at timestamptz not null default now();
alter table public.products add column if not exists duration text not null default '1 bulan';
alter table public.products add column if not exists cost bigint not null default 0;
alter table public.products add column if not exists profit_amount bigint not null default 0;
alter table public.products add column if not exists description text;
alter table public.products add column if not exists image_url text;
alter table public.products add column if not exists image_public_id text;
alter table public.products add column if not exists stock integer;
alter table public.products add column if not exists status text not null default 'ACTIVE';
alter table public.products add column if not exists sort_order integer not null default 0;
alter table public.products add column if not exists category_sort_order integer not null default 0;
alter table public.products add column if not exists variant_sort_order integer not null default 0;
alter table public.products add column if not exists updated_at timestamptz not null default now();
-- Skema lama hanya mengizinkan satu baris per nama produk. Versi baru
-- membutuhkan kombinasi nama + kategori + durasi agar produk bisa memiliki varian.
alter table public.products drop constraint if exists products_name_key;
alter table public.transactions add column if not exists transaction_id text;
alter table public.transactions add column if not exists category text;
alter table public.transactions add column if not exists cost bigint not null default 0;
alter table public.transactions add column if not exists profit_percentage numeric(7,2) not null default 0;
alter table public.transactions add column if not exists updated_at timestamptz not null default now();

-- Compatibility with transaction_logs from the first dashboard release.
alter table public.transaction_logs add column if not exists action text;
alter table public.transaction_logs add column if not exists old_data jsonb;
alter table public.transaction_logs add column if not exists new_data jsonb;
alter table public.transaction_logs add column if not exists actor_id uuid;
alter table public.transaction_logs alter column transaction_id drop not null;
update public.transaction_logs set action = coalesce(action, 'UPDATE') where action is null;
alter table public.transaction_logs alter column action set default 'UPDATE';
alter table public.transaction_logs alter column action set not null;
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'transaction_logs' and column_name = 'new_status'
  ) then
    alter table public.transaction_logs alter column new_status drop not null;
  end if;
end $$;

create table if not exists public.bot_instances (
  id text primary key,
  name text not null,
  status text not null default 'starting' check (status in ('starting','online','offline','error')),
  version text,
  last_seen timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.bot_instances add column if not exists name text;
alter table public.bot_instances add column if not exists status text not null default 'starting';
alter table public.bot_instances add column if not exists version text;
alter table public.bot_instances add column if not exists last_seen timestamptz not null default now();
alter table public.bot_instances add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.bot_instances add column if not exists updated_at timestamptz not null default now();

create or replace function public.touch_updated_at() returns trigger language plpgsql security invoker set search_path = '' as $$
begin new.updated_at = now(); return new; end; $$;
create or replace function public.compute_product_profit() returns trigger language plpgsql security invoker set search_path = '' as $$
begin new.profit_amount = greatest(new.price - new.cost, 0); return new; end; $$;
create or replace function public.audit_transaction() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    insert into public.transaction_logs(transaction_id, action, old_data, new_data, actor_id)
    values (null, tg_op, to_jsonb(old), null, auth.uid());
    return old;
  elsif tg_op = 'INSERT' then
    insert into public.transaction_logs(transaction_id, action, old_data, new_data, actor_id)
    values (new.id, tg_op, null, to_jsonb(new), auth.uid());
    return new;
  else
    insert into public.transaction_logs(transaction_id, action, old_data, new_data, actor_id)
    values (new.id, tg_op, to_jsonb(old), to_jsonb(new), auth.uid());
    return new;
  end if;
end; $$;

drop trigger if exists trg_transactions_touch on public.transactions;
create trigger trg_transactions_touch before update on public.transactions for each row execute function public.touch_updated_at();
drop trigger if exists trg_products_touch on public.products;
create trigger trg_products_touch before update on public.products for each row execute function public.touch_updated_at();
drop trigger if exists trg_products_profit on public.products;
create trigger trg_products_profit before insert or update of price, cost on public.products for each row execute function public.compute_product_profit();
drop trigger if exists trg_customers_touch on public.customers;
create trigger trg_customers_touch before update on public.customers for each row execute function public.touch_updated_at();
drop trigger if exists trg_bot_instances_touch on public.bot_instances;
create trigger trg_bot_instances_touch before update on public.bot_instances for each row execute function public.touch_updated_at();
drop trigger if exists trg_transactions_audit on public.transactions;
create trigger trg_transactions_audit after insert or update or delete on public.transactions for each row execute function public.audit_transaction();

alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_logs enable row level security;
alter table public.user_roles enable row level security;
alter table public.bot_instances enable row level security;
grant select on table public.bot_instances to authenticated;
grant all on table public.bot_instances to service_role;
drop policy if exists "Allow anon full access on transactions for bot API" on public.transactions;
drop policy if exists "Allow anon select access on customers" on public.customers;
create or replace function public.current_role() returns text language sql stable security definer set search_path = '' as $$
select role from public.user_roles where id = auth.uid() $$;
create or replace function public.dashboard_purge_data(p_target text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_transactions integer := 0; v_customers integer := 0; v_logs integer := 0;
begin
  if not exists (select 1 from public.user_roles where id = auth.uid() and role = 'OWNER') then
    raise exception 'Hanya OWNER yang boleh membersihkan database' using errcode = '42501';
  end if;
  if p_target not in ('transactions', 'customers', 'sales_data') then raise exception 'Target pembersihan tidak valid'; end if;
  if p_target in ('transactions', 'sales_data') then
    delete from public.transactions as t where t.id is not null; get diagnostics v_transactions = row_count;
    delete from public.transaction_logs as l where l.id is not null; get diagnostics v_logs = row_count;
  end if;
  if p_target in ('customers', 'sales_data') then
    delete from public.customers as c where c.id is not null; get diagnostics v_customers = row_count;
  end if;
  return jsonb_build_object('deleted_transactions', v_transactions, 'deleted_customers', v_customers, 'deleted_logs', v_logs);
end; $$;
revoke all on function public.dashboard_purge_data(text) from public;
grant execute on function public.dashboard_purge_data(text) to authenticated;
drop policy if exists "dashboard customers" on public.customers;
drop policy if exists "read customers" on public.customers;
drop policy if exists "manage customers" on public.customers;
create policy "read customers" on public.customers for select to authenticated using (public.current_role() in ('OWNER','ADMIN','STAFF'));
create policy "manage customers" on public.customers for all to authenticated using (public.current_role() in ('OWNER','ADMIN')) with check (public.current_role() in ('OWNER','ADMIN'));
drop policy if exists "dashboard products" on public.products;
drop policy if exists "read products" on public.products;
drop policy if exists "manage products" on public.products;
create policy "read products" on public.products for select to authenticated using (public.current_role() in ('OWNER','ADMIN','STAFF'));
create policy "manage products" on public.products for all to authenticated using (public.current_role() in ('OWNER','ADMIN')) with check (public.current_role() in ('OWNER','ADMIN'));
drop policy if exists "dashboard transactions" on public.transactions;
drop policy if exists "read transactions" on public.transactions;
drop policy if exists "manage transactions" on public.transactions;
create policy "read transactions" on public.transactions for select to authenticated using (public.current_role() in ('OWNER','ADMIN','STAFF'));
create policy "manage transactions" on public.transactions for all to authenticated using (public.current_role() in ('OWNER','ADMIN')) with check (public.current_role() in ('OWNER','ADMIN'));
drop policy if exists "dashboard logs" on public.transaction_logs;
create policy "dashboard logs" on public.transaction_logs for select to authenticated using (public.current_role() in ('OWNER','ADMIN'));
drop policy if exists "users read self or owner" on public.user_roles;
create policy "users read self or owner" on public.user_roles for select to authenticated using (id = auth.uid() or public.current_role() = 'OWNER');
drop policy if exists "owner manages users" on public.user_roles;
create policy "owner manages users" on public.user_roles for all to authenticated using (public.current_role() = 'OWNER') with check (public.current_role() = 'OWNER');
drop policy if exists "read bot status" on public.bot_instances;
create policy "read bot status" on public.bot_instances for select to authenticated using (public.current_role() in ('OWNER','ADMIN','STAFF'));
create index if not exists transactions_created_at_idx on public.transactions(created_at desc);
create unique index if not exists transactions_transaction_id_uidx on public.transactions(transaction_id) where transaction_id is not null;
create index if not exists products_catalog_lookup_idx on public.products(name, category, duration);
do $$
begin
  if not exists (
    select 1 from public.products
    group by name, category, duration
    having count(*) > 1
  ) then
    create unique index if not exists products_name_category_duration_uidx
      on public.products(name, category, duration);
  else
    raise notice 'Unique product variant index dilewati karena ada baris duplikat.';
  end if;
end $$;
create index if not exists transactions_customer_phone_idx on public.transactions(customer_phone);
create index if not exists transactions_status_idx on public.transactions(status);
create index if not exists products_status_idx on public.products(status, sort_order);
create index if not exists products_full_order_idx on public.products(sort_order, name, category_sort_order, category, variant_sort_order);
create index if not exists bot_instances_last_seen_idx on public.bot_instances(last_seen desc);
do $$ begin alter publication supabase_realtime add table public.transactions; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.products; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.bot_instances; exception when duplicate_object then null; end $$;
