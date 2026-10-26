-- Admin catalogue integrity (group v2-admin-catalog). Idempotent; safe to
-- re-run. New CHECK constraints are added NOT VALID first and then validated
-- one by one, so an old bad row only produces a warning instead of failing
-- the whole migration (new writes are always checked).

-- ---------------------------------------------------------------------------
-- 1) Coupons: no 150 % coupons, negative minimums or "-1 uses" (F33).
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.coupons'::regclass and conname = 'coupons_value_range') then
    alter table public.coupons add constraint coupons_value_range
      check (value > 0 and (kind <> 'percent' or value <= 100)) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.coupons'::regclass and conname = 'coupons_min_order_nonneg') then
    alter table public.coupons add constraint coupons_min_order_nonneg check (min_order >= 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.coupons'::regclass and conname = 'coupons_max_uses_positive') then
    alter table public.coupons add constraint coupons_max_uses_positive check (max_uses is null or max_uses >= 1) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.coupons'::regclass and conname = 'coupons_used_count_nonneg') then
    alter table public.coupons add constraint coupons_used_count_nonneg check (used_count >= 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.coupons'::regclass and conname = 'coupons_valid_range') then
    alter table public.coupons add constraint coupons_valid_range
      check (valid_from is null or valid_until is null or valid_from <= valid_until) not valid;
  end if;
  -- The checkout looks codes up as upper(trim(input)); other spellings could never match.
  if not exists (select 1 from pg_constraint where conrelid = 'public.coupons'::regclass and conname = 'coupons_code_format') then
    alter table public.coupons add constraint coupons_code_format
      check (code <> '' and code = btrim(code) and code = upper(code)) not valid;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2) Products: no negative prices (F34 CSV import, editor).
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.products'::regclass and conname = 'products_prices_nonneg') then
    alter table public.products add constraint products_prices_nonneg
      check (base_price >= 0 and design_element_price >= 0) not valid;
  end if;
end $$;

-- Validate what the existing data allows; report the rest.
do $$
declare
  c record;
begin
  for c in
    select conrelid::regclass as tbl, conname
      from pg_constraint
     where not convalidated
       and conname in ('coupons_value_range', 'coupons_min_order_nonneg', 'coupons_max_uses_positive',
                       'coupons_used_count_nonneg', 'coupons_valid_range', 'coupons_code_format',
                       'products_prices_nonneg')
  loop
    begin
      execute format('alter table %s validate constraint %I', c.tbl, c.conname);
    exception when check_violation then
      raise warning '% has rows violating %; fix them in the admin (new writes are checked already)', c.tbl, c.conname;
    end;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3) Volume discounts: one tier per quantity (F109). Exact duplicates are
--    removed; conflicting ones (same quantity, different %) are left for the
--    admin to resolve (Admin → Rabatte marks them) and the index is skipped.
-- ---------------------------------------------------------------------------
delete from public.volume_discounts d
 using public.volume_discounts k
 where d.min_qty = k.min_qty
   and d.discount_percent = k.discount_percent
   and d.id > k.id;

do $$
begin
  if not exists (select 1 from pg_class where relname = 'volume_discounts_min_qty_key' and relnamespace = 'public'::regnamespace) then
    if exists (select 1 from public.volume_discounts group by min_qty having count(*) > 1) then
      raise warning 'volume_discounts: conflicting tiers with the same min_qty – delete one in Admin → Rabatte, then create the unique index volume_discounts_min_qty_key';
    else
      create unique index volume_discounts_min_qty_key on public.volume_discounts (min_qty);
    end if;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4) product-images bucket: only web images, at most 5 MB each (F40). The
--    admin compresses larger photos in the browser before uploading.
-- ---------------------------------------------------------------------------
update storage.buckets
   set file_size_limit = 5242880,
       allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']
 where id = 'product-images';

-- ---------------------------------------------------------------------------
-- 5) Never break order history (F39): order_items only keep ids (product,
--    variant, size) and the admin order view joins the live catalogue, so a
--    product, colour variant or size that was ordered must not be deleted.
--    Products are taken out of the shop by setting them to "Entwurf".
--    Only API requests by signed-in users are guarded; the service role
--    (scripts) and direct SQL sessions (maintenance) are exempt.
-- ---------------------------------------------------------------------------
create or replace function public.guard_ordered_catalog_delete()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if session_user <> 'authenticator'
     or coalesce(auth.role(), current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') = 'service_role' then
    return old;
  end if;
  if tg_table_name = 'products' and exists (select 1 from public.order_items where product_id = old.id) then
    raise exception 'Das Produkt wurde bereits bestellt und kann nicht gelöscht werden. Setze es stattdessen auf „Entwurf“.'
      using errcode = '23503';
  elsif tg_table_name = 'variants' and exists (select 1 from public.order_items where variant_id = old.id) then
    raise exception 'Diese Farbe wurde bereits bestellt und kann nicht gelöscht werden. Setze stattdessen ihren Bestand auf 0.'
      using errcode = '23503';
  elsif tg_table_name = 'sizes' and exists (select 1 from public.order_items where size_id = old.id) then
    raise exception 'Diese Größe wurde bereits bestellt und kann nicht gelöscht werden.'
      using errcode = '23503';
  end if;
  return old;
end $$;
revoke all on function public.guard_ordered_catalog_delete() from public, anon, authenticated;

drop trigger if exists guard_ordered_delete on public.products;
create trigger guard_ordered_delete before delete on public.products
  for each row execute function public.guard_ordered_catalog_delete();
drop trigger if exists guard_ordered_delete on public.variants;
create trigger guard_ordered_delete before delete on public.variants
  for each row execute function public.guard_ordered_catalog_delete();
drop trigger if exists guard_ordered_delete on public.sizes;
create trigger guard_ordered_delete before delete on public.sizes
  for each row execute function public.guard_ordered_catalog_delete();

-- ---------------------------------------------------------------------------
-- 6) Low stock (F38 / P21): configurable warning threshold plus an admin-only
--    reorder list across all products. Only sizes enabled for the product
--    count (F117: stock on a disabled size is not sellable).
-- ---------------------------------------------------------------------------
alter table public.settings add column if not exists low_stock_threshold integer not null default 5;
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.settings'::regclass and conname = 'settings_low_stock_threshold_range') then
    alter table public.settings add constraint settings_low_stock_threshold_range
      check (low_stock_threshold between 0 and 100000);
  end if;
