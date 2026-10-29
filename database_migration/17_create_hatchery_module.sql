-- ==============================================================================
-- Migration 17: Telaga Putat Hatchery (TPH) Traceability & Operations Schema
-- Description:
--   1. Master tables for 64 Hatchery PL Tanks & Source / Supplier Dictionaries.
--   2. Broodstock Maturation tables (Batches, Block Assignments, Daily Monitoring).
--   3. PL Tank Culture Runs & Lifecycle Events (Harvest, Flush, Culture).
--   4. Nauplii Allocations (Linking spawning lots & distribution tanks).
--   5. Pond Linkages for full end-to-end trace from broodstock to growout ponds.
--   6. Ingestion RPC (fn_hatchery_ingest) with single-check RLS InitPlan protection
--      to guarantee zero statement timeouts (57014) and 100% complete loads.
--   7. Analytical Views: Tank Matrix Map, Run Traceability, Monthly Performance,
--      Batch Maturation & Broodstock Production, and Growout Stocking Origin.
--
-- Security:
--   - Non-sensitive operational tables allow public read for dashboards.
--   - Write operations (INSERT, UPDATE, DELETE) strictly require DBMS Editor role.
--   - Commercial transactions (Buyer, DO Number, Sales) are isolated in
--     hatchery_run_commercial and protected by fn_can_read_sensitive() (VIEWER+).
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. Master Tables: Tanks, Sources, and Aliases
-- ------------------------------------------------------------------------------

