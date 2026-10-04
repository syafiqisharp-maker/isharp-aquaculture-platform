-- Migration: 20261001_field_operations_schema_alignment.sql
-- Description: Align Field Operations database schema with backward-compatible views and audit columns.

-- 1. Add logged_by audit column to public.daily_pond_records if missing
ALTER TABLE public.daily_pond_records 
ADD COLUMN IF NOT EXISTS logged_by VARCHAR(50);

-- 2. Create backward-compatible alias view for daily growout records
CREATE OR REPLACE VIEW public.daily_growout_records AS
SELECT * FROM public.daily_pond_records;

-- 3. Create backward-compatible alias view for pond cycles
CREATE OR REPLACE VIEW public.pond_cycles AS
SELECT * FROM public.view_growout_pond_cycles;

-- 4. Grant access permissions on views to API roles
GRANT SELECT ON public.daily_growout_records TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON public.daily_growout_records TO anon, authenticated, service_role;
GRANT SELECT ON public.pond_cycles TO anon, authenticated, service_role;
