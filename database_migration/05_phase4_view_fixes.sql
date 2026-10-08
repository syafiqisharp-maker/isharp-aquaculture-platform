BEGIN;

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
    g.pm_staff_no,
    g.sv_staff_no,
    g.rl_staff_no,
    g.po_staff_no,
    g.support_staff_no,
    -- Virtual Aerator Columns
    COALESCE(a1.total_units, 0) AS aerator_1hp,
    COALESCE(a2.total_units, 0) AS aerator_2hp,
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
     -- Aerator Joins
     LEFT JOIN (SELECT pond_index, SUM(total_units) as total_units FROM pond_aerator_inventory WHERE hp = 1 GROUP BY pond_index) a1 ON g.pond_index::text = a1.pond_index::text
     LEFT JOIN (SELECT pond_index, SUM(total_units) as total_units FROM pond_aerator_inventory WHERE hp = 2 GROUP BY pond_index) a2 ON g.pond_index::text = a2.pond_index::text
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
    aerator_1hp,
    aerator_2hp,
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
