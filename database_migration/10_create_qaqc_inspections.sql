-- Migration: 10_create_qaqc_inspections.sql
-- Description: Creates the qaqc_inspections table to store digital inspection records
--              (Pond Cleaning, Stocking Readiness, Stocking Event, Mortality, Pre/Post Harvest)
--              with full cycle attribution (pond_index) and checklist payload.

BEGIN;

CREATE TABLE IF NOT EXISTS public.qaqc_inspections (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pond_index text NOT NULL,
    pond text NOT NULL,
    inspection_type text NOT NULL, -- 'POND_CLEANING', 'STOCKING_READINESS', 'STOCKING_EVENT', etc.
    inspection_date date NOT NULL,
    inspector_staff_no text,
    inspector_name text NOT NULL,
    requestor_name text,
    team text NOT NULL,
    status text NOT NULL, -- 'PASSED', 'FAILED'
    remarks text,
    checklist_data jsonb DEFAULT '{}'::jsonb, -- e.g. { "lining": true, "sump": true, "pwa_autofeeder": true, "jetty": true }
    whatsapp_text text,
    created_at timestamptz DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_qaqc_pond_index_date 
ON public.qaqc_inspections (pond_index, inspection_date DESC);

CREATE INDEX IF NOT EXISTS idx_qaqc_type_date 
ON public.qaqc_inspections (inspection_type, inspection_date DESC);

-- Backward compatibility in case table was created earlier
ALTER TABLE public.qaqc_inspections ADD COLUMN IF NOT EXISTS requestor_name text;

COMMIT;
