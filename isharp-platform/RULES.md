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

---

## 16. Single Source of Truth (SSOT) for Water Quality Parameters (`waterQualityLimit.js`)

- **Centralized Parameter Limits**:
  - All water quality evaluations, alert pill triggers, feeding action thresholds, and modal target strings MUST import from `src/domain/waterQualityLimit.js`. Never write ad-hoc inline comparison thresholds in UI views.
- **Farm Threshold Reference**:
  - **Dissolved Oxygen (DO)**: Optimal `> 4.0 ppm` (green); Caution `3.0 – 4.0 ppm` (amber); Danger `< 3.0 ppm` (red hypoxia alert, triggers 50% feed cut).
  - **pH Diurnal Swing**: Safe `≤ 1.0 Δ/day`; Warning `> 1.0 Δ/day`; Severe `≥ 1.5 Δ/day` (triggers critical feed cut).
  - **Salinity**: Optimal `15.0 – 35.0 ppt`; Warning `10.0 – 14.9 ppt` and `35.1 – 37.9 ppt`; Danger `< 10.0 ppt` and `≥ 38.0 ppt`.
  - **Ammonia ($NH_3$)**: Optimal `< 1.0 mg/L` (normal, hidden from card); Warning `1.0 – 1.99 mg/L` (amber badge); Danger `≥ 2.0 mg/L` (red alert badge).
  - **Nitrite ($NO_2^-$)**: Optimal `≤ 0.50 mg/L`; Warning `0.51 – 1.00 mg/L`; Danger `> 1.00 mg/L`.
  - **Alkalinity**: Optimal `100 – 160 mg/L`; Warning `80–99` and `161–180 mg/L`; Danger `< 80` or `> 180 mg/L`.
- **Card Pill Visibility Rule**:
  - On the 24-Pond Overview Map, water quality parameters within optimal limits must remain hidden to reduce visual noise. Only parameters that are outside optimal limits appear as high-contrast warning/alert pills.

---

## 17. Quick Log Form & REST Wildcard URL Encoding

- **URL Percent Encoding in PostgREST Queries**:
  - When passing `%` wildcards in REST query parameters (e.g. `like.209%`), ALWAYS encode `%` as `%25` (`like.209%25`). Raw `%` in URL query parameters causes malformed escape sequences and HTTP 500 errors.
- **Sequential Pond Switcher Bar Synchronization**:
  - The Quick Log modal must keep its sequential switcher bar title (`#modal-switcher-pond-title`) and subtitle (`#modal-switcher-pond-subtitle`) strictly synchronized with `currentPond` and `activePondsList` on every navigation event (**Next ▶**, **◀ Prev**, or **⚡ Save & Next ➔**).
- **Water Colour Tone Selection**:
  - The 8 water colour swatches (`.water-swatch-card`) bind directly to `#input-water-colour` and `#selected-water-colour-label`. When saving, `water_colour` must be read from `#input-water-colour` to guarantee persistence to `public.daily_pond_records`.

---

## 18. Password Security & Strict Read-Only Viewer Architecture

- **Zero-Backdoor Navigation Guard**:
  - Direct URL hash changes (`#/dbms`) or buttons from other views (e.g. Executive Map drawer "Open Full Cycle DBMS") must NEVER bypass authentication.
  - `ViewRouter.js` intercepts all navigation attempts to `#view-dbms`. If an active session token does not exist in `security.getDbmsSession()`, the router immediately halts navigation and displays the glassmorphism authentication modal.
- **Top-Level Modal DOM Placement Rule**:
  - Authentication modals (such as `#modal-dbms-passcode`) must be declared directly at the root `<body>` level in `index.html`, NEVER nested inside view containers like `#view-dbms`. If placed inside `#view-dbms`, the modal inherits `display: none` when the view is inactive, rendering it completely invisible to users.
- **Role Enforcement & Separation of Duties**:
  - **Editor Mode (`mantaray`)**: Grants full edit, cycle creation, and rollover permissions (`PLANNER` role).
  - **Viewer Mode (`monodon`)**: Strictly read-only (`VIEWER` role).
    - Hides all `.btn-save`, `.btn-danger`, `.btn-excel`, delete buttons (`[data-delete-index]`), and steppers across all 10 tabs via `body.isharp-viewer-mode`.
    - Disables all form inputs with `pointer-events: none !important`.
    - In Tab 8 (Lifecycle), hides "🏁 Terminate & Rollover", "🛑 Terminate Only", "🔄 Revive Back Cycle", and the "Manual Cycle Registration" card.
    - Runtime action guards intercept any direct programmatic calls to terminate or modify cycles and display an access denied toast.
    - Locks the Role Selector in the command navbar (`disabled = true`, `.role-locked-viewer`) to prevent client-side role elevation.
- **Field Operations Fish-Name Passwords & Manager Master Key**:
  - Modules 01–09 use local Malay fish passwords (`siakap`, `kerapu`, `jenahak`, `haruan`, `bawal`, `patin`, `keli`, `tilapia`, `tongsan`).
  - Manager Master Key (`todak`) provides a universal bypass unlocking any module 01–09 for supervisors and managers.
- **Zero-Code Credential Management in Supabase Table Editor**:
  - Passwords are dynamically loaded from `public.app_passwords` and `public.module_passwords`.
  - Supervisors can update passwords at any time in the Supabase Table Editor without writing code or redeploying the app.
  - Offline fallback caching in `security.js` ensures that field operations remain functional during temporary connectivity loss at the farm.




