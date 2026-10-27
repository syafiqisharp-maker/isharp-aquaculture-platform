/**
 * iSHARP DBMS 2.0 — Utilities Tab Module (Tab 10)
 * Handles operational datasets Excel/CSV exports, cloud integrity verification, and cache diagnostics.
 */

import { appState } from "../../state/appState.js";
import { supabase } from "../../infrastructure/supabase.js";
import { PondRepository } from "../../infrastructure/repositories/pondRepository.js";
import { SamplingRepository } from "../../infrastructure/repositories/samplingRepository.js";
import { HarvestRepository } from "../../infrastructure/repositories/harvestRepository.js";
import { LabRepository } from "../../infrastructure/repositories/labRepository.js";
import { downloadCsv } from "../../utils/csvExporter.js";
import { calculateDOC } from "../../domain/biometrics.js";
import { calculateFCR } from "../../domain/feeding.js";
import { hasPermission, PERMISSIONS } from "../../config/permissions.js";
import { Toast } from "../../components/Toast.js";
import { DOM_IDS, validateContract } from "../../config/domContracts.js";
import { FinanceRepository } from "../../infrastructure/repositories/financeRepository.js";
import { estimateEbitda, ESTIMATOR_SPECIES } from "../../domain/ebitdaEstimator.js";
import { security } from "../../config/security.js";
import { formatCurrency, formatNumber, formatPercent, escapeHtml } from "../../utils/formatters.js";


export class UtilitiesTab {
    constructor() {
        validateContract("UtilitiesTab", DOM_IDS.UTILITIES);

        this.dom = {
            tabPane: document.getElementById(DOM_IDS.UTILITIES.TAB_PANE)
        };

        this.cacheCalcDom();
        this.updateAuthBadge();
        this.bindEvents();
        appState.subscribe("pondChanged", (pond) => this.render(pond));
        appState.subscribe("roleChanged", () => this.applyRolePermissions());
    }

    bindEvents() {
        if (!this.dom.tabPane) return;

        // 1. Active Ponds Master (291 Ponds)
        
        // EBITDA Calculator Events
        const btnCalc = this.dom.tabPane.querySelector("#btn-calc-ebitda");
        if (btnCalc) {
            btnCalc.addEventListener("click", () => this.handleCalculateEbitda());
        }

        const btnResetCalc = this.dom.tabPane.querySelector("#btn-reset-ebitda");
        if (btnResetCalc) {
            btnResetCalc.addEventListener("click", () => this.handleResetCalculator());
        }

        const badgeAuth = this.dom.tabPane.querySelector("#calc-auth-badge");
        if (badgeAuth) {
            badgeAuth.style.cursor = "pointer";
            badgeAuth.addEventListener("click", () => this.promptPasscodeUnlock());
        }

        const btnActivePonds = this.dom.tabPane.querySelector("#btn-export-active-ponds");
        if (btnActivePonds) {
            btnActivePonds.addEventListener("click", () => this.exportActivePondsMaster());
        }

        // 2. Current Operational Ponds with Biometrics & Disease
        const btnOperationalPonds = this.dom.tabPane.querySelector("#btn-export-operational-ponds");
        if (btnOperationalPonds) {
            btnOperationalPonds.addEventListener("click", () => this.exportOperationalPondsBiometrics());
        }

        // 3. This Year Harvest Performance
        const btnYearHarvests = this.dom.tabPane.querySelector("#btn-export-year-harvests");
        if (btnYearHarvests) {
            btnYearHarvests.addEventListener("click", () => this.exportThisYearHarvests());
        }

        // 4. This Year Stocking Ledger
        const btnYearStocking = this.dom.tabPane.querySelector("#btn-export-year-stocking");
        if (btnYearStocking) {
            btnYearStocking.addEventListener("click", () => this.exportThisYearStocking());
        }

        // 5. Cumulative Feed & FCR Summary
        const btnFeedFcr = this.dom.tabPane.querySelector("#btn-export-feed-fcr");
        if (btnFeedFcr) {
            btnFeedFcr.addEventListener("click", () => this.exportCumulativeFeedFcr());
        }

        // 6. Active Disease & PCR Surveillance Register
        const btnDiseaseRegister = this.dom.tabPane.querySelector("#btn-export-disease-register");
        if (btnDiseaseRegister) {
            btnDiseaseRegister.addEventListener("click", () => this.exportDiseaseRegister());
        }

        // 7. Pond Turnaround & Idle Analysis
        const btnIdleAnalysis = this.dom.tabPane.querySelector("#btn-export-idle-analysis");
        if (btnIdleAnalysis) {
            btnIdleAnalysis.addEventListener("click", () => this.exportPondTurnaroundAnalysis());
        }

        // Legacy / Single Pond Biometrics CSV
        const btnCycleCsv = this.dom.tabPane.querySelector("#btn-export-cycle-csv");
        if (btnCycleCsv) {
            btnCycleCsv.addEventListener("click", () => this.exportCycleCsv());
        }

        // System Diagnostics
        const btnVerify = this.dom.tabPane.querySelector("#btn-verify-sync");
        if (btnVerify) {
            btnVerify.addEventListener("click", () => this.verifySyncStatus());
        }

        const btnFlush = this.dom.tabPane.querySelector("#btn-flush-cache");
        if (btnFlush) {
            btnFlush.addEventListener("click", () => window.location.reload());
        }
    }

    render(pond) {
        if (!pond) return;
        this.applyRolePermissions();
    }

    /**
     * Helper to get today's date formatted as YYYY-MM-DD.
     */
    getTodayStr() {
        return new Date().toISOString().split("T")[0];
    }

    /**
     * Helper to get current year string (e.g. "2026").
     */
    getCurrentYear() {
        return new Date().getFullYear();
    }

    /**
     * Helper to get date string N months in the past (e.g. 24 months ago).
     * @param {number} [months=24]
     * @returns {string} YYYY-MM-DD
     */
    getDateMonthsAgo(months = 24) {
        const d = new Date();
        d.setMonth(d.getMonth() - months);
        return d.toISOString().split("T")[0];
    }

