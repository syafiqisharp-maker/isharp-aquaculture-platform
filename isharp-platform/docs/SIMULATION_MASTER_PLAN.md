# iSHARP 3-Year Frontier Predictive Aquaculture Digital Twin & Rolling MRP Engine
## Master Architecture, Empirical Mathematical Specification & Progress Tracker

> **Document Version:** 2.3.0 (Empirical Data Integrity & Zero-Mock Audit Edition)  
> **Date:** October 18, 2026  
> **Status:** Phase 5 Completed — Frontier Predictive Digital Twin UI, Zero-Mock Mathematical Audit & Live Finance Join Active  
> **Location:** `isharp-platform/docs/SIMULATION_MASTER_PLAN.md`  
> **Project Scope:** All Shrimp Growout & Treatment Ponds across Modules 1 to 11 (`M01–M11`, 281 total pond rows / 206+ active growout capacity) at iSHARP Setiu

---

## 1. Executive Summary & Philosophy

The objective of this project is to build a **Frontier-Level, 3-Year (156-Week / 36-Month / 1,095-Day) Empirical Predictive Digital Twin, Stocking Optimization, and Rolling Material Requirements Planning (MRP) Engine** directly inside the `isharp-platform` web application.

### Core Philosophy: Pure Empirical Prediction Over Static Spreadsheet Formulas
Unlike legacy spreadsheet models (`RPvf, iSharp.xlsx`) that rely on **memoryless, fixed lookup formulas** (assuming every pond achieves a static $86\%$ survival rate and fixed daily growth regardless of how rushed the pond preparation was, whether the pond suffered a disease outbreak in the prior cycle, or how congested the module canal is), **this engine is 100% data-driven and predictive** (no legacy fixed-formula fallback mode).

Trained directly on **10+ years of iSHARP Setiu historical data (7,475+ pond cycles, weekly biometrics samplings, pathology records, harvest sales grades, and 38-column audited financials)**, the engine dynamically predicts how operational decisions—such as **aggressive restocking with short idle turnaround time (DOP)**, **high stocking density**, **module-level biomass congestion**, **hatchery/broodstock selection**, and **seasonal monsoon timing**—will actually impact survival, growth, forced harvests, FCR, shrimp size grades, COGS, and farm EBITDA.

The engine serves two critical functions:
1. **Farm Operations, Scheduling & MRP Console:** Interactive weekly Gantt timeline across Modules `M01–M11` with an **EBITDA-Optimizing Auto-Scheduler** that finds the biological "sweet spot" (optimal idle turnaround days, density, and strategy `DS1–DS4`, `NT1–NT3`, `PT1–PT3`), models both **Partial Harvests (`2X`/`3X`)** and **Full Harvests**, and generates weekly/monthly purchasing requirements for **Post-Larvae (PLs)**, **SAP Feed Item Codes**, **28 Pond-Prep & Culture Chemicals/Fertilizers**, and **TNB Electricity (kWh & RM)**.
2. **Executive & BOD Financial Digital Twin:** Splices **YTD Realized Actuals** with **Rolling Empirical Forecasts** to produce a live **Full-Year Latest Estimate (LE)** vs **Business Plan (BP)** across all 15 BOD KPIs, complete 16-element OPEX/COGS, and Farm EBITDA.

---

## 2. Current Progress & Decisions Tracker

| Milestone / Decision | Status | Decision & Context |
| :--- | :---: | :--- |
| **Repository Strategy** | **DONE** | **Option A Selected:** Built directly inside `isharp-platform` as a dedicated modular view (`src/modules/simulation/`). Avoids separate URLs, reuses existing Supabase client, repositories, and Netlify CI/CD. |
| **Modeling Paradigm** | **APPROVED** | **100% Pure Frontier Empirical Predictive Model:** No legacy static-formula mode. The simulator uses statistical hazard, regression, and quantile growth models trained on the 7,475 historical pond cycles to compete head-to-head against legacy Excel planning over a 2–3 year horizon. |
| **Code Execution Guardrail** | **ACTIVE** | **Strict Planning & Empirical Verification Phase:** Validate the 5-Pillar Empirical Predictive Engine against real Supabase/Access data before writing application UI/domain code. |
| **Time Granularity** | **APPROVED** | **Weekly Resolution (156 Weeks):** W01 to W156 horizontal planning axis with automatic splicing of **YTD Actuals + Rolling Forecast = Latest Estimate (LE)** across Monthly, Quarterly (`Q1–Q4`), Half-Year (`H1–H2`), and Annual columns. |
| **Ground Truth Discovery** | **COMPLETED** | Completed full 37-sheet audit of `C:\Users\syafiq\Downloads\RPvf, iSharp.xlsx` and Access DB `Bab SGo (r41) 26.10.02.accdb`. |
| **Financial Ledger Discovery** | **COMPLETED** | Discovered table `GrowoutPondFinance` containing audited historical costs per pond cycle (Feed, Fries/PL, Chemicals/Fertilizers, Supplies, Electricity, Labor, Maintenance, Depreciation, SAG, EBITDA). |
| **Supabase Financial Schema** | **COMPLETED** | Created `public.growout_pond_finance` in Supabase Cloud with 38 audited accounting columns and performance indexing. |
| **Friday Sync Engine Update** | **COMPLETED** | Added **Stage 14** to `database_migration/sync_weekly_access.ps1` to automatically sync `GrowoutPondFinance` delta on every Friday run. |
| **Historical Data Migration** | **COMPLETED** | Successfully migrated all **7,475 audited cycle records** from Access into Supabase Cloud via `migrate_growout_pond_finance.ps1`. |
| **Excel 1:1 Replacement Mission** | **CONFIRMED** | Primary objective: replace the weekly Excel workbook (`RPvf, iSharp.xlsx`) used by farm management to plan stockings, feed, and cashflows every week. |
| **Current-Year First Scoreboard** | **COMPLETED** | Top Spliced Hero Scoreboard prioritizes **FY 2026 (Current Year)** to immediately show current performance (LE = Jan–Aug Actuals + Sep–Dec Rolling Plan) vs BP and AC25. Top pill switches between FY 2026, FY 2027, and FY 2028. |
| **3-Year Master Timeline** | **COMPLETED** | Tab 2 (`ModulePlannerGrid.js`) supports planning **3 years ahead (156 weeks)** continuously via `🌐 3-Year Master (156 Weeks)` view or 1-year zero-scroll views (`FY 2026`, `FY 2027`, `FY 2028`). |
| **Stocking Themes Palette** | **COMPLETED** | Pre-configures density, duration, and target biomass once in Tab 1 (`StockingThemesTab.js`), eliminating manual pond-by-pond entry for 240+ ponds. 1-click active brush stamping with `🔁 Auto-Chain to W156`. |
| **Gantt Drag-and-Drop & Delete** | **COMPLETED** | Full HTML5 drag-and-drop to reschedule cycle bars across weeks. 3 deletion methods: hover `✕` button, toolbar `🗑️ Eraser` tool, and right-click context menu. Weeks 1–34 locked as Actual YTD. |
| **CSS Architecture (Native CSS)** | **CONFIRMED** | Built purely with native semantic CSS in `src/styles/components/simulation.css`. **Tailwind CSS is NOT used**, preventing destructive Preflight CSS resets from breaking existing DBMS and Field Ops PWA screens. |
| **Empirical Grounding (5 Pillars)** | **ENFORCED** | Active ponds conditioned by live `biometrics_sampling` history via Bayesian quantile inference. Setiu Northeast Monsoon cliff (Nov–Dec) strictly enforced to prevent unrealistic year-end rebound forecasts during poor years. |
| **Zero-Mock Mathematical Audit** | **COMPLETED** | Complete audit of domain calculations and UI components. All static fallbacks (`|| 45`, `|| 32`, `|| 1.62`, `781 MT / 1003 MT`, `* 0.0236` pulse strip multiplier) eliminated; dynamic engine values (`monthlyMatrix`, `weeklyMatrix`, `executiveKpis`) bound across all views. |
| **Live Financial Ledger Join** | **COMPLETED** | `simulationRepository.fetchActualMonthlyHarvests` queries `growout_pond_final_legacy` (319 closed 2026 cycles) and batch-joins with `public.growout_pond_finance` (293 audited cycles), replacing hardcoded cost estimates (`kg * 22.0`, `kg * 17.5`, `kg * 4.5`) with true audited costs. |
| **16-Cost Ledger & Full MRP** | **COMPLETED** | Full monthly and weekly itemization for PL demand (SPF, SPR, SPT, Monodon), Feed demand (7 SAP SKUs: 3202–3303), all 28 chemicals/fertilizers, and complete 16-line OPEX accounting ledger. |
| **15-Month Fluid Crop Runway** | **COMPLETED** | Multi-year fluid fit-to-screen Gantt view allowing late-year stockings to project smoothly into Q1 of next year with zero ghost cycles on idle ponds. |

