import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
    ExecutiveMetricsPresenter,
    METRIC_TYPES,
    toMonthKey,
    formatMonthLabel,
    getRolling12Months,
    formatNumber,
    parseSortValue,
    compareSortCells,
    sortRows
} from "../src/modules/executive/ExecutiveMetricsPresenter.js";

describe("ExecutiveMetricsPresenter: Temporal Helpers", () => {
    test("toMonthKey converts valid dates and strings to YYYY-MM", () => {
        assert.equal(toMonthKey("2026-10-15"), "2026-10");
        assert.equal(toMonthKey(new Date(2026, 9, 1)), "2026-10"); // Month 9 is October (0-indexed)
        assert.equal(toMonthKey(null), null);
        assert.equal(toMonthKey(""), null);
        assert.equal(toMonthKey("invalid-date"), null);
    });

    test("formatMonthLabel returns friendly month and year", () => {
        assert.equal(formatMonthLabel("2026-10"), "Oct 2026");
        assert.equal(formatMonthLabel("2025-01"), "Jan 2025");
        assert.equal(formatMonthLabel(""), "");
    });

    test("getRolling12Months returns exactly 12 month strings ending at referenceDate", () => {
        const ref = new Date(2026, 9, 29); // Oct 2026
        const months = getRolling12Months(12, ref);
        assert.equal(months.length, 12);
        assert.equal(months[months.length - 1], "2026-10");
        assert.equal(months[0], "2025-11");
    });

    test("formatNumber formats values with commas and decimals", () => {
        assert.equal(formatNumber(1250000), "1,250,000");
        assert.equal(formatNumber(850.45, 1), "850.5");
        assert.equal(formatNumber(0), "0");
        assert.equal(formatNumber(null), "0");
    });
});

describe("ExecutiveMetricsPresenter: Harvest Aggregation", () => {
    test("accurately aggregates daily harvests into monthly buckets, YTD, and MTD", () => {
        const refDate = new Date(2026, 9, 29); // Oct 2026
        const mockDaily = [
            // October 2026 (MTD & YTD)
            { harv_date: "2026-10-05", harv_weight: 12000, harv_status: "PARTIAL", harv_abw: 18.5, harv_revenue: 120000 },
            { harv_date: "2026-10-15", harv_weight: 8000, harv_status: "FINAL", harv_abw: 20.0, harv_revenue: 85000 },
            // May 2026 (YTD only)
            { harv_date: "2026-05-10", harv_weight: 15000, harv_status: "FINAL", harv_abw: 22.0, harv_revenue: 160000 },
            // November 2025 (Within 12M rolling, but NOT in current year 2026)
            { harv_date: "2025-11-20", harv_weight: 10000, harv_status: "FINAL", harv_abw: 19.0, harv_revenue: 105000 }
        ];

        const res = ExecutiveMetricsPresenter.aggregateMonthlyHarvest(mockDaily, [], refDate);

        // MTD (October 2026): 12,000 + 8,000 kg = 20,000 kg = 20 MT
        assert.equal(res.mtdTonnage, 20);
        assert.equal(res.mtdRevenue, 205000);

        // YTD (2026): Oct (20 MT) + May (15 MT) = 35 MT
        assert.equal(res.ytdTonnage, 35);
        assert.equal(res.ytdRevenue, 365000);
        assert.equal(res.ytdCount, 3);

        // Rolling 12M: 35 MT + Nov 2025 (10 MT) = 45 MT
        assert.equal(res.rolling12Tonnage, 45);

        // Verify buckets
        assert.equal(res.buckets.length, 12);
        const octBucket = res.buckets.find(b => b.monthKey === "2026-10");
        assert.ok(octBucket);
        assert.equal(octBucket.tonnage, 20);
        assert.equal(octBucket.partialTons, 12);
        assert.equal(octBucket.finalTons, 8);
    });
});

