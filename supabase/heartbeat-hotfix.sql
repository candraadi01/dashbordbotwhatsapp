-- Jalankan sekali di Supabase SQL Editor jika Monitoring menampilkan
-- "Could not find the table public.bot_instances in the schema cache".

create table if not exists public.bot_instances (
  id text primary key,
  name text not null,
  status text not null default 'starting'
    check (status in ('starting', 'online', 'offline', 'error')),
  version text,
  last_seen timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.bot_instances enable row level security;

grant select on table public.bot_instances to authenticated;
grant all on table public.bot_instances to service_role;

drop policy if exists "read bot status" on public.bot_instances;
create policy "read bot status"
on public.bot_instances
for select
to authenticated
using (public.current_role() in ('OWNER', 'ADMIN', 'STAFF'));

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'bot_instances'
  ) then
    alter publication supabase_realtime add table public.bot_instances;
  end if;
end $$;

notify pgrst, 'reload schema';

select 'bot_instances siap' as hasil;