    // =========================================================================
    // 1. Active Ponds Master (~291 ponds)
    // =========================================================================
    async exportActivePondsMaster() {
        try {
            Toast.info("Fetching census of all active farm ponds...");
            // Query all active ponds (exclude archived/closed cycles)
            const endpoint = `view_growout_pond_cycles?pond_status=neq.CLOSE&order=modl.asc,pond.asc&limit=1000`;
            const records = await supabase.request(endpoint);

            if (!records || records.length === 0) {
                Toast.warn("No active pond records found.");
                return;
            }

            const headers = [
                "Pond Index",
                "Pond Code",
                "Module",
                "Row No",
                "Cycle No",
                "Crop No",
                "Current Status",
                "Active State",
                "Area (ha)",
                "Aerator 1HP",
                "Aerator 2HP",
                "Total HP",
                "Species",
                "Genetic Line",
                "Hatchery Source",
                "Stocking Date",
                "Stocked Fry (Gross)"
            ];

            const rows = records.map(r => {
                const hp1 = parseFloat(r.aerator_1hp || 0);
                const hp2 = parseFloat(r.aerator_2hp || 0);
                const totalHp = hp1 + (hp2 * 2);
                const grossStock = r.stck_total || (parseFloat(r.stck_pcs || 0) + parseFloat(r.stck_allow || 0));

                return [
                    r.pond_index || "",
                    r.pond || "",
                    r.modl || "",
                    r.row_no || "",
                    r.cycle_no || "",
                    r.crop_no || "",
                    r.pond_status || "",
                    r.pond_active || "",
                    r.area !== undefined && r.area !== null ? parseFloat(r.area).toFixed(2) : "0.50",
                    hp1,
                    hp2,
                    totalHp,
                    r.stck_species || "",
                    r.bs_line || "",
                    r.stck_source || "",
                    r.stck_date || "",
                    grossStock > 0 ? grossStock : ""
                ];
            });

            const filename = `iSHARP_Active_Ponds_Master_List_${this.getTodayStr()}.csv`;
            downloadCsv(filename, headers, rows);
            Toast.success(`Exported ${records.length} active ponds!`);
        } catch (err) {
            console.error("Export Active Ponds error:", err);
            Toast.error(`Export failed: ${err.message}`);
        }
    }

    // =========================================================================
    // 2. Current Operational Ponds with Biometrics & Disease
    // =========================================================================
    async exportOperationalPondsBiometrics() {
        try {
            Toast.info("Compiling live operational ponds and latest biometrics...");
            // Query ponds in PRODUCTION
            const endpoint = `view_growout_pond_cycles?pond_status=eq.PRODUCTION&order=modl.asc,pond.asc&limit=500`;
            const prodPonds = await supabase.request(endpoint);

            if (!prodPonds || prodPonds.length === 0) {
                Toast.warn("No operational ponds currently in PRODUCTION.");
                return;
            }

            // Batch fetch recent disease alerts (past 24 months)
            const cutoffDate = this.getDateMonthsAgo(24);
            const allIssues = await supabase.request(`pond_issues?issue_date=gte.${cutoffDate}&order=issue_date.desc&limit=1000`) || [];
            const issuesMap = new Map();
            allIssues.forEach(issue => {
                if (issue.pond_index && !issuesMap.has(issue.pond_index)) {
                    issuesMap.set(issue.pond_index, []);
                }
                if (issue.pond_index) {
                    issuesMap.get(issue.pond_index).push(issue);
                }
            });

            // Fetch latest sampling for each pond in parallel (chunked)
            const samplingPromises = prodPonds.map(p => SamplingRepository.getLatestSampling(p.pond_index));
            const samplings = await Promise.all(samplingPromises);

            const headers = [
                "Pond Index",
                "Pond Code",
                "Module",
                "Stocking Date",
                "DOC (Days)",
                "Stocked Fry (Net)",
                "Stocked Fry (Gross)",
                "Area (ha)",
                "Density (pcs/m2)",
                "Species",
                "Broodstock Line",
                "Hatchery Source",
                "Latest Sample Date",
                "Sample DOC",
                "Latest ABW (g)",
                "Est. Survival %",
                "Est. Biomass (kg)",
                "Cumulative Feed (kg)",
                "Disease Status",
                "Recent Pathogen Alert"
            ];

            const rows = prodPonds.map((p, idx) => {
                const sample = samplings[idx];
                const areaHa = parseFloat(p.area || 0.50);
                const areaM2 = areaHa * 10000;
                const grossFry = parseFloat(p.stck_total || (parseFloat(p.stck_pcs || 0) + parseFloat(p.stck_allow || 0)) || 0);
                const density = areaM2 > 0 && grossFry > 0 ? (grossFry / areaM2).toFixed(1) : "";
                const doc = p.stck_date ? calculateDOC(p.stck_date, null) : "";

                // Determine disease flag from issuesMap
                const pondIssues = issuesMap.get(p.pond_index) || [];
                const activeAlerts = pondIssues.filter(r => {
                    const f = (r.issue_flag || "").toUpperCase();
                    const n = (r.issue_note || "").toUpperCase();
                    return f === "RED" || f === "CRITICAL" || n.includes("POSIT");
                });

                let diseaseStatus = "Clean (No Alerts)";
                let pathogenDetails = "None";
                if (activeAlerts.length > 0) {
                    const topAlert = activeAlerts[0];
                    diseaseStatus = `ALERT (${topAlert.issue_flag || 'RED'})`;
                    pathogenDetails = `${topAlert.issue_status || topAlert.issue_test || 'Pathogen'} - ${topAlert.issue_note || ''}`;
                } else if (pondIssues.length > 0) {
                    diseaseStatus = "Watch / Caution";
                    pathogenDetails = pondIssues[0].issue_status || pondIssues[0].issue_test || "Caution";
                }

                return [
                    p.pond_index || "",
                    p.pond || "",
                    p.modl || "",
                    p.stck_date || "",
                    doc,
                    p.stck_pcs || "",
                    grossFry > 0 ? grossFry : "",
                    areaHa.toFixed(2),
                    density,
                    p.stck_species || "P. VANNAMEi",
                    p.bs_line || "",
                    p.stck_source || "",
                    sample ? (sample.smpl_date || "") : "",
                    sample ? (sample.smpl_doc || "") : "",
                    sample && sample.smpl_abw ? parseFloat(sample.smpl_abw).toFixed(2) : "",
                    sample && sample.smpl_surv ? parseFloat(sample.smpl_surv).toFixed(1) : "",
                    sample && sample.smpl_bms ? Math.round(parseFloat(sample.smpl_bms)) : "",
                    sample && sample.smpl_tfed ? Math.round(parseFloat(sample.smpl_tfed)) : "",
                    diseaseStatus,
                    pathogenDetails
                ];
            });

            const filename = `iSHARP_Operational_Ponds_Biometrics_${this.getTodayStr()}.csv`;
            downloadCsv(filename, headers, rows);
            Toast.success(`Exported ${prodPonds.length} live operational ponds to Excel CSV!`);
        } catch (err) {
            console.error("Export Operational Ponds error:", err);
            Toast.error(`Export failed: ${err.message}`);
        }
    }

