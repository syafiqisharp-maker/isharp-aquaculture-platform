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

            // Fetch physical ponds & live operational cycles
            const [masterPonds, livePonds, actuals] = await Promise.all([
                SimulationRepository.fetchMasterPondsList(),
                SimulationRepository.fetchActivePonds(),
                SimulationRepository.fetchActualMonthlyHarvests(baseYear)
            ]);

            this._state.masterPonds = masterPonds;
            this._state.liveActivePonds = livePonds;
            this._state.actualMonths = actuals;

            // Fetch latest samplings for active production ponds
            const prodPondIndices = livePonds.filter(p => p.isProduction && p.pondIndex).map(p => p.pondIndex);
            const samplingMap = await SimulationRepository.fetchLatestSamplingsForPonds(prodPondIndices);

            // Construct the Hybrid Schedule
            this._state.scheduledCycles = this._constructHybridSchedule(
                masterPonds,
                livePonds,
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
     * - Retains live active/production ponds with their exact real DOC and latest samplings.
     * - Uses `generateOptimal156WeekSchedule` to project optimal future cycles across all ponds.
     */
    _constructHybridSchedule(masterPonds, livePonds, samplingMap, horizonWeeks, baseYear, baseMonth) {
        // 1. Generate full benchmark 156-week optimal schedule
        const optimalPlan = generateOptimal156WeekSchedule(masterPonds, {
            horizonWeeks,
            baseYear,
            baseMonth,
            restWeeks: 6
        }, this._state.priors);

        if (!livePonds || livePonds.length === 0) {
            return optimalPlan;
        }

        const hybridList = [];
        const livePondIds = new Set();

        // 2. Add currently active/production ponds as Cycle 1
        for (const live of livePonds) {
            livePondIds.add(live.pondId);
            const sampling = samplingMap.get(live.pondIndex);
            const currentDoc = Math.max(1, live.docDays || 1);
            const remainingDoc = Math.max(14, (live.species === SPECIES.MONODON ? 112 : 92) - currentDoc);
            const durationWeeks = Math.ceil(remainingDoc / 7);

            hybridList.push({
                pondId: live.pondId,
                moduleId: live.moduleId,
                areaHa: live.areaHa,
                species: live.species,
                geneticLine: live.geneticLine,
                bsLine: live.bsLine,
                stckSource: live.stckSource,
                strategyCode: live.species === SPECIES.MONODON ? "DS4" : "DS1",
                harvestPlanCount: 1,
                stockDensityPlM2: live.stockDensityPlM2,
                startWeekIndex: 1, // Currently ongoing
                endWeekIndex: Math.min(horizonWeeks, 1 + durationWeeks),
                targetFinalDoc: currentDoc + remainingDoc,
                stockMonth: baseMonth,
                dopDays: 45,
                prevHadDisease: live.hasActiveDisease,
                olderActivePondsCount: 0,
                diseasedNeighborsCount: 0,
                latestSampling: sampling || null,
                isLivePondCycle: true
            });
        }

        // 3. For all future cycles, append optimal cycles starting after current live cycle closes (+6 weeks Golden Rest)
        for (const opt of optimalPlan) {
            if (!livePondIds.has(opt.pondId)) {
                hybridList.push(opt);
            } else if (opt.startWeekIndex >= 18) {
                // Future cycles on live ponds after initial crop finishes
                hybridList.push(opt);
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

        const emptySamplingMap = new Map();
        this._state.scheduledCycles = this._constructHybridSchedule(
            masterPonds,
            livePonds,
            emptySamplingMap,
            horizonWeeks,
            baseYear,
            baseMonth
        );

        this.emit("scheduleChanged", { autoOptimized: true });
        this.runSimulationImmediate();
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
