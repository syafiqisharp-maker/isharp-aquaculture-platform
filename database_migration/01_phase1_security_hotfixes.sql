-- ============================================================================
-- Migration: 01_phase1_security_hotfixes.sql
-- Description: Phase 1 Immediate Security Hotfixes
-- 1. Enable RLS on app_passwords with controlled read access
-- 2. Drop dangerous public write/update/delete policy on module_passwords
-- 3. Set security_invoker = true on public views
-- 4. Lock function search_path to 'public, pg_temp' on all custom functions
-- ============================================================================

-- 1. Enable RLS on app_passwords
ALTER TABLE public.app_passwords ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read app_passwords" ON public.app_passwords;
CREATE POLICY "Allow read app_passwords" 
ON public.app_passwords 
FOR SELECT 
TO public 
USING (true);

-- 2. Drop dangerous public write/update/delete policy on module_passwords
DROP POLICY IF EXISTS "Allow update module_passwords" ON public.module_passwords;

-- 3. Set security_invoker = true on views to respect caller permissions & RLS
ALTER VIEW public.daily_growout_records SET (security_invoker = true);
ALTER VIEW public.pond_cycles SET (security_invoker = true);
ALTER VIEW public.weather_hourly_summary SET (security_invoker = true);
ALTER VIEW public.view_pond_aeration_summary SET (security_invoker = true);
ALTER VIEW public.view_growout_pond_cycles SET (security_invoker = true);

-- 4. Secure function search_paths against hijacking
ALTER FUNCTION public.log_water_quality(varchar, numeric, numeric, numeric, numeric) SET search_path = public, pg_temp;
ALTER FUNCTION public.log_weather_telemetry(jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION public.fn_terminate_cycle(varchar, date, varchar, boolean) SET search_path = public, pg_temp;
ALTER FUNCTION public.fn_revive_cycle(varchar, boolean) SET search_path = public, pg_temp;
ALTER FUNCTION public.fn_trig_batch_stocking_to_production() SET search_path = public, pg_temp;
ALTER FUNCTION public.fn_delete_idle_cycle(varchar) SET search_path = public, pg_temp;
ALTER FUNCTION public.fn_close_and_create_next_cycle(varchar, date, varchar) SET search_path = public, pg_temp;
ALTER FUNCTION public.fn_create_custom_cycle(varchar, integer, numeric, varchar, date) SET search_path = public, pg_temp;