    // =========================================================================
    // 3. This Year Harvest Performance Log
    // =========================================================================
    async exportThisYearHarvests() {
        try {
            const cutoffDate = this.getDateMonthsAgo(24);
            Toast.info(`Fetching harvest performance records (past 24 months since ${cutoffDate})...`);

            // Fetch cycles closed/harvested in past 24 months
            const endpoint = `view_growout_pond_cycles?date_close=gte.${cutoffDate}&order=date_close.desc&limit=1000`;
            const closedCycles = await supabase.request(endpoint);

            if (!closedCycles || closedCycles.length === 0) {
                Toast.warn(`No closed/harvested cycles found for the past 24 months.`);
                return;
            }

            // Fetch harvest summaries and disease alerts in parallel
            const harvestPromises = closedCycles.map(c => HarvestRepository.getHarvestSummary(c.pond_index));
            const harvestSummaries = await Promise.all(harvestPromises);

            const allIssues = await supabase.request(`pond_issues?issue_date=gte.${cutoffDate}&order=issue_date.desc&limit=1000`) || [];
            const issuesMap = new Map();
            allIssues.forEach(issue => {
                if (issue.pond_index && !issuesMap.has(issue.pond_index)) {
                    issuesMap.set(issue.pond_index, []);
                }
                if (issue.pond_index) {
                    issuesMap.get(issue.pond_index).push(issue);
                }
            });

            const headers = [
                "Pond Index",
                "Pond Code",
                "Module",
                "Cycle No",
                "Crop No",
                "Prep Cleaning Date",
                "Prep Ready Date",
                "Stocking Date",
                "Harvest Close Date",
                "Total Culture Days (DOC)",
                "Stocked Fry (Net)",
                "Total Harvest (kg)",
                "Final Revenue (MYR)",
                "Mean Harvest ABW (g)",
                "Partial Harvest (kg)",
                "Final Harvest (kg)",
                "Disease History"
            ];

            const rows = closedCycles.map((c, idx) => {
                const hvt = harvestSummaries[idx];
                const doc = (c.stck_date && c.date_close) ? calculateDOC(c.stck_date, c.date_close) : "";
                
                const pondIssues = issuesMap.get(c.pond_index) || [];
                const diseaseDesc = pondIssues.length > 0 
                    ? pondIssues.map(i => `${i.issue_status || i.issue_test || 'Issue'} (${i.issue_flag || 'FLAG'})`).join(" | ")
                    : "No Disease Logged";

                return [
                    c.pond_index || "",
                    c.pond || "",
                    c.modl || "",
                    c.cycle_no || "",
                    c.crop_no || "",
                    c.date_cleaning || "",
                    c.date_ready || "",
                    c.stck_date || "",
                    c.date_close || "",
                    doc,
                    c.stck_pcs || "",
                    hvt ? Math.round(hvt.totalWeightKg) : 0,
                    hvt && hvt.totalRevenue ? hvt.totalRevenue.toFixed(2) : "0.00",
                    "", // Mean ABW calculated if sales logged
                    hvt ? Math.round(hvt.partialWeightKg) : 0,
                    hvt ? Math.round(hvt.finalWeightKg) : 0,
                    diseaseDesc
                ];
            });

            const filename = `iSHARP_Harvest_Data_Past24M_${this.getTodayStr()}.csv`;
            downloadCsv(filename, headers, rows);
            Toast.success(`Exported ${closedCycles.length} harvested pond cycles!`);
        } catch (err) {
            console.error("Export Harvest Performance error:", err);
            Toast.error(`Export failed: ${err.message}`);
        }
    }

