/**
 * iSHARP DBMS 2.0 — Daily Report Excel & Reconciliation Service
 * Handles Daily_Harvest_Log.xlsx synchronization, pond normalization,
 * and Whiteboard Forecast vs. Actuals Harvest discrepancy reconciliation.
 */

/**
 * Normalizes any pond notation (e.g. "040702", "04.07.02", "2040702.40", "04-07-02")
 * into the standard canonical 3-segment dot notation "04.07.02".
 * @param {string|number} str 
 * @returns {string} Canonical pond code "MM.RR.DD"
 */
export function normalizePondCode(str) {
    if (!str) return "";
    let s = String(str).trim();

    // 1. Match pond_index format: 2MMRRDD.xx e.g. 2040702.40
    const mIdx = s.match(/^2(\d{2})(\d{2})(\d{2})/);
    if (mIdx) {
        return `${mIdx[1]}.${mIdx[2]}.${mIdx[3]}`;
    }

    // 2. Pad 5-digit number to 6 digits (e.g. 40702 -> 040702)
    if (/^\d{5}$/.test(s)) {
        s = s.padStart(6, "0");
    }

    // 3. Match 6-digit plain format: MMRRDD e.g. 040702
    const m6 = s.match(/^(\d{2})(\d{2})(\d{2})$/);
    if (m6) {
        return `${m6[1]}.${m6[2]}.${m6[3]}`;
    }

    // 4. Match delimited format: MM.RR.DD or M.R.D
    const mDelim = s.match(/^(\d{1,2})[.\-\/_\s](\d{1,2})[.\-\/_\s](\d{1,2})$/);
    if (mDelim) {
        return `${mDelim[1].padStart(2, "0")}.${mDelim[2].padStart(2, "0")}.${mDelim[3].padStart(2, "0")}`;
    }

    return s;
}

