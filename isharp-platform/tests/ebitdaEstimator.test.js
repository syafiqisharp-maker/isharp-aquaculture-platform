/**
 * Unit Tests for Pond EBITDA Estimator
 * File: tests/ebitdaEstimator.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
    normaliseSpecies,
    percentile,
    filterOutliers,
    getAbwBand,
    buildHistoricalFeatures,
    calculateUnitEconomics,
    estimateEbitda,
    ESTIMATOR_SPECIES
} from "../src/domain/ebitdaEstimator.js";

test("normaliseSpecies maps variants accurately", () => {
    assert.equal(normaliseSpecies("P. VANNAMEi"), ESTIMATOR_SPECIES.VANNAMEI);
    assert.equal(normaliseSpecies("L. vannamei"), ESTIMATOR_SPECIES.VANNAMEI);
    assert.equal(normaliseSpecies("vannamei"), ESTIMATOR_SPECIES.VANNAMEI);
    assert.equal(normaliseSpecies(null), ESTIMATOR_SPECIES.VANNAMEI);

    assert.equal(normaliseSpecies("P. MONODON"), ESTIMATOR_SPECIES.MONODON);
    assert.equal(normaliseSpecies("Monodon"), ESTIMATOR_SPECIES.MONODON);
    assert.equal(normaliseSpecies("Black Tiger"), ESTIMATOR_SPECIES.MONODON);
});

test("percentile calculates accurate values", () => {
    const data = [10, 20, 30, 40, 50];
    assert.equal(percentile(data, 0), 10);
    assert.equal(percentile(data, 50), 30);
    assert.equal(percentile(data, 100), 50);
    assert.equal(percentile(data, 25), 20);
    assert.equal(percentile(data, 75), 40);

    // Edge cases
    assert.equal(percentile([], 50), 0);
    assert.equal(percentile([42], 50), 42);
});

test("filterOutliers filters out extreme or trivial records", () => {
    const raw = [
        { totalHarvestKg: 50, doc: 80, revenuePerKg: 20, costPerKg: 15 }, // harvest too low
        { totalHarvestKg: 3500, doc: 10, revenuePerKg: 20, costPerKg: 15 }, // doc too low
        { totalHarvestKg: 3500, doc: 90, revenuePerKg: 5, costPerKg: 15 }, // rev/kg too low
        { totalHarvestKg: 3500, doc: 90, revenuePerKg: 22, costPerKg: 14 } // valid
    ];
    const filtered = filterOutliers(raw);
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].totalHarvestKg, 3500);
});

test("getAbwBand assigns correct category", () => {
    const vBand = getAbwBand("VANNAMEI", 14.2);
    assert.equal(vBand.key, "V_MED_LOW");

    const mBand = getAbwBand("MONODON", 32.5);
    assert.equal(mBand.key, "M_LARGE");
});

test("buildHistoricalFeatures correctly aggregates finance and operational datasets", () => {
    const financeRecords = [{
        pond_index: "P1",
        revenue: 80000,
        cons_of_feed: 28000,
        cons_of_fries: 8000,
        cons_of_chem_fert: 1800,
        cons_of_supplies: 900,
        harvest_expenses: 1500,
        electricity: 8500,
        wages_direct: 3200,
        wages_indirect: 2000,
        repair_maintenance: 1500,
        total_cost: 60000,
        ebitda: 25000,
        cost_per_kg: 15.0,
        cash_cost_per_kg: 13.5,
        revenue_per_kg: 20.0
    }];

    const harvestMap = new Map();
    harvestMap.set("P1", {
        totalHarvestKg: 4000,
        weightedAbwSum: 4000 * 16.5,
        lastHarvestDate: "2026-06-15"
    });

    const stockMap = new Map();
    stockMap.set("P1", {
        stck_species: "P. VANNAMEi",
        stck_date: "2026-03-15",
        stck_pcs: 400000
    });

    const feedMap = new Map();
    feedMap.set("P1", 5600);

    const features = buildHistoricalFeatures({
        financeRecords,
        harvestMap,
        stockMap,
        feedMap
    });

    assert.equal(features.length, 1);
    const f = features[0];
    assert.equal(f.species, "VANNAMEI");
    assert.equal(f.totalHarvestKg, 4000);
    assert.equal(f.abw, 16.5);
    assert.equal(f.doc, 92);
    assert.equal(f.feedCostPerKgFeed, 5.0); // 28000 / 5600
    assert.equal(f.fryCostPerPl, 0.02); // 8000 / 400000
    assert.equal(f.fryCostPerKg, 2.0); // 8000 / 4000
});

test("calculateUnitEconomics provides valid distributions and fallbacks", () => {
    const syntheticCycles = [
        { species: "VANNAMEI", abw: 16.0, revenuePerKg: 19.5, feedCostPerKgFeed: 5.7, fryCostPerPl: 0.021, fryCostPerKg: 2.5, variableCostPerKg: 1.2, dailyFixedCostPerDay: 220 },
        { species: "VANNAMEI", abw: 16.5, revenuePerKg: 20.0, feedCostPerKgFeed: 5.8, fryCostPerPl: 0.022, fryCostPerKg: 2.6, variableCostPerKg: 1.3, dailyFixedCostPerDay: 230 },
        { species: "VANNAMEI", abw: 17.0, revenuePerKg: 21.0, feedCostPerKgFeed: 6.0, fryCostPerPl: 0.023, fryCostPerKg: 2.7, variableCostPerKg: 1.4, dailyFixedCostPerDay: 240 }
    ];

    const eco = calculateUnitEconomics(syntheticCycles, "VANNAMEI", 16.5);
    assert.equal(eco.species, "VANNAMEI");
    assert.equal(eco.cycleCount, 3);
    assert.ok(eco.drivers.pricePerKg.p50 >= 19.5 && eco.drivers.pricePerKg.p50 <= 21.0);
    assert.ok(eco.drivers.pricePerKg.p25 <= eco.drivers.pricePerKg.p50);
    assert.ok(eco.drivers.pricePerKg.p50 <= eco.drivers.pricePerKg.p75);
});

test("estimateEbitda executes conservative <= base <= optimistic invariant", () => {
    const inputs = {
        species: "VANNAMEI",
        doc: 90,
        tonnage: 3.5, // 3500 kg
        totalFeed: 5250, // FCR 1.50
        abw: 16.5,
        stockedPl: 400000
    };

    const result = estimateEbitda(inputs);
    assert.equal(result.inputs.tonnageKg, 3500);
    assert.equal(result.inputs.fcr, 1.50);

    const { low, base, high } = result.scenarios;

    // EBITDA invariant: Low (conservative) <= Base <= High (optimistic)
    assert.ok(low.ebitda <= base.ebitda, `Low EBITDA (${low.ebitda}) must be <= Base (${base.ebitda})`);
    assert.ok(base.ebitda <= high.ebitda, `Base EBITDA (${base.ebitda}) must be <= High (${high.ebitda})`);

    // Revenue invariant: Low <= Base <= High
    assert.ok(low.revenue <= base.revenue);
    assert.ok(base.revenue <= high.revenue);

    // Cost invariant: High scenario has lower unit costs than Low scenario
    assert.ok(high.totalCashCost <= low.totalCashCost);

    // Check optional PL fallback when stockedPl is omitted
    const noPlInputs = {
        species: "VANNAMEI",
        doc: 90,
        tonnage: 3.5,
        totalFeed: 5250,
        abw: 16.5
    };
    const noPlResult = estimateEbitda(noPlInputs);
    assert.ok(noPlResult.scenarios.base.fryCost > 0);
    assert.equal(noPlResult.drivers.fryCostUnit, "RM/kg harvested");
});

test("estimateEbitda flags diagnostic warnings for abnormal inputs", () => {
    const strangeInputs = {
        species: "VANNAMEI",
        doc: 45, // very short DOC
        tonnage: 8.0, // huge tonnage
        totalFeed: 3000, // FCR = 3000/8000 = 0.375 (abnormal)
        abw: 12.0
    };

    const res = estimateEbitda(strangeInputs);
    assert.ok(res.metadata.warnings.length >= 1);
    assert.ok(res.metadata.warnings.some(w => w.includes("FCR")));
});

test("estimateEbitda supports expected harvest weight in kilograms (kg)", () => {
    const inputsKg = {
        species: "VANNAMEI",
        doc: 90,
        harvestKg: 3500, // in kg directly
        totalFeed: 5250,
        abw: 16.5
    };

    const res = estimateEbitda(inputsKg);
    assert.equal(res.inputs.tonnageKg, 3500);
    assert.equal(res.inputs.tonnageMt, 3.5);
    assert.equal(res.inputs.harvestKg, 3500);
    assert.equal(res.inputs.fcr, 1.50);
});
