# 🦐 iSHARP Aquaculture Platform — Enterprise Farm Intelligence

> High-performance, anti-spaghetti enterprise aquaculture platform built for Blue Archipelago Berhad (SETiU Farm). Integrates macro farm telemetry, field worker mobile logs, executive intelligence, and operational cycle DBMS.

---

## 🌟 Architecture Overview

The platform is designed around a single-page application (SPA) model featuring **5 primary views** coordinated via `ViewRouter`:

```
                           ┌───────────────────────────────┐
                           │      Portal Gateway (#/)      │
                           │   Orbital Frutiger Aero Hub   │
                           └───────────────┬───────────────┘
                                           │
         ┌───────────────────┬─────────────┴───────┬───────────────────┐
         │                   │                     │                   │
         ▼                   ▼                     ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────┐ ┌─────────────────┐
│ Executive View  │ │ Simulation Twin │ │   Field Ops View    │ │   DBMS 2.0 OS   │
│ (#/executive)   │ │ (#/simulation)  │ │   (#/field-ops)     │ │    (#/dbms)     │
│ 216-Pond Map    │ │ 3-Year MRP Twin │ │  Mobile Smartphone  │ │ 10 Workstreams  │
│ Farm Biomass    │ │ 156-Week Gantt  │ │  Wet-Finger UI      │ │ Cycle Rollover  │
└─────────────────┘ └─────────────────┘ └─────────────────────┘ └─────────────────┘
```

1. **Portal Gateway (`#/`)**: Central orbital constellation connecting all farm systems.
2. **Executive Intelligence (`#/executive`)**: Macro farm overview with interactive 216-pond spatial matrix, farm-wide biomass projection, and harvesting schedules.
3. **Frontier Simulation Engine (`#/simulation`)**: 3-year (156-week) empirical predictive digital twin, stocking Gantt planner, 16-cost accounting ledger, and rolling MRP procurement console.
4. **Field Operations (`#/field-ops`)**: Dedicated mobile web application designed for smartphones and rugged tablets used by field row leaders in wet, outdoor environments.
5. **Operational DBMS 2.0 (`#/dbms`)**: Full-featured command desktop interface with 10 operational modules, spatial pond tree navigation, and cycle rollover lifecycle management.

---

## 🏗️ Clean Modular Code Structure

The platform strictly adheres to an inward-dependency layered architecture:

