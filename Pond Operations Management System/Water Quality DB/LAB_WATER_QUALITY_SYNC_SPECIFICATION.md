# iSHARP Laboratory Water Quality Integration & Automated Daily Sync
=====================================================================

> **Primary Source:** `Y:\9. Database\DATABASE COMBINE MONITORING 2024 - 2026 new.xlsx` (Office Dedicated Server)  
> **Fallback Source:** `C:\Users\syafiq\My Drive\Syafiq Water Quality Station Project\Pond Operations Management System\Water Quality DB\DATABASE COMBINE MONITORING 2024 - 2026 new.xlsx`  
> **Cloud Table:** Supabase `public.lab_water_quality`  
> **Scheduled Trigger:** Windows Task Scheduler (`iSHARP_Daily_Lab_Sync`) @ **9:00 AM Daily**  
> **Last Updated:** 2026-10-07

---

## 1. Overview & Business Objective

The farm laboratory team monitors and tests water quality parameters across all production ponds, logging results into a master Excel workbook stored on the office server. 

This pipeline automatically extracts, validates, and synchronizes laboratory results with the iSHARP cloud platform every morning, making laboratory chemistry data accessible across:
1. **iSHARP DBMS — Laboratory Tab (`#/dbms`)**: Full water chemistry log, historical parameter trends, mineral ratios, and pathology tests.
2. **Field Operations — Pond Detail View (`#/field-ops`)**: Compact, high-contrast Bento KPI grid showing current chemistry balance (Salinity, Alkalinity, Ammonia, Nitrite, Calcium, Magnesium, Ca:Mg Ratio, Turbidity) and exact test sampling date.

---

## 2. Parameter Mapping & Schema Definition

The master laboratory Excel workbook contains sheets such as `DB COMBINE`. The relevant columns are mapped to `public.lab_water_quality`:

| Excel Column | Excel Header | DB Column | Data Type | Target Range / Unit | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Col 4** | `Date` | `log_date` | `date` | `YYYY-MM-DD` | Composite Unique Key part 1 |
| **Col 12** | `Pond` | `pond` | `text` | e.g. `B01`, `01.02.01` | Raw pond identifier |
| *(Resolved)* | *(Calculated)* | `pond_index` | `text` | e.g. `B01.07` | Composite Unique Key part 2 (FK to `growout_pond_master`) |
| **Col 13** | `DOC` | `doc` | `integer` | Days | Culture age on test date |
| **Col 14** | `Salinity (ppt)` | `salinity_ppt` | `numeric(5,2)` | 15.0 – 30.0 ppt | Pond water salinity |
| **Col 18** | `Alkalinity` | `alkalinity` | `numeric(6,2)` | 100 – 160 mg/L | Total alkalinity ($CaCO_3$) |
| **Col 19** | `Ammonia` | `ammonia` | `numeric(5,3)` | $\le$ 0.50 mg/L | Total Ammonia Nitrogen (TAN / $NH_3$) |
| **Col 20** | `Nitrite` | `nitrite` | `numeric(5,3)` | $\le$ 1.00 mg/L | Nitrite ($NO_2^-$) |
| **Col 31** | `Calcium` | `calcium` | `numeric(6,2)` | $>$ 200 mg/L | Dissolved Calcium ($Ca^{2+}$) |
| **Col 32** | `Magnesium` | `magnesium` | `numeric(6,2)` | $>$ 600 mg/L | Dissolved Magnesium ($Mg^{2+}$) |
| *(Formula)* | *(Calculated)* | *(Ratio)* | *(Computed)* | 1 : 2.5 – 3.5 | Calculated as `1 : (Magnesium / Calcium)` |
| **Col 34** | `Turbidity` | `turbidity` | `numeric(5,1)` | $<$ 30 NTU | **Unit:** Nephelometric Turbidity Units (NTU) |

### Database Constraints & Indexes
```sql
CREATE TABLE IF NOT EXISTS public.lab_water_quality (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pond_index text NOT NULL,
    pond text NOT NULL,
    log_date date NOT NULL,
    doc integer,
    salinity_ppt numeric(5,2),
    alkalinity numeric(6,2),
    ammonia numeric(5,3),
    nitrite numeric(5,3),
    calcium numeric(6,2),
    magnesium numeric(6,2),
    turbidity numeric(5,1),
    created_at timestamptz DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_lab_water_quality UNIQUE (pond_index, log_date)
);

CREATE INDEX IF NOT EXISTS idx_lab_wq_pond_index_date 
ON public.lab_water_quality (pond_index, log_date DESC);
```

---

## 3. Chronological Cycle Matching Algorithm

