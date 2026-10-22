# Project Walkthrough & Development Notes

This file serves as a persistent record of key milestones, architecture decisions, and development walkthroughs across the iSHARP Precision Aquaculture Platform.

---

## 2026-07-02
* Initial project setup and hardware telemetry planning.

---

## 2026-09-18 to 2026-09-22: Enterprise Database Reverse-Engineering & Architecture V2.0
* **Legacy Access Database Audit:**
  * Analyzed `Bab SGo (r41) 26.09.18.accdb` (180.8 MB) from Setiu Farm (`SETiU`), Terengganu.
  * Cataloged 118 tables, 314 saved queries, and 7,632 historical culture cycles.
  * Verified `PondIndex` compound hierarchy: `Farm.Module.Row.Pond.Cycle` (e.g. `2010112.43` $\rightarrow$ Physical Pond `01.01.12`, Cycle 43).
  * Confirmed 133 active production ponds out of 234 operational ponds (377 total farm assets).
* **Dual-Portal Ecosystem Designed:**
  * **Portal 1 (Field Operations / WQS):** Touch-friendly interface for 9 Supervisors + 9 Pond Managers (24-pond grid, real-time DO/pH alerts, daily feeding swatches, and aerator HP calculation).
  * **Portal 2 (Executive Management / iSHARP DBMS):** Recreating the 9-tab `GrowoutPondMaster` interface, P&L costing, buyer sales grading, and SAP ERP movements (261/262).

---

## 2026-09-23 to 2026-09-25: Supabase Cloud Migration & Automated Sync Engine
* **Cloud Schema Deployment:**
  * Deployed PostgreSQL schema on Supabase (`keappoukeagyzpoxkrru.supabase.co`).
  * Established the **Active Gatekeeper Pattern**: `active_operational_ponds` acts as the gatekeeper for telemetry, referencing permanent dimension `stocking_records(pond_index)`.
  * Deployed RPC ingestion functions: `log_water_quality` and `log_weather_telemetry`.
* **Hardware & Cloud Bridges:**
  * Upgraded Weather Station ESP32 v10 via Google Apps Script (`GoogleAppsScript.gs`) to forward streaming environmental telemetry directly into Supabase `weather_logs`.
  * Built the **Friday Smart Delta Sync Engine** (`sync_weekly_access.ps1` & `Run_Friday_Sync.bat`) to incrementally synchronize newly emailed weekly `.accdb` databases into Supabase in ~20 seconds.

---

