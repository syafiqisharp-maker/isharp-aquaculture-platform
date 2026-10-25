-- ==============================================================================
-- Migration 13: Comprehensive Security Hardening (pgcrypto, RLS & RPC Guards)
-- Description:
--   1. Enables pgcrypto and hashes passcodes in app_passwords & module_passwords.
--   2. Revokes public/anon SELECT/INSERT/UPDATE/DELETE on password tables.
--   3. Creates server-side pgcrypto verification RPCs (fn_verify_dbms_passcode,
--      fn_verify_field_ops_passcode) and request-header role evaluator (fn_get_request_role).
--   4. Replaces permissive FOR ALL USING (true) RLS policies across all farm tables
--      so anonymous users cannot modify, overwrite, or delete farm data, nor dump
--      confidential financial ledgers (growout_pond_finance).
--   5. Enforces Editor-only authorization inside SECURITY DEFINER lifecycle RPCs.
-- ==============================================================================

BEGIN;

-- 1. Enable pgcrypto extension for bcrypt password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 2. Upgrade app_passwords & module_passwords with bcrypt hashes and revoke anon access
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'app_passwords') THEN
        ALTER TABLE public.app_passwords ADD COLUMN IF NOT EXISTS password_hash text;
        UPDATE public.app_passwords
        SET password_hash = extensions.crypt(lower(trim(password)), extensions.gen_salt('bf', 10))
        WHERE password IS NOT NULL AND password_hash IS NULL;

        ALTER TABLE public.app_passwords ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Allow read app_passwords" ON public.app_passwords;
        DROP POLICY IF EXISTS "Allow all app_passwords" ON public.app_passwords;
        REVOKE ALL ON public.app_passwords FROM anon, authenticated;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'module_passwords') THEN
        ALTER TABLE public.module_passwords ADD COLUMN IF NOT EXISTS password_hash text;
        UPDATE public.module_passwords
        SET password_hash = extensions.crypt(lower(trim(access_password)), extensions.gen_salt('bf', 10))
        WHERE access_password IS NOT NULL AND password_hash IS NULL;

        ALTER TABLE public.module_passwords ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Allow read module_passwords" ON public.module_passwords;
        DROP POLICY IF EXISTS "Allow update module_passwords" ON public.module_passwords;
        DROP POLICY IF EXISTS "Allow all module_passwords" ON public.module_passwords;
        REVOKE ALL ON public.module_passwords FROM anon, authenticated;
    END IF;
END $$;

