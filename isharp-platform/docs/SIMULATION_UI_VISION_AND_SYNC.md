# iSHARP Simulation Engine — UI Vision, Architectural Sync & Context Master

> **Document Version:** 1.1.0 (Zero-Mock Empirical Sync Edition)  
> **Last Synchronized:** October 18, 2026  
> **Document Location:** `isharp-platform/docs/SIMULATION_UI_VISION_AND_SYNC.md`  
> **Primary Purpose:** Comprehensive persistent briefing of the synchronized product vision, UI/UX architecture, empirical simulation rules, and operational workflow for current and future sessions.

---

## 1. Executive Purpose & Business Context

### The Problem It Solves
Farm management previously relied on a complex 37-sheet Excel workbook (`RPvf, iSharp.xlsx`) to manually schedule stockings, calculate feed consumption, plan chemical procurement, and project cashflows for all 240+ ponds at iSHARP Setiu across 3 years.

### The Replacement Goal
The **Simulation Engine** inside `isharp-platform` is a direct **1:1 modern web replacement** for this spreadsheet. It provides:
1. **Weekly Planning by Farm Management:** A visual, interactive Gantt planner where farm leadership can plan stockings in seconds rather than manually editing hundreds of Excel cells.
2. **Current-Year Realism First:** Prioritizes current fiscal year performance (**FY 2026**) with spliced actuals (Jan–Aug) + rolling forecasts (Sep–Dec), showing Latest Estimate (LE) vs Budget Plan (BP) and AC 2025.
3. **Multi-Year Horizon (3 Years Ahead / 156 Weeks):** Continuous scheduling capabilities across 2026, 2027, and 2028.
4. **Empirical Digital Twin (No Static Formulas):** Grounded in 10+ years of Setiu historical data (7,475 audited cycles in `growout_pond_finance` and weekly `biometrics_sampling`), ensuring the model realistically reflects poor growth years without inventing magical end-of-year recoveries.

---

## 2. Core Architectural & UI Alignments (The "Synced Vision")

### A. Current Year First Scoreboard (FY 2026 First & Zero Mock Data)
- **Top Command Deck Year Switcher:** `[ FY 2026 (Current) ]`, `[ FY 2027 ]`, `[ FY 2028 ]`.
- Defaults to **FY 2026** so leadership immediately sees how the farm is performing this year.
- **4 Spliced Hero Scoreboard Cards (`SimulationSummaryCards.js`):**
  1. **Harvest Volume (LE):** Dynamically bound to `monthlyMatrix` and `executiveKpis`, splicing Actual YTD (Jan–Aug from audited `growout_pond_finance`) + Rolling Plan (Sep–Dec) vs BP and AC 2025 with zero hardcoded constant fallbacks.
  2. **Sales Revenue (LE):** Spliced Actual YTD + Rolling Plan vs BP and AC 2025.
  3. **Selling Price & Farm EBITDA:** Realized Price (RM/kg), Farm EBITDA (RM), Cash Cost (RM/kg), and Total Feed Needed (MT) dynamically aggregated from the simulation engine.
  4. **Pond Utilisation:** 206 Farm Active Capacity, Stk/Harv Turns vs BP.
  - **Monte Carlo Risk Confidence Pill:** Live P10, P50, and P90 Cashflow-at-Risk bands dynamically rendered.

---

### B. 3-Year Master Planning Horizon & 15-Month Fluid Crop Runway
In **Tab 2 (`ModulePlannerGrid.js`)**, the user can switch planning perspectives via the **Planning Horizon Switcher**:
- **`FY 2026 (W1–52)`**: 52-week zero-horizontal-scroll view for the current year.
- **`15-Month Crop Runway (Nov–Mar)`**: Fluid fit-to-screen view allowing late-year stockings (e.g. W35–W52) to project naturally across the fiscal year boundary into Q1 of the following year (up to W65), preventing truncated cycle bars without breaking page layout.
- **`FY 2027 (W53–104)`**: 52-week view for year two.
- **`FY 2028 (W105–156)`**: 52-week view for year three.
- **`🌐 3-Year Master (156 Weeks)`**: Full continuous 156-week master timeline showing the uninterrupted flow across all 3 years.
- **Zero Ghost Cycles:** Idle ponds with no scheduled stocking display clean idle rest bars without rendering spurious or phantom stocked bars.

