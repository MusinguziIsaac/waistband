-- ========================================================
-- WAISTBAND VOUCHER SYSTEM - COMPLETE SUPABASE SCHEMA
-- Run this script in your Supabase SQL Editor
-- ========================================================

-- Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- --------------------------------------------------------
-- 1. PROFILES TABLE (Linked to Supabase Auth)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  region TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own profile') THEN
    CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own profile') THEN
    CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own profile') THEN
    CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, region)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'region'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- --------------------------------------------------------
-- 2. VOUCHER PACKAGES TABLE
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.voucher_packages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  face_value NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'voucher_packages_face_value_key'
  ) THEN
    ALTER TABLE public.voucher_packages ADD CONSTRAINT voucher_packages_face_value_key UNIQUE (face_value);
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.voucher_packages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow read access to all authenticated users') THEN
    CREATE POLICY "Allow read access to all authenticated users" ON public.voucher_packages FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- Insert default package tiers using PRIMARY KEY (id) for conflict target
INSERT INTO public.voucher_packages (id, name, face_value)
VALUES 
  ('00000000-0000-4000-a000-000000000500', 'Economy', 500),
  ('00000000-0000-4000-a000-000000001000', 'Daily', 1000),
  ('00000000-0000-4000-a000-000000006000', 'Weekly', 6000),
  ('00000000-0000-4000-a000-000000020000', 'Monthly', 20000),
  ('00000000-0000-4000-a000-000000080000', 'Semester', 80000)
ON CONFLICT (id) DO UPDATE 
  SET name = EXCLUDED.name, face_value = EXCLUDED.face_value;

-- --------------------------------------------------------
-- 3. HOSTELS / RENTALS TABLE
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hostels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  marketer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  manager_name TEXT,
  phone TEXT,
  rooms_count INT DEFAULT 0,
  residents_count INT DEFAULT 0,
  status TEXT DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure residents_count exists (safe migration for older schemas)
ALTER TABLE public.hostels ADD COLUMN IF NOT EXISTS residents_count INT DEFAULT 0;

ALTER TABLE public.hostels ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own hostels') THEN
    CREATE POLICY "Users can manage their own hostels" ON public.hostels FOR ALL TO authenticated USING (auth.uid() = marketer_id) WITH CHECK (auth.uid() = marketer_id);
  END IF;
END $$;

-- --------------------------------------------------------
-- 4. AGENTS TABLE
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  marketer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  location TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own agents') THEN
    CREATE POLICY "Users can manage their own agents" ON public.agents FOR ALL TO authenticated USING (auth.uid() = marketer_id) WITH CHECK (auth.uid() = marketer_id);
  END IF;
END $$;

-- --------------------------------------------------------
-- 5. DAILY VOUCHER BALANCES TABLE (Stock from Boss)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_voucher_balances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  marketer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES public.voucher_packages(id) ON DELETE CASCADE,
  sales_date DATE NOT NULL DEFAULT CURRENT_DATE,
  initial_qty INT DEFAULT 0,
  opening_balance INT DEFAULT 0,
  additional_qty INT DEFAULT 0,
  additional_stock INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_marketer_date_pkg'
  ) THEN
    ALTER TABLE public.daily_voucher_balances 
      ADD CONSTRAINT unique_marketer_date_pkg UNIQUE (marketer_id, sales_date, package_id);
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.daily_voucher_balances ADD COLUMN IF NOT EXISTS initial_qty INT DEFAULT 0;
ALTER TABLE public.daily_voucher_balances ADD COLUMN IF NOT EXISTS opening_balance INT DEFAULT 0;
ALTER TABLE public.daily_voucher_balances ADD COLUMN IF NOT EXISTS additional_qty INT DEFAULT 0;
ALTER TABLE public.daily_voucher_balances ADD COLUMN IF NOT EXISTS additional_stock INT DEFAULT 0;

ALTER TABLE public.daily_voucher_balances ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own daily balances') THEN
    CREATE POLICY "Users can manage their own daily balances" ON public.daily_voucher_balances FOR ALL TO authenticated USING (auth.uid() = marketer_id) WITH CHECK (auth.uid() = marketer_id);
  END IF;
END $$;

-- --------------------------------------------------------
-- 6. VOUCHER DISTRIBUTIONS TABLE
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.voucher_distributions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  marketer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES public.voucher_packages(id) ON DELETE CASCADE,
  hostel_id UUID REFERENCES public.hostels(id) ON DELETE SET NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  dist_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.voucher_distributions ADD COLUMN IF NOT EXISTS hostel_id UUID REFERENCES public.hostels(id) ON DELETE SET NULL;