describe("ExecutiveMetricsPresenter: Stocking Aggregation", () => {
    test("accurately aggregates stocking batches into fry counts, species split, YTD, and MTD", () => {
        const refDate = new Date(2026, 9, 29); // Oct 2026
        const mockStocking = [
            // October 2026
            { stck_date: "2026-10-02", stck_pcs: 2500000, stck_species: "P. VANNAMEI" },
            { stck_date: "2026-10-18", stck_pcs: 1000000, stck_species: "P. MONODON" },
            // April 2026 (YTD)
            { stck_date: "2026-04-12", stck_pcs: 3000000, stck_species: "VAN" },
            // December 2025 (12M rolling)
            { stck_date: "2025-12-05", stck_pcs: 2000000, stck_species: "VAN" }
        ];

        const res = ExecutiveMetricsPresenter.aggregateMonthlyStocking(mockStocking, refDate);

        // MTD (Oct 2026): 2.5M + 1.0M = 3.5M
        assert.equal(res.mtdMillion, 3.5);
        assert.equal(res.mtdPcs, 3500000);

        // YTD (2026): 3.5M + 3.0M = 6.5M
        assert.equal(res.ytdMillion, 6.5);
        assert.equal(res.ytdPcs, 6500000);
        assert.equal(res.ytdBatches, 3);

        // Rolling 12M: 6.5M + 2.0M = 8.5M
        assert.equal(res.rolling12Million, 8.5);

        const octBucket = res.buckets.find(b => b.monthKey === "2026-10");
        assert.ok(octBucket);
        assert.equal(octBucket.vanMillion, 2.5);
        assert.equal(octBucket.monMillion, 1.0);
    });
});

describe("ExecutiveMetricsPresenter: Species Composition", () => {
    test("computes correct percentage of active pond count for VAN vs MON", () => {
        const mockActivePonds = [
            { isActive: true, speciesCode: "VAN", progressState: "CULTURE" },
            { isActive: true, speciesCode: "VAN", progressState: "CULTURE" },
            { isActive: true, speciesCode: "VAN", progressState: "CULTURE" },
            { isActive: true, speciesCode: "MON", progressState: "CULTURE" },
            // Idle ponds should be ignored
            { isActive: false, speciesCode: "IDLE", progressState: "IDLE" },
            { isActive: false, speciesCode: "READY", progressState: "READY" }
        ];

        const res = ExecutiveMetricsPresenter.calculateSpeciesComposition(mockActivePonds);
        assert.equal(res.totalActive, 4);
        assert.equal(res.vanCount, 3);
        assert.equal(res.monCount, 1);
        assert.equal(res.vanPercent, 75);
        assert.equal(res.monPercent, 25);
    });

    test("handles zero active ponds gracefully", () => {
        const res = ExecutiveMetricsPresenter.calculateSpeciesComposition([]);
        assert.equal(res.totalActive, 0);
        assert.equal(res.vanPercent, 0);
        assert.equal(res.monPercent, 0);
    });
});

describe("ExecutiveMetricsPresenter: DOC Composition", () => {
    test("classifies active ponds into Early, Mid, Finishing stages and computes average DOC", () => {
        const mockPonds = [
            // VAN Ponds
            { isActive: true, speciesCode: "VAN", doc: 20 },  // Early (<30)
            { isActive: true, speciesCode: "VAN", doc: 50 },  // Mid (30-70)
            { isActive: true, speciesCode: "VAN", doc: 60 },  // Mid (30-70)
            { isActive: true, speciesCode: "VAN", doc: 90 },  // Finishing (>70)
            // MON Ponds
            { isActive: true, speciesCode: "MON", doc: 80 },  // Finishing (>70)
            { isActive: true, speciesCode: "MON", doc: 120 }  // Finishing (>70)
        ];

        const res = ExecutiveMetricsPresenter.calculateDocComposition(mockPonds);
        assert.equal(res.total, 6);

        // VAN (4 ponds): 20, 50, 60, 90 -> sum = 220, avg = 55
        assert.equal(res.van.count, 4);
        assert.equal(res.van.early, 1);
        assert.equal(res.van.mid, 2);
        assert.equal(res.van.finishing, 1);
        assert.equal(res.van.avgDoc, 55);
        assert.equal(res.van.earlyPct, 25);
        assert.equal(res.van.midPct, 50);
        assert.equal(res.van.finishingPct, 25);

        // MON (2 ponds): 80, 120 -> sum = 200, avg = 100
        assert.equal(res.mon.count, 2);
        assert.equal(res.mon.finishing, 2);
        assert.equal(res.mon.avgDoc, 100);
        assert.equal(res.mon.finishingPct, 100);

        // Overall: Farm Total DOC = 420 / 6 = 70
        assert.equal(res.overall.avgDoc, 70);
    });
});