---

## 3. Data Sources & Integration Blueprint

```
┌────────────────────────────────────────────────────────────────────────┐
│                     HISTORICAL & LIVE DATA INGESTION                   │
├──────────────────────────┬─────────────────────────┬───────────────────┤
│   Supabase Operational   │    Supabase Pathology   │ Supabase Audited  │
│   & Biometrics History   │    & Lifecycle Events   │ Finance & Sales   │
├──────────────────────────┼─────────────────────────┼───────────────────┤
│ • growout_pond_master    │ • pond_event_date       │ • growout_pond_   │
│ • growout_pond_final_    │   (close, cleaning,     │   finance (7,475  │
│   legacy (7,475 cycles)  │    repair, filling,     │   audited cycles) │
│ • pond_stocking_batches  │    ready, disease)      │ • pond_harvest_   │
│ • biometrics_sampling    │ • pond_issues (EHP,     │   sales (Good,    │
│ • daily_pond_records     │   WSSV, EMS, flags)     │   2nd, Small,     │
│ • growout_pond_feed_sap  │ • pond_aerator_inventory│   BelowAvg, RM)   │
└────────────┬─────────────┴────────────┬────────────┴─────────┬─────────┘
             │                          │                      │
             ▼                          ▼                      ▼
┌────────────────────────────────────────────────────────────────────────┐
│              EMPIRICAL CALIBRATION ENGINE (baselineCalibrator.js)      │
│  Extracts Turnaround Hazard, Module Congestion, Cox Survival Hazard,   │
│  Quantile Growth Curves, Grade Split & 16-Element Econometric Costs    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     PURE DOMAIN SIMULATION ENGINE                      │
│     156-Week Constraint Solver, Bayesian Live Updater & Tick Loop      │
└────────────────────────────────────────────────────────────────────────┘
```

#### A. Historical & Live Operational Telemetry (Supabase Cloud)
- **`growout_pond_master` & `view_growout_pond_cycles`**: All ponds across Modules `M01–M11` (`M01–M09`: 234 growout ponds / 206 active benchmark capacity; `M10`: 26 ponds; `M11`: 21 ponds [thirteen 0.5 ha + eight 1.0 ha]; plus treatment/sedimentation ponds `TA`/`TB`), pond lining type (`pond_type`), and strategy (`DS1–DS4`, `NT1–NT3`, `PT1–PT3`).
- **`growout_pond_final_legacy`**: Complete historical cycle outcomes (`date_cycle`, `date_close`, `final_date`, `final_status` [Normal, Forced, Cull], `final_doc`, `final_abw`, `final_kg`, `final_adg`, `final_fcr`, `final_sr`, `total_feed`, `total_harvest_no`, `bs_line`, `stock_date`, `stock_total_fry`, `stock_density`).
- **`pond_event_date` & `pond_issues`**: Exact turnaround timeline (`close` $\rightarrow$ `cleaning` $\rightarrow$ `repair` $\rightarrow$ `filling` $\rightarrow$ `ready` $\rightarrow$ `stock_date`) and pathology history (`issue_category`, `issue_status` [WSSV, EMS, EHP], `issue_flag`, `issue_grade`).
- **`biometrics_sampling` & `daily_pond_records`**: Weekly sampling trajectories (`smpl_doc`, `smpl_abw`, `smpl_surv`, `smpl_dfed`, `smpl_bms`) and daily water quality/mortality/feed logs.
- **`pond_harvest_daily` & `pond_harvest_sales`**: Partial vs Termination harvest tonnages and commercial grading splits (`good_wgt`, `good_prc`, `second_grade_wgt`, `second_grade_prc`, `small_wgt`, `below_wgt`, `rubbish_wgt`, `net_sales`).

### B. Historical Audited Financials (`public.growout_pond_finance`)
38 audited accounting columns per pond cycle (`index_no`, `pond_index`):
- **Direct Variable Costs (RM):** `cons_of_feed`, `cons_of_fries` (PLs), `cons_of_chem_fert` (Chemicals & Fertilizers), `cons_of_supplies`, `electricity` (TNB power), `harvest_expenses`.
- **Farm Overheads & Labor (RM):** `wages_direct`, `wages_indirect`, `repair_maintenance`, `rental`, `security_charges`, `consultant`, `travel_entertainment`, `training_seminar`, `other_utilities_ins`, `other_charges`.
- **Corporate & Accounting Allocations:** `depreciation_fc`, `sag` (Selling, General & Admin), `depreciation_with_sag`.
- **Profitability & Grade Metrics:** `revenue`, `premium_pct`, `small_pct`, `gross_profit`, `ebitda`, `ebit`, `cost_per_kg`, `cash_cost_per_kg`, `total_cost_per_kg_with_sag`, `revenue_per_kg`.

---

## 4. System Architecture & 5-Layer Rule Compliance

Following the project's strict architectural guardrails established in [`RULES.md`](file:///c:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/isharp-platform/RULES.md):

```
UI Modules (src/modules/simulation/)
       │
       ▼
Reactive State (src/state/simulationStore.js)
       │
       ▼
Infrastructure Repositories (src/infrastructure/repositories/simulationRepository.js)
       │
       ▼
Domain Pure Functions (src/domain/simulation/) [Zero DOM, Zero Fetch, 100% Tested]
```

### Layer Details:
1. **Domain Layer (`src/domain/simulation/`):**
   - Pure mathematical and statistical calculations only.
   - `baselineCalibrator.js`: Fits the **5-Pillar Empirical Predictive Priors** from Supabase historical cycles, samplings, issues, sales, and finance tables.
   - `hazardAndGrowthModel.js`: Computes dynamic Turnaround Fatigue penalties, Module Congestion penalties, conditional weekly Cull/Forced-Harvest hazard rates, quantile ABW trajectories, and partial harvest skimming (`2X`/`3X`).
   - `constraintScheduler.js`: Solves the 156-week stocking timeline across `M01–M11` to maximize Farm EBITDA (balancing pond utilization against turnaround fatigue and module congestion).
   - `simTickEngine.js`: Executes weekly/daily biological progression, Bayesian trajectory updating for currently active ponds, SAP feed SKU demand, and 28-item Chemical/Fertilizer MRP.
   - `financialCalculator.js`: Computes 4-tier quality grade pricing (`Premium`, `Grade 2`, `Small`, `Below Avg`), festive price multipliers, econometric 16-element OPEX/COGS, EBITDA, and spliced `Actual YTD + Rolling Forecast = Full-Year LE`.
2. **Infrastructure Layer (`src/infrastructure/repositories/`):**
   - `simulationRepository.js`: Queries Supabase historical/live tables, frozen Business Plan (`BP`) snapshots, and scenario configs via `supabase.request()`.
3. **State Layer (`src/state/`):**
   - `simulationStore.js`: Holds calibrated empirical parameters, active 156-week pond schedule, scenario state, and triggers reactive UI updates.
4. **UI Layer (`src/modules/simulation/`):**
   - `SimulationPage.js`: Main container orchestrating sub-views.
   - `ModulePlannerGrid.js`: 156-week interactive Gantt timeline (`M01–M11`, 281 pond rows) with live Turnaround Fatigue & Congestion risk indicators.
   - `WeeklyRollingTable.js`: 156-week operational & MRP console (matching and expanding `wek` and `mth`: PLs, SAP feed codes, 28 chemicals/fertilizers, TNB power).
   - `BODSummaryTable.js`: Multi-year & monthly spliced executive report (`Actual YTD` + `Rolling Plan` = `LE` vs `BP`), genetic line (`SPF`, `SPR`, `SPT`, `MONODON`) & species breakdowns.

---

## 5. The 5-Pillar Frontier Empirical Predictive Model (with Root Species Bifurcation)

