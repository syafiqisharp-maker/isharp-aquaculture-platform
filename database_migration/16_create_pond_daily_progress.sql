-- ============================================================================
-- Migration: 16_create_pond_daily_progress.sql
-- Description: Daily Pond Progress & Event Tracking Table (Excel Data-Input sync)
--              Features Statement-Level InitPlan RLS (InitPlan speedup, zero 57014
--              timeouts, and passcode authorization via fn_can_write_field_ops).
--
-- How to apply:
--   Paste and run this entire script once in the Supabase Dashboard SQL Editor.
--   It is idempotent and safe to re-run at any time.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.pond_daily_progress (
    pond                 text PRIMARY KEY,               -- Physical pond e.g. '01.01.03' (Col B)
    module_no            text NOT NULL,                  -- Module e.g. '01' (Col O)
    row_no               text NOT NULL,                  -- Row e.g. '01' (Col A)
    status_code          text,                           -- Raw Col L: 'Hv','Cp','Cr','RW','Rw','Fw','Wc','Opr'
    raw_template_status  text,                           -- Raw Col Q: 'Status for template'
    progress_state       text NOT NULL,                  -- Normalized: 'CULTURE','IDLE','CLEANING','CLEANED','REPAIRED','WATER_CULTURE','READY'
    progress_label       text NOT NULL,                  -- Display: 'Culture','Idle','Cleaning','Cleaned','Repaired','Water Culture','Ready for Stocking'
    days_in_status       integer NOT NULL DEFAULT 0,     -- Clamped >= 0 from Col M
    map_code             text,                           -- Col N e.g. 'Wc+4', 'Wc+20 & BioA'
    status_start_date    date,                           -- Active stage date (MAX of Cols D..K)
    last_harvest_date    date,                           -- Col D (LAST_HARVEST_DT)
    clean_progress_date  date,                           -- Col E (CLEAN_PROGRESS)
    cleaning_done_date   date,                           -- Col F (CLEANING_DT)
    repair_progress_date date,                           -- Col G (REPAIR_PROGRESS)
    repair_done_date     date,                           -- Col H (REPAIR_DT)
    filled_water_date    date,                           -- Col I (FILLED_WTR_DT)
    water_treat_date     date,                           -- Col J (WTR_TREAT_DT)
    stocking_date        date,                           -- Col K (STOCKING_DT)
    pass_bioassay        boolean DEFAULT false,          -- Col P / S
    bioassay_date        date,                           -- Col S (DATE Bioassay)
    qaqc_date            date,                           -- Col V (Date QAQC)
    excel_as_of_date     date,                           -- Cell M1 snapshot date in Excel
    updated_at           timestamptz NOT NULL DEFAULT now()
);

-- Index for speedy queries by module and progress state
CREATE INDEX IF NOT EXISTS idx_pond_daily_progress_state ON public.pond_daily_progress (progress_state);
CREATE INDEX IF NOT EXISTS idx_pond_daily_progress_module ON public.pond_daily_progress (module_no);

-- Enable Row-Level Security
ALTER TABLE public.pond_daily_progress ENABLE ROW LEVEL SECURITY;

-- Clean existing policies for idempotency
DROP POLICY IF EXISTS "Allow dashboard read on pond_daily_progress" ON public.pond_daily_progress;
DROP POLICY IF EXISTS "Require supervisor or editor for insert on pond_daily_progress" ON public.pond_daily_progress;
DROP POLICY IF EXISTS "Require supervisor or editor for update on pond_daily_progress" ON public.pond_daily_progress;
DROP POLICY IF EXISTS "Require editor for delete on pond_daily_progress" ON public.pond_daily_progress;

-- 1. Read access: open to dashboard readers
CREATE POLICY "Allow dashboard read on pond_daily_progress"
    ON public.pond_daily_progress FOR SELECT
    USING (true);

-- 2. Write access (INSERT): requires Supervisor or Editor passcode header
CREATE POLICY "Require supervisor or editor for insert on pond_daily_progress"
    ON public.pond_daily_progress FOR INSERT
    WITH CHECK ((SELECT public.fn_can_write_field_ops()));

-- 3. Update access: requires Supervisor or Editor passcode header
CREATE POLICY "Require supervisor or editor for update on pond_daily_progress"
    ON public.pond_daily_progress FOR UPDATE
    USING ((SELECT public.fn_can_write_field_ops()))
    WITH CHECK ((SELECT public.fn_can_write_field_ops()));

-- 4. Delete access: requires Editor passcode header
CREATE POLICY "Require editor for delete on pond_daily_progress"
    ON public.pond_daily_progress FOR DELETE
    USING ((SELECT public.fn_can_write_dbms()));

COMMIT;
