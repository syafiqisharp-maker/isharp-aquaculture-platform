-- ============================================================================
-- Migration: 06_update_viewer_password.sql
-- Description: Update universal platform viewer password from 'monodon' to 'isharp'
-- ============================================================================

UPDATE public.app_passwords
SET password = 'isharp',
    updated_at = NOW()
WHERE key = 'dbms_viewer';
