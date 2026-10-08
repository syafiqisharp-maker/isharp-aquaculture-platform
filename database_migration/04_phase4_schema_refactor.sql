BEGIN;

-- 1. Drop the dependent views first
DROP VIEW IF EXISTS public.pond_cycles;
DROP VIEW IF EXISTS public.view_growout_pond_cycles CASCADE;

-- 2. Drop the redundant columns from the master table
ALTER TABLE public.growout_pond_master
    DROP COLUMN legacy_initiative,
    DROP COLUMN initiative1,
    DROP COLUMN initiative2,
    DROP COLUMN aerator_1hp,
    DROP COLUMN aerator_2hp,
    DROP COLUMN date_disease,
    DROP COLUMN date_close,
    DROP COLUMN date_cycle,
    DROP COLUMN date_cleaning,
    DROP COLUMN date_repair,
    DROP COLUMN date_filling,
    DROP COLUMN date_culture,
    DROP COLUMN date_baby_box,
    DROP COLUMN date_qaqc,
    DROP COLUMN date_ready,
    DROP COLUMN date_plan_stock;

-- 3. Recreate view_growout_pond_cycles without the dropped columns
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
    g.pm_staff_no,
    g.sv_staff_no,
    g.rl_staff_no,
    g.po_staff_no,
    g.support_staff_no
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
          GROUP BY pond_stocking_batches.pond_index) sb ON g.pond_index::text = sb.pond_index::text;

-- 4. Recreate pond_cycles without the dropped columns
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
    support_staff_no
   FROM public.view_growout_pond_cycles;

COMMIT;
