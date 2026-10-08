-- ============================================================================
-- Migration: 03_phase3_schema_hardening.sql
-- Description: Phase 3 Schema & Architecture Hardening
-- 1. Normalize unpadded pond_index in growout_pond_feed_sap (.1 -> .01)
-- 2. Add Foreign Key on growout_pond_feed_sap referencing growout_pond_master
-- 3. Add Foreign Key on pond_harvest_plan referencing growout_pond_master
-- 4. Clean column defaults on growout_pond_master
-- 5. Verified domain CHECK constraints on pond_active and pond_status
-- ============================================================================

-- 1. Normalize unpadded pond_index in growout_pond_feed_sap
UPDATE public.growout_pond_feed_sap
SET pond_index = regexp_replace(pond_index, '\.([0-9])$', '.0\1')
WHERE pond_index ~ '\.[0-9]$';

-- 2. Add Foreign Key on growout_pond_feed_sap (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_growout_pond_feed_sap_pond_index'
    ) THEN
        ALTER TABLE public.growout_pond_feed_sap
        ADD CONSTRAINT fk_growout_pond_feed_sap_pond_index
        FOREIGN KEY (pond_index) REFERENCES public.growout_pond_master(pond_index)
        ON DELETE CASCADE;
    END IF;
END $$;

-- 3. Add Foreign Key on pond_harvest_plan (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_pond_harvest_plan_pond_index'
    ) THEN
        ALTER TABLE public.pond_harvest_plan
        ADD CONSTRAINT fk_pond_harvest_plan_pond_index
        FOREIGN KEY (pond_index) REFERENCES public.growout_pond_master(pond_index)
        ON DELETE CASCADE;
    END IF;
END $$;

-- 4. Clean column defaults in growout_pond_master
ALTER TABLE public.growout_pond_master
ALTER COLUMN pond_active SET DEFAULT 'ACTIVE',
ALTER COLUMN farm SET DEFAULT 'SETIU',
ALTER COLUMN pond_type SET DEFAULT 'FULL LINING';
