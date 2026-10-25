-- ==============================================================================
-- Migration 12: Normalize Staff Numbers, Aerator Models & View Enhancements
-- Description:
--   1. Zero-pads staff numbers in public.growout_pond_master to 4 digits (e.g. '415' -> '0415').
--   2. Fixes typo for staff #2688 in public.pond_staff ('bi Md' -> 'bin Md').
--   3. Standardizes aerator model names in public.pond_aerator_inventory to '1.0 HP Paddlewheel'
--      and '2.0 HP Paddlewheel' and deduplicates redundant rows.
--   4. Updates public.view_growout_pond_cycles and public.pond_cycles to expose
--      resolved staff names (pm_staff_name, sv_staff_name, rl_staff_name, po_staff_name, support_staff_name)
--      and inventory attributes (feeding_tray_count, autofeeder_count, hut_condition).
-- ==============================================================================

BEGIN;

-- 1. Normalize Staff IDs in growout_pond_master to 4 digits
UPDATE public.growout_pond_master
SET rl_staff_no = LPAD(TRIM(rl_staff_no), 4, '0')
WHERE rl_staff_no IS NOT NULL AND LENGTH(TRIM(rl_staff_no)) < 4 AND TRIM(rl_staff_no) ~ '^\d+$';

UPDATE public.growout_pond_master
SET sv_staff_no = LPAD(TRIM(sv_staff_no), 4, '0')
WHERE sv_staff_no IS NOT NULL AND LENGTH(TRIM(sv_staff_no)) < 4 AND TRIM(sv_staff_no) ~ '^\d+$';

UPDATE public.growout_pond_master
SET po_staff_no = LPAD(TRIM(po_staff_no), 4, '0')
WHERE po_staff_no IS NOT NULL AND LENGTH(TRIM(po_staff_no)) < 4 AND TRIM(po_staff_no) ~ '^\d+$';

UPDATE public.growout_pond_master
SET pm_staff_no = LPAD(TRIM(pm_staff_no), 4, '0')
WHERE pm_staff_no IS NOT NULL AND LENGTH(TRIM(pm_staff_no)) < 4 AND TRIM(pm_staff_no) ~ '^\d+$';

UPDATE public.growout_pond_master
SET support_staff_no = LPAD(TRIM(support_staff_no), 4, '0')
WHERE support_staff_no IS NOT NULL AND LENGTH(TRIM(support_staff_no)) < 4 AND TRIM(support_staff_no) ~ '^\d+$';

-- 2. Fix staff name typo for #2688
UPDATE public.pond_staff
SET staff_name = 'Muhammad Hafizuddin bin Md Hussin'
WHERE staff_no = '2688';

-- 3. Standardize aerator model strings in pond_aerator_inventory
UPDATE public.pond_aerator_inventory
SET aerator_model = '1.0 HP Paddlewheel'
WHERE aerator_model = '1 HP Paddlewheel';

UPDATE public.pond_aerator_inventory
SET aerator_model = '2.0 HP Paddlewheel'
WHERE aerator_model = '2 HP Paddlewheel';

-- Deduplicate any duplicate rows for the same pond_index and hp (keeping highest units or latest updated_at)
DELETE FROM public.pond_aerator_inventory a
WHERE a.id IN (
    SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY pond_index, hp
                   ORDER BY updated_at DESC, total_units DESC
               ) as rnum
        FROM public.pond_aerator_inventory
    ) t
    WHERE t.rnum > 1
);

-- 4. Recreate view_growout_pond_cycles with resolved staff names and inventory
DROP VIEW IF EXISTS public.pond_cycles;
DROP VIEW IF EXISTS public.view_growout_pond_cycles CASCADE;