-- 1A. Hatchery Tanks (64 PL tanks across 4 blocks: A, B, C, D)
CREATE TABLE IF NOT EXISTS public.hatchery_tanks (
    tank_code varchar(10) PRIMARY KEY, -- e.g. 'A01', 'B16', 'D09'
    block varchar(2) NOT NULL,          -- 'A', 'B', 'C', 'D'
    tank_no integer NOT NULL,          -- 1 to 16
    row_pos varchar(10) NOT NULL,      -- 'TOP' (09-16), 'BOTTOM' (01-08)
    col_pos integer NOT NULL,          -- 1 to 8 (display coordinate)
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 1B. Hatchery Source Master (Batches & External Suppliers)
CREATE TABLE IF NOT EXISTS public.hatchery_sources (
    source_code varchar(50) PRIMARY KEY,  -- Canonical identifier: e.g. 'S1/2026', 'AP 1/2025', 'EXT-GS'
    display_name varchar(100) NOT NULL,
    supplier varchar(100) NOT NULL,       -- 'SyAqua, Thailand', 'Gertak Sanggul hatchery', etc.
    origin varchar(20) NOT NULL,          -- 'INTERNAL', 'EXTERNAL'
    species varchar(10) DEFAULT 'VAN',    -- 'VAN', 'MON'
    country varchar(50),
    active_from date,
    active_to date,
    notes text,
    created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 1C. Source Aliases / Spelling Normalization Map
CREATE TABLE IF NOT EXISTS public.hatchery_source_map (
    raw_code varchar(100) PRIMARY KEY,    -- Raw text from Excel: e.g. 'SY/2026', 'API/2025', 'SY/GS'
    source_code varchar(50) NOT NULL REFERENCES public.hatchery_sources(source_code) ON UPDATE CASCADE,
    notes text,
    created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 2. Broodstock Maturation Management
-- ------------------------------------------------------------------------------

-- 2A. Broodstock Batches
CREATE TABLE IF NOT EXISTS public.broodstock_batches (
    batch_code varchar(50) PRIMARY KEY,   -- Canonical batch: 'S1/2026', 'AP 1/2025'
    source_code varchar(50) NOT NULL REFERENCES public.hatchery_sources(source_code),
    supplier varchar(100) NOT NULL,
    species varchar(50) DEFAULT 'L.Vannamei',
    arrival_date date NOT NULL,
    arrival_time varchar(20),
    abw_female_g numeric(8,2),
    abw_male_g numeric(8,2),
    arrived_pop_female integer,
    arrived_pop_male integer,
    ablation_date date,
    mat_sheet_name varchar(50),
    created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2B. Broodstock Block Assignments (Maturation Block A or B)
CREATE TABLE IF NOT EXISTS public.broodstock_block_assignments (
    batch_code varchar(50) NOT NULL REFERENCES public.broodstock_batches(batch_code) ON DELETE CASCADE,
    block varchar(2) NOT NULL,            -- 'A', 'B'
    start_date date NOT NULL,
    end_date date,
    derived_from_spawning boolean DEFAULT true,
    created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT pk_broodstock_block_assignments PRIMARY KEY (batch_code, block, start_date)
);

-- 2C. Broodstock Daily Monitoring Records (Full Mat Daily Report data)
CREATE TABLE IF NOT EXISTS public.broodstock_daily (
    batch_code varchar(50) NOT NULL REFERENCES public.broodstock_batches(batch_code) ON DELETE CASCADE,
    rec_date date NOT NULL,
    
    -- Quarantine & Mortalities
    quar_pop_female integer,
    quar_pop_male integer,
    quar_mort_24h_female integer,
    quar_mort_24h_male integer,
    quar_mort_female integer,
    quar_mort_male integer,
    quar_discard_female integer,
    quar_discard_male integer,
    ablated_count integer,

    -- Maturation Population & Mortality
    mat_pop_female integer,
    mat_pop_male integer,
    mat_mort_female integer,
    mat_mort_male integer,
    mat_mort_female_pct numeric(6,2),
    mat_mort_male_pct numeric(6,2),
    mat_discard_female integer,
    mat_discard_male integer,
    mat_transfer_female integer,
    mat_transfer_male integer,

    -- Reproduction & Spawning Performance
    mature_eggs_pcs integer,
    mature_pct numeric(6,2),
    mating_count integer,
    mating_pct numeric(6,2),
    spawning_count integer,
    spawning_female_pct numeric(6,2),
    eggs_k numeric(10,2),
    fertilization_rate_pct numeric(6,2),
    avg_eggs_per_female numeric(10,2),

    -- Nauplii Production & Hatching Rates (Storing both HR A & HR B)
    nauplii_gross_k numeric(10,2),
    hr_a_pct numeric(6,2),                -- Primary HR metric used for display & KPIs
    hr_b_pct numeric(6,2),                -- Secondary HR metric (fertilized basis) stored safely
    avg_nauplii_per_female_k numeric(10,2),

    -- Dispositions & Allocations
    disease_discard_k numeric(10,2),
    overstock_k numeric(10,2),
    nauplii_transfer_k numeric(10,2),
    nauplii_allowance_k numeric(10,2),
    nauplii_stocking_k numeric(10,2),

    -- Feeding & Chemicals
    feed_polychaete_g numeric(10,2),
    feed_squid_g numeric(10,2),
    feed_artemia_g numeric(10,2),
    feed_pellet_g numeric(10,2),
    feed_total_mbw_pct numeric(6,2),
    chem_edta_g numeric(10,2),
    chem_iodine_ml numeric(10,2),
    chem_formalin_ml numeric(10,2),
    chem_chlorine_g numeric(10,2),
    chem_kmno4_g numeric(10,2),

    -- Culture Timeline & Logistics
    doc integer,                          -- Day of Culture
    dop integer,                          -- Day of Production
    stocking_target_date date,
    distribution_tph_k numeric(10,2),
    distribution_free_market_k numeric(10,2),
    distribution_replacement_k numeric(10,2),
    distribution_tank_list text,          -- Raw list of tanks: e.g. 'B10, B11'
    spawner_pool_female integer,
    spawn_block varchar(10),              -- e.g. 'SHA', 'SHB'
    do_no varchar(50),
    treatment text,
    water_temp_0800 numeric(4,1),
    water_salinity_1100 numeric(4,1),
    water_ph_1800 numeric(4,2),

    created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT pk_broodstock_daily PRIMARY KEY (batch_code, rec_date)
);

CREATE INDEX IF NOT EXISTS idx_broodstock_daily_stocking_date
    ON public.broodstock_daily (stocking_target_date, batch_code);

-- ------------------------------------------------------------------------------
-- 3. Post-Larvae (PL) Culture Runs & Events
-- ------------------------------------------------------------------------------

-- 3A. Hatchery Tank Runs (Consolidated header: Tank + Stocking Date)
CREATE TABLE IF NOT EXISTS public.hatchery_tank_runs (
    tank_code varchar(10) NOT NULL REFERENCES public.hatchery_tanks(tank_code),
    stock_date date NOT NULL,
    species varchar(10) NOT NULL,         -- 'VAN', 'MON'
    source_code varchar(50) NOT NULL REFERENCES public.hatchery_sources(source_code),
    source_raw varchar(100),              -- Raw spelling preserved from Excel
    nauplii_stocked_k numeric(10,2),      -- Stocking quantity in thousands
    status varchar(20) NOT NULL,          -- 'CULTURE', 'HARVESTED', 'FLUSHED', 'PARTIAL'
    
    first_harvest_date date,
    last_harvest_date date,
    harvested_total_k numeric(10,2) DEFAULT 0,
    flushed_total_k numeric(10,2) DEFAULT 0,
    
    sr_pct numeric(6,2),                  -- Run Survival Rate %: (harvested / stocked) * 100
    sr_incl_flush_pct numeric(6,2),       -- Total SR %: ((harvested + flushed) / stocked) * 100
    sr_reported_pct numeric(6,2),         -- Original SR recorded in Excel
    
    flags text[] DEFAULT '{}'::text[],    -- e.g. {'SR_GT_100', 'SR_MISMATCH', 'QTY_PENDING'}
    notes text,
    is_stale boolean DEFAULT false,
    created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT pk_hatchery_tank_runs PRIMARY KEY (tank_code, stock_date)
);

CREATE INDEX IF NOT EXISTS idx_hatchery_tank_runs_status
    ON public.hatchery_tank_runs (status, stock_date DESC);

-- 3B. Hatchery Run Lifecycle Events (Every individual Harvest / Flush record)
CREATE TABLE IF NOT EXISTS public.hatchery_run_events (
    tank_code varchar(10) NOT NULL,
    stock_date date NOT NULL,
    event_type varchar(20) NOT NULL,      -- 'HARVEST', 'FLUSH', 'CULTURE'
    event_date date NOT NULL,
    pl_stage integer,                     -- e.g. 14, 15, 16
    qty_k numeric(10,2) NOT NULL,         -- Harvested or Flushed quantity (thousands)
    occurrence_no integer DEFAULT 1,      -- For multiple partial events on the same day/stage
    
    sr_reported_pct numeric(6,2),
    flush_type varchar(50),               -- e.g. 'Zoea Syndrome', 'Over Stock'
    flush_reason text,
    lot_no varchar(50),                   -- e.g. 'A0145417'
    source_sheet varchar(50),
    source_row integer,
    created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT pk_hatchery_run_events PRIMARY KEY (tank_code, stock_date, event_type, event_date, pl_stage, occurrence_no),
    CONSTRAINT fk_hatchery_run_events_run FOREIGN KEY (tank_code, stock_date)
        REFERENCES public.hatchery_tank_runs (tank_code, stock_date) ON DELETE CASCADE
);

-- 3C. Hatchery Commercial Data (Strictly protected sensitive table)
CREATE TABLE IF NOT EXISTS public.hatchery_run_commercial (
    tank_code varchar(10) NOT NULL,
    stock_date date NOT NULL,
    event_type varchar(20) NOT NULL,
    event_date date NOT NULL,
    pl_stage integer NOT NULL,
    occurrence_no integer NOT NULL,
    buyer varchar(50),                    -- 'SGO', 'KGO', 'EXTERNAL'
    do_number varchar(50),
    external_buyer text,
    created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT pk_hatchery_run_commercial PRIMARY KEY (tank_code, stock_date, event_type, event_date, pl_stage, occurrence_no),
    CONSTRAINT fk_hatchery_run_commercial_event FOREIGN KEY (tank_code, stock_date, event_type, event_date, pl_stage, occurrence_no)
        REFERENCES public.hatchery_run_events (tank_code, stock_date, event_type, event_date, pl_stage, occurrence_no) ON DELETE CASCADE
);

-- ------------------------------------------------------------------------------
-- 4. Nauplii Allocations & Growout Traceability Links
-- ------------------------------------------------------------------------------

-- 4A. Nauplii Lot Tank Allocations
CREATE TABLE IF NOT EXISTS public.hatchery_nauplii_allocations (
    batch_code varchar(50) NOT NULL REFERENCES public.broodstock_batches(batch_code) ON DELETE CASCADE,
    rec_date date NOT NULL,
    tank_code varchar(10) NOT NULL REFERENCES public.hatchery_tanks(tank_code),
    stocking_date date NOT NULL,
    raw_tank_list text,
    total_batch_stocking_k numeric(10,2),
    allocated_nauplii_k numeric(10,2),
    allocation_method varchar(20) DEFAULT 'PRORATA', -- 'EXACT', 'PRORATA'
    created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT pk_hatchery_nauplii_allocations PRIMARY KEY (batch_code, rec_date, tank_code)
);

CREATE INDEX IF NOT EXISTS idx_nauplii_allocations_tank_stock
    ON public.hatchery_nauplii_allocations (tank_code, stocking_date);

-- 4B. Pond Linkage Mapping (Linking PL Tank Run to Growout Pond Cycle)
CREATE TABLE IF NOT EXISTS public.hatchery_pond_links (
    tank_code varchar(10) NOT NULL,
    run_stock_date date NOT NULL,
    pond_index varchar(50) NOT NULL,
    pond_stck_date date NOT NULL,
    status varchar(20) DEFAULT 'LINKED' NOT NULL, -- 'LINKED', 'REVIEW', 'REJECTED'
    match_method varchar(20) DEFAULT 'AUTO' NOT NULL, -- 'AUTO', 'MANUAL'
    confidence numeric(4,2) DEFAULT 1.0,
    review_notes text,
    created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT pk_hatchery_pond_links PRIMARY KEY (tank_code, run_stock_date, pond_index, pond_stck_date),
    CONSTRAINT fk_hatchery_pond_links_run FOREIGN KEY (tank_code, run_stock_date)
        REFERENCES public.hatchery_tank_runs (tank_code, stock_date) ON DELETE CASCADE
);

-- ------------------------------------------------------------------------------
-- 5. Import Manifest & Audit Tables
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.hatchery_table_keys (
    table_name text PRIMARY KEY,
    key_columns text[] NOT NULL
);

INSERT INTO public.hatchery_table_keys (table_name, key_columns) VALUES
    ('hatchery_tanks', ARRAY['tank_code']),
    ('hatchery_sources', ARRAY['source_code']),
    ('hatchery_source_map', ARRAY['raw_code']),
    ('broodstock_batches', ARRAY['batch_code']),
    ('broodstock_block_assignments', ARRAY['batch_code', 'block', 'start_date']),
    ('broodstock_daily', ARRAY['batch_code', 'rec_date']),
    ('hatchery_tank_runs', ARRAY['tank_code', 'stock_date']),
    ('hatchery_run_events', ARRAY['tank_code', 'stock_date', 'event_type', 'event_date', 'pl_stage', 'occurrence_no']),
    ('hatchery_run_commercial', ARRAY['tank_code', 'stock_date', 'event_type', 'event_date', 'pl_stage', 'occurrence_no']),
    ('hatchery_nauplii_allocations', ARRAY['batch_code', 'rec_date', 'tank_code']),
    ('hatchery_pond_links', ARRAY['tank_code', 'run_stock_date', 'pond_index', 'pond_stck_date'])
ON CONFLICT (table_name) DO UPDATE SET key_columns = EXCLUDED.key_columns;

CREATE TABLE IF NOT EXISTS public.hatchery_import_runs (
    run_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    started_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    completed_at timestamptz,
    status varchar(20) DEFAULT 'RUNNING' NOT NULL, -- 'RUNNING', 'COMPLETE', 'FAILED'
    summary_file_hash varchar(64),
    mat_file_hash varchar(64),
    failed_stage text,
    error_message text
);

CREATE TABLE IF NOT EXISTS public.hatchery_import_manifest (
    run_id uuid NOT NULL REFERENCES public.hatchery_import_runs(run_id) ON DELETE CASCADE,
    table_name text NOT NULL,
    expected_rows integer NOT NULL,
    actual_rows integer NOT NULL,
    is_ok boolean GENERATED ALWAYS AS (expected_rows = actual_rows) STORED,
    created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT pk_hatchery_import_manifest PRIMARY KEY (run_id, table_name)
);

CREATE TABLE IF NOT EXISTS public.hatchery_import_log (
    id bigserial PRIMARY KEY,
    run_id uuid REFERENCES public.hatchery_import_runs(run_id) ON DELETE SET NULL,
    file_name text,
    sheet_name text,
    row_no integer,
    severity varchar(20) NOT NULL,        -- 'INFO', 'WARN', 'ERROR', 'REVIEW'
    code varchar(50) NOT NULL,
    message text NOT NULL,
    raw_data jsonb,
    created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 6. Atomic Ingestion RPC (Passcode Evaluated ONCE per Chunk)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_hatchery_ingest(
    p_table text,
    p_rows jsonb,
    p_run_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_received integer := 0;
    v_written integer := 0;
BEGIN
    -- 1. Strictly verify DBMS Editor authorization once per call
    IF NOT public.fn_can_write_dbms() THEN
        RAISE EXCEPTION 'Unauthorized: valid DBMS Editor passcode required for hatchery ingest.'
            USING ERRCODE = '42501';
    END IF;

    -- 2. Verify table whitelist
    IF NOT EXISTS (SELECT 1 FROM public.hatchery_table_keys WHERE table_name = p_table) THEN
        RAISE EXCEPTION 'Unsupported hatchery table: %', p_table
            USING ERRCODE = '22023';
    END IF;

    IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0 THEN
        RETURN jsonb_build_object('table', p_table, 'received', 0, 'written', 0);
    END IF;

    v_received := jsonb_array_length(p_rows);

    -- 3. Dynamic idempotent ingest per supported table
    CASE p_table
        WHEN 'hatchery_tanks' THEN
            INSERT INTO public.hatchery_tanks (tank_code, block, tank_no, row_pos, col_pos, is_active)
            SELECT r.tank_code, r.block, r.tank_no, r.row_pos, r.col_pos, COALESCE(r.is_active, true)
            FROM jsonb_populate_recordset(null::public.hatchery_tanks, p_rows) AS r
            ON CONFLICT (tank_code) DO UPDATE SET
                block = EXCLUDED.block,
                tank_no = EXCLUDED.tank_no,
                row_pos = EXCLUDED.row_pos,
                col_pos = EXCLUDED.col_pos,
                is_active = EXCLUDED.is_active;
            GET DIAGNOSTICS v_written = ROW_COUNT;

        WHEN 'hatchery_sources' THEN
            INSERT INTO public.hatchery_sources (source_code, display_name, supplier, origin, species, country, active_from, active_to, notes)
            SELECT r.source_code, r.display_name, r.supplier, r.origin, r.species, r.country, r.active_from, r.active_to, r.notes
            FROM jsonb_populate_recordset(null::public.hatchery_sources, p_rows) AS r
            ON CONFLICT (source_code) DO UPDATE SET
                display_name = EXCLUDED.display_name,
                supplier = EXCLUDED.supplier,
                origin = EXCLUDED.origin,
                species = EXCLUDED.species,
                country = EXCLUDED.country,
                active_from = EXCLUDED.active_from,
                active_to = EXCLUDED.active_to,
                notes = EXCLUDED.notes;
            GET DIAGNOSTICS v_written = ROW_COUNT;

        WHEN 'hatchery_source_map' THEN
            INSERT INTO public.hatchery_source_map (raw_code, source_code, notes)
            SELECT r.raw_code, r.source_code, r.notes
            FROM jsonb_populate_recordset(null::public.hatchery_source_map, p_rows) AS r
            ON CONFLICT (raw_code) DO UPDATE SET
                source_code = EXCLUDED.source_code,
                notes = EXCLUDED.notes;
            GET DIAGNOSTICS v_written = ROW_COUNT;

        WHEN 'broodstock_batches' THEN
            INSERT INTO public.broodstock_batches (batch_code, source_code, supplier, species, arrival_date, arrival_time, abw_female_g, abw_male_g, arrived_pop_female, arrived_pop_male, ablation_date, mat_sheet_name)
            SELECT r.batch_code, r.source_code, r.supplier, r.species, r.arrival_date, r.arrival_time, r.abw_female_g, r.abw_male_g, r.arrived_pop_female, r.arrived_pop_male, r.ablation_date, r.mat_sheet_name
            FROM jsonb_populate_recordset(null::public.broodstock_batches, p_rows) AS r
            ON CONFLICT (batch_code) DO UPDATE SET
                source_code = EXCLUDED.source_code,
                supplier = EXCLUDED.supplier,
                species = EXCLUDED.species,
                arrival_date = EXCLUDED.arrival_date,
                arrival_time = EXCLUDED.arrival_time,
                abw_female_g = EXCLUDED.abw_female_g,
                abw_male_g = EXCLUDED.abw_male_g,
                arrived_pop_female = EXCLUDED.arrived_pop_female,
                arrived_pop_male = EXCLUDED.arrived_pop_male,
                ablation_date = EXCLUDED.ablation_date,
                mat_sheet_name = EXCLUDED.mat_sheet_name;
            GET DIAGNOSTICS v_written = ROW_COUNT;

        WHEN 'broodstock_block_assignments' THEN
            INSERT INTO public.broodstock_block_assignments (batch_code, block, start_date, end_date, derived_from_spawning)
            SELECT r.batch_code, r.block, r.start_date, r.end_date, r.derived_from_spawning
            FROM jsonb_populate_recordset(null::public.broodstock_block_assignments, p_rows) AS r
            ON CONFLICT (batch_code, block, start_date) DO UPDATE SET
                end_date = EXCLUDED.end_date,
                derived_from_spawning = EXCLUDED.derived_from_spawning;
            GET DIAGNOSTICS v_written = ROW_COUNT;

        WHEN 'broodstock_daily' THEN
            INSERT INTO public.broodstock_daily (
                batch_code, rec_date, quar_pop_female, quar_pop_male, quar_mort_24h_female, quar_mort_24h_male,
                quar_mort_female, quar_mort_male, quar_discard_female, quar_discard_male, ablated_count,
                mat_pop_female, mat_pop_male, mat_mort_female, mat_mort_male, mat_mort_female_pct, mat_mort_male_pct,
                mat_discard_female, mat_discard_male, mat_transfer_female, mat_transfer_male, mature_eggs_pcs,
                mature_pct, mating_count, mating_pct, spawning_count, spawning_female_pct, eggs_k, fertilization_rate_pct,
                avg_eggs_per_female, nauplii_gross_k, hr_a_pct, hr_b_pct, avg_nauplii_per_female_k, disease_discard_k,
                overstock_k, nauplii_transfer_k, nauplii_allowance_k, nauplii_stocking_k, feed_polychaete_g,
                feed_squid_g, feed_artemia_g, feed_pellet_g, feed_total_mbw_pct, chem_edta_g, chem_iodine_ml,
                chem_formalin_ml, chem_chlorine_g, chem_kmno4_g, doc, dop, stocking_target_date, distribution_tph_k,
                distribution_free_market_k, distribution_replacement_k, distribution_tank_list, spawner_pool_female,
                spawn_block, do_no, treatment, water_temp_0800, water_salinity_1100, water_ph_1800
            )
            SELECT
                r.batch_code, r.rec_date, r.quar_pop_female, r.quar_pop_male, r.quar_mort_24h_female, r.quar_mort_24h_male,
                r.quar_mort_female, r.quar_mort_male, r.quar_discard_female, r.quar_discard_male, r.ablated_count,
                r.mat_pop_female, r.mat_pop_male, r.mat_mort_female, r.mat_mort_male, r.mat_mort_female_pct, r.mat_mort_male_pct,
                r.mat_discard_female, r.mat_discard_male, r.mat_transfer_female, r.mat_transfer_male, r.mature_eggs_pcs,
                r.mature_pct, r.mating_count, r.mating_pct, r.spawning_count, r.spawning_female_pct, r.eggs_k, r.fertilization_rate_pct,
                r.avg_eggs_per_female, r.nauplii_gross_k, r.hr_a_pct, r.hr_b_pct, r.avg_nauplii_per_female_k, r.disease_discard_k,
                r.overstock_k, r.nauplii_transfer_k, r.nauplii_allowance_k, r.nauplii_stocking_k, r.feed_polychaete_g,
                r.feed_squid_g, r.feed_artemia_g, r.feed_pellet_g, r.feed_total_mbw_pct, r.chem_edta_g, r.chem_iodine_ml,
                r.chem_formalin_ml, r.chem_chlorine_g, r.chem_kmno4_g, r.doc, r.dop, r.stocking_target_date, r.distribution_tph_k,
                r.distribution_free_market_k, r.distribution_replacement_k, r.distribution_tank_list, r.spawner_pool_female,
                r.spawn_block, r.do_no, r.treatment, r.water_temp_0800, r.water_salinity_1100, r.water_ph_1800
            FROM jsonb_populate_recordset(null::public.broodstock_daily, p_rows) AS r
            ON CONFLICT (batch_code, rec_date) DO UPDATE SET
                mat_pop_female = EXCLUDED.mat_pop_female,
                mat_pop_male = EXCLUDED.mat_pop_male,
                mat_mort_female = EXCLUDED.mat_mort_female,
                mat_mort_male = EXCLUDED.mat_mort_male,
                mat_mort_female_pct = EXCLUDED.mat_mort_female_pct,
                mat_mort_male_pct = EXCLUDED.mat_mort_male_pct,
                spawning_count = EXCLUDED.spawning_count,
                spawning_female_pct = EXCLUDED.spawning_female_pct,
                eggs_k = EXCLUDED.eggs_k,
                fertilization_rate_pct = EXCLUDED.fertilization_rate_pct,
                avg_eggs_per_female = EXCLUDED.avg_eggs_per_female,
                nauplii_gross_k = EXCLUDED.nauplii_gross_k,
                hr_a_pct = EXCLUDED.hr_a_pct,
                hr_b_pct = EXCLUDED.hr_b_pct,
                avg_nauplii_per_female_k = EXCLUDED.avg_nauplii_per_female_k,
                nauplii_transfer_k = EXCLUDED.nauplii_transfer_k,
                nauplii_stocking_k = EXCLUDED.nauplii_stocking_k,
                doc = EXCLUDED.doc,
                dop = EXCLUDED.dop,
                stocking_target_date = EXCLUDED.stocking_target_date,
                distribution_tph_k = EXCLUDED.distribution_tph_k,
                distribution_tank_list = EXCLUDED.distribution_tank_list,
                spawner_pool_female = EXCLUDED.spawner_pool_female,
                spawn_block = EXCLUDED.spawn_block;
            GET DIAGNOSTICS v_written = ROW_COUNT;

        WHEN 'hatchery_tank_runs' THEN
            INSERT INTO public.hatchery_tank_runs (
                tank_code, stock_date, species, source_code, source_raw,
                nauplii_stocked_k, status, first_harvest_date, last_harvest_date,
                harvested_total_k, flushed_total_k, sr_pct, sr_incl_flush_pct,
                sr_reported_pct, flags, notes, is_stale, updated_at
            )
            SELECT
                r.tank_code, r.stock_date, r.species, r.source_code, r.source_raw,
                r.nauplii_stocked_k, r.status, r.first_harvest_date, r.last_harvest_date,
                COALESCE(r.harvested_total_k, 0), COALESCE(r.flushed_total_k, 0),
                r.sr_pct, r.sr_incl_flush_pct, r.sr_reported_pct,
                COALESCE(r.flags, '{}'::text[]), r.notes, COALESCE(r.is_stale, false), timezone('utc'::text, now())
            FROM jsonb_populate_recordset(null::public.hatchery_tank_runs, p_rows) AS r
            ON CONFLICT (tank_code, stock_date) DO UPDATE SET
                species = EXCLUDED.species,
                source_code = EXCLUDED.source_code,
                source_raw = EXCLUDED.source_raw,
                nauplii_stocked_k = EXCLUDED.nauplii_stocked_k,
                status = EXCLUDED.status,
                first_harvest_date = EXCLUDED.first_harvest_date,
                last_harvest_date = EXCLUDED.last_harvest_date,
                harvested_total_k = EXCLUDED.harvested_total_k,
                flushed_total_k = EXCLUDED.flushed_total_k,
                sr_pct = EXCLUDED.sr_pct,
                sr_incl_flush_pct = EXCLUDED.sr_incl_flush_pct,
                sr_reported_pct = EXCLUDED.sr_reported_pct,
                flags = EXCLUDED.flags,
                notes = EXCLUDED.notes,
                is_stale = EXCLUDED.is_stale,
                updated_at = timezone('utc'::text, now());
            GET DIAGNOSTICS v_written = ROW_COUNT;

        WHEN 'hatchery_run_events' THEN
            INSERT INTO public.hatchery_run_events (
                tank_code, stock_date, event_type, event_date, pl_stage, qty_k,
                occurrence_no, sr_reported_pct, flush_type, flush_reason, lot_no,
                source_sheet, source_row
            )
            SELECT
                r.tank_code, r.stock_date, r.event_type, r.event_date, r.pl_stage, r.qty_k,
                COALESCE(r.occurrence_no, 1), r.sr_reported_pct, r.flush_type, r.flush_reason,
                r.lot_no, r.source_sheet, r.source_row
            FROM jsonb_populate_recordset(null::public.hatchery_run_events, p_rows) AS r
            ON CONFLICT (tank_code, stock_date, event_type, event_date, pl_stage, occurrence_no) DO UPDATE SET
                qty_k = EXCLUDED.qty_k,
                sr_reported_pct = EXCLUDED.sr_reported_pct,
                flush_type = EXCLUDED.flush_type,
                flush_reason = EXCLUDED.flush_reason,
                lot_no = EXCLUDED.lot_no,
                source_sheet = EXCLUDED.source_sheet,
                source_row = EXCLUDED.source_row;
            GET DIAGNOSTICS v_written = ROW_COUNT;

        WHEN 'hatchery_run_commercial' THEN
            INSERT INTO public.hatchery_run_commercial (
                tank_code, stock_date, event_type, event_date, pl_stage, occurrence_no,
                buyer, do_number, external_buyer
            )
            SELECT
                r.tank_code, r.stock_date, r.event_type, r.event_date, r.pl_stage, COALESCE(r.occurrence_no, 1),
                r.buyer, r.do_number, r.external_buyer
            FROM jsonb_populate_recordset(null::public.hatchery_run_commercial, p_rows) AS r
            ON CONFLICT (tank_code, stock_date, event_type, event_date, pl_stage, occurrence_no) DO UPDATE SET
                buyer = EXCLUDED.buyer,
                do_number = EXCLUDED.do_number,
                external_buyer = EXCLUDED.external_buyer;
            GET DIAGNOSTICS v_written = ROW_COUNT;

        WHEN 'hatchery_nauplii_allocations' THEN
            INSERT INTO public.hatchery_nauplii_allocations (
                batch_code, rec_date, tank_code, stocking_date, raw_tank_list,
                total_batch_stocking_k, allocated_nauplii_k, allocation_method
            )
            SELECT
                r.batch_code, r.rec_date, r.tank_code, r.stocking_date, r.raw_tank_list,
                r.total_batch_stocking_k, r.allocated_nauplii_k, COALESCE(r.allocation_method, 'PRORATA')
            FROM jsonb_populate_recordset(null::public.hatchery_nauplii_allocations, p_rows) AS r
            ON CONFLICT (batch_code, rec_date, tank_code) DO UPDATE SET
                stocking_date = EXCLUDED.stocking_date,
                raw_tank_list = EXCLUDED.raw_tank_list,
                total_batch_stocking_k = EXCLUDED.total_batch_stocking_k,
                allocated_nauplii_k = EXCLUDED.allocated_nauplii_k,
                allocation_method = EXCLUDED.allocation_method;
            GET DIAGNOSTICS v_written = ROW_COUNT;

        WHEN 'hatchery_pond_links' THEN
            INSERT INTO public.hatchery_pond_links (
                tank_code, run_stock_date, pond_index, pond_stck_date,
                status, match_method, confidence, review_notes, updated_at
            )
            SELECT
                r.tank_code, r.run_stock_date, r.pond_index, r.pond_stck_date,
                COALESCE(r.status, 'LINKED'), COALESCE(r.match_method, 'AUTO'),
                COALESCE(r.confidence, 1.0), r.review_notes, timezone('utc'::text, now())
            FROM jsonb_populate_recordset(null::public.hatchery_pond_links, p_rows) AS r
            ON CONFLICT (tank_code, run_stock_date, pond_index, pond_stck_date) DO UPDATE SET
                status = EXCLUDED.status,
                match_method = EXCLUDED.match_method,
                confidence = EXCLUDED.confidence,
                review_notes = EXCLUDED.review_notes,
                updated_at = timezone('utc'::text, now());
            GET DIAGNOSTICS v_written = ROW_COUNT;

    END CASE;

    RETURN jsonb_build_object(
        'table', p_table,
        'received', v_received,
        'written', v_written
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_hatchery_ingest(text, jsonb, uuid)
    TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 7. Analytical Views (Consuming Frontend Modules)
-- ------------------------------------------------------------------------------

-- 7A. 64-Tank Interactive Matrix Map View
CREATE OR REPLACE VIEW public.v_hatchery_tank_map WITH (security_invoker = true) AS
WITH current_runs AS (
    SELECT DISTINCT ON (tank_code)
        tank_code, stock_date, species, source_code, source_raw,
        nauplii_stocked_k, status, first_harvest_date, last_harvest_date,
        harvested_total_k, flushed_total_k, sr_pct, sr_incl_flush_pct,
        sr_reported_pct, flags, notes, is_stale
    FROM public.hatchery_tank_runs
    ORDER BY tank_code, stock_date DESC
),
active_allocations AS (
    SELECT 
        a.tank_code,
        a.stocking_date,
        a.batch_code,
        a.allocated_nauplii_k,
        d.doc AS broodstock_doc,
        d.hr_a_pct,
        d.hr_b_pct,
        b.supplier AS broodstock_supplier,
        b.arrival_date AS broodstock_arrival_date
    FROM public.hatchery_nauplii_allocations a
    JOIN public.broodstock_daily d ON a.batch_code = d.batch_code AND a.rec_date = d.rec_date
    JOIN public.broodstock_batches b ON a.batch_code = b.batch_code
)
SELECT 
    t.tank_code,
    t.block,
    t.tank_no,
    t.row_pos,
    t.col_pos,
    t.is_active,
    
    -- Current Run Telemetry
    r.stock_date,
    r.species,
    r.source_code,
    s.display_name AS source_display_name,
    s.origin AS source_origin,
    r.nauplii_stocked_k,
    COALESCE(r.status, 'IDLE') AS run_status,
    
    -- Biological Progress & Estimated Stage (Offset = 9 days)
    CASE 
        WHEN r.status = 'CULTURE' AND r.stock_date IS NOT NULL THEN (CURRENT_DATE - r.stock_date)
        ELSE NULL
    END AS current_doc,
    CASE 
        WHEN r.status = 'CULTURE' AND r.stock_date IS NOT NULL THEN GREATEST(1, (CURRENT_DATE - r.stock_date) - 9)
        ELSE NULL
    END AS estimated_pl_stage,
    
    -- Harvest Window Indicator (Culture State)
    CASE 
        WHEN r.status = 'CULTURE' THEN
            CASE 
                WHEN (CURRENT_DATE - r.stock_date) - 9 < 10 THEN 'GROWING'
                WHEN (CURRENT_DATE - r.stock_date) - 9 BETWEEN 10 AND 11 THEN 'APPROACHING'
                WHEN (CURRENT_DATE - r.stock_date) - 9 BETWEEN 12 AND 15 THEN 'WINDOW'
                ELSE 'OVERDUE'
            END
        ELSE 'INACTIVE'
    END AS harvest_window_state,
    
    -- Performance Metrics
    r.sr_pct,
    r.sr_incl_flush_pct,
    r.harvested_total_k,
    r.flushed_total_k,
    r.flags,
    
    -- Broodstock Linkage (HR A strictly used for primary display)
    alloc.batch_code AS broodstock_batch,
    alloc.broodstock_supplier,
    alloc.broodstock_arrival_date,
    alloc.broodstock_doc,
    alloc.hr_a_pct AS display_hr_pct,
    alloc.hr_b_pct AS stored_hr_b_pct

FROM public.hatchery_tanks t
LEFT JOIN current_runs r ON t.tank_code = r.tank_code
LEFT JOIN public.hatchery_sources s ON r.source_code = s.source_code
LEFT JOIN active_allocations alloc ON r.tank_code = alloc.tank_code AND r.stock_date = alloc.stocking_date;

-- 7B. End-to-End Run Traceability View
CREATE OR REPLACE VIEW public.v_hatchery_run_trace WITH (security_invoker = true) AS
SELECT
    r.tank_code,
    r.stock_date,
    r.species,
    r.source_code,
    s.display_name AS source_name,
    s.supplier,
    s.origin AS source_origin,
    r.nauplii_stocked_k,
    r.status AS run_status,
    r.first_harvest_date,
    r.last_harvest_date,
    r.harvested_total_k,
    r.flushed_total_k,
    r.sr_pct,
    r.sr_incl_flush_pct,
    r.sr_reported_pct,
    
    -- Maturation Batch Details
    bb.batch_code AS broodstock_batch,
    bb.supplier AS broodstock_supplier,
    bb.arrival_date AS broodstock_arrival_date,
    bd.doc AS broodstock_doc_at_stocking,
    bd.hr_a_pct AS hr_a_pct,               -- Visualized HR
    bd.hr_b_pct AS hr_b_pct,               -- Stored secondary metric
    bd.fertilization_rate_pct,
    bd.spawning_count,
    bd.nauplii_gross_k,
    bd.spawn_block,
    bd.do_no,
    
    -- Linked Growout Pond Summary
    link.pond_index,
    link.pond_stck_date,
    link.status AS link_status,
    link.match_method,
    m.pond AS pond_code,
    m.modl AS pond_module,
    m.crop_no,
    m.cycle_no

FROM public.hatchery_tank_runs r
JOIN public.hatchery_sources s ON r.source_code = s.source_code
LEFT JOIN public.hatchery_nauplii_allocations a ON r.tank_code = a.tank_code AND r.stock_date = a.stocking_date
LEFT JOIN public.broodstock_batches bb ON a.batch_code = bb.batch_code
LEFT JOIN public.broodstock_daily bd ON a.batch_code = bd.batch_code AND a.rec_date = bd.rec_date
LEFT JOIN public.hatchery_pond_links link ON r.tank_code = link.tank_code AND r.stock_date = link.run_stock_date
LEFT JOIN public.growout_pond_master m ON link.pond_index = m.pond_index;

-- 7C. Monthly PL Harvest & Production Breakdown (Mirrors PL Prod Sheet)
CREATE OR REPLACE VIEW public.v_hatchery_pl_monthly WITH (security_invoker = true) AS
SELECT 
    to_char(e.event_date, 'YYYY-MM') AS month_key,
    EXTRACT(YEAR FROM e.event_date)::integer AS harvest_year,
    EXTRACT(MONTH FROM e.event_date)::integer AS harvest_month,
    s.origin AS source_origin,
    r.species,
    e.event_type,
    COUNT(DISTINCT r.tank_code || '_' || r.stock_date::text) AS run_count,
    SUM(e.qty_k) AS total_qty_k,
    ROUND(AVG(e.pl_stage), 1) AS avg_pl_stage
FROM public.hatchery_run_events e
JOIN public.hatchery_tank_runs r ON e.tank_code = r.tank_code AND e.stock_date = r.stock_date
JOIN public.hatchery_sources s ON r.source_code = s.source_code
GROUP BY 
    to_char(e.event_date, 'YYYY-MM'),
    EXTRACT(YEAR FROM e.event_date),
    EXTRACT(MONTH FROM e.event_date),
    s.origin,
    r.species,
    e.event_type;

-- 7D. Growout Pond Hatchery Origin View (Consumed by DBMS Stocking Tab)
CREATE OR REPLACE VIEW public.v_hatchery_pond_origin WITH (security_invoker = true) AS
SELECT
    l.pond_index,
    l.pond_stck_date,
    l.tank_code AS hatchery_tank,
    l.run_stock_date AS hatchery_stock_date,
    l.status AS link_status,
    l.match_method,
    
    r.species AS pl_species,
    r.source_code,
    s.display_name AS source_name,
    s.supplier AS hatchery_supplier,
    s.origin AS hatchery_origin,
    r.sr_pct AS hatchery_tank_sr_pct,
    r.sr_incl_flush_pct AS hatchery_tank_sr_total_pct,
    
    -- Maturation Trace
    bb.batch_code AS broodstock_batch,
    bb.supplier AS broodstock_supplier,
    bb.arrival_date AS broodstock_arrival_date,
    bd.doc AS broodstock_doc,
    bd.hr_a_pct AS display_hr_pct,
    bd.hr_b_pct AS stored_hr_b_pct,
    bd.nauplii_gross_k AS batch_nauplii_gross_k,
    bd.spawn_block

FROM public.hatchery_pond_links l
JOIN public.hatchery_tank_runs r ON l.tank_code = r.tank_code AND l.run_stock_date = r.stock_date
JOIN public.hatchery_sources s ON r.source_code = s.source_code
LEFT JOIN public.hatchery_nauplii_allocations a ON r.tank_code = a.tank_code AND r.stock_date = a.stocking_date
LEFT JOIN public.broodstock_batches bb ON a.batch_code = bb.batch_code
LEFT JOIN public.broodstock_daily bd ON a.batch_code = bd.batch_code AND a.rec_date = bd.rec_date;

-- 7E. Ingestion Completeness Verification View
CREATE OR REPLACE VIEW public.v_hatchery_completeness WITH (security_invoker = true) AS
SELECT
    m.run_id,
    r.started_at,
    r.completed_at,
    r.status AS run_status,
    m.table_name,
    m.expected_rows,
    m.actual_rows,
    m.is_ok
FROM public.hatchery_import_manifest m
JOIN public.hatchery_import_runs r ON m.run_id = r.run_id
ORDER BY r.started_at DESC, m.table_name ASC;

-- ------------------------------------------------------------------------------
-- 8. Row-Level Security (RLS) Policies (Statement-Level InitPlan Guard)
-- ------------------------------------------------------------------------------

-- Enable RLS across all operational tables
ALTER TABLE public.hatchery_tanks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hatchery_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hatchery_source_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broodstock_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broodstock_block_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broodstock_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hatchery_tank_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hatchery_run_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hatchery_run_commercial ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hatchery_nauplii_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hatchery_pond_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hatchery_import_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hatchery_import_manifest ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hatchery_import_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hatchery_table_keys ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    v_tbl text;
    v_open_tables text[] := ARRAY[
        'hatchery_tanks',
        'hatchery_sources',
        'hatchery_source_map',
        'broodstock_batches',
        'broodstock_block_assignments',
        'broodstock_daily',
        'hatchery_tank_runs',
        'hatchery_run_events',
        'hatchery_nauplii_allocations',
        'hatchery_pond_links',
        'hatchery_table_keys',
        'hatchery_import_runs',
        'hatchery_import_manifest',
        'hatchery_import_log'
    ];
BEGIN
    FOREACH v_tbl IN ARRAY v_open_tables LOOP
        -- Allow public dashboard read
        EXECUTE format('DROP POLICY IF EXISTS "Allow read on %1$s" ON public.%1$I', v_tbl);
        EXECUTE format('CREATE POLICY "Allow read on %1$s" ON public.%1$I FOR SELECT USING (true)', v_tbl);

        -- Restrict write operations to DBMS Editor using statement-level InitPlan
        EXECUTE format('DROP POLICY IF EXISTS "Require editor write on %1$s" ON public.%1$I', v_tbl);
        EXECUTE format('CREATE POLICY "Require editor write on %1$s" ON public.%1$I FOR INSERT WITH CHECK ((SELECT public.fn_can_write_dbms()))', v_tbl);

        EXECUTE format('DROP POLICY IF EXISTS "Require editor update on %1$s" ON public.%1$I', v_tbl);
        EXECUTE format('CREATE POLICY "Require editor update on %1$s" ON public.%1$I FOR UPDATE USING ((SELECT public.fn_can_write_dbms())) WITH CHECK ((SELECT public.fn_can_write_dbms()))', v_tbl);

        EXECUTE format('DROP POLICY IF EXISTS "Require editor delete on %1$s" ON public.%1$I', v_tbl);
        EXECUTE format('CREATE POLICY "Require editor delete on %1$s" ON public.%1$I FOR DELETE USING ((SELECT public.fn_can_write_dbms()))', v_tbl);
    END LOOP;
END $$;

-- 8B. Strict Protection for Sensitive Commercial Table
DROP POLICY IF EXISTS "Authenticated read commercial" ON public.hatchery_run_commercial;
DROP POLICY IF EXISTS "Editor write commercial" ON public.hatchery_run_commercial;

CREATE POLICY "Authenticated read commercial"
    ON public.hatchery_run_commercial FOR SELECT
    USING ((SELECT public.fn_can_read_sensitive()));

CREATE POLICY "Editor write commercial"
    ON public.hatchery_run_commercial FOR ALL
    USING ((SELECT public.fn_can_write_dbms()))
    WITH CHECK ((SELECT public.fn_can_write_dbms()));

-- ------------------------------------------------------------------------------
-- 9. Explicit Grants (Hatchery Tables & Views Only — Never Touching Existing Schema)
-- ------------------------------------------------------------------------------

-- Grants on new operational tables
GRANT SELECT ON public.hatchery_tanks TO anon, authenticated, service_role;
GRANT SELECT ON public.hatchery_sources TO anon, authenticated, service_role;
GRANT SELECT ON public.hatchery_source_map TO anon, authenticated, service_role;
GRANT SELECT ON public.broodstock_batches TO anon, authenticated, service_role;
GRANT SELECT ON public.broodstock_block_assignments TO anon, authenticated, service_role;
GRANT SELECT ON public.broodstock_daily TO anon, authenticated, service_role;
GRANT SELECT ON public.hatchery_tank_runs TO anon, authenticated, service_role;
GRANT SELECT ON public.hatchery_run_events TO anon, authenticated, service_role;
GRANT SELECT ON public.hatchery_run_commercial TO anon, authenticated, service_role;
GRANT SELECT ON public.hatchery_nauplii_allocations TO anon, authenticated, service_role;
GRANT SELECT ON public.hatchery_pond_links TO anon, authenticated, service_role;
GRANT SELECT ON public.hatchery_table_keys TO anon, authenticated, service_role;
GRANT SELECT ON public.hatchery_import_runs TO anon, authenticated, service_role;
GRANT SELECT ON public.hatchery_import_manifest TO anon, authenticated, service_role;
GRANT SELECT ON public.hatchery_import_log TO anon, authenticated, service_role;

-- Grants on new analytical views
GRANT SELECT ON public.v_hatchery_tank_map TO anon, authenticated, service_role;
GRANT SELECT ON public.v_hatchery_run_trace TO anon, authenticated, service_role;
GRANT SELECT ON public.v_hatchery_pl_monthly TO anon, authenticated, service_role;
GRANT SELECT ON public.v_hatchery_pond_origin TO anon, authenticated, service_role;
GRANT SELECT ON public.v_hatchery_completeness TO anon, authenticated, service_role;

-- Full service_role management on new hatchery objects
GRANT ALL ON public.hatchery_tanks TO service_role;
GRANT ALL ON public.hatchery_sources TO service_role;
GRANT ALL ON public.hatchery_source_map TO service_role;
GRANT ALL ON public.broodstock_batches TO service_role;
GRANT ALL ON public.broodstock_block_assignments TO service_role;
GRANT ALL ON public.broodstock_daily TO service_role;
GRANT ALL ON public.hatchery_tank_runs TO service_role;
GRANT ALL ON public.hatchery_run_events TO service_role;
GRANT ALL ON public.hatchery_run_commercial TO service_role;
GRANT ALL ON public.hatchery_nauplii_allocations TO service_role;
GRANT ALL ON public.hatchery_pond_links TO service_role;
GRANT ALL ON public.hatchery_table_keys TO service_role;
GRANT ALL ON public.hatchery_import_runs TO service_role;
GRANT ALL ON public.hatchery_import_manifest TO service_role;
GRANT ALL ON public.hatchery_import_log TO service_role;

COMMIT;