```
src/
├── domain/                      # 🧪 Pure Business Logic (Zero dependencies, 100% testable)
│   ├── aeration.js              # Active HP (1.0 & 2.0 HP) & aeration density (HP/Ha)
│   ├── biometrics.js            # DOC, ABW, ADG, biomass gain calculations
│   ├── feeding.js               # Cumulative FCR & feed conversion math
│   ├── feedingAction.js         # Tray remnant rules & feeding adjustment logic
│   ├── offlineQueue.js          # Pure offline queue state machine (idempotent mutations)
│   ├── rollover.js              # Cycle parsing, label sanitization, close states
│   ├── waterQualityLimit.js     # Single Source of Truth for farm water quality limits
│   └── simulation/              # 🔮 3-Year Empirical Predictive Digital Twin & MRP Engine
│       ├── baselineCalibrator.js    # Historical empirical priors & species baselines
│       ├── hazardAndGrowthModel.js  # Cox hazards, Bayesian quantiles & monsoon cliff
│       ├── constraintScheduler.js   # 156-week optimizer & turnaround fatigue rules
│       ├── financialCalculator.js   # 16-cost ledger, spliced LE vs BP & 4-tier pricing
│       └── simTickEngine.js         # Weekly simulation loop, 28-chemical MRP & Monte Carlo
│
├── infrastructure/              # 🌐 Database & Cloud Communication
│   ├── supabase.js              # Authenticated Supabase PostgreSQL client
│   ├── offlineQueueStore.js     # IndexedDB persistence for offline mutations
│   └── repositories/            # Data-access repositories (zero raw SQL in UI)
│       ├── dailyRecordRepository.js
│       ├── feedRepository.js
│       ├── harvestRepository.js
│       ├── labRepository.js             # Lab Water Quality & Mineral Balance (public.lab_water_quality)
│       ├── pondRepository.js
│       ├── samplingRepository.js
│       ├── staffRepository.js
│       ├── weatherRepository.js
│       └── simulationRepository.js      # Active pond seeder, finance batch join & scenario store
│
├── state/                       # ⚡ Central Reactive State Stores
│   ├── appState.js              # Active pond, cycle, role, and tab coordination
│   ├── filterStore.js           # Spatial farm filters (Module, Status, Active/Archived)
│   └── simulationStore.js       # Reactive simulation state, auto-chaining & Monte Carlo runner
│
├── config/                      # 🛡️ Contracts & Configurations
│   ├── domContracts.js          # Centralized DOM element ID contracts & validators
│   ├── permissions.js           # Role-Based Access Control (RBAC) definitions
│   ├── security.js              # Password authentication & Supabase credential cache
│   └── env.js                   # Supabase environment variables & credentials
│
├── components/                  # 🧩 Reusable UI Components
│   ├── Navbar.js                # Top command bar, spotlight search, steppers
│   ├── MasterBanner.js          # Top telemetry pills and status badges
│   ├── PondTreeNav.js           # Collapsible Module 01-11 spatial tree explorer
│   ├── ExecutiveFilterBar.js    # Quick farm-level filter pills
│   └── Toast.js                 # Non-blocking glassmorphism notifications
│
├── features/                    # 📋 Specialized Feature Modules
│   └── excelImporter/
│       └── excelModal.js        # Universal clipboard parser & cloud commit assistant
│
├── modules/                     # 🖥️ Top-Level View Controllers
│   ├── landing/landingPage.js   # Orbital portal view
│   ├── executive/               # Executive 216-pond grid & biomass forecast
│   ├── fieldOps/                # Mobile Field Ops cards, quick stepper inputs
│   ├── simulation/              # 🔮 3-Year Simulation Engine & Gantt Console (5 Tabs)
│   │   ├── SimulationPage.js            # Orchestrator & FY year switcher
│   │   ├── SimulationSummaryCards.js    # Spliced Hero Scoreboard & Monte Carlo pill
│   │   ├── ModulePlannerGrid.js         # 156-Week Gantt, drag-and-drop & pulse strip
│   │   ├── StockingThemesTab.js         # Tab 1: Themes & 1-click brush palette
│   │   ├── MonthlyProductionTab.js      # Tab 3: Monthly production PRT roll-up
│   │   ├── BODSummaryTable.js           # Tab 4: 15 BOD KPIs & 16-cost ledger
│   │   ├── WeeklyRollingTable.js        # Tab 5: Procurement MRP (PL, Feed, Chems)
│   │   └── DisruptionTimelineRibbon.js  # Macro shock timeline ribbon
│   └── dbms/                    # DBMS 2.0 Workstream Tab Controllers
│       ├── masterTab.js         # Tab 1: Master Cycle & Prep Milestones
│       ├── laboratoryTab.js     # Tab 2: Biosecurity & Disease Pathology
│       ├── stockingTab.js       # Tab 3: PL Hatchery & Multi-batch Stocking
│       ├── feedingTab.js        # Tab 4: Dual Tables (Supervisor Field Journal & Official SAP Ledger)
│       ├── samplingTab.js       # Tab 5: Weekly Biometrics & Sensors
│       ├── performanceTab.js    # Tab 6: Growth Curves & Efficiency KPIs
│       ├── harvestTab.js        # Tab 7: Harvest Plan Targets, Harvest Events & Buyer Sales
│       ├── lifecycleTab.js      # Tab 8: Cycle Termination, Rollover & Revive
│       ├── staffTab.js          # Tab 9: Staff Crew Allocation & Notes
│       ├── utilitiesTab.js      # Tab 10: CSV Exporter & System Diagnostics
│       ├── dbmsView.js          # DBMS Root View Orchestrator
│       └── templates/           # 📄 Modular Tab HTML Templates (Zero monolithic HTML)
│
├── routing/                     # 🧭 Hash-Based SPA Router
│   └── viewRouter.js            # URL Hash navigation (#/, #/executive, #/simulation, #/field-ops, #/dbms)
│
└── styles/                      # 🎨 Frutiger Aero Design System
    ├── tokens.css               # Design variables (aero-sky, gradients, glass, fonts)
    ├── base.css                 # Reset, typography, accessibility base
    ├── utilities.css            # Master utility classes (flex, spacing, status text, chart canvas)
    ├── components.css           # Glass buttons, inputs, pills, datatables (orchestrator)
    ├── components/
    │   └── simulation.css       # Full semantic CSS for 156-week simulation & Gantt
    ├── command-os.css           # Concept A layout, sidebar, top bar, bento cards
    ├── field-ops-mobile.css     # Mobile viewport, large steppers, 3D water swatches (orchestrator)
    └── landing.css              # Orbital hub, floating bubbles, glowing satellites

docs/
├── SIMULATION_MASTER_PLAN.md        # Master architecture, empirical math & progress tracker
├── SIMULATION_UI_VISION_AND_SYNC.md # UI/UX architecture, Excel alignment & synced briefing
├── specs/                           # 📋 Architectural & Functional Specifications
│   ├── FIELD_OPERATIONS_SPEC.md     # Mobile Field Ops specification & changelog
│   ├── EXECUTIVE_PORTAL_SPEC.md     # Executive Dashboard & 216-pond spatial grid
│   └── EXECUTIVE_BIOMASS_INTELLIGENCE_SPEC.md # Biomass intelligence & forward forecasting
└── reports/                         # 📊 Benchmarks & Audits
    └── CONCURRENCY_REPORT.md        # 15-user concurrency & live Supabase audit report
```