The laboratory Excel file does not have a `pond_index` column (it only has pond name and test date). To associate each test with its correct production cycle, the sync script resolves `pond_index` via `growout_pond_master` using the following hierarchy:

```
                  ┌─────────────────────────────────────────┐
                  │ Input: pond ("B01") + log_date ("2026-09-15") │
                  └────────────────────┬────────────────────┘
                                       │
            ┌──────────────────────────┴──────────────────────────┐
            ▼                                                     ▼
1. Is log_date between date_cycle                    2. Is log_date between previous
   and date_close of a cycle?                           date_close and upcoming date_cycle?
   ├── YES ➔ Assign cycle.pond_index (EXACT)            ├── YES ➔ Assign upcoming cycle.pond_index
   └── NO  ➔ Continue to ongoing check                     (PRE-STOCKING WATER PREPARATION)
            │                                                     │
            ▼                                                     ▼
3. Is cycle currently active (date_close is null)     4. Boundary edge fallbacks:
   and log_date >= date_cycle?                           • If log_date >= latest cycle: LATEST_CYCLE
   ├── YES ➔ Assign cycle.pond_index (OPEN_CYCLE)        • If log_date < earliest cycle: EARLIEST_CYCLE
```

### Verification & Accuracy
- **Full History Imported:** 15,502 records (2024 to 2026).
- **Match Rate:** 100% of rows with valid dates matched their corresponding production cycles.
- **Pre-Stocking Treatment Coverage:** Water testing conducted during reservoir and pond preparation (before PL stocking) is correctly cataloged under the upcoming cycle.

---

## 4. Automation & Daily Synchronization Architecture

### Files & Locations
All sync automation artifacts reside in:
`C:\Users\syafiq\My Drive\Syafiq Water Quality Station Project\Pond Operations Management System\Water Quality DB\`

1. **`sync_daily_lab_water_quality.py`**:
   - **Primary Network Target:** `Y:\9. Database\DATABASE COMBINE MONITORING 2024 - 2026 new.xlsx`
   - **Automatic Offline Fallback:** Switches to local Google Drive copy if network drive `Y:` is disconnected.
   - **Temp-Copy Non-Blocking Read:** Copies the file to `%TEMP%` before reading with `openpyxl(read_only=True)`. This completely prevents Excel file lock errors while lab staff are entering data.
   - **Smart Incremental Window:** Defaults to syncing the most recent 30 days (takes ~30–45s) using `upsert` (`on_conflict=pond_index,log_date`).
   - **Full Re-Sync Flag:** Supports `--full` flag to re-verify the complete archive from 2024 to 2026.
   - **Auto-Logging:** Appends all run metrics to `sync_lab_water_quality.log`.

2. **`run_daily_lab_sync.bat`**:
   - Batch wrapper for one-click manual execution or silent Task Scheduler execution (`--silent`).

3. **Windows Task Scheduler (`iSHARP_Daily_Lab_Sync`)**:
   - **Trigger:** Daily at 09:00:00 AM.
   - **Setting:** `StartWhenAvailable` enabled (if computer is sleeping or powered on late, Windows immediately runs the missed sync).

---

## 5. UI Integration

### A. iSHARP DBMS — Laboratory Tab (`laboratoryTab.js`, `laboratoryTabTemplate.js`)
- **8 KPI Cards:** Salinity, Alkalinity, Ammonia ($NH_3$), Nitrite ($NO_2^-$), Calcium, Magnesium, Ca:Mg Ratio, Turbidity.
- **Parameter Health Indicators:** Real-time color alerts for Alkalinity (<100 or >160 mg/L), Ammonia (>0.5 mg/L), and Nitrite (>1.0 mg/L).
- **Historical Chemistry Logbook:** Reverse-chronological table of all water testing for the active cycle, with DOC, date, and status badges.
- **Turbidity Unit:** Correctly standardized to `NTU` across all cards and tables.

### B. Field Operations — Pond Operational Detail (`PondWqsDetail.js`, `pondWqsDetailTemplate.js`)
- **Bento KPI Grid:** Embedded in Section 2 (`Laboratory Results`), displaying the latest test results for the selected pond.
- **Sample Date Badge:** Displays the test date (`📅 Sample Date: YYYY-MM-DD (DOC XX)`) so pond operators know the freshness of the laboratory data.
- **Translucent Aero Glass Surface:** Clean Frutiger Aero glass styling with high-contrast text (`#072642` deep navy headings, `#0369a1` bold labels) for outdoor sunlight legibility.
- **Redundant Cards Removed:** Replaced duplicate biometric status displays in favor of dedicated hardware telemetry (Weather Station, Aerators, IoT nodes).
