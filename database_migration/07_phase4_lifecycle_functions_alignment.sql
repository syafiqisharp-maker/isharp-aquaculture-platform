-- Migration: 07_phase4_lifecycle_functions_alignment.sql
-- Description: Re-aligns PostgreSQL lifecycle functions (fn_terminate_cycle, fn_revive_cycle, 
--              fn_create_custom_cycle, fn_close_and_create_next_cycle, fn_delete_idle_cycle)
--              with the Phase 4 schema (routing lifecycle dates to public.pond_event_date 
--              instead of the dropped columns on public.growout_pond_master).

BEGIN;

-- =============================================================================
-- 1. Function: fn_create_custom_cycle
-- =============================================================================
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
    v_clean_pond := trim(p_pond);

    -- Try to resolve physical pond characteristics from an existing cycle
    SELECT farm, modl, row_no, pond_type, pond_usage, crop_no, split_part(pond_index, '.', 1)
    INTO v_farm, v_modl, v_row_no, v_pond_type, v_pond_usage, v_crop_no, v_base
    FROM public.growout_pond_master
    WHERE trim(pond) = v_clean_pond
    LIMIT 1;

    -- If no existing cycle found, construct base index
    IF v_base IS NULL OR v_base = '' THEN
        -- Construct base index (e.g. 2010101 from 01.01.01)
        v_base := '2' || replace(replace(v_clean_pond, '.', ''), ' ', '');
        v_modl := 'MODULE ' || lpad(split_part(v_clean_pond, '.', 1), 2, '0');
        v_row_no := 'ROW ' || lpad(split_part(v_clean_pond, '.', 2), 2, '0');
        v_farm := 'SETIU';
        v_pond_type := 'FULL LINING';
        v_pond_usage := 'COMMERCIAL';
        v_crop_no := to_char(CURRENT_DATE, 'YYYY');
    END IF;

    v_pond_index := v_base || '.' || p_cycle_no;

    -- Ensure cycle does not already exist
    IF EXISTS (SELECT 1 FROM public.growout_pond_master WHERE pond_index = v_pond_index) THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Cycle index ' || v_pond_index || ' already exists.'
        );
    END IF;

    -- Insert cycle into growout_pond_master (WITHOUT dropped spreadsheet date columns)
    INSERT INTO public.growout_pond_master (
        pond_index,
        pond,
        farm,
        modl,
        row_no,
        area,
        pond_type,
        pond_usage,
        crop_no,
        cycle_no,
        pond_status,
        pond_active,
        culture_status,
        strategy,
        final_status,
        disease_status,
        idle_days,
        idle_status,
        water_type
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

    -- If plan_stock_date provided, route to pond_event_date
    IF p_plan_stock_date IS NOT NULL THEN
        INSERT INTO public.pond_event_date (pond_index, event_name, event_date)
        VALUES (v_pond_index, 'plan_stock', p_plan_stock_date)
        ON CONFLICT (pond_index, event_name) DO UPDATE SET event_date = EXCLUDED.event_date;
    END IF;

    -- If PRODUCTION status, register in active gatekeeper
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


-- =============================================================================
-- 2. Function: fn_terminate_cycle
-- =============================================================================
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
    SELECT * INTO v_rec
    FROM public.growout_pond_master
    WHERE pond_index = p_pond_index;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Pond cycle ' || p_pond_index || ' not found.');
    END IF;

    -- 1. Close current cycle in growout_pond_master
    UPDATE public.growout_pond_master
    SET pond_status = 'CLOSE',
        pond_active = 'INACTIVE',
        final_status = COALESCE(p_final_status, 'NORMAL HARVEST')
    WHERE pond_index = p_pond_index;

    -- 2. Route close / harvest date to pond_event_date
    INSERT INTO public.pond_event_date (pond_index, event_name, event_date)
    VALUES (p_pond_index, 'close', COALESCE(p_harvest_date, CURRENT_DATE))
    ON CONFLICT (pond_index, event_name) DO UPDATE SET event_date = EXCLUDED.event_date;

    -- 3. Remove from active operational gatekeeper
    DELETE FROM public.active_operational_ponds
    WHERE pond_index = p_pond_index;

    -- 4. Rollover / Spawn next cycle if requested
    IF p_create_next_cycle THEN
        v_base := split_part(p_pond_index, '.', 1);
        v_curr_cycle := NULLIF(split_part(p_pond_index, '.', 2), '')::integer;
        IF v_curr_cycle IS NULL THEN
            v_curr_cycle := COALESCE(v_rec.cycle_no::integer, 0);
        END IF;
        v_next_cycle := v_curr_cycle + 1;
        v_next_pond_index := v_base || '.' || v_next_cycle;

        -- Check if next cycle already exists (e.g. from prior revive)
        IF EXISTS (SELECT 1 FROM public.growout_pond_master WHERE pond_index = v_next_pond_index) THEN
            v_action := 'TERMINATE_EXISTING_NEXT';
        ELSE
            -- Spawn new cycle in IDLE
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

            -- Record cycle start date in pond_event_date
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


-- =============================================================================
-- 3. Function: fn_revive_cycle
-- =============================================================================
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
    SELECT * INTO v_rec
    FROM public.growout_pond_master
    WHERE pond_index = p_pond_index;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Pond cycle ' || p_pond_index || ' not found.');
    END IF;

    -- 1. Reopen current cycle in growout_pond_master
    UPDATE public.growout_pond_master
    SET pond_status = 'PRODUCTION',
        pond_active = 'ACTIVE',
        final_status = NULL
    WHERE pond_index = p_pond_index;

    -- 2. Remove close date from pond_event_date
    DELETE FROM public.pond_event_date
    WHERE pond_index = p_pond_index AND event_name = 'close';

    -- 3. Restore in active operational gatekeeper
    INSERT INTO public.active_operational_ponds (pond, pond_index)
    VALUES (v_rec.pond, p_pond_index)
    ON CONFLICT (pond) DO UPDATE SET pond_index = EXCLUDED.pond_index;

    -- 4. Delete next cycle if requested
    v_base := split_part(p_pond_index, '.', 1);
    v_curr_cycle := NULLIF(split_part(p_pond_index, '.', 2), '')::integer;
    IF v_curr_cycle IS NULL THEN
        v_curr_cycle := COALESCE(v_rec.cycle_no::integer, 0);
    END IF;
    v_next_cycle := v_curr_cycle + 1;
    v_next_pond_index := v_base || '.' || v_next_cycle;

    IF p_delete_next_cycle THEN
        -- Only delete if next cycle is in IDLE and has no dependent operational records
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


-- =============================================================================
-- 4. Function: fn_close_and_create_next_cycle
-- =============================================================================
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
    RETURN public.fn_terminate_cycle(p_pond_index, p_harvest_date, p_final_status, true);
END;
$$;


-- =============================================================================
-- 5. Function: fn_delete_idle_cycle
-- =============================================================================
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
    SELECT pond_status INTO v_status
    FROM public.growout_pond_master
    WHERE pond_index = p_pond_index;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cycle % not found.', p_pond_index;
    END IF;

    IF v_status <> 'IDLE' THEN
        RAISE EXCEPTION 'Cannot delete cycle % with status % (only IDLE cycles can be removed).', p_pond_index, v_status;
    END IF;

    -- Safety: Check that no operational records exist
    IF EXISTS (SELECT 1 FROM public.pond_stocking_batches WHERE pond_index = p_pond_index) OR
       EXISTS (SELECT 1 FROM public.biometrics_sampling WHERE pond_index = p_pond_index) OR
       EXISTS (SELECT 1 FROM public.daily_pond_records WHERE pond_index = p_pond_index) OR
       EXISTS (SELECT 1 FROM public.pond_harvest_daily WHERE pond_index = p_pond_index) THEN
        RAISE EXCEPTION 'Cannot delete cycle %: operational fact records exist.', p_pond_index;
    END IF;

    -- Cascade safe delete child config tables
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

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.fn_create_custom_cycle(varchar, integer, numeric, varchar, date) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_terminate_cycle(varchar, date, varchar, boolean) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_revive_cycle(varchar, boolean) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_close_and_create_next_cycle(varchar, date, varchar) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_delete_idle_cycle(varchar) TO anon, authenticated, service_role;

COMMIT;
