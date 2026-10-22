/**
 * iSHARP DBMS 2.0 — Simulation Reactive Store (Phase 4)
 * Central Pub/Sub Store coordinating the 156-Week Digital Twin state,
 * debounced recalculations (250ms), scenario management, and Monte Carlo risk runs.
 */

import { DEFAULT_EMPIRICAL_PRIORS, SPECIES } from "../domain/simulation/baselineCalibrator.js";
import {
    run156WeekSimulation,
    runCorrelatedMonteCarlo
} from "../domain/simulation/simTickEngine.js";
import {
    generateOptimal156WeekSchedule,
    weekIndexToCalendar
} from "../domain/simulation/constraintScheduler.js";
import { projectActivePondHarvestDoc } from "../domain/simulation/hazardAndGrowthModel.js";
import { SimulationRepository } from "../infrastructure/repositories/simulationRepository.js";

class SimulationStore {
    constructor() {
        this._listeners = new Map();
        this._debounceTimer = null;

        this._state = {
            scenarioMetadata: {
                id: "default-hybrid-scenario",
                name: "Real-Time Hybrid Plan (2026-2028)",
                description: "Live active ponds + Frontier EBITDA-optimized rolling forward schedule",
                baseYear: 2026,
                baseMonth: 1,
                horizonWeeks: 156
            },
            priors: structuredClone(DEFAULT_EMPIRICAL_PRIORS),
            masterPonds: [],
            liveActivePonds: [],
            yearCycles: [],
            samplingMap: new Map(),
            scheduledCycles: [],
            shocks: [],
            simulationResult: null,
            monteCarloResult: null,
            actualMonths: [],
            cutoffMonth: new Date().getMonth() + 1,
            status: {
                isInitialized: false,
                isLoading: false,
                isSimulating: false,
                isMonteCarloRunning: false,
                lastSimulationDurationMs: 0,
                lastSimulatedAt: null
            }
        };
    }

    // =========================================================================
    // PUB / SUB REACTIVE EVENT SYSTEM
    // =========================================================================

    /**
     * Subscribes to store events:
     * "scenarioLoaded", "scheduleChanged", "simulationCompleted", "monteCarloCompleted",
     * "shocksChanged", "syncCompleted", "loadingStateChanged"
     *
     * @param {string} event
     * @param {Function} callback
     * @returns {Function} Unsubscribe function
     */
    subscribe(event, callback) {
        if (!this._listeners.has(event)) {
            this._listeners.set(event, new Set());
        }
        this._listeners.get(event).add(callback);
        return () => {
            const set = this._listeners.get(event);
            if (set) set.delete(callback);
        };
    }

    /**
     * Emits an event to all registered subscribers.
     * @param {string} event
     * @param {any} data
     */
    emit(event, data) {
        const listeners = this._listeners.get(event);
        if (listeners) {
            listeners.forEach((cb) => {
                try {
                    cb(data, this._state);
                } catch (err) {
                    console.error(`SimulationStore error in subscriber for "${event}":`, err);
                }
            });
        }
    }

    // =========================================================================
    // GETTERS
    // =========================================================================
    get scenarioMetadata() { return this._state.scenarioMetadata; }
    get priors() { return this._state.priors; }
    get masterPonds() { return this._state.masterPonds; }
    get liveActivePonds() { return this._state.liveActivePonds; }
    get yearCycles() { return this._state.yearCycles; }
    get samplingMap() { return this._state.samplingMap; }
    get scheduledCycles() { return this._state.scheduledCycles; }
    get shocks() { return this._state.shocks; }
    get simulationResult() { return this._state.simulationResult; }
    get monteCarloResult() { return this._state.monteCarloResult; }
    get actualMonths() { return this._state.actualMonths; }
    get cutoffMonth() { return this._state.cutoffMonth; }
    get status() { return this._state.status; }

    // =========================================================================
    // INITIALIZATION (Hybrid Real-Time Seed)
    // =========================================================================