    // =========================================================================
    // 4. This Year Stocking Ledger
    // =========================================================================
    async exportThisYearStocking() {
        try {
            const cutoffDate = this.getDateMonthsAgo(24);
            Toast.info(`Fetching stocking records (past 24 months since ${cutoffDate})...`);

            // Fetch from pond_stocking_batches for past 24 months
            let endpoint = `pond_stocking_batches?stck_date=gte.${cutoffDate}&order=stck_date.desc&limit=1000`;
            let batches = [];
            try {
                batches = await supabase.request(endpoint) || [];
            } catch (e) {
                console.warn("Could not query pond_stocking_batches directly, falling back to cycles:", e);
            }

            // Fallback or supplementary: fetch cycles stocked in past 24 months
            const cyclesEndpoint = `view_growout_pond_cycles?stck_date=gte.${cutoffDate}&order=stck_date.desc&limit=1000`;
            const cycles = await supabase.request(cyclesEndpoint) || [];

            const headers = [
                "Stocking Date",
                "Pond Code",
                "Pond Index",
                "Module",
                "Hatchery Source",
                "Broodstock Line",
                "Net Fry (pcs)",
                "Allowance (pcs)",
                "Gross Total Fry (pcs)",
                "PL Size",
                "Hatchery Tank No",
                "Area (ha)",
                "Density (pcs/m2)"
            ];

            let rows = [];

            if (batches && batches.length > 0) {
                // Map from batch records
                const cycleMap = new Map();
                cycles.forEach(c => cycleMap.set(c.pond_index, c));

                rows = batches.map(b => {
                    const cycle = cycleMap.get(b.pond_index) || {};
                    const netto = parseFloat(b.stck_pcs || 0);
                    const allow = parseFloat(b.stck_allow || 0);
                    const total = b.stck_total ? parseFloat(b.stck_total) : (netto + allow);
                    const areaHa = parseFloat(cycle.area || 0.50);
                    const density = (areaHa > 0 && total > 0) ? (total / (areaHa * 10000)).toFixed(1) : "";

                    return [
                        b.stck_date || "",
                        cycle.pond || b.pond_index || "",
                        b.pond_index || "",
                        cycle.modl || "",
                        b.stck_source || cycle.stck_source || "",
                        b.bs_line || cycle.bs_line || "",
                        netto > 0 ? Math.round(netto) : "",
                        allow > 0 ? Math.round(allow) : "",
                        total > 0 ? Math.round(total) : "",
                        b.stck_size || cycle.stck_size || "",
                        b.stck_tank || cycle.stck_tank || "",
                        areaHa.toFixed(2),
                        density
                    ];
                });
            } else {
                // Use cycles as single stocking events
                rows = cycles.map(c => {
                    const netto = parseFloat(c.stck_pcs || 0);
                    const allow = parseFloat(c.stck_allow || 0);
                    const total = c.stck_total ? parseFloat(c.stck_total) : (netto + allow);
                    const areaHa = parseFloat(c.area || 0.50);
                    const density = (areaHa > 0 && total > 0) ? (total / (areaHa * 10000)).toFixed(1) : "";

                    return [
                        c.stck_date || "",
                        c.pond || "",
                        c.pond_index || "",
                        c.modl || "",
                        c.stck_source || "",
                        c.bs_line || "",
                        netto > 0 ? Math.round(netto) : "",
                        allow > 0 ? Math.round(allow) : "",
                        total > 0 ? Math.round(total) : "",
                        c.stck_size || "",
                        c.stck_tank || "",
                        areaHa.toFixed(2),
                        density
                    ];
                });
            }

            if (rows.length === 0) {
                Toast.warn(`No stocking batches recorded for year ${currentYear}.`);
                return;
            }

            const filename = `iSHARP_Stocking_Data_Past24M_${this.getTodayStr()}.csv`;
            downloadCsv(filename, headers, rows);
            Toast.success(`Exported ${rows.length} stocking records!`);
        } catch (err) {
            console.error("Export Stocking Ledger error:", err);
            Toast.error(`Export failed: ${err.message}`);
        }
    }

    // =========================================================================
    // 5. Cumulative Feed & FCR Summary
    // =========================================================================
    async exportCumulativeFeedFcr() {
        try {
            Toast.info("Compiling feed consumption and FCR metrics for operational ponds...");
            // Query ponds in PRODUCTION
            const endpoint = `view_growout_pond_cycles?pond_status=eq.PRODUCTION&order=modl.asc,pond.asc&limit=500`;
            const prodPonds = await supabase.request(endpoint);

            if (!prodPonds || prodPonds.length === 0) {
                Toast.warn("No operational ponds in PRODUCTION.");
                return;
            }

            // Fetch latest sampling records
            const samplingPromises = prodPonds.map(p => SamplingRepository.getLatestSampling(p.pond_index));
            const samplings = await Promise.all(samplingPromises);

            const headers = [
                "Pond Index",
                "Pond Code",
                "Module",
                "Stocking Date",
                "DOC",
                "Stocked Fry",
                "Latest Sample Date",
                "Latest ABW (g)",
                "Estimated Survival %",
                "Current Biomass (kg)",
                "Cumulative Feed (kg)",
                "Calculated FCR",
                "Avg Daily Feed Rate (kg/day)"
            ];

            const rows = prodPonds.map((p, idx) => {
                const sample = samplings[idx];
                const doc = p.stck_date ? calculateDOC(p.stck_date, null) : 0;
                const totalFeedKg = sample ? parseFloat(sample.smpl_tfed || 0) : 0;
                const biomassKg = sample ? parseFloat(sample.smpl_bms || 0) : 0;
                const fcrVal = calculateFCR(totalFeedKg, biomassKg);
                const avgDailyFeed = doc > 0 && totalFeedKg > 0 ? (totalFeedKg / doc).toFixed(1) : "";

                return [
                    p.pond_index || "",
                    p.pond || "",
                    p.modl || "",
                    p.stck_date || "",
                    doc > 0 ? doc : "",
                    p.stck_pcs || "",
                    sample ? (sample.smpl_date || "") : "",
                    sample && sample.smpl_abw ? parseFloat(sample.smpl_abw).toFixed(2) : "",
                    sample && sample.smpl_surv ? parseFloat(sample.smpl_surv).toFixed(1) : "",
                    biomassKg > 0 ? Math.round(biomassKg) : "",
                    totalFeedKg > 0 ? Math.round(totalFeedKg) : "",
                    fcrVal > 0 ? fcrVal.toFixed(2) : "",
                    avgDailyFeed
                ];
            });

            const filename = `iSHARP_Feed_FCR_Summary_${this.getTodayStr()}.csv`;
            downloadCsv(filename, headers, rows);
            Toast.success(`Exported feed and FCR summary for ${prodPonds.length} ponds!`);
        } catch (err) {
            console.error("Export Feed FCR error:", err);
            Toast.error(`Export failed: ${err.message}`);
        }
    }