describe("ExecutiveMetricsPresenter: DrillDown ViewModel & CSV Data", () => {
    test("builds valid drilldown model for HARVEST with CSV export data", () => {
        const bundle = {
            dailyHarvests: [
                { pond_index: "2010101.39", pond: "01.01.01", harv_date: "2026-10-10", harv_weight: 5000, harv_status: "FINAL", harv_abw: 21, harv_revenue: 55000 },
                { pond_index: "2010102.39", pond: "01.01.02", harv_date: "2026-09-15", harv_weight: 4000, harv_status: "PARTIAL", harv_abw: 17, harv_revenue: 40000 }
            ]
        };

        const vmAll = ExecutiveMetricsPresenter.getMetricDrillDownData(METRIC_TYPES.HARVEST, bundle, "ALL", "");
        assert.equal(vmAll.title, "Total Farm Harvest Intelligence");
        assert.equal(vmAll.tableRows.length, 2);
        assert.equal(vmAll.csvHeaders.length, 9);
        assert.equal(vmAll.csvRows.length, 2);

        // Filter to October 2026
        const vmOct = ExecutiveMetricsPresenter.getMetricDrillDownData(METRIC_TYPES.HARVEST, bundle, "2026-10", "");
        assert.equal(vmOct.tableRows.length, 1);
        assert.equal(vmOct.tableRows[0][0], "01.01.01");

        // Search query
        const vmSearch = ExecutiveMetricsPresenter.getMetricDrillDownData(METRIC_TYPES.HARVEST, bundle, "ALL", "01.01.02");
        assert.equal(vmSearch.tableRows.length, 1);
        assert.equal(vmSearch.tableRows[0][0], "01.01.02");
    });

    test("builds valid drilldown model for STOCKING", () => {
        const bundle = {
            stockingBatches: [
                { pond_index: "2010101.40", stck_date: "2026-10-01", stck_species: "VAN", stck_source: "TPH Hatchery", stck_tank: "T-01", stck_pcs: 300000, stck_size: 10 }
            ]
        };

        const vm = ExecutiveMetricsPresenter.getMetricDrillDownData(METRIC_TYPES.STOCKING, bundle, "ALL", "");
        assert.equal(vm.title, "Total Post-Larvae & Fry Stocking");
        assert.equal(vm.tableRows.length, 1);
        assert.equal(vm.tableRows[0][0], "2010101.40");
        assert.equal(vm.csvRows.length, 1);
    });

    test("builds valid drilldown model for SPECIES_COMP and DOC_COMP", () => {
        const bundle = {
            activePonds: [
                { pondCode: "01.01.01", pondIndex: "2010101.39", speciesLabel: "VAN", speciesCode: "VAN", isActive: true, doc: 45, stageCode: "MID", health: "GREEN", progressState: "CULTURE" }
            ]
        };

        const vmSp = ExecutiveMetricsPresenter.getMetricDrillDownData(METRIC_TYPES.SPECIES_COMP, bundle, "ALL", "");
        assert.equal(vmSp.title, "Species Composition & Allocation Dynamics");
        assert.equal(vmSp.tableRows.length, 1);

        const vmDoc = ExecutiveMetricsPresenter.getMetricDrillDownData(METRIC_TYPES.DOC_COMP, bundle, "ALL", "");
        assert.equal(vmDoc.title, "DOC & Culture Stage Composition by Species");
        assert.equal(vmDoc.tableRows.length, 1);
    });
});