    /**
     * Initializes the simulation store:
     * 1. Fetches physical pond master list & live active ponds from Supabase.
     * 2. Constructs the Hybrid Real-Time Seed (locking onto live ponds + auto-projecting optimal future waves).
     * 3. Runs the initial deterministic 156-week simulation.
     *
     * @param {Object} [options={}]
     * @param {number} [options.baseYear=2026]
     * @param {number} [options.baseMonth=1]
     * @param {number} [options.horizonWeeks=156]
     * @returns {Promise<Object>}
     */
    async init(options = {}) {
        this._setLoading(true);
        try {
            const baseYear = Number(options.baseYear) || this._state.scenarioMetadata.baseYear;
            const baseMonth = Number(options.baseMonth) || this._state.scenarioMetadata.baseMonth;
            const horizonWeeks = Number(options.horizonWeeks) || this._state.scenarioMetadata.horizonWeeks;

            this._state.scenarioMetadata.baseYear = baseYear;
            this._state.scenarioMetadata.baseMonth = baseMonth;
            this._state.scenarioMetadata.horizonWeeks = horizonWeeks;

            // Fetch physical ponds, live operational cycles & full year cycles (closed + prod)
            const [masterPonds, livePonds, yearCycles, actuals] = await Promise.all([
                SimulationRepository.fetchMasterPondsList(),
                SimulationRepository.fetchActivePonds(),
                SimulationRepository.fetchYearCycles(baseYear),
                SimulationRepository.fetchActualMonthlyHarvests(baseYear)
            ]);

            this._state.masterPonds = masterPonds;
            this._state.liveActivePonds = livePonds;
            this._state.actualMonths = actuals;
            this._state.yearCycles = yearCycles;

            // Fetch latest samplings for active production ponds
            const prodPondIndices = livePonds.filter(p => p.isProduction && p.pondIndex).map(p => p.pondIndex);
            const samplingMap = await SimulationRepository.fetchLatestSamplingsForPonds(prodPondIndices);
            this._state.samplingMap = samplingMap;

            // Construct the Hybrid Schedule
            this._state.scheduledCycles = this._constructHybridSchedule(
                masterPonds,
                livePonds,
                yearCycles,
                samplingMap,
                horizonWeeks,
                baseYear,
                baseMonth
            );

            this._state.status.isInitialized = true;
            this.emit("scenarioLoaded", this._state.scenarioMetadata);

            // Run initial simulation
            this.runSimulationImmediate();
            return this._state.simulationResult;
        } catch (err) {
            console.error("SimulationStore.init error:", err);
            throw err;
        } finally {
            this._setLoading(false);
        }
    }

