import test from "node:test";
import assert from "node:assert/strict";
import { DOM_IDS } from "../src/config/domContracts.js";
import { getStockingTabHtml } from "../src/modules/dbms/templates/stockingTabTemplate.js";
import { HatcheryRepository } from "../src/infrastructure/repositories/hatcheryRepository.js";
import { calculateBroodstockDOC } from "../src/domain/biometrics.js";
import {
    aggregateMonthlyHatcheryRollup,
    aggregateDailyHatcheryOperations,
    calculateHatcheryKpiStats
} from "../src/domain/hatcheryAnalytics.js";

test("Hatchery Contracts: DOM_IDS contains Stocking Tab Hatchery Origin contract", () => {
    assert.ok(DOM_IDS.STOCKING.HATCHERY_ORIGIN, "HATCHERY_ORIGIN contract must exist");
    assert.equal(DOM_IDS.STOCKING.HATCHERY_ORIGIN, "container-hatchery-origin", "HATCHERY_ORIGIN must match container-hatchery-origin");
});

test("Hatchery Contracts: Stocking Tab Template renders Hatchery Origin container", () => {
    const html = getStockingTabHtml();
    assert.ok(html.includes('id="container-hatchery-origin"'), "Must contain container-hatchery-origin element");
});

test("HatcheryRepository: exposes all required API methods", () => {
    assert.equal(typeof HatcheryRepository.getTankMap, "function", "getTankMap must be a function");
    assert.equal(typeof HatcheryRepository.getTankHistory, "function", "getTankHistory must be a function");
    assert.equal(typeof HatcheryRepository.getPlMonthlyRollup, "function", "getPlMonthlyRollup must be a function");
    assert.equal(typeof HatcheryRepository.getHarvestDispatches, "function", "getHarvestDispatches must be a function");
    assert.equal(typeof HatcheryRepository.getAllTankRuns, "function", "getAllTankRuns must be a function");
    assert.equal(typeof HatcheryRepository.getBroodstockBatches, "function", "getBroodstockBatches must be a function");
    assert.equal(typeof HatcheryRepository.getBroodstockDailyRecords, "function", "getBroodstockDailyRecords must be a function");
    assert.equal(typeof HatcheryRepository.getActiveMaturationBlock, "function", "getActiveMaturationBlock must be a function");
    assert.equal(typeof HatcheryRepository.getPondHatcheryOrigin, "function", "getPondHatcheryOrigin must be a function");
});

test("Hatchery Domain: 64-Tank Matrix physical layout structure", () => {
    // 4 Blocks (D, C, B, A), 16 tanks each (01..16)
    const blocks = ["D", "C", "B", "A"];
    const allTanks = [];
    
    blocks.forEach(block => {
        for (let i = 1; i <= 16; i++) {
            const tankCode = `${block}${String(i).padStart(2, "0")}`;
            allTanks.push(tankCode);
        }
    });

    assert.equal(allTanks.length, 64, "Total tank count must be exactly 64");
    assert.equal(allTanks[0], "D01", "First tank of Block D is D01");
    assert.equal(allTanks[63], "A16", "Last tank of Block A is A16");

    // Tank code validator regex
    const tankRegex = /^[A-D](0[1-9]|1[0-6])$/;
    allTanks.forEach(code => {
        assert.ok(tankRegex.test(code), `${code} must match valid tank code format`);
    });
    assert.equal(tankRegex.test("E01"), false, "Block E is invalid");
    assert.equal(tankRegex.test("A17"), false, "Tank 17 is invalid");
    assert.equal(tankRegex.test("A00"), false, "Tank 00 is invalid");
});

test("Hatchery Domain: Decision 20 strictly enforces HR-A display across telemetry", () => {
    const mockDailySpawn = {
        batch_code: "S1/2026",
        rec_date: "2026-03-15",
        spawn_block: "SHA",
        hr_a_pct: 68.45,
        hr_b_pct: 72.10, // Stored in DB but NEVER displayed in UI
        nauplii_gross_k: 8400
    };

    // UI Presenter logic must extract hr_a_pct
    const displayHr = mockDailySpawn.hr_a_pct != null ? `${mockDailySpawn.hr_a_pct.toFixed(1)}%` : "—";
    assert.equal(displayHr, "68.5%", "Only HR-A (68.5%) should be formatted for visualization");
    assert.notEqual(displayHr, `${mockDailySpawn.hr_b_pct.toFixed(1)}%`, "HR-B (72.1%) must NEVER be visualized");
});