export class DailyReportExcelService {
    /**
     * Standardizes pond codes to canonical MM.RR.DD dot notation.
     * @param {string|number} str 
     * @returns {string}
     */
    static normalizePondCode(str) {
        return normalizePondCode(str);
    }
    /**
     * Fetches weekly harvest log JSON (synced from Daily_Harvest_Log.xlsx).
     * @param {string} [url="/data/daily_harvest_log.json"]
     * @returns {Promise<{ count: number, week_label: string, harvestReports: Array<Object> }|null>}
     */
    static async fetchWeeklyHarvestLog(url = "/data/daily_harvest_log.json") {
        try {
            const res = await fetch(`${url}?t=${Date.now()}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            return {
                source_file: data.source_file || "",
                count: data.count || (data.harvestReports ? data.harvestReports.length : 0),
                week_label: data.week_label || "This Week",
                harvestReports: data.harvestReports || []
            };
        } catch (err) {
            console.warn("Could not fetch weekly harvest log JSON:", err);
            return null;
        }
    }

    /**
     * Cross-references Whiteboard Forecast ponds against Harvest Actuals and Plan records.
     * Evaluates completion, delays, and biomass/ABW variances.
     * 
     * @param {Array<Object>} forecasts - The 12 whiteboard forecast ponds
     * @param {Array<Object>} [harvestReports=[]] - Weekly harvest log records
     * @param {Array<Object>} [todayHarvests=[]] - Live daily harvests
     * @param {Date} [referenceDate=new Date()] - Reference date for overdue calculation
     * @returns {Array<Object>} Reconciled forecast items with variance metrics and badges
     */
    static reconcileForecastWithActuals(forecasts = [], harvestReports = [], todayHarvests = [], referenceDate = new Date()) {
        let actualTodayList = [];
        let refDate = new Date();

        if (todayHarvests instanceof Date) {
            refDate = todayHarvests;
            actualTodayList = [];
        } else if (Array.isArray(todayHarvests)) {
            actualTodayList = todayHarvests;
            refDate = referenceDate ? new Date(referenceDate) : new Date();
        } else {
            refDate = referenceDate ? new Date(referenceDate) : new Date();
        }

        // Build quick lookup map by normalized pond code
        const reportMap = new Map();

        // 1. Index harvestReports
        (harvestReports || []).forEach(r => {
            const code = normalizePondCode(r.pond || r.pond_code);
            if (code) reportMap.set(code, r);
        });

        // 2. Index todayHarvests (override if actual harvest occurred today)
        actualTodayList.forEach(th => {
            const code = normalizePondCode(th.pond || th.pond_index);
            if (code) {
                const existing = reportMap.get(code) || {};
                const actTon = th.actTonnage || th.good_wgt || th.harv_weight || existing.actTonnage;
                const actAbw = th.actAbw || th.harv_abw || existing.actAbw;
                reportMap.set(code, {
                    ...existing,
                    pond: code,
                    actTonnage: actTon,
                    actAbw: actAbw,
                    isTodayHarvest: true
                });
            }
        });

        return (forecasts || []).map(f => {
            const normPond = normalizePondCode(f.pond);
            const r = reportMap.get(normPond);

            // Raw forecast metrics
            const rawForecastBiomass = Number(f.biomass) || 0;
            // Standardize forecast biomass to kg (if < 100, was entered in tonnes)
            const forecastKg = rawForecastBiomass < 100 && rawForecastBiomass > 0 ? rawForecastBiomass * 1000 : rawForecastBiomass;

            // Check actual recorded harvest
            let actualKg = 0;
            let actualAbw = null;
            let hasActual = false;

            if (r) {
                const rawAct = Number(r.actTonnage ?? r.tonnage ?? r.good_wgt ?? r.harv_weight ?? 0);
                if (rawAct > 0) {
                    actualKg = rawAct < 100 ? rawAct * 1000 : rawAct;
                    hasActual = true;
                }
                const rawAbw = r.actAbw ?? r.abw ?? r.harv_abw;
                if (rawAbw !== "" && rawAbw !== null && rawAbw !== undefined) {
                    actualAbw = Number(rawAbw) || null;
                }
            }

            // Determine status
            let status = "PENDING";
            let varianceKg = 0;
            let variancePct = 0;
            let varianceAbw = null;
            let badgeText = "";
            let badgeColor = "#64748b";
            let badgeBg = "#f1f5f9";

            if (hasActual) {
                status = "COMPLETED";
                varianceKg = actualKg - forecastKg;
                variancePct = forecastKg > 0 ? Math.round((varianceKg / forecastKg) * 100) : 0;
                if (actualAbw && f.abw) {
                    varianceAbw = Math.round((actualAbw - Number(f.abw)) * 10) / 10;
                }

                const actTonStr = (actualKg / 1000).toFixed(1);
                const diffTonStr = (varianceKg / 1000).toFixed(1);
                const sign = varianceKg >= 0 ? "+" : "";
                badgeText = `${actTonStr}T (${sign}${diffTonStr}T / ${sign}${variancePct}%) ✅`;
                badgeColor = varianceKg >= -100 ? "#15803d" : "#b45309";
                badgeBg = varianceKg >= -100 ? "#ecfdf5" : "#fef3c7";
            } else if (r && (r.planTonnage || r.type)) {
                // In weekly harvest plan from Excel, waiting for harvest
                status = "PLANNED";
                badgeText = `In Plan (${f.date || f.targetDate || "This Week"}) ⏳`;
                badgeColor = "#0284c7";
                badgeBg = "#e0f2fe";
            } else {
                // Evaluate scheduled date from Whiteboard Forecast
                const rawDateStr = (f.date || f.targetDate || "").trim();
                let hasValidDate = false;
                let schedDate = null;

                if (rawDateStr) {
                    const mSlash = rawDateStr.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
                    if (mSlash) {
                        const schedDay = parseInt(mSlash[1], 10);
                        const schedMonth = parseInt(mSlash[2], 10) - 1;
                        schedDate = new Date(refDate.getFullYear(), schedMonth, schedDay, 23, 59, 59);
                        if (!isNaN(schedDate.getTime())) hasValidDate = true;
                    } else {
                        const parsed = new Date(rawDateStr);
                        if (!isNaN(parsed.getTime())) {
                            schedDate = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 23, 59, 59);
                            hasValidDate = true;
                        }
                    }
                }

                if (hasValidDate && schedDate) {
                    if (refDate > schedDate) {
                        status = "OVERDUE";
                        badgeText = `Overdue (${rawDateStr}) ⚠️`;
                        badgeColor = "#b91c1c";
                        badgeBg = "#fef2f2";
                    } else {
                        status = "PLANNED";
                        badgeText = `Planned (${rawDateStr}) ⏳`;
                        badgeColor = "#0284c7";
                        badgeBg = "#e0f2fe";
                    }
                } else {
                    status = "PENDING";
                    badgeText = `Pending (${rawDateStr || "TBD"})`;
                    badgeColor = "#475569";
                    badgeBg = "#f8fafc";
                }
            }

            return {
                ...f,
                normPond,
                status,
                reconciliationStatus: status,
                hasActual,
                actualKg,
                actualBiomassKg: actualKg,
                actualTon: hasActual ? Math.round((actualKg / 1000) * 100) / 100 : null,
                actualAbw,
                forecastKg,
                forecastBiomassKg: forecastKg,
                forecastTon: Math.round((forecastKg / 1000) * 100) / 100,
                varianceKg,
                diffBiomassKg: varianceKg,
                varianceTon: hasActual ? Math.round((varianceKg / 1000) * 100) / 100 : 0,
                variancePct,
                varianceAbw,
                diffAbw: varianceAbw,
                badgeText,
                badgeColor,
                badgeBg
            };
        });
    }

    /**
     * Computes aggregate summary statistics for the harvest reconciliation.
     * @param {Array<Object>} reconciledForecasts 
     * @returns {Object} Reconciliation summary KPIs
     */
    static calculateReconciliationSummary(reconciledForecasts = []) {
        const total = (reconciledForecasts || []).length;
        if (total === 0) {
            return {
                totalCount: 0,
                completedCount: 0,
                plannedCount: 0,
                overdueCount: 0,
                pendingCount: 0,
                completionPct: 0,
                totalForecastKg: 0,
                completedActualKg: 0,
                completedForecastKg: 0,
                netVarianceKg: 0,
                netVariancePct: 0,
                summaryText: "No harvest forecasts scheduled."
            };
        }

        let completedCount = 0;
        let plannedCount = 0;
        let overdueCount = 0;
        let pendingCount = 0;
        let totalForecastKg = 0;
        let completedActualKg = 0;
        let completedForecastKg = 0;

        reconciledForecasts.forEach(f => {
            const itemStatus = f.reconciliationStatus || f.status;
            const fKg = f.forecastKg !== undefined ? f.forecastKg : (f.forecastBiomassKg || 0);
            const aKg = f.actualKg !== undefined ? f.actualKg : (f.actualBiomassKg || 0);

            totalForecastKg += fKg;
            if (itemStatus === "COMPLETED") {
                completedCount++;
                completedActualKg += aKg;
                completedForecastKg += fKg;
            } else if (itemStatus === "PLANNED") {
                plannedCount++;
            } else if (itemStatus === "OVERDUE") {
                overdueCount++;
            } else {
                pendingCount++;
            }
        });

        const netVarianceKg = completedActualKg - completedForecastKg;
        const netVariancePct = completedForecastKg > 0 ? Math.round((netVarianceKg / completedForecastKg) * 100) : 0;
        const completionPct = Math.round((completedCount / total) * 100);

        const actTonStr = (completedActualKg / 1000).toFixed(1);
        const planTonStr = (completedForecastKg / 1000).toFixed(1);
        const diffTonStr = (netVarianceKg / 1000).toFixed(1);
        const sign = netVarianceKg >= 0 ? "+" : "";

        let summaryText = "";
        if (completedCount > 0) {
            summaryText = `Reconciliation: ${completedCount}/${total} Harvested (${completionPct}%) • ${actTonStr}T Actual vs ${planTonStr}T Forecast (${sign}${diffTonStr}T / ${sign}${netVariancePct}%)`;
        } else {
            summaryText = `Reconciliation: 0/${total} Harvested (${plannedCount} in Plan, ${overdueCount} Overdue, ${pendingCount} Pending) • ${(totalForecastKg / 1000).toFixed(1)}T Total Forecast`;
        }

        return {
            totalCount: total,
            completedCount,
            plannedCount,
            overdueCount,
            pendingCount,
            completionPct,
            totalForecastKg,
            totalForecastTon: (totalForecastKg / 1000).toFixed(1),
            totalActualKg: completedActualKg,
            completedActualKg,
            completedActualTon: actTonStr,
            completedForecastKg,
            completedForecastTon: planTonStr,
            netVarianceKg,
            netVarianceTon: diffTonStr,
            netVariancePct,
            summaryText
        };
    }
}