    /**
     * Internal helper to build the Hybrid Schedule:
     * - Ingests all actual cycles for baseYear (closed actuals + active production + carryovers from prior year).
     * - Retains live active/production ponds with their exact real DOC and latest samplings.
     * - Uses `generateOptimal156WeekSchedule` to project optimal future cycles across all ponds.
     */
    _constructHybridSchedule(
        masterPonds,
        livePonds,
        yearCyclesOrSamplingMap = [],
        samplingMap = new Map(),
        horizonWeeks = 156,
        baseYear = 2026,
        baseMonth = 1,
        options = {}
    ) {
        // Support backward-compatible 6-argument signature where 3rd arg was samplingMap
        let yearCycles = [];
        let actualSamplingMap = samplingMap;
        let actualHorizonWeeks = horizonWeeks;
        let actualBaseYear = baseYear;
        let actualBaseMonth = baseMonth;
        let actualOptions = options || {};

        if (yearCyclesOrSamplingMap instanceof Map) {
            actualSamplingMap = yearCyclesOrSamplingMap;
            yearCycles = this._state?.yearCycles || [];
            actualHorizonWeeks = arguments[3] || 156;
            actualBaseYear = arguments[4] || 2026;
            actualBaseMonth = arguments[5] || 1;
            actualOptions = arguments[6] || {};
        } else if (Array.isArray(yearCyclesOrSamplingMap)) {
            yearCycles = yearCyclesOrSamplingMap;
        } else if (this._state?.yearCycles?.length > 0) {
            yearCycles = this._state.yearCycles;
        }

        if (!actualSamplingMap || !(actualSamplingMap instanceof Map) || actualSamplingMap.size === 0) {
            actualSamplingMap = this._state?.samplingMap || new Map();
        }

        // 1. Configure scheduler options
        const restWeeks = actualOptions.restWeeks !== undefined ? Number(actualOptions.restWeeks) : 6;
        const schedulerOptions = {
            horizonWeeks: actualHorizonWeeks,
            baseYear: actualBaseYear,
            baseMonth: actualBaseMonth,
            restWeeks,
            elevatedModules: actualOptions.elevatedModules || ["01", "02", "03"],
            vannameiDefaultStrategy: actualOptions.vannameiDefaultStrategy || "DS1",
            targetCyclesPerYear: actualOptions.targetCyclesPerYear !== undefined ? Number(actualOptions.targetCyclesPerYear) : 2,
            monodonAnnualCapRatio: actualOptions.monodonAnnualCapRatio !== undefined ? Number(actualOptions.monodonAnnualCapRatio) : 0.28,
            rotateMonodonToAllModules: actualOptions.rotateMonodonToAllModules !== false,
            ...actualOptions
        };

        const hasYearCycles = Array.isArray(yearCycles) && yearCycles.length > 0;
        const hasLivePonds = Array.isArray(livePonds) && livePonds.length > 0;

        if (!hasYearCycles && !hasLivePonds) {
            return generateOptimal156WeekSchedule(masterPonds, schedulerOptions, this._state.priors);
        }

        const hybridList = [];
        const pondHas2026Cycles = new Set();
        const pondLastEndW = new Map();
        const modLastEndW = new Map();
        const rowLastEndW = new Map();

        // 2. Ingest all actual year cycles (both historical closed and current production)
        if (hasYearCycles) {
            const byPond = new Map();
            for (const c of yearCycles) {
                if (!c.pondId || !c.stckDate) continue;
                if (!byPond.has(c.pondId)) byPond.set(c.pondId, []);
                byPond.get(c.pondId).push(c);
            }

            for (const [pondId, cycles] of byPond) {
                pondHas2026Cycles.add(pondId);
                cycles.sort((a, b) => a.startWeekIndex - b.startWeekIndex);

                let prevCloseDate = null;
                for (const c of cycles) {
                    const sampling = actualSamplingMap.get(c.pondIndex);
                    const isProd = Boolean(c.isProduction);

                    let dopDays = 45;
                    if (prevCloseDate && c.stckDate) {
                        const diffMs = new Date(c.stckDate).getTime() - new Date(prevCloseDate).getTime();
                        dopDays = Math.max(14, Math.round(diffMs / (24 * 3600 * 1000)));
                    } else if (c.isCarryoverFromPrevYear) {
                        dopDays = 45;
                    }

                    if (c.dateClose) {
                        prevCloseDate = c.dateClose;
                    }

                    const startW = c.startWeekIndex;
                    let endW = c.endWeekIndex;
                    let targetFinalDoc = c.targetFinalDoc || c.docDays || (endW - startW + 1) * 7;

                    if (isProd) {
                        const proj = projectActivePondHarvestDoc(c, sampling, this._state.priors);
                        targetFinalDoc = proj.targetFinalDoc;
                        const durationWeeks = Math.max(1, Math.ceil(targetFinalDoc / 7));
                        endW = Math.min(actualHorizonWeeks, startW + durationWeeks - 1);
                    }

                    hybridList.push({
                        pondId: c.pondId,
                        pondIndex: c.pondIndex,
                        moduleId: c.moduleId,
                        areaHa: c.areaHa,
                        species: c.species,
                        geneticLine: c.geneticLine,
                        bsLine: c.bsLine,
                        stckSource: c.stckSource,
                        strategyCode: c.strategyCode || (c.species === SPECIES.MONODON ? "DS4" : "DS1"),
                        harvestPlanCount: 1,
                        stockDensityPlM2: c.stockDensityPlM2,
                        startWeekIndex: startW,
                        endWeekIndex: endW,
                        targetFinalDoc,
                        docDays: c.docDays,
                        stockMonth: c.isCarryoverFromPrevYear ? 0 : actualBaseMonth,
                        dopDays,
                        prevHadDisease: c.hasActiveDisease,
                        olderActivePondsCount: 0,
                        diseasedNeighborsCount: 0,
                        latestSampling: sampling || null,
                        isLivePondCycle: isProd,
                        isHistoricalClosed: !isProd,
                        isLocked: !isProd || (startW <= 42),
                        isCarryoverFromPrevYear: Boolean(c.isCarryoverFromPrevYear),
                        isStockedInBaseYear: Boolean(c.isStockedInBaseYear),
                        finalStatus: c.finalStatus || null
                    });

                    const curMax = pondLastEndW.get(c.pondId) || 0;
                    if (endW > curMax) pondLastEndW.set(c.pondId, endW);

                    const parts = String(c.pondId || "").split(".");
                    const modKey = String(c.moduleId || parts[0] || "").replace(/^[Mm]/, "").padStart(2, "0");
                    const modCurMax = modLastEndW.get(modKey) || 0;
                    if (endW > modCurMax) modLastEndW.set(modKey, endW);

                    const rowNo = parts[1] || "01";
                    const rowKey = `${modKey}::${rowNo}`;
                    const rowCurMax = rowLastEndW.get(rowKey) || 0;
                    if (endW > rowCurMax) rowLastEndW.set(rowKey, endW);
                }
            }
        } else if (hasLivePonds) {
            for (const live of livePonds) {
                if (!live.isProduction || live.pondStatus !== "PRODUCTION" || !live.stckDate) {
                    continue;
                }
                pondHas2026Cycles.add(live.pondId);
                const sampling = actualSamplingMap.get(live.pondIndex);
                const proj = projectActivePondHarvestDoc(live, sampling, this._state.priors);
                const targetFinalDoc = proj.targetFinalDoc;
                const durationWeeks = proj.durationWeeks;

                let liveStartW = 29;
                if (live.stckDate) {
                    const d = new Date(live.stckDate);
                    if (!isNaN(d.getTime())) {
                        const startYear = new Date(actualBaseYear, 0, 1);
                        const diffDays = Math.floor((d.getTime() - startYear.getTime()) / (24 * 3600 * 1000));
                        liveStartW = Math.max(1, Math.min(156, Math.floor(diffDays / 7) + 1));
                    }
                }
                const liveEndW = Math.min(actualHorizonWeeks, liveStartW + durationWeeks - 1);

                hybridList.push({
                    pondId: live.pondId,
                    moduleId: live.moduleId,
                    areaHa: live.areaHa,
                    species: live.species,
                    geneticLine: live.geneticLine,
                    bsLine: live.bsLine,
                    stckSource: live.stckSource,
                    strategyCode: live.strategyCode || (live.species === SPECIES.MONODON ? "DS4" : "DS1"),
                    harvestPlanCount: 1,
                    stockDensityPlM2: live.stockDensityPlM2,
                    startWeekIndex: liveStartW,
                    endWeekIndex: liveEndW,
                    targetFinalDoc,
                    docDays: live.docDays,
                    stockMonth: actualBaseMonth,
                    dopDays: 45,
                    prevHadDisease: live.hasActiveDisease,
                    olderActivePondsCount: 0,
                    diseasedNeighborsCount: 0,
                    latestSampling: sampling || null,
                    isLivePondCycle: true,
                    isLocked: true
                });
                pondLastEndW.set(live.pondId, liveEndW);
                const parts = String(live.pondId || "").split(".");
                const modKey = String(live.moduleId || parts[0] || "").replace(/^[Mm]/, "").padStart(2, "0");
                const modCurMax = modLastEndW.get(modKey) || 0;
                if (liveEndW > modCurMax) modLastEndW.set(modKey, liveEndW);

                const rowNo = parts[1] || "01";
                const rowKey = `${modKey}::${rowNo}`;
                const rowCurMax = rowLastEndW.get(rowKey) || 0;
                if (liveEndW > rowCurMax) rowLastEndW.set(rowKey, liveEndW);
            }
        }

        // Calculate each module and row's actual readiness week based on live 2026 cycles + 42-day Golden Rest
        const moduleInitialReadyWeeks = new Map();
        for (const [modKey, endW] of modLastEndW.entries()) {
            moduleInitialReadyWeeks.set(modKey, endW + 1 + restWeeks);
        }
        schedulerOptions.moduleInitialReadyWeeks = moduleInitialReadyWeeks;

        const rowInitialReadyWeeks = new Map();
        for (const [rowKey, endW] of rowLastEndW.entries()) {
            rowInitialReadyWeeks.set(rowKey, endW + 1 + restWeeks);
        }
        schedulerOptions.rowInitialReadyWeeks = rowInitialReadyWeeks;

        // Generate forward optimal plan conditioned on actual row and module readiness
        const optimalPlan = generateOptimal156WeekSchedule(masterPonds, schedulerOptions, this._state.priors);

        // 3. Append future optimal planning cycles:
        // - Future waves start after their last active/closed cycle + restWeeks
        // - Ponds currently under MAINTENANCE are excluded
        const maintenancePonds = new Set(
            (livePonds || [])
                .filter(p => p.pondStatus === "MAINTENANCE" || p.status === "MAINTENANCE")
                .map(p => p.pondId)
        );

        for (const opt of optimalPlan) {
            if (maintenancePonds.has(opt.pondId)) {
                continue;
            }

            const parts = String(opt.pondId || "").split(".");
            const modKey = String(opt.moduleId || parts[0] || "").replace(/^[Mm]/, "").padStart(2, "0");
            const rowNo = parts[1] || "01";
            const rowKey = `${modKey}::${rowNo}`;
            const rowEnd = rowLastEndW.get(rowKey) || 0;
            const pondEnd = pondLastEndW.get(opt.pondId) || 0;
            const has2026 = pondHas2026Cycles.has(opt.pondId);
            const lastEnd = Math.max(pondEnd, rowEnd);

            if (!has2026) {
                // If the row has live/closed cycles, future waves start after row readiness (rowEnd + 1 + restWeeks).
                // If the row had no live cycles at all in 2026, future waves must not be scheduled retroactively in the past.
                const minAllowedStart = rowEnd > 0 ? (rowEnd + 1 + restWeeks) : (Number(schedulerOptions.cutoffWeek) || 42);
                if (opt.startWeekIndex >= minAllowedStart) {
                    hybridList.push({
                        ...opt,
                        isLocked: false
                    });
                }
            } else {
                if (opt.startWeekIndex > lastEnd) {
                    hybridList.push({
                        ...opt,
                        isLocked: false
                    });
                }
            }
        }

        return hybridList.sort((a, b) => a.startWeekIndex - b.startWeekIndex);
    }