-- ==============================================================================
-- 3. Server-Side Passcode Verification & Header Role Functions (SECURITY DEFINER)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.fn_verify_dbms_passcode(p_passcode text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_clean text := lower(trim(COALESCE(p_passcode, '')));
    v_editor_match boolean := false;
    v_viewer_match boolean := false;
BEGIN
    IF v_clean = '' THEN
        RETURN NULL;
    END IF;

    -- 1. Check Editor password in app_passwords
    SELECT EXISTS (
        SELECT 1 FROM public.app_passwords
        WHERE key = 'dbms_editor'
          AND (
              (password_hash IS NOT NULL AND password_hash = extensions.crypt(v_clean, password_hash))
              OR lower(trim(password)) = v_clean
          )
    ) INTO v_editor_match;

    IF v_editor_match THEN
        RETURN 'EDITOR';
    END IF;

    -- 2. Check Viewer / Manager Master in app_passwords or legacy fallback
    IF v_clean IN ('isharp', 'monodon') THEN
        RETURN 'VIEWER';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.app_passwords
        WHERE key IN ('dbms_viewer', 'manager_master')
          AND (
              (password_hash IS NOT NULL AND password_hash = extensions.crypt(v_clean, password_hash))
              OR lower(trim(password)) = v_clean
          )
    ) INTO v_viewer_match;

    IF v_viewer_match THEN
        RETURN 'VIEWER';
    END IF;

    -- 3. Check if passcode matches any module supervisor password
    SELECT EXISTS (
        SELECT 1 FROM public.module_passwords
        WHERE (password_hash IS NOT NULL AND password_hash = extensions.crypt(v_clean, password_hash))
           OR lower(trim(access_password)) = v_clean
    ) INTO v_viewer_match;

    IF v_viewer_match THEN
        RETURN 'VIEWER';
    END IF;

    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_verify_field_ops_passcode(p_module_no integer, p_passcode text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_clean text := lower(trim(COALESCE(p_passcode, '')));
    v_sup_match boolean := false;
    v_view_match boolean := false;
BEGIN
    IF v_clean = '' THEN
        RETURN NULL;
    END IF;

    -- 1. Check module-specific passcode
    SELECT EXISTS (
        SELECT 1 FROM public.module_passwords
        WHERE module_no = p_module_no
          AND (
              (password_hash IS NOT NULL AND password_hash = extensions.crypt(v_clean, password_hash))
              OR lower(trim(access_password)) = v_clean
          )
    ) INTO v_sup_match;

    IF v_sup_match THEN
        RETURN 'SUPERVISOR';
    END IF;

    -- 2. Check manager_master or dbms_editor override
    SELECT EXISTS (
        SELECT 1 FROM public.app_passwords
        WHERE key IN ('manager_master', 'dbms_editor')
          AND (
              (password_hash IS NOT NULL AND password_hash = extensions.crypt(v_clean, password_hash))
              OR lower(trim(password)) = v_clean
          )
    ) INTO v_sup_match;

    IF v_sup_match THEN
        RETURN 'SUPERVISOR';
    END IF;

    -- 3. Check universal viewer
    IF v_clean IN ('isharp', 'monodon') THEN
        RETURN 'VIEWER';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.app_passwords
        WHERE key = 'dbms_viewer'
          AND (
              (password_hash IS NOT NULL AND password_hash = extensions.crypt(v_clean, password_hash))
              OR lower(trim(password)) = v_clean
          )
    ) INTO v_view_match;

    IF v_view_match THEN
        RETURN 'VIEWER';
    END IF;

    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_get_request_role()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_headers_raw text;
    v_passcode text;
BEGIN
    -- Service role always has full administrative privileges
    IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
        RETURN 'EDITOR';
    END IF;

    v_headers_raw := current_setting('request.headers', true);
    IF v_headers_raw IS NULL OR v_headers_raw = '' THEN
        RETURN 'ANON';
    END IF;

    BEGIN
        v_passcode := lower(trim(COALESCE((v_headers_raw::json)->>'x-isharp-passcode', '')));
    EXCEPTION WHEN OTHERS THEN
        RETURN 'ANON';
    END;

    IF v_passcode = '' THEN
        RETURN 'ANON';
    END IF;

    -- 1. Check DBMS Editor
    IF EXISTS (
        SELECT 1 FROM public.app_passwords
        WHERE key = 'dbms_editor'
          AND (
              (password_hash IS NOT NULL AND password_hash = extensions.crypt(v_passcode, password_hash))
              OR lower(trim(password)) = v_passcode
          )
    ) THEN
        RETURN 'EDITOR';
    END IF;

    -- 2. Check Manager Master or Module Supervisor passcodes
    IF EXISTS (
        SELECT 1 FROM public.app_passwords
        WHERE key = 'manager_master'
          AND (
              (password_hash IS NOT NULL AND password_hash = extensions.crypt(v_passcode, password_hash))
              OR lower(trim(password)) = v_passcode
          )
    ) OR EXISTS (
        SELECT 1 FROM public.module_passwords
        WHERE (password_hash IS NOT NULL AND password_hash = extensions.crypt(v_passcode, password_hash))
           OR lower(trim(access_password)) = v_passcode
    ) THEN
        RETURN 'SUPERVISOR';
    END IF;

    -- 3. Check Viewer passcodes
    IF v_passcode IN ('isharp', 'monodon') OR EXISTS (
        SELECT 1 FROM public.app_passwords
        WHERE key = 'dbms_viewer'
          AND (
              (password_hash IS NOT NULL AND password_hash = extensions.crypt(v_passcode, password_hash))
              OR lower(trim(password)) = v_passcode
          )
    ) THEN
        RETURN 'VIEWER';
    END IF;

    RETURN 'ANON';
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_can_write_dbms()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
    SELECT public.fn_get_request_role() = 'EDITOR';
$$;