CREATE VIEW public.view_growout_pond_cycles WITH (security_invoker=true) AS
 SELECT g.pond_index,
    g.pond,
    g.farm,
    g.modl,
    g.row_no,
    g.area,
    g.pond_type,
    g.pond_usage,
    g.crop_no,
    g.cycle_no,
    g.pond_status,
    g.pond_active,
    g.culture_status,
    g.strategy,
    g.final_status,
    g.disease_status,
    g.idle_days,
    g.idle_status,
    g.water_type,
    g.tested,
    g.created_at,
    sb.stck_date,
    sb.stck_source,
    sb.stck_species,
    sb.stck_pcs,
    sb.stck_allow,
    sb.stck_total,
    sb.stck_tank,
    sb.stck_size,
    sb.stck_plstts,
    sb.bs_line,
    COALESCE(sb.batch_count, 0) AS batch_count,
    -- Staff ID columns
    g.pm_staff_no,
    g.sv_staff_no,
    g.rl_staff_no,
    g.po_staff_no,
    g.support_staff_no,
    -- Resolved Staff Names
    ps_pm.staff_name AS pm_staff_name,
    ps_sv.staff_name AS sv_staff_name,
    ps_rl.staff_name AS rl_staff_name,
    ps_po.staff_name AS po_staff_name,
    ps_sup.staff_name AS support_staff_name,
    -- Virtual Aerator Columns
    COALESCE(a1.total_units, 0) AS aerator_1hp,
    COALESCE(a2.total_units, 0) AS aerator_2hp,
    -- Virtual Inventory Columns
    inv.feeding_tray_count,
    inv.autofeeder_count,
    inv.hut_condition,
    inv.updated_at AS inventory_updated_at,
    -- Virtual Initiatives (Fallback to array array_agg)
    i.initiative_arr[1] AS initiative,
    i.initiative_arr[2] AS initiative1,
    i.initiative_arr[3] AS initiative2,
    -- Virtual Date Columns
    d_disease.event_date AS date_disease,
    d_close.event_date AS date_close,
    d_cycle.event_date AS date_cycle,
    d_cleaning.event_date AS date_cleaning,
    d_repair.event_date AS date_repair,
    d_filling.event_date AS date_filling,
    d_culture.event_date AS date_culture,
    d_baby_box.event_date AS date_baby_box,
    d_qaqc.event_date AS date_qaqc,
    d_ready.event_date AS date_ready,
    d_plan_stock.event_date AS date_plan_stock

   FROM growout_pond_master g
     LEFT JOIN ( SELECT pond_stocking_batches.pond_index,
            min(pond_stocking_batches.stck_date) AS stck_date,
            string_agg(DISTINCT pond_stocking_batches.stck_source::text, ', '::text) AS stck_source,
            mode() WITHIN GROUP (ORDER BY pond_stocking_batches.stck_species) AS stck_species,
            sum(COALESCE(pond_stocking_batches.stck_pcs, 0::numeric)) AS stck_pcs,
            sum(COALESCE(pond_stocking_batches.stck_allow, 0::numeric)) AS stck_allow,
            sum(COALESCE(pond_stocking_batches.stck_total, COALESCE(pond_stocking_batches.stck_pcs, 0::numeric) + COALESCE(pond_stocking_batches.stck_allow, 0::numeric))) AS stck_total,
            string_agg(DISTINCT pond_stocking_batches.stck_tank::text, ', '::text) AS stck_tank,
            avg(pond_stocking_batches.stck_size) AS stck_size,
            mode() WITHIN GROUP (ORDER BY pond_stocking_batches.stck_plstts) AS stck_plstts,
            string_agg(DISTINCT pond_stocking_batches.bs_line::text, ', '::text) AS bs_line,
            count(*)::integer AS batch_count
           FROM pond_stocking_batches
          GROUP BY pond_stocking_batches.pond_index) sb ON g.pond_index::text = sb.pond_index::text
     -- Staff Joins
     LEFT JOIN public.pond_staff ps_pm ON g.pm_staff_no = ps_pm.staff_no
     LEFT JOIN public.pond_staff ps_sv ON g.sv_staff_no = ps_sv.staff_no
     LEFT JOIN public.pond_staff ps_rl ON g.rl_staff_no = ps_rl.staff_no
     LEFT JOIN public.pond_staff ps_po ON g.po_staff_no = ps_po.staff_no
     LEFT JOIN public.pond_staff ps_sup ON g.support_staff_no = ps_sup.staff_no
     -- Aerator Joins
     LEFT JOIN (SELECT pond_index, SUM(total_units) as total_units FROM pond_aerator_inventory WHERE hp = 1 GROUP BY pond_index) a1 ON g.pond_index::text = a1.pond_index::text
     LEFT JOIN (SELECT pond_index, SUM(total_units) as total_units FROM pond_aerator_inventory WHERE hp = 2 GROUP BY pond_index) a2 ON g.pond_index::text = a2.pond_index::text
     -- Inventory Join
     LEFT JOIN public.pond_inventories inv ON g.pond_index::text = inv.pond_index::text
     -- Date Joins
     LEFT JOIN (SELECT pond_index, MAX(event_date) as event_date FROM pond_event_date WHERE event_name = 'disease' GROUP BY pond_index) d_disease ON g.pond_index::text = d_disease.pond_index::text
     LEFT JOIN (SELECT pond_index, MAX(event_date) as event_date FROM pond_event_date WHERE event_name = 'close' GROUP BY pond_index) d_close ON g.pond_index::text = d_close.pond_index::text
     LEFT JOIN (SELECT pond_index, MAX(event_date) as event_date FROM pond_event_date WHERE event_name = 'cycle' GROUP BY pond_index) d_cycle ON g.pond_index::text = d_cycle.pond_index::text
     LEFT JOIN (SELECT pond_index, MAX(event_date) as event_date FROM pond_event_date WHERE event_name = 'cleaning' GROUP BY pond_index) d_cleaning ON g.pond_index::text = d_cleaning.pond_index::text
     LEFT JOIN (SELECT pond_index, MAX(event_date) as event_date FROM pond_event_date WHERE event_name = 'repair' GROUP BY pond_index) d_repair ON g.pond_index::text = d_repair.pond_index::text
     LEFT JOIN (SELECT pond_index, MAX(event_date) as event_date FROM pond_event_date WHERE event_name = 'filling' GROUP BY pond_index) d_filling ON g.pond_index::text = d_filling.pond_index::text
     LEFT JOIN (SELECT pond_index, MAX(event_date) as event_date FROM pond_event_date WHERE event_name = 'culture' GROUP BY pond_index) d_culture ON g.pond_index::text = d_culture.pond_index::text
     LEFT JOIN (SELECT pond_index, MAX(event_date) as event_date FROM pond_event_date WHERE event_name = 'baby_box' GROUP BY pond_index) d_baby_box ON g.pond_index::text = d_baby_box.pond_index::text
     LEFT JOIN (SELECT pond_index, MAX(event_date) as event_date FROM pond_event_date WHERE event_name = 'qaqc' GROUP BY pond_index) d_qaqc ON g.pond_index::text = d_qaqc.pond_index::text
     LEFT JOIN (SELECT pond_index, MAX(event_date) as event_date FROM pond_event_date WHERE event_name = 'ready' GROUP BY pond_index) d_ready ON g.pond_index::text = d_ready.pond_index::text
     LEFT JOIN (SELECT pond_index, MAX(event_date) as event_date FROM pond_event_date WHERE event_name = 'plan_stock' GROUP BY pond_index) d_plan_stock ON g.pond_index::text = d_plan_stock.pond_index::text
     -- Initiative Join
     LEFT JOIN (SELECT pond_index, array_agg(initiative_name ORDER BY created_at ASC) as initiative_arr FROM pond_initiatives GROUP BY pond_index) i ON g.pond_index::text = i.pond_index::text;

-- 5. Recreate pond_cycles wrapper view
CREATE VIEW public.pond_cycles WITH (security_invoker=true) AS
 SELECT pond_index,
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
    water_type,
    tested,
    created_at,
    stck_date,
    stck_source,
    stck_species,
    stck_pcs,
    stck_allow,
    stck_total,
    stck_tank,
    stck_size,
    stck_plstts,
    bs_line,
    batch_count,
    pm_staff_no,
    sv_staff_no,
    rl_staff_no,
    po_staff_no,
    support_staff_no,
    pm_staff_name,
    sv_staff_name,
    rl_staff_name,
    po_staff_name,
    support_staff_name,
    aerator_1hp,
    aerator_2hp,
    feeding_tray_count,
    autofeeder_count,
    hut_condition,
    inventory_updated_at,
    initiative,
    initiative1,
    initiative2,
    date_disease,
    date_close,
    date_cycle,
    date_cleaning,
    date_repair,
    date_filling,
    date_culture,
    date_baby_box,
    date_qaqc,
    date_ready,
    date_plan_stock
   FROM public.view_growout_pond_cycles;

COMMIT;
