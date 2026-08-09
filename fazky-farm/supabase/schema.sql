-- FAZKY Farm Management System Database Schema
-- Location: supabase/schema.sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Workers Table
CREATE TABLE IF NOT EXISTS workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE, -- Links to auth.users (nullable if invited but not registered)
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'staff')),
  base_salary NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('active', 'invited', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Pen Blocks Table
CREATE TABLE IF NOT EXISTS pen_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL, -- A, B, C, D...
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Pens Table
CREATE TABLE IF NOT EXISTS pens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pen_block_id UUID NOT NULL REFERENCES pen_blocks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  worker_id UUID REFERENCES workers(id) ON DELETE SET NULL,
  has_sides BOOLEAN NOT NULL DEFAULT FALSE,
  slot_count INT NOT NULL DEFAULT 15,
  generation TEXT,
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(pen_block_id, name)
);

-- 4. Census Counts Table
CREATE TABLE IF NOT EXISTS census_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pen_id UUID NOT NULL REFERENCES pens(id) ON DELETE CASCADE,
  side TEXT NOT NULL CHECK (side IN ('left', 'right', 'single')),
  slot_number INT NOT NULL,
  bird_count INT NOT NULL DEFAULT 0 CHECK (bird_count >= 0),
  date DATE NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(pen_id, side, slot_number, date)
);

