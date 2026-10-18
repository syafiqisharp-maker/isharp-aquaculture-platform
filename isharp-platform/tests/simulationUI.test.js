/**
 * iSHARP DBMS 2.0 — Phase 5 Simulation UI Automated Test Suite
 * Tests UI Components, Gantt Planner Grid, Weekly/Monthly MRP Matrix,
 * BOD Spliced P&L Report, KPI Summary Cards, and Modals.
 * Runs via Node.js native test runner: `node --test tests/simulationUI.test.js`
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Mock localStorage and minimal DOM for Node.js test environment
if (typeof globalThis.localStorage === "undefined") {
    const memoryStorage = new Map();
    globalThis.localStorage = {
        getItem: (k) => (memoryStorage.has(k) ? memoryStorage.get(k) : null),
        setItem: (k, v) => memoryStorage.set(k, String(v)),
        removeItem: (k) => memoryStorage.delete(k),
        clear: () => memoryStorage.clear()
    };
}

// Minimal DOM mock
class MockElement {
    constructor(id = "") {
        this.id = id;
        this.innerHTML = "";
        this.style = {};
        this.attributes = new Map();
        this.classList = {
            _classes: new Set(),
            add(c) { this._classes.add(c); },
            remove(c) { this._classes.delete(c); },
            contains(c) { return this._classes.has(c); }
        };
        this.listeners = new Map();
    }

    getAttribute(k) { return this.attributes.get(k) ?? null; }
    setAttribute(k, v) { this.attributes.set(k, String(v)); }
    hasAttribute(k) { return this.attributes.has(k); }
    removeAttribute(k) { this.attributes.delete(k); }
    closest(sel) { return null; }

    addEventListener(event, fn) {
        if (!this.listeners.has(event)) this.listeners.set(event, []);
        this.listeners.get(event).push(fn);
    }

    querySelector(sel) {
        return new MockElement(sel);
    }

    querySelectorAll(sel) {
        return [new MockElement(sel)];
    }

    appendChild(child) {
        return child;
    }
}

if (typeof globalThis.document === "undefined") {
    const elements = new Map();
    globalThis.document = {
        getElementById: (id) => {
            if (!elements.has(id)) elements.set(id, new MockElement(id));
            return elements.get(id);
        },
        createElement: (tag) => new MockElement(tag),
        querySelector: (sel) => new MockElement(sel),
        querySelectorAll: (sel) => [new MockElement(sel)],
        body: new MockElement("body"),
        addEventListener: () => {}
    };
}

if (typeof globalThis.window === "undefined") {
    globalThis.window = {
        addEventListener: () => {},
        location: { hash: "" },
        innerWidth: 1920,
        innerHeight: 1080
    };
}

import { simulationStore } from "../src/state/simulationStore.js";
import { SimulationSummaryCards } from "../src/modules/simulation/SimulationSummaryCards.js";
import { DisruptionTimelineRibbon } from "../src/modules/simulation/DisruptionTimelineRibbon.js";
import { ModulePlannerGrid } from "../src/modules/simulation/ModulePlannerGrid.js";
import { WeeklyRollingTable } from "../src/modules/simulation/WeeklyRollingTable.js";
import { BODSummaryTable } from "../src/modules/simulation/BODSummaryTable.js";
import { StockingThemesTab } from "../src/modules/simulation/StockingThemesTab.js";
import { MonthlyProductionTab } from "../src/modules/simulation/MonthlyProductionTab.js";
import { PondCycleModal } from "../src/modules/simulation/modals/PondCycleModal.js";
import { ShockModal } from "../src/modules/simulation/modals/ShockModal.js";
import { ScenarioModal } from "../src/modules/simulation/modals/ScenarioModal.js";
import { SPECIES } from "../src/domain/simulation/baselineCalibrator.js";

describe("Phase 5 Simulation UI — Executive KPI Summary Cards", () => {
    it("renders empty state placeholder gracefully when result is null", () => {
        const cards = new SimulationSummaryCards("sim-kpi-strip-container");
        cards.render(null);
        const container = document.getElementById("sim-kpi-strip-container");
        assert.ok(container.innerHTML.includes("Ready"));
        assert.ok(container.innerHTML.includes("Awaiting schedule execution"));
    });

    it("renders formatted harvest volume, price, cash cost, and EBITDA with Monte Carlo pill", () => {
        const cards = new SimulationSummaryCards("sim-kpi-strip-container");
        const mockResult = {
            executiveKpis: {
                totalHarvestMt: 2450.5,
                averageHarvestAbwG: 21.4,
                averageRealizedPriceRmKg: 24.80,
                averageCashCostRmKg: 16.90,
                averageTotalCostRmKg: 19.40,
                farmEbitdaRm: 18500000,
                totalPondsCultured: 180,
                totalActivePondDays: 16500
            }
        };

        const mockMc = {
            summary: {
                ebitdaP10RM: 14200000,
                ebitdaP50RM: 18100000,
                ebitdaP90RM: 22800000
            }
        };

        cards.render(mockResult, mockMc);
        const container = document.getElementById("sim-kpi-strip-container");
        assert.ok(container.innerHTML.includes("2,450.5"));
        assert.ok(container.innerHTML.includes("21.4"));
        assert.ok(container.innerHTML.includes("24.80"));
        assert.ok(container.innerHTML.includes("16.90"));
        assert.ok(container.innerHTML.includes("+RM 18.50M"));
        assert.ok(container.innerHTML.includes("P10: RM 14.20M"));
    });
});

describe("Phase 5 Simulation UI — Disruption Timeline Ribbon", () => {
    it("renders baseline state when no shocks are active", () => {
        const ribbon = new DisruptionTimelineRibbon("sim-shock-ribbon-container");
        ribbon.render([]);
        const container = document.getElementById("sim-shock-ribbon-container");
        assert.ok(container.innerHTML.includes("Operational Baseline Active"));
    });

    it("renders active shock chips with appropriate icon and duration", () => {
        const ribbon = new DisruptionTimelineRibbon("sim-shock-ribbon-container");
        const shocks = [
            {
                id: "shock_1",
                name: "Middle East Energy Surge",
                category: "MACRO_ENERGY",
                startWeek: 40,
                durationWeeks: 26
            },
            {
                id: "shock_2",
                name: "Torrential Monsoon Crash",
                category: "CLIMATE",
                startWeek: 6,
                durationWeeks: 4
            }
        ];

        ribbon.render(shocks);
        const container = document.getElementById("sim-shock-ribbon-container");
        assert.ok(container.innerHTML.includes("Middle East Energy Surge"));
        assert.ok(container.innerHTML.includes("W40, 26 wks"));
        assert.ok(container.innerHTML.includes("Torrential Monsoon Crash"));
        assert.ok(container.innerHTML.includes("🌧️"));
    });
});

describe("Phase 5 Simulation UI — 156-Week Interactive Gantt Planner Grid", () => {
    beforeEach(() => {
        simulationStore._state.masterPonds = [];
        simulationStore._state.liveActivePonds = [];
        simulationStore._state.scheduledCycles = [];
    });

    it("renders months and week headers correctly with Monsoon highlights", () => {
        const grid = new ModulePlannerGrid("sim-gantt-planner-container");
        
        // Seed store state for testing
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
                strategyCode: "DS1",
                stockDensityPlM2: 100,
                harvestPlanCount: 1,
                startWeekIndex: 1,
                endWeekIndex: 14,
                dopDays: 45,
                stockMonth: 1
            },
            {
                pondId: "M08-P01",
                moduleId: "08",
                areaHa: 0.5,
                species: SPECIES.MONODON,
                strategyCode: "DS4",
                stockDensityPlM2: 45,
                harvestPlanCount: 2,
                startWeekIndex: 10,
                endWeekIndex: 26,
                dopDays: 18, // Rushed DOP flag!
                stockMonth: 3
            }
        ];

        grid.render();
        const container = document.getElementById("sim-gantt-planner-container");
        assert.ok(container.innerHTML.includes("M04-P01"));
        assert.ok(container.innerHTML.includes("M08-P01"));
        assert.ok(container.innerHTML.includes("sim-species-van"));
        assert.ok(container.innerHTML.includes("sim-species-mon"));
        assert.ok(container.innerHTML.includes("Monsoon"));
        assert.ok(container.innerHTML.includes("Rushed Turnaround")); // Risk icon rendered for M08
    });

    it("supports draggable cycle bars, hover delete button, and eraser brush", () => {
        const grid = new ModulePlannerGrid("sim-gantt-planner-container");
        grid.render();
        const container = document.getElementById("sim-gantt-planner-container");

        // Draggable cycle bars and hover delete button
        assert.ok(container.innerHTML.includes('draggable="true"'));
        assert.ok(container.innerHTML.includes("btn-delete-cycle"));
        assert.ok(container.innerHTML.includes("🗑️ Eraser"));

        // Test eraser brush selection
        grid.setBrush("ERASE");
        assert.equal(grid.activeBrush, "ERASE");

        // Test deleting cycle at week 35
        const origCount = grid.modules[0].cycles.length;
        grid._handleDeleteCycle(0, null, 35, false);
        assert.ok(grid.modules[0].cycles.length <= origCount);

        // Test drag-and-drop reschedule to week 40
        grid._handleCycleDrop({ modIdx: 0, rowIdx: null, origW: 56, theme: "DS3", span: 13 }, 0, null, 40);
        assert.ok(grid.modules[0].cycles.some(c => c.w === 40));

        // Test dropping just one week after original start (e.g. W35 -> W36)
        grid._handleCycleDrop({ modIdx: 0, rowIdx: null, origW: 35, theme: "DS3", span: 13 }, 0, null, 36);
        assert.ok(grid.modules[0].cycles.some(c => c.w === 36));
    });

    it("accurately calculates target week from mouse X offset across multi-week spans (_resolveTargetWeek)", () => {
        const grid = new ModulePlannerGrid("sim-gantt-planner-container");

        // Mock 13-week cycle bar starting at Week 35 (width 260px, 20px per week)
        const mockCycleBar = {
            hasAttribute: (attr) => attr === "data-week" || attr === "data-span",
            getAttribute: (attr) => (attr === "data-week" ? "35" : (attr === "data-span" ? "13" : null)),
            getBoundingClientRect: () => ({ left: 100, width: 260, right: 360 })
        };

        // Mouse at Week 35 (left: 105px, offset 0)
        assert.equal(grid._resolveTargetWeek({ clientX: 105 }, mockCycleBar), 35);

        // Mouse at Week 36 (1 week to right: 125px -> offset 1)
        assert.equal(grid._resolveTargetWeek({ clientX: 125 }, mockCycleBar), 36);

        // Mouse at Week 37 (2 weeks to right: 145px -> offset 2)
        assert.equal(grid._resolveTargetWeek({ clientX: 145 }, mockCycleBar), 37);

        // Mouse at Week 40 (5 weeks to right: 205px -> offset 5)
        assert.equal(grid._resolveTargetWeek({ clientX: 205 }, mockCycleBar), 40);

        // Mock 5-week Turnaround Rest bar starting at Week 48 (width 100px, 20px per week)
        const mockRestBar = {
            hasAttribute: (attr) => attr === "data-week" || attr === "data-span",
            getAttribute: (attr) => (attr === "data-week" ? "48" : (attr === "data-span" ? "5" : null)),
            getBoundingClientRect: () => ({ left: 360, width: 100, right: 460 })
        };

        // Mouse at Week 48
        assert.equal(grid._resolveTargetWeek({ clientX: 365 }, mockRestBar), 48);

        // Mouse at Week 49 (1 week after start of rest)
        assert.equal(grid._resolveTargetWeek({ clientX: 385 }, mockRestBar), 49);

        // Mouse at Week 51 (3 weeks after start of rest)
        assert.equal(grid._resolveTargetWeek({ clientX: 425 }, mockRestBar), 51);
    });

    it("supports 3-tier hierarchical editing: pond-level independent scheduling, row batch, and module batch", () => {
        const grid = new ModulePlannerGrid("sim-gantt-planner-container");
        grid.viewHorizon = "FUTURE"; // Prevent Actual YTD lock in test

        // 1. Verify initial state of Module 0, Row 0, Pond 0 and Pond 1
        const mod = grid.modules[0];
        const row = mod.rows[0];
        const pond0 = row.pondList[0];
        const pond1 = row.pondList[1];

        assert.ok(pond0.cycles.length > 0, "Pond 0 should have initial cycles");
        assert.ok(pond1.cycles.length > 0, "Pond 1 should have initial cycles");
        const initialP1Weeks = pond1.cycles.map(c => c.w);

        // Target a future week cycle in Pond 0 (e.g. W47)
        const testCycleW = pond0.cycles.find(c => c.w > 40)?.w || 47;
        
        // POND LEVEL MOVE: Move ONLY Pond 0 from testCycleW to W51
        grid._handleCycleDrop(
            { modIdx: 0, rowIdx: 0, pondIdx: 0, origW: testCycleW, theme: "DS3", span: 13 },
            0, 0, 0, 51
        );

        // Verify: Pond 0 updated to W51, while Pond 1 was NOT affected
        assert.ok(pond0.cycles.some(c => c.w === 51), "Pond 0 should have cycle at W51");
        assert.ok(!pond0.cycles.some(c => c.w === testCycleW), "Pond 0 should no longer have cycle at original week");
        assert.deepEqual(pond1.cycles.map(c => c.w), initialP1Weeks, "Sibling Pond 1 in same row must remain unchanged");

        // POND LEVEL DELETE: Delete cycle at W51 for Pond 0 only
        grid._handleDeleteCycle(0, 0, 0, 51, false);
        assert.ok(!pond0.cycles.some(c => c.w === 51), "Pond 0 should have W51 cycle deleted");
        assert.deepEqual(pond1.cycles.map(c => c.w), initialP1Weeks, "Sibling Pond 1 must still remain unchanged");

        // ROW LEVEL MOVE: Move all ponds in Row 0 at week X to week Y
        const rowTargetW = pond1.cycles[1]?.w || 65;
        grid._handleCycleDrop(
            { modIdx: 0, rowIdx: 0, pondIdx: null, origW: rowTargetW, theme: "DS3", span: 13 },
            0, 0, null, 70
        );
        // All ponds in Row 0 that had rowTargetW should now have W70
        assert.ok(pond1.cycles.some(c => c.w === 70), "Pond in Row 0 should be shifted to W70");
        // Verify Row 1 ponds are unaffected
        const row1Pond = mod.rows[1].pondList[0];
        assert.ok(!row1Pond.cycles.some(c => c.w === 70), "Pond in Row 1 must NOT be affected by Row 0 batch edit");

        // MODULE LEVEL MOVE: Move across all rows in Module 0
        grid._handleCycleDrop(
            { modIdx: 0, rowIdx: null, pondIdx: null, origW: 70, theme: "DS3", span: 13 },
            0, null, null, 75
        );
        assert.ok(pond1.cycles.some(c => c.w === 75), "Pond in Row 0 should be shifted to W75");
    });

    it("renders October 2026 live biometrics and progress indicators for active ponds", () => {
        const grid = new ModulePlannerGrid("sim-gantt-planner-container");
        grid.viewHorizon = "2026";
        
        // Expand module 0 and row 0 to show individual ponds
        grid.modules[0].expanded = true;
        grid.modules[0].rows[0].expanded = true;
        // Set pond 1 to IDLE in October to test idle today-slot styling
        grid.modules[0].rows[0].pondList[1].status = "IDLE";
        grid.modules[0].rows[0].pondList[1].isLive = false;
        grid.modules[0].rows[0].pondList[1].cycles = [{ w: 46, t: "DS3" }];

        grid.render();
        const container = document.getElementById("sim-gantt-planner-container");

        // 1. Month headers show October as current with Week 42 highlight
        assert.ok(container.innerHTML.includes("CURRENT - W42"), "Month header should show CURRENT - W42");
        assert.ok(container.innerHTML.includes("TODAY (W42)"), "Month header should show TODAY (W42) badge");

        // 2. Active ponds in October render live progress fill and biometrics badge
        assert.ok(container.innerHTML.includes("sim-cycle-progress-fill"), "Rendered HTML should have progress fill element");
        assert.ok(container.innerHTML.includes("sim-cycle-live-badge"), "Rendered HTML should have live badge element");
        assert.ok(container.innerHTML.includes("DOC 95d"), "Rendered HTML should display DOC 95d for active pond");
        assert.ok(container.innerHTML.includes("16.2g"), "Rendered HTML should display ABW 16.2g");
        assert.ok(container.innerHTML.includes("sim-cycle-live-pulse"), "Rendered HTML should display pulsing indicator");

        // 3. Grid slots at today's week have today styling
        assert.ok(container.innerHTML.includes("is-today-week"), "Week 42 empty slots should have is-today-week class");
    });

    it("synchronizes live Supabase records via syncWithLiveStore", () => {
        const grid = new ModulePlannerGrid("sim-gantt-planner-container");

        const mockStore = {
            liveActivePonds: [
                {
                    pondId: "01.01.01",
                    pondStatus: "PRODUCTION",
                    stckDate: "2026-07-22",
                    docDays: 88,
                    latestSampling: { smplAbw: 17.5 }
                }
            ],
            scheduledCycles: [],
            _state: { scheduledCycles: [] },
            runSimulationDebounced: () => {}
        };

        grid.syncWithLiveStore(mockStore);

        const targetPond = grid.modules[0].rows[0].pondList.find(p => p.label === "01.01.01" || p.pondId === "01.01.01");
        assert.ok(targetPond, "Target pond 01.01.01 should exist in grid hierarchy");
        assert.equal(targetPond.status, "PRODUCTION");
        assert.equal(targetPond.isLive, true);
        assert.equal(targetPond.docDays, 88);
        assert.equal(targetPond.abw, 17.5);
        assert.equal(targetPond.stckDate, "2026-07-22");
        assert.ok(targetPond.cycles[0].isLive, "First cycle should be marked live");
        assert.equal(targetPond.cycles[0].docDays, 88);
        assert.equal(targetPond.cycles[0].abw, 17.5);

        // Verify store was updated
        assert.ok(mockStore._state.scheduledCycles.some(s => s.pondId === "01.01.01"));
    });

    it("activates 15-month crop runway extending late-year stockings fully into next year", () => {
        const grid = new ModulePlannerGrid("sim-gantt-planner-container");
        grid.viewHorizon = "2026";

        // Schedule a late stocking cycle at Week 51 on Pond 0
        grid.modules[0].expanded = true;
        grid.modules[0].rows[0].expanded = true;
        grid.modules[0].rows[0].pondList[0].cycles = [
            { w: 51, t: "DS3" } // 13-week culture ending at W63
        ];

        grid.render();
        const container = document.getElementById("sim-gantt-planner-container");

        // 1. Month headers render Jan '27, Feb '27, Mar '27 with CARRYOVER badge
        assert.ok(container.innerHTML.includes("Jan '27"), "Runway should render Jan '27 header");
        assert.ok(container.innerHTML.includes("Feb '27"), "Runway should render Feb '27 header");
        assert.ok(container.innerHTML.includes("Mar '27"), "Runway should render Mar '27 header");
        assert.ok(container.innerHTML.includes("CARRYOVER"), "Runway should render CARRYOVER badge");

        // 2. Cycle bar spans all 13 weeks to Week 63 without being clamped at Week 52
        assert.ok(container.innerHTML.includes('data-span="13"'), "Cycle bar should span full 13 weeks");
        assert.ok(container.innerHTML.includes("H:W63"), "Cycle bar should display harvest week W63 in 2027");

        // 3. Grid container uses sim-runway-grid
        assert.ok(container.innerHTML.includes("sim-runway-grid"), "Grid should use sim-runway-grid class");

        // 4. Dedicated Week Number Headers rendered with clear week numbers
        assert.ok(container.innerHTML.includes("TIMELINE (WEEKS)"), "Should render TIMELINE (WEEKS) header");
        assert.ok(container.innerHTML.includes("W1"), "Should render W1 header");
        assert.ok(container.innerHTML.includes("W52"), "Should render W52 header");
        assert.ok(container.innerHTML.includes("W65"), "Should render W65 header");

        // 5. Restored sim-cycle-bar classes and bar-span variable for week lines
        assert.ok(container.innerHTML.includes("sim-cycle-bar bg-theme-ds3"), "Cycle bar should have sim-cycle-bar and theme classes");
        assert.ok(container.innerHTML.includes("--bar-span: 13"), "Cycle bar should set --bar-span for week division overlay");
        assert.ok(container.innerHTML.includes("is-month-end"), "Empty slots should have is-month-end dividing line class");
    });
});

describe("Phase 5 Simulation UI — Weekly & Monthly MRP Table", () => {
    it("renders biological, PL demand, feed SKU, and 28-chemical MRP sections", () => {
        const table = new WeeklyRollingTable("sim-mrp-table-container");

        // Seed simulation result
        simulationStore._state.simulationResult = {
            monthlyMatrix: [
                {
                    year: 2026,
                    month: 1,
                    monthName: "Jan",
                    activePondsCount: 140,
                    harvestYieldMt: 85.5,
                    averageHarvestAbwG: 18.2,
                    plDemandMpcs: { total: 12.5, spf: 5.0, spr: 4.0, monodon: 3.5 },
                    feedDemandMt: { total: 135.0, starter1: 15.0, starter2: 30.0, grower3: 50.0, finisher4: 40.0 },
                    chemicalMrp: { dolomiteBags: 850, gasChlorineKg: 1200, emProbioticLiters: 450 },
                    activePondDays: 3200
                }
            ],
            weeklyMatrix: []
        };

        table.render();
        const container = document.getElementById("sim-mrp-table-container");
        assert.ok(container.innerHTML.includes("Biological Culture &amp; Harvest Production"));
        assert.ok(container.innerHTML.includes("Post-Larvae (PL) Hatchery Demand"));
        assert.ok(container.innerHTML.includes("SAP Feed SKU Requirements"));
        assert.ok(container.innerHTML.includes("28-Chemical &amp; Fertilizer"));
        assert.ok(container.innerHTML.includes("Agricultural Dolomite"));
        assert.ok(container.innerHTML.includes("Calcium Hypochlorite Gas"));
        assert.ok(container.innerHTML.includes("TNB Electricity Accounting Driver"));
    });
});

describe("Phase 5 Simulation UI — BOD Spliced Executive P&L Table", () => {
    it("renders spliced actuals and forecast with Full-Year LE vs BP variance", () => {
        const bod = new BODSummaryTable("sim-bod-table-container");
        bod.selectedYear = 2026;

        simulationStore._state.cutoffMonth = 2;
        simulationStore._state.actualMonths = [
            { month: 1, harvest_mt: 75.0, final_abw: 17.5, final_sr: 72.0, final_fcr: 1.62 }
        ];

        bod.render();
        const container = document.getElementById("sim-bod-table-container");
        assert.ok(container.innerHTML.includes("Top 15 BOD Operational &amp; Financial KPIs"));
        assert.ok(container.innerHTML.includes("Full-Year LE"));
        assert.ok(container.innerHTML.includes("Full-Year BP"));
        assert.ok(container.innerHTML.includes("Variance vs BP"));
        assert.ok(container.innerHTML.includes("Realized YTD Actuals"));
    });
});

describe("Phase 5 Simulation UI — Modals (PondCycle, Shock, Scenario)", () => {
    it("opens PondCycleModal and displays cycle parameters", () => {
        const modal = new PondCycleModal("modal-test-cycle");
        modal.open("M04-P01", 0, {
            pondId: "M04-P01",
            moduleId: "04",
            areaHa: 0.5,
            species: SPECIES.VANNAMEI,
            strategyCode: "DS1",
            stockDensityPlM2: 100,
            startWeekIndex: 1,
            endWeekIndex: 14,
            dopDays: 45
        });

        const el = document.getElementById("modal-test-cycle");
        assert.ok(el.innerHTML.includes("Tune Pond Cycle: M04-P01"));
        assert.ok(el.innerHTML.includes("Litopenaeus vannamei"));
        modal.close();
    });

    it("opens ShockModal and exposes presets", () => {
        const modal = new ShockModal("modal-test-shock");
        modal.open();
        const el = document.getElementById("modal-test-shock");
        assert.ok(el.innerHTML.includes("Inject Time-Scoped Disruption Shock"));
        assert.ok(el.innerHTML.includes("Middle East Conflict Energy Surge"));
        modal.close();
    });

    it("opens ScenarioModal and supports saving", () => {
        const modal = new ScenarioModal("modal-test-scenarios");
        modal.open();
        const el = document.getElementById("modal-test-scenarios");
        assert.ok(el.innerHTML.includes("Manage Digital Twin Scenarios"));
        modal.close();
    });
});

describe("Phase 5 Simulation UI — Tab 1: Stocking Themes Tab ('ass')", () => {
    it("renders stocking theme presets with density, duration, and output targets", () => {
        let selectedBrush = null;
        const themesTab = new StockingThemesTab("sim-test-themes-container", (b) => {
            selectedBrush = b;
        });

        themesTab.render();
        const container = document.getElementById("sim-test-themes-container");
        assert.ok(container.innerHTML.includes("Stocking Strategy &amp; Theme Matrix"));
        assert.ok(container.innerHTML.includes("DS1"));
        assert.ok(container.innerHTML.includes("DS2"));
        assert.ok(container.innerHTML.includes("DS3"));
        assert.ok(container.innerHTML.includes("DS4"));
        assert.ok(container.innerHTML.includes("NT2"));
        assert.ok(container.innerHTML.includes("PT2"));
        assert.ok(container.innerHTML.includes("PT3"));
        assert.ok(container.innerHTML.includes("PL/m²"));
        assert.ok(container.innerHTML.includes("Empirical AI"));
    });
});

describe("Phase 5 Simulation UI — Tab 3: Monthly Production Roll-Up ('prt')", () => {
    it("renders 12 monthly columns with Actual YTD vs Rolling Plan and quarterly roll-ups", () => {
        const prt = new MonthlyProductionTab("sim-test-prt-container");
        prt.setYear(2026);

        simulationStore._state.cutoffMonth = 8;
        simulationStore._state.actualMonths = [
            { month: 1, harvest_mt: 80.0, final_abw: 18.0, final_sr: 70.0, final_fcr: 1.60, stocked_ponds: 28, harvested_ponds: 26 },
            { month: 2, harvest_mt: 85.0, final_abw: 18.2, final_sr: 72.0, final_fcr: 1.58, stocked_ponds: 30, harvested_ponds: 28 }
        ];

        prt.render();
        const container = document.getElementById("sim-test-prt-container");
        assert.ok(container.innerHTML.includes("Monthly Production Roll-Up"));
        assert.ok(container.innerHTML.includes("Full Year (LE)"));
        assert.ok(container.innerHTML.includes("Q1"));
        assert.ok(container.innerHTML.includes("Q2"));
        assert.ok(container.innerHTML.includes("Q3"));
        assert.ok(container.innerHTML.includes("Q4"));
        assert.ok(container.innerHTML.includes("Pond Turnaround &amp; Stocking Execution"));
        assert.ok(container.innerHTML.includes("Harvest Biomass, Size &amp; Productivity"));
        assert.ok(container.innerHTML.includes("Survival Rate (SR)"));
        assert.ok(container.innerHTML.includes("Feed Conversion Ratio (FCR)"));
    });
});

