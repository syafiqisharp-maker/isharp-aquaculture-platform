-- ============================================================================
-- Migration: 15_sync_hardening.sql
-- Description: Weekly Access -> Supabase Sync Hardening (RLS InitPlan Speedup,
--              Atomic Cycle-Replacement RPC, Natural-Key Constraints without
--              index_no, and Full Operational Deduplication).
--
-- How to apply:
--   Paste and run this entire script once in the Supabase Dashboard SQL Editor.
--   It is idempotent and safe to re-run at any time.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Optimize Passcode Role Resolution (Fast-Path + Bcrypt Fallback)
-- ============================================================================
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
    IF current_setting('request.jwt.claim.role', true) = 'service_role' OR current_user = 'service_role' THEN
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

    -- 1. Check DBMS Editor (plaintext fast-path first, then bcrypt hash)
    IF EXISTS (
        SELECT 1 FROM public.app_passwords
        WHERE key = 'dbms_editor'
          AND (
              lower(trim(password)) = v_passcode
              OR (password_hash IS NOT NULL AND password_hash = extensions.crypt(v_passcode, password_hash))
          )
    ) THEN
        RETURN 'EDITOR';
    END IF;

    -- 2. Check Manager Master or Module Supervisor passcodes
    IF EXISTS (
        SELECT 1 FROM public.app_passwords
        WHERE key = 'manager_master'
          AND (
              lower(trim(password)) = v_passcode
              OR (password_hash IS NOT NULL AND password_hash = extensions.crypt(v_passcode, password_hash))
          )
    ) OR EXISTS (
        SELECT 1 FROM public.module_passwords
        WHERE lower(trim(access_password)) = v_passcode
           OR (password_hash IS NOT NULL AND password_hash = extensions.crypt(v_passcode, password_hash))
    ) THEN
        RETURN 'SUPERVISOR';
    END IF;

    -- 3. Check Viewer passcodes
    IF v_passcode IN ('isharp', 'monodon') OR EXISTS (
        SELECT 1 FROM public.app_passwords
        WHERE key = 'dbms_viewer'
          AND (
              lower(trim(password)) = v_passcode
              OR (password_hash IS NOT NULL AND password_hash = extensions.crypt(v_passcode, password_hash))
          )
    ) THEN
        RETURN 'VIEWER';
    END IF;

    RETURN 'ANON';
END;
$$;

-- ============================================================================
-- 2. Statement-Level RLS InitPlan Policies (Evaluated ONCE per statement)
--    Wrapping helper calls in (SELECT ...) instructs PostgreSQL to evaluate
--    the passcode check once per query instead of once per row.
-- ============================================================================

-- 2A. Sensitive Financial Table (growout_pond_finance)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'growout_pond_finance') THEN
        ALTER TABLE public.growout_pond_finance ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Allow public read-write on growout_pond_finance" ON public.growout_pond_finance;
        DROP POLICY IF EXISTS "Authenticated read finance" ON public.growout_pond_finance;
        DROP POLICY IF EXISTS "Editor write finance" ON public.growout_pond_finance;

        CREATE POLICY "Authenticated read finance"
            ON public.growout_pond_finance FOR SELECT
            USING ((SELECT public.fn_can_read_sensitive()));

        CREATE POLICY "Editor write finance"
            ON public.growout_pond_finance FOR ALL
            USING ((SELECT public.fn_can_write_dbms()))
            WITH CHECK ((SELECT public.fn_can_write_dbms()));
    END IF;
END $$;

-- 2B. Core DBMS & ERP Tables (including pond_notes)
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
        'pond_notes',
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

            FOR v_pol IN
                SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = v_tbl
            LOOP
                EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_pol.policyname, v_tbl);
            END LOOP;

            EXECUTE format(
                'CREATE POLICY "Allow dashboard read on %1$s" ON public.%1$I FOR SELECT USING (true)',
                v_tbl
            );
            EXECUTE format(
                'CREATE POLICY "Require editor for write on %1$s" ON public.%1$I FOR INSERT WITH CHECK ((SELECT public.fn_can_write_dbms()))',
                v_tbl
            );
            EXECUTE format(
                'CREATE POLICY "Require editor for update on %1$s" ON public.%1$I FOR UPDATE USING ((SELECT public.fn_can_write_dbms())) WITH CHECK ((SELECT public.fn_can_write_dbms()))',
                v_tbl
            );
            EXECUTE format(
                'CREATE POLICY "Require editor for delete on %1$s" ON public.%1$I FOR DELETE USING ((SELECT public.fn_can_write_dbms()))',
                v_tbl
            );
        END IF;
    END LOOP;
