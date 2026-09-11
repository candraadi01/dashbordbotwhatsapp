-- Memperbaiki error:
-- duplicate key value violates unique constraint "products_name_key"

alter table public.products
  drop constraint if exists products_name_key;

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
    raise notice 'Index unik varian belum dibuat karena ada produk dengan nama, kategori, dan durasi yang sama persis.';
  end if;
end $$;

notify pgrst, 'reload schema';

select 'Produk sekarang mendukung banyak kategori dan durasi' as hasil;
