/**
 * iSHARP DBMS 2.0 — Executive Metrics Presenter & Aggregation Engine
 * High-performance presentation logic and temporal bucketing for Executive Dashboard KPIs.
 * 
 * Clean Coding Standard: Pure transformation engine, zero direct DOM manipulation.
 */

export const METRIC_TYPES = {
    ACTIVE_PONDS: "ACTIVE_PONDS",
    PREP_IDLE: "PREP_IDLE",
    BIOSECURITY: "BIOSECURITY",
    HARVEST: "HARVEST",
    STOCKING: "STOCKING",
    SPECIES_COMP: "SPECIES_COMP",
    DOC_COMP: "DOC_COMP"
};

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Normalizes a date to YYYY-MM string.
 * @param {string|Date} dateVal 
 * @returns {string|null} e.g. "2026-10"
 */
export function toMonthKey(dateVal) {
    if (!dateVal) return null;
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return null;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
}

/**
 * Returns human-readable month label e.g. "Oct 2026"
 * @param {string} monthKey "YYYY-MM"
 * @returns {string}
 */
export function formatMonthLabel(monthKey) {
    if (!monthKey || !monthKey.includes("-")) return monthKey || "";
    const [year, mStr] = monthKey.split("-");
    const mIdx = parseInt(mStr, 10) - 1;
    return `${MONTH_NAMES[mIdx] || mStr} ${year}`;
}

/**
 * Builds an array of the last N month keys ending at referenceDate.
 * @param {number} [monthsBack=12] 
 * @param {Date} [referenceDate=new Date()]
 * @returns {Array<string>} e.g. ["2025-11", ..., "2026-10"]
 */