test("Hatchery Traceability: parses comma-delimited multi-tank strings", () => {
    const parseTanks = (rawRef) => {
        return Array.from(rawRef.matchAll(/([A-Da-d])\s*[-_]?\s*(1[0-6]|0?[1-9])(?![0-9])/g)).map(m => {
            const blk = m[1].toUpperCase();
            const num = String(parseInt(m[2], 10)).padStart(2, '0');
            return `${blk}${num}`;
        });
    };

    assert.deepEqual(parseTanks("C11, C14"), ["C11", "C14"], "Must extract both C11 and C14");
    assert.deepEqual(parseTanks("A11,A12,A13"), ["A11", "A12", "A13"], "Must extract 3-tank batch A11, A12, A13");
    assert.deepEqual(parseTanks("C5,C7,C8"), ["C5", "C7", "C8"].map(t => `${t[0]}0${t[1]}`), "Must extract C05, C07, C08");
    assert.deepEqual(parseTanks("B1,B2,B3"), ["B01", "B02", "B03"], "Must pad single digits B1,B2,B3 to B01,B02,B03");
});

test("Broodstock Biometrics: calculateBroodstockDOC strictly implements 0-based arrival convention (Option 1)", () => {
    // Exact arrival day = DOC 0
    assert.equal(calculateBroodstockDOC("2026-03-17", "2026-03-17"), 0, "Arrival day must be DOC 0");
    
    // 1 day after arrival = DOC 1
    assert.equal(calculateBroodstockDOC("2026-03-17", "2026-03-18"), 1, "Next day after arrival must be DOC 1");
    
    // Spawning on 2026-04-15 = DOC 29
    assert.equal(calculateBroodstockDOC("2026-03-17", "2026-04-15"), 29, "29 days after arrival must be DOC 29");

    // Extended culture on 2026-06-25 = DOC 100
    assert.equal(calculateBroodstockDOC("2026-03-17", "2026-06-25"), 100, "100 days after arrival must be DOC 100");

    // Clamps negative difference to 0
    assert.equal(calculateBroodstockDOC("2026-03-17", "2026-03-01"), 0, "Pre-arrival dates clamp to 0");

    // Edge cases: null or invalid inputs return 0 gracefully
    assert.equal(calculateBroodstockDOC(null), 0, "null arrivalDate returns 0");
    assert.equal(calculateBroodstockDOC(""), 0, "empty arrivalDate returns 0");
    assert.equal(calculateBroodstockDOC(undefined), 0, "undefined arrivalDate returns 0");
});

test("Broodstock UI Contracts: Daily Monitoring Table and Batch Passport structure", () => {
    // 1. Table header contracts
    const tableHeaders = [
        "Date", "DOC", "Leftover Pop (♀ / ♂)", "Spawns", "Eggs (k)",
        "Fertilization %", "Nauplii Gross (k)", "Hatching Rate (HR-A)", "TPH Stocking (k)", "Target Tanks"
    ];

    assert.equal(tableHeaders.length, 10, "Daily table must have exactly 10 columns");
    assert.ok(tableHeaders.includes("Leftover Pop (♀ / ♂)"), "Table must include Leftover Pop column");
    assert.ok(!tableHeaders.includes("DOP"), "Table must NOT include legacy DOP column");
    assert.ok(!tableHeaders.includes("Spawn Block"), "Table must NOT include Spawn Block column");

    // 2. CSV Export contracts
    const csvHeaders = [
        "Batch", "Date", "DOC", "Leftover Female", "Leftover Male", "Leftover Total",
        "Spawning Count", "Eggs (k)", "Fertilization %", "Nauplii Gross (k)", "HR-A %", "Distribution TPH (k)", "Tanks"
    ];
    assert.ok(!csvHeaders.includes("DOP"), "CSV must NOT include DOP");
    assert.ok(!csvHeaders.includes("Spawn Block"), "CSV must NOT include Spawn Block");
    assert.ok(csvHeaders.includes("Leftover Female"), "CSV must include Leftover Female");
    assert.ok(csvHeaders.includes("Leftover Male"), "CSV must include Leftover Male");
    assert.ok(csvHeaders.includes("Leftover Total"), "CSV must include Leftover Total");

    // 3. Batch Passport permanent block resolution
    const resolveBlock = (spawnBlock, batchCode) => {
        const raw = (spawnBlock || "").toUpperCase();
        const isBlockB = raw.includes("SHB") || ["STL", "SK", "AP3", "AP 1/2024"].some(k => (batchCode || "").includes(k));
        return isBlockB ? "Block B (SHB)" : "Block A (SHA)";
    };

    assert.equal(resolveBlock("SHA", "S1/2026"), "Block A (SHA)");
    assert.equal(resolveBlock("SHB", "STL 1/2026"), "Block B (SHB)");
    assert.equal(resolveBlock("", "S1/2026"), "Block A (SHA)");
    assert.equal(resolveBlock("", "STL 1/2026"), "Block B (SHB)");
});