---

### C. Stocking Themes Workflow (No Manual Pond-by-Pond Data Entry)
Instead of forcing the user to type DOC, density, and turnaround rest for 240 ponds:
1. **Tab 1: Stocking Themes (`StockingThemesTab.js`)**
   - Configures 10 operational themes once:
     - Direct Stocking: `DS1` (SPF 10w), `DS2` (SPR 13w), `DS3` (SPT 13w), `DS4` (MON 20w).
     - Nursery Transfer: `NT1` (12w), `NT2` (14w), `NT3` (16w).
     - Partial Harvest: `PT1` (12w), `PT2` (14w 2X), `PT3` (16w 3X).
   - Each card displays culture parameters, empirical AI predictions vs BP targets, and a 1-click button: **"🎨 Use This Theme as Brush"**.
2. **Stamping with Brush (`ModulePlannerGrid.js`)**
   - Selecting a theme loads it into the active brush.
   - Clicking any week slot stamps that theme across the entire module (or row).
   - With **`🔁 Auto-Chain to W156`** checked, future cycles are automatically projected across the entire 3 years with Golden Rest turnaround (36–60 days).
3. **4-Row Top Pulse Strip**
   - Synchronized live summary atop the Gantt grid giving instant feedback on:
     - 📊 *Stocked Ponds & PL Demand*
     - 🌾 *Feed Needed (MT)*
     - 🦐 *Harvest Biomass (MT)*
     - 💰 *Estimated Revenue (RM)*
   - Supports 12 Monthly Boxes view or Week-by-Week slot view.

---

### D. Planning Table Interactions: Drag & Drop + 3 Deletion Methods

#### 1. Drag & Drop Stocking Reschedule
- Every cycle bar has HTML5 native drag-and-drop enabled (`draggable="true"`), with a visual `⋮⋮` grab handle and active grabbing state (`.sim-cycle-bar.is-dragging`).
- The user can click and drag any cycle bar horizontally to any starting week slot across the timeline.
- Drop targets (empty week cells and rest bars) illuminate with a dashed blue border (`.sim-drag-hover`).
- On drop, the cycle instantly snaps to start at the target week.
- If **`🔁 Auto-Chain to W156`** is enabled, all subsequent waves are automatically re-chained forward to Week 156.
- **Protection Guardrail:** Weeks 1 to 34 in 2026 are locked Actual YTD records and cannot be rescheduled or dropped before Week 35.

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
     - 🔁 *Clear From This Week Onwards (W35–W156)*
     - ✏️ *Tune Parameters in Modal (PondCycleModal)*

---

