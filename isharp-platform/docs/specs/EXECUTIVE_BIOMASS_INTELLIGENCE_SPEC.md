# iSHARP DBMS 2.0 — Executive Production & Biomass Intelligence Specification

> **Target Audience:** CEO, COO, Chief Aquaculture Officer, Production Directors & Processing Plant Managers  
> **Facility:** Blue Archipelago Berhad • Setiu Farm (216 Commercial Ponds)  
> **Module Section:** Executive Dashboard ➔ Executive Production & Biomass Intelligence (`#exec-production-section`)  
> **Database Sources:** `view_growout_pond_cycles`, `biometrics_sampling`, `pond_harvest_daily`, `pond_harvest_sales`, `pond_issues`, `daily_pond_records`  
> **Last Aligned:** 2026-10-04 (Master Specification with Full 5 Extended Dimensions & Financial Suite)  

---

## 1. Executive Problem Statement & Core Management Questions

The executive management team requires instant clarity on live operational harvest readiness, near-term plant intake, and 12-month historical commercial performance without sifting through hundreds of raw pond ledgers. This module answers the two most critical management cadences:

### A. Everyday Operational Questions (Live Harvest Readiness & Biosecurity)
1. **How many ponds can be harvested right now?**
   - Which ponds are at **Optimum Size** (Vannamei $\ge 16.0\text{g}$, Monodon $\ge 30.0\text{g}$) to capture top premium market pricing?
   - Which ponds have met **Minimum Commercial Weight** (Vannamei $\ge 10.0\text{g}$, Monodon $\ge 25.0\text{g}$) and can be harvested if market demand spikes, cash flow is needed, or biosecurity risks emerge?
   - Which ponds are at risk of **Forced Harvest** or **Slow Growth Watch** due to prolonged DOC and sub-minimum weight?
2. **What is the biosecurity priority (Emergency Harvest)?**
   - Are any harvestable ponds flagged **🔴 RED** or PCR-positive in `pond_issues` (e.g. EMS, EHP, WSSV) requiring immediate emergency harvest to protect adjacent ponds?
3. **What is our total live standing crop biomass in the water today?**
   - How much live tonnage is in the water across all 9 modules?
   - What is the species breakdown (*P. vannamei* vs *P. monodon*) among harvestable ponds?
4. **Harvest Method & Type:**
   - Are we doing a **Partial Harvest** (de-crowding 20–30% of biomass to stimulate growth) or a **Total Final Harvest (Termination)**?

### B. Weekly & Monthly Strategic Questions (Forecast, 12-Month Trends & Commercial Packout)
1. **7-Day & 14-Day Forward Harvest Forecast:**
   - How many ponds and metric tons are projected to cross into minimum and optimum harvest windows within the next 7 to 14 days based on live ADG velocity?
2. **12-Month Rolling Harvest Trajectory:**
   - Monthly total biomass harvested (metric tons).
   - Monthly weighted average shrimp size (ABW in grams).
   - Monthly shrimp size range (min–max ABW distribution band) to evaluate grading consistency.
3. **Commercial Quality & Grading Packout:**
   - What percentage of harvested shrimp graded as **Prime Good Grade** vs **2nd Grade** vs **Small** vs **Below/Rejects**?
4. **Commercial Financial Yield & Buyer Ledger (Zero Synthetic Assumptions):**
   - Monthly gross commercial harvest revenue (RM) and buyer receipts (`pond_harvest_sales`).
   - Differentiated realized average selling price per kg for **Vannamei (VAN RM/kg)** and **Monodon (MON RM/kg)**.
   - Realized pricing derived purely from actual transaction value divided by actual harvest weight.
   - Strictly zero synthetic or hallucinated margins (no arbitrary 25% margins). Only genuine database fields are reported.
   - Top off-takers and commercial buyers breakdown (*BAB Plant*, *SBH Marine*, *CS Fishery*, etc.) with species badges.

---

## 2. Harvest Decision Engine & Biometric Thresholds

Harvest decisions at Setiu Farm are primarily driven by **Average Body Weight (ABW in grams)**, conditioned by **Days of Culture (DOC)**, **Growth Velocity (ADG)**, and **Biosecurity Pathology**:

