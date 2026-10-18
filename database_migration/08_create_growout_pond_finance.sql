-- Migration: 08_create_growout_pond_finance.sql
-- Description: Create growout_pond_finance table in Supabase Cloud to host audited cycle financial records from MS Access GrowoutPondFinance.

CREATE TABLE IF NOT EXISTS public.growout_pond_finance (
    index_no INTEGER PRIMARY KEY,
    pond_index VARCHAR(50) NOT NULL,
    revenue NUMERIC(14,2),
    premium_pct NUMERIC(8,4),
    small_pct NUMERIC(8,4),
    cons_of_fries NUMERIC(14,2),
    cons_of_feed NUMERIC(14,2),
    cons_of_chem_fert NUMERIC(14,2),
    cons_of_supplies NUMERIC(14,2),
    wages_direct NUMERIC(14,2),
    wages_indirect NUMERIC(14,2),
    electricity NUMERIC(14,2),
    repair_maintenance NUMERIC(14,2),
    consultant NUMERIC(14,2),
    rental NUMERIC(14,2),
    travel_entertainment NUMERIC(14,2),
    training_seminar NUMERIC(14,2),
    depreciation_fc NUMERIC(14,2),
    harvest_expenses NUMERIC(14,2),
    security_charges NUMERIC(14,2),
    other_utilities_ins NUMERIC(14,2),
    other_charges NUMERIC(14,2),
    total_cost NUMERIC(14,2),
    gross_profit NUMERIC(14,2),
    sag NUMERIC(14,2),
    ebit NUMERIC(14,2),
    depreciation_with_sag NUMERIC(14,2),
    ebitda NUMERIC(14,2),
    ytd_sag NUMERIC(14,2),
    ytd_sag_annualised NUMERIC(14,2),
    cost_per_kg NUMERIC(10,4),
    cash_cost_per_kg NUMERIC(10,4),
    total_cost_per_kg_with_sag NUMERIC(10,4),
    total_cash_cost_per_kg_with_sag NUMERIC(10,4),
    depreciation_sag_per_pond NUMERIC(14,2),
    ytd_sag_depreciation NUMERIC(14,2),
    ytd_sag_depreciation_annualised NUMERIC(14,2),
    revenue_per_kg NUMERIC(10,4),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance index for fast pond cycle lookups
CREATE INDEX IF NOT EXISTS idx_growout_pond_finance_pond_index ON public.growout_pond_finance (pond_index);

-- Enable RLS with public access matching iSHARP standard
ALTER TABLE public.growout_pond_finance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read-write on growout_pond_finance" ON public.growout_pond_finance;

CREATE POLICY "Allow public read-write on growout_pond_finance" 
ON public.growout_pond_finance FOR ALL 
USING (true) WITH CHECK (true);

-- Grant permissions to Supabase roles
GRANT SELECT, INSERT, UPDATE, DELETE ON public.growout_pond_finance TO anon, authenticated, service_role;
