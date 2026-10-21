# iSHARP Simulation Engine — UI Vision, Architectural Sync & Context Master

> **Document Version:** 1.3.0 (Autofill Waves Optimizer & Gantt Schedule Audit Edition)  
> **Last Synchronized:** October 21, 2026  
> **Document Location:** `isharp-platform/docs/SIMULATION_UI_VISION_AND_SYNC.md`  
> **Primary Purpose:** Comprehensive persistent briefing of the synchronized product vision, Single Source of Truth (`CULTURE_STRATEGIES`), UI/UX architecture, empirical simulation rules, and operational workflow for current and future sessions.

---

## 1. Executive Purpose & Business Context

### The Problem It Solves
Farm management previously relied on a complex 37-sheet Excel workbook (`RPvf, iSharp.xlsx`) to manually schedule stockings, calculate feed consumption, plan chemical procurement, and project cashflows for all 240+ ponds at iSHARP Setiu across 3 years.

### The Replacement Goal
The **Simulation Engine** inside `isharp-platform` is a direct **1:1 modern web replacement** for this spreadsheet. It provides:
1. **Weekly Planning by Farm Management:** A visual, interactive Gantt planner where farm leadership can plan stockings in seconds rather than manually editing hundreds of Excel cells.
2. **Current-Year Realism First:** Prioritizes current fiscal year performance (**FY 2026**) with spliced actuals (Jan–Oct) + rolling forecasts (Nov–Dec), showing Latest Estimate (LE) vs Budget Plan (BP) and AC 2025.
3. **Multi-Year Horizon (3 Years Ahead / 156 Weeks):** Continuous scheduling capabilities across 2026, 2027, and 2028.
4. **Empirical Digital Twin (No Static Formulas):** Grounded in 10+ years of Setiu historical data (7,475 audited cycles in `growout_pond_finance` and weekly `biometrics_sampling`), ensuring the model realistically reflects poor growth years without inventing magical end-of-year recoveries.

---

## 2. Core Architectural & UI Alignments (The "Synced Vision")

