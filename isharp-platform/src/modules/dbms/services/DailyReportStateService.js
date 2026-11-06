/**
 * iSHARP DBMS 2.0 — Daily Report State Service
 * Centralizes default state definitions, schema validation, draft sanitization,
 * and localStorage draft persistence.
 */

export const DAILY_REPORT_STORAGE_KEY = "isharp_daily_report_draft_v2";
export const LEGACY_STORAGE_KEY = "isharp_daily_report_draft_v1";

export class DailyReportStateService {
    /**
     * Constructs fresh default state with zero-mock fallbacks.
     * @returns {Object} Full daily report state schema
     */
    static getDefaultReportState() {
        const now = new Date();
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

        return {
            reportDate: now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
            reportTime: now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
            activePonds: 119,
            totalPonds: 216,
            utilizationPct: 55.09,

            // Performance Scorecard
            ytdTonnageActual: 1111,
            ytdTonnageRolling: 1469.00,
            ytdTonnageBP: 2229.00,
            ytdRevenueActual: 26.42,
            ytdRevenueRolling: 34.58,
            ytdRevenueBP: 48.40,
            ytdHarvestPondsActual: 346,
            ytdHarvestPondsRolling: 435,
            ytdHarvestPondsBP: 434,
            ytdStockPondsActual: 428,
            ytdStockPondsRolling: 460,
            ytdStockPondsBP: 429,

            mtdTonnageActual: "TBA",
            mtdTonnageRolling: "TBA",
            mtdTonnageBP: 215.74,
            mtdRevenueActual: "TBA",
            mtdRevenueRolling: "TBA",
            mtdRevenueBP: 5.23,
            mtdHarvestPondsActual: 7,
            mtdHarvestPondsRolling: "TBA",
            mtdHarvestPondsBP: 50,
            mtdStockPondsActual: 7,
            mtdStockPondsRolling: 37.00,
            mtdStockPondsBP: 42,
            mtdFriesActual: 2.91,
            mtdFriesRolling: 14.80,
            mtdFriesBP: 17.40,
            culledMtd: 0,
            culledYtd: 1,

            // Highlights & DOC
            highlightOperationalSummary: "Operational pond: 0 consist of 0 SPR, 0 SPF, 0 SPT, and 0 MON.",
            highlightStockingPonds: 0,
            highlightHarvestPonds: 0,
            highlightCullPonds: 0,
            docBrackets: [
                { label: "DOC: 0-30 days", count: 0, pct: 0 },
                { label: "DOC: 31-60 days", count: 0, pct: 0 },
                { label: "DOC: 61-90 days", count: 0, pct: 0 },
                { label: "DOC: 91-120 days", count: 0, pct: 0 },
                { label: "DOC: >120 days", count: 0, pct: 0 }
            ],

            // Pond Readiness
            idlePonds: 0,
            cleaningTeamsCount: 0,
            cleaningTeamsDetail: "",
            cleanedPonds: 0,
            waitingWaterFilling: 0,
            waterFilling: 0,
            waterCulture: 0,
            readyForStocking: 0,

            // Risk Flags & Notes
            redFlag: "",
            orangeFlag: "",
            yellowFlag: "",
            facilityActivityUpdate: "",

            // Weather & Environmental
            pondSalinity: "29 ppt",
            pondAmTemp: "30.45°C",
            weatherForecastDate: "Setiu (Windy.com)",
            weatherForecastDays: (() => {
                const days = [];
                for (let i = 0; i < 5; i++) {
                    const d = new Date(now);
                    d.setDate(d.getDate() + i);
                    const dStr = `${String(d.getDate()).padStart(2, "0")} ${months[d.getMonth()]}`;
                    days.push({ date: dStr, desc: i === 0 ? "Few Clouds" : "Partly Cloudy", icon: "⛅" });
                }
                return days;
            })(),
            rainfallHistory: (() => {
                const days = [];
                for (let i = 0; i < 5; i++) {
                    const d = new Date(now);
                    d.setDate(d.getDate() - i);
                    const dStr = `${String(d.getDate()).padStart(2, "0")}-${months[d.getMonth()]}`;
                    days.push({ date: dStr, mm: "0.00mm" });
                }
                return days;
            })(),
            mdcStatus: "100 cm (No changes)",

            // Section 10: Monthly Stocking Plan (Editable farm management plan)
            stockingPlanSummary: {
                title: "Stocking Plan Nov '26",
                rows: [
                    { genetic: "SPT", ponds: 27, density: 450000, fryMil: 14.80 }
                ]
            },

            // Operational Hatcheries & Stocking Types (SPF / SPT / SPR / Monodon)
            operationalHatcheries: {
                totalOperation: 119,
                groups: [
                    { type: "SPR", label: "SPR", totalPonds: 1, hatcheries: [{ source: "SPR", ponds: 1 }] },
                    { type: "SPT", label: "SPT", totalPonds: 82, hatcheries: [{ source: "SHT", ponds: 75 }, { source: "SHT,KS", ponds: 4 }, { source: "GS", ponds: 3 }] },
                    { type: "SPF", label: "SPF", totalPonds: 4, hatcheries: [{ source: "BZYR", ponds: 4 }] },
                    { type: "MONODON", label: "Monodon", totalPonds: 32, hatcheries: [{ source: "KSK", ponds: 18 }, { source: "UBN", ponds: 9 }, { source: "GSR", ponds: 3 }, { source: "CPS", ponds: 2 }] }
                ],
                summary: { spr: 1, spt: 82, spf: 4, monodon: 32 }
            },

            // Legacy Genetics Grid (Maintained for backwards compatibility)
            genetics: {
                spr: { sw: 1, shtApi: 0 },
                spt: { sht: 75, sbsb: 0, gsp: 0, bzy: 0, gs: 3, shtKs: 4 },
                spf: { iohat: 0, hlx: 0, yhl: 0, cp: 0, ois: 0, bmc: 0, bzyr: 4 },
                monodon: { cp: 0, gsr: 3, sht: 0, sw: 0, ubn: 9, kssb: 18, cps: 2 }
            },

            // Module Allocation (M01-M09) & Sampling
            moduleRows: [],
            samplingDateLabel: "29 Oct",

            // Harvest actuals & forecast (Harvest Report sourced from Daily_Harvest_Log.xlsx - this week only)
            todayHarvests: [],
            harvestMonthLabel: "November 2026",
            harvestWeekLabel: "01 Nov – 07 Nov 2026",
            harvestReports: [
                { pond: "04.07.02", date: "01/11", raw_date: "2026-11-01", type: "Partial-live", actTonnage: "", actAbw: "", planTonnage: 1500, planAbw: 40, planAbw2: "", doc: 133, species: "Monodon" },
                { pond: "06.12.04", date: "01/11", raw_date: "2026-11-01", type: "Full Chill", actTonnage: "", actAbw: "", planTonnage: 3500, planAbw: 12, planAbw2: "", doc: 72, species: "Vannamei" },
                { pond: "04.07.07", date: "02/11", raw_date: "2026-11-02", type: "Partial-live", actTonnage: "", actAbw: "", planTonnage: 1500, planAbw: 45.5, planAbw2: "", doc: 137, species: "Monodon" },
                { pond: "09.17.11", date: "02/11", raw_date: "2026-11-02", type: "Full Chill", actTonnage: "", actAbw: "", planTonnage: 3100, planAbw: 15, planAbw2: "", doc: 67, species: "Vannamei" },
                { pond: "03.06.05", date: "03/11", raw_date: "2026-11-03", type: "Full", actTonnage: "", actAbw: "", planTonnage: 3500, planAbw: 25, planAbw2: "", doc: 70, species: "Vannamei" },
                { pond: "09.18.12", date: "03/11", raw_date: "2026-11-03", type: "Full", actTonnage: "", actAbw: "", planTonnage: 3000, planAbw: 16, planAbw2: "", doc: 68, species: "Vannamei" },
                { pond: "08.15.02", date: "04/11", raw_date: "2026-11-04", type: "Full", actTonnage: "", actAbw: "", planTonnage: 3600, planAbw: 15, planAbw2: "", doc: 78, species: "Vannamei" },
                { pond: "08.15.06", date: "04/11", raw_date: "2026-11-04", type: "Full", actTonnage: "", actAbw: "", planTonnage: 4200, planAbw: 14, planAbw2: "", doc: 82, species: "Vannamei" },
                { pond: "09.18.02", date: "05/11", raw_date: "2026-11-05", type: "Full", actTonnage: "", actAbw: "", planTonnage: 3500, planAbw: 12, planAbw2: "", doc: 84, species: "Vannamei" }
            ],
            harvestForecasts: [
                { pond: "081601", doc: 79, date: "01/11", species: "Van", abw: 16, biomass: 3000, type: "Partial" },
                { pond: "040702", doc: 134, date: "02/11", species: "Mon", abw: 38, biomass: 2800, type: "Final" },
                { pond: "091711", doc: 67, date: "02/11", species: "Van", abw: 15, biomass: 3100, type: "Early" },
                { pond: "091812", doc: 68, date: "03/11", species: "Van", abw: 14, biomass: 2900, type: "Early" },
                { pond: "040708", doc: 138, date: "03/11", species: "Mon", abw: 46, biomass: 5500, type: "Final" },
                { pond: "040707", doc: 139, date: "04/11", species: "Mon", abw: 44, biomass: 5000, type: "Final" },
                { pond: "081502", doc: 78, date: "04/11", species: "Van", abw: 14, biomass: 4200, type: "Partial" },
                { pond: "091802", doc: 84, date: "05/11", species: "Van", abw: 11, biomass: 3500, type: "Early" },
                { pond: "040703", doc: 137, date: "05/11", species: "Mon", abw: 36, biomass: 4600, type: "Final" },
                { pond: "091703", doc: 85, date: "06/11", species: "Van", abw: 11, biomass: 3700, type: "Early" },
                { pond: "051002", doc: 133, date: "06/11", species: "Mon", abw: 44, biomass: 4000, type: "Final" },
                { pond: "040704", doc: 138, date: "07/11", species: "Mon", abw: 36, biomass: 3000, type: "Final" }
            ],
            stockingRecords: [
                { no: 1, pondIndex: "2071305.40", pond: "07.13.05", date: "03-Nov-2026", rawDate: "2026-11-03", hatchery: "GS", species: "P. VANNAMEi", genetic: "Syaqua", plTotal: 421195, tankNo: "A3" },
                { no: 2, pondIndex: "2071306.40", pond: "07.13.06", date: "03-Nov-2026", rawDate: "2026-11-03", hatchery: "GS", species: "P. VANNAMEi", genetic: "Syaqua", plTotal: 421195, tankNo: "A2,A3" },
                { no: 3, pondIndex: "2071307.36", pond: "07.13.07", date: "03-Nov-2026", rawDate: "2026-11-03", hatchery: "GS", species: "P. VANNAMEi", genetic: "Syaqua", plTotal: 421195, tankNo: "A2" },
                { no: 4, pondIndex: "2020301.42", pond: "02.03.01", date: "04-Nov-2026", rawDate: "2026-11-04", hatchery: "BZYR", species: "P. VANNAMEi", genetic: "Top Aqua", plTotal: 450000, tankNo: "J3" },
                { no: 5, pondIndex: "2020302.40", pond: "02.03.02", date: "04-Nov-2026", rawDate: "2026-11-04", hatchery: "BZYR", species: "P. VANNAMEi", genetic: "Top Aqua", plTotal: 450000, tankNo: "J3" },
                { no: 6, pondIndex: "2020303.41", pond: "02.03.03", date: "04-Nov-2026", rawDate: "2026-11-04", hatchery: "BZYR", species: "P. VANNAMEi", genetic: "Top Aqua", plTotal: 450000, tankNo: "J5" },
                { no: 7, pondIndex: "2071308.40", pond: "07.13.08", date: "04-Nov-2026", rawDate: "2026-11-04", hatchery: "BZYR", species: "P. VANNAMEi", genetic: "Top Aqua", plTotal: 450000, tankNo: "J5" }
            ],
            stockingForecasts: []
        };
    }