END $$;

-- 2C. Field Operations & Shared Operational Tables
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

            EXECUTE format(
                'CREATE POLICY "Allow dashboard read on %1$s" ON public.%1$I FOR SELECT USING (true)',
                v_tbl
            );
            EXECUTE format(
                'CREATE POLICY "Require supervisor or editor for insert on %1$s" ON public.%1$I FOR INSERT WITH CHECK ((SELECT public.fn_can_write_field_ops()))',
                v_tbl
            );
            EXECUTE format(
                'CREATE POLICY "Require supervisor or editor for update on %1$s" ON public.%1$I FOR UPDATE USING ((SELECT public.fn_can_write_field_ops())) WITH CHECK ((SELECT public.fn_can_write_field_ops()))',
                v_tbl
            );

            IF v_tbl = 'growout_pond_master' THEN
                EXECUTE format(
                    'CREATE POLICY "Require editor for delete on %1$s" ON public.%1$I FOR DELETE USING ((SELECT public.fn_can_write_dbms()))',
                    v_tbl
                );
            ELSE
                EXECUTE format(
                    'CREATE POLICY "Require supervisor or editor for delete on %1$s" ON public.%1$I FOR DELETE USING ((SELECT public.fn_can_write_field_ops()))',
                    v_tbl
                );
            END IF;
        END IF;
    END LOOP;
END $$;

-- ============================================================================
-- 3. Deduplicate Existing Operational Tables Before Adding Constraints
-- ============================================================================

-- 3A. biometrics_sampling: keep latest id per (pond_index, smpl_date)
DELETE FROM public.biometrics_sampling
WHERE id IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (
            PARTITION BY pond_index, smpl_date
            ORDER BY id DESC
        ) AS rn
        FROM public.biometrics_sampling
    ) sub
    WHERE sub.rn > 1
);

-- 3B. pond_notes: keep latest row per (pond_index, trimmed note content)
DELETE FROM public.pond_notes
WHERE id IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (
            PARTITION BY pond_index, md5(btrim(COALESCE(note, '')))
            ORDER BY created_at DESC NULLS LAST, id DESC
        ) AS rn
        FROM public.pond_notes
    ) sub
    WHERE sub.rn > 1
);

-- 3C. pond_harvest_sales: keep latest row per identical sales slip
DELETE FROM public.pond_harvest_sales
WHERE id IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (
            PARTITION BY
                pond_index,
                hvt_date,
                upper(btrim(COALESCE(hvt_buyer, ''))),
                COALESCE(round(good_wgt, 2), 0),
                COALESCE(round(raw_wgt, 2), 0),
                COALESCE(round(net_sales, 2), 0)
            ORDER BY created_at DESC NULLS LAST, id DESC
        ) AS rn
        FROM public.pond_harvest_sales
    ) sub
    WHERE sub.rn > 1
);

-- 3D. pond_issues: keep latest row per identical issue entry
DELETE FROM public.pond_issues
WHERE id IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (
            PARTITION BY
                pond_index,
                issue_date,
                upper(btrim(COALESCE(issue_category, ''))),
                upper(btrim(COALESCE(issue_status, ''))),
                upper(btrim(COALESCE(issue_test, ''))),
                upper(btrim(COALESCE(issue_flag, ''))),
                upper(btrim(COALESCE(issue_grade, ''))),
                md5(upper(btrim(COALESCE(issue_note, ''))))
            ORDER BY created_at DESC NULLS LAST, id DESC
        ) AS rn
        FROM public.pond_issues
    ) sub
    WHERE sub.rn > 1
);

-- 3E. pond_stocking_batches: keep latest row per identical stocking batch
DELETE FROM public.pond_stocking_batches
WHERE id IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (
            PARTITION BY
                pond_index,
                stck_date,
                upper(btrim(COALESCE(stck_tank, ''))),
                COALESCE(round(stck_pcs, 2), 0)
            ORDER BY created_at DESC NULLS LAST, id DESC
        ) AS rn
        FROM public.pond_stocking_batches
    ) sub
    WHERE sub.rn > 1
);

