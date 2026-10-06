# iSHARP DBMS 2.0 — Architectural Guardrails & Coding Standards

This document establishes the architectural standards for iSHARP DBMS 2.0. Any developer, AI agent, or collaborator working on this codebase MUST adhere strictly to these principles to prevent code degradation, avoid "vibe-coding" regressions, and maintain long-term reliability.

---

## 1. Core Architectural Layers & Inward Dependency Rule

Code is organized into 5 strict layers. Dependencies can only flow downward/inward:

```
UI Modules (src/modules/) & Components (src/components/)
               │
               ▼
   Reactive State (src/state/)
               │
               ▼
Infrastructure & Repositories (src/infrastructure/)
               │
               ▼
 Domain Logic (src/domain/) [Zero Dependencies, Pure Functions]
```

- **Domain Layer (`src/domain/`):**
  - Contains all aquaculture math (DOC, ADG, Biomass, FCR, Aerator HP calculation, Cycle Rollover state transitions).
  - **Rule:** Pure functions only. ZERO imports from `src/components/`, ZERO direct `fetch()` calls, ZERO DOM references (`document.getElementById`).
  - Must be 100% testable in isolation.

- **Infrastructure Layer (`src/infrastructure/`):**
  - Manages Supabase REST communication and data mapping.
  - **Rule:** UI components must NEVER write raw SQL, REST queries, or Supabase fetch calls directly. They must always call a repository method (e.g. `PondRepository.getActiveCycles()`).

- **State Layer (`src/state/`):**
  - Central reactive pub/sub stores (`appState.js`, `filterStore.js`).
  - Coordinates active pond selection, filters, and user session across all tabs without coupling tabs together.

- **Feature Modules (`src/modules/`):**
  - Each tab has its own self-contained directory (e.g., `master/`, `sampling/`, `feeding/`).
  - **Rule:** Sibling modules must NEVER import from each other directly (e.g., `sampling/` cannot import `feeding/`). Communication happens via `appState.js` events.

---

## 2. Pragmatic Single-Responsibility Rule

- **One file, one logical responsibility.**
- Avoid creating "God Files" that combine networking, business logic, and UI rendering into a single class.
- When a file grows because it is doing multiple different jobs, split those responsibilities across the appropriate layers.
- Do not artificially fragment code that naturally belongs together into dozens of tiny files.

---

## 3. Role-Based Access Control (RBAC) Gating

Every modification action must respect user roles defined in `src/config/permissions.js`:

1. **`ROLE_PLANNER` (Full Edit Power):**
   - Can create new cycles, change cycle start dates, trigger cycle rollovers, adjust master stocking numbers, and archive ponds.
2. **`ROLE_SUPERVISOR` / `ROLE_MANAGER` (Inventory & Operations):**
   - Can update PWA / aerator units, log feed tray counts, record equipment inventory, and add field notes.
   - Master cycle configuration and rollover actions are locked/disabled.
3. **`ROLE_LAB_TECH` (Laboratory Only):**
   - Can edit water quality telemetry logs and PCR pathogen data.
   - All other tabs are read-only.
4. **`ROLE_VIEWER` (Read-Only):**
   - Can view data, filter ponds, and review analytics. All save/edit buttons are hidden or disabled.

---

## 4. Excel Import & Clipboard Guidelines

- All spreadsheet pasting (Sampling, Feeding, Harvest) must flow through `src/features/excelImporter/`.
- Must provide clear visual column guides to users before pasting.
- Must provide a "Copy Excel Template" one-click action.
- Data must be validated cell-by-cell with real-time green/red visual previews before committing to Supabase.

---

## 5. Single Source of Truth & Database Query Standards

- **Unified Views for Cycles:** When querying culture cycles, stocking dates (`stck_date`), species, or breeding lines, always query `view_growout_pond_cycles`. Do not query `stck_date` on the raw table `growout_pond_master`, as multi-batch stocking is normalized in `pond_stocking_batches`.
- **Personnel Directory & Assignment:**
  - `pond_staff` is the master directory containing personnel identity (`staff_no`, `staff_name`, `staff_position`, `is_active`).
  - Cycle assignments (`pm_staff_no`, `sv_staff_no`, `rl_staff_no`, `po_staff_no`, `support_staff_no`) are stored strictly on `growout_pond_master`.
- **Hardware & Field Inventory:**
  - Feeding trays, autofeeders, hut condition, and supervisor field remarks are stored strictly on `pond_inventories` keyed by `pond_index`.

---

## 6. Paddlewheel Standard (1.0 HP & 2.0 HP Only)