    // =========================================================================
    // RECALCULATION & SIMULATION ACTIONS
    // =========================================================================

    /**
     * Triggers a debounced deterministic 156-week simulation run (default 250ms).
     * Ideal for slider dragging or date inputs in UI.
     *
     * @param {number} [delayMs=250]
     */
    triggerDebouncedSimulation(delayMs = 250) {
        if (this._debounceTimer) {
            clearTimeout(this._debounceTimer);
        }
        this._debounceTimer = setTimeout(() => {
            this.runSimulationImmediate();
        }, delayMs);
    }

    runSimulationDebounced(delayMs = 250) {
        return this.triggerDebouncedSimulation(delayMs);
    }

    /**
     * Immediately executes the 156-week deterministic simulation and emits results.
     *
     * @returns {Object} Full simulation results
     */
    runSimulationImmediate() {
        if (this._debounceTimer) {
            clearTimeout(this._debounceTimer);
            this._debounceTimer = null;
        }

        const tStart = typeof performance !== "undefined" ? performance.now() : Date.now();
        this._state.status.isSimulating = true;

        try {
            const simResult = run156WeekSimulation({
                scheduledCycles: this._state.scheduledCycles,
                horizonWeeks: this._state.scenarioMetadata.horizonWeeks,
                baseYear: this._state.scenarioMetadata.baseYear,
                baseMonth: this._state.scenarioMetadata.baseMonth,
                shocks: this._state.shocks
            }, this._state.priors);

            this._state.simulationResult = simResult;
            const tEnd = typeof performance !== "undefined" ? performance.now() : Date.now();
            this._state.status.lastSimulationDurationMs = Number((tEnd - tStart).toFixed(1));
            this._state.status.lastSimulatedAt = new Date().toISOString();

            this.emit("simulationCompleted", simResult);
            return simResult;
        } catch (err) {
            console.error("SimulationStore.runSimulationImmediate error:", err);
            throw err;
        } finally {
            this._state.status.isSimulating = false;
        }
    }

