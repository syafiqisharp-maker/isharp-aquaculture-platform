-- ============================================================================
-- Migration: 02_phase2_performance_tuning.sql
-- Description: Phase 2 Performance & Indexing Optimization
-- 1. Add covering index for foreign key on active_operational_ponds
-- 2. Drop duplicate unique indexes on biometrics_sampling, pond_harvest_daily, pond_issues
-- 3. Consolidate redundant permissive policies (resolving 105 advisor warnings)
-- ============================================================================

-- 1. Unindexed Foreign Key Fix
CREATE INDEX IF NOT EXISTS idx_active_operational_ponds_pond_index 
ON public.active_operational_ponds (pond_index);

-- 2. Drop Redundant Duplicate Unique Indexes
-- (uq_* indexes already guarantee uniqueness; idx_* WHERE IS NOT NULL are duplicates)
DROP INDEX IF EXISTS public.idx_sampling_index_no;
DROP INDEX IF EXISTS public.idx_harvest_index_no;
DROP INDEX IF EXISTS public.idx_issues_index_no;

-- 3. Consolidate Multiple Permissive Policies
-- Remove the redundant 'SELECT' policy on tables where 'ALL' already covers reads
DROP POLICY IF EXISTS "Allow read active gate" ON public.active_operational_ponds;
DROP POLICY IF EXISTS "Allow read sampling" ON public.biometrics_sampling;
DROP POLICY IF EXISTS "Allow read daily records" ON public.daily_pond_records;
DROP POLICY IF EXISTS "Allow read feed" ON public.feed_barrel_logs;
DROP POLICY IF EXISTS "Allow public read on growout_pond_feed_legacy" ON public.growout_pond_feed_legacy;
DROP POLICY IF EXISTS "Allow public read access on growout_pond_feed_sap" ON public.growout_pond_feed_sap;
DROP POLICY IF EXISTS "Allow public read on growout_pond_final_legacy" ON public.growout_pond_final_legacy;
DROP POLICY IF EXISTS "Allow read all" ON public.growout_pond_master;
DROP POLICY IF EXISTS "Allow read mineral_probiotic_used" ON public.mineral_probiotic_used;
DROP POLICY IF EXISTS "Allow read aerators" ON public.pond_aerator_inventory;
DROP POLICY IF EXISTS "Allow read harvest" ON public.pond_harvest_daily;
DROP POLICY IF EXISTS "Allow public read access on pond_harvest_plan" ON public.pond_harvest_plan;
DROP POLICY IF EXISTS "Allow read sales" ON public.pond_harvest_sales;
DROP POLICY IF EXISTS "Allow read inventory" ON public.pond_inventories;
DROP POLICY IF EXISTS "Allow read issues" ON public.pond_issues;
DROP POLICY IF EXISTS "Allow read notes" ON public.pond_notes;
DROP POLICY IF EXISTS "Allow read staff" ON public.pond_staff;
DROP POLICY IF EXISTS "Allow public read on pond_stocking_batches" ON public.pond_stocking_batches;
DROP POLICY IF EXISTS "Allow read wqs" ON public.water_quality_logs;
DROP POLICY IF EXISTS "Allow read weather" ON public.weather_logs;