- On this farm, **only 1.0 HP and 2.0 HP paddlewheels exist**.
- There is **no such thing as 4.0 HP units**. Any 4.0 HP inputs or calculations are strictly prohibited.
- Total Active HP formula:
  $$\text{Total Active HP} = (1.0 \times \text{aerator\_1hp}) + (2.0 \times \text{aerator\_2hp})$$

---

## 7. Field Operations & Zero-Fake-Telemetry Policy

- **Never fabricate or simulate sensor telemetry**: If an IoT device is not installed or offline, never invent random DO, pH, or water temperature values.
- Instead, render clean, professional placeholder cards indicating:
  `📡 IoT Node Offline — Awaiting Sensor Deployment (DO: -- | pH: -- | T: --)`
- Use live `weather_logs` for meteorological mast telemetry (Solar Lux, Rainfall, Air Temp, Humidity, Pressure).
- Biometrics sampling queries must always order by `smpl_doc.desc` so the latest sampling record is resolved first.

---

## 8. Daily Mortality Standard (Kilograms / kg Only)

- On this farm, **mortality is estimated and recorded in kilograms (kg), never pieces (pcs)**.
- Dead shrimp are scooped from feeding trays or pond perimeters and weighed as biomass.
- **Database Schema**:
  - `public.daily_pond_records.mortality_kg` is type `numeric(8,2) DEFAULT 0.0`.
  - For backward compatibility with legacy tools, `mortality_count` is kept synchronized as `Math.round(mortality_kg)`.
- **Form Inputs & Displays**:
  - All input fields must specify `step="0.1"` and `min="0"`.
  - Display values must format to 1 decimal place (e.g. `2.5 kg`).

---

## 9. Mobile-First Standard for Field Operations

- The **Field Operations module (`#view-field-ops`)** is strictly dedicated to field workers, row leaders, and supervisors on smartphones and rugged outdoor tablets.
- **Executive Dashboard** and **iSHARP DBMS** remain desktop-only views.
- **Ergonomics Rules**:
  - Minimum touch target size: 44px (`min-height: 44px; touch-action: manipulation;`).
  - Active touch feedback: `transform: scale(0.97)` on active press.
  - iOS auto-zoom prevention: Input font sizes must be $\ge 16\text{px}$.
  - Zero horizontal jitter & strict card containment: Root container enforces `overflow-x: hidden; max-width: 100vw;`. Multi-column form grids on mobile must use `grid-template-columns: minmax(0, 1fr)` with `min-width: 0; max-width: 100%; box-sizing: border-box;` on children so stepper rows and chip grids never overflow their card border.
  - Wet-finger ergonomics: Provide large `+` / `−` stepper buttons and 1-tap preset chips alongside numeric inputs, and suppress automatic virtual keyboard popups on mobile (`window.innerWidth <= 768`).
  - Responsive button labels: Use `.btn-text-full` (desktop) and `.btn-text-short` (mobile) for navigation buttons so headers never wrap awkwardly on narrow phone viewports.
  - Desktop tables with >6 columns must be hidden on mobile (`.hide-mobile`) and replaced with high-contrast timeline cards (`.show-mobile`).

---

## 10. Timezone-Safe Local Date & Water Colour Swatch Standards

- **Never use `new Date().toISOString().split('T')[0]` for local farm dates**:
  - In Malaysia (`UTC+8`), `toISOString()` converts to UTC and shifts the calendar date back by 1 day between `00:00` and `07:59` local time, causing the `TODAY` badge and DOC calculations to lag by one day.
  - Always construct and parse `YYYY-MM-DD` strings using local calendar components (`getFullYear()`, `getMonth() + 1`, `getDate()`).
- **Observed Water Colour Swatches (True 3D CSS Orbs + Simple Names)**:
  - Never use generic Unicode emojis (`🟢`, `🟤`, `⚪`) to represent multiple distinct water colours.
  - Always render custom `.water-swatch-orb` radial-gradient spheres paired with the 8 standardized simple names: **`Lt Green`**, **`Green`**, **`Dk Green`**, **`Brn Green`**, **`Tea`**, **`Brown`**, **`Clear`**, and **`Turbid`**.

---

## 11. Centralized DOM Contracts & Zero Magic String Policy

- **All DOM element IDs must be registered in `src/config/domContracts.js`**:
  - Never hardcode element ID strings like `document.getElementById("btn-submit-create-cycle")` directly inside controllers or components.
  - Query elements via `DOM_IDS.<GROUP>.<ELEMENT_KEY>` (e.g., `document.getElementById(DOM_IDS.LIFECYCLE.BTN_SUBMIT_CREATE_CYCLE)`).
- **Mandatory Contract Validation**:
  - Every component or controller constructor MUST call `validateContract(ComponentName, DOM_IDS.<GROUP>)` upon instantiation.
  - If any expected DOM element is missing from the document, `validateContract()` prints an actionable warning into the console with the missing ID and group.