-- 3F. pond_harvest_daily: keep latest row per identical daily harvest entry
DELETE FROM public.pond_harvest_daily
WHERE id IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (
            PARTITION BY
                pond_index,
                harv_date,
                upper(btrim(COALESCE(harv_status, ''))),
                COALESCE(round(harv_weight, 2), 0),
                COALESCE(round(harv_abw, 2), 0)
            ORDER BY created_at DESC NULLS LAST, id DESC
        ) AS rn
        FROM public.pond_harvest_daily
    ) sub
    WHERE sub.rn > 1
);

-- ============================================================================
-- 4. Natural-Key Unique Constraints (Replacing Legacy index_no)
-- ============================================================================

-- 4A. biometrics_sampling: unique on (pond_index, smpl_date)
ALTER TABLE public.biometrics_sampling
    DROP CONSTRAINT IF EXISTS uq_biometrics_sampling_pond_date;

ALTER TABLE public.biometrics_sampling
    ADD CONSTRAINT uq_biometrics_sampling_pond_date UNIQUE (pond_index, smpl_date);

CREATE INDEX IF NOT EXISTS idx_biometrics_sampling_lookup
    ON public.biometrics_sampling (pond_index, smpl_date ASC, smpl_doc ASC);

-- 4B. pond_notes: unique expression index on (pond_index, md5(trimmed note))
ALTER TABLE public.pond_notes
    DROP CONSTRAINT IF EXISTS uq_pond_notes_pond_hash;

ALTER TABLE public.pond_notes
    DROP COLUMN IF EXISTS note_hash;

DROP INDEX IF EXISTS public.uq_pond_notes_pond_hash_idx;

CREATE UNIQUE INDEX uq_pond_notes_pond_hash_idx
    ON public.pond_notes (pond_index, md5(btrim(COALESCE(note, ''))));

-- 4C. pond_harvest_sales: unique expression index on natural sales slip key
ALTER TABLE public.pond_harvest_sales
    DROP CONSTRAINT IF EXISTS uq_pond_harvest_sales_slip;

ALTER TABLE public.pond_harvest_sales
    DROP COLUMN IF EXISTS slip_hash;

DROP INDEX IF EXISTS public.uq_pond_harvest_sales_slip_idx;

CREATE UNIQUE INDEX uq_pond_harvest_sales_slip_idx
    ON public.pond_harvest_sales (
        pond_index,
        hvt_date,
        upper(btrim(COALESCE(hvt_buyer, ''))),
        COALESCE(round(good_wgt, 2), 0),
        COALESCE(round(raw_wgt, 2), 0),
        COALESCE(round(net_sales, 2), 0)
    );

-- 4D. pond_stocking_batches: unique expression index on natural stocking batch key
DROP INDEX IF EXISTS public.uq_pond_stocking_batches_natural_idx;

CREATE UNIQUE INDEX uq_pond_stocking_batches_natural_idx
    ON public.pond_stocking_batches (
        pond_index,
        stck_date,
        upper(btrim(COALESCE(stck_tank, ''))),
        COALESCE(round(stck_pcs, 2), 0)
    );

-- 4E. pond_harvest_daily: unique expression index on natural daily harvest key
DROP INDEX IF EXISTS public.uq_pond_harvest_daily_natural_idx;

CREATE UNIQUE INDEX uq_pond_harvest_daily_natural_idx
    ON public.pond_harvest_daily (
        pond_index,
        harv_date,
        upper(btrim(COALESCE(harv_status, ''))),
        COALESCE(round(harv_weight, 2), 0),
        COALESCE(round(harv_abw, 2), 0)
    );

-- 4F. pond_issues: unique expression index on natural pathology issue key
DROP INDEX IF EXISTS public.uq_pond_issues_natural_idx;

CREATE UNIQUE INDEX uq_pond_issues_natural_idx
    ON public.pond_issues (
        pond_index,
        issue_date,
        upper(btrim(COALESCE(issue_category, ''))),
        upper(btrim(COALESCE(issue_status, ''))),
        upper(btrim(COALESCE(issue_test, ''))),
        upper(btrim(COALESCE(issue_flag, ''))),
        upper(btrim(COALESCE(issue_grade, ''))),
        md5(upper(btrim(COALESCE(issue_note, ''))))
    );

