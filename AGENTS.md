# iSHARP Platform — Mandatory Supabase Security & Weekly Sync Rules

Every agent or script working on the **iSHARP Water Quality & Pond Operations Management System** (`database_migration/` and `isharp-platform/`) MUST strictly follow these database security and synchronization invariants:

## 1. Supabase Row-Level Security (RLS) & Passcode Authentication
- **Write Authorization (`13_security_hardening_rls_and_rpc.sql` & `15_sync_hardening.sql`):**
  - All write operations (`INSERT`, `UPDATE`, `DELETE`) on DBMS and Field Ops tables require the HTTP header `x-isharp-passcode` (`mantaray` for `EDITOR`, verified via `POST /rest/v1/rpc/fn_verify_dbms_passcode`).
  - `public.app_passwords` and `public.module_passwords` have `REVOKE ALL FROM anon, authenticated`; never query them directly via PostgREST.
  - `public.growout_pond_finance` requires `x-isharp-passcode` (`VIEWER`, `SUPERVISOR`, or `EDITOR`) even for `SELECT`.
- **Avoiding the 3-Second `anon` Statement Timeout (`57014`):**
  - When performing pure `INSERT`s via PostgREST where no `on_conflict` column is used, ALWAYS send `"Prefer" = "return=minimal"` instead of `"Prefer" = "resolution=merge-duplicates"`. Sending `merge-duplicates` causes PostgREST to generate `INSERT ... ON CONFLICT (id) DO UPDATE`, forcing PostgreSQL to evaluate both `INSERT` and `UPDATE` RLS policies and doubling `pgcrypto` bcrypt overhead.
  - Note that `public.pond_stocking_batches` has a trigger `fn_trig_batch_stocking_to_production()` that touches `growout_pond_master` and `active_operational_ponds`. In non-RPC fallback mode, keep batch sizes small (`chunkSize = 2..4` for `pond_stocking_batches` and `growout_pond_finance`, `5..8` for other tables).

## 2. Zero-Duplication Natural-Key Architecture (Zero `index_no`)
- Legacy Microsoft Access `index_no` auto-number columns were dropped in Migration 09. Never include `index_no` in `SELECT` or `INSERT` payloads to Supabase.
- Deduplicate all Access records in memory using their canonical natural key before comparing counts or uploading:
  - `pond_stocking_batches`: `pond_index | stck_date | upper(trim(stck_tank)) | round(stck_pcs, 2)`
  - `pond_harvest_daily`: `pond_index | harv_date | upper(trim(harv_status)) | round(harv_weight, 2) | round(harv_abw, 2)`
  - `pond_harvest_sales`: `pond_index | hvt_date | upper(trim(hvt_buyer)) | round(good_wgt, 2) | round(raw_wgt, 2) | round(net_sales, 2)`
  - `pond_issues`: `pond_index | issue_date | upper(trim(issue_category)) | upper(trim(issue_status)) | upper(trim(issue_test)) | upper(trim(issue_flag)) | upper(trim(issue_grade)) | md5(upper(trim(issue_note)))`
  - `biometrics_sampling`: `pond_index | smpl_date`
  - `pond_notes`: `pond_index | md5(trim(note))`

## 3. Non-Destructive Weekly Sync Rules (`database_migration/sync_weekly_access.ps1`)
- **Never `DELETE` Before `POST` When `SupaCount == 0`:** In fallback mode, `Sync-CycleTable` must NEVER call `Purge-PondIndexRecords` on cycles that currently have `0` rows in Supabase. Missing cycles must be restored via pure `INSERT` (`POST`).
- **Unified Cycle Target Window (`$reconcileMasterPondSet`):** Stages 3–7 (`pond_stocking_batches`, `pond_harvest_daily`, `pond_harvest_sales`, `pond_issues`, `biometrics_sampling`) must always include all cycles from `$reconcileMasterPondSet` (all `ACTIVE` cycles + all cycles closed within `-$reconcileDays`), even if a closed cycle's `stckdate` is older than `-$reconcileDays`.
- **PowerShell 5.1 `Invoke-RestMethod` Array Unrolling:** Always wrap `Invoke-RestMethod` inside a helper function (`Get-FromSupabase`) so `@(Get-FromSupabase $uri)` unrolls JSON arrays into individual elements rather than a 1-element `Object[]` wrapper.

## 4. Netlify Production Deployment Safety & Credit Protection
- **Zero Automatic Deploys:** Never automatically deploy to Netlify on `git commit`, `git push`, or test runs. GitHub commits and pulls MUST NOT trigger automatic production deploys.
- **Strict User Authorization Required:** Production deployment (`npm run deploy:prod` or `node scripts/deploy_netlify.mjs`) may ONLY be executed when the user explicitly and directly requests a production deployment to Netlify (e.g., "deploy to netlify" or "deploy to production").
- **Local Verification First:** Always verify that tests pass (`npm test`) and the build succeeds (`npm run build`) before any requested deployment.