```
                                ┌──────────────────────────────────────┐
                                │      Active Pond Biomass Sample      │
                                └──────────────────┬───────────────────┘
                                                   │
                         ┌─────────────────────────┴─────────────────────────┐
                         ▼                                                   ▼
            ┌──────────────────────────┐                        ┌──────────────────────────┐
            │  Litopenaeus vannamei    │                        │     Penaeus monodon      │
            │          (VAN)           │                        │          (MON)           │
            └────────────┬─────────────┘                        └────────────┬─────────────┘
                         │                                                   │
        ┌────────────────┼────────────────┐                 ┌────────────────┼────────────────┐
        ▼                ▼                ▼                 ▼                ▼                ▼
  ABW ≥ 16.0g       10.0g ≤ ABW      DOC ≥ 80 &         ABW ≥ 30.0g      25.0g ≤ ABW      DOC ≥ 120 &
  [ Optimum ]         < 16.0g        ABW < 10.0g        [ Optimum ]        < 30.0g        ABW < 25.0g
 (Premium Price)    [ Minimum ]      [ Forced ]       (Premium Jumbo)    [ Minimum ]      [ Forced ]
```

### Harvest Classification & Biosecurity Engine

| Classification | *L. vannamei* (VAN) | *P. monodon* (MON) | Biosecurity Modifier | Commercial & Operational Action |
| :--- | :--- | :--- | :--- | :--- |
| 🚨 **Emergency Harvest** | Any harvestable size | Any harvestable size | **`pond_issues` Flag = 🔴 RED** or Pathogen Positive | **Top Priority Liquidation:** Immediate harvest to prevent farm-wide contagion. |
| 🌟 **Optimum Harvest** | **$\text{ABW} \ge 16.0\text{g}$**<br/>($\le 62\text{ pcs/kg}$) | **$\text{ABW} \ge 30.0\text{g}$**<br/>($\le 33\text{ pcs/kg}$) | Clean Green / Yellow | **Prime Market Window:** Highest price/kg. Book processing plant intake. |
| 🟡 **Minimum Harvest Ready** | **$10.0\text{g} \le \text{ABW} < 16.0\text{g}$**<br/>($63\text{–}100\text{ pcs/kg}$) | **$25.0\text{g} \le \text{ABW} < 30.0\text{g}$**<br/>($34\text{–}40\text{ pcs/kg}$) | Clean Green | **Commercial Window:** Eligible for partial thinning or complete harvest. |
| 🟡 **Slow Growth Watch** | **$\text{DOC} \ge 70$** AND $\text{ADG} < 0.15\text{ g/d}$ | **$\text{DOC} \ge 110$** AND $\text{ADG} < 0.18\text{ g/d}$ | Any | **Pre-Emptive Warning:** High risk of feed waste; intensive sampling required. |
| 🔴 **Forced Harvest Action** | **$\text{DOC} \ge 80$** AND $\text{ABW} < 10.0\text{g}$ | **$\text{DOC} \ge 120$** AND $\text{ABW} < 25.0\text{g}$ | Stunted cycle | **Loss Mitigation:** Terminate cycle immediately to prepare pond for next run. |
| 🟢 **Active Growout** | $\text{ABW} < 10.0\text{g}$ & $\text{DOC} < 70$ | $\text{ABW} < 25.0\text{g}$ & $\text{DOC} < 110$ | Clean | **Standard Culture:** Continue programmed feeding and aeration. |

---

## 3. Near-Term Harvest Projection Engine (7-Day & 14-Day Forecast)

Ponds currently below harvest threshold are projected forward using individual pond Average Daily Gain (ADG):
$$\text{Projected ABW}_{t+n} = \text{Current ABW} + (\text{ADG} \times n)$$
Where $n \in \{7, 14\}$ days.
- Ponds that will reach $\ge 10.0\text{g}$ (VAN) or $\ge 25.0\text{g}$ (MON) within 7 days appear in the **7-Day Intake Pipeline**.
- Ponds that will reach $\ge 16.0\text{g}$ (VAN) or $\ge 30.0\text{g}$ (MON) within 14 days appear in the **14-Day Optimum Pipeline**.
- Aggregates projected intake tonnage so processing plants can schedule packaging and labor.

---

## 4. 12-Month Moving Performance & Financial Architecture

### Database Pipeline
- `pond_harvest_daily`: Query records where `harv_date >= NOW() - INTERVAL '12 months'`.
- `pond_harvest_sales`: Query buyer receipts where `hvt_date >= NOW() - INTERVAL '12 months'`.

### Aggregation Schema per Monthly Bucket (`YYYY-MM`)
1. **Harvest Biomass:**
   - Total Biomass (Tons): $\sum \text{harv\_weight} / 1000$.
   - Termination Harvest Tonnage vs Partial Harvest Tonnage.
