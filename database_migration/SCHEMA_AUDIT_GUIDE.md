# iSHARP Platform — Data Entry Schema Audit & Verification Guide

**Date:** 12 October 2026  
**Auditor / Engine:** iSHARP Automated Probe Suite  
**Scope:** Field Operations Mobile Portal & Central DBMS 2.0  
**Target Cluster:** Supabase Cloud PostgreSQL (`keappoukeagyzpoxkrru.supabase.co`)

---

## 1. Overview & Purpose

Following Phase 4 database normalization, 16 spreadsheet date and equipment columns were dropped from `public.growout_pond_master`, and dedicated relational tables were introduced:
* `public.pond_event_date` (Single Source of Truth for lifecycle milestone dates)
* `public.pond_initiatives` (One-to-many experimental farm trials)
* `public.pond_aerator_inventory` (Paddlewheels & aeration units)

This audit suite systematically tests **every data entry button and form** across the entire platform to guarantee:
1. No application form attempts to write to dropped columns.
2. All relational joins and child table inserts succeed.
3. Every test modification is safely reverted to its exact pre-test state with zero orphan data.

---

## 2. Running the Audit Suite

To execute the live verification audit at any time, run:

```bash
cd isharp-platform
npm run test:audit
```

Or run directly with Node:

```bash
node scripts/audit_data_entry_schema.mjs
```

### What the Probe Executes Automatically:
1. **Dynamic Context Discovery**: Queries Supabase for an available `IDLE` pond (e.g. `01.01.06` / `2010106.40`) so active culture data is never touched.
2. **Pre-Test In-Memory Snapshot**: Snapshots rows across `growout_pond_master`, `pond_inventories`, `pond_aerator_inventory`, `pond_event_date`, and `pond_stocking_batches`.
3. **Executes 18 Data Entry Probes**: Tests all buttons and inputs.
4. **Immediate Verification**: Performs REST queries with representation checks.
5. **Guaranteed Teardown (`finally`)**:
   * Deletes all created test records in `daily_pond_records`, `mineral_probiotic_used`, `biometrics_sampling`, `pond_issues`, and `pond_harvest_daily`.
   * Restores snapshot values on `growout_pond_master`, `pond_inventories`, `pond_aerator_inventory`, `pond_event_date`, and `pond_stocking_batches`.

---

## 3. Audited Entry Points & Test Matrix

| # | Subsystem | Form / Modal | Trigger Button | Target Database Table(s) | Verified Status |
| :-: | :--- | :--- | :--- | :--- | :---: |
| 1 | **Field Ops** | Management Entry | `#btn-mgmt-save` (Personnel) | `public.growout_pond_master` | **PASS** |
| 2 | **Field Ops** | Management Entry | `#btn-mgmt-save` (Aerators) | `public.pond_aerator_inventory` | **PASS** |
| 3 | **Field Ops** | Management Entry | `#btn-mgmt-save` (Hardware) | `public.pond_inventories` | **PASS** |
| 4 | **Field Ops** | Daily Records Modal | `#btn-save-record` (Journal) | `public.daily_pond_records` | **PASS** |
| 5 | **Field Ops** | Daily Records Modal | `#btn-save-record` (Treatments) | `public.mineral_probiotic_used` | **PASS** |
| 6 | **DBMS** | Master Tab (Tab 1) | `#btn-save-master` (Dates) | `public.pond_event_date` | **PASS** |
| 7 | **DBMS** | Master Tab (Tab 1) | `#btn-save-master` (Metadata) | `public.growout_pond_master` | **PASS** |
| 8 | **DBMS** | Master Tab (Tab 1) | `#btn-save-aerators` | `public.pond_aerator_inventory` | **PASS** |
| 9 | **DBMS** | Staff Tab (Tab 9) | `#btn-save-staff` | `public.growout_pond_master` | **PASS** |
| 10 | **DBMS** | Staff Tab (Tab 9) | `#btn-save-initiatives` | `public.pond_initiatives` | **PASS** |
| 11 | **DBMS** | Stocking Tab (Tab 3) | `#btn-save-stocking` | `public.pond_stocking_batches` | **PASS** |
| 12 | **DBMS** | Excel Modal | `#btn-commit-excel` (Sampling) | `public.biometrics_sampling` | **PASS** |
| 13 | **DBMS** | Excel Modal | `#btn-commit-excel` (Feed) | `public.daily_pond_records` | **PASS** |
| 14 | **DBMS** | Excel Modal | `#btn-commit-excel` (Issues) | `public.pond_issues` | **PASS** |
| 15 | **DBMS** | Excel Modal | `#btn-commit-excel` (Harvest) | `public.pond_harvest_daily` | **PASS** |
| 16 | **DBMS** | Lifecycle Tab (Tab 8) | `#btn-submit-create-cycle` | `growout_pond_master` + `pond_event_date` | **PASS** |
| 17 | **DBMS** | Lifecycle Tab (Tab 8) | `#btn-confirm-terminate` | `growout_pond_master` + `pond_event_date` | **PASS** |
| 18 | **DBMS** | Lifecycle Tab (Tab 8) | `#btn-confirm-revive-keep` | `growout_pond_master` + `active_operational_ponds` | **PASS** |

---

## 4. Key Code Fixes Applied

1. **`inventoryRepository.js`**:
   * Removed obsolete PATCH to `growout_pond_master` for `aerator_1hp` and `aerator_2hp`.
   * Paddlewheels now route exclusively to `pond_aerator_inventory` with `on_conflict=pond_index,aerator_model,hp`.

2. **`excelModal.js`**:
   * Removed obsolete `shift` field from batch insert payload to `daily_pond_records`.
   * Shift text is now cleanly prepended to `remarks` (e.g. `[Shift: Morning] Normal feeding`).

3. **`pondRepository.js`**:
   * Implemented client-side Phase 4 fallback logic for `createCustomCycle`, `terminateCycle`, `reviveCycle`, and `deleteIdleCycle`, ensuring the frontend seamlessly updates `growout_pond_master` and `pond_event_date` without depending on outdated stored procedures.

---

## 5. Applying the Database Migration

To update the stored procedures in PostgreSQL permanently:
1. Open the [Supabase Dashboard SQL Editor](https://supabase.com/dashboard/project/keappoukeagyzpoxkrru/sql).
2. Copy and execute the contents of:
   `database_migration/07_phase4_lifecycle_functions_alignment.sql`
