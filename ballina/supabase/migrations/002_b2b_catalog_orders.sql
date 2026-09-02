-- ===========================================================================
-- Ballina B2B Portal · schema for catalogue + orders with line items
-- Run this in the SQL editor of the NEW Supabase project.
-- ===========================================================================

-- --- Profiles (company per auth user) -------------------------------------
CREATE TABLE IF NOT EXISTS b2b_profiles (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email          TEXT NOT NULL,
  company        TEXT NOT NULL,
  contact_person TEXT,
  phone          TEXT,
  customer_number TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- --- Catalogue -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS b2b_products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku         TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  image_url   TEXT,
  base_price  NUMERIC(10,2) NOT NULL DEFAULT 0,
  category    TEXT,
  sizes       TEXT[] NOT NULL DEFAULT '{}',
  colors      TEXT[] NOT NULL DEFAULT '{}',
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- --- Orders + line items ---------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS b2b_order_seq START 500;

CREATE TABLE IF NOT EXISTS b2b_orders (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL DEFAULT ('2026-' || lpad(nextval('b2b_order_seq')::text, 4, '0')),
  status       TEXT NOT NULL DEFAULT 'offen'
               CHECK (status IN ('offen','in_bearbeitung','versendet','abgeschlossen','storniert')),
  total        NUMERIC(10,2) NOT NULL DEFAULT 0,
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS b2b_order_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID NOT NULL REFERENCES b2b_orders(id) ON DELETE CASCADE,
  product_id   TEXT NOT NULL,
  product_name TEXT NOT NULL,
  image_url    TEXT,
  color        TEXT NOT NULL,
  size         TEXT NOT NULL,
  quantity     INTEGER NOT NULL CHECK (quantity > 0),
  unit_price   NUMERIC(10,2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_b2b_profiles_user   ON b2b_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_b2b_orders_user     ON b2b_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_b2b_order_items_ord ON b2b_order_items(order_id);

-- --- Row Level Security ----------------------------------------------------
ALTER TABLE b2b_profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE b2b_products    ENABLE ROW LEVEL SECURITY;
ALTER TABLE b2b_orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE b2b_order_items ENABLE ROW LEVEL SECURITY;

-- Profiles: each user sees/edits only their own row
CREATE POLICY "own profile read"   ON b2b_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own profile write"  ON b2b_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own profile update" ON b2b_profiles FOR UPDATE USING (auth.uid() = user_id);

-- Products: any authenticated customer may browse the active catalogue
CREATE POLICY "catalogue read" ON b2b_products
  FOR SELECT USING (auth.role() = 'authenticated');

-- Orders: each user sees / creates only their own orders
CREATE POLICY "own orders read"   ON b2b_orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own orders insert" ON b2b_orders FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Order items: reachable only through an order the user owns
CREATE POLICY "own items read" ON b2b_order_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM b2b_orders o WHERE o.id = order_id AND o.user_id = auth.uid()));
CREATE POLICY "own items insert" ON b2b_order_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM b2b_orders o WHERE o.id = order_id AND o.user_id = auth.uid()));

-- --- updated_at trigger ----------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON b2b_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON b2b_orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