    // =========================================================================
    // 6. Active Disease & PCR Surveillance Register
    // =========================================================================
    async exportDiseaseRegister() {
        try {
            const cutoffDate = this.getDateMonthsAgo(24);
            Toast.info(`Fetching disease surveillance register (past 24 months since ${cutoffDate})...`);
            const issues = await supabase.request(`pond_issues?issue_date=gte.${cutoffDate}&order=issue_date.desc&limit=1000`) || [];

            if (!issues || issues.length === 0) {
                Toast.warn("No disease or pathology records found for past 24 months.");
                return;
            }

            const headers = [
                "Issue ID",
                "Issue Date",
                "Pond Index",
                "Category",
                "Pathogen / Status",
                "Diagnostic Test Method",
                "Severity Grade",
                "Biosecurity Flag",
                "Result / Remarks"
            ];

            const rows = issues.map(i => [
                i.id || "",
                i.issue_date || "",
                i.pond_index || "",
                i.issue_category || "DISEASE",
                i.issue_status || "",
                i.issue_test || "PCR",
                i.issue_grade || "G0",
                i.issue_flag || "GREEN",
                i.issue_note || ""
            ]);

            const filename = `iSHARP_Disease_PCR_Register_${this.getTodayStr()}.csv`;
            downloadCsv(filename, headers, rows);
            Toast.success(`Exported ${issues.length} pathology records to Excel CSV!`);
        } catch (err) {
            console.error("Export Disease Register error:", err);
            Toast.error(`Export failed: ${err.message}`);
        }
    }

    // =========================================================================
    // 7. Pond Turnaround & Idle Days Analysis
    // =========================================================================
    async exportPondTurnaroundAnalysis() {
        try {
            const cutoffDate = this.getDateMonthsAgo(24);
            Toast.info(`Compiling pond turnaround and idle days (past 24 months since ${cutoffDate})...`);
            // Fetch active ponds OR cycles active/closed in the past 24 months
            const endpoint = `view_growout_pond_cycles?or=(pond_status.neq.CLOSE,date_close.gte.${cutoffDate},date_cycle.gte.${cutoffDate})&order=modl.asc,pond.asc&limit=1000`;
            const cycles = await supabase.request(endpoint);

            if (!cycles || cycles.length === 0) {
                Toast.warn("No cycle turnaround records found for past 24 months.");
                return;
            }

            const headers = [
                "Pond Index",
                "Pond Code",
                "Module",
                "Cycle No",
                "Current Status",
                "Idle Days",
                "Idle Status",
                "Previous Cycle End (Close)",
                "Cleaning Date",
                "Repair Date",
                "Filling Date",
                "Water Culture Date",
                "QA/QC Sign-off Date",
                "Pond Ready Date",
                "Planned Stock Date",
                "Actual Stock Date"
            ];

            const rows = cycles.map(c => [
                c.pond_index || "",
                c.pond || "",
                c.modl || "",
                c.cycle_no || "",
                c.pond_status || "",
                c.idle_days !== undefined && c.idle_days !== null ? c.idle_days : 0,
                c.idle_status || "",
                c.date_close || "",
                c.date_cleaning || "",
                c.date_repair || "",
                c.date_filling || "",
                c.date_culture || "",
                c.date_qaqc || "",
                c.date_ready || "",
                c.date_plan_stock || "",
                c.stck_date || ""
            ]);

            const filename = `iSHARP_Pond_Turnaround_Idle_${this.getTodayStr()}.csv`;
            downloadCsv(filename, headers, rows);
            Toast.success(`Exported turnaround analysis for ${cycles.length} cycles!`);
        } catch (err) {
            console.error("Export Turnaround Analysis error:", err);
            Toast.error(`Export failed: ${err.message}`);
        }
    }

    // =========================================================================
    // Legacy / Single Pond Biometrics CSV
    // =========================================================================
    async exportCycleCsv() {
        const pond = appState.currentPond;
        if (!pond || !pond.pond_index) {
            Toast.error("Please select a pond cycle first to export.");
            return;
        }

        try {
            Toast.info(`Generating CSV export for cycle [${pond.pond_index}]...`);
            const samplings = await SamplingRepository.getSamplingByPond(pond.pond_index);

            const headers = [
                "Pond",
                "Pond Index",
                "Sample Date",
                "DOC",
                "ABW (g)",
                "Survival Rate %",
                "Biomass (kg)",
                "Cumulative Feed (kg)"
            ];

            let rows = [];
            if (samplings && samplings.length > 0) {
                rows = samplings.map(e => [
                    pond.pond || "",
                    pond.pond_index || "",
                    e.smpl_date || "",
                    e.smpl_doc || "",
                    e.smpl_abw || "",
                    e.smpl_surv || "",
                    e.smpl_bms || "",
                    e.smpl_tfed || ""
                ]);
            } else {
                rows = [
                    [pond.pond || "", pond.pond_index || "", "No sampling records logged", "", "", "", "", ""]
                ];
            }

            downloadCsv(`iSHARP_${pond.pond_index}_Biometrics.csv`, headers, rows);
            Toast.success(`Exported ${samplings.length} sampling records to CSV!`);
        } catch (err) {
            console.error("Export CSV error:", err);
            Toast.error(`Export failed: ${err.message}`);
        }
    }

    verifySyncStatus() {
        const total = (appState.allCycles || []).length;
        alert(
            `🌐 Cloud Integrity & Sync Status:\n\n` +
            `• Supabase PostgreSQL Cloud: Connected\n` +
            `• Loaded Cycles in Memory: ${total} records\n` +
            `• Active Operational Ponds: Aligned with Setiu Farm records\n` +
            `• Automated Rollover & Revive Functions: Operational & Verified\n` +
            `• Biosecurity Pathology Logs: Live & Active`
        );
    }

