-- ==============================================================================
-- iSHARP Database Migration 18: Resilient Broodstock Days of Culture (DOC) Views
-- ==============================================================================
-- Ensures that v_hatchery_pond_origin and v_hatchery_run_trace always yield
-- the authentic 0-based Broodstock DOC at spawning/stocking, calculating it
-- dynamically via (rec_date - arrival_date) if bd.doc is ever null.
--
-- Security: security_invoker = true, SELECT granted to anon, authenticated, service_role.
-- ==============================================================================

BEGIN;

-- 1. Update End-to-End Run Traceability View
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
    
    -- Maturation Batch Details with Dynamic Fallback DOC
    bb.batch_code AS broodstock_batch,
    bb.supplier AS broodstock_supplier,
    bb.arrival_date AS broodstock_arrival_date,
    COALESCE(bd.doc, (bd.rec_date - bb.arrival_date)::integer, 0) AS broodstock_doc_at_stocking,
    bd.hr_a_pct AS hr_a_pct,               -- Visualized HR (Decision 20)
    bd.hr_b_pct AS hr_b_pct,               -- Stored secondary metric
    bd.fertilization_rate_pct,
    bd.spawning_count,
    bd.nauplii_gross_k,
    bd.spawn_block,
    bd.do_no,
    
    -- Nauplii Allocation Details
    a.rec_date AS spawn_date,
    a.nauplii_transferred_k AS nauplii_allocated_k

FROM public.hatchery_tank_runs r
JOIN public.hatchery_sources s ON r.source_code = s.source_code
LEFT JOIN public.hatchery_nauplii_allocations a ON r.tank_code = a.tank_code AND r.stock_date = a.stocking_date
LEFT JOIN public.broodstock_batches bb ON a.batch_code = bb.batch_code
LEFT JOIN public.broodstock_daily bd ON a.batch_code = bd.batch_code AND a.rec_date = bd.rec_date;

-- 2. Update Growout Pond Hatchery Origin View (Consumed by DBMS Stocking Tab)
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
    
    -- Maturation Trace with Dynamic Fallback DOC
    bb.batch_code AS broodstock_batch,
    bb.supplier AS broodstock_supplier,
    bb.arrival_date AS broodstock_arrival_date,
    COALESCE(bd.doc, (bd.rec_date - bb.arrival_date)::integer, 0) AS broodstock_doc,
    bd.hr_a_pct AS display_hr_pct,         -- Decision 20: Display ONLY HR-A
    bd.hr_b_pct AS stored_hr_b_pct,
    bd.nauplii_gross_k AS batch_nauplii_gross_k,
    bd.spawn_block

FROM public.hatchery_pond_links l
JOIN public.hatchery_tank_runs r ON l.tank_code = r.tank_code AND l.run_stock_date = r.stock_date
JOIN public.hatchery_sources s ON r.source_code = s.source_code
LEFT JOIN public.hatchery_nauplii_allocations a ON r.tank_code = a.tank_code AND r.stock_date = a.stocking_date
LEFT JOIN public.broodstock_batches bb ON a.batch_code = bb.batch_code
LEFT JOIN public.broodstock_daily bd ON a.batch_code = bd.batch_code AND a.rec_date = bd.rec_date;

-- 3. Grants
GRANT SELECT ON public.v_hatchery_run_trace TO anon, authenticated, service_role;
GRANT SELECT ON public.v_hatchery_pond_origin TO anon, authenticated, service_role;

COMMIT;