### A. Single Source of Truth (`CULTURE_STRATEGIES` in `baselineCalibrator.js`)
- All 10 culture strategy presets (`DS1–DS4`, `NT1–NT3`, `PT1–PT3`) and custom user-registered themes are defined once in [`src/domain/simulation/baselineCalibrator.js`](file:///c:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/isharp-platform/src/domain/simulation/baselineCalibrator.js) via `CULTURE_STRATEGIES` and `registerCustomStrategy()`.
- Every layer reads directly from `CULTURE_STRATEGIES`:
  - **Domain Engine (`simTickEngine.js`):** Reads `targetFinalDoc`, `defaultDensityPlM2`, `harvestPlanCount`, `partialSkimKg`, `partialTriggerDoc`, and `initialWeightGrams`.
  - **Tab 1 (`StockingThemesTab.js`):** Renders theme cards directly from `Object.values(CULTURE_STRATEGIES)` and dynamically switches between **Empirical AI (5 Pillars)** (`expectedYieldPondKg`, `expectedAbwG`, `expectedSrPct`, `expectedEbitdaPondRm`) and **Theoretical Target** (`targetYieldPondKg`, `targetAbwG`, `targetSrPct`, `targetEbitdaPondRm`).
  - **Tab 2 (`ModulePlannerGrid.js`):** Derives brush buttons, cycle durations (`durationWeeks`), turnaround rest (`restWeeks`), feed/week, and PL/pond dynamically via its `specs` getter and `_getSpec()`.
  - **Cycle Inspector (`PondCycleModal.js`):** Populates strategy dropdowns and auto-fills density, target DOC, harvest count, and DOP rest days when a strategy preset is selected, while round-tripping custom overrides back to `ModulePlannerGrid` via `simulationStore` (`scheduleChanged` $\rightarrow$ `syncFromStoreSchedule`).

---

### B. Current Year First Scoreboard (FY 2026 First & Zero Mock Data)
- **Top Command Deck Year Switcher:** `[ FY 2026 (Current) ]`, `[ FY 2027 ]`, `[ FY 2028 ]` (synchronized bi-directionally with Tab 3 and Tab 4 year selectors).
- Defaults to **FY 2026** so leadership immediately sees how the farm is performing this year.
- **4 Spliced Hero Scoreboard Cards (`SimulationSummaryCards.js`):**
  1. **Harvest Volume (LE):** Dynamically bound to `monthlyMatrix` and `executiveKpis`, splicing Actual YTD (Jan–Oct from audited `growout_pond_finance`) + Rolling Plan (Nov–Dec) vs BP and AC 2025 with zero hardcoded constant fallbacks.
  2. **Sales Revenue (LE):** Spliced Actual YTD + Rolling Plan vs BP and AC 2025.
  3. **Selling Price & Farm EBITDA:** Realized Price (RM/kg), Farm EBITDA (RM), Cash Cost (RM/kg), and Total Feed Needed (MT) dynamically aggregated from the simulation engine.
  4. **Pond Utilisation:** 206 Farm Active Capacity, Stk/Harv Turns vs BP.
  - **Monte Carlo Risk Confidence Pill:** Live P10, P50, and P90 Cashflow-at-Risk bands dynamically rendered and triggered on-demand via `#btn-run-monte-carlo`.

---

### C. 3-Year Master Planning Horizon & 15-Month Fluid Crop Runway
In **Tab 2 (`ModulePlannerGrid.js`)**, the user can switch planning perspectives via the **Planning Horizon Switcher**:
- **`FY 2026 (W1–52)` / `15-Month Crop Runway (W1–65)`**: Fluid fit-to-screen view allowing late-year stockings (e.g. W35–W52) to project naturally across the fiscal year boundary into Q1 of the following year (up to W65), preventing truncated cycle bars without breaking page layout.
- **`FY 2027 (W53–117)`**: 65-week runway view for year two.
- **`FY 2028 (W105–156)`**: 52-week view for year three.
- **`🌐 3-Year Master (156 Weeks)`**: Full continuous 156-week master timeline showing the uninterrupted flow across all 3 years.
- **Zero Ghost Cycles & Zero Hidden DOM Hacks:** Idle ponds with no scheduled stocking display clean `IDLE` badges and rest slots without phantom stocked bars or hidden test divs.

---

### D. Stocking Themes Workflow (No Manual Pond-by-Pond Data Entry)
Instead of forcing the user to type DOC, density, and turnaround rest for 240 ponds:
1. **Tab 1: Stocking Themes (`StockingThemesTab.js`)**
   - Configures all 10 operational themes (`DS1–DS4`, `NT1–NT3`, `PT1–PT3`) plus custom user themes via `registerCustomStrategy()`.
   - Each card displays culture parameters, empirical AI predictions vs BP targets, and a 1-click button: **"🎨 Select as Brush"**.
2. **Stamping with Brush (`ModulePlannerGrid.js`)**
   - Selecting a theme loads it into the active brush.
   - Clicking any week slot stamps that theme at Pond, Row, or Module granularity.
   - With **`🔁 Auto-Chain to W156`** checked, future cycles are automatically projected across the entire 3 years with Golden Rest turnaround (36–60 days).
3. **4-Row Top Pulse Strip**
   - Synchronized live summary atop the Gantt grid giving instant feedback on:
     - 📊 *Stocked Ponds & PL Demand*
     - 🌾 *Feed Needed (MT)*
     - 🦐 *Harvest Biomass (MT)*
     - 💰 *Estimated Revenue (RM)*
   - Supports 12 Monthly Boxes view or Week-by-Week slot view.

---

### E. Planning Table Interactions: Drag & Drop + 3 Deletion Methods

#### 1. Drag & Drop Stocking Reschedule
- Every cycle bar has HTML5 native drag-and-drop enabled (`draggable="true"`), with a visual `⋮⋮` grab handle and active grabbing state (`.sim-cycle-bar.is-dragging`).
- The user can click and drag any cycle bar horizontally to any starting week slot across the timeline.
- Drop targets (empty week cells and rest bars) illuminate with a dashed blue border (`.sim-drag-hover`).
- On drop, the cycle instantly snaps to start at the target week.
- If **`🔁 Auto-Chain to W156`** is enabled, all subsequent waves are automatically re-chained forward to Week 156.
- **Protection Guardrail:** Weeks 1 to `cutoffWeek` (W42 in 2026) are locked Actual YTD records and cannot be rescheduled or dropped before Week 43.

#### 2. Three Ways to Delete Cycles
1. **Hover Quick-Delete Button (`✕`)**:
   - Hovering over any cycle bar reveals a round `✕` button on the right edge.
   - Clicking `✕` deletes that cycle immediately with an informative toast notification.
2. **Dedicated Toolbar 🗑️ Eraser Tool**:
   - In the top Theme Brush palette, a red **`🗑️ Eraser`** button toggles eraser mode.
   - The cursor turns into an eraser crosshair across the grid. Clicking any cycle bar deletes it on the spot (if Auto-Chain is on, clears that cycle and all future waves).
3. **Right-Click Context Menu**:
   - Right-clicking any cycle bar opens a floating context menu:
     - 🗑️ *Delete This Cycle*
     - 🔁 *Clear From This Week Onwards*
     - ✏️ *Tune Parameters in Modal (`PondCycleModal`)*

---

### F. Styling & CSS Architecture: Native Semantic CSS (No Tailwind)
- **Tailwind is NOT installed in `isharp-platform`.**
- **All styling is implemented as native semantic CSS in [`src/styles/components/simulation.css`](file:///c:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/isharp-platform/src/styles/components/simulation.css)**, adhering to the platform design tokens in [`tokens.css`](file:///c:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/isharp-platform/src/styles/tokens.css).
- Includes complete theme badge selectors (`.bg-theme-ds1` through `.bg-theme-pt3`) and reusable layout utilities (`.sim-stack-layout`, `.sim-toolbar-group`, `.sim-section-heading`) with zero legacy dead CSS rules.

---

### G. The 5 Empirical Simulation Pillars (No Fake Recoveries)
During bad performance years, the engine strictly prevents unrealistically optimistic forecasts:
1. **Pillar 0 — Species & Strategy Partitioning:**
   - Strict separation between *Penaeus monodon* (Black Tiger) and *Litopenaeus vannamei* (Pacific Whiteleg), with species-sliced monthly roll-ups (`bySpecies.VANNAMEI` and `bySpecies.MONODON`).
2. **Pillar 1 — Turnaround Time (DOP) & Relapse Hazard:**
   - Golden Rest (36–60 days DOP) allows soil remediation and microbial reset.
   - Rushed prep ($\le 20$ days DOP) incurs survival penalties and elevated disease relapse hazards.
3. **Pillar 2 — Module Fixed Effects & All-In/All-Out Cohesion:**
   - M08 and M09 favor Monodon and penalize Vannamei.
   - Unsynchronized stocking across ponds within the same module canal incurs an environmental congestion penalty.
4. **Pillar 3 — Hatchery Quality & Multi-Tank Mixing Penalties:**
   - Penalizes multi-hatchery tank mixing (e.g. SHT + GS) and secondary hatcheries vs Tier-1 single-source hatcheries.
   - **Setiu Northeast Monsoon Stocking Cliff:** Late-year stockings (Nov–Dec for Vannamei, Sep–Oct for Monodon) suffer severe cold-rain mortality and depressed ADG.
5. **Pillar 4 — Carrying Capacity Relief via Partial Harvests:**
   - 2X and 3X partial skims relieve biomass pressure, boosting total yield and EBITDA, with partial harvest ponds and tonnage tracked monthly.
   - **Bayesian Active Pond Conditioning:** Ponds currently in culture with poor sampling history in `biometrics_sampling` stay conditioned to their low growth quantiles (`inferActivePondGrowthQuantile`).
6. **Pillar 5 — Econometric Splicing & Direct Cost Ledger (Finance Table Ground Truth):**
   - Electricity modeled strictly per active pond-day (~RM 95.40/day).
   - Direct operating costs (**`cons_of_chem_fert`**, `cons_of_supplies`, `repair_maintenance`, `harvest_expenses`, `wages_direct`) sourced directly from Finance Department ground truth (`public.growout_pond_finance`), with chemicals calibrated at RM 1,711/cycle (Vannamei) and RM 2,114/cycle (Monodon), allocated 40% pond prep and 60% active culture.
    - YTD Realized Actuals (with stocking attributed to actual stocking month `final_date - final_doc`) spliced with Rolling Forecast to compute Full-Year LE vs BP.

---

### H. Ground Truth Ingestion & Full-Year Gantt Scheduling (Jan–Dec Actuals + Carryovers)
- **Full-Year Database Ingestion (`SimulationRepository.fetchYearCycles`)**:
  - Automatically queries all completed cycles (`pond_status = CLOSE`) and active cycles (`pond_status = PRODUCTION`) that operated during the base year via `or=(stck_date.gte.${year}-01-01,date_close.gte.${year}-01-01)`.
  - Ponds stocked in late previous year (carryovers) are rendered starting at Week 1 with their correct DOC and closed dates without distorting base year stocking counts (`isStockedInBaseYear = false`).
  - Historical actual cycles are immutable (`isLocked = true`) with a protective lock icon (`🔒`), non-draggable status, disabled deletion, and read-only parameter inspection in `PondCycleModal`.
- **Clean Visual Layout (No "W" Prefix & Annual Week Reset)**:
  - Week column headers display pure numbers (`1..52`) without "W" prefixes.
  - For forward multi-year horizons and the 15-month crop runway, week numbers reset to `1` when entering a new calendar year (e.g. Jan '27 starts at Week `1`).
  - Clean visual presentation with zero cluttered "CARRYOVER" badges.

---

### I. Smart "Auto-Fill Waves" Engine & Operational Business Rules
When clicking **⚡ Auto-Fill Waves** or using brush auto-chaining, the scheduler enforces five operational business rules:
1. **Target 2.0 Cycles / Year Aim (Adaptive Horizon):** Aim for 2 stocking events per pond per year. If culture is prolonged (>105d DOC), the engine dynamically adjusts rather than squeezing an unfeasible crop into the cold Northeast Monsoon (Nov–Dec).
2. **Hierarchy of Cohesion (Module-First with Row-Level Fallback):** Whole Module All-In/All-Out synchronized stocking is always priority #1. If staggered finishes occur, falls back to Row-Level Hybrid synchronization (12 ponds in a row sync together). Pond-autonomous fragmentation is strictly prohibited.
3. **Monodon Seed Ceiling & Supervisor Equity Rotation (20% to 30% Annual Total):** Constrained by commercial hatchery supply limits, Monodon stocking is capped at 20%–30% of total farm stockings. While Modules M08, M09, and M05 are prioritized, all module supervisors across M01–M10 receive an equitable rotation of Monodon culture ("a taste") over the planning horizon to ensure fair supervisor incentive distribution, scheduled during biologically safe non-monsoon months (Feb–Jul).
4. **Row-Level Species Homogeneity:** Ponds within the same row are planned with the same species whenever possible for operational efficiency.
5. **Asymmetric Duration Harvest Convergence:** When a module finishes asymmetrically, early-harvested ponds can be stocked with *P. monodon* (112–120d DOC) while prolonged ponds can subsequently take *L. vannamei* (85–98d DOC) to align their termination harvest windows simultaneously.

---

## 3. Five-Tab Master Structure

The simulation page (`#/simulation`) is organized into **5 core tabs**:

| Tab Key | Title | Excel Sheet | Component File | Description |
| :--- | :--- | :---: | :--- | :--- |
| **Tab 1** | `1. 🎨 Stocking Themes` | `'ass'` | [`StockingThemesTab.js`](file:///c:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/isharp-platform/src/modules/simulation/StockingThemesTab.js) | Single Source of Truth (`CULTURE_STRATEGIES`) across 10 culture strategies + custom themes, with Empirical AI vs Target toggle and 1-click brush selection. |
| **Tab 2** | `2. 📅 Planning Schedule` | `'main'` | [`ModulePlannerGrid.js`](file:///c:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/isharp-platform/src/modules/simulation/ModulePlannerGrid.js) | Interactive Gantt grid across 11 modules (M01–M11) displaying full-year realized actuals (Jan–Oct) + forward runway, numeric week headers resetting to 1 annually, drag-and-drop rescheduling, and 4-row pulse strip. |
| **Tab 3** | `3. 📊 Monthly Production` | `'prt'` | [`MonthlyProductionTab.js`](file:///c:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/isharp-platform/src/modules/simulation/MonthlyProductionTab.js) | 12 monthly columns (Jan–Dec actual vs rolling) + Q1–Q4 roll-ups + Full-Year LE with live species filtering (`ALL`, `VANNAMEI`, `MONODON`) and active-month averaging. |
| **Tab 4** | `4. 🏆 BOD KPI & Lines` | `'kpi.sum'`, `'kpi.gen'` | [`BODSummaryTable.js`](file:///c:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/isharp-platform/src/modules/simulation/BODSummaryTable.js) | Executive spliced financial table with 15 BOD KPIs, 16 OPEX elements, dynamic Genetic Lines breakdown, and dynamic Multi-Year (`2026 LE`, `2027 Plan`, `2028 Plan`) roll-ups. |
| **Tab 5** | `5. 📦 Procurement MRP` | `'wek'`, `'mth'` | [`WeeklyRollingTable.js`](file:///c:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/isharp-platform/src/modules/simulation/WeeklyRollingTable.js) | Detailed weekly and monthly operations and procurement console for PLs by line, SAP Feed SKUs, Direct Operational Costs (`cons_of_chem_fert`, supplies, maintenance, direct wages), and TNB power. |

---

## 4. File Manifest & Architecture Map

```
isharp-platform/
├── docs/
│   ├── SIMULATION_MASTER_PLAN.md        # Technical master spec & empirical equations
│   └── SIMULATION_UI_VISION_AND_SYNC.md # This document (UI vision, SSOT, interactions, Excel alignment)
├── src/
│   ├── domain/simulation/               # Pure Domain Math & Simulation Engine
│   │   ├── baselineCalibrator.js        # SSOT (CULTURE_STRATEGIES), historical priors, species constants
│   │   ├── constraintScheduler.js       # Turnaround rules, auto-scheduler, 156-week optimizer
│   │   ├── financialCalculator.js       # Spliced financials, 15 BOD KPIs, 16 OPEX lines, cons_of_chem_fert
│   │   ├── hazardAndGrowthModel.js      # Cox hazards, Bayesian quantiles, monsoon cliff
│   │   ├── simTickEngine.js             # 156-week deterministic simulation loop, bySpecies & direct cost ledger
│   │   └── index.js                     # Unified domain API exports
│   ├── infrastructure/repositories/
│   │   └── simulationRepository.js      # Hybrid active pond seeder, stocking-month attribution, localStorage
│   ├── state/
│   │   └── simulationStore.js           # Reactive state container, debounced runner, schedule sync
│   ├── modules/simulation/              # Phase 5 UI Components
│   │   ├── SimulationPage.js            # Master view orchestrator, year sync, real CSV/Excel export
│   │   ├── SimulationSummaryCards.js    # Spliced Hero Scoreboard (FY 2026 first) + Monte Carlo trigger
│   │   ├── ModulePlannerGrid.js         # Interactive Gantt grid (SSOT specs, store round-trip sync)
│   │   ├── StockingThemesTab.js         # Tab 1: SSOT Themes palette & Empirical vs Target toggle
│   │   ├── MonthlyProductionTab.js      # Tab 3: Monthly PRT table with species slicing & Q1-Q4 roll-ups
│   │   ├── BODSummaryTable.js           # Tab 4: Dynamic Executive spliced P&L, genetic lines, multi-year
│   │   ├── WeeklyRollingTable.js        # Tab 5: Weekly/monthly direct cost & procurement console (Finance Ground Truth)
│   │   ├── DisruptionTimelineRibbon.js  # Macro shock ribbon atop Gantt grid
│   │   └── modals/
│   │       ├── PondCycleModal.js        # Individual pond cycle parameter tuner synced with SSOT
│   │       ├── ShockModal.js            # Macro & climate disruption injector
│   │       └── ScenarioModal.js         # Local scenario snapshot manager
│   └── styles/components/
│       └── simulation.css               # Clean semantic CSS for all simulation components
└── tests/
    ├── simulation.test.js               # Domain math & empirical pillars tests
    ├── simulationStore.test.js          # Reactive state & debounce tests
    └── simulationUI.test.js             # UI component rendering, SSOT, species filter, drag-drop & tab tests
```

---

## 5. Current Test & Build Verification Status

- **Unit Test Suite:** `cmd.exe /c "npm test"` runs all 171 tests across 19 test suites via the Node.js native test runner.
  - `Phase 3 Frontier Simulation Engine`: 16 tests passing across Pillars 0–5, Finance Table direct cost ledger, 156-week optimizer with supervisor fairness rotation and ~2 cycles/yr adaptive target, and Monte Carlo.
  - `Phase 4 Simulation Store & Repository`: 5 tests passing (reactive state, actions, debounced simulation, idle pond exclusion, scenario storage, permanent `yearCycles` retention).
  - `Phase 5 Simulation UI Components`: 18 tests across 8 UI suites (Executive Summary Cards, Disruption Shock Ribbon, 156-Week Gantt with full actuals & 15-Month Runway, Non-destructive Auto-Fill Waves with locked actuals, Drag-Drop/Delete, Direct Cost Ledger Table, BOD Summary Table, Modals with Read-Only Locked Actuals, SSOT Stocking Themes with AI/Target toggle, Monthly Production Roll-Up with Species Slicing) passing.
  - Platform-wide tests (Staff, Water Quality SSOT, Water Quality History Modal): all passing.
  - **Result:** `ℹ tests 171 | suites 19 | pass 171 | fail 0 | cancelled 0`.
- **Local Dev Server:** Active on `http://localhost:5173/#/simulation`.