end $$;

-- security_invoker: the caller's RLS applies (settings are admin-only, so
-- everyone else gets an empty list).
create or replace view public.low_stock with (security_invoker = true) as
select p.id            as product_id,
       p.name          as product_name,
       p.status        as product_status,
       v.id            as variant_id,
       c.name          as color_name,
       v.sort_order    as variant_sort,
       s.id            as size_id,
       s.name          as size_name,
       s.sort_order    as size_sort,
       a.stock,
       a.available,
       t.low_stock_threshold as threshold
  from public.variant_size_availability a
  join public.variants v       on v.id = a.variant_id
  join public.products p       on p.id = v.product_id
  join public.colors c         on c.id = v.color_id
  join public.sizes s          on s.id = a.size_id
  join public.product_sizes ps on ps.product_id = p.id and ps.size_id = a.size_id
  join public.settings t       on t.id = 1
 where a.stock < greatest(t.low_stock_threshold, 1);

revoke all on public.low_stock from public, anon, authenticated;
grant select on public.low_stock to authenticated;

-- ---------------------------------------------------------------------------
-- 7) Duplicate a product (P31): copies the product as a draft with a free
--    "-kopie" slug, its colour variants, enabled sizes, size matrix (stock
--    reset to 0) and print zones. Runs with the caller's rights (admin RLS).
--    The admin page copies the variant images afterwards (storage) using the
--    returned variant id mapping [{from, to}].
-- ---------------------------------------------------------------------------
create or replace function public.duplicate_product(p_id uuid, p_name text default null)
  returns jsonb
  language plpgsql
  set search_path = public
as $$
declare
  src public.products;
  v_id uuid := gen_random_uuid();
  v_base text;
  v_slug text;
  v_n int := 1;
  v_map jsonb := '[]'::jsonb;
  r public.variants;
  v_variant uuid;
begin
  if not public.is_admin() then
    raise exception 'Keine Berechtigung.' using errcode = '42501';
  end if;
  select * into src from public.products where id = p_id;
  if not found then
    raise exception 'Produkt nicht gefunden.' using errcode = 'P0002';
  end if;

  v_base := left(src.slug, 180) || '-kopie';
  v_slug := v_base;
  while exists (select 1 from public.products where slug = v_slug) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;

  -- jsonb_populate_record copies every column (also ones added later).
  insert into public.products
  select * from jsonb_populate_record(null::public.products,
    to_jsonb(src) || jsonb_build_object(
      'id', v_id,
      'slug', v_slug,
      'name', coalesce(nullif(btrim(p_name), ''), src.name || ' (Kopie)'),
      'status', 'draft',
      'created_at', now(),
      'updated_at', now()));

  for r in select * from public.variants where product_id = p_id order by sort_order, created_at loop
    v_variant := gen_random_uuid();
    insert into public.variants
    select * from jsonb_populate_record(null::public.variants,
      to_jsonb(r) || jsonb_build_object('id', v_variant, 'product_id', v_id, 'created_at', now()));
    insert into public.variant_size_availability (variant_id, size_id, available, stock)
      select v_variant, size_id, available, 0
        from public.variant_size_availability where variant_id = r.id;
    v_map := v_map || jsonb_build_array(jsonb_build_object('from', r.id, 'to', v_variant));
  end loop;

  insert into public.product_sizes (product_id, size_id)
    select v_id, size_id from public.product_sizes where product_id = p_id;

  insert into public.print_zones
  select z.* from public.print_zones pz,
    lateral jsonb_populate_record(null::public.print_zones,
      to_jsonb(pz) || jsonb_build_object('id', gen_random_uuid(), 'product_id', v_id)) z
   where pz.product_id = p_id;

  return jsonb_build_object('id', v_id, 'slug', v_slug, 'variants', v_map);
end $$;
revoke all on function public.duplicate_product(uuid, text) from public, anon;
grant execute on function public.duplicate_product(uuid, text) to authenticated;