    /**
     * Executes the on-demand correlated Monte Carlo risk analysis (50-100 iterations)
     * and emits P10, P50, and P90 confidence bands.
     *
     * @param {number} [iterations=100]
     * @param {Object} [options={}]
     * @returns {Object} Monte Carlo results
     */
    runMonteCarlo(iterations = 100, options = {}) {
        this._state.status.isMonteCarloRunning = true;
        this.emit("loadingStateChanged", { isMonteCarloRunning: true });

        try {
            const mcResult = runCorrelatedMonteCarlo({
                scheduledCycles: this._state.scheduledCycles,
                horizonWeeks: this._state.scenarioMetadata.horizonWeeks,
                baseYear: this._state.scenarioMetadata.baseYear,
                baseMonth: this._state.scenarioMetadata.baseMonth,
                shocks: this._state.shocks
            }, this._state.priors, {
                iterations,
                seed: options.seed || Date.now(),
                targetYieldMt: options.targetYieldMt || 1500,
                targetEbitdaRM: options.targetEbitdaRM || 10000000
            });

            this._state.monteCarloResult = mcResult;
            this.emit("monteCarloCompleted", mcResult);
            return mcResult;
        } catch (err) {
            console.error("SimulationStore.runMonteCarlo error:", err);
            throw err;
        } finally {
            this._state.status.isMonteCarloRunning = false;
            this.emit("loadingStateChanged", { isMonteCarloRunning: false });
        }
    }