### Root Layer (Pillar 0): Strict Species Bifurcation ($\mathcal{S} \in \{\text{MONODON}, \text{VANNAMEI}\}$)
Because *Penaeus monodon* (Black Tiger) and *Litopenaeus vannamei* (Whiteleg) operate in completely different biological, density, FCR, and market price regimes, **every parameter across Pillars 1–5 is strictly partitioned by Species $\mathcal{S}$ first** (resolved via `pl_type`, `bs_line` — e.g. `CP THAI`, `MOANA`, `MADAGASCAR`, `KSSB` for Monodon vs `SYAQUA`, `API GOLDEN`, `API FIRE DRAGON`, `HONDURAS`, `KONABAY` for Vannamei):
- ***P. monodon* Baseline ($N=744$ cycles, 2018–2026):** Stocked at $40\text{--}52\text{ PL/m}^2$, grows to $29.9\text{g}$ ABW ($\text{ADG } 0.246\text{ g/d}$, $\text{SR } 73.3\%$, $\text{FCR } 1.91$), $32.3\%$ Forced/Cull rate, $\text{RM } 27.58/\text{kg}$ average price, and **$\text{+RM } 32,103/\text{pond}$ EBITDA**.
- ***L. vannamei* Baseline ($N=3,339$ cycles, 2018–2026):** Stocked at $75\text{--}129\text{ PL/m}^2$, grows to $14.7\text{g}$ ABW ($\text{ADG } 0.186\text{ g/d}$, $\text{SR } 64.2\%$, $\text{FCR } 1.60$), $52.9\%$ Forced/Cull rate, $\text{RM } 20.34/\text{kg}$ average price, and **$\text{+RM } 14,389/\text{pond}$ EBITDA**.

Never mixing the two species prevents statistical confounding (such as mistaking $44\text{ PL/m}^2$ Monodon ponds for "low-density Vannamei"). Within its species partition $\mathcal{S}$, every pond $p$ in module $m \in \{\text{M01}\dots\text{M11}\}$ stocked under strategy $s \in \{\text{DS1..4, NT1..3, PT1..3}\}$ with genetic line $\sigma \in \{\text{SPF, SPR, SPT, MON}\}$ is governed by **5 empirically calibrated pillars**:

### Pillar 1: Pond Turnaround Fatigue & Pathogen Carryover Model ($\Phi_{\text{turnaround}}$)
For any pond $p$ beginning cycle $c$ after closing cycle $c-1$:
$$\text{DOP}_{p,c} = t_{\text{stock}}(p,c) - t_{\text{close}}(p,c-1)$$

Using historical consecutive pond pairs $(c-1, c)$ from `growout_pond_final_legacy` and `pond_issues`, we calibrate the **Turnaround Fatigue & Relapse Multipliers**:
- **Growth Penalty from Rushed Prep:**
  $$\phi_{\text{ADG}}(\text{DOP}_{p,c}, \text{Lining}_p) = 1 - \alpha_{\text{fatigue}} \cdot \exp\left(-\frac{\max(0, \text{DOP}_{p,c} - \text{DOP}_{\min})}{\tau_{\text{prep}}}\right)$$
  where short drying/oxidation periods ($\text{DOP} < 21\text{ days}$) leave anaerobic organic sludge and residual ammonia, depressing subsequent ADG and increasing FCR.
- **Pathogen Carryover Hazard Multiplier:**
  $$\phi_{\text{hazard}}(\text{DOP}_{p,c}, \text{Disease}_{p,c-1}) = 1 + \beta_{\text{relapse}}(\text{Disease}_{p,c-1}) \cdot \exp\left(-\frac{\text{DOP}_{p,c}}{\tau_{\text{sanitation}}}\right)$$
  If cycle $c-1$ suffered `EHP`, `WSSV`, or `EMS` and the pond is restocked aggressively without sufficient disinfection/drying time ($\text{DOP} < 35\text{ days}$), the probability of early disease outbreak and forced harvest increases sharply based on historical relapse rates. *(Note: Empirical testing of consecutive pond failure streaks confirmed that once a pond is given a proper $\text{DOP} \ge 36\text{d}$ rest, it does NOT suffer a permanent multi-cycle curse—persistent differences across ponds are structural at the Module level in Pillar 2).*

### Pillar 2: Module Spatial Fixed Effects, All-In/All-Out Cohesion & Canal Contagion ($\Psi_{\text{module}}$)
Ponds within the same module $m \in \{\text{M01}\dots\text{M11}\}$ share water supply/discharge hydraulics, soil elevation, and local biosecurity vectors:
1. **Species-Specific Module Structural Fixed Effect ($\mu_{\text{module}}(m, \mathcal{S})$):**
   Calibrated from 2018–2026 history, capturing physical module suitability for each species:
   - **Universal Champion Modules (`M04`, `M05`):** Outperform in both species (`Vannamei`: $\text{+RM } 24,517$ and $\text{+RM } 21,119/\text{pond}$; `Monodon`: $\text{+RM } 44,303$ and $\text{+RM } 48,603/\text{pond}$).
   - **Species-Divergent Modules (`M08`, `M09`):** High-risk/break-even for high-density `Vannamei` ($62.5\%\text{--}64.3\%$ failure rate; EBITDA only $\text{+RM } 2,278$ in `M08` and $\text{+RM } 199$ in `M09`), but **highly profitable for lower-density `Monodon`** ($71\%\text{--}72\%$ success rate; EBITDA **$\text{+RM } 33,325/\text{pond}$ in `M08`** and **$\text{+RM } 32,415/\text{pond}$ in `M09`**).
2. **All-In/All-Out Module Cohesion vs Staggered Overlap:**
   Let $N_{\text{older}}(m, t_{\text{stock}})$ be the number of active ponds in module $m$ already at $\text{DOC} > 25\text{d}$ when pond $p$ is stocked. Stocking into an asynchronous module with older active ponds applies the empirical staggered-overlap penalty on survival and growth.
3. **Concurrent Canal Load & Neighbor Contagion Risk:**
   $$L_m(w) = \frac{\text{ActivePonds}_m(w)}{\text{TotalPonds}_m}, \qquad F_m(w) = \sum_{p \in m} \text{WeeklyFeed}_p(w)$$
   Active pathology outbreaks (`WSSV`/`EMS`/`EHP`) in neighboring ponds within module $m$ during week $w$ dynamically increase the local hazard rate of adjacent ponds in the same module.

### Pillar 3: Conditional Weekly Survival, Monsoon Biological Cliff & Hatchery Hazard ($h_p(d)$)
In legacy Excel, culls and forced harvests are treated as a flat percentage deducted at the end of the cycle. In reality, **when** a pond fails determines how much feed and electricity are sunk vs how much salvage revenue is recovered.
At each Day of Culture $d$ (or Week of Culture $w$), we model two distinct survival processes:
1. **Chronic Biological Mortality ($\mu_{\text{bio}}$):** Daily natural attrition inside surviving ponds:
   $$\text{Pop}_p(d) = \text{Pop}_p(d-1) \times \big(1 - \mu_{\text{bio}}(\mathcal{S}, \sigma, s, d, \text{month})\big) - \text{PartialHarvestPcs}_p(d)$$