ALTER TABLE public.voucher_distributions ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE public.voucher_distributions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own distributions') THEN
    CREATE POLICY "Users can manage their own distributions" ON public.voucher_distributions FOR ALL TO authenticated USING (auth.uid() = marketer_id) WITH CHECK (auth.uid() = marketer_id);
  END IF;
END $$;

-- --------------------------------------------------------
-- 7. DIRECT SALES TABLE
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.direct_sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  marketer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES public.voucher_packages(id) ON DELETE CASCADE,
  hostel_id UUID REFERENCES public.hostels(id) ON DELETE SET NULL,
  quantity INT DEFAULT 0,
  quantity_sold INT DEFAULT 0,
  amount_received NUMERIC NOT NULL DEFAULT 0,
  sales_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.direct_sales ADD COLUMN IF NOT EXISTS quantity INT DEFAULT 0;
ALTER TABLE public.direct_sales ADD COLUMN IF NOT EXISTS quantity_sold INT DEFAULT 0;
ALTER TABLE public.direct_sales ADD COLUMN IF NOT EXISTS hostel_id UUID REFERENCES public.hostels(id) ON DELETE SET NULL;
ALTER TABLE public.direct_sales ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE public.direct_sales ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own direct sales') THEN
    CREATE POLICY "Users can manage their own direct sales" ON public.direct_sales FOR ALL TO authenticated USING (auth.uid() = marketer_id) WITH CHECK (auth.uid() = marketer_id);
  END IF;
END $$;

-- --------------------------------------------------------
-- 8. AGENT SALES TABLE
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agent_sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  marketer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES public.voucher_packages(id) ON DELETE CASCADE,
  hostel_id UUID REFERENCES public.hostels(id) ON DELETE SET NULL,
  quantity INT DEFAULT 0,
  quantity_sold INT DEFAULT 0,
  initial_vouchers_given INT DEFAULT 0,
  commission_amount NUMERIC DEFAULT 0,
  amount_received NUMERIC NOT NULL DEFAULT 0,
  sales_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.agent_sales ADD COLUMN IF NOT EXISTS quantity INT DEFAULT 0;
ALTER TABLE public.agent_sales ADD COLUMN IF NOT EXISTS quantity_sold INT DEFAULT 0;
ALTER TABLE public.agent_sales ADD COLUMN IF NOT EXISTS initial_vouchers_given INT DEFAULT 0;
ALTER TABLE public.agent_sales ADD COLUMN IF NOT EXISTS commission_amount NUMERIC DEFAULT 0;
ALTER TABLE public.agent_sales ADD COLUMN IF NOT EXISTS hostel_id UUID REFERENCES public.hostels(id) ON DELETE SET NULL;
ALTER TABLE public.agent_sales ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.agent_sales ADD COLUMN IF NOT EXISTS remarks TEXT;

ALTER TABLE public.agent_sales ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own agent sales') THEN
    CREATE POLICY "Users can manage their own agent sales" ON public.agent_sales FOR ALL TO authenticated USING (auth.uid() = marketer_id) WITH CHECK (auth.uid() = marketer_id);
  END IF;
END $$;

-- --------------------------------------------------------
-- 9. REPORTS TABLE
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  marketer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  summary_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'draft',
  submitted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own reports') THEN
    CREATE POLICY "Users can manage their own reports" ON public.reports FOR ALL TO authenticated USING (auth.uid() = marketer_id) WITH CHECK (auth.uid() = marketer_id);
  END IF;
END $$;

-- --------------------------------------------------------
-- 10. STORED PROCEDURES / RPC FUNCTIONS
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.distribute_vouchers(
  p_marketer_id UUID,
  p_agent_id UUID,
  p_package_id UUID,
  p_quantity INT,
  p_dist_date DATE,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_dist_id UUID;
BEGIN
  INSERT INTO public.voucher_distributions (
    marketer_id, agent_id, package_id, quantity, dist_date, notes
  ) VALUES (
    p_marketer_id, p_agent_id, p_package_id, p_quantity, p_dist_date, p_notes
  )
  RETURNING id INTO v_dist_id;
  
  RETURN v_dist_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable Realtime for all tables
DO $$ BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_voucher_balances;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.voucher_distributions;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_sales;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_sales;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.hostels;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- Reload Supabase Schema Cache
NOTIFY pgrst, 'reload schema';