## 2026-09-28: iSHARP DBMS 2.0 & Phase 1 Portal Delivery
* **Architectural Guardrails Established:**
  * Drafted [RULES.md](file:///C:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/isharp-dbms/RULES.md) enforcing the 5-layer inward dependency rule and RBAC permissions.
* **Master Specification Authored:**
  * Created [EXECUTIVE_PORTAL_SPEC.md](file:///C:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/isharp-dbms/EXECUTIVE_PORTAL_SPEC.md) detailing the Welcome Portal and 216-Pond Interactive Farm Map.
* **Phase 1 Completed (Portal Routing & Minimalist Landing Page):**
  * Built single unified app with `viewRouter.js` handling `portal`, `executive`, and `dbms` views.
  * Designed 50/50 Frutiger Aero split landing page with animated upward-drifting water bubbles, official Blue Archipelago logo badge, and 3D clickable glass orbs with tactile zoom and ripple transitions.
  * Added persistent `"← Back to Portal"` navigation across Executive and DBMS views.

---

## 2026-09-29: Phase 2 Delivered — 216-Pond Interactive Farm Grid Map
* **Component Delivered:** Built and mounted `PondGridMap.js` inside `src/modules/executive/executiveTab.js`.
* **Farm Grid Architecture:** Rendered all 9 Modules (18 rows of 12 ponds = 216 commercial ponds).
* **Farm-Wide Data Fix:** Resolved PostgREST 1,000-row historical cycle ceiling by filtering on non-closed cycles (`pond_status=neq.CLOSE`); all 291 active farm cycles across Modules 01 through 09 now render seamlessly.
* **Dual DBMS Navigation:** Added both `[ ← Back to Portal ]` and `[ 🗺️ Executive Map ]` in DBMS top-left header for seamless switching without revisiting the landing page.
* **Biosecurity Engine:** Wired each pond cell to Supabase `stocking_records`, `active_operational_ponds`, and batch pathology records in `pond_issues` (🔴 Red Alert, 🟡 Observation Warning, 🟢 Clean Active, ⚪ Idle).
* **Culture Stages Standardized:** Applied `Early (<30 DOC)`, `Mid (30–70 DOC)`, and `Finishing (>70 DOC)`.
* **Clean UI & Slide-Out Drawer:** Removed redundant floating hover tooltip and module badges; clicking any pond tile opens the slide-out right drawer with full telemetry, sampling biometrics, and a direct `[ ⚙️ Open in DBMS View ]` button.
* **Performance & Cache:** Added 5-minute in-memory `sessionStorage` cache with manual refresh, eliminating redundant network requests.
* **Build Verified:** Vite production build passed cleanly (`dist/` generated with 0 errors).

---

## 2026-09-29: Enterprise Staff Directory Normalization & Cycle Incentive Assignment
* **Architectural Normalization (3NF):**
  * Recreated `public.pond_staff` strictly as the **Master Staff Directory** (`staff_no` PK, `staff_name`, `staff_position`, `is_active`) containing all **121 unique farm personnel** extracted and deduplicated from `Bab SGo (r41) 26.09.25.accdb`.
  * Removed static pond linkages from `pond_staff` to support rotation and cycle-accurate tracking.
* **Cycle Crew Allocation Schema:**
  * Added cycle-specific assignment columns to `public.growout_pond_master`: `pm_staff_no`, `sv_staff_no`, `rl_staff_no`, `po_staff_no`, `support_staff_no`.
  * Guarantees 100% accurate historical attribution for harvest target incentive payouts per `pond_index`.
* **Interactive DBMS Personnel UI (Tab 9: Staff & Remarks):**
  * Built smart ID entry with instant name lookup: typing or selecting a 4-digit ID (e.g. `0042` $\rightarrow$ Bujang Slamat, `1157` $\rightarrow$ Mohd Azlie, `1120` $\rightarrow$ Mohammad Fathuddin, `1216` $\rightarrow$ Mohd Ridzuan) immediately populates the corresponding staff name from the in-memory directory cache.
  * Added HTML5 datalist autocomplete for all 121 staff members.
  * Added **`[ 💾 Save Personnel Allocation ]`** button directly patching `growout_pond_master` with toast confirmation.
* **Build Verified:** Vite production build passed cleanly (`dist/` generated with 0 errors).

---

## 2026-09-29: Phase 3 Delivered — Field Operations Portal, 24-Pond Map & Management Entry
* **3-Orb Frutiger Aero Gateway:**
  * Upgraded [landingPage.js](file:///C:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/isharp-dbms/src/modules/landing/landingPage.js) and [landing.css](file:///C:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/isharp-dbms/src/styles/landing.css) to a 3-orb layout: **Executive Dashboard**, **Field Operations**, and **iSHARP DBMS**.
  * Registered `#field-ops` route in [viewRouter.js](file:///C:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/isharp-dbms/src/routing/viewRouter.js).
* **Module Authentication Gate:**
  * Created `module_passwords` table in Supabase Cloud for Modules 01 to 09.
  * Built password-protected module login with session persistence (`sessionStorage`).
* **24-Pond Supervisor Map ([FieldOpsMap.js](file:///C:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/isharp-dbms/src/modules/fieldOps/FieldOpsMap.js)):**
  * Displays the 24 ponds of the selected module (2 rows × 12 ponds).
  * Pond tiles are color-coded directly by the **WQS Feeding Action Plan**:
    * 🔴 **Critical / Reduce Feed** (DO < 3.0, Rain >= 40mm, pH swing > 1.0, Temp >= 33°C)
    * 🟡 **Caution / Careful Feed** (Morning DO dip 3.0–4.0, pH swing 0.5–1.0, Rain 20–40mm, Low Lux)
    * 🟢 **Optimal / Normal Feed** (All parameters safe)
    * ⚪ **Idle / Prep** (Unstocked)
* **Pond-Level WQS Detail ([PondWqsDetail.js](file:///C:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/isharp-dbms/src/modules/fieldOps/PondWqsDetail.js)):**
  * Ported from `WQS DashBoard Module1`: sampling biometrics (ABW, AWG, SR%, Biomass, FCR), dynamic Feeding Action Plan "Why?" diagnostics, diurnal DO/pH/Temp swings, and weather station telemetry.
* **Management Entry Architecture (Dedicated Full Screen Page):**
  * **No Modal / Separate Screen**: Ported Management Entry to a standalone, full-screen operational page ([ManagementEntryPage.js](file:///C:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/isharp-dbms/src/modules/fieldOps/ManagementEntryPage.js)), completely separating it from the pond monitoring view.
  * **Paddlewheel Standardization**: Completely eliminated 4.0 HP units across all calculations and inputs. Standardized strictly to farm reality: **1.0 HP and 2.0 HP paddlewheels only** ($\text{Total HP} = 1.0 \times \text{aerator\_1hp} + 2.0 \times \text{aerator\_2hp}$).
  * **Single Source of Truth Storage**:
    * Personnel $\rightarrow$ `growout_pond_master(pm_staff_no, sv_staff_no, rl_staff_no, po_staff_no, support_staff_no)` with live name resolution from `pond_staff`.
    * Aeration $\rightarrow$ `growout_pond_master(aerator_1hp, aerator_2hp)` and `pond_aerator_inventory`.
    * Feeding Trays, Autofeeders, Hut Condition, Supervisor Remarks $\rightarrow$ `pond_inventories(feeding_tray_count, autofeeder_count, hut_condition, notes)`.
* **Biometrics Sampling Latest Record Fix:**
  * Resolved critical order bug in [samplingRepository.js](file:///C:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/isharp-dbms/src/infrastructure/repositories/samplingRepository.js): switched from `smpl_doc.asc` to `smpl_doc.desc`.
  * Index `[0]` now correctly resolves the latest weekly sampling (e.g. Pond `01.02.11` DOC 69 correctly displays the 2026-09-23 DOC 63 record: ABW `13.05 g`, AWG `+2.05 g/wk`, SR `49.2%`, Biomass `2,812 kg`, FCR `1.48` instead of the old DOC 28 record).
  * Fixed AWG string formatting to avoid double sign (`+-`).
* **Zero Fake Data on 24-Pond Overview Map ([FieldOpsMap.js](file:///C:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/isharp-dbms/src/modules/fieldOps/FieldOpsMap.js)):**
  * Completely removed synthetic simulated sensor formulas (`5.1 + ((p % 5) * 0.15)`).
  * Map tiles now render 100% real database attributes: Pond Code, Cycle, DOC, Species, Line, Area, Assigned Operator, and Active Aeration HP.
  * Displays honest `📡 IoT Node Offline (DO: -- | pH: -- | T: --)` placeholder cards until hardware nodes are powered on.
  * Updated filter pills to: `All 24 Ponds`, `🟢 In Culture`, `⚪ Idle / Prep`.
* **Live Meteorological Telemetry Integration ([WeatherRepository.js](file:///C:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/isharp-dbms/src/infrastructure/repositories/weatherRepository.js)):**
  * Directly queries live Supabase `weather_logs` (2,727+ records) and `weather_hourly_summary`.
  * Visualizes real farm weather station metrics: Solar Lux, 24h Rainfall Today, Ambient Air Temp, Relative Humidity, and Barometric Pressure with real-time update timestamps.
* **Network & Database Client Hardening:**
  * Enhanced [supabase.js](file:///C:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/isharp-dbms/src/infrastructure/supabase.js) to safely handle empty 201 Created and 204 No Content responses without JSON parse exceptions.
  * Added `on_conflict` parameters to `pond_inventories` and `pond_aerator_inventory` upsert endpoints to guarantee non-destructive merges.
* **Build Verified:** Vite production build passed cleanly (`dist/` generated in 966ms with 0 errors).

---

## 2026-09-29: Phase 4 Delivered — Field Operations Daily Records Logbook & Multi-Item Ledger
* **4-View Supervisor Experience ([fieldOpsView.js](file:///C:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/isharp-dbms/src/modules/fieldOps/fieldOpsView.js)):**
  * Seamlessly orchestrated four full-screen operational interfaces with persistent state:
    1. **Module Supervisor Overview Map** (24-pond status & offline IoT placeholders)
    2. **Pond WQS Detail & Feeding Action Diagnostics**
    3. **Dedicated Management Entry Page** (Paddlewheel 1HP/2HP & inventory counts)
    4. **Dedicated Daily Records Logbook Page**
* **Continuous DOC 1 to Present Timeline ([DailyRecordsPage.js](file:///C:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/isharp-dbms/src/modules/fieldOps/DailyRecordsPage.js)):**
  * Built an interactive, full-screen digital ledger replacing manual paper logbooks.
  * Dynamically populates chronological daily rows for the active culture cycle (DOC 1 through harvest).
  * Tracks core aquaculture metrics per day:
    * **Feeding (kg/day)** & **4-Tray Leftover Remnants (% feed remaining)**
    * **Water Depth / Level (cm)** & **Visual Water Colour** classifications
    * **Daily Shrimp Mortality (pcs)** & **Operational Field Remarks**
* **Multi-Item Minerals & Probiotics Ledger Integration:**
  * Created [MineralProbioticRepository.js](file:///C:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/isharp-dbms/src/infrastructure/repositories/mineralProbioticRepository.js) linked directly to Supabase `public.mineral_probiotic_used`.
  * Built dynamic multi-row chemical/additive entry within daily modal dialogs:
    * Standardized **Minerals** list (Agricultural Lime, Calcium Carbonate, Dolomite, Sodium Bicarbonate, MgCl2, MgSO4, KCl, CuSO4, Zeolite, etc.)
    * Standardized **Probiotics & Fermentations** list (Super MS, EM Bokashi, FOS 50, Rice Bran, Bacillus subtilis, Super PS, Molasses, Yeast Ferments, etc.)
  * Live cycle rollup banner calculating total cumulative feed consumed (kg), total minerals applied (kg), total probiotics applied (L), and total mortality.
* **Backend Repository Services:**
  * Implemented [dailyRecordsRepository.js](file:///C:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/isharp-dbms/src/infrastructure/repositories/dailyRecordsRepository.js) with upsert, date range query, and batching.
  * Added instant optimistic updates and toast alerts on save.

---

## 2026-09-29: iSHARP Simulator Architecture Blueprint Authored
* **Bio-Economic Digital Twin Blueprint ([PROJECT_BLUEPRINT.md](file:///C:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/isharp-simulator/PROJECT_BLUEPRINT.md)):**
  * Documented the strategic architecture for the forward-looking 1-to-12-month farm simulator in `isharp-simulator/`.
  * Designed to solve module synchronization, strict $\le$ 30-day idle fallow window enforcement, Vannamei vs. Monodon species mix, feed procurement forecasting across pellet sizes, monthly TNB power & aerator OPEX, and East Coast Northeast Monsoon fallow planning.
  * Established clean architectural separation: `isharp-dbms` handles actual reality, while `isharp-simulator` tests future "What-If" scenarios on top of live Supabase tables.
  * Defined mathematical specifications for 4 core engines: Biological Growth & Biomass, Feeding Rate, Financial OPEX & Cash Flow, and Module Schedule / Fallowing Gantt.

---

## 2026-09-29: Access Sync Engine Normalization & Migration Scripts
* **Master Table Normalization ([sync_weekly_access.ps1](file:///C:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/database_migration/sync_weekly_access.ps1)):**
  * Standardized synchronization pipeline to populate `growout_pond_master` directly.
  * Enforced clean standard uppercase strings for `pond_status` (`PRODUCTION`, `IDLE`, `PREPARATION`, `RESERVOIR`, `MAINTENANCE`, `CLOSE`, `NOT IN USE`) and `pond_active` (`ACTIVE`, `INACTIVE`), resolving legacy Access case inconsistencies.
  * Isolated `pond_stocking_batches` as the sole source of truth for individual seed releases.
* **Staff Directory Tooling:**
  * Added [migrate_staff_to_supabase.ps1](file:///C:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/database_migration/migrate_staff_to_supabase.ps1) and [populate_staff_directory.ps1](file:///C:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/database_migration/populate_staff_directory.ps1) for extracting, normalizing (3NF), and synchronizing 121 farm personnel into `pond_staff`.

---

## 2026-09-29: Architecture Renaming & 3-System Platform Unification
* **Project Directory Restructuring:**
  * Renamed `isharp-dbms/` to **`isharp-platform/`** to eliminate contradiction with the expanded scope.
  * Updated [netlify.toml](file:///C:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/netlify.toml) `base = "isharp-platform"`.
  * Updated `package.json` to `"name": "isharp-aquaculture-platform"`.
  * Updated `index.html` title to `"iSHARP Aquaculture Platform — Enterprise Farm Intelligence"`.
* **Internal Source Code Alignment (`src/modules/`):**
  * Consolidated the 10 deep DBMS tabs cleanly into `src/modules/dbms/` (`masterTab.js`, `samplingTab.js`, `feedingTab.js`, `performanceTab.js`, `stockingTab.js`, `harvestTab.js`, `lifecycleTab.js`, `laboratoryTab.js`, `staffTab.js`, `utilitiesTab.js`).
  * Source tree now strictly mirrors the 3 enterprise systems:
    * `src/modules/landing/` $\rightarrow$ Gateway Portal (3 Orbs)
    * `src/modules/executive/` $\rightarrow$ System 1: Executive Dashboard (216 Ponds)
    * `src/modules/dbms/` $\rightarrow$ System 2: iSHARP DBMS (10 Cycle Tabs)
    * `src/modules/fieldOps/` $\rightarrow$ System 3: Field Operations (Supervisor & Operators)
* **Production Build Verified:** Vite production build executed cleanly in 1.38s with 0 errors.

---

## 2026-10-06 to 2026-10-07: Field Operations UX Overhaul & Access SAP Feed / Harvest Plan Integration
* **Field Operations Mobile Polish & Frutiger Aero Contrast:**
  * Implemented high-contrast typography and anti-washout sheen containment across mobile views.
  * Added dynamic ocean seabed / seagrass backdrop wallpaper (`field_ops_seagrass_bg.jpg`) with translucent glassmorphic surfaces (`rgba(255, 255, 255, 0.75)` on desktop, solid white on mobile for maximum sunlight visibility).
  * Replaced low-contrast cyan aero telemetry cards with standardized `.wqs-metric-card` bento styling (deep navy `#072642` values, cerulean `#0369a1` bold headers).
* **Single Source of Truth (SSOT) for Water Quality Parameters (`waterQualityLimit.js`):**
  * Centralized farm thresholds into `src/domain/waterQualityLimit.js`:
    * Dissolved Oxygen (DO): Optimal > 4.0 ppm, Caution 3.0–4.0 ppm, Danger < 3.0 ppm (hypoxia feed cut).
    * pH Diurnal Swing: Safe ≤ 1.0 Δ/day, Caution > 1.0 Δ/day, Critical ≥ 1.5 Δ/day.
    * Salinity: Optimal 15–35 ppt, Danger < 10 or ≥ 38 ppt.
    * Ammonia ($NH_3$): Optimal < 1.0 mg/L (hidden), Warning 1.0–1.99 mg/L, Danger ≥ 2.0 mg/L (red alert badge).
    * Nitrite ($NO_2^-$) & Alkalinity bounds.
  * Filtered 24-pond card noise: normal parameters remain hidden, while abnormal readings trigger high-contrast warning badges.
* **Quick Log Form & REST Wildcard URL Encoding Bugfix:**
  * Fixed unencoded `%` in PostgREST queries (`like.209%25` instead of `like.209%`) that caused HTTP 500 errors in `labRepository.js` and `FieldOpsMap.js`.
  * Cleaned UTF-8 character encoding issues (`â€"`, `Â·`, etc.).
  * Synchronized the modal switcher bar (`#modal-switcher-pond-title`, `#modal-switcher-pond-subtitle`) dynamically on Next/Prev navigation.
  * Added 3D tactile water colour swatches (`.water-swatch-card`) with active selection binding to `#input-water-colour` and saving to `public.daily_pond_records`.
* **Legacy Access Migrations (`GrowoutPondFeedSAP` & `GrowoutPondHarvestPlan`):**
  * Migrated 89,244 records of `GrowoutPondFeedSAP` into Supabase `public.growout_pond_feed_sap` using `database_migration/migrate_growout_pond_feed_sap.ps1` in 6m 32s.
  * Migrated 9,313 records of `GrowoutPondHarvestPlan` into Supabase `public.pond_harvest_plan` using `database_migration/migrate_growout_pond_harvest_plan.ps1` in 43s.
  * Solved duplicate rows in Access by deterministic streaming with row-occurrence counters to create reliable unique `sync_key` identifiers.
* **Weekly Smart Delta Sync Engine Upgrade (Stages 11 & 12):**
  * Updated `database_migration/sync_weekly_access.ps1` with Stage 11 (`GrowoutPondFeedSAP`) and Stage 12 (`GrowoutPondHarvestPlan`), using a 180-day delta window.
  * Added `SafeTime` parser for Access date/time fields.
  * Successfully verified full pipeline via `Run_Friday_Sync.bat` (46-second idempotent sync run, 0 duplicates).
* **DBMS Visualisations (Feeding Tab & Harvest Tab):**
  * **Feeding Tab (Tab 4):** Dual tables:
    * Table 1: Field Supervisor Daily Logbook (`daily_pond_records`) with date, DOC, feed, tray % remnants, depth, water colour swatch, and remarks.
    * Table 2: Authoritative SAP ERP Feed Ledger (`growout_pond_feed_sap`) labeled by `SAPFeedName`, posting date, movement (261 issue / 262 reversal with negative subtraction styling), and running cumulative feed kg.
  * **Harvest Tab (Tab 7):** Integrated pre-harvest targets:
    * Table 1: Harvest Plan (`pond_harvest_plan`) placed as the first table in the Harvest Records card (Planned Date, Status, Expected Biomass, Expected ABW, Harvest/Delivery Times, Team).
    * Retained subsequent tables for actual Harvest Events and Commercial Buyer Sales.
* **Test Suite & Quality Assurance:**
  * Added `tests/feedingTabContracts.test.js`, `tests/harvestContracts.test.js`, `tests/fieldOpsMobileContracts.test.js`, and `tests/waterQualityContracts.test.js`.
  * Verified all 89 unit and contract tests pass (`npm test`).
  * Verified Vite production build generates cleanly with 0 errors (`npm run build`).

---

## 2026-10-07: Supabase Database Audit & Phase 1 Security Hotfixes Executed
* **Database Architecture & Security Audit:**
  * Ran full Supabase security and performance advisors across all 23 base tables and 5 views.
  * Discovered unauthenticated write vulnerabilities, disabled RLS on `app_passwords`, security definer view leakages, and 105 redundant permissive RLS policies.
* **Phase 1 Security Hotfixes Executed & Verified:**
  * **RLS Enabled on `app_passwords`:** Locked down `public.app_passwords` with a controlled `SELECT` policy (`Allow read app_passwords`) preventing unauthenticated table manipulation.
  * **Protected `module_passwords`:** Altered dangerous `Allow update module_passwords` policy from `{public}` `ALL` to `authenticated` with `qual: false`, cutting off public internet write/delete access while preserving seamless frontend login reads.
  * **Views Hardened with `security_invoker = true`:** Enforced user-level permissions on 5 views (`daily_growout_records`, `pond_cycles`, `weather_hourly_summary`, `view_pond_aeration_summary`, and `view_growout_pond_cycles`), completely resolving `0010_security_definer_view`.
  * **Functions Search Path Locked:** Hardened 8 database functions (`log_water_quality`, `log_weather_telemetry`, `fn_terminate_cycle`, `fn_revive_cycle`, `fn_trig_batch_stocking_to_production`, `fn_delete_idle_cycle`, `fn_close_and_create_next_cycle`, `fn_create_custom_cycle`) by pinning `SET search_path = public, pg_temp`, completely resolving `0011_function_search_path_mutable`.
  * **Migration Codified:** Saved idempotent migration to [01_phase1_security_hotfixes.sql](file:///c:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/database_migration/01_phase1_security_hotfixes.sql).
  * **Zero Downtime Verified:** Verified `isharp-platform` credential sync queries continue to function smoothly.

---

## 2026-10-07: Phase 2 Performance & Indexing Optimization Executed
* **Foreign Key Indexing:**
  * Created `idx_active_operational_ponds_pond_index` on `public.active_operational_ponds (pond_index)`. Completely resolved `0001_unindexed_foreign_keys` (0 findings).
* **Duplicate Index Cleanup:**
  * Dropped redundant duplicate indexes `idx_sampling_index_no` (on 52k-row `biometrics_sampling`), `idx_harvest_index_no` (on `pond_harvest_daily`), and `idx_issues_index_no` (on `pond_issues`), cutting unnecessary write I/O while preserving primary unique constraints (`uq_*`).
* **RLS Multiple Permissive Policy Consolidation:**
  * Removed redundant `SELECT` policies across 19 public tables that were causing double-evaluation on every read query.
  * Completely eliminated `0006_multiple_permissive_policies` warnings (dropped from **105 findings down to 0**).
* **Migration Codified:**
  * Saved migration script to [02_phase2_performance_tuning.sql](file:///c:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/database_migration/02_phase2_performance_tuning.sql).

---

## 2026-10-08: Phase 3 Schema & Architecture Hardening Executed
* **Data Normalization (23,384 SAP Feed Records Reconnected):**
  * Discovered single-digit cycles (.1 through .9) in `growout_pond_feed_sap` had dropped leading zeros from legacy Access exports (`2010101.3` instead of `2010101.03`), causing 23,384 feed rows to fail joins against `growout_pond_master`.
  * Executed regex normalization across all 89,244 rows, achieving 100% match (0 orphaned rows remaining).
* **Foreign Key Referential Integrity Enforced:**
  * Added `fk_growout_pond_feed_sap_pond_index` on `public.growout_pond_feed_sap(pond_index) REFERENCES public.growout_pond_master(pond_index) ON DELETE CASCADE`.
  * Added `fk_pond_harvest_plan_pond_index` on `public.pond_harvest_plan(pond_index) REFERENCES public.growout_pond_master(pond_index) ON DELETE CASCADE`.
* **Domain Guardrails & Default Cleaning:**
  * Cleaned uppercase defaults on `growout_pond_master` for `pond_active` (`ACTIVE`), `farm` (`SETIU`), and `pond_type` (`FULL LINING`).
  * Confirmed and verified database-level `CHECK` constraints `chk_pond_active` and `chk_pond_status`.
* **Sync Pipeline Hardened:**
  * Updated Stage 11 in [sync_weekly_access.ps1](file:///c:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/database_migration/sync_weekly_access.ps1#L867) and [migrate_growout_pond_feed_sap.ps1](file:///c:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/database_migration/migrate_growout_pond_feed_sap.ps1#L134) to automatically apply zero-padding on all future imports.
* **Migration Codified:**
  * Saved migration script to [03_phase3_schema_hardening.sql](file:///c:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/database_migration/03_phase3_schema_hardening.sql).

---

## 2026-10-08: DBMS Platform End-to-End Live Storage Verification
* **Synthetic Live REST Probe (`verify_dbms_e2e_write.mjs`):**
  * Created permanent regression testing probe in `isharp-platform/scripts/verify_dbms_e2e_write.mjs` and wired to `npm run test:e2e`.
  * Ran probe against production Supabase cluster (`keappoukeagyzpoxkrru.supabase.co`) with 100% pass rate (14/14 tests passed).
* **Validated Live Storage Operations:**
  * **Daily Field Records & Treatments:** Verified live `POST`, `PATCH`, and joined relational read queries on `daily_pond_records` and `mineral_probiotic_used`.
  * **Biometrics Sampling:** Verified live insert and retrieval on `biometrics_sampling`.
  * **Harvest & Sales:** Verified live insertion of partial harvest events and commercial sales grading logs.
  * **Automated Teardown:** Guaranteed zero leftover test data via `finally` cleanup handlers.
* **Integrity Guardrails Confirmed Active:**
  * Confirmed PostgreSQL `CHECK` constraint actively rejects invalid/typo status entries.
  * Confirmed PostgreSQL `FOREIGN KEY` constraint actively blocks orphaned feeding records.
* **Build Integrity:** Verified full Vite production build passes cleanly (`dist/` generated with 0 errors).

---

## 2026-10-08: Phase 4 Spreadsheet De-Normalization & Architectural Refactoring
* **Schema Decoupling Executed:**
  * Created `public.pond_event_date` (event log pattern) and safely migrated all 34,250 historical date entries.
  * Created `public.pond_initiatives` (one-to-many list) and migrated all 1,038 experimental farm trials.
  * Established `pond_aerator_inventory` as the single source of truth for paddlewheels.
  * Cleaned 16 spreadsheet-like columns out of `public.growout_pond_master`.
* **Database Views Backward Compatibility (The Smart Fix):**
  * Updated `view_growout_pond_cycles` and `pond_cycles` to virtually reconstruct all 11 dates, paddlewheel units, and trial names through left joins.
  * Preserved 100% frontend read compatibility across existing dashboards and analytics modules.
* **Security & Performance Optimization:**
  * Added covering indexes `idx_pond_event_date_pond_index` and `idx_pond_initiatives_pond_index` (clearing all unindexed foreign key warnings).
  * Added unique constraints `uq_pond_event_date_pond_event` and `uq_pond_initiatives_pond_name` enabling idempotent upsert capabilities.
  * Configured RLS write access for operational clients on newly created tables.
* **Application Updates:**
  * Refactored Staff Tab (`staffTabTemplate.js` and `staffTab.js`) to provide an interactive, dynamic list for farm trials with live Add/Remove buttons.
  * Updated Field Ops `ManagementEntryPage.js` to route aerator updates to `pond_aerator_inventory`.
  * Updated Stage 1 of `sync_weekly_access.ps1` to route weekly Access imports to `pond_event_date` and `pond_initiatives`.
* **Automated E2E Verification:**
  * Extended `verify_dbms_e2e_write.mjs` to include Step 5 probing Phase 4 structures.
  * Probe verified 100% operational (19/19 tests passed with immediate synthetic data teardown).

---

## 2026-10-11: Phase 4 View Alignment for Lab Sync & Staff Allocation
* **Lab Water Quality Ingestion Alignment:**
  * Updated `sync_daily_lab_water_quality.py` and `database_migration/import_lab_water_quality.py` to query `pond_cycles` instead of `growout_pond_master` for cycle boundaries (`date_cycle`, `date_close`). Resolves HTTP 400 caused by Phase 4 decoupling of spreadsheet dates.
  * Added exponential backoff and error logging to HTTP requests.
  * Executed live incremental sync: verified 582 lab records successfully upserted into Supabase `lab_water_quality` in 32.9s.
* **Staff Repository Query Alignment:**
  * Updated `StaffRepository.getLastCycleStaff` in `staffRepository.js` to query `view_growout_pond_cycles` instead of `growout_pond_master`, fixing silent fallback when retrieving prior cycle crew allocations.
* **Regression & Build Verification:**
  * All 96 unit and contract tests passed cleanly (`npm test`).
  * Live E2E probe verified 100% operational (19/19 tests passed).
  * Vite production build generated cleanly with 0 errors (`npm run build`).

---

## 2026-10-11: Password Infrastructure Reliability & Latency Hotfix
* **Root-Cause Remediation for "Hit-and-Miss" Authentication:**
  * **0ms Cached Validation:** Re-architected `verifyDbmsPassword` and `verifyFieldOpsPassword` in `security.js` to immediately validate against in-memory cached credentials and offline defaults. Completely eliminates 25-second blocking network spinners when field operators on poor cellular connections enter valid passcodes.
  * **Strict DBMS Editor Gating:** Pinned `EDITOR` status in DBMS strictly to `dbms_editor` (`mantaray`).
  * **DBMS Viewer Access for Todak & Supervisors:** Updated `verifyDbmsPassword` so `manager_master` (`todak`), `dbms_viewer` (`monodon`), and all 9 module supervisor passcodes (`siakap` .. `tongsan`) grant read-only `VIEWER` access to DBMS.
  * **Universal Admin Overrides on Field Ops:** Enabled `todak` and `mantaray` to unlock any module in Field Operations, while supervisors remain strictly scoped to their assigned module.
  * **Module Number Normalization:** Enforced `Number(moduleNo)` type conversion so integer `1`, string `"1"`, and padded `"01"` all match consistently.
  * **In-Flight Sync Deduplication:** Added `_syncPromise` mutex lock to avoid duplicate parallel Supabase fetches on application bootstrap.
  * **Security Test Suite Added:** Authored `tests/security.test.js` asserting all 12 credentials across both subsystems (98/98 tests passing).

---

## 2026-10-11: Friday Sync Engine Re-Targeted to Primary D:\DB Store
* **Access DB Source Migration:**
  * Re-targeted [`sync_weekly_access.ps1`](file:///c:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/database_migration/sync_weekly_access.ps1) to scan `D:\DB` as the authoritative store.
  * Hardened detection logic with `Bab SGo*.accdb` filter, ignoring Kerteh (`Bab KGo`) and non-Setiu files.
  * Added resilient date parser handling both `26.MM.DD` and legacy `DD.MM.26` notations to guarantee selection of the newest weekly cycle database.
  * Verified live detection: accurately resolves `D:\DB\Bab SGo (r41) 26.10.09.accdb` (2026-10-09 release).
  * Verified OLEDB connection: `Microsoft.ACE.OLEDB.16.0` connects and opens the 172.41 MB database cleanly.

---

## 2026-10-11: Live Synchronization Execution & Phase 4 Audit Verification
* **Live Test Execution (`Run_Friday_Sync.bat` / `sync_weekly_access.ps1`):**
  * Ran end-to-end delta synchronization from `D:\DB\Bab SGo (r41) 26.10.09.accdb` directly to Supabase cloud.
  * **Result:** Exit code 0 (Completed cleanly in 2m 15s).
  * **Master Cycles:** 312 active cycles upserted to `growout_pond_master` matching stripped 20-column schema.
  * **Lifecycle Dates:** 2,122 dates mapped to `pond_event_date`.
  * **Active Gatekeeper:** 132 ponds reconciled in `active_operational_ponds`.
  * **Delta Additions:** 3 new stocking batches, 27 daily harvest logs, 65 harvest sales records, 89 biometrics samplings safely ingested with 0 duplicate collisions.
  * **Aerator & SAP Feeds:** 216 aerator cycles synced to `pond_aerator_inventory`, and 3,764 SAP feed records safely synced to `growout_pond_feed_sap` with zero-padded cycle keys.

---

## 2026-10-11: Field Operations 24-Pond Map DOC Card Visual Hierarchy Improvement
* **Mobile Layout Problem:**
  * Floating `DOC` badge on the top right was colliding with pond code (e.g. `05.09.01`) on compact 2-column mobile screens, creating horizontal squeeze and awkward clipping against tile borders.
* **UI/UX Pro Max Remediation:**
  * **Full-Width Pond Header:** Freed up 100% of the tile top row for the pond number and 3D status orb in [`FieldOpsMap.js`](file:///c:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/isharp-platform/src/modules/fieldOps/FieldOpsMap.js).
  * **Integrated Metadata Subtitle:** Relocated DOC directly into the subtitle row alongside Cycle and Aerator HP (`C40 • DOC 65 • ⚡0 HP`).
  * **Crisp Pill Styling:** Applied `.pond-doc-badge-pill` with soft-sky background (`#e0f2fe`), dark sky text (`#0369a1`), 1px border (`#bae6fd`), and subtle inner shine in [`field-ops-mobile.css`](file:///c:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/isharp-platform/src/styles/field-ops-mobile.css).
  * **Zero Wrapping / Collision:** Eliminates clipping and wrapping on mobile screens down to 320px width.
* **Verification:**
  * 98/98 unit & contract tests passed (`npm test`).
  * Vite production build succeeded in 1.59s.

---

## 2026-10-11: DBMS Top Command Bar Declutter & Space Optimization
* **Header Cramping Problem:**
  * The top 48px command bar was heavily cramped on narrow screens and desktop PWA windows due to redundant elements: a spotlight search box (`Jump to pond #... Ctrl K`) and a wide pond cycle select dropdown (`Pond 01.01.01 - 2010101.39 (DOC 140)`), duplicating the functionality already handled comprehensively by the Left Command Sidebar Pond Explorer tree.
* **UI/UX Pro Max Remediation:**
  * **Removed Redundant Controls:** Completely stripped the duplicate pond select dropdown and top search box from [`dbmsShellTemplate.js`](file:///c:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/isharp-platform/src/modules/dbms/templates/dbmsShellTemplate.js).
  * **Streamlined Central Capsule:** Grouped the quick pond steppers (`‹ ›`) and cloud refresh button (`🔄`) inside an elegant pill capsule (`.pond-nav-capsule`), paired cleanly with the Cycle History dropdown (`select-cycle-history`).
  * **Clean Breathing Room:** The breadcrumb area (`Setiu / Pond 01.01.01 2010101.39 [CLOSE] [INACTIVE]`) and action buttons (`Paste Excel`, `Lock`) now have ample horizontal space without clipping or overlapping.
  * **Keyboard Accessibility Preserved:** Re-targeted the global `Ctrl + K` / `Cmd + K` shortcut in [`main.js`](file:///c:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/isharp-platform/src/main.js) to smoothly focus the Left Tree Search input (`#sidebar-pond-search`).
* **Verification:**
  * All 98 unit and contract tests passed (`npm test`).
  * Vite production build succeeded in 1.44s.

---

## 2026-10-11: Idle Pond Preparation Date Rule Remediation
* **Root-Cause Analysis:**
  * In MS Access (`Bab SGo*.accdb`), when farm staff roll over or duplicate a pond record to start an IDLE cycle (e.g. `2010107.43`), the record retains the old cycle's preparation milestone dates (Cleaning, Liner Repair, Filling, Culture, Baby Box, QA/QC, Ready, and Plan Stock) from months prior (June/July 2026), even though the new idle cycle only commenced on October 5, 2026.
  * During sync, [`sync_weekly_access.ps1`](file:///c:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/database_migration/sync_weekly_access.ps1) previously ingested these dates into `public.pond_event_date`, causing the DBMS Master Tab to incorrectly display last cycle's event dates for idle ponds.
* **Remediation & Guardrails Implemented:**
  * **Domain Validation Rule (`sanitizeIdlePrepDate`):** Added pure domain logic in [`rollover.js`](file:///c:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/isharp-platform/src/domain/rollover.js). For any `IDLE` pond cycle, preparation milestone dates occurring prior to `date_cycle` (or when `date_cycle` is absent) are identified as obsolete events from prior cycles and sanitized to `null` / empty string. Genuine preparation dates occurring on or after `date_cycle` are strictly preserved.
  * **UI & Data Access Alignment:** Integrated `sanitizeIdlePrepDate` into [`pondRepository.js`](file:///c:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/isharp-platform/src/infrastructure/repositories/pondRepository.js), [`masterTab.js`](file:///c:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/isharp-platform/src/modules/dbms/masterTab.js), and [`app.js`](file:///c:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/isharp-platform/app.js). If there is no event date recorded for the current idle cycle, the input fields render clean and empty.
  * **Phase 4 Preparation Date Update Routing:** Updated `PondRepository.updateCycle` to decouple milestone dates to `pond_event_date` (`on_conflict=pond_index,event_name`) and metadata to `growout_pond_master`, fixing Phase 4 save failures.
  * **Sync Ingestion Filter:** Updated Stage 1 in [`sync_weekly_access.ps1`](file:///c:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/database_migration/sync_weekly_access.ps1) to reject preparation event dates prior to `date_cycle` for IDLE ponds during Access synchronization.
  * **Live Supabase Cleanup:** Successfully purged 46 orphaned ghost event records across the 6 affected IDLE ponds (`2010107.43`, `2010209.43`, `2010210.44`, `2010211.44`, `2061105.40`, `2061111.41`). Verified pond `2010107.43` now displays `date_cycle = 2026-10-05` and empty preparation dates. Verified genuine in-cycle cleaning dates (such as `2010108.43`) remain intact.
* **Verification:**
  * 104/104 unit and contract tests passed (`npm test`).
  * Full Vite production build succeeded cleanly (`npm run build`).

---

## 2026-10-11: Universal Platform-Wide Viewer Access (`isharp`)
* **Context & Objective:**
  * Configured the universal viewer password as `isharp` (with `monodon` backward compatibility) granting read-only viewer access across the entire precision aquaculture platform (Executive Dashboard, Central DBMS 2.0, and Field Operations Mobile PWA).
* **Changes Implemented:**
  * **Field Operations Authentication Gating:** Updated [`verifyFieldOpsPassword`](file:///c:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/isharp-platform/src/config/security.js#L186-L200) in [`security.js`](file:///c:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/isharp-platform/src/config/security.js) to accept `viewerPass` (`isharp` / `monodon`). Entering `isharp` now unlocks all 9 Field Operations modules for viewing.
  * **Central DBMS 2.0:** Verified `isharp` assigns `ROLES.VIEWER` with read-only access (saving/modifying cycle parameters disabled, CSV export permitted).
  * **Offline & In-Memory Resiliency:** Maintained 0ms zero-latency local caching and offline fallback for `isharp` (with `monodon` fallback) alongside live Supabase cloud sync.
  * **Test Coverage:** Added test assertions to [`security.test.js`](file:///c:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/isharp-platform/tests/security.test.js) asserting `isharp` successfully unlocks Field Ops modules (Module 1 and Module 09) and Central DBMS in VIEWER mode.
* **Verification:**
  * 111/111 unit tests passed cleanly (`npm test`).
  * Vite production bundle generated without errors (`npm run build`).

---

## 2026-10-12: Field Operations & DBMS Data Entry Schema Audit & Remediation
* **Context & Objective:**
  * Post-Phase 4 schema refactoring, multiple columns were removed from `public.growout_pond_master` (16 spreadsheet date and equipment columns) and new tables were established (`pond_event_date`, `pond_initiatives`, `pond_aerator_inventory`).
  * Executed comprehensive audit and live verification across all data entry forms and save buttons in **Field Operations** and **DBMS**, testing insert, save, verify, and safe snapshot rollback.
* **Audit Execution & Discoveries:**
  * **Automated Audit Suite (`audit_data_entry_schema.mjs`):** Built and executed live probe against IDLE pond context with automated pre-test snapshot and guaranteed teardown restorations.
  * **Identified Mismatches:**
    1. **Aerator Paddlewheel Sync:** [`inventoryRepository.js`](file:///c:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/isharp-platform/src/infrastructure/repositories/inventoryRepository.js) attempted to `PATCH` dropped columns `aerator_1hp` and `aerator_2hp` on `growout_pond_master`, triggering HTTP 400 Bad Request.
    2. **Excel Daily Feed Journal:** [`excelModal.js`](file:///c:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/isharp-platform/src/features/excelImporter/excelModal.js) attempted to insert non-existent column `shift` on `daily_pond_records`, failing batch imports.
    3. **PostgreSQL Lifecycle RPCs:** `fn_create_custom_cycle`, `fn_terminate_cycle`, and `fn_revive_cycle` in PostgreSQL referenced dropped columns `date_plan_stock` and `date_close` on `growout_pond_master`.
* **Remediation Implemented:**
  * **Client Repository Cleanup:**
    * Removed obsolete `PATCH` to `growout_pond_master` in `InventoryRepository.syncAeratorInventory`. Single Source of Truth for aerators is strictly `pond_aerator_inventory`.
    * Updated `excelModal.js` feed parser to omit `shift` from the `daily_pond_records` payload while safely preserving shift details in `remarks` (`[Shift: Morning]`).
    * Added resilient Phase 4 client-side fallbacks in [`pondRepository.js`](file:///c:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/isharp-platform/src/infrastructure/repositories/pondRepository.js) for `createCustomCycle`, `terminateCycle`, `reviveCycle`, and `deleteIdleCycle`, guaranteeing zero downtime or errors even when RPCs encounter legacy schema mismatches.
  * **Database Migration Codified:**
    * Authored idempotent SQL migration [07_phase4_lifecycle_functions_alignment.sql](file:///c:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/database_migration/07_phase4_lifecycle_functions_alignment.sql) updating `fn_create_custom_cycle`, `fn_terminate_cycle`, `fn_revive_cycle`, `fn_close_and_create_next_cycle`, and `fn_delete_idle_cycle` to route dates to `pond_event_date`.
* **Verification & Test Results:**
  * **Audit Probe:** 18/18 operations passed (100% pass rate, 0 failures, all synthetic test records safely reverted).
  * **Permanent E2E REST Probe:** 19/19 passed cleanly (`verify_dbms_e2e_write.mjs`).
  * **Unit & Contract Test Suite:** 114/114 tests passed (`npm test`).
  * **Production Build:** Vite production build generated in 3.77s with 0 errors (`npm run build`).

---

## 2026-10-12: Field Operations Read-Only Viewer Mode Enforcement (`isharp`)
* **Context & Objective:**
  * When users unlocked Field Operations using `'isharp'` (or legacy `'monodon'`), they were previously able to edit daily pond entries, mineral/probiotic treatments, and pond management assignments (personnel, aerators, inventory).
  * Implemented role separation between `SUPERVISOR` (fish passcode, manager master `todak`, DBMS editor `mantaray`) and `VIEWER` (`isharp`, `monodon`).
* **Changes Implemented:**
  * **Role Storage & Resolution (`security.js`):**
    * Added `FIELD_OPS_ROLE_KEY` (`"isharp_field_ops_role"`), `getFieldOpsRole()`, and `canEditFieldOps()`.
    * `verifyFieldOpsPassword` now resolves and returns `"SUPERVISOR"` or `"VIEWER"`.
    * Added in-memory session tracking fallback for testing and non-browser environments.
  * **Field Operations Workspace Header (`fieldOpsView.js`):**
    * If authenticated as Viewer, displays an `👁️ Viewer (Read Only)` badge next to the module header title.
    * Sets `appState.setUserRole(ROLES.VIEWER)`.
  * **24-Pond Map Tile Actions (`FieldOpsMap.js`):**
    * In viewer mode, pond tile action buttons change from `"⚡ + Log Today"` / `"✏️ Edit Today's Log"` to `"👁️ View Today's Log"` / `"👁️ View Logbook"`.
  * **Daily Entry Sheet Modal (`DailyEntryModal.js` & `dailyEntryModalTemplate.js`):**
    * In viewer mode, renders an `👁️ Viewer Mode (Read-Only)` banner notice at the top.
    * Disables all inputs (feed kg, remnant tray %, water level, water colour, mortality, remarks).
    * Disables all stepper buttons, quick toggle pills, chips, and color swatches.
    * Hides Save, Save & Next, and Delete buttons.
    * In `handleSaveRecord()`, adds a hard guard blocking save operations if `!security.canEditFieldOps()`.
  * **Management Entry Page (`ManagementEntryPage.js` & `managementEntryTemplate.js`):**
    * In viewer mode, displays an `👁️ Viewer Mode (Read-Only)` banner notice.
    * Disables personnel lookup inputs, paddlewheel steppers, hut condition dropdown, and field notes.
    * Hides Save, Save & Next Pond, and Copy Previous Pond buttons.
    * In `handleSave()`, adds a hard guard blocking save operations if `!security.canEditFieldOps()`.
* **Verification:**
  * 114/114 unit and contract tests passed cleanly (`npm test`).
  * Full production build succeeded with zero errors (`npm run build`).

---

## 2026-10-21: Historical Data Audit & Hierarchical Conveyor-Belt Optimization Engine
* **Empirical Access DB Audit (`Bab SGo (r41) 26.10.02.accdb`):**
  * Analyzed 7,655 closed cycles, 139 active production ponds, and 7,475 financial P&Ls across Setiu farm history (2015–2026).
  * Confirmed commercial spine is strictly **Modules 01 to 09** (216 growout ponds, ~206 active benchmark capacity; M10 inactive since 2017, M11 inactive since 2022).
  * Discovered annual turn cadence consistently achieves **2.0 to 2.5 cycles/pond/year** (410 to 563 annual cycles).
  * Discovered **31.8% of historical waves are Split-Row** (Row 1 Monodon, Row 2 Vannamei) to match hatchery delivery batch quotas (~1.5–2.7M PLs) and achieve harvest convergence.
* **Root Causes of Invalid "Autofill Wave" Identified:**
  * Disconnected week-44 truncation in `simulationStore.js` dropping valid future waves.
  * Inverted alphabetical conveyor belt initializing elevated modules (M01–M03) in Jan/Feb instead of flood-vulnerable lowland modules (M04–M09).
  * 50-pond/month pigeonhole bottleneck mathematically starving 4–5 modules from receiving Cycle 2.
  * Artificial 4-week staircase (6 ponds/week) instead of row-level atomic stamping (12 ponds/row).
* **Hierarchical Conveyor-Belt Optimization Model Authored:**
  * Designed Lowland-First Conveyor-Belt Order: $[\text{M04, M05, M07, M06, M08, M09}] \rightarrow [\text{M01, M02, M03}]$.
  * Established Dynamic Monthly Capacity Curve $C_{\max}(\text{month})$ (36 in Jan, 72 in Feb–Apr, 48 in May, 72 in Jun–Aug, 60 in Sep, 48 in Oct, 36 in Nov, 24 in Dec).
  * Established Row-Level Atomic Batch Stamping (12 ponds/row in 1 week).
  * Designed Split-Row Wave Formulation with 2-week staggering for harvest convergence.
  * Proved 100% harmonization with the 5-Pillar Empirical Predictive Model.
  * Updated `SIMULATION_MASTER_PLAN.md` and `SIMULATION_UI_VISION_AND_SYNC.md`.

---

## 2026-10-21: Frontier AI Planner SSOT Refactor & Empirical Monodon Calibration
* **Empirical Monodon Ground Truth Audit (`Bab SGo (r41) 26.10.16.accdb`):**
  * Disproved legacy myth that Monodon was restricted to M08/M09.
  * Audit revealed all 9 commercial modules (M01–M09) stock Monodon.
  * **Module 02 is #1** (95 Monodon ponds) and **Module 01 is #2** (91 Monodon ponds) farm-wide (2021–2026).
  * M08 stocks 73.2% Vannamei (221 cycles) and M09 stocks 81.3% Vannamei (139 cycles).
  * Annual Monodon proportion calibrated to empirical 15%–30% seed cap (target 28%, ~100 ponds/year).
  * Monodon batching unit confirmed as 12-pond row blocks with 2-week harvest convergence against companion Vannamei rows.
* **Single Source of Truth (SSOT) Architecture:**
  * Exported operational constants: `COMMERCIAL_MODULES`, `DECOMMISSIONED_MODULES`, `ELEVATED_MODULES`, `LOWLAND_MODULES`, `PIPELINE_CONVEYOR_ORDER`, `GOLDEN_REST_WEEKS`, `MAX_MONTHLY_HATCHERY_PONDS`, `MAX_ANNUAL_MONODON_RATIO`, `MONTHLY_CAPACITY_ENVELOPE`.
  * Purged ~100 lines of duplicated stamping boilerplate by extracting `stampRowBatch()`.
  * Implemented pure functional `allocateTier1Hatchery()` load balancer to enforce the 28 ponds/month single-hatchery bio-limit across `SHT`, `UBN`, `KSK`, `CPD`, `CPM`, and `OIS`.
* **Legacy Code Purged:**
  * Purged arbitrary week-44 truncation in `simulationStore.js` and wired live `moduleInitialReadyWeeks`.
  * Relaxed `auditScheduleRisks` Rule 3 to eliminate false violations on commercial Vannamei in M08/M09 while strictly flagging intensive densities (>120 PL/m²).
* **Verification:**
  * All 171 automated unit tests across 19 suites passed cleanly with 100% green status (`npm test`).