2. **Pond-Level Failure / Forced-Harvest Hazard ($h_{\text{fail}}$):** Conditional probability that pond $p$ suffers an acute event (`CULLED` at low DOC or `FORCED HARVEST` at mid DOC) during week $w$, calibrated via discrete-time survival analysis on `growout_pond_final_legacy`:
   $$h_{\text{fail}}(p, w) = h_0(\mathcal{S}, \sigma, b_p, m, w_{\text{DOC}}) \times \theta_{\text{monsoon}}(\text{month}, \mathcal{S}) \times \phi_{\text{hazard}}(\text{DOP}_p, \text{Disease}_{p,c-1}) \times \psi_{\text{contagion}}(L_m(w)) \times \eta_{\text{hatchery}}(h_p, \text{isMixed}_p) \times \gamma_{\text{crowding}}(\text{SD}_p, B_p(w), \mathcal{S})$$
   - **Northeast Monsoon Biological Cliff ($\theta_{\text{monsoon}}(\text{month}, \mathcal{S})$):** Because a crop takes $85\text{--}105\text{ days}$, ponds stocked in **Aug/Sep–Dec** grow straight into Setiu's Northeast Monsoon (Nov–Jan heavy rain, salinity crash, temperature drop). Empirically, `Monodon` stocked in Apr–Jul achieves $15\text{--}22\%$ fail rate and $\text{+RM } 45.5\text{k–54.1k/pond}$ EBITDA, whereas `Monodon` stocked in Sep–Oct suffers $43\text{--}77\%$ failure and **$\text{-RM } 18,213\text{ to -RM } 9,378/\text{pond}$ net losses**. Similarly, `Vannamei` stocked in Nov–Dec suffers $61\text{--}70\%$ forced/cull rates, $-30\%$ slower ADG ($0.148\text{ g/d}$), and EBITDA drops to $\text{+RM } 5,934\text{--7,825/pond}$.
   - **Broodstock & Hatchery Supply Tier Multiplier ($\eta_{\text{hatchery}}$):** Stocking 50–60 ponds/month in post-monsoon windows (`Feb–Apr`) is biologically sustainable *only* when supplied by clean single-source Tier-1 hatcheries (`SHT`, `UBN`, `KSK`, `CPD`) and resilient broodstocks (`CP THAI`, `MOANA`, `MADAGASCAR`, `API GOLDEN`, `API FIRE DRAGON`). When monthly PL demand for a genetic line exceeds Tier-1 single-hatchery capacity—forcing **Multi-Hatchery Tank Mixing** (`SHT,GS`, `SHT,KS`) or sourcing from high-risk hatcheries (`GSR`, `BZYR`) or vulnerable broodstocks (`SK/25`, late-season `SYAQUA`)—$\eta_{\text{hatchery}}$ applies the empirical `EHP`/mortality penalty.
   - **Expected Sunk Cost vs Salvage Yield:** At each week $w$, expected pond survival probability is $S_{\text{pond}}(p, w) = \prod_{k=1}^{w} (1 - h_{\text{fail}}(p, k))$. Ponds that trigger forced harvest at intermediate $w_{\text{DOC}}$ yield salvage biomass at that week's `ABW` (priced at small/below-average tail counts) while stopping feed/power consumption for the remainder of the cycle.

### Pillar 4: Species-Specific Density Curve, Carrying-Capacity Skimming (`2X`/`3X`) & 4-Tier Grading
1. **Empirical Growth Curve with Species Density & Standing Biomass Ceiling:**
   $$\text{ABW}_p(d) = \text{ABW}_p(d-1) + \text{ADG}_{\text{hist}}(\mathcal{S}, \sigma, s, m, d) \times \theta_{\text{monsoon}}(\text{month}, \mathcal{S}) \times \phi_{\text{ADG}}(\text{DOP}_p) \times \gamma_{\text{density}}(\text{SD}_p, B_p(d), \mathcal{S})$$
   - **Species-Specific Stocking Density Curve ($\gamma_{\text{density}}(\text{SD}_p, \mathcal{S})$):**
     - ***L. vannamei*:** Under-stocking ($<75\text{ PL/m}^2$) under-utilizes pond capacity ($\text{Yield } 2,320\text{ kg}$, $\text{EBITDA +RM } 6,951$). The `1X` single-harvest optimum is **$90\text{--}104\text{ PL/m}^2$** ($\text{Yield } 3,806\text{ kg}$, $\text{EBITDA +RM } 16,930$). Pushing density to **$120\text{--}129\text{ PL/m}^2$** succeeds *only* when paired with `2X`/`3X` partial harvest thinning ($\text{Yield } 4,737\text{ kg}$, $\text{EBITDA +RM } 30,267$). Stocking **$\ge 130\text{ PL/m}^2$** triggers acute biological overcrowding collapse ($74.5\%$ Forced/Cull, $26.6\%$ Culled, $\text{ADG } 0.140\text{ g/d}$, **$\text{EBITDA -RM } 4,468/\text{pond}$**).
     - ***P. monodon*:** Standard density ($40\text{--}48\text{ PL/m}^2$) yields $3,946\text{ kg}$ ($\text{EBITDA +RM } 29,675/\text{pond}$), while well-managed $48\text{--}55\text{ PL/m}^2$ in prime modules/months yields $4,519\text{ kg}$ ($\text{EBITDA +RM } 47,521/\text{pond}$), compared to under-stocked $<40\text{ PL/m}^2$ ($2,876\text{ kg}$, $\text{EBITDA +RM } 13,752/\text{pond}$).
   - **Standing Biomass Carrying-Capacity Relief (`1X` vs `2X` vs `3X` Partial Harvests):**
     A $0.5\text{ ha}$ pond hits an oxygen/waste carrying capacity ceiling around $B_{\text{crit}} \approx 3,800\text{ kg}$ ($\approx 0.76\text{ kg/m}^2$). In single-harvest (`1X`, $N=3,350$) ponds, approaching $B_{\text{crit}}$ slows late-stage growth and elevates forced-harvest risk ($47.0\%$ fail, $\text{Yield } 3,848\text{ kg}$, $\text{EBITDA +RM } 21,491$). Executing **`2X` Partial Harvest** ($N=311$) or **`3X` Partial Harvest** ($N=20$) skims $800\text{--}1,200\text{ kg}$ mid-cycle, dropping standing biomass $B_p(d)$ back below $B_{\text{crit}}$, slashing late forced-harvest failures down to **$15.8\%$ (`2X`) / $10.0\%$ (`3X`)**, unlocking compensatory growth to $20.2\text{g}$ / $24.8\text{g}$, and boosting total cycle yield to **$5,004\text{ kg}$ ($\text{+RM } 33,317$ EBITDA)** for `2X` and **$6,172\text{ kg}$ ($\text{+RM } 50,387$ EBITDA)** for `3X`.
   - **Bayesian Active-Pond Conditioning:** For ponds currently in `PRODUCTION`, the engine reads their latest sampling `(smpl_doc, smpl_abw)` from `biometrics_sampling`, computes their empirical growth percentile $q_p \in (0, 1)$, and projects their remaining DOC along that conditioned percentile trajectory.
   - **Weekly Harvest Logistics Bottleneck Alert:** Flags weeks where concurrent scheduled harvests across the farm exceed processing/buyer absorption capacity (e.g., $>40\text{ MT/week}$).
2. **4-Tier Commercial Quality Grade & Festive Price Model (`pond_harvest_sales`):**
   Using historical sales records, harvest biomass at size $\text{ABW}_p$ is partitioned into the 4 commercial grades:
   $$\vec{g}_p(\mathcal{S}, \text{ABW}_p, \text{Density}_p, \text{Health}_p) = \big[w_{\text{Premium}},\, w_{\text{Grade2}},\, w_{\text{Small}},\, w_{\text{BelowAvg}}\big], \quad \sum w_i = 1$$
   $$\text{EffectivePrice}_p(t) = \left(\sum_{i \in \{ \text{Grades} \}} w_i \cdot \text{Price}_i(\mathcal{S}, \sigma, \text{TailCount}_p)\right) \times \Theta_{\text{festive}}(\text{month}(t))$$
   where $\Theta_{\text{festive}}$ captures historical price premiums during Chinese New Year, Ramadhan/Hari Raya, Deepavali, and Year-End festive windows.

### Pillar 5: 16-Element Econometric Cost, MRP & Correlated Cashflow-at-Risk Engine (`growout_pond_finance`)
Trained directly on the **7,475 audited cycles in `growout_pond_finance`** plus operational dosing rules:
1. **Fries / PL Cost (`cons_of_fries`):** Stocked PLs (including nursery PL multiplier for `NT`/`PT`) $\times$ empirical/configured cost per million PL by genetic line (`SPF`, `SPR`, `SPT`, `MONODON`).
2. **Feed Consumption & Cost (`cons_of_feed`):** Daily biomass gain $\times$ species-specific empirical FCR ($1.60$ baseline Vannamei vs $1.91$ baseline Monodon) $\times$ SAP Feed SKU unit prices (`Starter #1`, `Starter #2`, `Grower #3`, `Finisher #4`, `Monodon Feed`).
3. **28 Chemicals & Fertilizers MRP (`cons_of_chem_fert`):**
   - Itemizes all **28 pond-prep and culture chemicals/fertilizers** (`Dolomite`, `Ca(ClO)2 Gas & Powder`, `CaCO3`, `Ca(OH)2`, `Grain Pellet`, `Rice Bran`, `Molasses`, `Tea Seed Cake`, `Urea`, `TSP`, `PVP-I`, `CuSO4`, `BKC`, `EM Probiotic`, `Super Biotic`, `HCl`, etc.) triggered by newly prepped/stocked ponds (`NP` in `M01–M10` vs `M11`), DOP rehabilitation needs, and active culture weeks.