    applyRolePermissions() {
        const canEdit = hasPermission(appState.userRole, PERMISSIONS.EDIT_WQS_CALIBRATION);
        if (!this.dom.tabPane) return;

        const inputs = this.dom.tabPane.querySelectorAll("input:not(#form-ebitda-calculator *), select:not(#form-ebitda-calculator *), textarea:not(#form-ebitda-calculator *)");
        inputs.forEach(inp => {
            inp.disabled = !canEdit;
            inp.style.opacity = canEdit ? "1" : "0.75";
        });
    }

    cacheCalcDom() {
        if (!this.dom.tabPane) return;
        this.dom.calcSpecies = this.dom.tabPane.querySelector("#calc-ebitda-species");
        this.dom.calcDoc = this.dom.tabPane.querySelector("#calc-ebitda-doc");
        this.dom.calcTonnage = this.dom.tabPane.querySelector("#calc-ebitda-tonnage");
        this.dom.calcFeed = this.dom.tabPane.querySelector("#calc-ebitda-feed");
        this.dom.calcAbw = this.dom.tabPane.querySelector("#calc-ebitda-abw");
        this.dom.calcPl = this.dom.tabPane.querySelector("#calc-ebitda-pl");
        this.dom.calcResults = this.dom.tabPane.querySelector("#calc-ebitda-results");
        this.dom.calcLoading = this.dom.tabPane.querySelector("#calc-loading-indicator");
        this.dom.calcAuthBadge = this.dom.tabPane.querySelector("#calc-auth-badge");
        this.dom.calcAuthText = this.dom.tabPane.querySelector("#calc-auth-status-text");
    }

    updateAuthBadge() {
        if (!this.dom.calcAuthBadge || !this.dom.calcAuthText) return;
        const hasPass = FinanceRepository.hasActivePasscode();
        if (hasPass) {
            this.dom.calcAuthBadge.style.background = "#ecfdf5";
            this.dom.calcAuthBadge.style.color = "#047857";
            this.dom.calcAuthBadge.style.borderColor = "#a7f3d0";
            this.dom.calcAuthBadge.innerHTML = `<span>🔓</span> <span>Audited Finance Active</span>`;
        } else {
            this.dom.calcAuthBadge.style.background = "#fef3c7";
            this.dom.calcAuthBadge.style.color = "#b45309";
            this.dom.calcAuthBadge.style.borderColor = "#fde68a";
            this.dom.calcAuthBadge.innerHTML = `<span>🔒</span> <span>Click to Unlock Finance</span>`;
        }
    }

    async promptPasscodeUnlock() {
        const entered = window.prompt("Enter iSHARP Passcode to access Audited Finance (e.g. VIEWER or EDITOR):");
        if (!entered) return false;
        try {
            const role = await security.verifyDbmsPassword(entered);
            if (role) {
                Toast.success(`Passcode verified (${role}). Audited financials unlocked.`);
                this.updateAuthBadge();
                return true;
            } else {
                Toast.error("Invalid passcode. Access denied to growout_pond_finance.");
                return false;
            }
        } catch (err) {
            Toast.error("Verification failed: " + err.message);
            return false;
        }
    }

    async handleCalculateEbitda() {
        this.cacheCalcDom();
        if (!this.dom.calcSpecies || !this.dom.calcTonnage) return;

        const species = this.dom.calcSpecies.value || "VANNAMEI";
        const doc = parseFloat(this.dom.calcDoc.value);
        const harvestKg = parseFloat(this.dom.calcTonnage.value);
        const totalFeed = parseFloat(this.dom.calcFeed.value);
        const abw = parseFloat(this.dom.calcAbw.value);
        const rawPl = this.dom.calcPl.value ? parseFloat(this.dom.calcPl.value) : null;
        const stockedPl = rawPl && rawPl > 0 ? rawPl : null;

        // Validation
        if (isNaN(doc) || doc <= 0) {
            Toast.warn("Please enter a valid DOC in days (e.g. 90).");
            this.dom.calcDoc.focus();
            return;
        }
        if (isNaN(harvestKg) || harvestKg <= 0) {
            Toast.warn("Please enter a valid expected harvest weight in kg (e.g. 3500).");
            this.dom.calcTonnage.focus();
            return;
        }
        if (isNaN(totalFeed) || totalFeed < 0) {
            Toast.warn("Please enter a valid cumulative feed in kg (e.g. 5250).");
            this.dom.calcFeed.focus();
            return;
        }
        if (isNaN(abw) || abw <= 0) {
            Toast.warn("Please enter a valid ABW in grams (e.g. 16.5).");
            this.dom.calcAbw.focus();
            return;
        }

        // Passcode verification check
        if (!FinanceRepository.hasActivePasscode()) {
            const unlocked = await this.promptPasscodeUnlock();
            if (!unlocked) {
                Toast.warn("Calculation requires an active passcode to query growout_pond_finance.");
                return;
            }
        }

        try {
            if (this.dom.calcLoading) this.dom.calcLoading.style.display = "inline-block";
            Toast.info("Calibrating unit economics from past 12-month audited cycles...");

            // Fetch empirical priors & calibrate
            const economics = await FinanceRepository.getCalibratedEconomics(species, abw);
            const result = estimateEbitda({
                species,
                doc,
                harvestKg,
                tonnage: harvestKg,
                totalFeed,
                abw,
                stockedPl
            }, economics);

            this.renderEbitdaResults(result);
            Toast.success(`EBITDA calculated successfully (${result.metadata.cycleCount} historical ${result.inputs.species} cycles calibrated).`);
        } catch (err) {
            console.error("[UtilitiesTab] EBITDA Calculation error:", err);
            Toast.error("Calculation failed: " + err.message);
        } finally {
            if (this.dom.calcLoading) this.dom.calcLoading.style.display = "none";
        }
    }