2. **Shrimp Sizing & Consistency:**
   - Weighted Average ABW (g): $\frac{\sum (\text{harv\_abw} \times \text{harv\_weight})}{\sum \text{harv\_weight}}$.
   - Size Range Band: $\min(\text{harv\_abw}) \leftrightarrow \max(\text{harv\_abw})$.
3. **Commercial Packout Grading:**
   - Good Grade %: $\sum \text{good\_wgt} / \sum \text{raw\_wgt} \times 100$.
   - 2nd Grade %: $\sum \text{second\_grade\_wgt} / \sum \text{raw\_wgt} \times 100$.
   - Small Grade %: $\sum \text{small\_wgt} / \sum \text{raw\_wgt} \times 100$.
   - Below / Rubbish Rejects %: $\sum (\text{below\_wgt} + \text{rubbish\_wgt}) / \sum \text{raw\_wgt} \times 100$.
4. **Commercial Finance & Species-Differentiated Realized Pricing:**
   - Gross Revenue (RM): $\sum \text{net\_sales}$ (or $\sum \text{harv\_revenue}$).
   - Vannamei Realized Price: $\frac{\text{Gross Revenue (VAN)}}{\sum \text{harv\_weight (VAN)}}$ (RM/kg).
   - Monodon Realized Price: $\frac{\text{Gross Revenue (MON)}}{\sum \text{harv\_weight (MON)}}$ (RM/kg).
   - *Strict Rule:* No synthetic margin assumptions (e.g. 25% gross margin). Only real recorded transactional data from `pond_harvest_sales` and `pond_harvest_daily`.
5. **Top Buyers Roster:**
   - Aggregated tonnage and revenue by `hvt_buyer` (e.g. *BAB Plant*, *SBH Marine*, *CS Fishery*).
   - Tagged with primary species (`VAN` / `MON`) and % share calculated against total buyer sales receipts.

---

## 5. Visual Dashboard Hierarchy & UI Architecture

The `Executive Production & Biomass Intelligence` section is organized into 5 intuitive visual tiers:

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. Executive Harvest & Biomass KPI Strip (6 Core Metric Cards)         │
│    - Optimum Ready  - Minimum Ready  - Forced / Watch  - Emergency     │
│    - Live Standing Biomass (Tons)    - 14-Day Projected Intake (Tons) │
├────────────────────────────────────────────────────────────────────────┤
│ 2. Live Harvest Readiness Pipeline & 7/14-Day Forward Forecast Board   │
│    [All Harvestable] [🌟 Optimum] [🟡 Minimum] [🚨 Forced/Watch]       │
│    [⚡ 7-14d Forecast] [⚖️ Partial vs Final]                            │
│    Interactive cards with ABW, DOC, Biomass, Pathology & Drawer Trigger │
├────────────────────────────────────────────────────────────────────────┤
│ 3. 12-Month Moving Performance Visualizer (Interactive Dual Charts)    │
│    - Fully responsive with auto-rendering ResizeObserver lifecycle     │
│    - Chart 1: Monthly Biomass (Tons) & Realized Commercial Revenue (RM)│
│    - Chart 2: Shrimp Sizing Evolution (Weighted ABW + Min/Max Band)    │
├────────────────────────────────────────────────────────────────────────┤
│ 4. Commercial Packout & Buyer Distribution Cards                       │
│    - Packout Grading Breakdown (% Good Grade vs 2nd / Small / Rejects) │
│    - Top Off-Takers & Buyer Revenue Share (with Species Badges)        │
├────────────────────────────────────────────────────────────────────────┤
│ 5. 12-Month Executive Performance Ledger Table                         │
│    Month-by-month table with Biomass, ABW, Revenue, VAN RM/kg,         │
│    MON RM/kg (No synthetic margins).                                   │
│    One-click [ 📥 Export CSV / Excel ] with species columns            │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Implementation Guardrails (`RULES.md`)

1. **Pure Domain Functions:** All math (harvest readiness, forecast, 12-month aggregation, packout percentages) resides in `src/domain/biometrics.js`.
2. **Repository Single Source of Truth:** Direct queries strictly encapsulated in `src/infrastructure/repositories/harvestRepository.js`.
3. **Desktop Focused:** High-contrast Frutiger Aero cards styled in `src/styles/components.css`.
4. **Zero-Fake Data:** Ponds awaiting first sampling are clearly indicated without simulated telemetry.