4. **Electricity Accounting Cost Driver (`electricity`):**
   - *Data Integrity Note:* Legacy per-pond aerator inventory (`pond_aerator_inventory`) is not reliably maintained, and Finance allocates the monthly TNB bill across active ponds by active Days of Culture (`DOC`). Therefore, aeration is **excluded from the biological growth/survival model**, and `electricity` is modeled strictly as a **Pillar 5 Financial Pond-Day Cost Driver** calibrated from `growout_pond_finance` ($\approx \text{RM } 95.40/\text{active pond-day}$, or $\text{DOC}_p \times \text{EmpiricalRate}_{\text{RM/day}}$).
5. **Direct & Allocated Overheads (12 Remaining Elements):**
   - Empirically parameterized per active pond-day, per harvested kg, or per farm calendar month from `growout_pond_finance`: `cons_of_supplies`, `harvest_expenses` (per MT harvested), `wages_direct`, `wages_indirect`, `repair_maintenance` (elevated during `MINOR!` / `MAJOR!` pond repair windows), `consultant`, `rental`, `travel_entertainment`, `training_seminar`, `security_charges`, `other_utilities_ins`, `other_charges`, `depreciation_fc`, and `sag`.
6. **Correlated Monte Carlo Risk Bands ($P_{10} / P_{50} / P_{90}$ Cashflow-at-Risk):**
   - Alongside instant deterministic Expected Value ($E[X]$) projections, the engine computes correlated stochastic confidence bands ($P_{10}$ Downside, $P_{50}$ Median, $P_{90}$ Upside) where weather/monsoon shocks and hatchery batch shocks correlate across concurrent ponds in the same module/month.

### 5.6 Empirical Validation Proof (7,665 Unique Cycles & 7,475 Financial Ledgers)
Calibrating the Species-Partitioned 5 Pillars against the live Supabase tables (`growout_pond_final_legacy`, `growout_pond_finance`, `growout_pond_master`, `pond_stocking_batches`) confirmed the following statistically significant operational laws at iSHARP Setiu:

1. **Pillar 0 Proof — Species Baseline & Density Regimes (2018–2026):**
   - ***P. monodon* ($N=744$):** Yield $3,943\text{ kg}$, ABW $29.9\text{g}$, SR $73.3\%$, ADG $0.246\text{ g/d}$, FCR $1.91$, Fail $32.3\%$, Price $\text{RM } 27.58/\text{kg}$, **EBITDA = $\text{+RM } 32,103/\text{pond}$**.
     - Density brackets: $<40\text{ PL/m}^2$ ($N=103$, $\text{+RM } 13,752$); $40\text{--}48\text{ PL/m}^2$ ($N=453$, $\text{+RM } 29,675$); $>48\text{ PL/m}^2$ ($N=188$, **$\text{+RM } 47,521/\text{pond}$**).
   - ***L. vannamei* ($N=3,339$):** Yield $3,489\text{ kg}$, ABW $14.7\text{g}$, SR $64.2\%$, ADG $0.186\text{ g/d}$, FCR $1.60$, Fail $52.9\%$, Price $\text{RM } 20.34/\text{kg}$, **EBITDA = $\text{+RM } 14,389/\text{pond}$**.
     - Density brackets: Under-stocked $<75\text{ PL/m}^2$ ($N=436$, $2,320\text{ kg}$, $\text{+RM } 6,951$); Moderate $75\text{--}89\text{ PL/m}^2$ ($N=1,034$, $3,468\text{ kg}$, $\text{+RM } 15,410$); Standard `1X` $90\text{--}104\text{ PL/m}^2$ ($N=1,217$, $3,806\text{ kg}$, **$\text{+RM } 16,930$**); High $105\text{--}119\text{ PL/m}^2$ ($N=490$, $3,762\text{ kg}$, $\text{+RM } 13,080$); High-with-Partial-Harvest $120\text{--}129\text{ PL/m}^2$ ($N=68$, $4,737\text{ kg}$, **$\text{+RM } 30,267$**); Overcrowded $\ge 130\text{ PL/m}^2$ ($N=94$, $2,721\text{ kg}$, $74.5\%$ Fail / $26.6\%$ Cull, **$\text{-RM } 4,468/\text{pond}$ loss**).

2. **Pillar 1 Proof — Idle Turnaround Time (`DOP`) & Post-Disease Carryover:**
   - **All Consecutive Cycles:**
     - **Rushed Prep ($\le 20\text{d}$ idle, $N=91$):** Yield = $3,092\text{ kg}$, SR = $61.1\%$, ADG = $0.140\text{ g/d}$, Cash Cost = $\text{RM } 21.41/\text{kg}$, **EBITDA = $\text{+RM } 7,883/\text{pond}$**.
     - **Short Prep ($21\text{--}35\text{d}$ idle, $N=1,038$):** Yield = $3,654\text{ kg}$, SR = $64.5\%$, ADG = $0.160\text{ g/d}$, Cash Cost = $\text{RM } 21.31/\text{kg}$, **EBITDA = $\text{+RM } 12,847/\text{pond}$**.
     - **Standard Golden Rest ($36\text{--}60\text{d}$ idle, $N=2,569$):** Yield = $3,917\text{ kg}$, SR = $65.8\%$, ADG = $0.179\text{ g/d}$, FCR = $1.67$, Cash Cost = $\text{RM } 20.08/\text{kg}$, **EBITDA = $\text{+RM } 13,744/\text{pond}$** (**$+74\%$ higher EBITDA** than Rushed Prep).
     - **Extended Rest ($>60\text{d}$ idle, $N=3,609$):** Yield = $3,959\text{ kg}$, SR = $67.5\%$, ADG = $0.188\text{ g/d}$, but overhead dilution pulls **EBITDA down slightly to $\text{+RM } 13,338/\text{pond}$** (proving $36\text{--}60\text{ days}$ is the economic equilibrium; extreme idling $>100\text{d}$ in Q4 2025 / Q1 2026 starved H1 2026 harvests and spiked fixed overhead per pond to $\text{RM } 27,491$).
   - **Restocking After a Forced Harvest / Cull / Disease Cycle:**
     - **Rushed Prep ($\le 20\text{d}$ idle after disease, $N=32$):** Yield = $2,600\text{ kg}$, ADG = $0.136\text{ g/d}$, FCR = $1.87$, Forced/Cull relapse = $62.5\%$, **EBITDA = $\text{-RM } 4,118/\text{pond}$ (Net Loss)**.
     - **Standard Rest ($36\text{--}60\text{d}$ idle after disease, $N=1,558$):** Yield = $3,860\text{ kg}$, ADG = $0.180\text{ g/d}$, FCR = $1.67$, **EBITDA recovers to $\text{+RM } 12,849/\text{pond}$**.

3. **Pillar 2 Proof — Species-Specific Module Fixed Effects, All-In/All-Out Cohesion & Contagion:**
   - **Species-Specific Module Suitability (`M01–M09`):**
     - `M04` and `M05` are Tier-1 Champions in both `Vannamei` ($\text{+RM } 24,517$ and $\text{+RM } 21,119/\text{pond}$) and `Monodon` ($\text{+RM } 44,303$ and $\text{+RM } 48,603/\text{pond}$).
     - `M08` and `M09` are **Species-Divergent**: `Vannamei` fails $62.5\%\text{--}64.3\%$ of the time in `M08`/`M09` (EBITDA $\text{+RM } 2,278$ and $\text{+RM } 199/\text{pond}$), whereas **`P. monodon` thrives in `M08` ($N=126$, $\text{+RM } 33,325/\text{pond}$) and `M09` ($N=38$, $\text{+RM } 32,415/\text{pond}$)**.
   - **Clean All-In/All-Out Module Start ($0$ older ponds $>25\text{d}$ DOC in module at stock date, $N=2,213$):** Yield = $3,853\text{ kg}$, SR = $66.3\%$, ADG = $0.205\text{ g/d}$, FCR = $1.68$, Forced/Cull = $46.4\%$, **EBITDA = $\text{+RM } 22,966/\text{pond}$**.
   - **Staggered Asynchronous Overlap ($1\text{--}5$ older ponds already in module, $N=577$):** Yield drops to $2,978\text{ kg}$, SR = $61.2\%$, Forced/Cull = $54.6\%$, **EBITDA drops by $78\%$ to $\text{+RM } 5,001/\text{pond}$**.
   - **Neighbor Contagion Wave:** Ponds in a module with $0\text{--}2$ diseased neighbors achieve **$\text{+RM } 50,372$ EBITDA** ($\text{SR } 77.7\%, \text{FCR } 1.26$), whereas ponds caught in a module wave of $9+$ diseased neighbors drop to **$\text{+RM } 9,841$ EBITDA** ($\text{SR } 62.0\%, \text{FCR } 1.78$).