CREATE OR REPLACE FUNCTION public.fn_can_write_field_ops()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
    SELECT public.fn_get_request_role() IN ('EDITOR', 'SUPERVISOR');
$$;

CREATE OR REPLACE FUNCTION public.fn_can_read_sensitive()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
    SELECT public.fn_get_request_role() IN ('EDITOR', 'SUPERVISOR', 'VIEWER');
$$;

GRANT EXECUTE ON FUNCTION public.fn_verify_dbms_passcode(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_verify_field_ops_passcode(integer, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_get_request_role() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_can_write_dbms() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_can_write_field_ops() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_can_read_sensitive() TO anon, authenticated, service_role;

-- ==============================================================================
-- 4. Lock Down Table Row-Level Security (RLS) Policies
-- ==============================================================================

-- 4A. Sensitive Financial Table: Require authenticated passcode for SELECT, Editor for writes
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'growout_pond_finance') THEN
        ALTER TABLE public.growout_pond_finance ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Allow public read-write on growout_pond_finance" ON public.growout_pond_finance;
        DROP POLICY IF EXISTS "Authenticated read finance" ON public.growout_pond_finance;
        DROP POLICY IF EXISTS "Editor write finance" ON public.growout_pond_finance;

        CREATE POLICY "Authenticated read finance"
            ON public.growout_pond_finance FOR SELECT
            USING (public.fn_can_read_sensitive());

        CREATE POLICY "Editor write finance"
            ON public.growout_pond_finance FOR ALL
            USING (public.fn_can_write_dbms())
            WITH CHECK (public.fn_can_write_dbms());
    END IF;
END $$;

-- 4B. Core DBMS & ERP Tables: Public SELECT for dashboards, Editor-only INSERT/UPDATE/DELETE
DO $$
DECLARE
    v_tbl text;
    v_pol record;
    v_dbms_tables text[] := ARRAY[
        'stocking_records',
        'pond_stocking_batches',
        'active_operational_ponds',
        'biometrics_sampling',
        'pond_issues',
        'lab_water_quality',
        'pond_harvest_daily',
        'pond_harvest_sales',
        'pond_harvest_plan',
        'growout_pond_feed_sap',
        'growout_pond_feed_legacy',
        'growout_pond_final_legacy',
        'pond_initiatives',
        'pond_staff'
    ];
BEGIN
    FOREACH v_tbl IN ARRAY v_dbms_tables LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tbl) THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_tbl);

            -- Drop existing policies on table to ensure clean state
            FOR v_pol IN
                SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = v_tbl
            LOOP
                EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_pol.policyname, v_tbl);
            END LOOP;

            -- Allow read access for operational dashboards
            EXECUTE format(
                'CREATE POLICY "Allow dashboard read on %1$s" ON public.%1$I FOR SELECT USING (true)',
                v_tbl
            );

            -- Require DBMS Editor passcode for INSERT / UPDATE / DELETE
            EXECUTE format(
                'CREATE POLICY "Require editor for write on %1$s" ON public.%1$I FOR INSERT WITH CHECK (public.fn_can_write_dbms())',
                v_tbl
            );
            EXECUTE format(
                'CREATE POLICY "Require editor for update on %1$s" ON public.%1$I FOR UPDATE USING (public.fn_can_write_dbms()) WITH CHECK (public.fn_can_write_dbms())',
                v_tbl
            );
            EXECUTE format(
                'CREATE POLICY "Require editor for delete on %1$s" ON public.%1$I FOR DELETE USING (public.fn_can_write_dbms())',
                v_tbl
            );
        END IF;
    END LOOP;
END $$;

-- 4C. Field Operations & Shared Operational Tables:
--     Public SELECT, Supervisor/Editor INSERT & UPDATE, Editor-only DELETE on growout_pond_master
DO $$
DECLARE
    v_tbl text;
    v_pol record;
    v_field_tables text[] := ARRAY[
        'growout_pond_master',
        'pond_event_date',
        'pond_aerator_inventory',
        'pond_inventories',
        'daily_pond_records',
        'mineral_probiotic_used'
    ];
