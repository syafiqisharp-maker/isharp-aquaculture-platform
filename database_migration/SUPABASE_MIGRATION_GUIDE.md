# Supabase Database Migration & Integration Guide
**Project:** Aquaculture Water Quality Station (WQS) & Environmental Telemetry  
**Supabase Project URL:** `https://keappoukeagyzpoxkrru.supabase.co`  
**Last Updated:** 25 October 2026  
**Status:** Live Database Deployed, Seeded, and Hardened with RLS & Server-Side RPC Authentication  

---

## 1. System Architecture: The Active Gatekeeper Pattern

The farm operates ~200 ponds, with approximately 120–135 ponds culturing shrimp simultaneously.

```
                       ┌───────────────────────────────┐
                       │  IoT SENSOR DEVICE (e.g. WQS) │
                       └──────────────┬────────────────┘
                                      │ Sends: "Pond 01.02.12"
                                      ▼
               ┌──────────────────────────────────────────────┐
               │    GATE: active_operational_ponds            │
               │    (Pond: 01.02.12  ──►  PondIndex: 2010212.43)
               └──────────────────────┬───────────────────────┘
                                      │
                   ┌──────────────────┴──────────────────┐
                   ▼                                     ▼
           Pond NOT in Gate?                       Pond Found!
         ┌───────────────────┐               ┌────────────────────────┐
         │ 🛑 IGNORE / DROP  │               │ 💾 RECORD TO FACT TABLE│
         │ Pond is harvested,│               │ using PondIndex        │
         │ do not record junk│               │ (water_quality_logs)   │
         └───────────────────┘               └───────────┬────────────┘
                                                         │
                                                         ▼
       ┌────────────────────────────────────────────────────────────────────────┐
       │                 MASTER DIMENSION: stocking_records                     │
       │                   (Primary Key: pond_index)                            │
       │  Permanent history of all cycles (never deleted, even after harvest!)  │
       └──────────────┬──────────────────────────────────────────┬──────────────┘
                      ▲                                          ▲
                      │ Foreign Key                              │ Foreign Key
                      │                                          │
       ┌──────────────┴──────────────┐            ┌──────────────┴──────────────┐
       │   FACT: biometrics_sampling │            │   FACT: feed_barrel_logs    │
       │   (ABW, SR, Biomass, FCR)   │            │   (Sonar, Feed Rate)        │
       └─────────────────────────────┘            └─────────────────────────────┘
```

### Architectural Principles:
1. **`active_operational_ponds` is the Gatekeeper**:
   - Contains only currently active cycles (~133 ponds).
   - When a pond is harvested, simply **delete** its row from this table.
   - Deleting from the gate **does not** delete historical sensor data because foreign keys reference `stocking_records`.
2. **`stocking_records` is the Permanent Master**:
   - Every culture cycle (past and present) is kept here permanently under its unique `pond_index` (e.g. `2010212.43`).
3. **Devices Send Physical Pond Label**:
   - Sensor firmware sends physical `Pond` (e.g. `01.02.12`).
   - Hardware does not need re-flashing when a new cycle starts.
   - PostgreSQL RPC function `log_water_quality` resolves `pond` $\rightarrow$ `pond_index` on arrival.

---

## 2. Live Database Status & Data Sources

