-- Server-side snapshot of the cart + customer that a PaymentIntent was created
-- for. create-order and stripe-webhook build the order from this row, so an
-- order is created even when the browser closes right after payment.
-- Only Edge Functions (service_role) touch it: RLS on, no policies.
create table if not exists public.checkout_carts (
  payment_intent_id  text primary key,
  items              jsonb not null,
  customer           jsonb not null,
  created_at         timestamptz not null default now()
);
alter table public.checkout_carts enable row level security;

-- Contains personal data; old abandoned carts can be purged, e.g.:
--   delete from public.checkout_carts where created_at < now() - interval '30 days';