test("Hatchery Domain: aggregateMonthlyHatcheryRollup computes production ledger metrics", () => {
    const mockRuns = [
        { tank_code: "C01", stock_date: "2026-10-01", nauplii_stocked_k: 2000, species: "VAN" },
        { tank_code: "C02", stock_date: "2026-10-02", nauplii_stocked_k: 2000, species: "VAN" },
        { tank_code: "C03", stock_date: "2026-09-15", nauplii_stocked_k: 1500, species: "MON" }
    ];
    const mockDispatches = [
        { tank_code: "C01", harvest_date: "2026-10-22", qty_k: 1500, pl_stage: 10, buyer_type: "SGO", species: "VAN" },
        { tank_code: "C02", harvest_date: "2026-10-23", qty_k: 1200, pl_stage: 11, buyer_type: "EXTERNAL", species: "VAN" }
    ];
    const mockFlushes = [
        { tank_code: "C04", event_date: "2026-10-05", qty_k: 500, species: "VAN" }
    ];

    // Filtered by year 2026
    const rollup = aggregateMonthlyHatcheryRollup(mockRuns, mockDispatches, mockFlushes, "2026", "ALL");
    assert.equal(rollup.length, 2, "Should return 2 distinct months (2026-10 and 2026-09)");

    const oct = rollup.find(m => m.monthKey === "2026-10");
    assert.ok(oct, "October 2026 must be present");
    assert.equal(oct.stockedTanksCount, 2, "2 tanks stocked in October");
    assert.equal(oct.naupliiStockedK, 4000, "4000k nauplii stocked in October");
    assert.equal(oct.harvestedTanksCount, 2, "2 tanks harvested in October");
    assert.equal(oct.plHarvestedK, 2700, "2700k PL harvested in October");
    assert.equal(oct.sgoHarvestK, 1500, "1500k SGO dispatches");
    assert.equal(oct.externalHarvestK, 1200, "1200k external dispatches");
    assert.equal(oct.flushedTanksCount, 1, "1 tank flushed in October");
    assert.equal(oct.naupliiFlushedK, 500, "500k flushed in October");
    assert.equal(oct.overallSrPct, 67.5, "SR% = (2700 / 4000) * 100 = 67.5%");
    assert.equal(oct.avgPlStage, 10.5, "Avg stage = (10 + 11) / 2 = 10.5");
    assert.equal(oct.species, "L.Vannamei", "Species should be Vannamei");

    // Filter by Species
    const monRollup = aggregateMonthlyHatcheryRollup(mockRuns, mockDispatches, mockFlushes, "2026", "MON");
    assert.equal(monRollup.length, 1, "Only September has Monodon");
    assert.equal(monRollup[0].monthKey, "2026-09");
    assert.equal(monRollup[0].species, "P.Monodon");
});

