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
        this._innerHTML = "";
        this.style = {};
        this.attributes = new Map();
        this.children = new Map();
        this.scrollTop = 0;
        this.scrollLeft = 0;
        this.classList = {
            _classes: new Set(),
            add(c) { this._classes.add(c); },
            remove(c) { this._classes.delete(c); },
            contains(c) { return this._classes.has(c); },
            toggle(c, force) {
                if (force !== undefined) {
                    if (force) this._classes.add(c);
                    else this._classes.delete(c);
                    return force;
                }
                if (this._classes.has(c)) {
                    this._classes.delete(c);
                    return false;
                }
                this._classes.add(c);
                return true;
            }
        };
        this.listeners = new Map();
    }

    get innerHTML() { return this._innerHTML; }
    set innerHTML(val) {
        this._innerHTML = String(val || "");
        this.children.clear();
    }

    getAttribute(k) { return this.attributes.get(k) ?? null; }
    setAttribute(k, v) { this.attributes.set(k, String(v)); }
    hasAttribute(k) { return this.attributes.has(k); }
    removeAttribute(k) { this.attributes.delete(k); }
    closest(sel) { return null; }
    getBoundingClientRect() { return { left: 0, top: 0, right: 100, bottom: 50, width: 100, height: 50 }; }
    scrollTo(opts) { this.scrollLeft = opts?.left ?? 0; this.scrollTop = opts?.top ?? 0; }

    addEventListener(event, fn) {
        if (!this.listeners.has(event)) this.listeners.set(event, []);
        this.listeners.get(event).push(fn);
    }

    querySelector(sel) {
        if (!this.children.has(sel)) {
            this.children.set(sel, new MockElement(sel));
        }
        return this.children.get(sel);
    }

    querySelectorAll(sel) {
        return [this.querySelector(sel)];
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
            { pondId: "04.07.01", moduleId: "04", areaHa: 0.5 },
            { pondId: "08.15.01", moduleId: "08", areaHa: 0.5 }
        ];
        simulationStore._state.scheduledCycles = [
            {
                pondId: "04.07.01",
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
                pondId: "08.15.01",
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
        assert.ok(container.innerHTML.includes("04.07.01"));
        assert.ok(container.innerHTML.includes("08.15.01"));
        assert.ok(container.innerHTML.includes(">M01<"));
        assert.ok(container.innerHTML.includes(">M08<"));
        assert.ok(container.innerHTML.includes("Monsoon"));
        assert.ok(container.innerHTML.includes("Rushed Turnaround")); // Risk icon rendered for M08
        
        // In ROW perspective, verify clean row headers without species badges or 12p
        grid.setPerspective("ROW");
        assert.ok(container.innerHTML.includes("M01 - ROW 1"));
        assert.ok(!container.innerHTML.includes("sim-species-van"));
        assert.ok(!container.innerHTML.includes("sim-species-mon"));
        assert.ok(!/>\s*12p\s*</.test(container.innerHTML), "Row view must not render 12p badge");
        grid.setPerspective("MODULE");
        
        // Sticky Header & Viewport Box verification
        assert.ok(container.innerHTML.includes("sim-planner-grid-box"), "Grid box should have sim-planner-grid-box class");
        assert.ok(container.innerHTML.includes("sim-grid-sticky-header-group"), "Headers should be wrapped in sim-grid-sticky-header-group");
        assert.ok(container.innerHTML.includes("sim-grid-corner-cell"), "Top-left header corner cell should have sim-grid-corner-cell class");
        assert.ok(container.innerHTML.includes("btn-toggle-grid-expand"), "Toolbar should render expand toggle button");
        assert.ok(container.innerHTML.includes("btn-jump-current-week"), "Toolbar should render jump to current week button");

        // Verify grid tracks alignment contract: Header, Pulse Strip, and Rows use matching sim-runway-grid
        assert.ok(container.innerHTML.includes('class="sim-runway-grid sim-grid-header-row sim-grid-header-month"'), "Month header must use sim-runway-grid");
        assert.ok(container.innerHTML.includes('class="sim-runway-grid sim-grid-header-row sim-grid-header-week"'), "Week header must use sim-runway-grid");
        assert.ok(container.innerHTML.includes('id="sim-pulse-strip-container"'), "Pulse strip container must exist");
        
        // Verify standard 2026 view does not activate sim-planner-3year (enforces zero horizontal scroll)
        assert.ok(!container.innerHTML.includes("sim-planner-3year"), "Standard 2026 view must NOT have sim-planner-3year");
        
        // Verify pulse strip cell truncation contract (prevents column blowout)
        assert.ok(container.innerHTML.includes("min-width: 0; overflow: hidden; text-overflow: ellipsis;"), "Pulse strip cells must enforce min-width: 0 and text-overflow ellipsis");

        // Verify 3-year timeline activates sim-planner-3year class
        grid.viewHorizon = "3YEAR";
        grid.render();
        assert.ok(container.innerHTML.includes("sim-planner-3year"), "3-Year view must have sim-planner-3year class");
        grid.viewHorizon = "2026";
        grid.render();

        // Verify expand toggle interaction
        assert.equal(grid.isGridExpanded, false);
        grid.toggleGridExpand();
        assert.equal(grid.isGridExpanded, true);
        grid.toggleGridExpand();
        assert.equal(grid.isGridExpanded, false);

        // Verify scrollToCurrentWeek runs without throw
        assert.doesNotThrow(() => grid.scrollToCurrentWeek());
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

        // Test deleting cycle at week 44
        const origCount = grid.modules[0].cycles.length;
        grid._handleDeleteCycle(0, null, 44, false);
        assert.ok(grid.modules[0].cycles.length <= origCount);

        // Test drag-and-drop reschedule to week 48
        grid._handleCycleDrop({ modIdx: 0, rowIdx: null, origW: 56, theme: "DS3", span: 13 }, 0, null, 48);
        assert.ok(grid.modules[0].cycles.some(c => c.w === 48));

        // Test dropping just after original start (e.g. W48 -> W50)
        grid._handleCycleDrop({ modIdx: 0, rowIdx: null, origW: 48, theme: "DS3", span: 13 }, 0, null, 50);
        assert.ok(grid.modules[0].cycles.some(c => c.w === 50));
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
                    isProduction: true,
                    stckDate: "2026-07-22",
                    docDays: 88,
                    latestSampling: { smplAbw: 17.5 }
                },
                {
                    pondId: "01.01.03",
                    pondStatus: "IDLE",
                    isProduction: false,
                    stckDate: null,
                    docDays: 0,
                    latestSampling: null
                }
            ],
            scheduledCycles: [
                { pondId: "01.01.03", startWeekIndex: 61, strategyCode: "DS2" }
            ],
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

        // Verify IDLE pond 01.01.03
        const targetPond3 = grid.modules[0].rows[0].pondList.find(p => p.label === "01.01.03" || p.pondId === "01.01.03");
        assert.ok(targetPond3, "Target pond 01.01.03 should exist in grid hierarchy");
        assert.equal(targetPond3.status, "IDLE");
        assert.equal(targetPond3.isLive, false);
        assert.equal(targetPond3.docDays, 0);
        assert.equal(targetPond3.abw, 0);
        assert.equal(targetPond3.stckDate, null);
        assert.ok(!targetPond3.cycles.some(c => c.w <= 52), "Idle pond 01.01.03 must have NO cycles in 2026 (Weeks 1-52)");
        assert.ok(!targetPond3.cycles.some(c => c.w === 42), "Idle pond 01.01.03 must have NO cycle at Week 42 (this week)");
        assert.ok(targetPond3.cycles.some(c => c.w === 61), "Idle pond 01.01.03 should preserve FY 2027 future cycle at W61");

        // Verify store was updated
        assert.ok(mockStore._state.scheduledCycles.some(s => s.pondId === "01.01.01"));

        // Verify MAINTENANCE pond 04.08.01 does not alias to 04.07.01 or inherit production cycles
        const mockStoreWithMaint = {
            liveActivePonds: [
                {
                    pondId: "04.07.01",
                    pondStatus: "PRODUCTION",
                    isProduction: true,
                    stckDate: "2026-06-21",
                    docDays: 121,
                    latestSampling: { smplAbw: 34.29 }
                },
                {
                    pondId: "04.08.01",
                    pondStatus: "MAINTENANCE",
                    isProduction: false,
                    stckDate: null,
                    docDays: 0,
                    latestSampling: null
                }
            ],
            scheduledCycles: [
                { pondId: "04.07.01", startWeekIndex: 25, strategyCode: "DS4" }
            ],
            _state: { scheduledCycles: [] },
            runSimulationDebounced: () => {}
        };

        grid.syncWithLiveStore(mockStoreWithMaint);

        const m04r08p01 = grid.modules.find(m => m.id === "M04").rows[1].pondList.find(p => p.label === "04.08.01");
        assert.ok(m04r08p01, "04.08.01 must exist");
        assert.equal(m04r08p01.pondId, "04.08.01", "PondId must be 04.08.01, NOT aliased to M04-P01");
        assert.equal(m04r08p01.status, "MAINTENANCE");
        assert.equal(m04r08p01.isLive, false);
        assert.equal(m04r08p01.cycles.length, 0, "Maintenance pond 04.08.01 must have ZERO cycles, not inherit 04.07.01 cycles");
    });

    it("autoOptimizeSchedule retains all historical closed actuals and live cycles without wiping past Gantt bars", () => {
        const grid = new ModulePlannerGrid("sim-gantt-planner-container");

        // Mock store with historical closed cycles in 2026 + active production pond
        const mockMaster = [
            { pondId: "01.01.01", moduleId: "01", areaHa: 0.5 },
            { pondId: "01.01.02", moduleId: "01", areaHa: 0.5 }
        ];
        const mockLive = [
            {
                pondId: "01.01.01",
                moduleId: "01",
                pondStatus: "PRODUCTION",
                isProduction: true,
                stckDate: "2026-07-22",
                docDays: 88,
                latestSampling: { smplAbw: 17.5 }
            }
        ];
        const mockYearCycles = [
            // Past closed harvest in Week 5..18 (Jan-May 2026)
            {
                pondId: "01.01.02",
                pondIndex: "01.01.02",
                moduleId: "01",
                areaHa: 0.5,
                species: "VANNAMEI",
                strategyCode: "DS1",
                stckDate: "2026-02-01",
                dateClose: "2026-05-10",
                startWeekIndex: 5,
                endWeekIndex: 18,
                isProduction: false,
                isHistoricalClosed: true
            },
            // Current production pond (stocked Week 29, active in October)
            {
                pondId: "01.01.01",
                pondIndex: "01.01.01",
                moduleId: "01",
                areaHa: 0.5,
                species: "VANNAMEI",
                strategyCode: "DS3",
                stckDate: "2026-07-22",
                startWeekIndex: 29,
                endWeekIndex: 44,
                isProduction: true
            }
        ];

        // Seed simulationStore with mock actuals
        simulationStore._state.masterPonds = mockMaster;
        simulationStore._state.liveActivePonds = mockLive;
        simulationStore._state.yearCycles = mockYearCycles;
        simulationStore._state.samplingMap = new Map();

        // Run autoOptimizeSchedule
        simulationStore.autoOptimizeSchedule({
            vannameiDefaultStrategy: "DS2",
            targetCyclesPerYear: 2,
            monodonAnnualCapRatio: 0.30
        });

        // 1. Verify store.scheduledCycles still contains the historical closed cycle
        const closedCycle = simulationStore.scheduledCycles.find(c => c.pondId === "01.01.02" && c.startWeekIndex === 5);
        assert.ok(closedCycle, "Historical closed cycle at W5 must be preserved in store.scheduledCycles");
        assert.equal(closedCycle.isHistoricalClosed, true);
        assert.equal(closedCycle.isLocked, true);

        // 2. Verify store.scheduledCycles contains the active production cycle
        const prodCycle = simulationStore.scheduledCycles.find(c => c.pondId === "01.01.01" && c.startWeekIndex === 29);
        assert.ok(prodCycle, "Active production cycle at W29 must be preserved in store.scheduledCycles");
        assert.equal(prodCycle.isLivePondCycle, true);

        // 3. Sync into grid and verify Gantt bars
        grid.syncWithLiveStore(simulationStore);
        const pond2 = grid.modules[0].rows[0].pondList.find(p => p.label === "01.01.02" || p.pondId === "01.01.02");
        assert.ok(pond2, "Pond 01.01.02 must exist in grid");
        const p2W5 = pond2.cycles.find(c => c.w === 5);
        assert.ok(p2W5, "Pond 01.01.02 must retain historical closed harvest bar at Week 5 on the Gantt grid!");
        assert.equal(p2W5.isLocked, true);
        assert.equal(p2W5.isHistoricalClosed, true);

        const pond1 = grid.modules[0].rows[0].pondList.find(p => p.label === "01.01.01" || p.pondId === "01.01.01");
        assert.ok(pond1, "Pond 01.01.01 must exist in grid");
        const p1W29 = pond1.cycles.find(c => c.w === 29);
        assert.ok(p1W29, "Pond 01.01.01 must retain active production bar at Week 29!");
        assert.equal(p1W29.isLive, true);
    });

    it("activates 15-month crop runway extending late-year stockings fully into next year", () => {
        const grid = new ModulePlannerGrid("sim-gantt-planner-container");
        grid.viewHorizon = "2026";

        // Schedule a late stocking cycle at Week 51 on Pond 0
        grid.modules[0].expanded = true;
        grid.modules[0].rows[0].expanded = true;
        grid.modules[0].rows[0].pondList[0].cycles = [
            { w: 51, t: "DS3", durationWeeks: 13 } // 13-week culture ending at W63
        ];

        grid.render();
        const container = document.getElementById("sim-gantt-planner-container");

        // 1. Month headers render Jan '27, Feb '27, Mar '27 (no CARRYOVER badge per user request)
        assert.ok(container.innerHTML.includes("Jan '27"), "Runway should render Jan '27 header");
        assert.ok(container.innerHTML.includes("Feb '27"), "Runway should render Feb '27 header");
        assert.ok(container.innerHTML.includes("Mar '27"), "Runway should render Mar '27 header");
        assert.ok(!container.innerHTML.includes("CARRYOVER"), "Runway should NOT render CARRYOVER badge (clean visual)");

        // 2. Cycle bar spans all 13 weeks to Week 63 without being clamped at Week 52
        assert.ok(container.innerHTML.includes('data-span="13"'), "Cycle bar should span full 13 weeks");
        assert.ok(container.innerHTML.includes("H:W63"), "Cycle bar should display harvest week W63 in 2027");

        // 3. Grid container uses sim-runway-grid
        assert.ok(container.innerHTML.includes("sim-runway-grid"), "Grid should use sim-runway-grid class");

        // 4. Dedicated Week Number Headers rendered with clear pure numbers (no 'W' prefix, resetting to 1 for next year)
        assert.ok(container.innerHTML.includes("TIMELINE (WEEKS)"), "Should render TIMELINE (WEEKS) header");
        assert.ok(container.innerHTML.includes('title="Calendar Week 1"'), "Should render Calendar Week 1 header");
        assert.ok(container.innerHTML.includes('title="Calendar Week 52"'), "Should render Calendar Week 52 header");
        assert.ok(container.innerHTML.includes('title="Calendar Week 13"'), "Should render Calendar Week 13 header for runway week 65");
        assert.ok(!container.innerHTML.includes('title="Calendar Week 65"'), "Should NOT have Calendar Week 65 (resets to 1)");

        // 5. Restored sim-cycle-bar classes and bar-span variable for week lines
        assert.ok(container.innerHTML.includes("sim-cycle-bar bg-theme-ds3"), "Cycle bar should have sim-cycle-bar and theme classes");
        assert.ok(container.innerHTML.includes("--bar-span: 13"), "Cycle bar should set --bar-span for week division overlay");
        assert.ok(container.innerHTML.includes("is-month-end"), "Empty slots should have is-month-end dividing line class");
    });

    it("supports 3 dedicated view perspectives: MODULE (11), ROW (22), and POND (206) with module filtering", () => {
        const grid = new ModulePlannerGrid("sim-gantt-planner-container");
        grid.render();
        const container = document.getElementById("sim-gantt-planner-container");

        // 1. Default Perspective: MODULE
        assert.equal(grid.viewPerspective, "MODULE", "Default perspective should be MODULE");
        assert.ok(container.innerHTML.includes('class="btn-pill-item active" data-perspective="MODULE"'), "Module view button should be active");
        assert.ok(container.innerHTML.includes("11 MODULES (206 Ponds)"), "Corner title should show 11 MODULES");
        assert.ok(container.innerHTML.includes("Module 01"), "Should render Module 01");
        assert.ok(container.innerHTML.includes("Module 11"), "Should render Module 11");
        assert.ok(!container.innerHTML.includes("sim-pond-filter-bar"), "Module view should NOT render pond filter bar");

        // 2. Switch Perspective to ROW (strips modules completely, shows only canal rows)
        grid.setPerspective("ROW");
        assert.equal(grid.viewPerspective, "ROW", "Perspective should be ROW");
        assert.ok(container.innerHTML.includes('class="btn-pill-item active" data-perspective="ROW"'), "Row view button should be active");
        assert.ok(container.innerHTML.includes("22 ROWS (Canal Cohorts)"), "Corner title should show 22 ROWS");
        assert.ok(container.innerHTML.includes("M01 - ROW 1"), "Should render canal row M01 - ROW 1");
        assert.ok(container.innerHTML.includes("M01 - ROW 2"), "Should render canal row M01 - ROW 2");
        assert.ok(container.innerHTML.includes("M02 - ROW 3"), "Should render canal row M02 - ROW 3");
        assert.ok(container.innerHTML.includes("M09 - ROW 18"), "Should render canal row M09 - ROW 18");
        assert.ok(container.innerHTML.includes("M11 - ROW 22"), "Should render canal row M11 - ROW 22");
        assert.ok(!container.innerHTML.includes('data-action="toggle-mod"'), "Row view must strip all module headers and toggles");
        assert.ok(container.innerHTML.includes('data-action="toggle-row"'), "Row headers in Row View should be interactive toggles");

        // 2b. Test Accordion expansion in Row View
        assert.ok(!container.innerHTML.includes('data-pond="0"'), "Row ponds should not appear when row is collapsed");
        grid.modules[0].rows[0].expanded = true;
        grid.render();
        assert.ok(container.innerHTML.includes('data-pond="0"'), "Ponds in Row 0 should appear when Row 0 is expanded");
        assert.ok(container.innerHTML.includes("• 01.01.01"), "Pond label should appear when Row 0 is expanded");
        grid.modules[0].rows[0].expanded = false;
        grid.render();
        assert.ok(!container.innerHTML.includes('data-pond="0"'), "Ponds should hide when Row 0 is collapsed again");

        // 3. Switch Perspective to POND (shows individual physical ponds with module filter)
        grid.setPerspective("POND");
        assert.equal(grid.viewPerspective, "POND", "Perspective should be POND");
        assert.ok(container.innerHTML.includes('class="btn-pill-item active" data-perspective="POND"'), "Pond view button should be active");
        assert.ok(container.innerHTML.includes("GROWOUT PONDS (206 Ponds)"), "Corner title should show GROWOUT PONDS");
        assert.ok(container.innerHTML.includes("sim-pond-filter-bar"), "Pond view should render module filter bar");
        assert.ok(container.innerHTML.includes("01.01.01"), "Should render individual pond 01.01.01");
        assert.ok(container.innerHTML.includes("Production"), "Should render Production status text");
        assert.ok(container.innerHTML.includes("Idle"), "Should render Idle status text");
        assert.ok(!container.innerHTML.includes("PROD • DOC"), "Should no longer render bulky PROD • DOC badge");
        assert.ok(!container.innerHTML.includes("0.5ha"), "Should no longer render redundant 0.5ha in pond label column");

        // 4. Test Module Filter in Pond View
        grid.setPondModuleFilter("M01");
        assert.equal(grid.pondModuleFilter, "M01", "Pond module filter should be M01");
        assert.ok(container.innerHTML.includes("M01 PONDS"), "Corner title should reflect scoped M01 PONDS");
        assert.ok(container.innerHTML.includes("01.01.01"), "Should still include M01 ponds");
        // Verify M02 pond is excluded when filtered to M01
        assert.ok(!container.innerHTML.includes("M02 • 02.03.01"), "Filtered M01 view should exclude M02 ponds");
    });

    it("renders clean module labels (M01..M11) without badges, 24 ponds for M09, and supports Maintenance status", () => {
        const grid = new ModulePlannerGrid("sim-gantt-planner-container");
        grid.render();
        const container = document.getElementById("sim-gantt-planner-container");

        // 1. Verify clean module labels (M01, M02, M09, etc.) without species pill or pond count in Module perspective
        assert.ok(container.innerHTML.includes(">M01<"), "Module 1 header must show M01");
        assert.ok(container.innerHTML.includes(">M09<"), "Module 9 header must show M09");
        assert.ok(container.innerHTML.includes(">M11<"), "Module 11 header must show M11");
        // Ensure no bulky badges in the module header row
        const m09Module = grid.modules.find(m => m.id === "M09");
        assert.ok(m09Module, "M09 module should exist");
        assert.equal(m09Module.ponds, 24, "M09 must have 24 physical ponds");
        assert.equal(m09Module.rows.length, 2, "M09 must have 2 canal rows");
        assert.equal(m09Module.rows[0].pondList.length, 12, "M09 Row 17 must have 12 ponds");
        assert.equal(m09Module.rows[1].pondList.length, 12, "M09 Row 18 must have 12 ponds");
        assert.equal(m09Module.rows[0].pondList[11].label, "09.17.12", "M09 Row 17 pond 12 must be 09.17.12");
        assert.equal(m09Module.rows[1].pondList[11].label, "09.18.12", "M09 Row 18 pond 12 must be 09.18.12");

        // 2. Verify Maintenance pond status rendering
        const testPond = m09Module.rows[0].pondList[5];
        testPond.status = "MAINTENANCE";
        const formatted = grid._formatPondLabelDetails(testPond);
        assert.equal(formatted.statusText, "Maintenance", "Status text must be Maintenance");
        assert.equal(formatted.docText, "", "Maintenance ponds must not display DOC");
        assert.equal(formatted.statusColor, "#d97706", "Maintenance status must use warning amber color");

        // Expand M09 and Row 17 and render to test DOM output
        m09Module.expanded = true;
        m09Module.rows[0].expanded = true;
        grid.render();
        assert.ok(container.innerHTML.includes("09.17.06"), "Pond 09.17.06 should be in DOM");
        assert.ok(container.innerHTML.includes("Maintenance"), "Maintenance status text should be in DOM");
        assert.ok(!/>\s*12p\s*</.test(container.innerHTML), "Pond count 12p must not be present in expanded child row");
    });

    it("preserves scroll offsets and targeted matrix DOM during accordion toggles", () => {
        const grid = new ModulePlannerGrid("sim-gantt-planner-container");
        grid.render();
        const container = document.getElementById("sim-gantt-planner-container");
        const gridBox = container.querySelector(".sim-planner-grid-box");
        assert.ok(gridBox, "gridBox should exist");

        // Simulate scrolling down inside gridBox
        gridBox.scrollTop = 320;
        gridBox.scrollLeft = 45;

        // Toggle Module 0 using targeted matrix re-render
        grid.modules[0].expanded = true;
        grid._renderMatrixOnly();

        const updatedGridBox = container.querySelector(".sim-planner-grid-box");
        assert.equal(updatedGridBox, gridBox, "Targeted matrix re-render must preserve gridBox DOM instance");
        assert.equal(updatedGridBox.scrollTop, 320, "gridBox.scrollTop must remain locked at 320");
        assert.equal(updatedGridBox.scrollLeft, 45, "gridBox.scrollLeft must remain locked at 45");

        // Test full render() also captures and restores scroll position
        grid.render();
        const fullRenderBox = container.querySelector(".sim-planner-grid-box");
        assert.equal(fullRenderBox.scrollTop, 320, "Full render must restore scrollTop to 320");
        assert.equal(fullRenderBox.scrollLeft, 45, "Full render must restore scrollLeft to 45");
    });
});

