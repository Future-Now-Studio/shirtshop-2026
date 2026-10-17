-- The public read policies only applied to `anon`. A signed-in user without
-- admin rights (or an expired/stale admin session) then saw an empty shop:
-- no products, colours, sizes or reviews. Public data is public for every role.
alter policy "anon read colors"                     on public.colors                    to anon, authenticated;
alter policy "anon read sizes"                      on public.sizes                     to anon, authenticated;
alter policy "anon read discounts"                  on public.volume_discounts          to anon, authenticated;
alter policy "anon read published products"         on public.products                  to anon, authenticated;
alter policy "anon read variants of published"      on public.variants                  to anon, authenticated;
alter policy "anon read images of published"        on public.variant_images            to anon, authenticated;
alter policy "anon read product_sizes of published" on public.product_sizes             to anon, authenticated;
alter policy "anon read availability of published"  on public.variant_size_availability to anon, authenticated;
alter policy "anon read zones of published"         on public.print_zones               to anon, authenticated;
alter policy "anon read approved reviews"           on public.reviews                   to anon, authenticated;