---

## 12. Modular Tab Template Architecture

- **`index.html` must remain a lightweight shell (<50 lines)**:
  - Do NOT embed massive HTML markup or inline forms directly inside `index.html`.
  - All 10 DBMS tab interfaces reside in isolated template modules under `src/modules/dbms/templates/`:
    1. `masterTabTemplate.js`
    2. `laboratoryTabTemplate.js`
    3. `stockingTabTemplate.js`
    4. `feedingTabTemplate.js`
    5. `samplingTabTemplate.js`
    6. `performanceTabTemplate.js`
    7. `harvestTabTemplate.js`
    8. `lifecycleTabTemplate.js`
    9. `staffTabTemplate.js`
    10. `utilitiesTabTemplate.js`
    11. `modalsTemplate.js` (Excel paste, Terminate, Revive modals)
    12. `dbmsShellTemplate.js` (Root command OS shell)
- **Extending or Modifying Tabs**:
  - Human developers modifying tab UI layout should edit only the specific tab template file. Controllers bind to elements using `DOM_IDS`.

---

## 13. Automated Domain Unit Testing Standard

- **Zero Regression on Aquaculture Math**:
  - All pure domain functions in `src/domain/` (`biometrics.js`, `aeration.js`, `feeding.js`, `rollover.js`) must be accompanied by unit tests in `tests/domain.test.js`.
  - Use Node.js native test runner (`node --test tests/*.test.js` or `npm test`).
  - No external test frameworks (Jest, Mocha, Vitest) are permitted for domain unit testing to prevent dependency bloat.
  - Tests must cover edge cases: zero division, leap years, negative biomass gain, empty cycle strings, and inactive status flags.

---

## 14. Staff Allocation & Remarks Layout Standard

- **Single-Column Grid Containment**:
  - On `#tab-staff`, the **Assigned Pond Personnel** card and the **Operational Logbook & Remarks** card must stack in a **single vertical column** (`flex-direction: column; width: 100%;`).
  - Do NOT wrap these two cards into a horizontal two-column split, ensuring personnel ID entry and logbook entries have maximum horizontal breathing room for readability.

---

## 15. Aquaculture Biometrics: Partial Harvest, FCR & Survival Rate (SR) Standard

- **Partial Harvest Reality (Thinning Runs)**:
  - During shrimp grow-out, farms often perform intermediate partial harvests (thinning) to lower pond density while culture continues.
  - Partial harvest records in `pond_harvest_daily` have `harv_status` containing `"PARTIAL"`.
  - **Critical Rule**: A partial harvest record must **NEVER** be treated as the total harvest of a pond! Doing so divides total cumulative feed by only the partial harvest weight, resulting in an artificially inflated, erroneous FCR (e.g. 5.69 instead of 1.48).

- **True FCR Calculation Rules**:
  1. **Active Pond with Partial Harvest**:
     - Supervisors estimate current standing biomass weekly via biometrics sampling (`smpl_bms`).
     - If a pond has partial harvest runs logged, the true total biomass produced to date is:
       $$\text{Total Biomass Produced} = \text{Current Standing Biomass} + \sum \text{Partial Harvest Weight(s)}$$
       $$\text{True FCR} = \frac{\text{Total Feed (kg)}}{\text{Current Standing Biomass (kg)} + \text{Partial Harvest Weight (kg)}}$$
  2. **Active Pond without Partial Harvest**:
     - If no partial harvest exists for the pond, partial harvest amount is **0 kg**.
       $$\text{FCR} = \frac{\text{Total Feed (kg)}}{\text{Current Standing Biomass (kg)}}$$
  3. **Closed / Terminated Pond (Finished Cycle)**:
     - When a pond cycle is closed or has a termination harvest (`TERMINATION`, `FINAL`, `CLEAN`), the complete harvest is finalized:
       $$\text{Final Harvest Biomass} = \sum \text{Partial Harvest(s)} + \text{Final Termination Harvest}$$
       $$\text{Final FCR} = \frac{\text{Total Feed (kg)}}{\text{Final Harvest Biomass (kg)}}$$

- **Future Survival Rate (SR) Calculation Standard**:
  - When calculating Survival Rate (SR) for an active or partially harvested pond, **always** include partial harvest pieces:
    $$\text{Total Shrimp Count Produced} = \text{Current Estimated Standing Count} + \sum \text{Partial Harvest Pieces}$$
    $$\text{SR (\%)} = \left(\frac{\text{Current Count} + \text{Partial Harvest Pieces}}{\text{Initial Stocked Pieces}}\right) \times 100$$
  - Never evaluate SR on an active pond without adding the pieces that were already harvested!