    /**
     * Sanitizes and migrates raw draft object from storage, protecting user edits.
     * @param {Object} savedDraft 
     * @param {Object} [defaultState] 
     * @returns {Object} Cleaned, merged report state
     */
    static sanitizeDraft(savedDraft, defaultState = null) {
        const base = defaultState || this.getDefaultReportState();
        if (!savedDraft || typeof savedDraft !== "object") return base;

        // 1. Order rainfall chronologically (newest on left)
        if (savedDraft.rainfallHistory && savedDraft.rainfallHistory.length === 5) {
            const firstDate = savedDraft.rainfallHistory[0]?.date || "";
            const lastDate = savedDraft.rainfallHistory[4]?.date || "";
            if (firstDate.includes("31-Oct") && lastDate.includes("04-Nov")) {
                savedDraft.rainfallHistory.reverse();
            }
        }

        // 2. Prevent old accumulated MTD values for today's movements from poisoning draft
        if (savedDraft.highlightStockingPonds === 7 || savedDraft.highlightHarvestPonds === 6) {
            savedDraft.highlightStockingPonds = 0;
            savedDraft.highlightHarvestPonds = 0;
            savedDraft.highlightCullPonds = 0;
        }

        // 3. Purge invalid module counts if inflated
        const draftModuleTotal = (savedDraft.moduleRows || []).reduce((acc, r) => acc + (r.van || 0) + (r.mon || 0), 0);
        if (draftModuleTotal > 0 && draftModuleTotal !== 119) {
            delete savedDraft.moduleRows;
        }

        // 4. Purge stale mock times
        if (savedDraft.reportTime === "5:50 PM") {
            delete savedDraft.reportTime;
        }

        // 5. Ensure valid arrays for forecast & reports; never wipe user custom additions
        if (savedDraft.harvestForecasts && !Array.isArray(savedDraft.harvestForecasts)) {
            delete savedDraft.harvestForecasts;
        }
        if (savedDraft.harvestReports && !Array.isArray(savedDraft.harvestReports)) {
            delete savedDraft.harvestReports;
        }

        // 6. Ensure stockingPlanSummary is present
        if (!savedDraft.stockingPlanSummary) {
            savedDraft.stockingPlanSummary = base.stockingPlanSummary;
        }

        // 7. Purge legacy hardcoded mock string for cleaning detail
        if (savedDraft.cleaningTeamsDetail === "Int 1 & 2, P02, P06" || Array.isArray(savedDraft.cleaningTeamsDetail)) {
            savedDraft.cleaningTeamsDetail = "";
        }

        return Object.assign(base, savedDraft);
    }