describe("ExecutiveMetricsPresenter: Operational Ponds Aggregation & DrillDown", () => {
    test("accurately aggregates daily operational counts across multi-month cycles", () => {
        const refDate = new Date(2026, 9, 29); // Oct 2026
        const mockCycles = [
            // Active through Aug, Sep, and closes Oct 15
            { pond_index: "2010101.40", pond: "01.01.01", modl: "M01", row_no: "R01", pond_status: "PRODUCTION", stck_date: "2026-08-01", date_close: "2026-10-15", stck_species: "VAN" },
            // Active through Sep, Oct, and open/ongoing (date_close: null)
            { pond_index: "2010102.40", pond: "01.01.02", modl: "M01", row_no: "R01", pond_status: "PRODUCTION", stck_date: "2026-09-01", date_close: null, stck_species: "VAN" },
            // Closed prior in Feb (stocked Jan 10, closed Feb 20)
            { pond_index: "2010103.39", pond: "01.01.03", modl: "M01", row_no: "R01", pond_status: "PRODUCTION", stck_date: "2026-01-10", date_close: "2026-02-20", stck_species: "MON" }
        ];

        const resAvg = ExecutiveMetricsPresenter.aggregateMonthlyOperationalPonds(mockCycles, refDate, "AVG");
        assert.equal(resAvg.buckets.length, 12);

        // Sep 2026: both cycles active every day of the month -> min=2, max=2, avg=2
        const sepBucket = resAvg.buckets.find(b => b.monthKey === "2026-09");
        assert.ok(sepBucket);
        assert.equal(sepBucket.avg, 2);
        assert.equal(sepBucket.min, 2);
        assert.equal(sepBucket.max, 2);
        assert.equal(sepBucket.value, 2);

        // Peak / Max capacity mode
        const resMax = ExecutiveMetricsPresenter.aggregateMonthlyOperationalPonds(mockCycles, refDate, "MAX");
        const sepBucketMax = resMax.buckets.find(b => b.monthKey === "2026-09");
        assert.equal(sepBucketMax.value, 2);

        // Lowest / Min capacity mode
        const resMin = ExecutiveMetricsPresenter.aggregateMonthlyOperationalPonds(mockCycles, refDate, "MIN");
        const sepBucketMin = resMin.buckets.find(b => b.monthKey === "2026-09");
        assert.equal(sepBucketMin.value, 2);

        // Verify summary metrics
        assert.ok(resAvg.peakPonds >= 2);
        assert.ok(resAvg.ytdAvg >= 0);
    });

    test("builds valid drilldown model for ACTIVE_PONDS with selected month filtering", () => {
        const bundle = {
            activePonds: [
                { pondCode: "01.01.01", pondIndex: "2010101.40", modl: "M01", row: "R01", speciesLabel: "VAN", speciesCode: "VAN", isActive: true, doc: 60, stageCode: "MID", health: "GREEN", progressState: "CULTURE" }
            ],
            operationalCycles: [
                { pond_index: "2010101.40", pond: "01.01.01", modl: "M01", row_no: "R01", pond_status: "PRODUCTION", stck_date: "2026-08-01", date_close: "2026-10-15", stck_species: "VAN" },
                { pond_index: "2010102.40", pond: "01.01.02", modl: "M01", row_no: "R01", pond_status: "PRODUCTION", stck_date: "2026-09-01", date_close: null, stck_species: "VAN" },
                { pond_index: "2010103.39", pond: "01.01.03", modl: "M01", row_no: "R01", pond_status: "PRODUCTION", stck_date: "2026-01-10", date_close: "2026-02-20", stck_species: "MON" }
            ],
            samplings: [
                { pond_index: "2010101.40", smpl_date: "2026-10-10", smpl_doc: 60, smpl_abw: 24.5, smpl_bms: 3200 },
                { pond_index: "2010102.40", smpl_date: "2026-09-25", smpl_doc: 25, smpl_abw: 12.8, smpl_bms: 1550 }
            ]
        };

        // When "ALL" is selected, shows active operational ponds with sampling columns
        const vmAll = ExecutiveMetricsPresenter.getMetricDrillDownData(METRIC_TYPES.ACTIVE_PONDS, bundle, "ALL", "");
        assert.equal(vmAll.title, "Active Production Ponds Breakdown");
        assert.equal(vmAll.tableRows.length, 1);
        assert.equal(vmAll.tableHeaders[0], "Pond Code");
        assert.equal(vmAll.tableHeaders[6], "Latest ABW (g)");
        assert.equal(vmAll.tableHeaders[7], "Est Biomass (kg)");
        assert.equal(vmAll.tableRows[0][6], "24.5 g");
        assert.equal(vmAll.tableRows[0][7], "3,200 kg");

        // When a specific month is selected (e.g. Sep 2026), shows operational cycles in that month with sampling
        const vmSep = ExecutiveMetricsPresenter.getMetricDrillDownData(METRIC_TYPES.ACTIVE_PONDS, bundle, "2026-09", "");
        assert.equal(vmSep.tableHeaders[0], "Pond Code");
        assert.equal(vmSep.tableHeaders[6], "Latest ABW (g)");
        assert.equal(vmSep.tableHeaders[7], "Est Biomass (kg)");
        assert.equal(vmSep.tableRows.length, 2); // 2010101.40 and 2010102.40 were active in Sep
        assert.equal(vmSep.csvRows.length, 2);

        // When Jan 2026 is selected, only the Jan cycle appears and has dashes for unsampled metrics
        const vmJan = ExecutiveMetricsPresenter.getMetricDrillDownData(METRIC_TYPES.ACTIVE_PONDS, bundle, "2026-01", "");
        assert.equal(vmJan.tableRows.length, 1);
        assert.equal(vmJan.tableRows[0][0], "01.01.03");
        assert.equal(vmJan.tableRows[0][6], "—");
        assert.equal(vmJan.tableRows[0][7], "—");
    });
});

