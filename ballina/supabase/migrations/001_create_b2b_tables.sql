-- B2B Profiles Table
CREATE TABLE IF NOT EXISTS b2b_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  company TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- B2B Orders Table
CREATE TABLE IF NOT EXISTS b2b_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  total DECIMAL(10, 2),
  status TEXT DEFAULT 'offen' CHECK (status IN ('offen', 'in_bearbeitung', 'abgeschlossen', 'storniert')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- B2B Inquiries Table
CREATE TABLE IF NOT EXISTS b2b_inquiries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company TEXT NOT NULL,
  contact_person TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  product_type TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  deadline DATE,
  message TEXT,
  status TEXT DEFAULT 'neu' CHECK (status IN ('neu', 'in_bearbeitung', 'angebot_gesendet', 'abgeschlossen')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_b2b_profiles_user_id ON b2b_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_b2b_orders_user_id ON b2b_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_b2b_inquiries_user_id ON b2b_inquiries(user_id);
CREATE INDEX IF NOT EXISTS idx_b2b_inquiries_status ON b2b_inquiries(status);

-- Enable Row Level Security
ALTER TABLE b2b_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE b2b_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE b2b_inquiries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for b2b_profiles
CREATE POLICY "Users can view own profile" ON b2b_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON b2b_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON b2b_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for b2b_orders
CREATE POLICY "Users can view own orders" ON b2b_orders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own orders" ON b2b_orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for b2b_inquiries
CREATE POLICY "Users can view own inquiries" ON b2b_inquiries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own inquiries" ON b2b_inquiries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admin policies (you may want to create a separate admin role)
CREATE POLICY "Admins can view all profiles" ON b2b_profiles
  FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admins can view all orders" ON b2b_orders
  FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admins can view all inquiries" ON b2b_inquiries
  FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admins can update inquiries" ON b2b_inquiries
  FOR UPDATE USING (auth.jwt() ->> 'role' = 'admin');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to auto-update updated_at
CREATE TRIGGER update_b2b_profiles_updated_at
  BEFORE UPDATE ON b2b_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_b2b_orders_updated_at
  BEFORE UPDATE ON b2b_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_b2b_inquiries_updated_at
  BEFORE UPDATE ON b2b_inquiries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
