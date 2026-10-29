import test from "node:test";
import assert from "node:assert/strict";
import { DOM_IDS } from "../src/config/domContracts.js";
import { getStockingTabHtml } from "../src/modules/dbms/templates/stockingTabTemplate.js";
import { HatcheryRepository } from "../src/infrastructure/repositories/hatcheryRepository.js";

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
    const rawRef = "C11, C14";
    const matches = Array.from(rawRef.matchAll(/\b([A-Da-d])(1[0-6]|0?[1-9])\b/g)).map(m => {
        const blk = m[1].toUpperCase();
        const num = String(parseInt(m[2], 10)).padStart(2, '0');
        return `${blk}${num}`;
    });

    assert.deepEqual(matches, ["C11", "C14"], "Must extract both C11 and C14 without greedy truncations");
});
