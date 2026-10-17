-- Real artwork uploads. Until now "Druckdatei anhängen" only stored the file
-- NAME; the file itself never reached Ballina. Files now go to the private
-- bucket `artwork` under '<company_id>/…' and the path is stored on the order
-- item / inquiry. Customers can only write and read their own company folder.
-- Idempotent; run after 007.
begin;

alter table public.b2b_order_items add column if not exists artwork_path text;
alter table public.b2b_inquiries   add column if not exists artwork_name text;
alter table public.b2b_inquiries   add column if not exists artwork_path text;

-- Inquiries are inserted directly by customers: only allow their own folder.
create or replace function public.b2b_check_artwork_path()
  returns trigger
  language plpgsql set search_path = public, pg_temp as $$
begin
  if new.artwork_path is not null
     and split_part(new.artwork_path, '/', 1) <> coalesce(new.company_id::text, '') then
    raise exception 'artwork_path outside company folder';
  end if;
  return new;
end $$;
drop trigger if exists b2b_inquiries_check_artwork on public.b2b_inquiries;
create trigger b2b_inquiries_check_artwork
  before insert or update of artwork_path on public.b2b_inquiries
  for each row execute function public.b2b_check_artwork_path();

-- create_order: same as 007, plus validated artwork_path per item.
create or replace function public.create_order(p_items jsonb, p_meta jsonb default '{}'::jsonb)
  returns uuid
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_art       text;
  v_uid       uuid := auth.uid();
  v_cid       uuid := public.current_company_id();
  v_order     uuid;
  v_onum      text;
  v_item      jsonb;
  v_pid       text;
  v_color     text;
  v_size      text;
  v_qty       integer;
  v_name      text;
  v_img       text;
  v_price     numeric(10,2);
  v_exact     boolean;
  v_src       record;
  v_confirmed boolean := true;
  v_total     numeric(12,2) := 0;
  v_note      text;
begin
  if v_uid is null or v_cid is null then
    raise exception 'Nicht angemeldet oder kein Firmenprofil.' using errcode = '42501';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 200 then
    raise exception 'Ungültige Positionen (1–200 erwartet).' using errcode = '22023';
  end if;
  v_note := left(nullif(btrim(coalesce(p_meta ->> 'note', '')), ''), 2000);

  insert into b2b_orders (company_id, created_by, status, total, note, price_confirmed)
  values (v_cid, v_uid, 'offen', 0, v_note, true)
  returning id, order_number into v_order, v_onum;

  for v_item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'Ungültige Position.' using errcode = '22023';
    end if;
    v_pid   := left(nullif(btrim(coalesce(v_item ->> 'product_id', '')), ''), 100);
    v_color := left(nullif(btrim(coalesce(v_item ->> 'color', '')), ''), 100);
    v_size  := left(nullif(btrim(coalesce(v_item ->> 'size', '')), ''), 50);
    if v_pid is null or v_color is null or v_size is null then
      raise exception 'Position unvollständig (Produkt/Farbe/Größe).' using errcode = '22023';
    end if;
    if coalesce(v_item ->> 'quantity', '') !~ '^[0-9]{1,6}$' then
      raise exception 'Ungültige Menge.' using errcode = '22023';
    end if;
    v_qty := (v_item ->> 'quantity')::integer;
    if v_qty < 1 or v_qty > 100000 then
      raise exception 'Ungültige Menge.' using errcode = '22023';
    end if;

    select oi.unit_price, oi.quantity, oi.product_name, oi.image_url,
           (oi.color = v_color and oi.size = v_size) as exact
      into v_src
      from b2b_order_items oi
      join b2b_orders o on o.id = oi.order_id
     where o.company_id = v_cid
       and o.id <> v_order
       and o.status <> 'storniert'
       and o.price_confirmed
       and oi.product_id = v_pid
     order by (oi.color = v_color and oi.size = v_size) desc, o.created_at desc
     limit 1;

    if found then
      v_price := v_src.unit_price;
      v_name  := v_src.product_name;
      v_img   := coalesce(v_src.image_url, left(v_item ->> 'image_url', 1000));
      v_exact := v_src.exact and v_qty >= v_src.quantity;
    else
      v_price := 0;
      v_name  := left(nullif(btrim(coalesce(v_item ->> 'product_name', '')), ''), 200);
      v_img   := left(v_item ->> 'image_url', 1000);
      v_exact := false;
    end if;
    if v_name is null then v_name := 'Artikel ' || v_pid; end if;
    if not v_exact then v_confirmed := false; end if;

    -- artwork_path must point into this company's own artwork folder
    v_art := nullif(btrim(coalesce(v_item ->> 'artwork_path', '')), '');
    if v_art is not null and split_part(v_art, '/', 1) <> v_cid::text then
      v_art := null;
    end if;

    insert into b2b_order_items (order_id, product_id, product_name, image_url, color, size,
                                 quantity, unit_price, print_position, artwork_name, artwork_path)
    values (v_order, v_pid, v_name, v_img, v_color, v_size, v_qty, v_price,
            left(nullif(btrim(coalesce(v_item ->> 'print_position', '')), ''), 200),
            left(nullif(btrim(coalesce(v_item ->> 'artwork_name', '')), ''), 200),
            left(v_art, 500));
    v_total := v_total + v_qty * v_price;
  end loop;

  update b2b_orders set total = v_total, price_confirmed = v_confirmed where id = v_order;

  insert into b2b_audit_log (company_id, actor, action, entity, entity_id, meta)
  values (v_cid, v_uid, 'bestellung.angelegt', '#' || v_onum, v_order::text,
          jsonb_build_object('detail',
            case when v_confirmed then 'Bestellung über das Portal'
                 else 'Bestellung über das Portal – Preise zu bestätigen' end,
            'source', 'kunde'));
  return v_order;
end $$;


-- Storage bucket + policies (same pattern as `invoices` in 007).
do $$
begin
  if to_regclass('storage.buckets') is null or to_regclass('storage.objects') is null then
    raise notice 'storage schema not present — skipping artwork bucket';
    return;
  end if;
  insert into storage.buckets (id, name, public, file_size_limit)
  values ('artwork', 'artwork', false, 26214400) -- 25 MB
  on conflict (id) do update set public = false, file_size_limit = 26214400;

  execute 'drop policy if exists artwork_admin_all on storage.objects';
  execute $p$
    create policy artwork_admin_all on storage.objects for all to authenticated
      using (bucket_id = 'artwork' and public.is_admin())
      with check (bucket_id = 'artwork' and public.is_admin())
  $p$;
  execute 'drop policy if exists artwork_company_insert on storage.objects';
  execute $p$
    create policy artwork_company_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'artwork'
                  and split_part(name, '/', 1) = public.current_company_id()::text)
  $p$;
  execute 'drop policy if exists artwork_company_read on storage.objects';
  execute $p$
    create policy artwork_company_read on storage.objects for select to authenticated
      using (bucket_id = 'artwork'
             and split_part(name, '/', 1) = public.current_company_id()::text)
  $p$;
end $$;

commit;