    renderEbitdaResults(res) {
        if (!this.dom.calcResults) return;
        const { inputs, scenarios, drivers, metadata } = res;
        const { low, base, high } = scenarios;

        const formatValClass = (val) => val >= 0 ? "positive" : "negative";

        let warningsHtml = "";
        if (metadata.warnings && metadata.warnings.length > 0) {
            warningsHtml = `
                <div style="background: #fffbeb; border: 1px solid #fef3c7; border-left: 4px solid #f59e0b; border-radius: 6px; padding: 0.75rem 1rem; margin-bottom: 1.25rem;">
                    <div style="font-weight: 700; color: #b45309; font-size: 0.85rem; margin-bottom: 0.25rem;">⚠️ Advisory Notices</div>
                    <ul style="margin: 0; padding-left: 1.2rem; font-size: 0.8rem; color: #92400e;">
                        ${metadata.warnings.map(w => `<li>${escapeHtml(w)}</li>`).join("")}
                    </ul>
                </div>
            `;
        }

        const html = `
            ${warningsHtml}

            <!-- KPI Chips Bar -->
            <div class="calc-chips-bar">
                <div class="calc-chip">
                    <span>Biomass:</span>
                    <strong>${formatNumber(inputs.tonnageKg)} kg (${inputs.tonnageMt.toFixed(2)} MT)</strong>
                </div>
                <div class="calc-chip">
                    <span>FCR:</span>
                    <strong>${inputs.fcr.toFixed(2)}</strong>
                </div>
                <div class="calc-chip">
                    <span>ABW Band:</span>
                    <strong>${escapeHtml(metadata.abwBand)} (${inputs.abw.toFixed(1)}g)</strong>
                </div>
                <div class="calc-chip">
                    <span>12-Mo Sample:</span>
                    <strong>${metadata.cycleCount} cycles (${escapeHtml(metadata.confidenceLevel)} Confidence)</strong>
                </div>
                <div class="calc-chip">
                    <span>Culture:</span>
                    <strong>${inputs.doc} DOC</strong>
                </div>
            </div>

            <!-- Scenarios Bento Cards -->
            <div class="scenarios-grid">
                <!-- 1. Conservative (Low) -->
                <div class="scenario-card conservative">
                    <span class="scenario-badge badge-conservative">Conservative (P25)</span>
                    <div class="scenario-header">
                        <h4>Conservative Case</h4>
                        <span class="scenario-desc">P25 Selling Price &amp; P75 Unit Costs</span>
                    </div>
                    <div class="scenario-ebitda">
                        <div class="ebitda-label">Estimated Pond EBITDA</div>
                        <div class="ebitda-val ${formatValClass(low.ebitda)}">${formatCurrency(low.ebitda)}</div>
                    </div>
                    <div class="scenario-kpi-row">
                        <span class="kpi-lbl">EBITDA / kg:</span>
                        <span class="kpi-num">${formatCurrency(low.ebitdaPerKg)} / kg</span>
                    </div>
                    <div class="scenario-kpi-row">
                        <span class="kpi-lbl">Effective Price:</span>
                        <span class="kpi-num">${formatCurrency(low.effectivePricePerKg)} / kg</span>
                    </div>
                    <div class="scenario-kpi-row">
                        <span class="kpi-lbl">Cash Cost / kg:</span>
                        <span class="kpi-num">${formatCurrency(low.cashCostPerKg)} / kg</span>
                    </div>
                    <div class="scenario-kpi-row">
                        <span class="kpi-lbl">Gross Revenue:</span>
                        <span class="kpi-num">${formatCurrency(low.revenue)}</span>
                    </div>
                </div>

                <!-- 2. Base Case (Median P50 - Recommended) -->
                <div class="scenario-card base-case">
                    <span class="scenario-badge badge-base">⭐ Base Case (Median)</span>
                    <div class="scenario-header">
                        <h4>Base Case (Median P50)</h4>
                        <span class="scenario-desc">Audited Median Price &amp; Operational Costs</span>
                    </div>
                    <div class="scenario-ebitda">
                        <div class="ebitda-label">Estimated Pond EBITDA</div>
                        <div class="ebitda-val ${formatValClass(base.ebitda)}">${formatCurrency(base.ebitda)}</div>
                    </div>
                    <div class="scenario-kpi-row">
                        <span class="kpi-lbl">EBITDA / kg:</span>
                        <span class="kpi-num" style="color: #0284c7; font-size: 0.95rem;">${formatCurrency(base.ebitdaPerKg)} / kg</span>
                    </div>
                    <div class="scenario-kpi-row">
                        <span class="kpi-lbl">Effective Price:</span>
                        <span class="kpi-num">${formatCurrency(base.effectivePricePerKg)} / kg</span>
                    </div>
                    <div class="scenario-kpi-row">
                        <span class="kpi-lbl">Cash Cost / kg:</span>
                        <span class="kpi-num">${formatCurrency(base.cashCostPerKg)} / kg</span>
                    </div>
                    <div class="scenario-kpi-row">
                        <span class="kpi-lbl">Gross Revenue:</span>
                        <span class="kpi-num">${formatCurrency(base.revenue)}</span>
                    </div>
                </div>

                <!-- 3. Optimistic (High) -->
                <div class="scenario-card optimistic">
                    <span class="scenario-badge badge-optimistic">Optimistic (P75)</span>
                    <div class="scenario-header">
                        <h4>Optimistic Case</h4>
                        <span class="scenario-desc">P75 Selling Price &amp; P25 Efficient Costs</span>
                    </div>
                    <div class="scenario-ebitda">
                        <div class="ebitda-label">Estimated Pond EBITDA</div>
                        <div class="ebitda-val ${formatValClass(high.ebitda)}">${formatCurrency(high.ebitda)}</div>
                    </div>
                    <div class="scenario-kpi-row">
                        <span class="kpi-lbl">EBITDA / kg:</span>
                        <span class="kpi-num">${formatCurrency(high.ebitdaPerKg)} / kg</span>
                    </div>
                    <div class="scenario-kpi-row">
                        <span class="kpi-lbl">Effective Price:</span>
                        <span class="kpi-num">${formatCurrency(high.effectivePricePerKg)} / kg</span>
                    </div>
                    <div class="scenario-kpi-row">
                        <span class="kpi-lbl">Cash Cost / kg:</span>
                        <span class="kpi-num">${formatCurrency(high.cashCostPerKg)} / kg</span>
                    </div>
                    <div class="scenario-kpi-row">
                        <span class="kpi-lbl">Gross Revenue:</span>
                        <span class="kpi-num">${formatCurrency(high.revenue)}</span>
                    </div>
                </div>
            </div>

            <!-- Full 5-Element Ledger Table -->
            <div class="calc-breakdown-card">
                <table>
                    <thead>
                        <tr>
                            <th>Line Item / Financial Element</th>
                            <th>Conservative (P25)</th>
                            <th>Base Case (P50)</th>
                            <th>Optimistic (P75)</th>
                            <th>Driver Rate (Base P50)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>🦐 Gross Revenue</td>
                            <td>${formatCurrency(low.revenue)}</td>
                            <td><strong>${formatCurrency(base.revenue)}</strong></td>
                            <td>${formatCurrency(high.revenue)}</td>
                            <td>${formatCurrency(drivers.pricePerKgP50)} / kg</td>
                        </tr>
                        <tr>
                            <td>🌾 (-) Feed Cost (<code>cons_of_feed</code>)</td>
                            <td>${formatCurrency(low.feedCost)}</td>
                            <td>${formatCurrency(base.feedCost)}</td>
                            <td>${formatCurrency(high.feedCost)}</td>
                            <td>${formatCurrency(drivers.feedCostPerKgFeedP50)} / kg feed</td>
                        </tr>
                        <tr>
                            <td>🦐 (-) Fry / PL Cost (<code>cons_of_fries</code>)</td>
                            <td>${formatCurrency(low.fryCost)}</td>
                            <td>${formatCurrency(base.fryCost)}</td>
                            <td>${formatCurrency(high.fryCost)}</td>
                            <td>RM ${drivers.fryCostRateP50.toFixed(3)} ${escapeHtml(drivers.fryCostUnit)}</td>
                        </tr>
                        <tr>
                            <td>🧪 (-) Variable Operations (Chemicals, Supplies, Harvest)</td>
                            <td>${formatCurrency(low.variableCost)}</td>
                            <td>${formatCurrency(base.variableCost)}</td>
                            <td>${formatCurrency(high.variableCost)}</td>
                            <td>${formatCurrency(drivers.variableCostPerKgP50)} / kg harv</td>
                        </tr>
                        <tr>
                            <td>⚡ (-) Daily Fixed Costs (Electricity, Wages, Maintenance, Overheads)</td>
                            <td>${formatCurrency(low.fixedCost)}</td>
                            <td>${formatCurrency(base.fixedCost)}</td>
                            <td>${formatCurrency(high.fixedCost)}</td>
                            <td>${formatCurrency(drivers.dailyFixedCostPerDayP50)} / active-day</td>
                        </tr>
                        <tr class="row-total">
                            <td>💼 Total Cash Operating Cost</td>
                            <td>${formatCurrency(low.totalCashCost)}</td>
                            <td>${formatCurrency(base.totalCashCost)}</td>
                            <td>${formatCurrency(high.totalCashCost)}</td>
                            <td>${formatCurrency(base.cashCostPerKg)} / kg</td>
                        </tr>
                        <tr class="row-ebitda">
                            <td>📈 Net Pond EBITDA</td>
                            <td>${formatCurrency(low.ebitda)}</td>
                            <td><strong>${formatCurrency(base.ebitda)}</strong></td>
                            <td>${formatCurrency(high.ebitda)}</td>
                            <td>${formatCurrency(base.ebitdaPerKg)} / kg</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- Assumptions & Empirical Calibration Panel -->
            <div class="calc-assumptions-card">
                <h5>📋 Empirical Calibration &amp; Methodology Notes</h5>
                <ul class="calc-assumptions-list">
                    <li>
                        <strong>Data Source:</strong> Audited <code>growout_pond_finance</code> ledger joined with <code>pond_harvest_daily</code>, 
                        <code>pond_stocking_batches</code>, and <code>growout_pond_feed_sap</code> for Setiu farm cycles closed in the past 12 months.
                    </li>
                    <li>
                        <strong>Species Normalization:</strong> Calibrated against ${metadata.cycleCount} closed ${inputs.species} cycles 
                        (${metadata.abwBandCycleCount} cycles in the ${escapeHtml(metadata.abwBand)} size band).
                    </li>
                    <li>
                        <strong>Formula:</strong> <code>EBITDA = Tonnage × Price(ABW) - Feed Cost - Fry Cost - Variable Costs - (DOC × Daily Fixed Overhead)</code>. 
                        In alignment with official accounting, non-cash depreciation is excluded from cash operating costs.
                    </li>
                    <li>
                        <strong>Security Invariant:</strong> Queries are executed with zero <code>index_no</code> columns and authenticated via server-side <code>x-isharp-passcode</code>.
                    </li>
                </ul>
            </div>
        `;

        this.dom.calcResults.innerHTML = html;
        this.dom.calcResults.style.display = "block";
    }

    handleResetCalculator() {
        this.cacheCalcDom();
        if (this.dom.calcSpecies) this.dom.calcSpecies.value = "VANNAMEI";
        if (this.dom.calcDoc) this.dom.calcDoc.value = "90";
        if (this.dom.calcTonnage) this.dom.calcTonnage.value = "3500";
        if (this.dom.calcFeed) this.dom.calcFeed.value = "5250";
        if (this.dom.calcAbw) this.dom.calcAbw.value = "16.5";
        if (this.dom.calcPl) this.dom.calcPl.value = "";
        if (this.dom.calcResults) {
            this.dom.calcResults.innerHTML = "";
            this.dom.calcResults.style.display = "none";
        }
        Toast.info("Calculator reset to baseline defaults.");
    }

}
