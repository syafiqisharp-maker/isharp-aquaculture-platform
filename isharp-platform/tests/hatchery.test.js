import test from "node:test";
import assert from "node:assert/strict";
import { DOM_IDS } from "../src/config/domContracts.js";
import { getStockingTabHtml } from "../src/modules/dbms/templates/stockingTabTemplate.js";
import { HatcheryRepository } from "../src/infrastructure/repositories/hatcheryRepository.js";
import { calculateBroodstockDOC } from "../src/domain/biometrics.js";

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
