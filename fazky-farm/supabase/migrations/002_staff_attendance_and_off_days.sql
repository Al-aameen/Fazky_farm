-- ==============================================================================
-- MIGRATION 002: Staff Attendance, Fixed Off-Days & Off-Day Monetization
-- Target Tables: workers, staff_attendance_roster, off_pays
-- ==============================================================================

-- Step 1: Add fixed off_day column to workers table
ALTER TABLE IF EXISTS public.workers 
ADD COLUMN IF NOT EXISTS off_day TEXT NOT NULL DEFAULT 'Sunday' 
CHECK (off_day IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'));

-- Step 2: Create staff_attendance_roster table
CREATE TABLE IF NOT EXISTS public.staff_attendance_roster (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'scheduled_off', 'worked_off_day')),
  payment_mode TEXT NOT NULL DEFAULT 'none' CHECK (payment_mode IN ('immediate', 'payroll', 'none')),
  compensation_amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (worker_id, date)
);

-- Step 3: Add payment tracking fields to off_pays
ALTER TABLE IF EXISTS public.off_pays 
ADD COLUMN IF NOT EXISTS payment_mode TEXT NOT NULL DEFAULT 'payroll' 
CHECK (payment_mode IN ('immediate', 'payroll', 'none'));

ALTER TABLE IF EXISTS public.off_pays 
ADD COLUMN IF NOT EXISTS expense_id UUID REFERENCES public.expenses_log(id) ON DELETE SET NULL;

-- Step 4: Security & Grants for staff_attendance_roster
ALTER TABLE public.staff_attendance_roster ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.staff_attendance_roster FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.staff_attendance_roster TO authenticated;

DROP POLICY IF EXISTS attendance_select_authenticated ON public.staff_attendance_roster;
CREATE POLICY attendance_select_authenticated ON public.staff_attendance_roster
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS attendance_manage_admin_manager ON public.staff_attendance_roster;
CREATE POLICY attendance_manage_admin_manager ON public.staff_attendance_roster
FOR ALL TO authenticated
USING (
  public.my_role() IN ('admin', 'manager')
);