describe("Phase 5 Simulation UI — Weekly & Monthly Operational / Cost Ledger Table", () => {
    it("renders biological, PL demand, feed SKU, and direct operational cost ledger sections", () => {
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
                    chemFertPrepCostRM: 45000,
                    chemFertCultureCostRM: 67500,
                    cons_of_chem_fert: 112500,
                    cons_of_supplies: 12000,
                    repair_maintenance: 18000,
                    harvest_expenses: 8500,
                    wages_direct: 35000,
                    activePondDays: 3200,
                    electricity: 48000
                }
            ],
            weeklyMatrix: []
        };

        table.render();
        const container = document.getElementById("sim-mrp-table-container");
        assert.ok(container.innerHTML.includes("Biological Culture &amp; Harvest Production"));
        assert.ok(container.innerHTML.includes("Post-Larvae (PL) Hatchery Demand"));
        assert.ok(container.innerHTML.includes("SAP Feed SKU Requirements"));
        assert.ok(container.innerHTML.includes("Direct Operations &amp; Chemical Ledger (Finance Table Ground Truth)"));
        assert.ok(container.innerHTML.includes("Chemicals &amp; Fertilizers — Pond Prep (40%)"));
        assert.ok(container.innerHTML.includes("Chemicals &amp; Fertilizers — Active Culture (60%)"));
        assert.ok(container.innerHTML.includes("Total Chemicals &amp; Fertilizers (cons_of_chem_fert)"));
        assert.ok(container.innerHTML.includes("Farm Supplies (cons_of_supplies)"));
        assert.ok(container.innerHTML.includes("Pond Repair &amp; Maintenance (repair_maintenance)"));
        assert.ok(container.innerHTML.includes("Harvest Expenses (harvest_expenses)"));
        assert.ok(container.innerHTML.includes("Direct Wages (wages_direct)"));
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

    it("opens PondCycleModal in read-only mode for locked actual cycles", () => {
        const modal = new PondCycleModal("modal-test-cycle-locked");
        modal.open("M01-P02", 0, {
            pondId: "M01-P02",
            moduleId: "01",
            areaHa: 0.5,
            species: SPECIES.VANNAMEI,
            strategyCode: "DS3",
            stockDensityPlM2: 95,
            startWeekIndex: 12,
            endWeekIndex: 25,
            dopDays: 42,
            isLocked: true
        });

        const el = document.getElementById("modal-test-cycle-locked");
        assert.ok(el.innerHTML.includes("Operational Actual / Database Cycle (Read-Only)"));
        assert.ok(el.innerHTML.includes("disabled"));
        assert.ok(!el.innerHTML.includes("Delete Cycle"));
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
    it("renders stocking theme presets from Single Source of Truth (CULTURE_STRATEGIES) and toggles AI vs Theoretical modes", () => {
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
        assert.ok(container.innerHTML.includes("NT1"));
        assert.ok(container.innerHTML.includes("NT2"));
        assert.ok(container.innerHTML.includes("NT3"));
        assert.ok(container.innerHTML.includes("PT1"));
        assert.ok(container.innerHTML.includes("PT2"));
        assert.ok(container.innerHTML.includes("PT3"));
        assert.ok(container.innerHTML.includes("PL/m²"));
        assert.ok(container.innerHTML.includes("Empirical AI"));

        // Verify Empirical AI mode shows expectedYieldPondKg (2950kg -> 3.0 MT for DS1)
        assert.ok(container.innerHTML.includes("3.0 MT"), "AI mode should display 3.0 MT for DS1");

        // Switch to Theoretical Target mode and verify targetYieldPondKg (3500kg -> 3.5 MT for DS1) is shown
        themesTab.isEmpiricalMode = false;
        themesTab.render();
        assert.ok(container.innerHTML.includes("3.5 MT"), "Theoretical mode should display 3.5 MT for DS1");
    });
});

describe("Phase 5 Simulation UI — Tab 3: Monthly Production Roll-Up ('prt')", () => {
    it("renders 12 monthly columns with Actual YTD vs Rolling Plan, quarterly roll-ups, and species filtering", () => {
        const prt = new MonthlyProductionTab("sim-test-prt-container");
        prt.setYear(2026);

        simulationStore._state.cutoffMonth = 8;
        simulationStore._state.actualMonths = [
            { month: 1, harvest_mt: 80.0, final_abw: 18.0, final_sr: 70.0, final_fcr: 1.60, stocked_ponds: 28, harvested_ponds: 26 },
            { month: 2, harvest_mt: 85.0, final_abw: 18.2, final_sr: 72.0, final_fcr: 1.58, stocked_ponds: 30, harvested_ponds: 28 }
        ];
        simulationStore._state.simulationResult = {
            monthlySummary: [
                {
                    year: 2026,
                    month: 11,
                    harvest_mt: 120.0,
                    harvested_ponds: 30,
                    bySpecies: {
                        VANNAMEI: { harvest_mt: 90.0, harvested_ponds: 22, abw: 18.5, sr: 75.0, fcr: 1.50, revenue_rm: 2100000, cost_rm: 1500000, ebitda_rm: 600000 },
                        MONODON: { harvest_mt: 33.0, harvested_ponds: 8, abw: 28.4, sr: 65.0, fcr: 1.85, revenue_rm: 965000, cost_rm: 660000, ebitda_rm: 305000 }
                    }
                }
            ]
        };

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

        // Verify species slice for MONODON
        prt.selectedSpecies = "MONODON";
        prt.render();
        assert.ok(container.innerHTML.includes("28.4"), "MONODON filter should show 28.4g ABW for Month 11");
    });
});