4. **Pillar 3 & 4 Proof — Monsoon Seasonality, Partial Harvest Relief & Pathology Signatures:**
   - **Northeast Monsoon Stocking Cliff (2018–2026):**
     - `P. monodon` stocked in `Apr–Jul` averages $15.0\%\text{--}22.1\%$ failure and **$\text{+RM } 45,467\text{ to +RM } 54,081/\text{pond}$ EBITDA**, but when stocked in `Sep–Oct` (growing through the Nov–Dec monsoon) failure spikes to $42.9\%\text{--}77.1\%$, FCR hits $2.13\text{--}2.40$, and EBITDA crashes to **$\text{-RM } 18,213/\text{pond}$ (Sep)** and **$\text{-RM } 9,378/\text{pond}$ (Oct)**.
     - `L. vannamei` stocked in `Jul–Aug` averages **$\text{+RM } 21,805\text{ to +RM } 23,733/\text{pond}$ EBITDA**, but when stocked in `Nov–Dec` failure hits $61.4\%\text{--}70.1\%$, ADG drops to $0.148\text{ g/d}$, and EBITDA drops to **$\text{+RM } 5,934\text{--7,825/pond}$**.
   - **Partial Harvest Carrying-Capacity Relief (`total_harvest_no`):**
     - `1X` Single Harvest ($N=3,350$): Yield $3,848\text{ kg}$, ABW $17.3\text{g}$, SR $65.1\%$, Fail $47.0\%$, **EBITDA = $\text{+RM } 21,491/\text{pond}$**.
     - `2X` Partial + Final ($N=311$): Yield **$5,004\text{ kg}$ ($+30\%$)**, ABW $20.2\text{g}$, SR $73.3\%$, Fail **$15.8\%$**, **EBITDA = $\text{+RM } 33,317/\text{pond}$ ($+55\%$)**.
     - `3X` Two Partials + Final ($N=20$): Yield **$6,172\text{ kg}$ ($+60\%$)**, ABW $24.8\text{g}$, SR $84.3\%$, Fail **$10.0\%$**, **EBITDA = $\text{+RM } 50,387/\text{pond}$ ($+134\%$)**.
   - **Pathology Outcome Signatures (2020–2026):**
     - **Normal Harvest ($N=3,243$):** DOC $94\text{d}$, Yield $5,094\text{ kg}$, ABW $20.2\text{g}$, SR $79.0\%$, FCR $1.47$, Realized Price $\text{RM } 23.59/\text{kg}$, **EBITDA = $\text{+RM } 46,809/\text{pond}$**.
     - **Forced Harvest ($N=2,671$):** DOC $78\text{d}$, Yield $2,543\text{ kg}$, ABW $14.8\text{g}$, SR $48.9\%$, FCR $1.98$, Realized Price $\text{RM } 19.93/\text{kg}$, **EBITDA = $\text{-RM } 8,387/\text{pond}$** (`EHP`: $\text{+RM } 3,862$; `EMS`: $\text{-RM } 24,183$).
     - **Culled Pond ($N=508$):** Avg DOC $28\text{d}$, Yield $0\text{ kg}$, **Sunk Loss EBITDA = $\text{-RM } 31,737/\text{pond}$**.

5. **Broodstock Selection & Hatchery Supply Dilution Proof (Why Feb–Apr 2025 Succeeded vs Feb–Apr 2026 Failed):**
   - Stocking $150\text{--}173\text{ ponds}$ across `Feb–Apr` is normal every year, yet **Feb–Apr 2025 ($N=159$)** achieved **$83.2\%$ SR and $\text{+RM } 54,057/\text{pond}$ EBITDA**, whereas **Feb–Apr 2026 ($N=170$)** dropped to **$46.1\%$ SR and $\text{+RM } 4,279/\text{pond}$ EBITDA**:
   - **Genetic & Broodstock Shift:** In Jan–Apr 2025, the farm stocked $43\%$ `P. Monodon` (`CP THAI` $\text{+RM } 72,891/\text{pond}$, `MOANA` $\text{+RM } 56,628/\text{pond}$) and $35\%$ `SPR` (`API GOLDEN` $\text{+RM } 33,257/\text{pond}$, `API FIRE DRAGON` $\text{+RM } 28,129/\text{pond}$), keeping `SPT SYAQUA` to $16\%$. In H2 2025, shifting to `SPT | SK/25` ($N=69$) caused an $82.6\%$ `EHP` infection rate and $\text{-RM } 7,907/\text{pond}$ loss. In 2026, abandoning `SPR` to stock $127$ ponds of `SPT | SYAQUA` resulted in an $84.3\%$ Forced Harvest rate ($43.6\%$ SR, $\text{-RM } 5,575/\text{pond}$).
   - **Multi-Hatchery Tank Mixing & Tier-2 Hatchery Risk (2026):** In 2026, `SPT` stocked from clean single-source Hatchery `SHT` ($N=22$) achieved **$61.8\%$ SR, $1.43$ FCR, and $\text{+RM } 11,231/\text{pond}$ EBITDA**. However, when monthly `SPT` demand exceeded `SHT` capacity, ponds stocked with **mixed multi-hatchery PLs (`SHT,GS` $N=46$: $91.3\%$ Forced, $60.9\%$ EHP, $\text{-RM } 13,190/\text{pond}$; `SHT,KS` $N=18$: $\text{-RM } 3,537/\text{pond}$)** or **Hatchery `GSR` ($N=21$: $95.2\%$ Forced, $32.3\%$ SR, $\text{-RM } 4,996/\text{pond}$) & `BZYR` ($N=9$: $\text{-RM } 10,791/\text{pond}$)** failed heavily, while single-source `P. Monodon` from `UBN` ($N=12$, $\text{+RM } 46,771/\text{pond}$) and `KSK` ($N=34$, $\text{+RM } 36,385/\text{pond}$) thrived.

---

## 6. Spliced Reporting & The 5-Tab Executive Excel Export Engine (`.xlsx`)

To allow direct, apples-to-apples benchmarking against management's legacy workbook (`RPvf, iSharp.xlsx`) while running on the Frontier Empirical Engine, both the web UI and the `exceljs` exporter support **Actual YTD + Rolling Forecast Splicing**:
$$\text{Full-Year Latest Estimate (LE)} = \underbrace{\sum_{m \in \text{Completed Months}} \text{Realized Actuals}(m)}_{\text{From Supabase Prod Tables}} + \underbrace{\sum_{m \in \text{Remaining Months}} \text{Frontier Predictive Forecast}(m)}_{\text{From 5-Pillar Simulation Engine}}$$

```
┌────────────────────────────────────────────────────────────────────────┐
│                   5-TAB EXECUTIVE EXCEL EXPORT WORKBOOK                │
├─────────────────────┬──────────────────────────┬───────────────────────┤
│ Tab 1: BOD_KPI      │ Tab 2: Monthly_PRT_BP    │ Tab 3: Weekly_MRP     │
│ Historical A20–A25, │ Matches prt & mth:       │ 156-week & 36-month   │
│ BP, Actual YTD,     │ Monthly (Actual+Rolling),│ procurement schedule: │
│ Rolling Plan, LE &  │ Quarterly (Q1–Q4), H1/H2 │ PLs by line, 4 SAP    │
│ Variance vs BP;     │ across M01–M11, SPF/SPR/ │ Feed SKUs, 28 Chems & │
│ Total & by Line     │ SPT/MON, Partial & Full  │ Ferts, TNB kWh & RM   │
├─────────────────────┴──────────────────────────┴───────────────────────┤
│ Tab 4: Pond_Master_Schedule   │ Tab 5: P&L_Cashflow_Forecast           │
│ All 281 pond rows (M01–M11):  │ Complete 16-Element Cost Breakdown     │
│ Strategy (DS/NT/PT), DOP,     │ (Feed, PL, 28 Chems, Power, Wages,     │
│ Fatigue/Hazard Score, Stock & │ Repairs, Depr, SAG), Gross Profit,     │
│ Partial/Full Harvest timeline │ EBITDA, RM/kg Cash & Total Cost        │
└───────────────────────────────┴────────────────────────────────────────┘
```