### E. Styling & CSS Architecture: Native Semantic CSS (No Tailwind)
- **Tailwind is NOT installed in `isharp-platform`.**
- Earlier prototype issues ("no pill, box, or table rendered") occurred because prototype templates contained Tailwind utility classes in a non-Tailwind codebase.
- **All styling is implemented as native semantic CSS in [`src/styles/components/simulation.css`](file:///c:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/isharp-platform/src/styles/components/simulation.css)**, adhering to the platform design tokens in [`tokens.css`](file:///c:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/isharp-platform/src/styles/tokens.css).
- **Why Tailwind is avoided:**
  1. Tailwind's default Preflight resets typography, tables, and form inputs across the **entire platform** (including DBMS tables, Field Ops PWA, Command OS, and Farm Map).
  2. 52-column and 156-column Gantt grids require explicit CSS Grid math (`repeat(52, minmax(0, 1fr))`) which native CSS handles much cleaner than utility classes.
  3. Native CSS compiles in **2.0 seconds** with zero external dependencies.

---

### F. The 5 Empirical Simulation Pillars (No Fake Recoveries)
During bad performance years, the engine strictly prevents unrealistically optimistic forecasts:
1. **Pillar 0 — Species & Strategy Partitioning:**
   - Strict separation between *Penaeus monodon* (Black Tiger) and *Litopenaeus vannamei* (Pacific Whiteleg).
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
   - 2X and 3X partial skims relieve biomass pressure, boosting total yield and EBITDA.
   - **Bayesian Active Pond Conditioning:** Ponds currently in culture with poor sampling history in `biometrics_sampling` stay conditioned to their low growth quantiles (`inferActivePondGrowthQuantile`).
6. **Pillar 5 — Econometric Splicing & 28-Chemical MRP:**
   - Electricity modeled strictly per active pond-day (~RM 95.40/day).
   - 28 pond preparation and culture chemicals itemized.
   - YTD Realized Actuals spliced with Rolling Forecast to compute Full-Year LE vs BP.

---

## 3. Five-Tab Master Structure

The simulation page (`#/simulation`) is organized into **5 core tabs**:

| Tab Key | Title | Excel Sheet | Component File | Description |
| :--- | :--- | :---: | :--- | :--- |
| **Tab 1** | `1. 🎨 Stocking Themes` | `'ass'` | [`StockingThemesTab.js`](file:///c:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/isharp-platform/src/modules/simulation/StockingThemesTab.js) | Configure density, duration, and target biomass for 10 culture strategies with 1-click active brush loading. |
| **Tab 2** | `2. 📅 Planning Schedule` | `'main'` | [`ModulePlannerGrid.js`](file:///c:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/isharp-platform/src/modules/simulation/ModulePlannerGrid.js) | Interactive Gantt grid across 11 modules (M01–M11) supporting 3 years ahead (156 weeks) or 1-year zero-scroll views, drag-and-drop rescheduling, 3-way deletion, and 4-row pulse strip. |
| **Tab 3** | `3. 📊 Monthly Production` | `'prt'` | [`MonthlyProductionTab.js`](file:///c:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/isharp-platform/src/modules/simulation/MonthlyProductionTab.js) | 12 monthly columns (Jan–Dec actual vs rolling) + Q1–Q4 roll-ups + Full-Year LE vs BP with species breakdown. |
| **Tab 4** | `4. 🏆 BOD KPI & Lines` | `'kpi.sum'`, `'kpi.gen'` | [`BODSummaryTable.js`](file:///c:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/isharp-platform/src/modules/simulation/BODSummaryTable.js) | Executive spliced financial table with 15 BOD KPIs, 16 OPEX elements, Genetic Lines breakdown, and A20–A25 multi-year benchmarks. |
| **Tab 5** | `5. 📦 Procurement MRP` | `'wek'`, `'mth'` | [`WeeklyRollingTable.js`](file:///c:/Users/syafiq/My%20Drive/Syafiq%20Water%20Quality%20Station%20Project/isharp-platform/src/modules/simulation/WeeklyRollingTable.js) | Detailed weekly and monthly material demand console for PLs, SAP Feed SKUs, 28 Chemicals/Fertilizers, and TNB power. |

---

## 4. File Manifest & Architecture Map

```
isharp-platform/
├── docs/
│   ├── SIMULATION_MASTER_PLAN.md        # Technical master spec & empirical equations
│   └── SIMULATION_UI_VISION_AND_SYNC.md # This document (UI vision, interactions, Excel alignment)
├── src/
│   ├── domain/simulation/               # Pure Domain Math & Simulation Engine
│   │   ├── baselineCalibrator.js        # Historical priors, species constants, genetic lines
│   │   ├── constraintScheduler.js       # Turnaround rules, auto-scheduler, 156-week optimizer
│   │   ├── financialCalculator.js       # Spliced financials, 15 BOD KPIs, 16 OPEX lines
│   │   ├── hazardAndGrowthModel.js      # Cox hazards, Bayesian quantiles, monsoon cliff
│   │   ├── simTickEngine.js             # 156-week deterministic simulation loop & Monte Carlo
│   │   └── index.js                     # Unified domain API exports
│   ├── state/
│   │   ├── simulationStore.js           # Reactive state container, debounced runner, auto-chain
│   │   └── simulationRepository.js      # Hybrid active pond seeder, Supabase sync, localStorage
│   ├── modules/simulation/              # Phase 5 UI Components
│   │   ├── SimulationPage.js            # Master view orchestrator, header deck, year switcher
│   │   ├── SimulationSummaryCards.js    # Spliced Hero Scoreboard (FY 2026 first) + Monte Carlo pill
│   │   ├── ModulePlannerGrid.js         # Interactive Gantt grid (drag-drop, 3-way delete, pulse strip)
│   │   ├── StockingThemesTab.js         # Tab 1: Themes palette & active brush loader
│   │   ├── MonthlyProductionTab.js      # Tab 3: Monthly PRT table with quarterly roll-ups
│   │   ├── BODSummaryTable.js           # Tab 4: Executive spliced P&L and genetic lines
│   │   ├── WeeklyRollingTable.js        # Tab 5: Weekly/monthly procurement MRP console
│   │   ├── DisruptionTimelineRibbon.js  # Macro shock ribbon atop Gantt grid
│   │   └── modals/
│   │       ├── PondCycleModal.js        # Individual pond cycle parameter tuner
│   │       ├── ShockModal.js            # Macro & climate disruption injector
│   │       └── ScenarioModal.js         # Local scenario snapshot manager
│   └── styles/components/
│       └── simulation.css               # Full semantic CSS for all simulation components
└── tests/
    ├── simulation.test.js               # Domain math & empirical pillars tests
    ├── simulationStore.test.js          # Reactive state & debounce tests
    └── simulationUI.test.js             # UI component rendering, drag-drop, delete, & tab tests
```

---

## 5. Current Test & Build Verification Status

- **Unit Test Suite:** `node --test tests/*.test.js` runs all 162 tests across 19 test suites via the Node.js native test runner.
  - `Phase 3 Frontier Simulation Engine`: 16 tests passing across Pillars 0–5, 156-week optimizer, and Monte Carlo.
  - `Phase 4 Simulation Store & Repository`: 4 tests passing (reactive state, actions, debounced simulation, scenario storage).
  - `Phase 5 Simulation UI Components`: 9 suites (Executive Summary Cards, Disruption Shock Ribbon, 156-Week Gantt with 15-Month Runway, Drag-Drop/Delete, MRP Table, BOD Summary Table, Modals, Stocking Themes, Monthly Production Roll-Up) passing.
  - Platform-wide tests (Staff, Water Quality SSOT, Water Quality History Modal, Offline Queue, Security, PWA): all passing.
  - **Result:** `ℹ tests 162 | suites 19 | pass 162 | fail 0 | cancelled 0`.
- **Production Build:** `node ./node_modules/vite/bin/vite.js build` compiles clean production bundle in **~3.3 seconds** via Vite v5.4.
- **Local Dev Server:** Active on `http://localhost:5173/#/simulation`.

---

## 6. Next Steps for Subsequent Conversations (Phase 6 & 7)

When starting the next conversation, the foundations of Phase 5 are 100% complete. The immediate roadmap consists of:
1. **Phase 6: 1:1 Excel Replacement Workbook (.xlsx Export)**
   - Wire the top **`📥 Export Excel (.xlsx)`** button to generate a downloadable Excel workbook containing all 5 tabs matching `RPvf, iSharp.xlsx`:
     - Sheet 1: `ass` (Stocking Themes)
     - Sheet 2: `main` (156-Week Pond Schedule)
     - Sheet 3: `prt` (Monthly Production Roll-Up)
     - Sheet 4: `kpi.sum` (BOD Spliced Financials)
     - Sheet 5: `wek` / `mth` (Procurement MRP)
   - Utilize `exceljs` for formatting, formulas, and frozen header rows.
2. **Phase 7: Live Farm Management Validation**
   - Review the live Gantt interactions and 2026 LE numbers with farm leadership to ensure exact alignment with weekly operational habits.
