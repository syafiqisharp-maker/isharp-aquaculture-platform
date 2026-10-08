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