export function getRolling12Months(monthsBack = 12, referenceDate = new Date()) {
    const list = [];
    const ref = new Date(referenceDate);
    for (let i = monthsBack - 1; i >= 0; i--) {
        const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
        list.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return list;
}

/**
 * Formats numbers nicely with commas.
 * @param {number} num 
 * @param {number} [decimals=0] 
 * @returns {string}
 */
export function formatNumber(num, decimals = 0) {
    const n = Number(num);
    if (isNaN(n)) return "0";
    return n.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

export class ExecutiveMetricsPresenter {

    /**
     * Aggregates 12-month harvest records into monthly buckets + YTD/MTD totals.
     * @param {Array<object>} dailyHarvests 
     * @param {Array<object>} [salesRecords=[]]
     * @param {Date} [referenceDate=new Date()]
     */
    static aggregateMonthlyHarvest(dailyHarvests = [], salesRecords = [], referenceDate = new Date()) {
        const months = getRolling12Months(12, referenceDate);
        const currentYear = referenceDate.getFullYear();
        const currentMonthKey = toMonthKey(referenceDate);

        const bucketMap = new Map();
        months.forEach(m => {
            bucketMap.set(m, {
                monthKey: m,
                monthLabel: formatMonthLabel(m),
                year: parseInt(m.split("-")[0], 10),
                tonnage: 0,
                partialTons: 0,
                finalTons: 0,
                count: 0,
                totalAbwWeight: 0,
                abwWeightCount: 0,
                revenue: 0,
                records: []
            });
        });

        // 1. Process Daily Harvests
        (dailyHarvests || []).forEach(r => {
            const m = toMonthKey(r.harv_date);
            if (!m) return;

            const wKg = Number(r.harv_weight) || 0;
            const wTons = wKg / 1000;
            const isFinal = String(r.harv_status || "").toUpperCase().includes("FINAL") || String(r.harv_status || "").toUpperCase().includes("TERM");
            const abw = Number(r.harv_abw) || 0;
            const rev = Number(r.harv_revenue) || 0;

            if (bucketMap.has(m)) {
                const b = bucketMap.get(m);
                b.tonnage += wTons;
                if (isFinal) b.finalTons += wTons;
                else b.partialTons += wTons;
                b.count += 1;
                if (abw > 0) {
                    b.totalAbwWeight += abw * wKg;
                    b.abwWeightCount += wKg;
                }
                b.revenue += rev;
                b.records.push(r);
            }
        });

        // Calculate averages for each bucket
        const buckets = months.map(m => {
            const b = bucketMap.get(m);
            const avgAbw = b.abwWeightCount > 0 ? (b.totalAbwWeight / b.abwWeightCount) : 0;
            return {
                ...b,
                tonnage: Math.round(b.tonnage * 100) / 100,
                partialTons: Math.round(b.partialTons * 100) / 100,
                finalTons: Math.round(b.finalTons * 100) / 100,
                avgAbw: Math.round(avgAbw * 10) / 10,
                revenue: Math.round(b.revenue)
            };
        });

        // Compute YTD and MTD
        let ytdTonnage = 0;
        let ytdRevenue = 0;
        let ytdCount = 0;
        let mtdTonnage = 0;
        let mtdRevenue = 0;
        let rolling12Tonnage = 0;

        buckets.forEach(b => {
            rolling12Tonnage += b.tonnage;
            if (b.year === currentYear) {
                ytdTonnage += b.tonnage;
                ytdRevenue += b.revenue;
                ytdCount += b.count;
            }
            if (b.monthKey === currentMonthKey) {
                mtdTonnage += b.tonnage;
                mtdRevenue += b.revenue;
            }
        });

        return {
            buckets,
            currentMonthKey,
            ytdTonnage: Math.round(ytdTonnage * 10) / 10,
            ytdRevenue: Math.round(ytdRevenue),
            ytdCount,
            mtdTonnage: Math.round(mtdTonnage * 10) / 10,
            mtdRevenue: Math.round(mtdRevenue),
            rolling12Tonnage: Math.round(rolling12Tonnage * 10) / 10
        };
    }

    /**
     * Aggregates 12-month stocking batches into monthly buckets + YTD/MTD totals.
     * @param {Array<object>} stockingBatches 
     * @param {Date} [referenceDate=new Date()]
     */
    static aggregateMonthlyStocking(stockingBatches = [], referenceDate = new Date()) {
        const months = getRolling12Months(12, referenceDate);
        const currentYear = referenceDate.getFullYear();
        const currentMonthKey = toMonthKey(referenceDate);

        const bucketMap = new Map();
        months.forEach(m => {
            bucketMap.set(m, {
                monthKey: m,
                monthLabel: formatMonthLabel(m),
                year: parseInt(m.split("-")[0], 10),
                totalPcs: 0,
                vanPcs: 0,
                monPcs: 0,
                batchCount: 0,
                records: []
            });
        });

        (stockingBatches || []).forEach(r => {
            const m = toMonthKey(r.stck_date);
            if (!m) return;

            const pcs = Number(r.stck_pcs) || 0;
            const sp = String(r.stck_species || "").toUpperCase();
            const isMon = sp.includes("MON");

            if (bucketMap.has(m)) {
                const b = bucketMap.get(m);
                b.totalPcs += pcs;
                if (isMon) b.monPcs += pcs;
                else b.vanPcs += pcs;
                b.batchCount += 1;
                b.records.push(r);
            }
        });

        const buckets = months.map(m => {
            const b = bucketMap.get(m);
            return {
                ...b,
                millionPcs: Math.round((b.totalPcs / 1000000) * 100) / 100,
                vanMillion: Math.round((b.vanPcs / 1000000) * 100) / 100,
                monMillion: Math.round((b.monPcs / 1000000) * 100) / 100
            };
        });

        let ytdPcs = 0;
        let ytdBatches = 0;
        let mtdPcs = 0;
        let rolling12Pcs = 0;

        buckets.forEach(b => {
            rolling12Pcs += b.totalPcs;
            if (b.year === currentYear) {
                ytdPcs += b.totalPcs;
                ytdBatches += b.batchCount;
            }
            if (b.monthKey === currentMonthKey) {
                mtdPcs += b.totalPcs;
            }
        });

        return {
            buckets,
            currentMonthKey,
            ytdMillion: Math.round((ytdPcs / 1000000) * 100) / 100,
            ytdPcs,
            ytdBatches,
            mtdMillion: Math.round((mtdPcs / 1000000) * 100) / 100,
            mtdPcs,
            rolling12Million: Math.round((rolling12Pcs / 1000000) * 100) / 100
        };
    }

    /**
     * Aggregates 12-month operational pond statistics (Monthly Average, Peak Max, Trough Min).
     * Evaluates daily pond culture status across all days in each month.
     * @param {Array<object>} operationalCycles Array of cycles with stck_date and optional date_close
     * @param {Date} [referenceDate=new Date()]
     * @param {string} [metricMode="AVG"] "AVG", "MAX", or "MIN"
     */
    static aggregateMonthlyOperationalPonds(operationalCycles = [], referenceDate = new Date(), metricMode = "AVG") {
        const months = getRolling12Months(12, referenceDate);
        const currentMonthKey = toMonthKey(referenceDate);
        const refIso = referenceDate.toISOString().slice(0, 10);

        const buckets = months.map(m => {
            const [yearStr, monthStr] = m.split("-");
            const y = parseInt(yearStr, 10);
            const mIdx = parseInt(monthStr, 10) - 1;
            const daysInMonth = new Date(y, mIdx + 1, 0).getDate();
            const startStr = `${m}-01`;
            const endStr = `${m}-${String(daysInMonth).padStart(2, "0")}`;

            const dailyCounts = [];
            for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = `${m}-${String(day).padStart(2, "0")}`;
                // Do not evaluate future days if looking at current month
                if (m === currentMonthKey && dateStr > refIso) break;

                let countOnDay = 0;
                operationalCycles.forEach(c => {
                    if (!c.stck_date) return;
                    const stck = String(c.stck_date).slice(0, 10);
                    const close = c.date_close ? String(c.date_close).slice(0, 10) : "9999-99-99";
                    if (stck <= dateStr && close >= dateStr) {
                        countOnDay++;
                    }
                });
                dailyCounts.push(countOnDay);
            }

            const avg = dailyCounts.length > 0 ? Math.round(dailyCounts.reduce((a, b) => a + b, 0) / dailyCounts.length) : 0;
            const min = dailyCounts.length > 0 ? Math.min(...dailyCounts) : 0;
            const max = dailyCounts.length > 0 ? Math.max(...dailyCounts) : 0;
            const monthEnd = dailyCounts.length > 0 ? dailyCounts[dailyCounts.length - 1] : 0;

            // Find all unique cycles active at any point in this month
            const activeInMonth = (operationalCycles || []).filter(c => {
                if (!c.stck_date) return false;
                const stck = String(c.stck_date).slice(0, 10);
                const close = c.date_close ? String(c.date_close).slice(0, 10) : "9999-99-99";
                return stck <= endStr && close >= startStr;
            });

            let displayVal = avg;
            if (metricMode === "MAX") displayVal = max;
            else if (metricMode === "MIN") displayVal = min;

            return {
                monthKey: m,
                monthLabel: formatMonthLabel(m),
                value: displayVal,
                avg,
                min,
                max,
                monthEnd,
                activeCycles: activeInMonth,
                unit: "Ponds",
                subValue: `Min: ${min} • Max: ${max} Ponds`
            };
        });

        // Farm summary stats across the 12 months
        const allAvgs = buckets.map(b => b.avg).filter(v => v > 0);
        const ytdAvg = allAvgs.length > 0 ? Math.round(allAvgs.reduce((a, b) => a + b, 0) / allAvgs.length) : 0;
        const peakBucket = buckets.reduce((prev, curr) => (curr.max > prev.max ? curr : prev), buckets[0]);
        const troughBucket = buckets.reduce((prev, curr) => (curr.min < prev.min && curr.min > 0 ? curr : prev), buckets[0]);
        const currentBucket = buckets.find(b => b.monthKey === currentMonthKey) || buckets[buckets.length - 1];

        return {
            buckets,
            currentMonthKey,
            ytdAvg,
            peakPonds: peakBucket?.max || 0,
            peakMonth: peakBucket?.monthLabel || "",
            troughPonds: troughBucket?.min || 0,
            troughMonth: troughBucket?.monthLabel || "",
            currentOperationalCount: currentBucket?.monthEnd || currentBucket?.avg || 0
        };
    }

    /**
     * Calculates species composition among active culturing production ponds.
     * @param {Array<object>} activePonds Array of evaluated pond objects
     */
    static calculateSpeciesComposition(activePonds = []) {
        const culturing = (activePonds || []).filter(p => p.isActive || String(p.progressState || "").toUpperCase() === "CULTURE");
        const total = culturing.length;

        if (total === 0) {
            return {
                totalActive: 0,
                vanCount: 0,
                monCount: 0,
                vanPercent: 0,
                monPercent: 0,
                displayHtml: `<span style="color: #64748b;">No Active Crops</span>`
            };
        }

        let vanCount = 0;
        let monCount = 0;

        culturing.forEach(p => {
            const sp = String(p.speciesCode || p.species || p.speciesLabel || "").toUpperCase();
            if (sp.includes("MON")) monCount++;
            else vanCount++;
        });

        const vanPercent = Math.round((vanCount / total) * 100);
        const monPercent = 100 - vanPercent;

        return {
            totalActive: total,
            vanCount,
            monCount,
            vanPercent,
            monPercent,
            displayHtml: `<span style="color: #0284c7;">${vanPercent}%</span> <span style="font-size: 0.85rem; color: #64748b; font-weight: 600;">VAN</span> • <span style="color: #059669;">${monPercent}%</span> <span style="font-size: 0.85rem; color: #64748b; font-weight: 600;">MON</span>`
        };
    }

    /**
     * Calculates Days of Culture (DOC) stage composition and averages per species.
     * Stages: Early (<30d), Mid (30-70d), Finishing (>70d).
     * @param {Array<object>} activePonds 
     */
    static calculateDocComposition(activePonds = []) {
        const culturing = (activePonds || []).filter(p => p.isActive || String(p.progressState || "").toUpperCase() === "CULTURE");
        const total = culturing.length;

        const summary = {
            total,
            van: { count: 0, early: 0, mid: 0, finishing: 0, totalDoc: 0, avgDoc: 0 },
            mon: { count: 0, early: 0, mid: 0, finishing: 0, totalDoc: 0, avgDoc: 0 },
            overall: { early: 0, mid: 0, finishing: 0, avgDoc: 0 }
        };

        if (total === 0) return summary;

        let farmTotalDoc = 0;

        culturing.forEach(p => {
            const doc = Number(p.doc) || Number(p.progressDays) || 0;
            farmTotalDoc += doc;

            const sp = String(p.speciesCode || p.species || p.speciesLabel || "").toUpperCase();
            const isMon = sp.includes("MON");
            const target = isMon ? summary.mon : summary.van;

            target.count++;
            target.totalDoc += doc;

            if (doc < 30) {
                target.early++;
                summary.overall.early++;
            } else if (doc <= 70) {
                target.mid++;
                summary.overall.mid++;
            } else {
                target.finishing++;
                summary.overall.finishing++;
            }
        });

        if (summary.van.count > 0) {
            summary.van.avgDoc = Math.round(summary.van.totalDoc / summary.van.count);
            summary.van.earlyPct = Math.round((summary.van.early / summary.van.count) * 100);
            summary.van.midPct = Math.round((summary.van.mid / summary.van.count) * 100);
            summary.van.finishingPct = Math.round((summary.van.finishing / summary.van.count) * 100);
        } else {
            summary.van.avgDoc = 0;
            summary.van.earlyPct = 0;
            summary.van.midPct = 0;
            summary.van.finishingPct = 0;
        }

        if (summary.mon.count > 0) {
            summary.mon.avgDoc = Math.round(summary.mon.totalDoc / summary.mon.count);
            summary.mon.earlyPct = Math.round((summary.mon.early / summary.mon.count) * 100);
            summary.mon.midPct = Math.round((summary.mon.mid / summary.mon.count) * 100);
            summary.mon.finishingPct = Math.round((summary.mon.finishing / summary.mon.count) * 100);
        } else {
            summary.mon.avgDoc = 0;
            summary.mon.earlyPct = 0;
            summary.mon.midPct = 0;
            summary.mon.finishingPct = 0;
        }

        summary.overall.avgDoc = Math.round(farmTotalDoc / total);

        return summary;
    }

    /**
     * Builds the drilldown view model for the requested metric type.
     * @param {string} metricType One of METRIC_TYPES
     * @param {object} dataBundle { activePonds, activeCycles, operationalCycles, dailyProgress, issues, dailyHarvests, salesRecords, stockingBatches }
     * @param {string} [selectedMonth="ALL"] YYYY-MM or "ALL"
     * @param {string} [searchQuery=""]
     * @param {object} [options={}] e.g. { activePondMode: "AVG" | "MAX" | "MIN" }
     * @returns {object} DrillDownViewModel
     */
    static getMetricDrillDownData(metricType, dataBundle = {}, selectedMonth = "ALL", searchQuery = "", options = {}) {
        const query = (searchQuery || "").trim().toLowerCase();
        const months12 = getRolling12Months(12);

        switch (metricType) {
            case METRIC_TYPES.HARVEST: {
                const harvestAgg = this.aggregateMonthlyHarvest(dataBundle.dailyHarvests || [], dataBundle.salesRecords || []);
                const timeline = harvestAgg.buckets.map(b => ({
                    monthKey: b.monthKey,
                    monthLabel: b.monthLabel,
                    value: b.tonnage,
                    unit: "MT",
                    subValue: `${b.count} Harv • Avg ${b.avgAbw}g`,
                    active: selectedMonth === b.monthKey
                }));

                const allRecords = dataBundle.dailyHarvests || [];
                const filtered = allRecords.filter(r => {
                    if (selectedMonth !== "ALL") {
                        if (toMonthKey(r.harv_date) !== selectedMonth) return false;
                    }
                    if (query) {
                        const hay = `${r.pond || ""} ${r.pond_index || ""} ${r.harv_status || ""} ${r.species || ""}`.toLowerCase();
                        if (!hay.includes(query)) return false;
                    }
                    return true;
                });

                const tableHeaders = ["Pond Code", "Cycle No", "Harvest Date", "Species", "Status", "Weight (kg)", "Tonnage (MT)", "ABW (g)", "Est Revenue (RM)"];
                const tableRows = filtered.map(r => {
                    const pondCode = r.pond || r.pond_index?.split(".")[0] || r.pond_index || "—";
                    const cycleNo = r.cycle_no || (r.pond_index?.includes(".") ? r.pond_index.split(".")[1] : "—");
                    const wKg = Number(r.harv_weight) || 0;
                    const wMt = Math.round((wKg / 1000) * 100) / 100;
                    const abw = Number(r.harv_abw) || 0;
                    const rev = Number(r.harv_revenue) || 0;
                    return [
                        pondCode,
                        cycleNo,
                        r.harv_date || "—",
                        r.species || "VAN",
                        r.harv_status || "HARVEST",
                        formatNumber(wKg, 1),
                        formatNumber(wMt, 2),
                        abw > 0 ? `${abw} g` : "—",
                        rev > 0 ? `RM ${formatNumber(rev, 0)}` : "—"
                    ];
                });

                const csvHeaders = ["Pond Index", "Pond Code", "Harvest Date", "Species", "Harvest Status", "Harvest Weight (kg)", "Harvest Tonnage (MT)", "ABW (g)", "Revenue (RM)"];
                const csvRows = filtered.map(r => [
                    r.pond_index || "",
                    r.pond || "",
                    r.harv_date || "",
                    r.species || "VAN",
                    r.harv_status || "",
                    Number(r.harv_weight) || 0,
                    Math.round(((Number(r.harv_weight) || 0) / 1000) * 100) / 100,
                    Number(r.harv_abw) || 0,
                    Number(r.harv_revenue) || 0
                ]);

                return {
                    metricType,
                    title: "Total Farm Harvest Intelligence",
                    icon: "🌾",
                    subtitle: "12-Month Rolling Harvest Log & Biomass Evacuation Ledgers",
                    timelineTitle: "Monthly Harvest Production (12-Month)",
                    summaryBadges: [
                        { label: "YTD Harvest", value: `${formatNumber(harvestAgg.ytdTonnage, 1)} MT`, sub: "Calendar Year to Date" },
                        { label: "Current Month", value: `${formatNumber(harvestAgg.mtdTonnage, 1)} MT`, sub: formatMonthLabel(harvestAgg.currentMonthKey) },
                        { label: "12M Rolling", value: `${formatNumber(harvestAgg.rolling12Tonnage, 1)} MT`, sub: "Past 12 Months" },
                        { label: "Total Harvests", value: `${formatNumber(harvestAgg.ytdCount)} events`, sub: "Logged in Supabase" }
                    ],
                    timeline,
                    monthOptions: [{ key: "ALL", label: "All Months (12M Rolling)" }, ...months12.slice().reverse().map(m => ({ key: m, label: formatMonthLabel(m) }))],
                    tableHeaders,
                    tableRows,
                    csvHeaders,
                    csvRows,
                    countDisplay: `${filtered.length} harvest records`
                };
            }

            case METRIC_TYPES.STOCKING: {
                const stockAgg = this.aggregateMonthlyStocking(dataBundle.stockingBatches || []);
                const timeline = stockAgg.buckets.map(b => ({
                    monthKey: b.monthKey,
                    monthLabel: b.monthLabel,
                    value: b.millionPcs,
                    unit: "M Fries",
                    subValue: `${b.batchCount} Batches • ${b.vanMillion}M VAN / ${b.monMillion}M MON`,
                    active: selectedMonth === b.monthKey
                }));

                const allRecords = dataBundle.stockingBatches || [];
                const filtered = allRecords.filter(r => {
                    if (selectedMonth !== "ALL") {
                        if (toMonthKey(r.stck_date) !== selectedMonth) return false;
                    }
                    if (query) {
                        const hay = `${r.pond_index || ""} ${r.stck_species || ""} ${r.stck_source || ""} ${r.stck_tank || ""}`.toLowerCase();
                        if (!hay.includes(query)) return false;
                    }
                    return true;
                });

                const tableHeaders = ["Pond Index", "Stock Date", "Species", "Source / Hatchery", "Tank", "Stocked (Pcs)", "Allowance", "Total Received", "PL Size"];
                const tableRows = filtered.map(r => {
                    const pcs = Number(r.stck_pcs) || 0;
                    const allow = Number(r.stck_allow) || 0;
                    const tot = Number(r.stck_total) || (pcs + allow);
                    return [
                        r.pond_index || "—",
                        r.stck_date || "—",
                        r.stck_species || "VANNAMEI",
                        r.stck_source || "Hatchery",
                        r.stck_tank || "—",
                        formatNumber(pcs),
                        allow > 0 ? formatNumber(allow) : "0",
                        formatNumber(tot),
                        r.stck_size ? `PL ${r.stck_size}` : "—"
                    ];
                });

                const csvHeaders = ["Pond Index", "Stock Date", "Species", "Hatchery Source", "Stock Tank", "Stocked Pcs", "Allowance Pcs", "Total Pcs", "PL Size"];
                const csvRows = filtered.map(r => [
                    r.pond_index || "",
                    r.stck_date || "",
                    r.stck_species || "",
                    r.stck_source || "",
                    r.stck_tank || "",
                    Number(r.stck_pcs) || 0,
                    Number(r.stck_allow) || 0,
                    Number(r.stck_total) || 0,
                    r.stck_size || ""
                ]);

                return {
                    metricType,
                    title: "Total Post-Larvae & Fry Stocking",
                    icon: "🦐",
                    subtitle: "Hatchery Dispatch & Stocking Batches Across Farm Modules",
                    timelineTitle: "Monthly Stocking Volume (12-Month)",
                    summaryBadges: [
                        { label: "YTD Stocking", value: `${formatNumber(stockAgg.ytdMillion, 2)} M`, sub: "Million Fries YTD" },
                        { label: "Current Month", value: `${formatNumber(stockAgg.mtdMillion, 2)} M`, sub: formatMonthLabel(stockAgg.currentMonthKey) },
                        { label: "12M Rolling", value: `${formatNumber(stockAgg.rolling12Million, 2)} M`, sub: "Past 12 Months" },
                        { label: "Stocked Batches", value: `${formatNumber(stockAgg.ytdBatches)} batches`, sub: "Verified Single SSOT" }
                    ],
                    timeline,
                    monthOptions: [{ key: "ALL", label: "All Months (12M Rolling)" }, ...months12.slice().reverse().map(m => ({ key: m, label: formatMonthLabel(m) }))],
                    tableHeaders,
                    tableRows,
                    csvHeaders,
                    csvRows,
                    countDisplay: `${filtered.length} stocking batches`
                };
            }

            case METRIC_TYPES.SPECIES_COMP: {
                const culturing = (dataBundle.activePonds || []).filter(p => p.isActive || String(p.progressState || "").toUpperCase() === "CULTURE");
                const spComp = this.calculateSpeciesComposition(dataBundle.activePonds || []);
                const stockAgg = this.aggregateMonthlyStocking(dataBundle.stockingBatches || []);

                const timeline = stockAgg.buckets.map(b => ({
                    monthKey: b.monthKey,
                    monthLabel: b.monthLabel,
                    value: b.millionPcs,
                    unit: "M Fries",
                    subValue: `${b.vanMillion}M VAN • ${b.monMillion}M MON`,
                    active: selectedMonth === b.monthKey
                }));

                const filtered = culturing.filter(p => {
                    if (selectedMonth !== "ALL") {
                        if (toMonthKey(p.stckDate || p.dailyRecord?.stocking_date) !== selectedMonth) return false;
                    }
                    if (query) {
                        const hay = `${p.pondCode || ""} ${p.speciesLabel || ""} ${p.pondIndex || ""}`.toLowerCase();
                        if (!hay.includes(query)) return false;
                    }
                    return true;
                });

                const tableHeaders = ["Pond Code", "Pond Index", "Species", "Stock Date", "DOC", "Current Stage", "Biosecurity", "Pond Status"];
                const tableRows = filtered.map(p => [
                    p.pondCode || "—",
                    p.pondIndex || "—",
                    p.speciesLabel || p.speciesCode || "VAN",
                    p.stckDate || p.dailyRecord?.stocking_date || "—",
                    p.docDisplay || `${p.doc || 0}d`,
                    p.stageCode || "MID",
                    p.health || "GREEN",
                    p.progressState || "CULTURE"
                ]);

                const csvHeaders = ["Pond Code", "Pond Index", "Species", "Stock Date", "DOC", "Stage", "Biosecurity Health"];
                const csvRows = filtered.map(p => [
                    p.pondCode || "",
                    p.pondIndex || "",
                    p.speciesLabel || p.speciesCode || "",
                    p.stckDate || p.dailyRecord?.stocking_date || "",
                    p.doc || 0,
                    p.stageCode || "",
                    p.health || ""
                ]);

                return {
                    metricType,
                    title: "Species Composition & Allocation Dynamics",
                    icon: "🧬",
                    subtitle: "P. vannamei vs P. monodon Distribution Across Culturing Ponds",
                    timelineTitle: "Monthly Stocking by Species (12-Month)",
                    summaryBadges: [
                        { label: "Vannamei (VAN)", value: `${spComp.vanPercent}%`, sub: `${spComp.vanCount} Active Ponds` },
                        { label: "Monodon (MON)", value: `${spComp.monPercent}%`, sub: `${spComp.monCount} Active Ponds` },
                        { label: "Total Active", value: `${spComp.totalActive} Ponds`, sub: "Currently Culturing" },
                        { label: "Species Balance", value: `${Math.round(spComp.vanCount / Math.max(1, spComp.monCount) * 10) / 10} : 1`, sub: "VAN to MON Ratio" }
                    ],
                    timeline,
                    monthOptions: [{ key: "ALL", label: "All Stocking Months" }, ...months12.slice().reverse().map(m => ({ key: m, label: formatMonthLabel(m) }))],
                    tableHeaders,
                    tableRows,
                    csvHeaders,
                    csvRows,
                    countDisplay: `${filtered.length} active ponds displayed`
                };
            }

            case METRIC_TYPES.DOC_COMP: {
                const culturing = (dataBundle.activePonds || []).filter(p => p.isActive || String(p.progressState || "").toUpperCase() === "CULTURE");
                const docComp = this.calculateDocComposition(dataBundle.activePonds || []);
                const monthsBuckets = getRolling12Months(12).map(m => {
                    const pondsInMonth = culturing.filter(p => toMonthKey(p.stckDate || p.dailyRecord?.stocking_date) === m);
                    const avg = pondsInMonth.length > 0 ? Math.round(pondsInMonth.reduce((acc, p) => acc + (p.doc || 0), 0) / pondsInMonth.length) : 0;
                    return {
                        monthKey: m,
                        monthLabel: formatMonthLabel(m),
                        value: avg,
                        unit: "avg DOC",
                        subValue: `${pondsInMonth.length} Stocked Ponds`,
                        active: selectedMonth === m
                    };
                });

                const filtered = culturing.filter(p => {
                    if (selectedMonth !== "ALL") {
                        if (toMonthKey(p.stckDate || p.dailyRecord?.stocking_date) !== selectedMonth) return false;
                    }
                    if (query) {
                        const hay = `${p.pondCode || ""} ${p.speciesLabel || ""} ${p.stageCode || ""}`.toLowerCase();
                        if (!hay.includes(query)) return false;
                    }
                    return true;
                });

                const tableHeaders = ["Pond Code", "Species", "Stock Date", "DOC", "Stage", "Stage Range", "Biosecurity", "Readiness Action"];
                const tableRows = filtered.map(p => {
                    const doc = Number(p.doc) || 0;
                    const stage = p.stageCode || (doc > 70 ? "FINISHING" : (doc >= 30 ? "MID" : "EARLY"));
                    const range = doc < 30 ? "< 30 days" : (doc <= 70 ? "30 - 70 days" : "> 70 days");
                    const action = doc > 90 ? "Harvest Candidate" : (doc > 70 ? "Biomass Monitoring" : "Feeding & Water Care");
                    return [
                        p.pondCode || "—",
                        p.speciesLabel || p.speciesCode || "VAN",
                        p.stckDate || p.dailyRecord?.stocking_date || "—",
                        `${doc}d`,
                        stage,
                        range,
                        p.health || "GREEN",
                        action
                    ];
                });

                const csvHeaders = ["Pond Code", "Species", "Stock Date", "DOC", "Stage Code", "Stage Window", "Health", "Action"];
                const csvRows = filtered.map(p => [
                    p.pondCode || "",
                    p.speciesLabel || p.speciesCode || "",
                    p.stckDate || p.dailyRecord?.stocking_date || "",
                    p.doc || 0,
                    p.stageCode || "",
                    p.doc < 30 ? "< 30 days" : (p.doc <= 70 ? "30 - 70 days" : "> 70 days"),
                    p.health || "",
                    p.doc > 90 ? "Harvest Candidate" : "Growing"
                ]);

                return {
                    metricType,
                    title: "DOC & Culture Stage Composition by Species",
                    icon: "⏱️",
                    subtitle: "Age Cohort Segments & Growout Maturation Across 216 Ponds",
                    timelineTitle: "Average DOC by Stocking Cohort (12-Month)",
                    summaryBadges: [
                        { label: "VAN Avg DOC", value: `${docComp.van.avgDoc} DOC`, sub: `Mid: ${docComp.van.midPct}% • Fin: ${docComp.van.finishingPct}%` },
                        { label: "MON Avg DOC", value: `${docComp.mon.avgDoc} DOC`, sub: `Mid: ${docComp.mon.midPct}% • Fin: ${docComp.mon.finishingPct}%` },
                        { label: "Finishing Stage (>70d)", value: `${docComp.overall.finishing} Ponds`, sub: "Approaching harvest window" },
                        { label: "Early Stage (<30d)", value: `${docComp.overall.early} Ponds`, sub: "Nursery & early transition" }
                    ],
                    timeline: monthsBuckets,
                    monthOptions: [{ key: "ALL", label: "All Stocking Months" }, ...months12.slice().reverse().map(m => ({ key: m, label: formatMonthLabel(m) }))],
                    tableHeaders,
                    tableRows,
                    csvHeaders,
                    csvRows,
                    countDisplay: `${filtered.length} active ponds displayed`
                };
            }

            case METRIC_TYPES.ACTIVE_PONDS: {
                const culturing = (dataBundle.activePonds || []).filter(p => p.isActive || String(p.progressState || "").toUpperCase() === "CULTURE");
                const opCycles = dataBundle.operationalCycles && dataBundle.operationalCycles.length > 0 
                    ? dataBundle.operationalCycles 
                    : (dataBundle.activeCycles || []);
                
                const activePondMode = options.activePondMode || "AVG";
                const opAgg = this.aggregateMonthlyOperationalPonds(opCycles, new Date(), activePondMode);

                // Index latest sampling by pond_index for fast O(1) lookup
                const samplingMap = new Map();
                (dataBundle.samplings || []).forEach(s => {
                    if (!s.pond_index) return;
                    const idx = String(s.pond_index);
                    if (!samplingMap.has(idx)) {
                        samplingMap.set(idx, s);
                    }
                });

                const timeline = opAgg.buckets.map(b => ({
                    monthKey: b.monthKey,
                    monthLabel: b.monthLabel,
                    value: b.value,
                    avg: b.avg,
                    min: b.min,
                    max: b.max,
                    unit: "Ponds",
                    subValue: `Min: ${b.min} • Max: ${b.max} Ponds`,
                    active: selectedMonth === b.monthKey
                }));

                let tableHeaders = [];
                let tableRows = [];
                let csvHeaders = [];
                let csvRows = [];
                let countDisplay = "";

                if (selectedMonth === "ALL") {
                    const filtered = culturing.filter(p => {
                        if (query) {
                            const hay = `${p.pondCode || ""} ${p.pondIndex || ""} ${p.speciesLabel || ""}`.toLowerCase();
                            if (!hay.includes(query)) return false;
                        }
                        return true;
                    });

                    tableHeaders = ["Pond Code", "Cycle No", "Module", "Species", "Stock Date", "DOC", "Latest ABW (g)", "Est Biomass (kg)", "Current Stage", "Biosecurity Status"];
                    tableRows = filtered.map(p => {
                        const mod = p.pondCode ? `Module ${p.pondCode.split(".")[0]}` : "—";
                        const pIdx = p.pondIndex ? String(p.pondIndex) : (p.pondCode ? String(p.pondCode) : "");
                        const sample = pIdx ? samplingMap.get(pIdx) : null;
                        const abwVal = sample && sample.smpl_abw ? parseFloat(sample.smpl_abw) : null;
                        const bmsVal = sample && sample.smpl_bms ? parseFloat(sample.smpl_bms) : null;

                        const abwDisplay = abwVal !== null && !isNaN(abwVal) ? `${abwVal.toFixed(1)} g` : "—";
                        const bmsDisplay = bmsVal !== null && !isNaN(bmsVal) ? `${formatNumber(Math.round(bmsVal))} kg` : "—";

                        return [
                            p.pondCode || "—",
                            p.pondIndex?.split(".")[1] || "—",
                            mod,
                            p.speciesLabel || p.speciesCode || "VAN",
                            p.stckDate || p.dailyRecord?.stocking_date || "—",
                            p.docDisplay || `${p.doc || 0}d`,
                            abwDisplay,
                            bmsDisplay,
                            p.stageCode || "MID",
                            p.health || "GREEN"
                        ];
                    });

                    csvHeaders = ["Pond Code", "Pond Index", "Module", "Species", "Stock Date", "DOC", "Latest ABW (g)", "Est Biomass (kg)", "Stage", "Biosecurity"];
                    csvRows = filtered.map(p => {
                        const mod = p.pondCode ? `Module ${p.pondCode.split(".")[0]}` : "";
                        const pIdx = p.pondIndex ? String(p.pondIndex) : (p.pondCode ? String(p.pondCode) : "");
                        const sample = pIdx ? samplingMap.get(pIdx) : null;
                        const abwVal = sample && sample.smpl_abw ? parseFloat(sample.smpl_abw) : "";
                        const bmsVal = sample && sample.smpl_bms ? Math.round(parseFloat(sample.smpl_bms)) : "";

                        return [
                            p.pondCode || "",
                            p.pondIndex || "",
                            mod,
                            p.speciesLabel || p.speciesCode || "",
                            p.stckDate || p.dailyRecord?.stocking_date || "",
                            p.doc || 0,
                            abwVal,
                            bmsVal,
                            p.stageCode || "",
                            p.health || ""
                        ];
                    });

                    countDisplay = `${filtered.length} currently culturing ponds (Live SSOT)`;
                } else {
                    const bucket = opAgg.buckets.find(b => b.monthKey === selectedMonth);
                    const monthCycles = bucket ? bucket.activeCycles : [];

                    const filtered = monthCycles.filter(c => {
                        if (query) {
                            const hay = `${c.pond || ""} ${c.pond_index || ""} ${c.stck_species || ""} ${c.modl || ""}`.toLowerCase();
                            if (!hay.includes(query)) return false;
                        }
                        return true;
                    });

                    tableHeaders = ["Pond Code", "Cycle No", "Module", "Species", "Stock Date", "Close / Harvest Date", "Latest ABW (g)", "Est Biomass (kg)", "Operational Status", "Area (Ha)"];
                    tableRows = filtered.map(c => {
                        const mod = c.modl || (c.pond ? `Module ${c.pond.split(".")[0]}` : "—");
                        const cycleNo = c.cycle_no || (c.pond_index?.includes(".") ? c.pond_index.split(".")[1] : "—");
                        const isClosed = Boolean(c.date_close);
                        const statusLabel = isClosed ? "Closed / Harvested" : "Active Culture";
                        const rawSp = String(c.stck_species || "VAN").toUpperCase();
                        const spBadge = rawSp.includes("MON") ? "MON" : "VAN";

                        const pIdx = c.pond_index ? String(c.pond_index) : "";
                        const sample = pIdx ? samplingMap.get(pIdx) : null;
                        const abwVal = sample && sample.smpl_abw ? parseFloat(sample.smpl_abw) : null;
                        const bmsVal = sample && sample.smpl_bms ? parseFloat(sample.smpl_bms) : null;

                        const abwDisplay = abwVal !== null && !isNaN(abwVal) ? `${abwVal.toFixed(1)} g` : "—";
                        const bmsDisplay = bmsVal !== null && !isNaN(bmsVal) ? `${formatNumber(Math.round(bmsVal))} kg` : "—";

                        return [
                            c.pond || "—",
                            cycleNo,
                            mod,
                            spBadge,
                            c.stck_date ? String(c.stck_date).slice(0, 10) : "—",
                            c.date_close ? String(c.date_close).slice(0, 10) : "Currently Culturing",
                            abwDisplay,
                            bmsDisplay,
                            statusLabel,
                            c.area ? `${c.area} Ha` : "—"
                        ];
                    });

                    csvHeaders = ["Pond Code", "Pond Index", "Module", "Species", "Stock Date", "Close Date", "Latest ABW (g)", "Est Biomass (kg)", "Status", "Area"];
                    csvRows = filtered.map(c => {
                        const pIdx = c.pond_index ? String(c.pond_index) : "";
                        const sample = pIdx ? samplingMap.get(pIdx) : null;
                        const abwVal = sample && sample.smpl_abw ? parseFloat(sample.smpl_abw) : "";
                        const bmsVal = sample && sample.smpl_bms ? Math.round(parseFloat(sample.smpl_bms)) : "";

                        return [
                            c.pond || "",
                            c.pond_index || "",
                            c.modl || "",
                            c.stck_species || "VAN",
                            c.stck_date || "",
                            c.date_close || "Currently Culturing",
                            abwVal,
                            bmsVal,
                            c.date_close ? "Closed" : "Active",
                            c.area || ""
                        ];
                    });

                    const modeLabel = activePondMode === "MAX" ? "Peak" : (activePondMode === "MIN" ? "Lowest" : "Average");
                    countDisplay = `${filtered.length} operational ponds in ${bucket?.monthLabel || selectedMonth} (${modeLabel}: ${bucket?.value || 0})`;
                }

                const currentCount = culturing.length || opAgg.currentOperationalCount;
                return {
                    metricType,
                    title: "Active Production Ponds Breakdown",
                    icon: "🗺️",
                    subtitle: "Operational Capacity, Monthly Progression & Farm Utilization",
                    timelineTitle: "Monthly Operational Pond Capacity (12-Month)",
                    activePondMode,
                    summaryBadges: [
                        { label: "Current Operational", value: `${currentCount} / 216`, sub: "Ponds culturing today" },
                        { label: "12M Monthly Avg", value: `${opAgg.ytdAvg} Ponds`, sub: "Average operational capacity" },
                        { label: "Peak Capacity (Max)", value: `${opAgg.peakPonds} Ponds`, sub: `Reached in ${opAgg.peakMonth}` },
                        { label: "Lowest Capacity (Min)", value: `${opAgg.troughPonds} Ponds`, sub: `Annual low in ${opAgg.troughMonth}` }
                    ],
                    timeline,
                    monthOptions: [{ key: "ALL", label: "All Months (Current Active Ponds)" }, ...months12.slice().reverse().map(m => ({ key: m, label: formatMonthLabel(m) }))],
                    tableHeaders,
                    tableRows,
                    csvHeaders,
                    csvRows,
                    countDisplay
                };
            }

            case METRIC_TYPES.PREP_IDLE: {
                const nonProd = (dataBundle.activePonds || []).filter(p => !p.isActive && String(p.progressState || "").toUpperCase() !== "CULTURE");
                const ready = nonProd.filter(p => String(p.progressState || "").toUpperCase() === "READY").length;
                const idle = nonProd.filter(p => String(p.progressState || "").toUpperCase() === "IDLE").length;
                const prep = nonProd.length - idle;

                const filtered = nonProd.filter(p => {
                    if (query) {
                        const hay = `${p.pondCode || ""} ${p.progressState || ""} ${p.speciesLabel || ""}`.toLowerCase();
                        if (!hay.includes(query)) return false;
                    }
                    return true;
                });

                const tableHeaders = ["Pond Code", "Module", "Current Status", "Preparation Stage", "Days in Stage", "Target Action"];
                const tableRows = filtered.map(p => {
                    const mod = p.pondCode ? `Module ${p.pondCode.split(".")[0]}` : "—";
                    const days = p.progressDays !== undefined ? `${p.progressDays}d` : (p.docDisplay || "0d");
                    const st = p.progressState || "IDLE";
                    const action = st === "READY" ? "Stocking Dispatch Queue" : (st === "IDLE" ? "Scheduled Cleaning" : "Liming & Water Prep");
                    return [
                        p.pondCode || "—",
                        mod,
                        st,
                        p.progressLabel || p.speciesLabel || st,
                        days,
                        action
                    ];
                });

                const csvHeaders = ["Pond Code", "Module", "Status", "Preparation Stage", "Days in Stage", "Recommended Action"];
                const csvRows = filtered.map(p => [
                    p.pondCode || "",
                    p.pondCode ? `Module ${p.pondCode.split(".")[0]}` : "",
                    p.progressState || "IDLE",
                    p.progressLabel || p.speciesLabel || "",
                    p.progressDays || 0,
                    p.progressState === "READY" ? "Ready to Stock" : "Preparation"
                ]);

                return {
                    metricType,
                    title: "Ponds in Preparation & Turnaround Status",
                    icon: "🚜",
                    subtitle: "Turnaround Pipeline: Cleaning, Drying, Water Culture & Ready Ponds",
                    summaryBadges: [
                        { label: "Total Non-Culture", value: `${nonProd.length} Ponds`, sub: "Turnaround & idle inventory" },
                        { label: "Ready to Stock", value: `${ready} Ponds`, sub: "Water parameters passed" },
                        { label: "Active Preparation", value: `${prep} Ponds`, sub: "Cleaning, liming, repairing" },
                        { label: "Unprepared Idle", value: `${idle} Ponds`, sub: "Drying or scheduled" }
                    ],
                    timeline: [], // No monthly timeline needed for static daily snapshot
                    monthOptions: [{ key: "ALL", label: "Live Pond Snapshot" }],
                    tableHeaders,
                    tableRows,
                    csvHeaders,
                    csvRows,
                    countDisplay: `${filtered.length} ponds in preparation / idle`
                };
            }

            case METRIC_TYPES.BIOSECURITY: {
                const issues = dataBundle.issues || [];
                const monthsBuckets = months12.map(m => {
                    const monthIssues = issues.filter(iss => toMonthKey(iss.issue_date) === m);
                    const redCount = monthIssues.filter(iss => String(iss.issue_flag || "").toUpperCase() === "RED").length;
                    const yellowCount = monthIssues.filter(iss => String(iss.issue_flag || "").toUpperCase() === "YELLOW").length;
                    return {
                        monthKey: m,
                        monthLabel: formatMonthLabel(m),
                        value: redCount + yellowCount,
                        unit: "Alerts",
                        subValue: `${redCount} Red • ${yellowCount} Yellow`,
                        active: selectedMonth === m
                    };
                });

                const filtered = issues.filter(iss => {
                    if (selectedMonth !== "ALL") {
                        if (toMonthKey(iss.issue_date) !== selectedMonth) return false;
                    }
                    if (query) {
                        const hay = `${iss.pond_index || ""} ${iss.issue_category || ""} ${iss.issue_test || ""} ${iss.issue_note || ""}`.toLowerCase();
                        if (!hay.includes(query)) return false;
                    }
                    return true;
                });

                const tableHeaders = ["Pond Index", "Date", "Category / Pathogen", "Test / Method", "Severity Flag", "Grade", "Lab Diagnosis Note"];
                const tableRows = filtered.map(iss => {
                    const flag = String(iss.issue_flag || "GREEN").toUpperCase();
                    return [
                        iss.pond_index || "—",
                        iss.issue_date || "—",
                        iss.issue_category || "General Pathology",
                        iss.issue_test || "PCR Assay",
                        flag,
                        iss.issue_grade || "—",
                        iss.issue_note || "Negative / Normal"
                    ];
                });

                const csvHeaders = ["Pond Index", "Date", "Category", "Test", "Flag", "Grade", "Note"];
                const csvRows = filtered.map(iss => [
                    iss.pond_index || "",
                    iss.issue_date || "",
                    iss.issue_category || "",
                    iss.issue_test || "",
                    iss.issue_flag || "",
                    iss.issue_grade || "",
                    iss.issue_note || ""
                ]);

                const totalRed = issues.filter(iss => String(iss.issue_flag || "").toUpperCase() === "RED").length;
                const totalYellow = issues.filter(iss => String(iss.issue_flag || "").toUpperCase() === "YELLOW").length;

                return {
                    metricType,
                    title: "Pathogen Biosecurity & PCR Laboratory Telemetry",
                    icon: "🛡️",
                    subtitle: "Real-time Disease Surveillance: WSSV, EHP, AHPND, Vibrio & Yellow Head",
                    summaryBadges: [
                        { label: "Red Alerts", value: `${totalRed} Alerts`, sub: "High Pathogenicity Flag" },
                        { label: "Yellow Warnings", value: `${totalYellow} Warnings`, sub: "Elevated Colony Count / Watch" },
                        { label: "Telemetry Feed", value: "Supabase Active", sub: "Real-time Lab Ingestion" },
                        { label: "Recent Records", value: `${issues.length} Tests`, sub: "Sample records stored" }
                    ],
                    timeline: monthsBuckets,
                    monthOptions: [{ key: "ALL", label: "All Surveillance Months" }, ...months12.slice().reverse().map(m => ({ key: m, label: formatMonthLabel(m) }))],
                    tableHeaders,
                    tableRows,
                    csvHeaders,
                    csvRows,
                    countDisplay: `${filtered.length} biosecurity test records`
                };
            }

            default:
                return {
                    metricType,
                    title: "Executive Metric Drilldown",
                    icon: "📊",
                    subtitle: "",
                    summaryBadges: [],
                    timeline: [],
                    monthOptions: [{ key: "ALL", label: "All Months" }],
                    tableHeaders: [],
                    tableRows: [],
                    csvHeaders: [],
                    csvRows: [],
                    countDisplay: "0 records"
                };
        }
    }

    /**
     * Sorts an array of table row arrays by the given column index.
     * @param {Array<Array<any>>} rows 
     * @param {number} colIndex 
     * @param {string} direction 'asc' or 'desc'
     */
    static sortRows(rows, colIndex, direction) {
        return sortRows(rows, colIndex, direction);
    }
}

/**
 * Extracts a typed representation of a table cell value for sorting.
 * @param {any} val 
 * @returns {{ type: 'empty' | 'num' | 'date' | 'text', val: any }}
 */
export function parseSortValue(val) {
    if (val === null || val === undefined) return { type: "empty", val: "" };
    const str = String(val).trim();
    if (str === "" || str === "—" || str === "-" || str === "null" || str === "undefined") {
        return { type: "empty", val: "" };
    }

    // Check if currency (e.g. "RM 120,000", "RM55,000")
    if (/^RM\s*[\d,]+(\.\d+)?$/i.test(str)) {
        const num = parseFloat(str.replace(/[^0-9.-]/g, ""));
        return { type: "num", val: isNaN(num) ? 0 : num };
    }

    // Check if numeric with optional units (e.g. "12,000", "12.5 MT", "20.5 g", "45d", "0.5 Ha", "75%", "PL 10", "39")
    const cleanNum = str.replace(/^(PL\s*|Module\s*)/i, "").replace(/,/g, "").replace(/\s*(MT|kg|g|d|Ha|%|Pcs|batches|Tests|Alerts|Warnings)$/i, "").trim();
    if (/^-?\d+(\.\d+)?$/.test(cleanNum)) {
        return { type: "num", val: parseFloat(cleanNum) };
    }

    // Check if date (YYYY-MM-DD or YYYY-MM-DD HH:mm:ss)
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
        const time = Date.parse(str);
        if (!isNaN(time)) return { type: "date", val: time };
    }

    // Default to lowercase string for natural text comparison
    return { type: "text", val: str.toLowerCase() };
}