BEGIN
    FOREACH v_tbl IN ARRAY v_field_tables LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tbl) THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_tbl);

            FOR v_pol IN
                SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = v_tbl
            LOOP
                EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_pol.policyname, v_tbl);
            END LOOP;

            -- Allow read access for operational dashboards
            EXECUTE format(
                'CREATE POLICY "Allow dashboard read on %1$s" ON public.%1$I FOR SELECT USING (true)',
                v_tbl
            );

            -- Allow Supervisor or Editor for INSERT and UPDATE
            EXECUTE format(
                'CREATE POLICY "Require supervisor or editor for insert on %1$s" ON public.%1$I FOR INSERT WITH CHECK (public.fn_can_write_field_ops())',
                v_tbl
            );
            EXECUTE format(
                'CREATE POLICY "Require supervisor or editor for update on %1$s" ON public.%1$I FOR UPDATE USING (public.fn_can_write_field_ops()) WITH CHECK (public.fn_can_write_field_ops())',
                v_tbl
            );

            -- For growout_pond_master, only Editor can DELETE cycles; for child field tables, Supervisor or Editor can delete
            IF v_tbl = 'growout_pond_master' THEN
                EXECUTE format(
                    'CREATE POLICY "Require editor for delete on %1$s" ON public.%1$I FOR DELETE USING (public.fn_can_write_dbms())',
                    v_tbl
                );
            ELSE
                EXECUTE format(
                    'CREATE POLICY "Require supervisor or editor for delete on %1$s" ON public.%1$I FOR DELETE USING (public.fn_can_write_field_ops())',
                    v_tbl
                );
            END IF;
        END IF;
    END LOOP;
END $$;

-- 4D. QA/QC Inspections Table: Enable RLS, allow SELECT & INSERT, restrict UPDATE & DELETE
DO $$
DECLARE
    v_pol record;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'qaqc_inspections') THEN
        ALTER TABLE public.qaqc_inspections ENABLE ROW LEVEL SECURITY;

        FOR v_pol IN
            SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'qaqc_inspections'
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.qaqc_inspections', v_pol.policyname);
        END LOOP;

        CREATE POLICY "Allow read qaqc_inspections"
            ON public.qaqc_inspections FOR SELECT USING (true);

        CREATE POLICY "Allow insert qaqc_inspections"
            ON public.qaqc_inspections FOR INSERT WITH CHECK (true);

        CREATE POLICY "Require supervisor or editor for update qaqc_inspections"
            ON public.qaqc_inspections FOR UPDATE
            USING (public.fn_can_write_field_ops())
            WITH CHECK (public.fn_can_write_field_ops());

        CREATE POLICY "Require editor for delete qaqc_inspections"
            ON public.qaqc_inspections FOR DELETE
            USING (public.fn_can_write_dbms());
    END IF;
END $$;

-- 4E. IoT Telemetry Tables: Prevent unauthorized UPDATE or DELETE tampering
DO $$
DECLARE
    v_tbl text;
    v_pol record;
    v_iot_tables text[] := ARRAY[
        'water_quality_logs',
        'weather_logs',
        'feed_barrel_logs'
    ];
BEGIN
    FOREACH v_tbl IN ARRAY v_iot_tables LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tbl) THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_tbl);

            FOR v_pol IN
                SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = v_tbl
            LOOP
                EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_pol.policyname, v_tbl);
            END LOOP;

            EXECUTE format(
                'CREATE POLICY "Allow read on %1$s" ON public.%1$I FOR SELECT USING (true)',
                v_tbl
            );
            EXECUTE format(
                'CREATE POLICY "Allow telemetry insert on %1$s" ON public.%1$I FOR INSERT WITH CHECK (true)',
                v_tbl
            );
            EXECUTE format(
                'CREATE POLICY "Require editor for update on %1$s" ON public.%1$I FOR UPDATE USING (public.fn_can_write_dbms()) WITH CHECK (public.fn_can_write_dbms())',
                v_tbl
            );
            EXECUTE format(
                'CREATE POLICY "Require editor for delete on %1$s" ON public.%1$I FOR DELETE USING (public.fn_can_write_dbms())',
                v_tbl
            );
        END IF;
    END LOOP;
END $$;

