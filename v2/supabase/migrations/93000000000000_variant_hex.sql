-- Per-variant swatch colour. Colours are global, but the same colour name can
-- have a different (sometimes mismatched) garment image per product. Storing a
-- hex per variant lets the swatch always match the actual image shown.
alter table public.variants add column if not exists hex text;