---

## 🛡️ Anti-Spaghetti Guidelines for Developers

To maintain high code quality and make future modifications seamless for any human developer:

1. **Centralized DOM Contracts (`src/config/domContracts.js`)**:
   - Never use "magic string" IDs in `document.getElementById("my-id")`.
   - Always reference `DOM_IDS.<GROUP>.<KEY>`.
   - Every controller constructor calls `validateContract(name, DOM_IDS.<GROUP>)` to catch missing elements instantly.

2. **Clean HTML Shell (`index.html`)**:
   - `index.html` is strictly a ~35 line container shell with view mount points (`#view-portal`, `#view-executive`, `#view-field-ops`, `#view-dbms`).
   - If you want to modify a tab's HTML layout, edit the respective file in `src/modules/dbms/templates/` (e.g. `staffTabTemplate.js`).

3. **Inward Dependency Rule**:
   - Domain logic (`src/domain/`) must **never** import UI or infrastructure modules.
   - Sibling tabs (e.g., `samplingTab.js` and `feedingTab.js`) must **never** directly import each other; coordinate state transitions through `appState`.

4. **Staff & Remarks Layout Rule**:
   - `#tab-staff` strictly maintains a **single vertical column** (`flex-direction: column; width: 100%;`) for both the *Assigned Pond Personnel* card and the *Operational Logbook & Remarks* card.

---


---

## 🔒 Security Architecture & Access Control

The platform enforces defense-in-depth across frontend and cloud database layers:

1. **Zero-Plaintext Frontend Bundle:**
   - Client passwords are never bundled in source code or production JS distributions.
   - Offline authentication uses one-way salted SHA-256 digests (`OFFLINE_HASHES`) evaluated via the browser's native Web Crypto API.
2. **Server-Side RPC Authentication (`pgcrypto`):**
   - Cloud passwords in `public.app_passwords` and `public.module_passwords` are stored as bcrypt hashes using PostgreSQL's `pgcrypto` extension.
   - Verified via `SECURITY DEFINER` stored procedures `fn_verify_dbms_passcode` and `fn_verify_field_ops_passcode`.
3. **Header-Based Row Level Security (RLS):**
   - All REST requests from authenticated sessions attach the verified passcode via the `x-isharp-passcode` HTTP header.
   - PostgreSQL RLS helper functions `fn_can_write_dbms()` and `fn_can_write_field_ops()` inspect request headers to authorize `INSERT`, `UPDATE`, and `DELETE` operations across 20+ operational tables.
   - Public `SELECT` is preserved across telemetry tables to enable instant, friction-free dashboard rendering.
   - Sensitive financial tables (`growout_pond_finance`) strictly restrict both `SELECT` and write operations to authenticated DBMS sessions.
4. **DOM XSS Sanitization & CSV Formula Defense:**
   - All user-entered remarks and dynamic strings are HTML-escaped via `escapeHtml()` prior to DOM rendering.
   - CSV export operations neutralize formula injection characters (`=`, `+`, `-`, `@`, `\t`, `\r`) by prefixing cell values with a single quote (`'`).
5. **Modern HTTP Security Headers:**
   - Production edge deploys enforce HSTS, strict CSP, and restrictive Permissions-Policy via Netlify headers.

## 🧪 Testing & Verification

The project includes an automated test suite utilizing Node.js native test runner and live Supabase REST probes:

```bash
# Run domain calculation, UI contract, and simulation unit tests (190 tests across 19 suites)
npm test

# Run comprehensive data entry schema audit probe (18 form buttons & automatic rollback)
npm run test:audit

# Run permanent live REST client probe against Supabase (19 operations)
npm run test:e2e

# Run 15-user concurrency stress test against Supabase
npm run test:stress

# Run sequential pond management stress test
npm run test:stress:management

# Run production build
npm run build
```

---

## 🚀 Running Locally

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open browser at http://localhost:5173
```
