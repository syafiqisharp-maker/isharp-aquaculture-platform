/**
 * iSHARP DBMS 2.0 — Phase 4 Simulation Store & Repository Automated Test Suite
 * Runs via Node.js native test runner: `node --test tests/simulationStore.test.js`
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Mock localStorage for Node.js test runner if window is not defined
if (typeof globalThis.localStorage === "undefined") {
    const memoryStorage = new Map();
    globalThis.localStorage = {
        getItem: (k) => (memoryStorage.has(k) ? memoryStorage.get(k) : null),
        setItem: (k, v) => memoryStorage.set(k, String(v)),
        removeItem: (k) => memoryStorage.delete(k),
        clear: () => memoryStorage.clear()
    };
}

import { SimulationRepository } from "../src/infrastructure/repositories/simulationRepository.js";
import { simulationStore } from "../src/state/simulationStore.js";
import { SPECIES } from "../src/domain/simulation/baselineCalibrator.js";

describe("Phase 4 SimulationRepository — LocalStorage Scenario Persistence", () => {
    beforeEach(() => {
        globalThis.localStorage.clear();
    });

    it("saves, lists, retrieves, and deletes scenarios in localStorage", () => {
        const scenario = {
            name: "Baseline Monodon Strategy 2026",
            description: "Prioritizing M08/M09 with CP THAI",
            scheduledCycles: [
                { pondId: "M08-P01", species: SPECIES.MONODON, startWeekIndex: 1 }
            ],
            shocks: []
        };

        const saved = SimulationRepository.saveScenario(scenario);
        assert.ok(saved.id);
        assert.equal(saved.name, "Baseline Monodon Strategy 2026");

        const list = SimulationRepository.listScenarios();
        assert.equal(list.length, 1);
        assert.equal(list[0].id, saved.id);
        assert.equal(list[0].cycleCount, 1);

        const loaded = SimulationRepository.getScenario(saved.id);
        assert.ok(loaded);
        assert.equal(loaded.name, "Baseline Monodon Strategy 2026");
        assert.equal(loaded.scheduledCycles.length, 1);

        const deleted = SimulationRepository.deleteScenario(saved.id);
        assert.equal(deleted, true);
        assert.equal(SimulationRepository.listScenarios().length, 0);
    });

    it("exports and imports scenario JSON format", () => {
        const saved = SimulationRepository.saveScenario({
            name: "Exportable Plan",
            scheduledCycles: [{ pondId: "M04-P01", species: SPECIES.VANNAMEI, startWeekIndex: 2 }]
        });

        const jsonStr = SimulationRepository.exportScenarioJson(saved.id);
        assert.ok(jsonStr);
        assert.ok(jsonStr.includes("Exportable Plan"));

        const imported = SimulationRepository.importScenarioJson(jsonStr);
        assert.ok(imported.id);
        assert.notEqual(imported.id, saved.id); // New ID generated
        assert.equal(imported.name, "Exportable Plan");
        assert.equal(SimulationRepository.listScenarios().length, 2);
    });
});

describe("Phase 4 SimulationStore — Reactive State, Actions & Debounced Simulation", () => {
    beforeEach(() => {
        globalThis.localStorage.clear();
    });

    it("subscribes and emits events reliably with unsubscribe cleanup", () => {
        let callCount = 0;
        let lastData = null;

        const unsubscribe = simulationStore.subscribe("customTestEvent", (data) => {
            callCount += 1;
            lastData = data;
        });

        simulationStore.emit("customTestEvent", { message: "ping" });
        assert.equal(callCount, 1);
        assert.deepEqual(lastData, { message: "ping" });

        unsubscribe();
        simulationStore.emit("customTestEvent", { message: "pong" });
        assert.equal(callCount, 1); // Unsubscribed, no extra increment
    });

    it("manages scheduled cycles, triggers simulation and runs on-demand Monte Carlo", async () => {
        // Manually seed master ponds and scheduled cycles to test state mutations
        simulationStore._state.masterPonds = [
            { pondId: "M04-P01", moduleId: "04", areaHa: 0.5 },
            { pondId: "M08-P01", moduleId: "08", areaHa: 0.5 }
        ];

        simulationStore._state.scheduledCycles = [
            {
                pondId: "M04-P01",
                moduleId: "04",
                areaHa: 0.5,
                species: SPECIES.VANNAMEI,
                strategyCode: "DS2",
                stockDensityPlM2: 112,
                startWeekIndex: 1,
                endWeekIndex: 15,
                targetFinalDoc: 98,
                stockMonth: 4,
                dopDays: 45
            },
            {
                pondId: "M08-P01",
                moduleId: "08",
                areaHa: 0.5,
                species: SPECIES.MONODON,
                strategyCode: "DS4",
                stockDensityPlM2: 48,
                startWeekIndex: 1,
                endWeekIndex: 17,
                targetFinalDoc: 112,
                stockMonth: 4,
                dopDays: 45
            }
        ];

        // 1. Run immediate simulation
        const simRes = simulationStore.runSimulationImmediate();
        assert.ok(simRes);
        assert.equal(simRes.weeklyTimeline.length, 156);
        assert.equal(simulationStore.simulationResult, simRes);
        assert.ok(simulationStore.status.lastSimulationDurationMs >= 0);

        // 2. Update cycle and verify debounced simulation trigger
        simulationStore.updateCycle("M04-P01", 0, { stockDensityPlM2: 115 });
        assert.equal(simulationStore.scheduledCycles[0].stockDensityPlM2, 115);
        const baselineRes = simulationStore.runSimulationImmediate();

        // 3. Test War Room shock injection
        const initialCashCost = baselineRes.grandTotals.totalFarm.cashCostRM;
        simulationStore.injectShock({
            id: "test_energy_tariff_hike",
            startWeek: 1,
            durationWeeks: 52,
            targetScope: { type: "FARM_WIDE" },
            impactModifiers: { electricityTariffMultiplier: 1.40 }
        });

        // Run immediate simulation to evaluate injected shock
        const shockedRes = simulationStore.runSimulationImmediate();
        assert.ok(shockedRes.grandTotals.totalFarm.cashCostRM > initialCashCost);

        // Remove shock
        simulationStore.removeShock("test_energy_tariff_hike");
        const unshockedRes = simulationStore.runSimulationImmediate();
        assert.equal(unshockedRes.grandTotals.totalFarm.cashCostRM, initialCashCost);

        // 4. Test on-demand Monte Carlo risk run
        const mc = simulationStore.runMonteCarlo(25, { targetYieldMt: 5, targetEbitdaRM: 10000 });
        assert.ok(mc);
        assert.equal(mc.iterations, 25);
        assert.ok(mc.quantiles.P10_Downside);
        assert.ok(mc.quantiles.P50_Median);
        assert.ok(mc.quantiles.P90_Upside);
        assert.equal(simulationStore.monteCarloResult, mc);

        // 5. Test saving and loading current scenario in localStorage
        const savedHeader = simulationStore.saveCurrentScenario("My Custom War Room Test", "Testing energy shock");
        assert.ok(savedHeader.id);

        // Modify scheduledCycles in memory
        simulationStore.removeCycle("M08-P01", 0);
        assert.equal(simulationStore.scheduledCycles.length, 1);

        // Reload saved scenario
        const loaded = simulationStore.loadScenario(savedHeader.id);
        assert.equal(loaded, true);
        assert.equal(simulationStore.scheduledCycles.length, 2);
    });
});