---

## 7. The Grand Strategy & What-If Scenario Lab ("The War Room")

To transform the simulator into a grand strategy simulation system, a dedicated **War Room / Scenario Lab** (`src/modules/simulation/WarRoomLab.js`) allows management to model complex external disruptions, capex upgrades, and disease outbreaks.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   THE WAR ROOM: GRAND SCENARIO LAB                     │
├──────────────────────────┬──────────────────────────┬──────────────────┤
│   MACRO-ECONOMIC SHOCKS  │   EPIDEMIC BIOSECURITY   │  CLIMATE HAZARD  │
│ • Shrimp Price Collapse  │ • EHP Slow-Growth Bloom  │ • Monsoon Floods │
│ • Feed Inflation Surge   │ • WSSV Viral Incursion   │ • Summer Heat DO │
│ • TNB Tariff Hike        │ • Canal Vector Spread    │ • Salinity Crash │
├──────────────────────────┼──────────────────────────┼──────────────────┤
│    CAPEX TECH UPGRADES   │   SUPPLY CHAIN FRICTION  │   MONTE CARLO    │
│ • Acoustic Auto-Feeders  │ • Hatchery Lorry Delay   │ • 1,000 Iteration│
│ • Bank Solar PV Grid     │ • Feed Mill Stockout     │   Stochastic Sim │
│ • Central Poly Nursery   │ • Harvest Labor Shortage │ • Value-at-Risk  │
│ • HDPE Total Relining    │ • Nursery Quarantine     │ • Best/Worst Map │
└──────────────────────────┴──────────────────────────┴──────────────────┘
```

### 7.1 Complex Input Dimensions & Simulation Mechanics

#### 1. Macro-Economic & Market Shock Vectors
- **Dynamic Selling Price Elasticity:** Stress-test global shrimp price collapses ($\pm \text{RM } 1.00 \text{ to } 5.00/\text{kg}$) or currency swings (USD/MYR).
- **Feed Raw Material Inflation:** Simulate commodity surges (soymeal/fishmeal price spikes +5% to +25%).
- **TNB Energy Tariff Surcharges:** Adjust peak vs off-peak kWh rates or carbon surcharges.

#### 2. Epidemic Biosecurity & Disease Modeling
- **Pathogen Profiles:**
  - **EHP (Enterocytozoon hepatopenaei):** Growth stunted (ADG drops by 40–60% after DOC 45, FCR spikes to 2.2+).
  - **WSSV (White Spot Syndrome Virus):** Acute mortality (80–100% population loss within 5–7 days).
  - **AHPND / EMS (Early Mortality Syndrome):** Mortality spike between DOC 15–35.
- **Canal & Neighboring Module Contagion:** Pathogens spread along shared water discharge canals if adjacent ponds harvest with disease flag (`disease_status`).
- **Mitigation Action Triggers:**
  - Emergency cull at current DOC and salvage value.
  - Mandatory 45-day pond chlorine/liming quarantine.

#### 3. Climate, Monsoon & Environmental Hazard Engine
- **Setiu Monsoon Salinity Crash (Nov–Jan):**
  - Continuous torrential rain drops pond salinity from $28\text{ ppt}$ down to $6\text{--}10\text{ ppt}$.
  - Triggers biological molt stress, slow feeding, and increased mineral dosing requirements.
- **Extreme Dry Season Heatwaves (April–June):**
  - High water temperature ($>33^\circ\text{C}$) depletes dissolved oxygen (DO), requiring emergency aerator runtime (+4 to +6 hours/day), increasing TNB electricity costs.
- **Sea Water Intake Siltation:** Simulates sea mouth closure, restricting water intake for $N$ weeks.

#### 4. Capex & Infrastructure Tech Tree (The "Civ / Factorio" Engine)
Allows testing long-term farm capital investments to evaluate payback period and IRR:
- **Tech 1: Acoustic Auto-Feeders (Pond Automation):**
  - *Capex:* RM 12,000 / pond.
  - *Effect:* Reduces FCR by $0.12$, boosts ADG by $+8\%$, reduces feed waste and water fouling.
- **Tech 2: Central Polyhouse Nursery (2-Stage Culture):**
  - *Capex:* RM 450,000 per module.
  - *Effect:* Shrimp raised to juvenile size (PL30) in 20 days inside biosecure tanks before pond transfer. Cuts growout pond DOC from $90\text{d}$ to $70\text{d}$, unlocking up to **2.4 cycles/year per pond**!
- **Tech 3: Solar PV Farm Banks:**
  - *Capex:* RM 35,000 / pond.
  - *Effect:* Offsets $35\%$ of daytime paddlewheel electricity costs.
- **Tech 4: 100% HDPE Sheet Relining:**
  - *Capex:* RM 25,000 / pond.
  - *Effect:* Cuts pond prep drying time from 35 days down to 18 days, eliminates soil-borne pathogen carryover.

#### 5. Multi-Scenario Monte Carlo Stochastic Simulator
Instead of a single deterministic forecast, the War Room runs **1,000 Monte Carlo iterations**:
- Models biological variation (normal distribution on ADG $\pm 10\%$, beta distribution on Survival Rate).
- Generates **Probability Curves**:
  - *Probability of achieving BOD Harvest Target ($>1,800\text{ MT}$)*: e.g. $84.2\%$.
  - *Probability of Farm EBITDA $> \text{RM } 15.0\text{ Million}$*: e.g. $78.5\%$.
  - *Value-at-Risk (VaR 95%)*: Maximum potential downside loss under severe weather/disease combinations.
- **Side-by-Side Scenario Battle Matrix:** Direct visual diff comparing **Baseline Plan** vs **Aggressive Monodon Plan** vs **Nursery Tech Plan** across 36 months.

### 7.2 Time-Scoped Event Windows & Temporal Shock Injection ("When Does It Strike?")

Real-world farm strategy does not experience global flat disruptions—shocks strike in **specific calendar months or weeks** and last for **defined durations**:
- *"What if unseasonal monsoon torrential rain hits in February 2027 for 4 weeks?"*
- *"What if geopolitical conflict causes oil and TNB electricity bills to spike by +30% starting in October 2027 for 6 months?"*
- *"What if global feed soymeal shortages surge feed prices by +15% starting in July 2028 permanently?"*

```
┌────────────────────────────────────────────────────────────────────────┐
│             TEMPORAL SHOCK TIMELINE RIBBON (W01 TO W156)               │
├─────────────────────┬──────────────────────────┬───────────────────────┤
│ Feb 2027 (W06–W10)  │ Oct 2027 (W40–W66)       │ Jul 2028 (W78–W156)   │
│ [ 🌧️ Monsoon Flood  │ [ ⚡ War Energy Surge     │ [ 🌾 Feed Inflation   │
│   Salinity Crash    │   TNB Tariff +30%        │   +15% Cost/kg        │
│   ADG -30%, 4 wks ] │   Duration: 6 Months ]   │   Permanent Step ]    │
└─────────────────────┴──────────────────────────┴───────────────────────┘
```

#### 1. Data Structure (`TemporalShockEvent`)
```javascript
{
  id: "shock_war_energy_oct27",
  name: "Middle East Conflict Energy Surge",
  category: "MACRO_ENERGY", // MACRO_ENERGY, COMMODITY_FEED, CLIMATE, BIOSECURITY, LOGISTICS
  startWeek: 40,            // e.g. Week 40 (October 2027)
  durationWeeks: 26,        // 26 Weeks (6 Months) or null (Permanent forward step)
  targetScope: {
    type: "FARM_WIDE",      // "FARM_WIDE" or "MODULES" or "SPECIES"
    modules: ["MODL-01", "MODL-02", "MODL-03"], // optional targeted subset
    species: "ALL"
  },
  impactModifiers: {
    electricityTariffMultiplier: 1.30, // +30% TNB power tariff
    feedCostMultiplier: 1.00,          // unchanged
    shrimpPriceShiftRM: 0.00,          // unchanged
    adgMultiplier: 1.00,               // unchanged
    survivalMultiplier: 1.00,          // unchanged
    mineralCostMultiplier: 1.00        // unchanged
  }
}
```

#### 2. Mathematical Evaluation in `simTickEngine.js`
At each simulation week $w \in [1 \dots 156]$:
$$\text{ActiveShocks}(w) = \{ e \in \text{Scenario.shocks} \mid e.\text{startWeek} \le w < (e.\text{startWeek} + (e.\text{durationWeeks} \parallel \infty)) \}$$

For every pond $p$ in production during week $w$:
$$\text{EffectiveTariff}(w) = \text{BaseTariff} \times \prod_{e \in \text{ActiveShocks}(w, p)} e.\text{electricityTariffMultiplier}$$
$$\text{EffectiveFeedPrice}(s, w) = \text{BaseFeedPrice}(s) \times \prod_{e \in \text{ActiveShocks}(w, p)} e.\text{feedCostMultiplier}$$
$$\text{EffectiveADG}(p, w) = \text{BaseADG}(p, w) \times \prod_{e \in \text{ActiveShocks}(w, p)} e.\text{adgMultiplier}$$
$$\text{EffectiveSR}(p, w) = \text{BaseSR}(p, w) \times \prod_{e \in \text{ActiveShocks}(w, p)} e.\text{survivalMultiplier}$$

#### 3. Interactive UI Shock Ribbon (`DisruptionTimelineRibbon.js`)
- An interactive **Event Ribbon** sits directly on top of the 156-week Gantt grid.
- **Click to Inject:** Clicking any month/week column opens the **"Inject Time-Scoped Shock"** modal:
  1. *Select Event Archetype:* Energy Tariff Hike, Feed Inflation, Monsoon Crash, Viral Outbreak, Hatchery Lorry Breakdown.
  2. *Choose Start Month & Week:* e.g. `2027-10 (W40)`.
  3. *Set Duration:* `1 Month`, `3 Months`, `6 Months`, or `Permanent Step Change`.
  4. *Target:* Entire Farm or Specific Modules (e.g. Modules 1 to 4).
  5. *Severity Slider:* Adjust percentage change ($\pm 5\% \text{ to } \pm 50\%$).
- **Instant Visual Delta:** A distinct colored badge appears on the timeline ribbon. The 3-year cashflow curves, monthly MRP, and BOD EBITDA lines show an immediate visual inflection starting exactly at that target week.

---

## 8. Implementation Phased Roadmap

```mermaid
graph TD
    P1["Phase 1: Planning & Specs (DONE)"] --> P2["Phase 2: Database & Data Sync (COMPLETED)"]
    P2 --> P3["Phase 3: Domain Math & Engine (COMPLETED)"]
    P3 --> P4["Phase 4: State & Repositories (COMPLETED)"]
    P4 --> P5["Phase 5: Interactive UI & Gantt Grid (COMPLETED)"]
    P5 --> P6["Phase 6: Excel Export & War Room Lab"]
    P6 --> P7["Phase 7: BOD Validation & Go-Live"]
