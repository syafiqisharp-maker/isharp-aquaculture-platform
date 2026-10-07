# 🦐 iSHARP Aquaculture Platform — Enterprise Farm Intelligence

> High-performance, anti-spaghetti enterprise aquaculture platform built for Blue Archipelago Berhad (SETiU Farm). Integrates macro farm telemetry, field worker mobile logs, executive intelligence, and operational cycle DBMS.

---

## 🌟 Architecture Overview

The platform is designed around a single-page application (SPA) model featuring **4 primary views** coordinated via `ViewRouter`:

```
                           ┌───────────────────────────────┐
                           │      Portal Gateway (#/)      │
                           │   Orbital Frutiger Aero Hub   │
                           └───────────────┬───────────────┘
                                           │
         ┌─────────────────────────────────┼─────────────────────────────────┐
         │                                 │                                 │
         ▼                                 ▼                                 ▼
┌─────────────────┐             ┌─────────────────────┐             ┌─────────────────┐
│ Executive View  │             │   Field Ops View    │             │   DBMS 2.0 OS   │
│ (#/executive)   │             │   (#/field-ops)     │             │    (#/dbms)     │
│ 216-Pond Map    │             │  Mobile Smartphone  │             │ 10 Workstreams  │
│ Farm Biomass    │             │  Wet-Finger UI      │             │ Cycle Rollover  │
└─────────────────┘             └─────────────────────┘             └─────────────────┘
```

1. **Portal Gateway (`#/`)**: Central orbital constellation connecting all farm systems.
2. **Executive Intelligence (`#/executive`)**: Macro farm overview with interactive 216-pond spatial matrix, farm-wide biomass projection, and harvesting schedules.
3. **Field Operations (`#/field-ops`)**: Dedicated mobile web application designed for smartphones and rugged tablets used by field row leaders in wet, outdoor environments.
4. **Operational DBMS 2.0 (`#/dbms`)**: Full-featured command desktop interface with 10 operational modules, spatial pond tree navigation, and cycle rollover lifecycle management.

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
│   └── rollover.js              # Cycle parsing, label sanitization, close states
│
├── infrastructure/              # 🌐 Database & Cloud Communication
│   ├── supabase.js              # Authenticated Supabase PostgreSQL client
│   └── repositories/            # Data-access repositories (zero raw SQL in UI)
│       ├── dailyRecordRepository.js
│       ├── feedRepository.js
│       ├── harvestRepository.js
│       ├── labRepository.js             # Lab Water Quality & Mineral Balance (public.lab_water_quality)
│       ├── pondRepository.js
│       ├── samplingRepository.js
│       ├── staffRepository.js
│       └── weatherRepository.js
│
├── state/                       # ⚡ Central Reactive State Stores
│   ├── appState.js              # Active pond, cycle, role, and tab coordination
│   └── filterStore.js           # Spatial farm filters (Module, Status, Active/Archived)
│
├── config/                      # 🛡️ Contracts & Configurations
│   ├── domContracts.js          # Centralized DOM element ID contracts & validators
│   ├── permissions.js           # Role-Based Access Control (RBAC) definitions
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
│   └── dbms/                    # DBMS 2.0 Workstream Tab Controllers
│       ├── masterTab.js         # Tab 1: Master Cycle & Prep Milestones
│       ├── laboratoryTab.js     # Tab 2: Biosecurity & Disease Pathology
│       ├── stockingTab.js       # Tab 3: PL Hatchery & Multi-batch Stocking
│       ├── feedingTab.js        # Tab 4: Daily Feeding Journal & Trays
│       ├── samplingTab.js       # Tab 5: Weekly Biometrics & Sensors
│       ├── performanceTab.js    # Tab 6: Growth Curves & Efficiency KPIs
│       ├── harvestTab.js        # Tab 7: Commercial Buyer Sales & Packout
│       ├── lifecycleTab.js      # Tab 8: Cycle Termination, Rollover & Revive
│       ├── staffTab.js          # Tab 9: Staff Crew Allocation & Notes
│       ├── utilitiesTab.js      # Tab 10: CSV Exporter & System Diagnostics
│       ├── dbmsView.js          # DBMS Root View Orchestrator
│       └── templates/           # 📄 Modular Tab HTML Templates (Zero monolithic HTML)
│           ├── dbmsShellTemplate.js
│           ├── masterTabTemplate.js
│           ├── laboratoryTabTemplate.js
│           ├── stockingTabTemplate.js
│           ├── feedingTabTemplate.js
│           ├── samplingTabTemplate.js
│           ├── performanceTabTemplate.js
│           ├── harvestTabTemplate.js
│           ├── lifecycleTabTemplate.js
│           ├── staffTabTemplate.js
│           ├── utilitiesTabTemplate.js
│           └── modalsTemplate.js
│
├── routing/                     # 🧭 Hash-Based SPA Router
│   └── viewRouter.js            # URL Hash navigation (#/, #/executive, #/field-ops, #/dbms)
│
└── styles/                      # 🎨 Frutiger Aero Design System
    ├── tokens.css               # Design variables (aero-sky, gradients, glass, fonts)
    ├── base.css                 # Reset, typography, accessibility base
    ├── components.css           # Glass buttons, inputs, pills, datatables
    ├── command-os.css           # Concept A layout, sidebar, top bar, bento cards
    ├── field-ops-mobile.css     # Mobile viewport, large steppers, 3D water swatches
    └── landing.css              # Orbital hub, floating bubbles, glowing satellites
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

## 🧪 Testing & Verification

The project includes an automated test suite utilizing Node.js native test runner (zero external testing dependencies):

```bash
# Run domain calculation unit tests
npm test

# Run 15-user concurrency stress test against Supabase
npm run test:stress

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