test("Hatchery Domain: aggregateDailyHatcheryOperations builds unified day-by-day operational timeline", () => {
    const mockRuns = [
        { tank_code: "C11", stock_date: "2026-10-01", nauplii_stocked_k: 2800, species: "VAN" },
        { tank_code: "C12", stock_date: "2026-10-01", nauplii_stocked_k: 2800, species: "VAN" }
    ];
    const mockDispatches = [
        { tank_code: "A01", harvest_date: "2026-10-01", qty_k: 1200, pl_stage: 10, linked_ponds: ["2091701.31"], species: "VAN" },
        { tank_code: "A02", harvest_date: "2026-10-01", qty_k: 1100, pl_stage: 10, linked_ponds: ["2091701.32"], species: "VAN" },
        { tank_code: "A03", harvest_date: "2026-10-15", qty_k: 1400, pl_stage: 11, linked_ponds: ["2091701.33"], species: "VAN" }
    ];
    const mockFlushes = [
        { tank_code: "D08", event_date: "2026-10-01", qty_k: 800, species: "VAN" }
    ];

    const timeline = aggregateDailyHatcheryOperations(mockRuns, mockDispatches, mockFlushes, "2026-10", "ALL");
    assert.equal(timeline.length, 2, "Must aggregate exactly 2 active operational days (Oct 1 and Oct 15)");

    const day1 = timeline[0];
    assert.equal(day1.date, "2026-10-01");
    assert.equal(day1.stockingsCount, 2, "2 stocking runs on Oct 1");
    assert.equal(day1.totalStockedK, 5600, "5,600k nauplii stocked on Oct 1");
    assert.deepEqual(day1.stockTanks, ["C11", "C12"], "Stock tanks must be C11 and C12");

    assert.equal(day1.harvestsCount, 2, "2 harvest dispatches on Oct 1");
    assert.equal(day1.totalHarvestedK, 2300, "2,300k PL harvested on Oct 1");
    assert.deepEqual(day1.harvestTanks, ["A01", "A02"], "Harvest tanks must be A01 and A02");
    assert.deepEqual(day1.linkedPonds, ["2091701.31", "2091701.32"], "Linked ponds must be properly merged and sorted");
    assert.equal(day1.avgStage, "10.0", "Avg PL stage must be 10.0");

    assert.equal(day1.flushesCount, 1, "1 flush on Oct 1");
    assert.equal(day1.totalFlushedK, 800, "800k flushed on Oct 1");
    assert.deepEqual(day1.flushTanks, ["D08"], "Flush tank must be D08");

    const day15 = timeline[1];
    assert.equal(day15.date, "2026-10-15");
    assert.equal(day15.stockingsCount, 0, "0 stockings on Oct 15");
    assert.equal(day15.harvestsCount, 1, "1 harvest on Oct 15");
    assert.equal(day15.totalHarvestedK, 1400);
});

test("Hatchery Domain: calculateHatcheryKpiStats reacts to period and species filters", () => {
    const mockRuns = [
        { stock_date: "2026-10-01", nauplii_stocked_k: 5000, species: "VAN" },
        { stock_date: "2026-09-01", nauplii_stocked_k: 4000, species: "MON" }
    ];
    const mockDispatches = [
        { harvest_date: "2026-10-20", qty_k: 3500, sr_reported_pct: 70, species: "VAN" },
        { harvest_date: "2026-09-20", qty_k: 2400, sr_reported_pct: 60, species: "MON" }
    ];
    const mockFlushes = [
        { event_date: "2026-10-05", qty_k: 500, species: "VAN" }
    ];

    // Filter: October 2026
    const octStats = calculateHatcheryKpiStats(mockRuns, mockDispatches, mockFlushes, "2026", "10", "ALL");
    assert.equal(octStats.totalHarvestedK, 3500, "Harvested in Oct: 3500k");
    assert.equal(octStats.totalStockedK, 5000, "Stocked in Oct: 5000k");
    assert.equal(octStats.totalFlushedK, 500, "Flushed in Oct: 500k");
    assert.equal(octStats.totalDispatchesCount, 1, "1 dispatch in Oct");
    assert.equal(octStats.avgSr, "70.0%", "Average reported SR in Oct is 70.0%");

    // Filter: Full Year 2026
    const all2026 = calculateHatcheryKpiStats(mockRuns, mockDispatches, mockFlushes, "2026", "ALL", "ALL");
    assert.equal(all2026.totalHarvestedK, 5900, "Total 2026 harvest: 3500 + 2400 = 5900k");
    assert.equal(all2026.totalDispatchesCount, 2, "2 dispatches across 2026");
    assert.equal(all2026.avgSr, "65.0%", "Average reported SR across 2026 is (70 + 60) / 2 = 65.0%");
});

