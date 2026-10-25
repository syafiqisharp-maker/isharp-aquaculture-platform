-- ============================================================================
-- Migration: 11_migrate_feed_legacy_pk.sql
-- Description: Upgrade growout_pond_feed_legacy to Zero index_no Architecture.
-- 1. Drops legacy PK constraint on index_no
-- 2. Adds native PostgreSQL identity primary key 'id'
-- 3. Sets index_no to NULL-allowed (backward compatibility)
-- 4. Adds unique constraint on (pond_index, feed_date, feed_type, quantity_kg)
--    for idempotent conflict resolution
-- ============================================================================

BEGIN;

-- 1. Drop existing primary key constraint on index_no
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_schema = 'public' 
          AND table_name = 'growout_pond_feed_legacy' 
          AND constraint_type = 'PRIMARY KEY'
    ) THEN
        ALTER TABLE public.growout_pond_feed_legacy DROP CONSTRAINT growout_pond_feed_legacy_pkey;
    END IF;
END $$;

-- 2. Add native identity primary key column 'id' if not already present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'growout_pond_feed_legacy' 
          AND column_name = 'id'
    ) THEN
        ALTER TABLE public.growout_pond_feed_legacy ADD COLUMN id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY;
    END IF;
END $$;

-- 3. Make index_no nullable so inserts without index_no succeed
ALTER TABLE public.growout_pond_feed_legacy ALTER COLUMN index_no DROP NOT NULL;

-- 4. Add unique constraint for deterministic, idempotent upserts
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_growout_pond_feed_legacy'
    ) THEN
        ALTER TABLE public.growout_pond_feed_legacy 
        ADD CONSTRAINT uq_growout_pond_feed_legacy 
        UNIQUE (pond_index, feed_date, feed_type, quantity_kg);
    END IF;
END $$;

-- 5. Analytical index for timeline queries
CREATE INDEX IF NOT EXISTS idx_feed_legacy_pond_date 
ON public.growout_pond_feed_legacy (pond_index, feed_date DESC);

COMMIT;