```

- **Phase 1: Planning & Architecture (DONE)**
  - All formulas, schemas, genetic lines, and requirements documented in `SIMULATION_MASTER_PLAN.md`.
- **Phase 2: Database Migration & Financial Sync (COMPLETED)**
  - `growout_pond_finance` created in Supabase Cloud.
  - All **7,475 audited cycle records** migrated from MS Access.
  - `database_migration/sync_weekly_access.ps1` upgraded with **Stage 14** for automatic weekly Friday syncs.
- **Phase 3: Pure Domain Simulation Engine (COMPLETED)**
  - Implemented `baselineCalibrator.js`, `hazardAndGrowthModel.js`, `financialCalculator.js`, `constraintScheduler.js`, `simTickEngine.js`, and `index.js` under `src/domain/simulation/`.
  - 100% unit-tested via `node --test tests/simulation.test.js` (all 70 domain + simulation tests passing).
- **Phase 4: Infrastructure & State Layer (COMPLETED)**
  - Implemented `simulationRepository.js` (hybrid active pond seeding, sampling map, localStorage persistence).
  - Implemented `simulationStore.js` (reactive pub/sub, debounced 250ms simulation, Monte Carlo runner, auto-scheduler, live telemetry sync).
  - 100% unit-tested via `node --test tests/simulationStore.test.js` (all 4 store suites passing).
- **Phase 5: User Interface, 156-Week Interactive Gantt & Mathematical Audit (COMPLETED)**
  - Implemented `SimulationPage.js`: Master view container, Fiscal Year Selector (`FY 2026`, `FY 2027`, `FY 2028`), 5-Tab Navigation Ribbon, and export triggers.
  - Implemented `SimulationSummaryCards.js`: Spliced Current-Year Hero Scoreboard (FY 2026 LE = Jan–Aug Actuals + Sep–Dec Rolling Plan vs BP & AC25) across Volume MT, Sales Revenue RM, Price/EBITDA, and Pond Turns with Correlated Monte Carlo P10-P50-P90 risk pill. Fully bound to dynamic `monthlyMatrix` and `executiveKpis` (all mock constants removed).
  - Implemented `StockingThemesTab.js` (Tab 1 `'ass'`): Pre-configures density, duration, and output targets for 10 culture strategies (`DS1–DS4`, `NT1–NT3`, `PT1–PT3`) with 1-click active brush stamping.
  - Implemented `ModulePlannerGrid.js` (Tab 2 `'main'`): Multi-year interactive planning grid supporting **3 Years Ahead (`156 Weeks Continuous`)** or 1-year zero-scroll views (`FY 2026`, `FY 2027`, `FY 2028`). Includes:
    - **15-Month Fluid Crop Runway**: Seamless horizontal fit-to-screen view extending late-year stockings into Q1 of next fiscal year with zero ghost cycles on idle ponds.
    - **Native HTML5 Drag-and-Drop**: Reschedule cycle bars horizontally to any starting week.
    - **Auto-Chain to W156**: Stamping or moving a cycle projects chained cycles forward with Golden Rest (36–60d turnaround).
    - **3-Way Cycle Deletion**: Hover `✕` quick-delete button, dedicated toolbar `🗑️ Eraser` tool, and right-click context menu.
    - **4-Row Pulse Strip**: Live weekly/monthly totals bound directly to simulation telemetry for Stocked Ponds/PL, Feed MT, Harvest Biomass MT, and Revenue RM.
    - **3-Level Accordion**: Module (`M01–M11`) $\rightarrow$ Row $\rightarrow$ Individual Pond drill-down.
  - Implemented `MonthlyProductionTab.js` (Tab 3 `'prt'`): 12 monthly columns with actual YTD vs rolling plan, quarterly roll-ups, and species splits, completely eliminating static fallbacks.
  - Implemented `BODSummaryTable.js` (Tab 4 `'kpi.sum'` / `'kpi.gen'`): 15 BOD KPIs, 16 OPEX elements, Genetic Line breakdowns, and multi-year benchmarks (`A20–A25`), bound directly to true dynamic domain aggregations.
  - Implemented `WeeklyRollingTable.js` (Tab 5 `'wek'` & `'mth'`): Weekly and monthly procurement console for PLs (SPF, SPR, SPT, Monodon), 7 SAP Feed SKUs, all 28 Chemicals/Fertilizers, and TNB power.
  - Integrated `public.growout_pond_finance` batch join in `simulationRepository.js` for all 2026 closed cycles, replacing static formula multiplier estimates with true audited financials.
  - Implemented `DisruptionTimelineRibbon.js` and Modals (`PondCycleModal.js`, `ShockModal.js`, `ScenarioModal.js`).
  - Implemented native semantic CSS in `src/styles/components/simulation.css` adhering to `tokens.css` (Tailwind-free architecture).
  - 100% unit-tested via `node --test tests/*.test.js` (**all 162 platform tests passing across 19 suites**).
- **Phase 6: 1:1 Excel Replacement Workbook (.xlsx Export) & War Room Lab**
  - Implement 5-tab Excel export matching `RPvf, iSharp.xlsx` (`ass`, `main`, `prt`, `kpi.sum`, `mth/wek`) via `exceljs`.
  - Implement War Room Macro & Climate Shock testing with permanent baseline saving.
- **Phase 7: Backtesting & Operational Rollout**
  - Compare simulation against 2023–2025 actuals (`Act.23`, `Act.24`, `Act.25`) to verify $\pm 3\text{--}5\%$ predictive accuracy.
  - Train farm management on replacing weekly spreadsheet workflow with the web simulator.