    // =========================================================================
    // SCHEDULE EDIT ACTIONS
    // =========================================================================

    /**
     * Updates an individual pond cycle in the schedule and triggers debounced simulation.
     *
     * @param {string} pondId
     * @param {number} cycleIndexInPond 0-indexed cycle for that pond
     * @param {Object} updates Key-value updates
     */
    updateCycle(pondId, cycleIndexInPond, updates = {}) {
        const pondCycles = this._state.scheduledCycles.filter(c => c.pondId === pondId);
        if (cycleIndexInPond < 0 || cycleIndexInPond >= pondCycles.length) return;

        const targetCycle = pondCycles[cycleIndexInPond];
        Object.assign(targetCycle, updates);

        this.emit("scheduleChanged", { pondId, cycleIndexInPond, updates });
        this.triggerDebouncedSimulation(250);
    }

    /**
     * Adds a new cycle to the schedule and triggers debounced simulation.
     *
     * @param {Object} newCycle
     */
    addCycle(newCycle) {
        if (!newCycle || !newCycle.pondId) return;
        this._state.scheduledCycles.push(newCycle);
        this.emit("scheduleChanged", { added: newCycle });
        this.triggerDebouncedSimulation(250);
    }

    /**
     * Removes an individual cycle from the schedule.
     *
     * @param {string} pondId
     * @param {number} cycleIndexInPond
     */
    removeCycle(pondId, cycleIndexInPond) {
        const pondCycles = this._state.scheduledCycles.filter(c => c.pondId === pondId);
        if (cycleIndexInPond < 0 || cycleIndexInPond >= pondCycles.length) return;

        const target = pondCycles[cycleIndexInPond];
        const idx = this._state.scheduledCycles.indexOf(target);
        if (idx >= 0) {
            this._state.scheduledCycles.splice(idx, 1);
            this.emit("scheduleChanged", { removed: target });
            this.triggerDebouncedSimulation(250);
        }
    }