/**
 * Compares two table cell values in ascending or descending direction.
 * Empty/dash values are always pushed to the bottom.
 * @param {any} a 
 * @param {any} b 
 * @param {string} [direction='asc'] 'asc' or 'desc'
 * @returns {number}
 */
export function compareSortCells(a, b, direction = "asc") {
    const valA = parseSortValue(a);
    const valB = parseSortValue(b);

    // Always sort empty values to the bottom regardless of direction
    if (valA.type === "empty" && valB.type === "empty") return 0;
    if (valA.type === "empty") return 1;
    if (valB.type === "empty") return -1;

    let res = 0;
    if (valA.type === "num" && valB.type === "num") {
        res = valA.val - valB.val;
    } else if (valA.type === "date" && valB.type === "date") {
        res = valA.val - valB.val;
    } else {
        // Natural alphanumeric string comparison
        res = String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
    }

    return direction === "asc" ? res : -res;
}

/**
 * Sorts an array of table row arrays by the given column index.
 * Returns a new sorted array.
 * @param {Array<Array<any>>} rows 
 * @param {number} colIndex 
 * @param {string} direction 'asc' or 'desc'
 * @returns {Array<Array<any>>}
 */
export function sortRows(rows = [], colIndex = 0, direction = "asc") {
    if (!Array.isArray(rows) || rows.length === 0 || colIndex === null || colIndex === undefined || colIndex < 0) {
        return rows || [];
    }
    const cloned = rows.slice();
    cloned.sort((rowA, rowB) => {
        const cellA = rowA ? rowA[colIndex] : null;
        const cellB = rowB ? rowB[colIndex] : null;
        return compareSortCells(cellA, cellB, direction);
    });
    return cloned;
}