-- 5. General Census Table
CREATE TABLE IF NOT EXISTS general_census (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL, -- e.g. Turkeys, Rabbits, Broilers
  type_breed TEXT NOT NULL,
  male INT NOT NULL DEFAULT 0 CHECK (male >= 0),
  female INT NOT NULL DEFAULT 0 CHECK (female >= 0),
  unsexed INT NOT NULL DEFAULT 0 CHECK (unsexed >= 0),
  total INT GENERATED ALWAYS AS (male + female + unsexed) STORED,
  date DATE NOT NULL,
  vendor TEXT,
  unit_price NUMERIC NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Production Log Table
CREATE TABLE IF NOT EXISTS production_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pen_id UUID NOT NULL REFERENCES pens(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  day_of_week TEXT NOT NULL,
  morning_eggs INT NOT NULL DEFAULT 0 CHECK (morning_eggs >= 0),
  evening_eggs INT NOT NULL DEFAULT 0 CHECK (evening_eggs >= 0),
  total_eggs INT GENERATED ALWAYS AS (morning_eggs + evening_eggs) STORED,
  morning_feed NUMERIC NOT NULL DEFAULT 0 CHECK (morning_feed >= 0),
  evening_feed NUMERIC NOT NULL DEFAULT 0 CHECK (evening_feed >= 0),
  total_feed NUMERIC GENERATED ALWAYS AS (morning_feed + evening_feed) STORED,
  mortality INT NOT NULL DEFAULT 0 CHECK (mortality >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(pen_id, date)
);

-- 7. Sales Log Table
CREATE TABLE IF NOT EXISTS sales_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  day_of_week TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  crates INT NOT NULL DEFAULT 0 CHECK (crates >= 0),
  cash_paid NUMERIC NOT NULL DEFAULT 0 CHECK (cash_paid >= 0),
  transfer_amount NUMERIC NOT NULL DEFAULT 0 CHECK (transfer_amount >= 0),
  deposit_amount NUMERIC NOT NULL DEFAULT 0 CHECK (deposit_amount >= 0),
  is_payment BOOLEAN NOT NULL DEFAULT FALSE,
  remarks TEXT,
  created_by UUID REFERENCES workers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Egg Price Settings Table
CREATE TABLE IF NOT EXISTS egg_price_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  price_per_crate NUMERIC NOT NULL CHECK (price_per_crate >= 0),
  effective_date DATE NOT NULL,
  set_by UUID REFERENCES workers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Expenses Log Table
CREATE TABLE IF NOT EXISTS expenses_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  day_of_week TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  remarks TEXT,
  created_by UUID REFERENCES workers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Maize Records Table
CREATE TABLE IF NOT EXISTS maize_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  seller_name TEXT NOT NULL,
  kg_procured NUMERIC NOT NULL CHECK (kg_procured >= 0),
  bag_number INT NOT NULL DEFAULT 0 CHECK (bag_number >= 0),
  total_amount NUMERIC NOT NULL CHECK (total_amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. Feed Production Table
CREATE TABLE IF NOT EXISTS feed_production (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  maize_kg NUMERIC NOT NULL DEFAULT 0 CHECK (maize_kg >= 0),
  wheat_offal_bags INT NOT NULL DEFAULT 0 CHECK (wheat_offal_bags >= 0),
  concentrate_bags INT NOT NULL DEFAULT 0 CHECK (concentrate_bags >= 0),
  soya_beans_qty NUMERIC NOT NULL DEFAULT 0 CHECK (soya_beans_qty >= 0),
  premix_qty NUMERIC NOT NULL DEFAULT 0 CHECK (premix_qty >= 0),
  feed_produced_tonnes NUMERIC NOT NULL DEFAULT 0 CHECK (feed_produced_tonnes >= 0),
  bags_produced INT NOT NULL DEFAULT 0 CHECK (bags_produced >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. Loans Table
CREATE TABLE IF NOT EXISTS loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  total_borrowed NUMERIC NOT NULL CHECK (total_borrowed >= 0),
  duration_months INT NOT NULL CHECK (duration_months > 0),
  monthly_amount NUMERIC NOT NULL CHECK (monthly_amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. Loan Repayments Table
CREATE TABLE IF NOT EXISTS loan_repayments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  amount_repayable NUMERIC NOT NULL CHECK (amount_repayable >= 0),
  repayment_made NUMERIC NOT NULL DEFAULT 0 CHECK (repayment_made >= 0),
  balance NUMERIC NOT NULL CHECK (balance >= 0),
  comments TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. Off-Pays Table
CREATE TABLE IF NOT EXISTS off_pays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. Feed Inventory Table (Phase 2)
CREATE TABLE IF NOT EXISTS feed_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name TEXT UNIQUE NOT NULL,
  unit TEXT NOT NULL, -- e.g. kg, bags
  current_stock NUMERIC NOT NULL DEFAULT 0,
  low_stock_threshold NUMERIC NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 16. Feed Inventory Log Table (Phase 2)
CREATE TABLE IF NOT EXISTS feed_inventory_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID NOT NULL REFERENCES feed_inventory(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  change_amount NUMERIC NOT NULL,
  change_type TEXT NOT NULL CHECK (change_type IN ('restock', 'consumption', 'adjustment')),
  source TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =========================================================================
-- HELPER FUNCTIONS & RLS SECURITY
-- =========================================================================

-- Helper: Get current worker role
CREATE OR REPLACE FUNCTION my_role()
RETURNS TEXT AS $$
  SELECT role FROM workers WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper: Get current worker ID
CREATE OR REPLACE FUNCTION my_worker_id()
RETURNS UUID AS $$
  SELECT id FROM workers WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Enable Row Level Security on all tables
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pen_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE pens ENABLE ROW LEVEL SECURITY;
ALTER TABLE census_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE general_census ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE egg_price_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE maize_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_production ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_repayments ENABLE ROW LEVEL SECURITY;
ALTER TABLE off_pays ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_inventory_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Workers policies
CREATE POLICY workers_select ON workers FOR SELECT USING (
  auth.uid() = auth_user_id OR my_role() IN ('admin', 'manager')
);
CREATE POLICY workers_all_admin ON workers FOR ALL USING (
  my_role() = 'admin'
);

-- Pen Blocks policies
CREATE POLICY pen_blocks_select ON pen_blocks FOR SELECT USING (
  auth.role() = 'authenticated'
);
CREATE POLICY pen_blocks_all_admin ON pen_blocks FOR ALL USING (
  my_role() = 'admin'
);

-- Pens policies
CREATE POLICY pens_select ON pens FOR SELECT USING (
  my_role() IN ('admin', 'manager') OR worker_id = my_worker_id()
);
CREATE POLICY pens_all_admin ON pens FOR ALL USING (
  my_role() = 'admin'
);

-- Census Counts policies
CREATE POLICY census_counts_select ON census_counts FOR SELECT USING (
  my_role() IN ('admin', 'manager') OR pen_id IN (SELECT id FROM pens WHERE worker_id = my_worker_id())
);
CREATE POLICY census_counts_modify ON census_counts FOR ALL USING (
  my_role() IN ('admin', 'manager') OR pen_id IN (SELECT id FROM pens WHERE worker_id = my_worker_id())
);

-- General Census policies
CREATE POLICY general_census_all ON general_census FOR ALL USING (
  my_role() IN ('admin', 'manager')
);

-- Production Log policies
CREATE POLICY production_log_select ON production_log FOR SELECT USING (
  my_role() IN ('admin', 'manager') OR pen_id IN (SELECT id FROM pens WHERE worker_id = my_worker_id())
);
CREATE POLICY production_log_modify ON production_log FOR ALL USING (
  my_role() IN ('admin', 'manager') OR pen_id IN (SELECT id FROM pens WHERE worker_id = my_worker_id())
);

-- Sales Log policies
CREATE POLICY sales_log_all ON sales_log FOR ALL USING (
  my_role() IN ('admin', 'manager')
);

-- Egg Price Settings policies
CREATE POLICY egg_price_settings_select ON egg_price_settings FOR SELECT USING (
  auth.role() = 'authenticated'
);
CREATE POLICY egg_price_settings_all_admin ON egg_price_settings FOR ALL USING (
  my_role() = 'admin'
);

-- Expenses Log policies
CREATE POLICY expenses_log_all ON expenses_log FOR ALL USING (
  my_role() IN ('admin', 'manager')
);

-- Maize Records policies
CREATE POLICY maize_records_all ON maize_records FOR ALL USING (
  my_role() IN ('admin', 'manager')
);

-- Feed Production policies
CREATE POLICY feed_production_all ON feed_production FOR ALL USING (
  my_role() IN ('admin', 'manager')
);

-- Loans policies
CREATE POLICY loans_all ON loans FOR ALL USING (
  my_role() = 'admin'
);

-- Loan Repayments policies
CREATE POLICY loan_repayments_all ON loan_repayments FOR ALL USING (
  my_role() = 'admin'
);

-- Off-pays policies
CREATE POLICY off_pays_all ON off_pays FOR ALL USING (
  my_role() = 'admin'
);

-- Feed Inventory policies
CREATE POLICY feed_inventory_select ON feed_inventory FOR SELECT USING (
  my_role() IN ('admin', 'manager')
);
CREATE POLICY feed_inventory_all_admin ON feed_inventory FOR ALL USING (
  my_role() = 'admin'
);

-- Feed Inventory Log policies
CREATE POLICY feed_inventory_log_select ON feed_inventory_log FOR SELECT USING (
  my_role() IN ('admin', 'manager')
);
CREATE POLICY feed_inventory_log_all_admin ON feed_inventory_log FOR ALL USING (
  my_role() = 'admin'
);


-- =========================================================================
-- DATABASE TRIGGERS
-- =========================================================================

-- Trigger function: Mortality Auto-Deduction from Census Matrix
CREATE OR REPLACE FUNCTION handle_production_mortality()
RETURNS TRIGGER AS $$
DECLARE
  r RECORD;
  deduction INT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    deduction := NEW.mortality - COALESCE(OLD.mortality, 0);
  ELSE
    deduction := NEW.mortality;
  END IF;

  IF deduction <> 0 THEN
    -- Find and subtract from census count slots sequentially, starting from slot 1
    FOR r IN 
      SELECT id, bird_count, slot_number 
      FROM census_counts 
      WHERE pen_id = NEW.pen_id AND date = NEW.date 
      ORDER BY slot_number ASC
    LOOP
      IF deduction > 0 THEN
        IF r.bird_count >= deduction THEN
          UPDATE census_counts 
          SET bird_count = bird_count - deduction 
          WHERE id = r.id;
          deduction := 0;
          EXIT;
        ELSE
          UPDATE census_counts 
          SET bird_count = 0 
          WHERE id = r.id;
          deduction := deduction - r.bird_count;
        END IF;
      ELSIF deduction < 0 THEN
        -- Add birds back if typo was corrected
        UPDATE census_counts 
        SET bird_count = bird_count - deduction -- double minus is addition
        WHERE id = r.id;
        deduction := 0;
        EXIT;
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER production_mortality_trigger
AFTER INSERT OR UPDATE ON production_log
FOR EACH ROW
EXECUTE FUNCTION handle_production_mortality();


-- Trigger function: Feed Inventory Auto-Deduction (Phase 2)
CREATE OR REPLACE FUNCTION handle_production_feed_deduction()
RETURNS TRIGGER AS $$
DECLARE
  feed_used NUMERIC;
  old_feed NUMERIC;
  diff NUMERIC;
  inv_id UUID;
BEGIN
  feed_used := COALESCE(NEW.morning_feed, 0) + COALESCE(NEW.evening_feed, 0);
  
  IF TG_OP = 'UPDATE' THEN
    old_feed := COALESCE(OLD.morning_feed, 0) + COALESCE(OLD.evening_feed, 0);
    diff := feed_used - old_feed;
  ELSE
    diff := feed_used;
  END IF;

  IF diff <> 0 THEN
    -- Look for 'Layers Feed' in inventory
    SELECT id INTO inv_id FROM feed_inventory WHERE item_name = 'Layers Feed' LIMIT 1;
    
    IF inv_id IS NOT NULL THEN
      UPDATE feed_inventory 
      SET current_stock = current_stock - diff,
          last_updated = NOW()
      WHERE id = inv_id;
      
      INSERT INTO feed_inventory_log (inventory_id, date, change_amount, change_type, source, notes)
      VALUES (inv_id, NEW.date, -diff, 'consumption', 'Production Log', 'Auto-deduction from Production Log (Pen ID: ' || NEW.pen_id || ')');
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER production_feed_deduction_trigger
AFTER INSERT OR UPDATE ON production_log
FOR EACH ROW
EXECUTE FUNCTION handle_production_feed_deduction();