    /**
     * Atomically replaces the entire schedule of cycles.
     * Encapsulates state updates, emits change event, and optionally triggers debounced simulation.
     *
     * @param {Array<Object>} cycles
     * @param {Object} [options={}]
     * @param {boolean} [options.triggerSimulation=true]
     * @param {number} [options.delayMs=250]
     */
    setScheduledCycles(cycles = [], options = {}) {
        this._state.scheduledCycles = Array.isArray(cycles) ? cycles : [];
        this.emit("scheduleChanged", { count: this._state.scheduledCycles.length });
        if (options.triggerSimulation !== false) {
            this.triggerDebouncedSimulation(options.delayMs || 250);
        }
    }

    /**
     * 1-Click Auto-Optimizer: Re-generates all future cycles using `generateOptimal156WeekSchedule`,
     * keeping currently active ponds intact!
     *
     * @param {Object} [options={}]
     */
    autoOptimizeAll(options = {}) {
        const masterPonds = this._state.masterPonds;
        const livePonds = this._state.liveActivePonds;
        const horizonWeeks = this._state.scenarioMetadata.horizonWeeks;
        const baseYear = this._state.scenarioMetadata.baseYear;
        const baseMonth = this._state.scenarioMetadata.baseMonth;
        const yearCycles = this._state.yearCycles || [];
        const samplingMap = this._state.samplingMap || new Map();

        this._state.scheduledCycles = this._constructHybridSchedule(
            masterPonds,
            livePonds,
            yearCycles,
            samplingMap,
            horizonWeeks,
            baseYear,
            baseMonth,
            options
        );

        this.emit("scheduleChanged", { autoOptimized: true });
        this.runSimulationImmediate();
    }

    autoOptimizeSchedule(options = {}) {
        return this.autoOptimizeAll(options);
    }

    // =========================================================================
    // WAR ROOM DISRUPTION SHOCK ACTIONS
    // =========================================================================

    /**
     * Injects a time-scoped disruption shock into the active scenario.
     *
     * @param {Object} shock `TemporalShockEvent`
     */
    injectShock(shock) {
        if (!shock || !shock.id) return;
        const existingIdx = this._state.shocks.findIndex(s => s.id === shock.id);
        if (existingIdx >= 0) {
            this._state.shocks[existingIdx] = shock;
        } else {
            this._state.shocks.push(shock);
        }
        this.emit("shocksChanged", this._state.shocks);
        this.triggerDebouncedSimulation(200);
    }

    /**
     * Removes an active disruption shock by ID.
     *
     * @param {string} shockId
     */
    removeShock(shockId) {
        this._state.shocks = this._state.shocks.filter(s => s.id !== shockId);
        this.emit("shocksChanged", this._state.shocks);
        this.triggerDebouncedSimulation(200);
    }

