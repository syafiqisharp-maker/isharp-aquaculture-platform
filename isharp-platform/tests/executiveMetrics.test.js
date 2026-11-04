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

    test("reconciles mid-week Daily Excel stocked ponds with weekly Supabase DBMS stocking batches without double counting", () => {
        const refDate = new Date(2026, 10, 4); // Nov 4, 2026
        const mockStockingBatches = [
            // Pond 01.01.01 Cycle 40 stocked in Oct 2026 with 2 batches (1.2M + 1.3M = 2.5M VAN)
            { pond_index: "2010101.40", stck_date: "2026-10-10", stck_pcs: 1200000, stck_allow: 50000, stck_total: 1250000, stck_species: "P. VANNAMEI", stck_source: "Blue Hatchery", stck_tank: "T1", stck_size: 10 },
            { pond_index: "2010101.40", stck_date: "2026-10-10", stck_pcs: 1300000, stck_allow: 50000, stck_total: 1350000, stck_species: "P. VANNAMEI", stck_source: "Blue Hatchery", stck_tank: "T2", stck_size: 10 },
            // Pond 02.04.01 Cycle 41 stocked in Oct 2026 with 1.0M MON
            { pond_index: "2020401.41", stck_date: "2026-10-20", stck_pcs: 1000000, stck_allow: 40000, stck_total: 1040000, stck_species: "P. MONODON", stck_source: "Mon Hatchery", stck_tank: "M1", stck_size: 12 }
        ];
        const mockDailyProgress = [
            // Pond 01.01.01 already in Supabase DBMS (must NOT be double counted)
            { pond: "01.01.01", progress_state: "CULTURE", status_code: "Opr", stocking_date: "2026-10-10", raw_template_status: "CULTURE VAN" },
            // Pond 03.06.05 newly stocked mid-week on Nov 2, 2026 (MON) -> NOT yet in pond_stocking_batches
            { pond: "03.06.05", progress_state: "CULTURE", status_code: "Opr", stocking_date: "2026-11-02", map_code: "MON", raw_template_status: "CULTURE MON" },
            // Pond 09.17.02 newly stocked mid-week on Nov 3, 2026 (VAN) -> NOT yet in pond_stocking_batches
            { pond: "09.17.02", progress_state: "CULTURE", status_code: "Opr", stocking_date: "2026-11-03", map_code: "VAN", raw_template_status: "CULTURE VAN" },
            // Pond 04.08.01 is IDLE (not CULTURE), so its old stocking_date must be ignored
            { pond: "04.08.01", progress_state: "IDLE", status_code: "Hv", stocking_date: "2026-08-01" }
        ];
        const mockOpCycles = [
            { pond_index: "2010101.40", pond: "01.01.01", modl: "Module 01", cycle_no: 40, stck_date: "2026-10-10", stck_species: "P. VANNAMEI" },
            { pond_index: "2020401.41", pond: "02.04.01", modl: "Module 02", cycle_no: 41, stck_date: "2026-10-20", stck_species: "P. MONODON" }
        ];

        const agg = ExecutiveMetricsPresenter.aggregateMonthlyStocking(
            mockStockingBatches,
            refDate,
            mockDailyProgress,
            mockOpCycles
        );

        // Oct 2026: 3.5M fry across 2 distinct pond cycles (01.01.01 & 02.04.01), 0 pending daily Excel
        const octBucket = agg.buckets.find(b => b.monthKey === "2026-10");
        assert.equal(octBucket.millionPcs, 3.5);
        assert.equal(octBucket.pondCount, 2);
        assert.equal(octBucket.vanPondCount, 1);
        assert.equal(octBucket.monPondCount, 1);
        assert.equal(octBucket.pendingSyncCount, 0);

        // Nov 2026 (MTD): 0M synced fry, but 2 mid-week stocked ponds from Daily Excel (1 VAN + 1 MON)
        assert.equal(agg.mtdMillion, 0);
        assert.equal(agg.mtdPonds, 2);
        assert.equal(agg.mtdVanPonds, 1);
        assert.equal(agg.mtdMonPonds, 1);
        assert.equal(agg.mtdPendingPonds, 2);

        // YTD (2026): 3.5M fry (2.5M VAN + 1.0M MON), 4 stocked pond cycles (2 VAN + 2 MON), 5 total batches
        assert.equal(agg.ytdMillion, 3.5);
        assert.equal(agg.ytdVanMillion, 2.5);
        assert.equal(agg.ytdMonMillion, 1.0);
        assert.equal(agg.ytdPonds, 4);
        assert.equal(agg.ytdVanPonds, 2);
        assert.equal(agg.ytdMonPonds, 2);
        assert.equal(agg.ytdBatches, 5);

        // Verify DrillDown ViewModel for STOCKING
        const bundle = {
            stockingBatches: mockStockingBatches,
            dailyProgress: mockDailyProgress,
            operationalCycles: mockOpCycles
        };

        const vmStock = ExecutiveMetricsPresenter.getMetricDrillDownData(
            METRIC_TYPES.STOCKING,
            bundle,
            "2026-11",
            "",
            { stockingChartMode: "PONDS", referenceDate: refDate }
        );

        assert.equal(vmStock.tableHeaders[0], "Pond Name");
        assert.equal(vmStock.tableHeaders.length, 11);
        assert.equal(vmStock.csvHeaders[1], "Pond Name");
        assert.equal(vmStock.tableRows.length, 2);
        assert.equal(vmStock.tableRows[0][0], "09.17.02");
        assert.equal(vmStock.tableRows[0][6], "DAILY EXCEL (PENDING SYNC)");
        assert.equal(vmStock.tableRows[0][8], "Pending DBMS Sync");

        // Verify 4 Hero KPI Cards mirror Total Farm Harvest Intelligence
        assert.equal(vmStock.summaryBadges.length, 4);
        assert.equal(vmStock.summaryBadges[0].label, "YTD Stocking (Fry & Ponds)");
        assert.equal(vmStock.summaryBadges[0].value, "3.50 M • 4 Ponds");
        assert.equal(vmStock.summaryBadges[0].sub, "Calendar YTD");
        assert.ok(vmStock.summaryBadges[1].label.startsWith("MTD Stocking"));
        assert.equal(vmStock.summaryBadges[2].label, "Vannamei (VAN) Stocking YTD");
        assert.equal(vmStock.summaryBadges[2].value, "2.50 M • 2 Ponds");
        assert.equal(vmStock.summaryBadges[3].label, "Monodon (MON) Stocking YTD");
        assert.equal(vmStock.summaryBadges[3].value, "1.00 M • 2 Ponds");

        // Verify Dual-Bar Timeline Point for Nov 2026 in PONDS mode
        const novPoint = vmStock.timeline.find(t => t.monthKey === "2026-11");
        assert.ok(novPoint);
        assert.equal(novPoint.isDualSpecies, true);
        assert.equal(novPoint.value, 2);
        assert.equal(novPoint.vanValue, 1);
        assert.equal(novPoint.monValue, 1);
        assert.equal(novPoint.unit, "Ponds");
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

        // MON (2 ponds): 80 (Mid: 50–90d), 120 (Finishing: >90d) -> sum = 200, avg = 100
        assert.equal(res.mon.count, 2);
        assert.equal(res.mon.early, 0);
        assert.equal(res.mon.mid, 1);
        assert.equal(res.mon.finishing, 1);
        assert.equal(res.mon.avgDoc, 100);
        assert.equal(res.mon.midPct, 50);
        assert.equal(res.mon.finishingPct, 50);

        // Overall: Farm Total DOC = 420 / 6 = 70
        assert.equal(res.overall.avgDoc, 70);
        assert.equal(res.overall.early, 1);
        assert.equal(res.overall.mid, 3);
        assert.equal(res.overall.finishing, 2);
        assert.equal(res.overall.earlyPct, 17);
        assert.equal(res.overall.midPct, 50);
        assert.equal(res.overall.finishingPct, 33);
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
        assert.equal(vmAll.tableHeaders.length, 11);
        assert.equal(vmAll.tableHeaders[0], "Pond Name");
        assert.equal(vmAll.csvHeaders.length, 12);
        assert.equal(vmAll.csvHeaders[1], "Pond Name");
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

    test("reconciles mid-week Daily Excel harvests with weekly Supabase DBMS harvests without double counting", () => {
        const refDate = new Date(2026, 10, 4); // Nov 4, 2026
        const mockDailyHarvests = [
            // Pond 01.01.01 Cycle 38 harvested in March 2026
            { pond_index: "2010101.38", harv_date: "2026-03-15", harv_weight: 4000, harv_status: "FINAL", harv_abw: 20, harv_revenue: 44000 },
            // Pond 01.01.01 Cycle 39 harvested twice in Oct (1 partial + 1 final) -> counts as 1 cycle in Oct, but 2 total cycles for 01.01.01 in 2026 YTD
            { pond_index: "2010101.39", harv_date: "2026-10-10", harv_weight: 3000, harv_status: "PARTIAL", harv_abw: 18, harv_revenue: 30000 },
            { pond_index: "2010101.39", harv_date: "2026-10-25", harv_weight: 5000, harv_status: "FINAL", harv_abw: 21, harv_revenue: 55000 },
            // Pond 02.03.04 Cycle 40 harvested in Oct
            { pond_index: "2020304.40", harv_date: "2026-10-28", harv_weight: 6000, harv_status: "FINAL", harv_abw: 22, harv_revenue: 66000 }
        ];

        const mockDailyProgress = [
            // Already in Supabase DBMS (Oct 28) -> must NOT be duplicated
            { pond: "02.03.04", status_code: "Hv", progress_state: "IDLE", last_harvest_date: "2026-10-28" },
            // Mid-week harvested in Nov 2026 (only in Daily Excel, not yet in Supabase DBMS)
            { pond: "09.18.12", status_code: "Hv", progress_state: "IDLE", last_harvest_date: "2026-11-03" },
            { pond: "03.06.05", status_code: "Hv", progress_state: "IDLE", last_harvest_date: "2026-11-03" },
            // Already re-stocked into active CULTURE -> must NOT be counted as pending harvest
            { pond: "05.09.01", status_code: "C", progress_state: "CULTURE", last_harvest_date: "2026-08-10" }
        ];

        const mockOpCycles = [
            { pond_index: "2091812.41", pond: "09.18.12", modl: "Module 09", stck_date: "2026-08-27", stck_species: "P. VANNAMEI", pond_status: "PRODUCTION" },
            { pond_index: "2030605.42", pond: "03.06.05", modl: "Module 03", stck_date: "2026-08-24", stck_species: "P. MONODON", pond_status: "PRODUCTION" },
            { pond_index: "2020304.40", pond: "02.03.04", modl: "Module 02", stck_date: "2026-07-15", stck_species: "P. VANNAMEI", date_close: "2026-10-28", pond_status: "IDLE" }
        ];

        const agg = ExecutiveMetricsPresenter.aggregateMonthlyHarvest(
            mockDailyHarvests,
            [],
            refDate,
            mockDailyProgress,
            mockOpCycles
        );

        // MTD (Nov 2026): 0.0 MT from DBMS, but 2 mid-week harvested ponds from Daily Excel!
        assert.equal(agg.mtdTonnage, 0);
        assert.equal(agg.mtdPonds, 2);
        assert.equal(agg.mtdPendingPonds, 2);

        // YTD (2026): Mar (4 MT, 1 cycle) + Oct (8 + 6 = 14 MT, 2 cycles) + Nov (0 MT, 2 cycles) = 18 MT, 5 harvested pond cycles
        assert.equal(agg.ytdTonnage, 18);
        assert.equal(agg.ytdPonds, 5);
        assert.equal(agg.ytdPartialCount, 1);
        assert.equal(agg.ytdPendingPonds, 2);
        assert.equal(agg.pendingSyncTotal, 2);

        // Check DrillDown ViewModel in TONNAGE vs PONDS chart mode
        const bundle = {
            dailyHarvests: mockDailyHarvests,
            dailyProgress: mockDailyProgress,
            operationalCycles: mockOpCycles
        };

        const vmPonds = ExecutiveMetricsPresenter.getMetricDrillDownData(
            METRIC_TYPES.HARVEST,
            bundle,
            "2026-11",
            "",
            { harvestChartMode: "PONDS", referenceDate: refDate }
        );
        assert.equal(vmPonds.tableRows.length, 2);
        assert.equal(vmPonds.countDisplay, "2 harvested ponds");
        assert.equal(vmPonds.tableRows[0][0], "03.06.05");
        assert.equal(vmPonds.tableRows[0][5], "HARVESTED (MID-WEEK)");
        assert.equal(vmPonds.tableRows[0][6], "DAILY EXCEL (PENDING SYNC)");
        assert.equal(vmPonds.tableRows[0][7], "Pending DBMS Sync");

        const novTimelinePoint = vmPonds.timeline.find(t => t.monthKey === "2026-11");
        assert.ok(novTimelinePoint);
        assert.equal(novTimelinePoint.value, 2);
        assert.equal(novTimelinePoint.vanValue, 1);
        assert.equal(novTimelinePoint.monValue, 1);
        assert.equal(novTimelinePoint.isDualSpecies, true);
        assert.equal(novTimelinePoint.unit, "Ponds");

        // Verify Hero Cards: YTD, MTD, Vannamei (VAN) Harvest YTD, Monodon (MON) Harvest YTD (no 12M Rolling or Mid-Week Daily Excel hero card)
        assert.equal(vmPonds.summaryBadges.length, 4);
        assert.equal(vmPonds.summaryBadges[0].label, "YTD Harvest (Biomass & Ponds)");
        assert.equal(vmPonds.summaryBadges[0].value, "18.0 MT • 5 Ponds");
        assert.equal(vmPonds.summaryBadges[0].sub, "Calendar YTD • 1 Partial Harvests");
        assert.ok(vmPonds.summaryBadges[1].label.startsWith("MTD Harvest"));
        assert.equal(vmPonds.summaryBadges[2].label, "Vannamei (VAN) Harvest YTD");
        assert.equal(vmPonds.summaryBadges[2].value, "18.0 MT • 4 Ponds");
        assert.equal(vmPonds.summaryBadges[3].label, "Monodon (MON) Harvest YTD");
        assert.equal(vmPonds.summaryBadges[3].value, "0.0 MT • 1 Ponds");

        // Verify species filtering on table & timeline when harvestSpecies = 'MON'
        const vmMonOnly = ExecutiveMetricsPresenter.getMetricDrillDownData(
            METRIC_TYPES.HARVEST,
            bundle,
            "2026-11",
            "",
            { harvestChartMode: "PONDS", harvestSpecies: "MON", referenceDate: refDate }
        );
        assert.equal(vmMonOnly.tableRows.length, 1);
        assert.equal(vmMonOnly.tableRows[0][0], "03.06.05");
        assert.equal(vmMonOnly.tableRows[0][4], "MON");
    });

    test("builds valid drilldown model for STOCKING", () => {
        const bundle = {
            stockingBatches: [
                { pond_index: "2010101.40", stck_date: "2026-10-01", stck_species: "VAN", stck_source: "TPH Hatchery", stck_tank: "T-01", stck_pcs: 300000, stck_size: 10 }
            ]
        };

        const vm = ExecutiveMetricsPresenter.getMetricDrillDownData(METRIC_TYPES.STOCKING, bundle, "ALL", "");
        assert.equal(vm.title, "Total Post-Larvae & Fry Stocking");
        assert.equal(vm.tableHeaders[0], "Pond Name");
        assert.equal(vm.tableRows.length, 1);
        assert.equal(vm.tableRows[0][0], "01.01.01");
        assert.equal(vm.tableRows[0][1], "40");
        assert.equal(vm.csvRows.length, 1);
    });

    test("builds valid drilldown model for SPECIES_COMP (YTD-only, zero pond table, visual BI analytics) and DOC_COMP", () => {
        const refDate = new Date("2026-11-04T10:00:00Z");
        const bundle = {
            activePonds: [
                { pondCode: "01.01.01", pondIndex: "2010101.40", speciesLabel: "VAN", speciesCode: "VAN", isActive: true, doc: 45, stageCode: "MID", health: "GREEN", progressState: "CULTURE" },
                { pondCode: "05.09.01", pondIndex: "2050901.41", speciesLabel: "MON", speciesCode: "MON", isActive: true, doc: 60, stageCode: "MID", health: "GREEN", progressState: "CULTURE" }
            ],
            stockingBatches: [
                // 2026 YTD VAN batch (SHT hatchery)
                { pond_index: "2010101.40", stck_date: "2026-09-15", stck_species: "VAN", stck_source: "SHT", stck_pcs: 450000, stck_size: 15 },
                // 2026 YTD MON batch (KSK hatchery)
                { pond_index: "2050901.41", stck_date: "2026-10-05", stck_species: "MON", stck_source: "KSK", stck_pcs: 200000, stck_size: 18 },
                // 2025 batch (should be strictly excluded from 2026 Calendar YTD!)
                { pond_index: "2010101.39", stck_date: "2025-12-10", stck_species: "VAN", stck_source: "OLD_2025", stck_pcs: 500000, stck_size: 12 }
            ],
            operationalCycles: [
                { pond_index: "2010101.40", pond: "01.01.01", modl: "01", pond_status: "PRODUCTION", stck_date: "2026-09-15", stck_species: "P. VANNAMEI", stck_source: "SHT", bs_line: "Syaqua", stck_size: 15, stck_pcs: 450000 },
                { pond_index: "2050901.41", pond: "05.09.01", modl: "05", pond_status: "PRODUCTION", stck_date: "2026-10-05", stck_species: "P. MONODON", stck_source: "KSK", bs_line: "CP THAI", stck_size: 18, stck_pcs: 200000 },
                // Closed/Harvested VAN cycle in 2026 (SHT hatchery)
                { pond_index: "2010102.39", pond: "01.01.02", modl: "01", pond_status: "CLOSE", stck_date: "2026-04-01", date_close: "2026-07-10", stck_species: "P. VANNAMEI", stck_source: "SHT", bs_line: "Syaqua", stck_size: 14, stck_pcs: 400000 }
            ],
            dailyHarvests: [
                // 6,000 kg at 20g ABW = 300,000 pcs harvested out of 400,000 stocked -> 75.0% SR; 100d DOC -> 0.20 g/d ADG
                { pond_index: "2010102.39", harv_date: "2026-07-10", harv_status: "TERMINATION", harv_weight: 6000, harv_abw: 20 }
            ]
        };

        const vmSp = ExecutiveMetricsPresenter.getMetricDrillDownData(
            METRIC_TYPES.SPECIES_COMP,
            bundle,
            "ALL",
            "",
            { referenceDate: refDate, speciesCompScope: "YTD", speciesCompMode: "PONDS" }
        );
        assert.equal(vmSp.title, "Species Composition, Hatchery Portfolio & Allocation");
        assert.equal(vmSp.hideDataTable, true);
        assert.equal(vmSp.tableRows.length, 0);
        assert.ok(vmSp.visualAnalytics);

        // Verify strictly 2026 YTD months only (no 2025 months)
        assert.ok(vmSp.timeline.every(t => t.monthKey.startsWith("2026-")));
        assert.equal(vmSp.visualAnalytics.vanTotalPonds, 2);
        assert.equal(vmSp.visualAnalytics.monTotalPonds, 1);
        assert.equal(vmSp.visualAnalytics.vanHatcheries.length, 1);
        assert.equal(vmSp.visualAnalytics.vanHatcheries[0].source, "SHT");
        assert.equal(vmSp.visualAnalytics.monHatcheries.length, 1);
        assert.equal(vmSp.visualAnalytics.monHatcheries[0].source, "KSK");
        assert.equal(vmSp.visualAnalytics.vanGeneticLines[0].line, "SYAQUA");
        assert.equal(vmSp.visualAnalytics.monGeneticLines[0].line, "CP THAI");
        assert.equal(vmSp.visualAnalytics.vanHarvestPerf.length, 1);
        assert.equal(vmSp.visualAnalytics.vanHarvestPerf[0].source, "SHT");
        assert.equal(vmSp.visualAnalytics.vanHarvestPerf[0].harvestedPonds, 1);
        assert.equal(vmSp.visualAnalytics.vanHarvestPerf[0].avgSr, 75.0);
        assert.equal(vmSp.visualAnalytics.vanHarvestPerf[0].avgAdg, 0.20);
        assert.equal(vmSp.csvRows.length, 5); // 2 hatcheries + 2 genetic lines + 1 harvested perf row

        const vmDoc = ExecutiveMetricsPresenter.getMetricDrillDownData(METRIC_TYPES.DOC_COMP, bundle, "ALL", "");
        assert.equal(vmDoc.title, "DOC & Culture Stage Composition by Species");
        assert.equal(vmDoc.tableRows.length, 2);
        assert.ok(vmDoc.visualAnalytics, "DOC drilldown should produce visualAnalytics bundle");
        assert.equal(vmDoc.visualAnalytics.overallStats.count, 2);
        assert.equal(vmDoc.visualAnalytics.overallStats.avgDoc, 53);
        assert.equal(vmDoc.visualAnalytics.vanStats.count, 1);
        assert.equal(vmDoc.visualAnalytics.monStats.count, 1);
        assert.equal(vmDoc.timeline.length, 12, "Should produce 12 10-day age cohort buckets");
        assert.equal(vmDoc.summaryBadges.length, 4);
        assert.equal(vmDoc.summaryBadges[1].label, "Finishing Stage");

        // Test filtering by species: VAN only
        const vmDocVan = ExecutiveMetricsPresenter.getMetricDrillDownData(METRIC_TYPES.DOC_COMP, bundle, "ALL", "", { docSpeciesFilter: "VAN" });
        assert.equal(vmDocVan.tableRows.length, 1);
        assert.equal(vmDocVan.tableRows[0][0], "01.01.01");
        assert.equal(vmDocVan.summaryBadges[0].label, "VAN Crop Age Profile");
        assert.ok(vmDocVan.summaryBadges[0].value.includes("Avg 45d"));
        assert.equal(vmDocVan.summaryBadges[1].label, "VAN Finishing Stage (>60d)");
        assert.ok(vmDocVan.subtitle.includes("Vannamei (VAN)"));

        // Test filtering by species: MON only
        const vmDocMon = ExecutiveMetricsPresenter.getMetricDrillDownData(METRIC_TYPES.DOC_COMP, bundle, "ALL", "", { docSpeciesFilter: "MON" });
        assert.equal(vmDocMon.tableRows.length, 1);
        assert.equal(vmDocMon.tableRows[0][0], "05.09.01");
        assert.equal(vmDocMon.summaryBadges[0].label, "MON Crop Age Profile");
        assert.ok(vmDocMon.summaryBadges[0].value.includes("Avg 60d"));
        assert.equal(vmDocMon.summaryBadges[1].label, "MON Finishing Stage (>90d)");
        assert.ok(vmDocMon.subtitle.includes("Monodon (MON)"));

        // Test filtering by stage: EARLY (none in bundle) vs MID (2 in bundle)
        const vmDocEarly = ExecutiveMetricsPresenter.getMetricDrillDownData(METRIC_TYPES.DOC_COMP, bundle, "ALL", "", { docStageFilter: "EARLY" });
        assert.equal(vmDocEarly.tableRows.length, 0);
        const vmDocMid = ExecutiveMetricsPresenter.getMetricDrillDownData(METRIC_TYPES.DOC_COMP, bundle, "ALL", "", { docStageFilter: "MID" });
        assert.equal(vmDocMid.tableRows.length, 2);
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

describe("ExecutiveMetricsPresenter: Monthly Turnaround Stages & Preparation Breakdown", () => {
    const mockCycles = [
        {
            pond_index: "2010101.40",
            pond: "01.01.01",
            modl: "01",
            stck_date: "2026-09-20",
            date_cycle: "2026-08-01",     // Total: 50d
            date_cleaning: "2026-08-20",  // Idle->Clean: 19d
            date_filling: "2026-09-01",   // Clean->Fill: 12d
            date_culture: "2026-09-02"    // Fill->Stock: 19d
        },
        {
            pond_index: "2010102.40",
            pond: "01.01.02",
            modl: "01",
            stck_date: "2026-09-25",
            date_cycle: "2026-08-05",     // Total: 51d
            date_cleaning: "2026-08-26",  // Idle->Clean: 21d
            date_repair: "2026-09-05",    // Clean->Fill: 10d (fallback to repair)
            date_culture: "2026-09-06"    // Fill->Stock: 20d
        },
        {
            pond_index: "2010103.40",
            pond: "01.01.03",
            modl: "01",
            stck_date: "2026-08-15",
            date_cycle: "2026-06-15",     // Total: 61d
            date_cleaning: "2026-07-10",  // Idle->Clean: 25d
            date_filling: "2026-07-25"    // Clean->Fill: 15d, Fill->Stock: 21d
        }
    ];

    const mockActivePonds = [
        {
            pondCode: "02.03.01",
            isActive: false,
            progressState: "CLEANING",
            progressDays: 5,
            speciesLabel: "CLEANING"
        },
        {
            pondCode: "02.03.02",
            isActive: false,
            progressState: "READY",
            progressDays: 2,
            speciesLabel: "READY"
        },
        {
            pondCode: "02.03.03",
            isActive: false,
            progressState: "IDLE",
            progressDays: 14,
            speciesLabel: "IDLE"
        }
    ];

    test("aggregateMonthlyTurnaroundStages computes accurate averages for TOTAL, IDLE_CLEAN, CLEAN_FILL, and FILL_STOCK", () => {
        const refDate = new Date("2026-10-15");
        
        // Mode: TOTAL
        const resTotal = ExecutiveMetricsPresenter.aggregateMonthlyTurnaroundStages(mockCycles, refDate, "TOTAL");
        assert.equal(resTotal.buckets.length, 12);
        const sepBucket = resTotal.buckets.find(b => b.monthKey === "2026-09");
        assert.ok(sepBucket);
        assert.equal(sepBucket.stockedCount, 2);
        assert.equal(sepBucket.avgTotal, 50.5); // (50 + 51) / 2
        assert.equal(sepBucket.value, 50.5);
        assert.equal(sepBucket.unit, "Days");

        // Mode: IDLE_CLEAN
        const resIdleClean = ExecutiveMetricsPresenter.aggregateMonthlyTurnaroundStages(mockCycles, refDate, "IDLE_CLEAN");
        const sepIdle = resIdleClean.buckets.find(b => b.monthKey === "2026-09");
        assert.equal(sepIdle.avgIdleClean, 20); // (19 + 21) / 2
        assert.equal(sepIdle.value, 20);

        // Mode: CLEAN_FILL
        const resCleanFill = ExecutiveMetricsPresenter.aggregateMonthlyTurnaroundStages(mockCycles, refDate, "CLEAN_FILL");
        const sepClean = resCleanFill.buckets.find(b => b.monthKey === "2026-09");
        assert.equal(sepClean.avgCleanFill, 11); // (12 + 10) / 2
        assert.equal(sepClean.value, 11);

        // Mode: FILL_STOCK
        const resFillStock = ExecutiveMetricsPresenter.aggregateMonthlyTurnaroundStages(mockCycles, refDate, "FILL_STOCK");
        const sepFill = resFillStock.buckets.find(b => b.monthKey === "2026-09");
        assert.equal(sepFill.avgFillStock, 19); // (19 + 19) / 2
        assert.equal(sepFill.value, 19);

        // Velocity roll-up summary
        assert.ok(resTotal.annualAvg > 0);
        assert.equal(resTotal.fastestMonth, "Sep 2026");
        assert.equal(resTotal.fastestAvg, 50.5);
    });

    test("getMetricDrillDownData PREP_IDLE: Live Snapshot ('ALL') returns 5 columns without Preparation Stage", () => {
        const dataBundle = {
            activePonds: mockActivePonds,
            operationalCycles: mockCycles
        };

        const vm = ExecutiveMetricsPresenter.getMetricDrillDownData(
            METRIC_TYPES.PREP_IDLE,
            dataBundle,
            "ALL"
        );

        assert.equal(vm.metricType, METRIC_TYPES.PREP_IDLE);
        assert.equal(vm.title, "Ponds in Preparation & Turnaround Status");
        assert.equal(vm.timeline.length, 12);
        assert.ok(vm.monthOptions.length >= 13);
        assert.equal(vm.monthOptions[0].key, "ALL");

        // Headers must have exactly 5 columns with redundant "Preparation Stage" removed
        assert.deepEqual(vm.tableHeaders, ["Pond Code", "Module", "Current Status", "Days in Stage", "Target Action"]);
        assert.equal(vm.tableRows.length, 3);
        assert.equal(vm.tableRows[0][0], "02.03.01");
        assert.equal(vm.tableRows[0][2], "CLEANING");
        assert.equal(vm.tableRows[0][3], "5d");

        // Summary badges
        assert.equal(vm.summaryBadges.length, 4);
        assert.ok(vm.summaryBadges[0].label.includes("Turnaround"));
    });

    test("getMetricDrillDownData PREP_IDLE: Month Selection returns turnaround milestone columns", () => {
        const dataBundle = {
            activePonds: mockActivePonds,
            operationalCycles: mockCycles
        };

        const vm = ExecutiveMetricsPresenter.getMetricDrillDownData(
            METRIC_TYPES.PREP_IDLE,
            dataBundle,
            "2026-09",
            "",
            { prepChartMode: "TOTAL" }
        );

        // Headers for month view must break down the turnaround pipeline
        assert.deepEqual(vm.tableHeaders, ["Pond Code", "Module", "Idle ➔ Clean", "Clean ➔ Fill", "Fill ➔ Stock", "Total Turnaround", "Stock Date"]);
        assert.equal(vm.tableRows.length, 2); // 2 cycles stocked in Sep 2026
        assert.equal(vm.tableRows[0][0], "01.01.01");
        assert.equal(vm.tableRows[0][2], "19d");
        assert.equal(vm.tableRows[0][3], "12d");
        assert.equal(vm.tableRows[0][4], "19d");
        assert.equal(vm.tableRows[0][5], "50d");
        assert.equal(vm.tableRows[0][6], "2026-09-20");

        // CSV export sync
        assert.equal(vm.csvHeaders.length, 7);
        assert.equal(vm.csvRows.length, 2);
        assert.equal(vm.csvRows[0][5], 50);
    });

    test("getMetricDrillDownData PREP_IDLE: Count of Ponds filters (Cleaned, Repaired, Water Filled)", () => {
        const dataBundle = {
            activePonds: mockActivePonds,
            operationalCycles: mockCycles
        };

        // Test COUNT_CLEANED in August 2026 (2 cycles cleaned in Aug: 01.01.01 on Aug 20 and 01.01.02 on Aug 26)
        const vmClean = ExecutiveMetricsPresenter.getMetricDrillDownData(
            METRIC_TYPES.PREP_IDLE,
            dataBundle,
            "2026-08",
            "",
            { prepChartMode: "COUNT_CLEANED" }
        );

        assert.equal(vmClean.timelineTitle, "Monthly Ponds Cleaned (Count)");
        const augBucket = vmClean.timeline.find(b => b.monthKey === "2026-08");
        assert.equal(augBucket.value, 2); // 2 ponds cleaned in Aug
        assert.equal(augBucket.unit, "Ponds");

        assert.deepEqual(vmClean.tableHeaders, ["Pond Code", "Module", "Cleaning Date", "Cycle Start", "Days to Clean", "Status"]);
        assert.equal(vmClean.tableRows.length, 2);
        assert.equal(vmClean.tableRows[0][0], "01.01.01");
        assert.equal(vmClean.tableRows[0][2], "2026-08-20");

        // Test COUNT_FILLED in September 2026 (1 cycle filled in Sep: 01.01.01 on Sep 01)
        const vmFill = ExecutiveMetricsPresenter.getMetricDrillDownData(
            METRIC_TYPES.PREP_IDLE,
            dataBundle,
            "2026-09",
            "",
            { prepChartMode: "COUNT_FILLED" }
        );

        assert.equal(vmFill.timelineTitle, "Monthly Ponds Water Filled (Count)");
        const sepFillBucket = vmFill.timeline.find(b => b.monthKey === "2026-09");
        assert.equal(sepFillBucket.value, 1); // 1 pond filled in Sep
        assert.deepEqual(vmFill.tableHeaders, ["Pond Code", "Module", "Water Fill Date", "Culture Date", "Stock Date", "Status"]);
        assert.equal(vmFill.tableRows.length, 1);
        assert.equal(vmFill.tableRows[0][0], "01.01.01");
        assert.equal(vmFill.tableRows[0][2], "2026-09-01");
    });
});

describe("ExecutiveMetricsPresenter: Shrimp Health, Growth & Survival Performance", () => {
    const mockPonds = [
        {
            pondCode: "01.01.01",
            pondIndex: "10101",
            speciesCode: "VAN",
            speciesLabel: "Vannamei",
            doc: 60,
            stckDate: "2026-08-01",
            isActive: true,
            progressState: "CULTURE"
        },
        {
            pondCode: "01.02.01",
            pondIndex: "10201",
            speciesCode: "VAN",
            speciesLabel: "Vannamei",
            doc: 60,
            stckDate: "2026-08-01",
            isActive: true,
            progressState: "CULTURE"
        },
        {
            pondCode: "02.01.01",
            pondIndex: "20101",
            speciesCode: "MON",
            speciesLabel: "Monodon",
            doc: 70,
            stckDate: "2026-07-20",
            isActive: true,
            progressState: "CULTURE"
        },
        {
            pondCode: "03.01.01",
            pondIndex: "30101",
            speciesCode: "VAN",
            speciesLabel: "Vannamei",
            doc: 0,
            isActive: false,
            progressState: "IDLE"
        }
    ];

    const mockSamplings = [
        {
            pond_index: "10101",
            smpl_date: "2026-09-30",
            smpl_doc: 60,
            smpl_abw: 12.0, // On track for VAN (standard at 60d is 10.2g, 12.0 / 60 = 0.20 g/d)
            smpl_surv: 85.0
        },
        {
            pond_index: "10201",
            smpl_date: "2026-09-30",
            smpl_doc: 60,
            smpl_abw: 6.0, // Slow growth for VAN (6.0g vs target 10.2g = 59% < 80%)
            smpl_surv: 55.0 // Critical low survival (<60%)
        },
        {
            pond_index: "20101",
            smpl_date: "2026-09-28",
            smpl_doc: 70,
            smpl_abw: 11.5, // On track for MON (standard at 70d is 11.2g, 11.5 / 70 = 0.16 g/d)
            smpl_surv: 78.0
        }
    ];

    const mockIssues = [
        {
            pond_index: "10201",
            issue_date: "2026-09-29",
            issue_category: "EHP Stunting",
            issue_test: "PCR Assay",
            issue_flag: "RED",
            issue_note: "EHP Positive - Slow growth"
        }
    ];

    test("aggregateGrowthAndSurvival calculates ADG, survival, target comparison, and species separation", () => {
        const agg = ExecutiveMetricsPresenter.aggregateGrowthAndSurvival(
            mockPonds,
            mockSamplings,
            mockIssues,
            { speciesFilter: "ALL", chartMode: "ADG", viewPerspective: "MODULE" }
        );

        // Only 3 culturing ponds
        assert.equal(agg.allEnrichedPonds.length, 3);
        assert.equal(agg.activePool.length, 3);

        // Check overall ADG:
        // Pond 10101: 12.0 / 60 = 0.20 g/d
        // Pond 10201: 6.0 / 60 = 0.10 g/d
        // Pond 20101: 11.5 / 70 = 0.16 g/d
        // Total = 0.46 / 3 = 0.15 g/d
        assert.equal(agg.overallAvgAdg, 0.15);
        // VAN ADG: (0.20 + 0.10) / 2 = 0.15 g/d
        assert.equal(agg.vanAvgAdg, 0.15);
        // MON ADG: 0.16 g/d
        assert.equal(agg.monAvgAdg, 0.16);

        // Check Survival Rates:
        // (85.0 + 55.0 + 78.0) / 3 = 72.7%
        assert.equal(agg.overallAvgSr, 72.7);
        // VAN SR: (85.0 + 55.0) / 2 = 70%
        assert.equal(agg.vanAvgSr, 70);
        // MON SR: 78%
        assert.equal(agg.monAvgSr, 78);

        // Behind target: Pond 10201 is lagging (6.0g vs 10.2g)
        assert.equal(agg.totalBehind, 1);
        assert.equal(agg.vanBehind, 1);
        assert.equal(agg.monBehind, 0);

        // Critical ponds: Pond 10201 has SR 55% (<60%) AND RED issue
        assert.equal(agg.totalCritical, 1);
        assert.equal(agg.vanCritical, 1);

        // Verify Dual-Species Bucket Properties (VAN vs MON, Benchmark, Farm Avg, Sampled Counts)
        const m01Bucket = agg.buckets.find(b => b.monthKey === "M01");
        const m02Bucket = agg.buckets.find(b => b.monthKey === "M02");
        assert.ok(m01Bucket);
        assert.equal(m01Bucket.isDualSpecies, true);
        assert.equal(m01Bucket.vanValue, 0.15);
        assert.equal(m01Bucket.monValue, 0);
        assert.equal(m01Bucket.pondCount, 2);
        assert.equal(m01Bucket.vanPondCount, 2);
        assert.equal(m01Bucket.monPondCount, 0);
        assert.equal(m01Bucket.benchmarkVal, 0.25);
        assert.equal(m01Bucket.farmAvgVal, 0.15);

        assert.ok(m02Bucket);
        assert.equal(m02Bucket.vanValue, 0);
        assert.equal(m02Bucket.monValue, 0.16);
        assert.equal(m02Bucket.pondCount, 1);
        assert.equal(m02Bucket.monPondCount, 1);
    });

    test("speciesFilter correctly narrows pool to VAN or MON only", () => {
        const vanAgg = ExecutiveMetricsPresenter.aggregateGrowthAndSurvival(
            mockPonds,
            mockSamplings,
            mockIssues,
            { speciesFilter: "VAN", chartMode: "ADG", viewPerspective: "MODULE" }
        );
        assert.equal(vanAgg.activePool.length, 2);
        assert.ok(vanAgg.activePool.every(p => p.speciesCode === "VAN"));

        const monAgg = ExecutiveMetricsPresenter.aggregateGrowthAndSurvival(
            mockPonds,
            mockSamplings,
            mockIssues,
            { speciesFilter: "MON", chartMode: "ADG", viewPerspective: "MODULE" }
        );
        assert.equal(monAgg.activePool.length, 1);
        assert.equal(monAgg.activePool[0].speciesCode, "MON");
    });

    test("getMetricDrillDownData for BIOSECURITY returns 10-column table and formatted badges", () => {
        const dataBundle = {
            activePonds: mockPonds,
            samplings: mockSamplings,
            issues: mockIssues
        };

        const vm = ExecutiveMetricsPresenter.getMetricDrillDownData(
            METRIC_TYPES.BIOSECURITY,
            dataBundle,
            "ALL",
            "",
            { growthSpecies: "ALL", growthChartMode: "ADG", growthViewPerspective: "MODULE" }
        );

        assert.equal(vm.title, "Shrimp Health, Growth & Survival");
        assert.equal(vm.icon, "🦐");
        assert.equal(vm.timelineTitle, "Average Daily Growth by Module (g/day)");

        assert.deepEqual(vm.tableHeaders, [
            "Pond Code",
            "Module",
            "Species",
            "DOC",
            "Current ABW",
            "Daily Growth",
            "Target ABW",
            "Growth %",
            "Survival Rate",
            "Health Status"
        ]);

        assert.equal(vm.tableRows.length, 3);
        // Row 1: 01.01.01 (On track)
        assert.equal(vm.tableRows[0][0], "01.01.01");
        assert.equal(vm.tableRows[0][2], "VAN");
        assert.equal(vm.tableRows[0][4], "12.0 g");
        assert.equal(vm.tableRows[0][5], "0.20 g/d");
        assert.equal(vm.tableRows[0][6], "10.2 g");
        assert.equal(vm.tableRows[0][7], "118%");
        assert.equal(vm.tableRows[0][8], "85.0%");
        assert.equal(vm.tableRows[0][9], "Normal / Negative");

        // Row 2: 01.02.01 (Behind target with Red Alert)
        assert.equal(vm.tableRows[1][0], "01.02.01");
        assert.equal(vm.tableRows[1][5], "0.10 g/d");
        assert.equal(vm.tableRows[1][7], "59%");
        assert.equal(vm.tableRows[1][8], "55.0%");
        assert.ok(vm.tableRows[1][9].includes("Red: EHP Stunting"));

        // Row 3: 02.01.01 (MON pond)
        assert.equal(vm.tableRows[2][0], "02.01.01");
        assert.equal(vm.tableRows[2][2], "MON");
        assert.equal(vm.tableRows[2][5], "0.16 g/d");
        assert.equal(vm.tableRows[2][6], "11.2 g"); // Monodon standard at 70d
        assert.equal(vm.tableRows[2][7], "103%");
        assert.equal(vm.tableRows[2][8], "78.0%");
    });

    test("calculateQuickGrowthSurvivalSummary formats main executive card display", () => {
        const samplingsMap = new Map();
        mockSamplings.forEach(s => samplingsMap.set(s.pond_index, s));
        const issuesMap = new Map();
        mockIssues.forEach(i => issuesMap.set(i.pond_index, [i]));

        const summary = ExecutiveMetricsPresenter.calculateQuickGrowthSurvivalSummary(
            mockPonds,
            samplingsMap,
            issuesMap
        );

        assert.equal(summary.adgDisplay, "0.15");
        assert.equal(summary.srDisplay, "72.7");
        assert.ok(summary.subText.includes("Red Alerts"));
    });

    test("docCohort strictly isolates MID_LATE (>=50d) vs LATE_ONLY (>70d)", () => {
        const cohortPonds = [
            { pondCode: "01.01.01", pondIndex: "101", speciesCode: "VAN", doc: 45, isActive: true, progressState: "CULTURE" }, // Nursery (<50d)
            { pondCode: "01.01.02", pondIndex: "102", speciesCode: "VAN", doc: 60, isActive: true, progressState: "CULTURE" }, // Mid (50-70d)
            { pondCode: "01.01.03", pondIndex: "103", speciesCode: "VAN", doc: 85, isActive: true, progressState: "CULTURE" }, // Late (>70d)
        ];
        const cohortSamplings = [
            { pond_index: "101", smpl_doc: 45, smpl_abw: 7.0, smpl_surv: 90.0 },
            { pond_index: "102", smpl_doc: 60, smpl_abw: 12.0, smpl_surv: 80.0 },
            { pond_index: "103", smpl_doc: 85, smpl_abw: 22.0, smpl_surv: 65.0 }
        ];

        // MID_LATE (Default) - Includes DOC >= 50, filters out early nursery bias (DOC 45)
        const midLateAgg = ExecutiveMetricsPresenter.aggregateGrowthAndSurvival(
            cohortPonds,
            cohortSamplings,
            [],
            { docCohort: "MID_LATE", viewPerspective: "MODULE" }
        );
        assert.equal(midLateAgg.minDocThreshold, 50);
        assert.equal(midLateAgg.activePool.length, 2); // 102 (DOC 60) and 103 (DOC 85)
        assert.ok(midLateAgg.activePool.every(p => p.doc >= 50));

        // LATE_ONLY - Includes only harvest candidates (DOC > 70)
        const lateOnlyAgg = ExecutiveMetricsPresenter.aggregateGrowthAndSurvival(
            cohortPonds,
            cohortSamplings,
            [],
            { docCohort: "LATE_ONLY", viewPerspective: "MODULE" }
        );
        assert.equal(lateOnlyAgg.minDocThreshold, 71);
        assert.equal(lateOnlyAgg.activePool.length, 1); // 103 only (DOC 85)
        assert.equal(lateOnlyAgg.activePool[0].pondCode, "01.01.03");
    });

    test("aggregateGrowthAndSurvival 12-Month Trend aggregates mature historical samplings with species separation", () => {
        const mockCycles12M = [
            { pond_index: "201.01", pond: "02.01.01", modl: "02", stck_species: "P. VANNAMEI" },
            { pond_index: "201.02", pond: "02.01.02", modl: "02", stck_species: "P. MONODON" }
        ];
        const mockSamplings12M = [
            // June 2026: VAN collapsed to 45% SR, MON at 75% SR
            { pond_index: "201.01", smpl_date: "2026-06-15", smpl_doc: 75, smpl_abw: 18.0, smpl_surv: 45.0 },
            { pond_index: "201.02", smpl_date: "2026-06-20", smpl_doc: 80, smpl_abw: 16.0, smpl_surv: 75.0 },
            // May 2026: VAN at 70% SR, MON at 80% SR
            { pond_index: "201.01", smpl_date: "2026-05-10", smpl_doc: 55, smpl_abw: 11.0, smpl_surv: 70.0 },
            { pond_index: "201.02", smpl_date: "2026-05-15", smpl_doc: 60, smpl_abw: 10.0, smpl_surv: 80.0 },
            // Early nursery sample (<50d) that must be excluded
            { pond_index: "201.01", smpl_date: "2026-06-01", smpl_doc: 30, smpl_abw: 3.5, smpl_surv: 95.0 }
        ];

        // 1. All Species
        const aggAll = ExecutiveMetricsPresenter.aggregateGrowthAndSurvival(
            [],
            [],
            [],
            {
                speciesFilter: "ALL",
                chartMode: "SR",
                viewPerspective: "MONTHLY",
                docCohort: "MID_LATE",
                samplings12M: mockSamplings12M,
                operationalCycles: mockCycles12M
            }
        );

        assert.equal(aggAll.totalSamplesCount, 4); // Excludes the 30d nursery sample
        const juneBucket = aggAll.buckets.find(b => b.monthKey === "2026-06");
        assert.ok(juneBucket);
        assert.equal(juneBucket.pondCount, 2);
        assert.equal(juneBucket.avgSr, 60.0); // (45 + 75) / 2
        assert.equal(juneBucket.value, 60.0);
        assert.equal(juneBucket.isDualSpecies, true);
        assert.equal(juneBucket.vanValue, 45.0);
        assert.equal(juneBucket.monValue, 75.0);
        assert.equal(juneBucket.benchmarkVal, 75);

        // 2. VAN Species Only
        const aggVan = ExecutiveMetricsPresenter.aggregateGrowthAndSurvival(
            [],
            [],
            [],
            {
                speciesFilter: "VAN",
                chartMode: "SR",
                viewPerspective: "MONTHLY",
                docCohort: "MID_LATE",
                samplings12M: mockSamplings12M,
                operationalCycles: mockCycles12M
            }
        );
        const juneVanBucket = aggVan.buckets.find(b => b.monthKey === "2026-06");
        assert.ok(juneVanBucket);
        assert.equal(juneVanBucket.pondCount, 1);
        assert.equal(juneVanBucket.avgSr, 45.0); // Exactly reflects VAN collapse!
        assert.equal(juneVanBucket.criticalCount, 1); // 45% < 60%

        // 3. DrillDown ViewModel for historical month
        const vmJune = ExecutiveMetricsPresenter.getMetricDrillDownData(
            METRIC_TYPES.BIOSECURITY,
            { samplings12M: mockSamplings12M, operationalCycles: mockCycles12M },
            "2026-06",
            "",
            { growthSpecies: "VAN", growthChartMode: "SR", growthViewPerspective: "MONTHLY", growthDocCohort: "MID_LATE" }
        );
        assert.equal(vmJune.tableRows.length, 1);
        assert.equal(vmJune.tableRows[0][0], "02.01.01");
        assert.equal(vmJune.tableRows[0][2], "VAN");
        assert.equal(vmJune.tableRows[0][3], "75d");
        assert.equal(vmJune.tableRows[0][8], "45.0%");
        assert.ok(vmJune.countDisplay.includes("Jun 2026"));
        assert.ok(vmJune.countDisplay.includes("45%"));
    });
});