| Supabase Table | Role | Live Row Count | Source / Seed Artifact |
| :--- | :--- | :--- | :--- |
| **`stocking_records`** | Master Dimension | **373** | [seed_data.sql](file:///c:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/seed_data.sql) / [Stocking Sheet](https://docs.google.com/spreadsheets/d/1oXKgF2b4hBm1KIOwC5cD1aOiQMDQsW2SGvI0p-i3rII/edit?usp=sharing) |
| **`active_operational_ponds`** | Gatekeeper (Active Ponds) | **133** | [seed_data.sql](file:///c:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/seed_data.sql) / [Gatekeeper Sheet](https://docs.google.com/spreadsheets/d/16Yx8ugQUCP89D2zonWRPrdCFNORXVkz9K4tFqPiAMLo/edit?usp=sharing) |
| **`biometrics_sampling`** | Fact (Biometrics) | **2,431** | [seed_sampling.sql](file:///c:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/seed_sampling.sql) / [Sampling Sheet](https://docs.google.com/spreadsheets/d/1E_4tOu_24I0dHHYHdX-Q6ST9DN4bceId1IkwYWQ0Les/edit?usp=sharing) |
| **`water_quality_logs`** | Fact (WQS Telemetry) | **1** (Verified) | Field WQS Stations / ESP32 Receiver Gateway |
| **`weather_logs`** | Fact (Weather Node) | **378+** (Streaming) | Weather Station v10 via Active GAS Bridge |
| **`feed_barrel_logs`** | Fact (Autofeeder Sonar) | **0** (Ready) | [Feed Barrel Sheet](https://docs.google.com/spreadsheets/d/19lHzaW6WengVOE1N-zNk-trIGwLduU7rDfaZGGLwSuM/edit?usp=sharing) |
| **`pond_aerator_inventory`** | Fact/Dim (Multi-Model Aerator) | **0** (Deployed) | Portal 1 Field Inventory Form / PWA Master |
| **`pond_inventories`** | Dim (Assets & Trays) | **0** (Deployed) | Portal 1 Field Inventory Form |
| **`daily_pond_records`** | Fact (Daily Field Logbook) | **0** (Deployed) | Portal 1 Daily Pond Record Journal |
| **`growout_pond_feed_sap`** | Fact (Authoritative SAP Feed Ledger) | **89,244** (Live) | [GrowoutPondFeedSAP] / `migrate_growout_pond_feed_sap.ps1` |
| **`pond_harvest_plan`** | Dim/Fact (Harvest Planning Targets) | **9,313** (Live) | [GrowoutPondHarvestPlan] / `migrate_growout_pond_harvest_plan.ps1` |
| **`view_pond_aeration_summary`** | Computed View (Total HP) | **Live** | Automated aggregated HP view |

---

## 3. Today's Milestone: Weather Station GAS Cloud Bridge

On **23 September 2026**, the Google Apps Script for the Weather Station (`GoogleAppsScript.gs`) was successfully upgraded to act as an active cloud bridge between physical hardware and Supabase.

### Pipeline:
```
┌────────────────────────────┐
│ Weather Station ESP32 (v10)│
└─────────────┬──────────────┘
              │ HTTPS POST (Batch JSON)
              ▼
┌────────────────────────────────────────────────────────┐
│ Google Apps Script (doPost)                            │
│ 1. Appends to Google Sheet ("Live")                    │
│ 2. Calls forwardToSupabase(records, timeZone)          │
└─────────────────────────────┬──────────────────────────┘
                              │ HTTPS REST POST
                              ▼
┌────────────────────────────────────────────────────────┐
│ Supabase: https://keappoukeagyzpoxkrru.supabase.co     │
│ Endpoint: /rest/v1/weather_logs                        │
│ Headers:  apikey, Prefer: resolution=ignore-duplicates │
│ Table:    public.weather_logs (89+ records received)   │
└────────────────────────────────────────────────────────┘
```

### Key Technical Details of the Bridge:
* **Zero Downtime:** Live farm monitoring on Google Sheets continues uninterrupted while Supabase receives parallel data.
* **Timestamp Formatting:** Automatically formats ESP32 timestamps to ISO 8601 with GMT+8 offset (`YYYY-MM-DDTHH:mm:ss+08:00`).
* **Field Mapping:** Translates device keys (`temp`, `pressure`, `humidity`, `rainfall`, `lux`) directly to database columns (`air_temp_c`, `air_pressure_hpa`, `humidity_pct`, `rainfall_mm`, `lux`).
* **Deduplication:** Uses Supabase's `Prefer: resolution=ignore-duplicates` with `UNIQUE(recorded_at)` to eliminate duplicate records during network retransmissions.

---

## 4. Live PostgreSQL / Supabase Schema (DDL)

```sql
-- 1. MASTER DIMENSION: STOCKING RECORDS
CREATE TABLE IF NOT EXISTS stocking_records (
    pond_index VARCHAR(50) PRIMARY KEY,
    stck_date DATE NOT NULL,
    stck_source VARCHAR(50),
    stck_species VARCHAR(50),
    stck_pcs NUMERIC(12, 2),
    stck_type VARCHAR(50),
    stck_allow NUMERIC(12, 2),
    stck_total NUMERIC(12, 2),
    stck_tank VARCHAR(50),
    stck_size NUMERIC(6, 2),
    stck_plstts VARCHAR(50),
    stck_ems VARCHAR(20),
    stck_wssv VARCHAR(20),
    stck_ehp VARCHAR(20),
    stck_remks TEXT,
    stck_status VARCHAR(50) DEFAULT 'NEW STOCK',
    lockline VARCHAR(20),
    tank_nursery VARCHAR(50),
    bs_line VARCHAR(50),
    index_no INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. GATEKEEPER: ACTIVE OPERATIONAL PONDS
CREATE TABLE IF NOT EXISTS active_operational_ponds (
    pond VARCHAR(20) PRIMARY KEY,
    pond_index VARCHAR(50) NOT NULL REFERENCES stocking_records(pond_index) ON DELETE RESTRICT,
    activated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. FACT: BIOMETRICS SAMPLING
CREATE TABLE IF NOT EXISTS biometrics_sampling (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pond_index VARCHAR(50) NOT NULL REFERENCES stocking_records(pond_index) ON DELETE CASCADE,
    smpl_date DATE NOT NULL,
    smpl_doc INT,
    smpl_abw NUMERIC(6, 2),
    smpl_surv NUMERIC(6, 2),
    smpl_dfed NUMERIC(10, 2),
    smpl_tfed NUMERIC(12, 2),
    p_smpl_date DATE,
    p_smpl_doc INT,
    p_smpl_abw NUMERIC(6, 2),
    p_smpl_surv NUMERIC(6, 2),
    p_smpl_dfed NUMERIC(10, 2),
    p_smpl_tfed NUMERIC(12, 2),
    sttg_abw NUMERIC(6, 2),
    sttg_surv NUMERIC(6, 2),
    sttg_bms NUMERIC(12, 2),
    sttg_dfed NUMERIC(10, 2),
    sttg_tfed NUMERIC(12, 2),
    smpl_bms NUMERIC(12, 2),
    index_no INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sampling_pond_index ON biometrics_sampling(pond_index, smpl_date DESC);

-- 4. FACT: WATER QUALITY TELEMETRY
CREATE TABLE IF NOT EXISTS water_quality_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pond_index VARCHAR(50) NOT NULL REFERENCES stocking_records(pond_index) ON DELETE CASCADE,
    recorded_at TIMESTAMPTZ NOT NULL,
    do_ppm NUMERIC(5, 2),
    ph NUMERIC(4, 2),
    water_temp_c NUMERIC(5, 2),
    turbidity_ntu NUMERIC(6, 2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wqs_pond_index_time ON water_quality_logs(pond_index, recorded_at DESC);

-- 5. FACT: AUTOFEEDER TELEMETRY
CREATE TABLE IF NOT EXISTS feed_barrel_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pond_index VARCHAR(50) NOT NULL REFERENCES stocking_records(pond_index) ON DELETE CASCADE,
    recorded_at TIMESTAMPTZ NOT NULL,
    distance_cm NUMERIC(6, 2),
    battery_v NUMERIC(4, 2),
    weight_kg NUMERIC(6, 2),
    consumed_kg NUMERIC(6, 2),
    feed_rate NUMERIC(6, 2),
    event_type VARCHAR(20) DEFAULT 'IDLE',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_feed_pond_index_time ON feed_barrel_logs(pond_index, recorded_at DESC);

-- 6. FACT: WEATHER TELEMETRY
CREATE TABLE IF NOT EXISTS weather_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    recorded_at TIMESTAMPTZ NOT NULL UNIQUE,
    rainfall_mm NUMERIC(6, 2) DEFAULT 0,
    lux NUMERIC(10, 2),
    air_temp_c NUMERIC(5, 2),
    air_pressure_hpa NUMERIC(6, 1),
    humidity_pct NUMERIC(5, 2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_weather_time ON weather_logs(recorded_at DESC);

-- 7. FACT: GROWOUT POND FEED SAP (ERP LEDGER)
CREATE TABLE IF NOT EXISTS growout_pond_feed_sap (
    sync_key VARCHAR(100) PRIMARY KEY,
    order_no VARCHAR(50),
    sap_post_date DATE,
    sap_pond_idx VARCHAR(50) NOT NULL,
    sap_feed_idx VARCHAR(50),
    sap_feed_name VARCHAR(100),
    sap_movement VARCHAR(10),
    sap_feed_kgs NUMERIC(12, 2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_feed_sap_pond_date ON growout_pond_feed_sap(sap_pond_idx, sap_post_date ASC);

-- 8. FACT/DIM: POND HARVEST PLAN (PLANNING TARGETS)
CREATE TABLE IF NOT EXISTS pond_harvest_plan (
    sync_key VARCHAR(100) PRIMARY KEY,
    pond_index VARCHAR(50) NOT NULL,
    harv_plan_date DATE,
    harv_plan_stts VARCHAR(50),
    harv_plan_wgt NUMERIC(12, 2),
    harv_plan_abw NUMERIC(8, 2),
    harv_plan_time TIME,
    harv_plan_delv_time TIME,
    harv_plan_team VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_harvest_plan_pond_date ON pond_harvest_plan(pond_index, harv_plan_date DESC);

-- 9. ROW LEVEL SECURITY (RLS) POLICIES (Hardened in Migration 13)
-- Production DDL: database_migration/13_security_hardening_rls_and_rpc.sql
-- RLS Strategy: Fast Public SELECT for operational dashboards; strictly authenticated writes.
-- Mutations (INSERT, UPDATE, DELETE) require a valid 'x-isharp-passcode' HTTP header.
-- Passwords are authenticated server-side against pgcrypto bcrypt hashes via SECURITY DEFINER functions.

-- Helper functions deployed:
--   fn_verify_dbms_passcode(TEXT) -> BOOLEAN
--   fn_verify_field_ops_passcode(INT, TEXT) -> BOOLEAN
--   fn_get_request_role(TEXT) -> 'admin' | 'dbms' | 'field_ops' | 'anonymous'
--   fn_can_write_dbms() -> BOOLEAN
--   fn_can_write_field_ops() -> BOOLEAN

-- Tables with Public SELECT and Authenticated Writes (DBMS & Field-Ops):
--   stocking_records, active_operational_ponds, growout_pond_master, biometrics_sampling,
--   water_quality_logs, feed_barrel_logs, weather_logs, growout_pond_feed_sap,
--   pond_harvest_plan, pond_stocking_batches, pond_harvest_daily, pond_harvest_sales,
--   daily_pond_records, mineral_probiotic_used, pond_issues, lab_water_quality,
--   qaqc_inspections, pond_inventories, pond_aerator_inventory, pond_event_date, etc.

-- Restricted Sensitive Tables:
--   app_passwords: SELECT revoked from anon/authenticated; managed strictly via pgcrypto RPCs.
--   module_passwords: SELECT revoked from anon/authenticated; managed strictly via pgcrypto RPCs.
--   growout_pond_finance: SELECT & WRITE strictly restricted to authenticated DBMS passcodes.

-- 8. WQS GATEKEEPER INGESTION FUNCTION (RPC)
CREATE OR REPLACE FUNCTION log_water_quality(
    p_pond VARCHAR,
    p_do NUMERIC,
    p_ph NUMERIC,
    p_temp NUMERIC,
    p_turbidity NUMERIC
) RETURNS JSONB AS $$
DECLARE
    v_pond_index VARCHAR;
BEGIN
    SELECT pond_index INTO v_pond_index 
    FROM active_operational_ponds 
    WHERE pond = p_pond;
    
    IF v_pond_index IS NOT NULL THEN
        INSERT INTO water_quality_logs (
            pond_index, 
            recorded_at, 
            do_ppm, 
            ph, 
            water_temp_c, 
            turbidity_ntu
        )
        VALUES (
            v_pond_index, 
            NOW(), 
            p_do, 
            p_ph, 
            p_temp, 
            p_turbidity
        );
        RETURN jsonb_build_object('status', 'success', 'pond_index', v_pond_index);
    ELSE
        RETURN jsonb_build_object('status', 'ignored', 'reason', 'Pond not active');
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. WEATHER STATION BATCH INGESTION (RPC)
CREATE OR REPLACE FUNCTION log_weather_telemetry(records JSONB)
RETURNS JSONB AS $$
DECLARE
    rec RECORD;
    inserted_count INT := 0;
BEGIN
    FOR rec IN SELECT * FROM jsonb_to_recordset(records) AS x(
        "timestamp" TEXT,
        temp NUMERIC,
        lux NUMERIC,
        rainfall NUMERIC,
        humidity NUMERIC,
        pressure NUMERIC
    )
    LOOP
        INSERT INTO weather_logs (
            recorded_at,
            air_temp_c,
            lux,
            rainfall_mm,
            humidity_pct,
            air_pressure_hpa
        )
        VALUES (
            (rec."timestamp" || '+08')::TIMESTAMPTZ,
            rec.temp,
            rec.lux,
            rec.rainfall,
            rec.humidity,
            rec.pressure
        )
        ON CONFLICT (recorded_at) DO NOTHING;
        
        inserted_count := inserted_count + 1;
    END LOOP;

    RETURN jsonb_build_object('status', 'success', 'processed', inserted_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. ANALYTICAL VIEW: HOURLY WEATHER SUMMARY
CREATE OR REPLACE VIEW weather_hourly_summary AS
SELECT 
    date_trunc('hour', recorded_at) AS hour_bucket,
    ROUND(AVG(air_temp_c), 2) AS avg_temp_c,
    ROUND(AVG(humidity_pct), 2) AS avg_humidity_pct,
    ROUND(AVG(air_pressure_hpa), 1) AS avg_pressure_hpa,
    ROUND(AVG(lux), 0) AS avg_lux,
    ROUND(MAX(rainfall_mm) - MIN(rainfall_mm), 2) AS hourly_rainfall_mm
FROM weather_logs
GROUP BY date_trunc('hour', recorded_at)
ORDER BY hour_bucket DESC;
```

---

## 5. Next Steps: Hardware Migration Roadmap

### Step A: Water Quality Station (WQS) Receiver Migration
* **Target File:** `LoRa/LoRa_Receiver/NetworkManager.cpp` & `Config.h`
* **Configuration:**
  ```cpp
  #define SUPABASE_URL "https://keappoukeagyzpoxkrru.supabase.co/rest/v1/rpc/log_water_quality"
  #define SUPABASE_KEY "YOUR_ANON_KEY"
  ```
* **Payload sent to RPC endpoint:**
  ```json
  {
    "p_pond": "01.02.12",
    "p_do": 6.85,
    "p_ph": 7.82,
    "p_temp": 29.40,
    "p_turbidity": 15.20
  }
  ```

### Step B: Weather Station Direct Upload (Optional Final Cutover)
* Currently, the Weather Station v10 sends to GAS, which forwards to Supabase seamlessly.
* When ready to eliminate Google Sheets completely:
  * Update `googleScriptUrl` in `Weather_Station_v10.ino` to point directly to `https://keappoukeagyzpoxkrru.supabase.co/rest/v1/rpc/log_weather_telemetry`.
  * Add the `apikey: YOUR_ANON_KEY` header.
  * Disable the Apps Script trigger and archive the sheet.

---

## 6. Weekly Operations: Access-to-Supabase Authoritative Cycle-Reconciliation Engine

During the transitional phase while iSHARP DBMS 2.0 is operational, the farm team can update operational ponds **daily via the DBMS 2.0 UI** (stocking, harvests, pond statuses, and sampling), while the legacy Microsoft Access database (`.accdb`) continues to be maintained by the Planner and synced every Friday via `Pond Operations Management System/Legacy Access DB/Run_Friday_Sync.bat` and `database_migration/sync_weekly_access.ps1`.

---

### 6.1 How RLS Security Constraints Affect Weekly Sync (and How Migration 15 Solves It)

Following the Phase 5 security hardening (`13_security_hardening_rls_and_rpc.sql`), all write operations across 20+ operational tables (and `SELECT` on `growout_pond_finance`) are protected by Row-Level Security (RLS) policies that verify the `x-isharp-passcode` HTTP header against `pgcrypto` bcrypt hashes in `public.app_passwords`.

* **The Per-Row Bcrypt Constraint (`57014` Statement Timeout):**
  * Bcrypt is intentionally CPU-intensive (~70ms per evaluation) to defeat brute-force attacks.
  * When an RLS policy is written as `USING (public.fn_can_write_dbms())`, PostgreSQL may evaluate `fn_can_write_dbms()` **once for every row** touched by a `DELETE`, `INSERT`, `UPDATE`, or sensitive `SELECT` statement.
  * If a batch sync statement touches >25–40 rows at once, 40 x 70ms = 2.8s, exceeding Supabase's default 3-second PostgREST statement timeout (`HTTP 500: {"code":"57014","message":"canceling statement due to statement timeout"}`).
* **The Solution (`database_migration/15_sync_hardening.sql`):**
  1. **Statement-Level InitPlan Policies (`(SELECT ...)`):** Wrapping the helper function in a scalar subquery — `USING ((SELECT public.fn_can_write_dbms()))` and `USING ((SELECT public.fn_can_read_sensitive()))` — forces the PostgreSQL query planner to evaluate the passcode check **once per SQL statement** as an `InitPlan` rather than once per row.
  2. **Fast-Path Passcode Resolution:** `public.fn_get_request_role()` checks `service_role` JWT claims and indexed column equality before falling back to `extensions.crypt()`.
  3. **Atomic Cycle-Replacement RPC (`public.fn_sync_replace_cycles`):** Executes `DELETE` + `INSERT` for a batch of `pond_index` cycles inside a single `SECURITY DEFINER` transaction that verifies `fn_can_write_dbms()` once at the top of the function and rolls back automatically if the network drops mid-request.

---

### 6.2 Why Data Duplication Occurred Previously & How Zero-Duplication Is Enforced (Without `index_no`)

Because legacy `index_no` auto-numbers from Microsoft Access are no longer synced to Supabase, the platform enforces strict **natural-key uniqueness** and **full-cycle canonical reconciliation**:

1. **Bug 1 — PowerShell Variable Interpolation on Purge (`$endpoint?`):**
   * *Root Cause:* `Purge-PondIndexRecords` previously constructed URLs with `"$supabaseUrl/rest/v1/$endpoint?pond_index=..."`. PowerShell parsed `$endpoint?` as an undefined variable, sending `DELETE /rest/v1/=in.(...)` (HTTP 404). When the purge failed, the old script swallowed the error and proceeded to `POST` the Access rows anyway, duplicating records on every run.
   * *Fix:* Fixed URL interpolation to `${endpoint}?`, added single-cycle fallback retries, and made purge failures fatal (`throw`) so `POST` can never execute over an unpurged cycle.
2. **Bug 2 — PostgREST 1,000-Row Truncation on `pond_notes`:**
   * *Root Cause:* Stage 6 fetched existing notes via `pond_notes?select=pond_index,note&limit=5000` without pagination. Because PostgREST caps single responses at `db-max-rows = 1000`, all notes beyond row 1,000 (649 notes) appeared "missing" on every sync run and were re-inserted repeatedly (creating 4,545 redundant rows).
   * *Fix:* Implemented paginated `Get-AllFromSupabase` (`limit=1000&offset=N`) across all stages and added a database-level unique expression index `uq_pond_notes_pond_hash_idx ON public.pond_notes (pond_index, md5(btrim(COALESCE(note, ''))))`.
3. **Bug 3 — Date-Filtered Partial Extraction & Backdated Edits:**
   * *Root Cause:* Filtering Access queries by `WHERE smpldate >= Date() - 30` extracted only recent rows while purging the entire `pond_index`, or failed to reconcile older edited rows in the same cycle.
   * *Fix:* Stages 3–7 now identify any `pond_index` that is active or had activity within the **180-day safety window** (`$reconcileDays = 180`), extract **100% of rows for those cycles** from Access, deduplicate them in memory by natural key, and compare their canonical 2-decimal signature against Supabase (`Sync-CycleTable`). Unchanged cycles are skipped (`0 writes needed`), and changed cycles are replaced atomically.

#### Natural Keys Enforced Across All Synced Tables (Zero `index_no`)

| Supabase Table | Natural Uniqueness Key / Constraint | Verified Clean Rows |
| :--- | :--- | :---: |
| `biometrics_sampling` | `uq_biometrics_sampling_pond_date UNIQUE (pond_index, smpl_date)` | **52,025** |
| `pond_notes` | `uq_pond_notes_pond_hash_idx UNIQUE (pond_index, md5(btrim(COALESCE(note, ''))))` | **1,649** |
| `pond_harvest_sales` | `uq_pond_harvest_sales_slip_idx UNIQUE (pond_index, hvt_date, upper(btrim(hvt_buyer)), round(good_wgt,2), round(raw_wgt,2), round(net_sales,2))` | **33,618** |
| `pond_issues` | Cycle-level canonical reconciliation (`pond_index, issue_date, issue_category, issue_status, issue_test`) | **13,415** |
| `pond_stocking_batches` | Cycle-level canonical reconciliation (`pond_index, stck_date, stck_tank, stck_pcs`) | **7,456** |
| `pond_harvest_daily` | Cycle-level canonical reconciliation (`pond_index, harv_date, harv_status, harv_weight, harv_abw`) | **7,604** |
| `growout_pond_feed_legacy` | `uq_growout_pond_feed_legacy_natural UNIQUE (pond_index, feed_date, feed_type, quantity_kg)` | **8,147** |
| `growout_pond_feed_sap` | `sync_key PRIMARY KEY` (`order_no + pond_index + post_date + feed_idx + movement + kg + seq`) | **89,244** |
| `pond_harvest_plan` | `sync_key PRIMARY KEY` (`pond_index + plan_harv_date + plan_harv_status`) | **9,313** |
| `growout_pond_finance` | `pond_index PRIMARY KEY` (1 row per cycle, delta-checked on `revenue, total_cost, gross_profit, ebitda`) | **1,806** |

---

### 6.3 Low / Unstable Internet Resilience & Checkpoint Recovery

To protect the weekly sync against unstable farm internet connections or sudden Wi-Fi/4G drops:
1. **Exponential Backoff HTTP Layer (`Invoke-SupabaseRequest`):** Automatically retries transient network failures, DNS drops, TCP resets (`WinError 10054`), and HTTP `408`/`429`/`502`/`503`/`504` up to **10 attempts** (`2s -> 4s -> 8s -> 15s -> 30s -> 60s -> 90s -> 120s -> 180s -> 240s`, ~13 minutes total tolerance).
2. **Automatic Batch Splitting on Timeout (`57014`):** If any batch `POST` or `DELETE` encounters a statement timeout, `sync_weekly_access.ps1` automatically splits the batch into single-cycle / single-row requests so it succeeds even under heavy database load.
3. **Persistent Checkpoint State (`database_migration/sync_checkpoint.json`):** Saves completed stages (`1..12`) and per-stage reconciled `pond_index` lists after every chunk. If internet is lost completely, simply re-running `Run_Friday_Sync.bat` resumes from the exact stage and cycle where it stopped.
4. **Hardened Batch Launcher (`Run_Friday_Sync.bat`):**
   * Uses `sync.lock` (with active PID verification) to prevent accidental double-click concurrent runs.
   * Tees full console output to timestamped logs in `Pond Operations Management System\Legacy Access DB\sync_logs\sync_YYYYMMDD_HHMMSS.log`.
   * Supports `--no-pause` for unattended Windows Task Scheduler execution.

### Standard Friday Routine:
1. Save the new `.accdb` file into `D:\DB\` or `Pond Operations Management System\Legacy Access DB\`.
2. Double-click `Run_Friday_Sync.bat`.
3. Verify the `[SUCCESS] Weekly Database Sync completed with 0 errors` banner at the end of the run.
