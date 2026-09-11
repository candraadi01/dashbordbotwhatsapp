-- Menambahkan pengaturan urutan katalog tanpa menghapus data lama.
alter table public.products
  add column if not exists category_sort_order integer not null default 0;

alter table public.products
  add column if not exists variant_sort_order integer not null default 0;

create index if not exists products_full_order_idx
  on public.products(sort_order, name, category_sort_order, category, variant_sort_order);

notify pgrst, 'reload schema';

select 'Pengaturan urutan katalog siap digunakan' as hasil;
