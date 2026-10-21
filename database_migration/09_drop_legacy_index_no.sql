-- ============================================================================
-- Migration: 09_drop_legacy_index_no.sql
-- Description: Backward-Compatible Deprecation of 'index_no' Column.
-- 
-- Architecture Best Practice (Expand and Contract Pattern):
-- 1. Drops all unique constraints and indexes on index_no so it NEVER causes 
--    sync conflicts or duplicate-key errors.
-- 2. Ensures index_no is an unconstrained, nullable column (INTEGER NULL).
--    This prevents runtime 400 Bad Request ("column does not exist") errors 
--    if any active browser tabs, mobile PWA workers, or cached bundles query it.
-- 3. Upgrades growout_pond_finance to use pond_index as its natural primary key.
-- ============================================================================

BEGIN;

-- 1. Drop residual indexes and unique constraints on index_no
DROP INDEX IF EXISTS public.idx_sampling_index_no;
DROP INDEX IF EXISTS public.idx_harvest_index_no;
DROP INDEX IF EXISTS public.idx_issues_index_no;

-- 2. Ensure index_no exists as a harmless nullable column on operational tables
-- (Guarantees backward compatibility for cached browser sessions and PWA clients)
ALTER TABLE public.pond_stocking_batches ADD COLUMN IF NOT EXISTS index_no INTEGER NULL;
ALTER TABLE public.biometrics_sampling ADD COLUMN IF NOT EXISTS index_no INTEGER NULL;
ALTER TABLE public.pond_harvest_daily ADD COLUMN IF NOT EXISTS index_no INTEGER NULL;
ALTER TABLE public.pond_harvest_sales ADD COLUMN IF NOT EXISTS index_no INTEGER NULL;
ALTER TABLE public.pond_issues ADD COLUMN IF NOT EXISTS index_no INTEGER NULL;
ALTER TABLE public.pond_notes ADD COLUMN IF NOT EXISTS index_no INTEGER NULL;
ALTER TABLE public.pond_harvest_plan ADD COLUMN IF NOT EXISTS index_no INTEGER NULL;

-- 3. Upgrade growout_pond_finance to use pond_index as natural primary key
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_schema = 'public' AND table_name = 'growout_pond_finance' AND constraint_type = 'PRIMARY KEY'
    ) THEN
        ALTER TABLE public.growout_pond_finance DROP CONSTRAINT growout_pond_finance_pkey;
    END IF;
    ALTER TABLE public.growout_pond_finance ADD COLUMN IF NOT EXISTS index_no INTEGER NULL;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_schema = 'public' AND table_name = 'growout_pond_finance' AND constraint_type = 'PRIMARY KEY'
    ) THEN
        ALTER TABLE public.growout_pond_finance ADD PRIMARY KEY (pond_index);
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Skipping growout_pond_finance PK update: %', SQLERRM;
END $$;

COMMIT;
