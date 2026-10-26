# iSHARP Precision Aquaculture Platform

Enterprise Farm Intelligence, Real-time Operations & Digital Twin Simulation for **Blue Archipelago Berhad** (Setiu Shrimp Farm, Terengganu).

[![Netlify Status](https://api.netlify.com/api/v1/badges/isharp-platform/deploy-status)](https://app.netlify.com)

---

## 🦐 The 3-System Platform Architecture

The platform provides a unified Frutiger Aero gateway connecting three distinct enterprise subsystems:

```
                          ┌──────────────────────────────────────────────┐
                          │         iSHARP AQUACULTURE PLATFORM          │
                          │          (3-Orb Frutiger Aero Gateway)       │
                          └──────────────────────┬───────────────────────┘
                                                 │
         ┌───────────────────────────────────────┼───────────────────────────────────────┐
         ▼                                       ▼                                       ▼
┌──────────────────┐                   ┌──────────────────┐                   ┌──────────────────┐
│   SYSTEM 1:      │                   │   SYSTEM 2:      │                   │   SYSTEM 3:      │
│   EXECUTIVE      │                   │   iSHARP DBMS    │                   │   FIELD OPS      │
│   DASHBOARD      │                   │                  │                   │                  │
├──────────────────┤                   ├──────────────────┤                   ├──────────────────┤
│• 216-Pond Grid   │                   │• 10 Deep Tabs    │                   │• Module 01-09    │
│• Farm Biosecurity│                   │• Master Records  │                   │• 24-Pond Map     │
│• Macro Telemetry │                   │• Cycle Lifecycle │                   │• Feeding Action  │
│• Slide-Out Drawer│                   │• Batch Stocking  │                   │• Daily Logbook   │
│• Management View │                   │• Staff Incentive │                   │• Chem / Minerals │
└──────────────────┘                   └──────────────────┘                   └──────────────────┘
```

---

## 📁 Repository Directory Structure

```
.
├── isharp-platform/              # 🚀 The 4-System Web Application (Vite + Vanilla JS)
│   ├── src/
│   │   ├── modules/
│   │   │   ├── landing/          # Gateway Portal (Orbital Frutiger Aero Hub)
│   │   │   ├── executive/        # System 1: 216-Pond Interactive Farm Map & Biomass
│   │   │   ├── fieldOps/         # System 3: Mobile Field Ops & Quick Stepper Inputs
│   │   │   └── dbms/             # System 2: 10 Operational DBMS Tabs & Controllers
│   │   │       └── templates/    # Modular HTML Tab Templates (Zero inline HTML bloat)
│   │   ├── config/               # Centralized DOM Contracts & RBAC Permissions
│   │   ├── infrastructure/       # Supabase Cloud Client & Repositories
│   │   ├── domain/               # Aeration, Biometrics & Feeding Action Models
│   │   └── state/                # Reactive Pub/Sub State Stores
│   ├── tests/                    # 🧪 Node.js Native Unit Test Suite (195 unit tests across 19 suites)
│   ├── public/                   # Static assets, logos & Netlify _redirects
│   └── package.json              # isharp-aquaculture-platform (npm test, build, dev)
│
├── isharp-simulator/             # 🧠 Bio-Economic Digital Twin (1-12 Mo Simulation Sandbox)
│   └── PROJECT_BLUEPRINT.md      # 4 Simulation Engines (Growth, Feeding, OPEX, Schedule)
│
├── database_migration/           # 🔄 Data Ingestion & Supabase Migration Tools
│   ├── sync_weekly_access.ps1    # Friday Smart Delta Sync Engine (Access -> Supabase)
│   ├── 11_migrate_feed_legacy_pk.sql # Feed ledger surrogate PK & natural deduplication
│   ├── 12_normalize_staff_and_aerators.sql # Master staff directory & aerator inventory view
│   ├── 13_security_hardening_rls_and_rpc.sql # pgcrypto bcrypt RPCs & header-based RLS
│   ├── 15_sync_hardening.sql     # RLS InitPlan speedup, atomic sync RPC & natural-key constraints
│   └── SUPABASE_MIGRATION_GUIDE.md # Supabase Cloud Architecture Specification
│
├── netlify.toml                  # 🌐 Netlify Edge Deployment Configuration
└── walkthrough.md                # 📖 Complete Development Walkthrough & Engineering Log
```

---

## 🌐 Netlify Cloud Hosting & Direct Routing

The application is deployed on Netlify's high-speed global Edge CDN. Each system has its own direct URL via hash-based routing:

* **Gateway Welcome Portal:** `https://your-site.netlify.app/#/`
* **System 1 (Executive Dashboard):** `https://your-site.netlify.app/#/executive`
* **System 2 (iSHARP DBMS 2.0):** `https://your-site.netlify.app/#/dbms`
* **System 3 (Field Operations):** `https://your-site.netlify.app/#/field-ops`

---

## 📡 Sibling Edge Hardware Repository

Edge firmware for pond IoT sensors, Dissolved Oxygen (DO), pH probes, water color sensors, feed barrel telemetry, and LoRa wireless gateways are maintained in the dedicated hardware repository:

👉 **[syafiqisharp-maker/isharp-iot-hardware](https://github.com/syafiqisharp-maker/isharp-iot-hardware)**

---

## 🛡️ Database Architecture & Automated E2E Testing

The cloud database (`keappoukeagyzpoxkrru.supabase.co`) operates under an enterprise 6-phase remediation, security, and synchronization standard:

1. **Phase 1: Security Hotfixes**
   * Row-Level Security (RLS) enabled across all public tables.
   * Hardened PostgreSQL `SECURITY DEFINER` functions with fixed `search_path = public, pg_temp`.
   * Enforced `security_invoker = true` across all operational SQL views.
2. **Phase 2: Performance Tuning**
   * Added covering indexes to high-frequency query paths (`active_operational_ponds(pond_index)`).
   * Eliminated redundant unique indexes saving write I/O.
   * Consolidated duplicate permissive RLS policies (clearing 105 Supabase advisor findings down to 0).
3. **Phase 3: Schema Hardening & Normalization**
   * Reconnected 23,384 SAP ERP feed entries by zero-padding cycle notations (`.3` $\rightarrow$ `.03`).
   * Enforced `FOREIGN KEY ... ON DELETE CASCADE` on `growout_pond_feed_sap` and `pond_harvest_plan`.
   * Applied PostgreSQL `CHECK` constraint defenses on pond statuses.
4. **Phase 4: Schema Refactoring & De-Spreadsheeting**
   * Decoupled legacy spreadsheet columns into relational tables: `pond_event_date` (event log) and `pond_initiatives` (dynamic trials).
   * Established `pond_aerator_inventory` as the single source of truth for paddlewheels.
   * Reconstructed backward-compatible virtual views (`view_growout_pond_cycles`) with zero frontend breakage.
5. **Phase 5: Security Hardening & Zero-Plaintext Defense**
   * Migrated password storage to PostgreSQL `pgcrypto` bcrypt hashes with `SECURITY DEFINER` RPCs.
   * Enforced header-based Row Level Security (`x-isharp-passcode`) protecting writes across 20+ tables.
   * Stripped all plaintext secrets from frontend client assets in favor of salted SHA-256 offline digests.
   * Integrated DOM XSS escaping, CSV formula injection neutralization, and edge CSP/HSTS headers.
6. **Phase 6: Weekly Sync Hardening, RLS InitPlan Optimization & Zero-Duplication Guarantee**
   * Wrapped RLS policy checks in PostgreSQL InitPlan subqueries (`USING ((SELECT public.fn_can_write_dbms()))` and `USING ((SELECT public.fn_can_read_sensitive()))`) so `pgcrypto` bcrypt authentication evaluates **once per SQL statement** instead of once per row, eliminating `57014` statement timeouts during batch syncs.
   * Deployed atomic cycle-replacement RPC `public.fn_sync_replace_cycles(p_table, p_pond_indices, p_rows)` so `DELETE` + `INSERT` per pond cycle executes in a single rollback-safe database transaction.
   * Completely removed legacy `index_no` dependencies across all tables in favor of natural keys (`uq_biometrics_sampling_pond_date`, `uq_pond_notes_pond_hash_idx`, `uq_pond_harvest_sales_slip_idx`) and in-memory canonical cycle-signature delta comparison.
   * Hardened `Run_Friday_Sync.bat` and `sync_weekly_access.ps1` with PID lock-file protection, exponential network backoff (~13m tolerance), paginated PostgREST fetching (`Get-AllFromSupabase`), and persistent checkpoint resume (`sync_checkpoint.json`).

### Run Automated Testing & Schema Verification Probes
```bash
cd isharp-platform

# 1. Comprehensive Data Entry Schema Audit Probe (18/18 operations with pre-test snapshot & rollback)
npm run test:audit

# 2. Permanent Live REST Client Probe (19/19 storage operations against Supabase with auto-teardown)
npm run test:e2e

# 3. Domain & UI Contract Unit Tests (195/195 tests)
npm test
```

For full documentation and audit logs, see [database_migration/SCHEMA_AUDIT_GUIDE.md](database_migration/SCHEMA_AUDIT_GUIDE.md) and [database_migration/SUPABASE_MIGRATION_GUIDE.md](database_migration/SUPABASE_MIGRATION_GUIDE.md).
