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
│   ├── tests/                    # 🧪 Node.js Native Unit Test Suite (20 domain tests)
│   ├── public/                   # Static assets, logos & Netlify _redirects
│   └── package.json              # isharp-aquaculture-platform (npm test, build, dev)
│
├── isharp-simulator/             # 🧠 Bio-Economic Digital Twin (1-12 Mo Simulation Sandbox)
│   └── PROJECT_BLUEPRINT.md      # 4 Simulation Engines (Growth, Feeding, OPEX, Schedule)
│
├── database_migration/           # 🔄 Data Ingestion & Supabase Migration Tools
│   ├── sync_weekly_access.ps1    # Friday Smart Delta Sync Engine (Access -> Supabase)
│   ├── migrate_staff_to_supabase.ps1 # 121-personnel 3NF Staff Directory Migrator
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

The cloud database (`keappoukeagyzpoxkrru.supabase.co`) operates under an enterprise 4-phase remediation and normalization standard:

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

### Run Automated E2E REST Client Probe
```bash
cd isharp-platform
npm run test:e2e    # 19/19 comprehensive live REST operations against Supabase with auto-teardown
```