describe("ExecutiveMetricsPresenter: Table Column Sorting", () => {
    test("parseSortValue accurately classifies currencies, units, dates, text, and empty values", () => {
        assert.equal(parseSortValue("RM 120,000").type, "num");
        assert.equal(parseSortValue("RM 120,000").val, 120000);

        assert.equal(parseSortValue("45d").type, "num");
        assert.equal(parseSortValue("45d").val, 45);

        assert.equal(parseSortValue("12.5 MT").type, "num");
        assert.equal(parseSortValue("12.5 MT").val, 12.5);

        assert.equal(parseSortValue("0.5 Ha").type, "num");
        assert.equal(parseSortValue("0.5 Ha").val, 0.5);

        assert.equal(parseSortValue("PL 10").type, "num");
        assert.equal(parseSortValue("PL 10").val, 10);

        assert.equal(parseSortValue("2026-10-15").type, "date");
        assert.equal(parseSortValue("VAN").type, "text");

        assert.equal(parseSortValue("—").type, "empty");
        assert.equal(parseSortValue("").type, "empty");
        assert.equal(parseSortValue(null).type, "empty");
    });

    test("sortRows sorts numeric columns with units ascending and descending", () => {
        const rows = [
            ["01.01.01", "45d"],
            ["01.01.02", "120d"],
            ["01.01.03", "20d"],
            ["01.01.04", "—"]
        ];

        // Ascending
        const sortedAsc = sortRows(rows, 1, "asc");
        assert.deepEqual(sortedAsc.map(r => r[0]), ["01.01.03", "01.01.01", "01.01.02", "01.01.04"]);

        // Descending (empty stays at bottom)
        const sortedDesc = sortRows(rows, 1, "desc");
        assert.deepEqual(sortedDesc.map(r => r[0]), ["01.01.02", "01.01.01", "01.01.03", "01.01.04"]);
    });

    test("sortRows sorts dates and natural alphanumeric pond codes", () => {
        const pondRows = [
            ["01.02.01", "2026-09-01"],
            ["01.01.02", "2026-10-15"],
            ["01.01.01", "2026-08-01"],
            ["01.01.03", "—"]
        ];

        // Sort by pond code asc
        const byPondAsc = sortRows(pondRows, 0, "asc");
        assert.deepEqual(byPondAsc.map(r => r[0]), ["01.01.01", "01.01.02", "01.01.03", "01.02.01"]);

        // Sort by date desc (empty dates at bottom)
        const byDateDesc = sortRows(pondRows, 1, "desc");
        assert.deepEqual(byDateDesc.map(r => r[0]), ["01.01.02", "01.02.01", "01.01.01", "01.01.03"]);
    });
});