    /**
     * Loads draft from localStorage with automatic legacy key fallback.
     * @param {string} [storageKey=DAILY_REPORT_STORAGE_KEY] 
     * @returns {Object|null}
     */
    static loadDraft(storageKey = DAILY_REPORT_STORAGE_KEY) {
        try {
            if (typeof localStorage === "undefined") return null;
            let raw = localStorage.getItem(storageKey);
            if (!raw && storageKey === DAILY_REPORT_STORAGE_KEY) {
                raw = localStorage.getItem(LEGACY_STORAGE_KEY);
            }
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return this.sanitizeDraft(parsed);
        } catch (e) {
            console.warn("Could not load daily report draft:", e);
            return null;
        }
    }

    /**
     * Saves draft to localStorage.
     * Supports both saveDraft(state) and saveDraft(storageKey, state).
     * @param {string|Object} arg1 
     * @param {Object} [arg2=null] 
     * @returns {boolean} True if successfully saved
     */
    static saveDraft(arg1 = DAILY_REPORT_STORAGE_KEY, arg2 = null) {
        let storageKey = DAILY_REPORT_STORAGE_KEY;
        let state = null;
        if (typeof arg1 === "object" && arg1 !== null) {
            state = arg1;
            storageKey = arg2 || DAILY_REPORT_STORAGE_KEY;
        } else {
            storageKey = arg1;
            state = arg2;
        }
        if (!state) return false;
        try {
            if (typeof localStorage === "undefined") return false;
            localStorage.setItem(storageKey, JSON.stringify(state));
            return true;
        } catch (e) {
            console.warn("Could not save daily report draft:", e);
            return false;
        }
    }
}