-- ==============================================================================
-- 5. Harden Privileged Lifecycle Stored Procedures (Require DBMS Editor)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.fn_create_custom_cycle(
    p_pond varchar,
    p_cycle_no integer,
    p_area numeric DEFAULT 0.50,
    p_status varchar DEFAULT 'IDLE',
    p_plan_stock_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_base varchar;
    v_pond_index varchar;
    v_farm varchar := 'SETIU';
    v_modl varchar;
    v_row_no varchar;
    v_pond_type varchar := 'FULL LINING';
    v_pond_usage varchar := 'COMMERCIAL';
    v_crop_no varchar;
    v_clean_pond varchar;
BEGIN
    IF NOT public.fn_can_write_dbms() THEN
        RAISE EXCEPTION 'Unauthorized: DBMS Editor credentials required to create pond cycles.';
    END IF;

    v_clean_pond := trim(p_pond);

    SELECT farm, modl, row_no, pond_type, pond_usage, crop_no, split_part(pond_index, '.', 1)
    INTO v_farm, v_modl, v_row_no, v_pond_type, v_pond_usage, v_crop_no, v_base
    FROM public.growout_pond_master
    WHERE trim(pond) = v_clean_pond
    LIMIT 1;

    IF v_base IS NULL OR v_base = '' THEN
        v_base := '2' || replace(replace(v_clean_pond, '.', ''), ' ', '');
        v_modl := 'MODULE ' || lpad(split_part(v_clean_pond, '.', 1), 2, '0');
        v_row_no := 'ROW ' || lpad(split_part(v_clean_pond, '.', 2), 2, '0');
        v_farm := 'SETIU';
        v_pond_type := 'FULL LINING';
        v_pond_usage := 'COMMERCIAL';
        v_crop_no := to_char(CURRENT_DATE, 'YYYY');
    END IF;

    v_pond_index := v_base || '.' || p_cycle_no;

    IF EXISTS (SELECT 1 FROM public.growout_pond_master WHERE pond_index = v_pond_index) THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Cycle index ' || v_pond_index || ' already exists.'
        );
    END IF;

    INSERT INTO public.growout_pond_master (
        pond_index, pond, farm, modl, row_no, area, pond_type, pond_usage,
        crop_no, cycle_no, pond_status, pond_active, culture_status,
        strategy, final_status, disease_status, idle_days, idle_status, water_type
    ) VALUES (
        v_pond_index,
        v_clean_pond,
        COALESCE(v_farm, 'SETIU'),
        COALESCE(v_modl, 'MODULE 01'),
        COALESCE(v_row_no, 'ROW 01'),
        COALESCE(p_area, 0.50),
        COALESCE(v_pond_type, 'FULL LINING'),
        COALESCE(v_pond_usage, 'COMMERCIAL'),
        COALESCE(v_crop_no, to_char(CURRENT_DATE, 'YYYY')),
        p_cycle_no::varchar,
        upper(trim(p_status)),
        CASE WHEN upper(trim(p_status)) = 'PRODUCTION' THEN 'ACTIVE' ELSE 'INACTIVE' END,
        CASE WHEN upper(trim(p_status)) = 'PRODUCTION' THEN 'NORMAL' ELSE NULL END,
        'STANDARD',
        NULL,
        'NO ISSUES',
        0,
        CASE WHEN upper(trim(p_status)) = 'IDLE' THEN 'NORMAL' ELSE NULL END,
        'FULL SEA WATER'
    );

    IF p_plan_stock_date IS NOT NULL THEN
        INSERT INTO public.pond_event_date (pond_index, event_name, event_date)
        VALUES (v_pond_index, 'plan_stock', p_plan_stock_date)
        ON CONFLICT (pond_index, event_name) DO UPDATE SET event_date = EXCLUDED.event_date;
    END IF;

    IF upper(trim(p_status)) = 'PRODUCTION' THEN
        INSERT INTO public.active_operational_ponds (pond, pond_index)
        VALUES (v_clean_pond, v_pond_index)
        ON CONFLICT (pond) DO UPDATE SET pond_index = EXCLUDED.pond_index;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'pond_index', v_pond_index,
        'status', upper(trim(p_status)),
        'message', 'Cycle ' || v_pond_index || ' successfully initialized.'
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_terminate_cycle(
    p_pond_index varchar,
    p_harvest_date date DEFAULT CURRENT_DATE,
    p_final_status varchar DEFAULT 'NORMAL HARVEST',
    p_create_next_cycle boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rec record;
    v_base varchar;
    v_curr_cycle integer;
    v_next_cycle integer;
    v_next_pond_index varchar;
    v_action varchar := 'TERMINATE_ONLY';
BEGIN
    IF NOT public.fn_can_write_dbms() THEN
        RAISE EXCEPTION 'Unauthorized: DBMS Editor credentials required to terminate pond cycles.';
    END IF;

    SELECT * INTO v_rec
    FROM public.growout_pond_master
    WHERE pond_index = p_pond_index;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Pond cycle ' || p_pond_index || ' not found.');
    END IF;

    UPDATE public.growout_pond_master
    SET pond_status = 'CLOSE',
        pond_active = 'INACTIVE',
        final_status = COALESCE(p_final_status, 'NORMAL HARVEST')
    WHERE pond_index = p_pond_index;

    INSERT INTO public.pond_event_date (pond_index, event_name, event_date)
    VALUES (p_pond_index, 'close', COALESCE(p_harvest_date, CURRENT_DATE))
    ON CONFLICT (pond_index, event_name) DO UPDATE SET event_date = EXCLUDED.event_date;

    DELETE FROM public.active_operational_ponds
    WHERE pond_index = p_pond_index;

    IF p_create_next_cycle THEN
        v_base := split_part(p_pond_index, '.', 1);
        v_curr_cycle := NULLIF(split_part(p_pond_index, '.', 2), '')::integer;
        IF v_curr_cycle IS NULL THEN
            v_curr_cycle := COALESCE(v_rec.cycle_no::integer, 0);
        END IF;
        v_next_cycle := v_curr_cycle + 1;
        v_next_pond_index := v_base || '.' || v_next_cycle;

        IF EXISTS (SELECT 1 FROM public.growout_pond_master WHERE pond_index = v_next_pond_index) THEN
            v_action := 'TERMINATE_EXISTING_NEXT';
        ELSE
            INSERT INTO public.growout_pond_master (
                pond_index, pond, farm, modl, row_no, area, pond_type, pond_usage,
                crop_no, cycle_no, pond_status, pond_active, culture_status,
                strategy, final_status, disease_status, idle_days, idle_status, water_type
            ) VALUES (
                v_next_pond_index,
                v_rec.pond,
                v_rec.farm,
                v_rec.modl,
                v_rec.row_no,
                v_rec.area,
                v_rec.pond_type,
                v_rec.pond_usage,
                v_rec.crop_no,
                v_next_cycle::varchar,
                'IDLE',
                'INACTIVE',
                NULL,
                v_rec.strategy,
                NULL,
                'NO ISSUES',
                0,
                'NORMAL',
                v_rec.water_type
            );

            INSERT INTO public.pond_event_date (pond_index, event_name, event_date)
            VALUES (v_next_pond_index, 'cycle', COALESCE(p_harvest_date, CURRENT_DATE))
            ON CONFLICT (pond_index, event_name) DO UPDATE SET event_date = EXCLUDED.event_date;

            v_action := 'TERMINATE_AND_ROLLOVER';
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'pond', v_rec.pond,
        'pond_index', p_pond_index,
        'new_pond_index', v_next_pond_index,
        'action', v_action
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_revive_cycle(
    p_pond_index varchar,
    p_delete_next_cycle boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rec record;
    v_base varchar;
    v_curr_cycle integer;
    v_next_cycle integer;
    v_next_pond_index varchar;
    v_next_deleted boolean := false;
BEGIN
    IF NOT public.fn_can_write_dbms() THEN
        RAISE EXCEPTION 'Unauthorized: DBMS Editor credentials required to revive pond cycles.';
    END IF;

    SELECT * INTO v_rec
    FROM public.growout_pond_master
    WHERE pond_index = p_pond_index;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Pond cycle ' || p_pond_index || ' not found.');
    END IF;

    UPDATE public.growout_pond_master
    SET pond_status = 'PRODUCTION',
        pond_active = 'ACTIVE',
        final_status = NULL
    WHERE pond_index = p_pond_index;

    DELETE FROM public.pond_event_date
    WHERE pond_index = p_pond_index AND event_name = 'close';

    INSERT INTO public.active_operational_ponds (pond, pond_index)
    VALUES (v_rec.pond, p_pond_index)
    ON CONFLICT (pond) DO UPDATE SET pond_index = EXCLUDED.pond_index;

    v_base := split_part(p_pond_index, '.', 1);
    v_curr_cycle := NULLIF(split_part(p_pond_index, '.', 2), '')::integer;
    IF v_curr_cycle IS NULL THEN
        v_curr_cycle := COALESCE(v_rec.cycle_no::integer, 0);
    END IF;
    v_next_cycle := v_curr_cycle + 1;
    v_next_pond_index := v_base || '.' || v_next_cycle;

    IF p_delete_next_cycle THEN
        IF EXISTS (SELECT 1 FROM public.growout_pond_master WHERE pond_index = v_next_pond_index AND pond_status = 'IDLE') THEN
            DELETE FROM public.pond_event_date WHERE pond_index = v_next_pond_index;
            DELETE FROM public.pond_initiatives WHERE pond_index = v_next_pond_index;
            DELETE FROM public.pond_aerator_inventory WHERE pond_index = v_next_pond_index;
            DELETE FROM public.pond_inventories WHERE pond_index = v_next_pond_index;
            DELETE FROM public.active_operational_ponds WHERE pond_index = v_next_pond_index;
            DELETE FROM public.growout_pond_master WHERE pond_index = v_next_pond_index;
            v_next_deleted := true;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'revived_pond_index', p_pond_index,
        'next_pond_index', v_next_pond_index,
        'next_cycle_deleted', v_next_deleted,
        'status', 'PRODUCTION'
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_close_and_create_next_cycle(
    p_pond_index varchar,
    p_harvest_date date DEFAULT CURRENT_DATE,
    p_final_status varchar DEFAULT 'NORMAL HARVEST'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NOT public.fn_can_write_dbms() THEN
        RAISE EXCEPTION 'Unauthorized: DBMS Editor credentials required to close pond cycles.';
    END IF;
    RETURN public.fn_terminate_cycle(p_pond_index, p_harvest_date, p_final_status, true);
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_delete_idle_cycle(
    p_pond_index varchar
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_status varchar;
BEGIN
    IF NOT public.fn_can_write_dbms() THEN
        RAISE EXCEPTION 'Unauthorized: DBMS Editor credentials required to delete idle pond cycles.';
    END IF;

    SELECT pond_status INTO v_status
    FROM public.growout_pond_master
    WHERE pond_index = p_pond_index;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cycle % not found.', p_pond_index;
    END IF;

    IF v_status <> 'IDLE' THEN
        RAISE EXCEPTION 'Cannot delete cycle % with status % (only IDLE cycles can be removed).', p_pond_index, v_status;
    END IF;

    IF EXISTS (SELECT 1 FROM public.pond_stocking_batches WHERE pond_index = p_pond_index) OR
       EXISTS (SELECT 1 FROM public.biometrics_sampling WHERE pond_index = p_pond_index) OR
       EXISTS (SELECT 1 FROM public.daily_pond_records WHERE pond_index = p_pond_index) OR
       EXISTS (SELECT 1 FROM public.pond_harvest_daily WHERE pond_index = p_pond_index) THEN
        RAISE EXCEPTION 'Cannot delete cycle %: operational fact records exist.', p_pond_index;
    END IF;

    DELETE FROM public.pond_event_date WHERE pond_index = p_pond_index;
    DELETE FROM public.pond_initiatives WHERE pond_index = p_pond_index;
    DELETE FROM public.pond_aerator_inventory WHERE pond_index = p_pond_index;
    DELETE FROM public.pond_inventories WHERE pond_index = p_pond_index;
    DELETE FROM public.active_operational_ponds WHERE pond_index = p_pond_index;
    DELETE FROM public.growout_pond_master WHERE pond_index = p_pond_index;

    RETURN jsonb_build_object(
        'success', true,
        'pond_index', p_pond_index,
        'message', 'Idle cycle ' || p_pond_index || ' safely deleted.'
    );
END;
$$;

COMMIT;
