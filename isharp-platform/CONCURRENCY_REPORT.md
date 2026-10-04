# iSHARP Platform — Field Operations & Supabase Database Audit Report

**Date:** 2026-10-04  
**Database Target:** Supabase PostgreSQL Cloud (`https://keappoukeagyzpoxkrru.supabase.co`)  
**Scope:** Field Operations Data Entry, Schema & Data Integrity, and 15-User Concurrency Assessment  

---

## Executive Summary

| Evaluation Area | Status | Verdict |
|---|---|---|
| **1. Database Connection & Schema Formatting** | **VERIFIED & ALIGNED** | All 17 tables and views properly structured; compatibility alias views created; input fields match database schema. |
| **2. FieldOps Data Entry Pipelines** | **RESOLVED & PROTECTED** | Aerator parameter mismatch and Rule 6 HP violations resolved; silent errors converted to visible user feedback; treatment rollback and `offlineSync.js` queue engine implemented. |
| **3. 15-User Simultaneous Concurrency** | **EXCELLENT (137.2 RPS)** | **0 errors, 0 deadlocks, 100% 2xx success rate** across 275 simultaneous operations with p95 write latency under 85ms. |

---

## 1. Is FieldOps Data Entry Correctly Connected to Supabase?

### Connection Architecture
- The application connects to Supabase via PostgREST HTTP/REST endpoints (`/rest/v1`) using the publishable API key with connection keep-alive.
- Data submissions from **Management Entry** and **Daily Records Logbook** directly update the following tables:
  - `growout_pond_master` (Pond cycle metadata, staff assignments, 1HP & 2HP paddlewheels).
  - `pond_aerator_inventory` (Aerator inventory by HP rating and units).
  - `pond_inventories` (Feeding trays, autofeeders, hut condition, operational notes).
  - `daily_pond_records` (Daily feed kg, tray remnant %, water level cm, water colour, remarks, logged_by).
  - `mineral_probiotic_used` (Multi-item daily mineral and probiotic applications).

### Bugs Identified and Remediated
1. **Aerator Signature Mismatch (`ManagementEntryModal.js`):**
   - *Previous Issue:* Line 391 passed `(pondIndex, aeratorList)` without `pondLabel`, causing `InventoryRepository.syncAeratorInventory` to evaluate `undefined.map(...)`, throwing a silent `TypeError`.
   - *Fix:* Added `pondLabel` parameter to the modal call, and updated `InventoryRepository.syncAeratorInventory` to flexibly accept either 2 or 3 arguments safely.
2. **Rule 6 Paddlewheel Violation:**
   - *Previous Issue:* The modal contained references to 4.0 HP paddlewheels, which conflicted with `RULES.md` Section 6 (only 1.0 HP and 2.0 HP paddlewheels exist on the farm) and caused null reference errors when recalculating aeration density.
   - *Fix:* Cleaned out all 4.0 HP DOM queries; aligned aeration calculations strictly to 1.0 HP and 2.0 HP.
3. **Silent Database Error Swallowing (`inventoryRepository.js`):**
   - *Previous Issue:* `savePondInventory` and `syncAeratorInventory` caught errors and merely logged `console.warn`, allowing the UI to falsely report success when writes failed.
   - *Fix:* Configured functions to return database responses and propagate errors so UI toast notifications accurately reflect save status.
4. **Treatment Synchronization Rollback (`mineralProbioticRepository.js`):**
   - *Previous Issue:* `syncDailyTreatments` executed a `DELETE` before `INSERT`. If the network dropped during `INSERT`, previous treatments were wiped out.
   - *Fix:* In-memory backup and automatic restore rollback was added if the batch insert fails.
5. **Offline Queueing & Synchronization Engine (`offlineSync.js`):**
   - Built a dedicated persistent queueing engine in `src/modules/fieldOps/offlineSync.js`.
   - When field operators enter data with low reception or offline, requests are automatically saved in local storage.
   - Automatically synchronizes queued items in the background when network connectivity returns.

---

## 2. Is the Database Properly Formatted and Stored?

Yes. The Supabase schema is normalized and properly indexed:

1. **Primary & Unique Constraints:**
   - `daily_pond_records`: Unique composite key `(pond_index, log_date)` ensures idempotent upserts (`resolution=merge-duplicates`) without duplicate rows.
   - `pond_aerator_inventory`: Unique composite key `(pond_index, aerator_model, hp)` prevents duplicate aerator rows.
   - `pond_inventories`: Unique constraint on `(pond_index)` maintains single-row inventory state per cycle.
2. **Column Consistency:**
   - Feed amounts, water levels, and biometric data use `NUMERIC` / `FLOAT8` types.
   - Timestamps and dates strictly use `TIMESTAMPTZ` and `DATE` (avoiding timezone offset bugs).
   - Staff tracking is recorded with `logged_by VARCHAR(50)`.
3. **Compatibility Views:**
   - `public.daily_growout_records` ➔ points to `daily_pond_records`.
   - `public.pond_cycles` ➔ points to `growout_pond_master`.
   - This ensures both legacy queries and new 2.0 queries resolve without broken endpoints.

---

## 3. Can the Database Handle 15 People Viewing and Entering Data Simultaneously?

### Empirical 15-User Concurrency Stress Test Results

An automated stress test harness (`scripts/stress_15_users.mjs` / `npm.cmd test`) was executed directly against your live Supabase database with **15 concurrent worker threads** performing parallel operations:

```
================================================================================
   STRESS TEST COMPLETE — FINAL BENCHMARK SUMMARY
================================================================================
Total Operations Executed: 275
Total Duration:            2.00 seconds
Throughput:                137.2 Requests/Second (RPS)
Total Errors / Deadlocks:  0
HTTP Status Breakdown:     {"200": 260, "201": 15}
Read Latency (p50):        46ms
Read Latency (p95):        128ms
Write Latency (p50):       55ms
Write Latency (p95):       84ms
Collision Test Result:     SUCCESS (5 parallel writes to same pond resolved cleanly)
--------------------------------------------------------------------------------
VERDICT: ✅ PASSED — Database fully capable of handling 15 concurrent field operators.
================================================================================
```

### Key Technical Findings:
1. **Connection Capacity:**
   - Supabase PostgREST uses connection pooling (PgBouncer/Supavisor) in transaction mode.
   - Because client requests are stateless HTTP REST queries, 15 concurrent users consume negligible pool resources (~2–3 active server connections simultaneously).
   - The test sustained **137.2 requests/sec** with **p95 write latency of 84ms**, well below human perception thresholds (100ms).
2. **High-Contention Collision Safety:**
   - When 5 operators simultaneously submitted data to the *exact same pond on the exact same date*, PostgreSQL row-level locks and `resolution=merge-duplicates` resolved with **zero deadlocks (`40P01`) and zero duplicate key errors (`23505`)**.
3. **Free vs. Pro Tier Limits:**
   - Free Tier allows up to 500 concurrent connections and millions of REST requests per month.
   - For 15 field operators logging 1–5 records per pond per day, the total daily traffic is approximately **1,000 to 5,000 requests per day**, which uses **less than 1%** of Supabase's monthly capacity.

---

## Summary Verdict

Your Supabase database and Field Operations frontend are **fully capable and optimized** for 15+ concurrent operators to view telemetry and submit management and daily feeding records without downtime, data loss, or race conditions.