-- ============================================================================
-- 5. Atomic Cycle-Replacement RPC (Network-Drop Proof & Transactionally Safe)
--    Replaces all rows for a batch of pond_index cycles in a single transaction.
--    If the connection drops mid-call, PostgreSQL rolls back automatically.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_sync_replace_cycles(
    p_table text,
    p_pond_indices text[],
    p_rows jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_deleted integer := 0;
    v_inserted integer := 0;
BEGIN
    -- Verify DBMS Editor permission once per RPC call
    IF NOT public.fn_can_write_dbms() THEN
        RAISE EXCEPTION 'Unauthorized: valid DBMS Editor passcode required for sync.'
            USING ERRCODE = '42501';
    END IF;

    IF p_pond_indices IS NULL OR array_length(p_pond_indices, 1) IS NULL THEN
        RETURN jsonb_build_object('deleted', 0, 'inserted', 0);
    END IF;

    CASE p_table
        WHEN 'pond_stocking_batches' THEN
            DELETE FROM public.pond_stocking_batches
            WHERE pond_index = ANY(p_pond_indices);
            GET DIAGNOSTICS v_deleted = ROW_COUNT;

            IF p_rows IS NOT NULL AND jsonb_typeof(p_rows) = 'array' AND jsonb_array_length(p_rows) > 0 THEN
                INSERT INTO public.pond_stocking_batches (
                    pond_index, stck_date, stck_source, stck_species, stck_pcs,
                    stck_type, stck_allow, stck_total, stck_tank, stck_size,
                    stck_plstts, bs_line
                )
                SELECT
                    r.pond_index, r.stck_date, r.stck_source, r.stck_species, r.stck_pcs,
                    r.stck_type, r.stck_allow, r.stck_total, r.stck_tank, r.stck_size,
                    r.stck_plstts, r.bs_line
                FROM jsonb_populate_recordset(null::public.pond_stocking_batches, p_rows) AS r
                ON CONFLICT DO NOTHING;
                GET DIAGNOSTICS v_inserted = ROW_COUNT;
            END IF;

        WHEN 'pond_harvest_daily' THEN
            DELETE FROM public.pond_harvest_daily
            WHERE pond_index = ANY(p_pond_indices);
            GET DIAGNOSTICS v_deleted = ROW_COUNT;

            IF p_rows IS NOT NULL AND jsonb_typeof(p_rows) = 'array' AND jsonb_array_length(p_rows) > 0 THEN
                INSERT INTO public.pond_harvest_daily (
                    pond_index, harv_date, harv_status, harv_weight,
                    harv_abw, harv_revenue, harv_method
                )
                SELECT
                    r.pond_index, r.harv_date, r.harv_status, r.harv_weight,
                    r.harv_abw, r.harv_revenue, r.harv_method
                FROM jsonb_populate_recordset(null::public.pond_harvest_daily, p_rows) AS r
                ON CONFLICT DO NOTHING;
                GET DIAGNOSTICS v_inserted = ROW_COUNT;
            END IF;

        WHEN 'pond_harvest_sales' THEN
            DELETE FROM public.pond_harvest_sales
            WHERE pond_index = ANY(p_pond_indices);
            GET DIAGNOSTICS v_deleted = ROW_COUNT;

            IF p_rows IS NOT NULL AND jsonb_typeof(p_rows) = 'array' AND jsonb_array_length(p_rows) > 0 THEN
                INSERT INTO public.pond_harvest_sales (
                    pond_index, hvt_date, hvt_buyer, hvt_abw,
                    good_wgt, good_prc, second_grade_wgt, second_grade_prc,
                    small_wgt, below_wgt, rubbish_wgt, raw_wgt, net_sales
                )
                SELECT
                    r.pond_index, r.hvt_date, r.hvt_buyer, r.hvt_abw,
                    r.good_wgt, r.good_prc, r.second_grade_wgt, r.second_grade_prc,
                    r.small_wgt, r.below_wgt, r.rubbish_wgt, r.raw_wgt, r.net_sales
                FROM jsonb_populate_recordset(null::public.pond_harvest_sales, p_rows) AS r
                ON CONFLICT DO NOTHING;
                GET DIAGNOSTICS v_inserted = ROW_COUNT;
            END IF;

        WHEN 'pond_issues' THEN
            DELETE FROM public.pond_issues
            WHERE pond_index = ANY(p_pond_indices);
            GET DIAGNOSTICS v_deleted = ROW_COUNT;

            IF p_rows IS NOT NULL AND jsonb_typeof(p_rows) = 'array' AND jsonb_array_length(p_rows) > 0 THEN
                INSERT INTO public.pond_issues (
                    pond_index, issue_date, issue_category, issue_status,
                    issue_test, issue_flag, issue_grade, issue_note
                )
                SELECT
                    r.pond_index, r.issue_date, r.issue_category, r.issue_status,
                    r.issue_test, r.issue_flag, r.issue_grade, r.issue_note
                FROM jsonb_populate_recordset(null::public.pond_issues, p_rows) AS r
                ON CONFLICT DO NOTHING;
                GET DIAGNOSTICS v_inserted = ROW_COUNT;
            END IF;

        WHEN 'biometrics_sampling' THEN
            DELETE FROM public.biometrics_sampling
            WHERE pond_index = ANY(p_pond_indices);
            GET DIAGNOSTICS v_deleted = ROW_COUNT;

            IF p_rows IS NOT NULL AND jsonb_typeof(p_rows) = 'array' AND jsonb_array_length(p_rows) > 0 THEN
                INSERT INTO public.biometrics_sampling (
                    pond_index, smpl_date, smpl_doc, smpl_abw, smpl_surv,
                    smpl_dfed, smpl_tfed, smpl_bms,
                    p_smpl_date, p_smpl_doc, p_smpl_abw, p_smpl_surv, p_smpl_dfed, p_smpl_tfed,
                    sttg_abw, sttg_surv, sttg_bms, sttg_dfed, sttg_tfed
                )
                SELECT
                    r.pond_index, r.smpl_date, r.smpl_doc, r.smpl_abw, r.smpl_surv,
                    r.smpl_dfed, r.smpl_tfed, r.smpl_bms,
                    r.p_smpl_date, r.p_smpl_doc, r.p_smpl_abw, r.p_smpl_surv, r.p_smpl_dfed, r.p_smpl_tfed,
                    r.sttg_abw, r.sttg_surv, r.sttg_bms, r.sttg_dfed, r.sttg_tfed
                FROM jsonb_populate_recordset(null::public.biometrics_sampling, p_rows) AS r
                ON CONFLICT (pond_index, smpl_date) DO UPDATE SET
                    smpl_doc = EXCLUDED.smpl_doc,
                    smpl_abw = EXCLUDED.smpl_abw,
                    smpl_surv = EXCLUDED.smpl_surv,
                    smpl_dfed = EXCLUDED.smpl_dfed,
                    smpl_tfed = EXCLUDED.smpl_tfed,
                    smpl_bms = EXCLUDED.smpl_bms,
                    p_smpl_date = EXCLUDED.p_smpl_date,
                    p_smpl_doc = EXCLUDED.p_smpl_doc,
                    p_smpl_abw = EXCLUDED.p_smpl_abw,
                    p_smpl_surv = EXCLUDED.p_smpl_surv,
                    p_smpl_dfed = EXCLUDED.p_smpl_dfed,
                    p_smpl_tfed = EXCLUDED.p_smpl_tfed,
                    sttg_abw = EXCLUDED.sttg_abw,
                    sttg_surv = EXCLUDED.sttg_surv,
                    sttg_bms = EXCLUDED.sttg_bms,
                    sttg_dfed = EXCLUDED.sttg_dfed,
                    sttg_tfed = EXCLUDED.sttg_tfed;
                GET DIAGNOSTICS v_inserted = ROW_COUNT;
            END IF;

        ELSE
            RAISE EXCEPTION 'Unsupported table for fn_sync_replace_cycles: %', p_table
                USING ERRCODE = '22023';
    END CASE;

    RETURN jsonb_build_object(
        'table', p_table,
        'cycles', array_length(p_pond_indices, 1),
        'deleted', v_deleted,
        'inserted', v_inserted
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_sync_replace_cycles(text, text[], jsonb)
    TO anon, authenticated, service_role;

COMMIT;