    /**
     * Clears all active disruption shocks.
     */
    clearAllShocks() {
        this._state.shocks = [];
        this.emit("shocksChanged", this._state.shocks);
        this.triggerDebouncedSimulation(150);
    }

    // =========================================================================
    // SCENARIO PERSISTENCE (LocalStorage Only)
    // =========================================================================

    /**
     * Saves the current schedule and shocks as a named scenario into browser localStorage.
     *
     * @param {string} name
     * @param {string} [description=""]
     * @returns {Object} Saved scenario header
     */
    saveCurrentScenario(name, description = "") {
        const scenario = {
            id: this._state.scenarioMetadata.id,
            name: name || this._state.scenarioMetadata.name,
            description: description || this._state.scenarioMetadata.description,
            baseYear: this._state.scenarioMetadata.baseYear,
            baseMonth: this._state.scenarioMetadata.baseMonth,
            horizonWeeks: this._state.scenarioMetadata.horizonWeeks,
            scheduledCycles: this._state.scheduledCycles,
            shocks: this._state.shocks
        };

        const saved = SimulationRepository.saveScenario(scenario);
        this._state.scenarioMetadata.id = saved.id;
        this._state.scenarioMetadata.name = saved.name;
        this._state.scenarioMetadata.description = saved.description;

        this.emit("scenarioLoaded", this._state.scenarioMetadata);
        return saved;
    }

    /**
     * Loads a saved scenario by ID from browser localStorage.
     *
     * @param {string} scenarioId
     * @returns {boolean} True if loaded
     */
    loadScenario(scenarioId) {
        const record = SimulationRepository.getScenario(scenarioId);
        if (!record) return false;

        this._state.scenarioMetadata = {
            id: record.id,
            name: record.name,
            description: record.description || "",
            baseYear: record.baseYear || 2026,
            baseMonth: record.baseMonth || 1,
            horizonWeeks: record.horizonWeeks || 156
        };
        this._state.scheduledCycles = record.scheduledCycles || [];
        this._state.shocks = record.shocks || [];

        this.emit("scenarioLoaded", this._state.scenarioMetadata);
        this.runSimulationImmediate();
        return true;
    }

    /**
     * 1-Click 'Sync Live Farm Data' Button Action:
     * Refreshes active pond records and latest biometrics samplings from Supabase
     * without wiping out forward schedule edits.
     *
     * @returns {Promise<number>} Count of active ponds synced
     */
    async syncLiveFarmData() {
        this._setLoading(true);
        try {
            const livePonds = await SimulationRepository.fetchActivePonds();
            this._state.liveActivePonds = livePonds;

            const prodIndices = livePonds.filter(p => p.isProduction && p.pondIndex).map(p => p.pondIndex);
            const samplingMap = await SimulationRepository.fetchLatestSamplingsForPonds(prodIndices);

            // Update live pond cycles in the schedule with latest samplings
            let updatedCount = 0;
            for (const cyc of this._state.scheduledCycles) {
                if (cyc.isLivePondCycle) {
                    const match = livePonds.find(p => p.pondId === cyc.pondId);
                    if (match) {
                        const smpl = samplingMap.get(match.pondIndex);
                        if (smpl) {
                            cyc.latestSampling = smpl;
                            updatedCount += 1;
                        }
                    }
                }
            }

            this.emit("syncCompleted", { updatedCount, totalActivePonds: livePonds.length });
            this.runSimulationImmediate();
            return updatedCount;
        } catch (err) {
            console.error("SimulationStore.syncLiveFarmData error:", err);
            throw err;
        } finally {
            this._setLoading(false);
        }
    }

    // =========================================================================
    // INTERNAL HELPERS
    // =========================================================================

    _setLoading(isLoading) {
        this._state.status.isLoading = Boolean(isLoading);
        this.emit("loadingStateChanged", this._state.status);
    }
}

// Global Singleton Export (standard appState pattern)
export const simulationStore = new SimulationStore();
