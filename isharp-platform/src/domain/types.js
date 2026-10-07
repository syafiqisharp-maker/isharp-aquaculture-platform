/**
 * iSHARP DBMS 2.0 — Aquaculture Domain Schema & JSDoc Type Contracts
 * Central source of truth for all data structures across Field Ops, DBMS, and Executive views.
 * 
 * Provides human developers with explicit property definitions, units of measurement,
 * and valid status enumerations.
 */

/**
 * @typedef {"PRODUCTION" | "IDLE" | "CLOSE" | "PREPARATION"} PondOperationalStatus
 */

/**
 * @typedef {"VAN" | "MON"} ShrimpSpecies
 * - VAN: Litopenaeus vannamei (Pacific White Shrimp)
 * - MON: Penaeus monodon (Giant Tiger Prawn)
 */

/**
 * @typedef {"OPTIMUM" | "MINIMUM" | "ALERT" | "FORECAST"} HarvestReadinessCategory
 */

/**
 * Single growout pond cycle entity (view_growout_pond_cycles / growout_pond_master).
 * @typedef {Object} PondCycleRecord
 * @property {string} pond_index Unique cycle identifier (e.g. "04.08.02")
 * @property {string} pond Pond identifier without cycle (e.g. "04.08")
 * @property {string|number} [cycle_no] Cycle sequence number
 * @property {PondOperationalStatus} pond_status Current operational lifecycle phase
 * @property {ShrimpSpecies} [species] Cultured species (VAN / MON)
 * @property {string} [genetic_line] Hatchery genetic breed (e.g. "Standard Line", "SIS")
 * @property {string} [stck_date] Initial PL stocking date (YYYY-MM-DD)
 * @property {string} [date_close] Termination harvest date if closed (YYYY-MM-DD)
 * @property {number} [stck_netto] Net count of stocked postlarvae pieces
 * @property {number} [stck_allow] Stocking allowance / safety margin pieces
 * @property {number} [stck_gross] Gross total delivery pieces
 * @property {string} [stck_source] Origin hatchery facility
 * @property {string} [stck_tank] Delivery transport tank number
 * @property {string} [stck_size] Size grade at delivery (e.g. "PL10", "PL12")
 * @property {number} [area] Water surface area in hectares (typically 0.50 Ha)
 * @property {number} [aerator_1hp] Active 1.0 HP paddlewheel motor units
 * @property {number} [aerator_2hp] Active 2.0 HP paddlewheel motor units
 * @property {number} [aerator_4hp] Active 4.0 HP paddlewheel motor units
 * @property {number} [total_hp] Calculated total active horsepower
 * @property {string} [date_cycle] Milestone: Cycle commencement date
 * @property {string} [date_cleaning] Milestone: Sludge cleaning completion
 * @property {string} [date_repair] Milestone: Aerator & dyke repairs
 * @property {string} [date_filling] Milestone: Seawater filling commencement
 * @property {string} [date_culture] Milestone: Water aging & probiotic conditioning
 * @property {string} [date_baby_box] Milestone: Baby box / nursery release
 * @property {string} [date_qaqc] Milestone: QA/QC laboratory screening passed
 * @property {string} [date_ready] Milestone: Ready for stocking gate approved
 * @property {string} [date_plan_stock] Planned stocking date
 * @property {number} [idle_days] Accumulated consecutive idle duration in days
 * @property {string} [idle_status] Reason for pond vacancy / preparation status
 * @property {string} [water_type] Salinity classification (Marine vs. Brackish)
 */

/**
 * Daily logbook record submitted by farm technicians or supervisors (daily_pond_records).
 * @typedef {Object} DailyPondRecord
 * @property {number} [id] Database auto-increment ID
 * @property {string} pond_index Target pond cycle key
 * @property {string} log_date Log entry date (YYYY-MM-DD)
 * @property {number} [doc] Calculated Days of Culture on log date
 * @property {number} [blind_feed_kg] Applied feed weight in kilograms
 * @property {number} [feed_tray_remnant_pct] Remaining feed percentage on check trays (0, 5, 10, 15, 25)
 * @property {number} [water_level_cm] Water level reading in centimeters
 * @property {string} [water_colour] Dominant optical water color classification
 * @property {number} [mortality_kg] Collected dead shrimp weight in kilograms
 * @property {string} [remarks] Field observations, weather anomalies, or treatment notes
 * @property {string} [created_at] ISO timestamp of record ingestion
 */

/**
 * Biometric sampling event ledger entry (biometrics_sampling).
 * @typedef {Object} SamplingRecord
 * @property {number} [id] Database record identifier
 * @property {string} pond_index Target pond cycle key
 * @property {string} smpl_date Date of physical net sampling (YYYY-MM-DD)
 * @property {number} smpl_doc Days of culture at time of sampling
 * @property {number} smpl_abw Average Body Weight in grams (ABW)
 * @property {number} [smpl_adg] Average Daily Gain in grams/day (ADG)
 * @property {number} [smpl_bms] Estimated total pond biomass in kilograms
 * @property {number} [smpl_tfed] Cumulative feed consumed up to this date in kilograms
 * @property {number} [smpl_fcr] Feed Conversion Ratio (kg feed / kg biomass gain)
 * @property {number} [smpl_srv] Estimated population survival percentage (SR)
 */

/**
 * Harvest event manifest or buyer sales allocation (harvest_records / sales_records).
 * @typedef {Object} HarvestRecord
 * @property {number} [id] Database record identifier
 * @property {string} pond_index Origin pond cycle key
 * @property {string} hrv_date Harvest date (YYYY-MM-DD)
 * @property {number} [hrv_doc] DOC on harvest date
 * @property {"PARTIAL" | "TERMINATION" | "FINAL"} hrv_type Harvest category
 * @property {number} hrv_weight_kg Net shrimp weight harvested in kilograms
 * @property {number} [hrv_abw] Average Body Weight in grams at harvest
 * @property {number} [hrv_pcs] Calculated total head-on pieces harvested
 * @property {string} [buyer] Purchasing processing plant or merchant name
 * @property {number} [gross_revenue] MYR financial settlement total
 */

/**
 * Live edge sensor telemetry payload (water_quality_logs).
 * @typedef {Object} WaterQualityTelemetry
 * @property {number} [id] Ingestion sequence ID
 * @property {string} pond_index Source pond station key
 * @property {string} recorded_at ISO timestamp from edge gateway
 * @property {number} do_ppm Dissolved Oxygen concentration in mg/L (ppm)
 * @property {number} ph Pond pH acidity/alkalinity measurement (0.00 - 14.00)
 * @property {number} water_temp_c Water temperature in degrees Celsius
 * @property {number} [salinity_ppt] Salinity concentration in parts per thousand
 */

/**
 * Smart diagnostic guidance for technician feeding decisions.
 * @typedef {Object} FeedingActionPlan
 * @property {"optimal" | "warning" | "alert" | "idle"} level Severity classification
 * @property {string} badgeText Short operational label (e.g. "NORMAL FEED", "CUT FEED")
 * @property {string} bannerIcon Decorative status emoji
 * @property {string} title Comprehensive diagnostic title
 * @property {Array<{icon: string, headline: string, desc: string}>} reasons Contributing biological factors
 */

export const DOMAIN_CONSTANTS = Object.freeze({
    TOTAL_PONDS: 216,
    MODULES_COUNT: 9,
    PONDS_PER_MODULE: 24,
    DEFAULT_POND_AREA_HA: 0.50,
    SPECIES: {
        VAN: "Litopenaeus vannamei",
        MON: "Penaeus monodon"
    }
});
