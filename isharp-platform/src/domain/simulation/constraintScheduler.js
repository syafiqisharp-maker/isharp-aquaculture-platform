/**
 * iSHARP DBMS 2.0 — Frontier Simulation Engine (Phase 3)
 * Module: constraintScheduler.js
 *
 * PURE DOMAIN MODULE (Zero DOM dependencies, Zero network/fetch calls).
 *
 * Responsibilities:
 * 1. `auditScheduleRisks`: Scans any 156-week pond schedule and flags violations of the
 *    5-Pillar Empirical Laws (Rushed DOP, Staggered Module Overlap, Species-Module Mismatch in M08/M09,
 *    Monsoon Stocking Cliff, Multi-Hatchery Tank Mixing Overflow, and Density Overcrowding).
 * 2. `generateOptimal156WeekSchedule`: Automatically constructs a 156-week (3-Year) All-In/All-Out,
 *    Golden-Rest, Species-Matched, Tier-1 Hatchery-Balanced rolling plan across M01-M11.
 */

import {
    SPECIES,
    CULTURE_STRATEGIES,
    DEFAULT_EMPIRICAL_PRIORS,
    classifySpecies
} from "./baselineCalibrator.js";
import { normalizeModuleKey } from "./hazardAndGrowthModel.js";

/**
 * Converts a simulation week index (`1..156`) and base start year/month into `{ year, month, weekOfYear }`.
 *
 * @param {number} weekIndex 1..156
 * @param {number} [baseYear=2026]
 * @param {number} [baseMonth=1] 1..12
 * @returns {{ year: number, month: number, weekOfYear: number }}
 */
export function weekIndexToCalendar(weekIndex, baseYear = 2026, baseMonth = 1) {
    const wZero = Math.max(0, Math.round(Number(weekIndex) || 1) - 1);
    const totalDays = (baseMonth - 1) * 30.4375 + wZero * 7;
    const yearOffset = Math.floor(totalDays / 365.25);
    const dayOfYear = totalDays - yearOffset * 365.25;
    const month = Math.max(1, Math.min(12, Math.floor(dayOfYear / 30.4375) + 1));
    const weekOfYear = Math.max(1, Math.min(52, (wZero % 52) + 1));

    return {
        year: baseYear + yearOffset,
        month,
        weekOfYear
    };
}

/**
 * Audits a list of scheduled pond cycles across the 156-week horizon and returns
 * structured warnings/violations based on the 5-Pillar Empirical Rules.
 *
 * @param {Array<Object>} scheduledCycles
 * @param {Object} [options={}]
 * @param {number} [options.baseYear=2026]
 * @param {number} [options.baseMonth=1]
 * @param {Object} [priors=DEFAULT_EMPIRICAL_PRIORS]
 * @returns {Object} `{ totalAlerts, alertsByCategory, alerts,annotatedCycles }`
 */
export function auditScheduleRisks(
    scheduledCycles = [],
    options = {},
    priors = DEFAULT_EMPIRICAL_PRIORS
) {
    if (!Array.isArray(scheduledCycles) || scheduledCycles.length === 0) {
        return { totalAlerts: 0, alertsByCategory: {}, alerts: [], annotatedCycles: [] };
    }

    const baseYear = Number(options.baseYear) || 2026;
    const baseMonth = Number(options.baseMonth) || 1;
    const singleHatcheryCap =
        priors.broodstockAndHatcheryEffects.hatcheryTiers.TIER_1_SINGLE.monthlyCapacityPondsPerHatchery || 28;

    // Sort cycles chronologically
    const sorted = scheduledCycles.map((c, idx) => {
        const startW = Math.max(1, Number(c.startWeekIndex) || 1);
        const cal = weekIndexToCalendar(startW, baseYear, baseMonth);
        const stockMonth = Number(c.stockMonth) || cal.month;
        const species = classifySpecies({
            species: c.species,
            plType: c.plType,
            bsLine: c.bsLine,
            strategy: c.strategyCode,
            stockDensity: c.stockDensityPlM2
        });
        const strategy = CULTURE_STRATEGIES[c.strategyCode] || CULTURE_STRATEGIES.DS1;
        const docDays = Number(c.targetFinalDoc) ||
            (species === SPECIES.MONODON ? 112 : strategy.targetFinalDoc);
        const durationWeeks = Math.max(5, Math.ceil(docDays / 7));
        const endW = startW + durationWeeks - 1;

        return {
            ...c,
            _idx: idx,
            pondId: c.pondId || `P-${idx + 1}`,
            moduleKey: normalizeModuleKey(c.moduleId || c.pondId || "M01"),
            species,
            startWeekIndex: startW,
            endWeekIndex: endW,
            targetFinalDoc: docDays,
            calendarYear: cal.year,
            stockMonth,
            yearMonthKey: `${cal.year}-${String(stockMonth).padStart(2, "0")}`,
            stckSource: String(c.stckSource || (species === SPECIES.MONODON ? "KSK" : "SHT")).toUpperCase().trim()
        };
    }).sort((a, b) => a.startWeekIndex - b.startWeekIndex);

    // Track per-pond consecutive cycles for DOP calculation
    const byPond = new Map();
    // Track monthly hatchery demand: key = `${yearMonthKey}::${stckSource}`
    const hatcheryMonthlyCounts = new Map();

    for (const c of sorted) {
        if (!byPond.has(c.pondId)) byPond.set(c.pondId, []);
        byPond.get(c.pondId).push(c);

        const hKey = `${c.yearMonthKey}::${c.stckSource}`;
        hatcheryMonthlyCounts.set(hKey, (hatcheryMonthlyCounts.get(hKey) || 0) + 1);
    }

    const alerts = [];
    const alertsByCategory = {
        RUSHED_TURNAROUND: 0,
        STAGGERED_MODULE_OVERLAP: 0,
        SPECIES_MODULE_MISMATCH: 0,
        MONSOON_CLIFF_EXPOSURE: 0,
        HATCHERY_MIXING_OVERFLOW: 0,
        OVERCROWDED_DENSITY: 0
    };

    const pushAlert = (category, severity, cycle, message) => {
        alertsByCategory[category] = (alertsByCategory[category] || 0) + 1;
        alerts.push({
            category,
            severity,
            pondId: cycle.pondId,
            moduleKey: cycle.moduleKey,
            startWeekIndex: cycle.startWeekIndex,
            yearMonth: cycle.yearMonthKey,
            message
        });
    };

    for (const c of sorted) {
        // 1. Compute DOP from previous cycle on same pond if not explicitly provided
        const pondHistory = byPond.get(c.pondId) || [];
        const pos = pondHistory.indexOf(c);
        if (pos > 0 && c.dopDays === undefined) {
            const prev = pondHistory[pos - 1];
            const idleWeeks = Math.max(0, c.startWeekIndex - prev.endWeekIndex - 1);
            c.dopDays = idleWeeks * 7;
            if (prev.prevHadDisease !== undefined && c.prevHadDisease === undefined) {
                c.prevHadDisease = prev.prevHadDisease;
            }
        } else if (c.dopDays === undefined) {
            c.dopDays = 45;
        }

        // Check Rule 1: Rushed Turnaround (Pillar 1)
        if (c.dopDays <= 20 || (c.prevHadDisease && c.dopDays < 36)) {
            pushAlert(
                "RUSHED_TURNAROUND",
                "HIGH",
                c,
                `Pond ${c.pondId} has only ${c.dopDays}d idle turnaround${c.prevHadDisease ? " after disease" : ""} (Golden Rest is 36-60d).`
            );
        }

        // 2. Check Rule 2: Staggered Module Overlap (Pillar 2)
        const olderActiveInModule = sorted.filter(
            other =>
                other !== c &&
                other.moduleKey === c.moduleKey &&
                other.startWeekIndex <= c.startWeekIndex - 4 && // >25 days older
                other.endWeekIndex >= c.startWeekIndex
        ).length;
        c.olderActivePondsCount = olderActiveInModule;

        if (olderActiveInModule > 0) {
            pushAlert(
                "STAGGERED_MODULE_OVERLAP",
                olderActiveInModule > 5 ? "HIGH" : "MEDIUM",
                c,
                `Pond ${c.pondId} stocked into Module ${c.moduleKey} while ${olderActiveInModule} older ponds (>25d DOC) are already active (violates All-In/All-Out).`
            );
        }

        // 3. Check Rule 3: Species-Module Mismatch in M08 & M09 (Pillar 2)
        if (c.species === SPECIES.VANNAMEI && (c.moduleKey === "08" || c.moduleKey === "09")) {
            pushAlert(
                "SPECIES_MODULE_MISMATCH",
                "HIGH",
                c,
                `Pond ${c.pondId} in Module ${c.moduleKey} is scheduled with VANNAMEI (historical M${c.moduleKey} Vannamei EBITDA is near zero vs >RM 32k/pond with P. Monodon).`
            );
        }

        // 4. Check Rule 4: Monsoon Cliff Exposure (Pillar 3)
        const isElevatedModule = c.moduleKey === "01" || c.moduleKey === "02" || c.moduleKey === "03";
        if (c.species === SPECIES.MONODON && c.stockMonth >= 8 && c.stockMonth <= 11) {
            pushAlert(
                "MONSOON_CLIFF_EXPOSURE",
                "HIGH",
                c,
                `Monodon stocked in Month ${c.stockMonth} (${c.yearMonthKey}) grows directly into the Setiu Northeast Monsoon (historical Sep-Oct EBITDA: -RM 9k to -RM 18k/pond).`
            );
        } else if (c.species === SPECIES.VANNAMEI && (c.stockMonth === 11 || c.stockMonth === 12) && !isElevatedModule) {
            pushAlert(
                "MONSOON_CLIFF_EXPOSURE",
                "MEDIUM",
                c,
                `Vannamei stocked in peak monsoon Month ${c.stockMonth} (${c.yearMonthKey}) in low-elevation Module ${c.moduleKey} faces flood inundation and forced harvest risk.`
            );
        }

        // 5. Check Rule 5: Hatchery Mixing / Single-Hatchery Capacity Overflow (Pillar 3)
        const hKey = `${c.yearMonthKey}::${c.stckSource}`;
        const monthlyHatcheryCount = hatcheryMonthlyCounts.get(hKey) || 1;
        c.monthlyLinePondsCount = monthlyHatcheryCount;

        if (/[,/+&]/.test(c.stckSource) || monthlyHatcheryCount > singleHatcheryCap) {
            pushAlert(
                "HATCHERY_MIXING_OVERFLOW",
                "HIGH",
                c,
                `Hatchery source '${c.stckSource}' in ${c.yearMonthKey} (${monthlyHatcheryCount} ponds) triggers multi-hatchery tank mixing risk (>28 ponds/month single-hatchery cap).`
            );
        }

        // 6. Check Rule 6: Density Overcrowding (Pillar 4)
        const sd = Number(c.stockDensityPlM2) || (c.species === SPECIES.MONODON ? 45 : 95);
        if ((c.species === SPECIES.VANNAMEI && sd >= 130) || (c.species === SPECIES.MONODON && sd > 58)) {
            pushAlert(
                "OVERCROWDED_DENSITY",
                "HIGH",
                c,
                `Pond ${c.pondId} density (${sd} PL/m2) exceeds biological carrying capacity threshold.`
            );
        }
    }

    return {
        totalAlerts: alerts.length,
        alertsByCategory,
        alerts,
        annotatedCycles: sorted
    };
}

/**
 * Generates an EBITDA-Optimized 156-Week (3-Year) Rolling Schedule across the provided ponds,
 * strictly enforcing:
 * 1. Target 2.0 Cycles / Year Aim (Guideline with adaptive horizon flexing for prolonged crops)
 * 2. Golden Rest Turnaround (`42 days` / `6 weeks` idle between cycles; minimum 35 days)
 * 3. Synchronized All-In / All-Out Module Waves with Row-Level Species Homogeneity (Zero pond-autonomous chaos)
 * 4. Species-Module Matching & Supervisor Equity Rotation ("All Modules Get a Taste" of Monodon while staying <=30% annual seed cap)
 * 5. Northeast Monsoon Cliff Avoidance (Monodon skips Aug-Nov; low-elevation Vannamei skips Nov-Dec; M01-M03 uses hardy SPR DS2)
 * 6. Clean Tier-1 Single-Hatchery Rotation (`SHT`, `CPD`, `KSK`, `UBN` capped at <=28 ponds/month each)
 *
 * @param {Array<Object>} pondsMasterList Array of `{ pondId, moduleId, areaHa }`
 * @param {Object} [options={}]
 * @param {number} [options.horizonWeeks=156]
 * @param {number} [options.baseYear=2026]
 * @param {number} [options.baseMonth=1]
 * @param {number} [options.restWeeks=6] 6 weeks = 42 days Golden Rest
 * @param {Array<string>} [options.monodonModules=["08", "09", "05"]]
 * @param {string} [options.vannameiDefaultStrategy="DS2"] 2X Partial Harvest strategy
 * @param {number} [options.targetCyclesPerYear=2] Aim for 2 cycles/year per pond
 * @param {number} [options.monodonAnnualCapRatio=0.30] Farm-wide 20%-30% annual Monodon PL seed cap
 * @param {Object} [priors=DEFAULT_EMPIRICAL_PRIORS]
 * @returns {Array<Object>} Optimized 156-week pond cycle schedule
 */
export function generateOptimal156WeekSchedule(
    pondsMasterList = [],
    options = {},
    priors = DEFAULT_EMPIRICAL_PRIORS
) {
    const horizonWeeks = Math.max(12, Number(options.horizonWeeks) || 156);
    const baseYear = Number(options.baseYear) || 2026;
    const baseMonth = Number(options.baseMonth) || 1;
    const restWeeks = Math.max(6, Number(options.restWeeks) || 6); // 6 weeks = 42d Golden Rest
    const monodonPriorityMods = new Set((options.monodonModules || ["08", "09", "05"]).map(normalizeModuleKey));
    const elevatedMods = new Set((options.elevatedModules || ["01", "02", "03"]).map(normalizeModuleKey));
    const vanStrategyCode = options.vannameiDefaultStrategy || "DS2";
    const maxPondsPerMonth = Number(options.maxPondsPerMonth) || 50;
    const targetCyclesPerYear = Number(options.targetCyclesPerYear) || 2;
    const monodonAnnualCapRatio = Number(options.monodonAnnualCapRatio) || 0.30;
    const rotateMonodonToAllModules = options.rotateMonodonToAllModules !== false;

    // Group ponds by module so each module operates as a synchronized All-In / All-Out wave
    const pondsByMod = new Map();
    for (const p of pondsMasterList) {
        if (p.pondStatus === "MAINTENANCE") continue;
        const modKey = normalizeModuleKey(p.moduleId || p.pondId || "M01");
        if (!pondsByMod.has(modKey)) pondsByMod.set(modKey, []);
        pondsByMod.get(modKey).push({
            pondId: p.pondId || `${modKey}-P01`,
            moduleId: modKey,
            areaHa: Number(p.areaHa) || 0.5
        });
    }

    const tier1VannameiHatcheries = ["SHT", "CPD"];
    const tier1MonodonHatcheries = ["KSK", "UBN"];
    const scheduledCycles = [];

    // In any calendar year, farm-wide Monodon seed cannot exceed 20%-30% of farm capacity
    // For 240-pond farm with ~336 annual cycles, ~28% ceiling is ~96 ponds (4 module waves per year)
    const farmActivePonds = Math.max(pondsMasterList.length, 24);
    const maxAnnualMonodonPonds = Math.max(24, Math.round(farmActivePonds * 1.4 * monodonAnnualCapRatio));

    // Track monthly stocking count across all modules: "YYYY-MM" => count (capped at maxPondsPerMonth)
    const monthlyStockings = new Map();
    // Track monthly Monodon module count: "YYYY-MM" => count (capped at 1 module/month to prevent single-hatchery overflow)
    const monthlyMonodonModules = new Map();
    // Track annual farm-wide stocking statistics: year => { totalPonds: 0, monodonPonds: 0 }
    const annualFarmStats = new Map();

    const getMonthKey = (weekIdx) => {
        const cal = weekIndexToCalendar(weekIdx, baseYear, baseMonth);
        return `${cal.year}-${String(cal.month).padStart(2, "0")}`;
    };

    const getMonthPondCount = (weekIdx) => {
        const key = getMonthKey(weekIdx);
        return monthlyStockings.get(key) || 0;
    };

    const addMonthPonds = (weekIdx, count) => {
        const key = getMonthKey(weekIdx);
        monthlyStockings.set(key, (monthlyStockings.get(key) || 0) + count);
    };

    const getAnnualStats = (year) => {
        if (!annualFarmStats.has(year)) {
            annualFarmStats.set(year, { totalPonds: 0, monodonPonds: 0 });
        }
        return annualFarmStats.get(year);
    };

    // Initialize module tracking state for FIFO queue
    const initialReadyMap = options.moduleInitialReadyWeeks instanceof Map 
        ? options.moduleInitialReadyWeeks 
        : (options.moduleInitialReadyWeeks ? new Map(Object.entries(options.moduleInitialReadyWeeks)) : null);

    const sortedModKeys = Array.from(pondsByMod.keys()).sort();
    const moduleStates = sortedModKeys
        .filter(m => m !== "11") // Skip nursery trial module M11 unless explicitly requested
        .map((modKey, idx) => {
            const initialReady = initialReadyMap ? initialReadyMap.get(modKey) : null;
            return {
                modKey,
                modPonds: pondsByMod.get(modKey),
                nextReadyWeek: (initialReady !== null && initialReady !== undefined) ? Number(initialReady) : (1 + (idx % 6) * 2), // Stagger across weeks 1, 3, 5, 7, 9, 11 if fresh
                waveCounter: 0,
                annualCycleCounts: new Map(), // year => number of cycles stocked in that calendar year
                annualMonodonCycles: new Map(), // year => number of Monodon cycles stocked in that calendar year
                monodonWaveCount: 0,          // total Monodon waves conducted by this module
                isPriorityMonodon: monodonPriorityMods.has(modKey),
                isElevated: elevatedMods.has(modKey)
            };
        });

    // Step through timeline by weeks
    let currentWeek = 1;
    while (currentWeek <= horizonWeeks - 10) {
        // Find modules ready to stock (FIFO: lowest nextReadyWeek <= currentWeek)
        const readyModules = moduleStates
            .filter(m => m.nextReadyWeek <= currentWeek)
            .sort((a, b) => a.nextReadyWeek - b.nextReadyWeek);

        if (readyModules.length === 0) {
            currentWeek += 1;
            continue;
        }

        for (const mState of readyModules) {
            const cal = weekIndexToCalendar(currentWeek, baseYear, baseMonth);
            const stockYear = cal.year;
            const stockMonth = cal.month;
            const monthKey = getMonthKey(currentWeek);
            const isElevated = mState.isElevated;
            const pondsToStock = mState.modPonds.length;
            const cyclesInCurrentYear = mState.annualCycleCounts.get(stockYear) || 0;

            // -------------------------------------------------------------
            // Rule 1: Target 2.0 Cycles/Year Aim & Prolonged Crop Adaptive Horizon
            // -------------------------------------------------------------
            // If this module has already completed target cycles (2) in this calendar year:
            // Squeezing a 3rd cycle late in the year (after Month 7) risks monsoon harvest or rushes prep.
            if (cyclesInCurrentYear >= targetCyclesPerYear && stockMonth >= 8) {
                // Postpone this module to Week 1 / Q1 of the next calendar year
                let nextYearWeek = currentWeek + 1;
                while (nextYearWeek <= horizonWeeks && weekIndexToCalendar(nextYearWeek, baseYear, baseMonth).year === stockYear) {
                    nextYearWeek++;
                }
                mState.nextReadyWeek = nextYearWeek;
                continue;
            }

            // If Cycle 1 was prolonged and finished late into September/October (Months 9-10) for non-elevated module:
            // Stocking Cycle 2 would push harvest directly into the Nov-Dec monsoon crash.
            // Adapt: let the pond rest with extended restorative dry-out, rolling to Q1 next year.
            if (cyclesInCurrentYear >= 1 && (stockMonth === 9 || stockMonth === 10) && !isElevated) {
                let nextYearWeek = currentWeek + 1;
                while (nextYearWeek <= horizonWeeks && weekIndexToCalendar(nextYearWeek, baseYear, baseMonth).year === stockYear) {
                    nextYearWeek++;
                }
                mState.nextReadyWeek = nextYearWeek;
                continue;
            }

            // -------------------------------------------------------------
            // Rule 2: Species Selection (Prioritization + Supervisor Equity Rotation + <=30% Cap)
            // -------------------------------------------------------------
            const isMonodonSeasonSafe = (stockMonth >= 1 && stockMonth <= 7);
            const yrStats = getAnnualStats(stockYear);
            const isWithinAnnualCap = (yrStats.monodonPonds + pondsToStock <= maxAnnualMonodonPonds);
            const monodonInMonth = monthlyMonodonModules.get(monthKey) || 0;

            let shouldStockMonodon = false;

            if (isMonodonSeasonSafe) {
                if (mState.modKey === "08" || mState.modKey === "09") {
                    // M08 and M09 must always be Monodon. If another module already stocked Monodon this month, shift to next month
                    if (monodonInMonth >= 1) {
                        let shiftWeeks = 1;
                        while (getMonthKey(currentWeek + shiftWeeks) === monthKey) {
                            shiftWeeks++;
                        }
                        mState.nextReadyWeek = currentWeek + shiftWeeks;
                        continue;
                    }
                    shouldStockMonodon = true;
                } else if (isWithinAnnualCap && monodonInMonth === 0) {
                    const alreadyStockedMonodonThisYear = (mState.annualMonodonCycles.get(stockYear) || 0) > 0;
                    if (!alreadyStockedMonodonThisYear) {
                        const reservedForChampions = moduleStates
                            .filter(m => (m.modKey === "08" || m.modKey === "09") && (m.annualMonodonCycles.get(stockYear) || 0) === 0)
                            .reduce((acc, m) => acc + m.modPonds.length, 0);

                        if (yrStats.monodonPonds + pondsToStock + reservedForChampions <= maxAnnualMonodonPonds) {
                            const minWavesAcrossModules = Math.min(...moduleStates.map(m => m.monodonWaveCount));
                            if (rotateMonodonToAllModules && (mState.monodonWaveCount <= minWavesAcrossModules || mState.monodonWaveCount === 0)) {
                                shouldStockMonodon = true;
                            } else if (mState.isPriorityMonodon && mState.monodonWaveCount < 2) {
                                shouldStockMonodon = true;
                            }
                        }
                    }
                }
            }

            // -------------------------------------------------------------
            // Rule 3: Monsoon Cliff Protection
            // -------------------------------------------------------------
            // 1. Monodon: CANNOT stock in Aug-Nov (Months 8..11)
            if (shouldStockMonodon && stockMonth >= 8 && stockMonth <= 11) {
                mState.nextReadyWeek = currentWeek + 4;
                continue;
            }

            // 2. Vannamei:
            // Low-elevation modules (M04-M10): CANNOT stock in Nov-Dec (Months 11..12) peak flood risk
            if (!shouldStockMonodon && !isElevated && (stockMonth === 11 || stockMonth === 12)) {
                mState.nextReadyWeek = currentWeek + 4;
                continue;
            }

            // 3. Elevated modules (M01-M03): CAN stock in monsoon (Months 10..12), switching to hardy SPR DS2
            const isMonsoonStocking = isElevated && (stockMonth >= 10 && stockMonth <= 12);
            let strategyCode = shouldStockMonodon ? "DS4" : (isMonsoonStocking ? "DS2" : vanStrategyCode);
            let species = shouldStockMonodon ? SPECIES.MONODON : SPECIES.VANNAMEI;

            // -------------------------------------------------------------
            // Rule 4: Monthly Stocking Quota (<=50 Ponds/Month Farm-Wide)
            // -------------------------------------------------------------
            const currentMonthCount = getMonthPondCount(currentWeek);
            if (currentMonthCount + pondsToStock > maxPondsPerMonth && currentMonthCount > 0) {
                // Monthly quota exceeded: shift this module to first week of next calendar month (FIFO)
                let shiftWeeks = 1;
                while (getMonthKey(currentWeek + shiftWeeks) === getMonthKey(currentWeek)) {
                    shiftWeeks++;
                }
                mState.nextReadyWeek = currentWeek + shiftWeeks;
                continue;
            }

            // -------------------------------------------------------------
            // Rule 5: Module All-In/All-Out & Row-Level Species Homogeneity
            // -------------------------------------------------------------
            const strategy = CULTURE_STRATEGIES[strategyCode] || CULTURE_STRATEGIES.DS1;
            const docDays = shouldStockMonodon ? 112 : strategy.targetFinalDoc;
            const durationWeeks = Math.ceil(docDays / 7);
            const batchSize = Math.max(1, Math.ceil(pondsToStock / 4)); // 24 / 4 = 6 ponds per batch

            let maxEndWeek = currentWeek;

            mState.modPonds.forEach((pond, pondIdx) => {
                const batchIdx = Math.min(3, Math.floor(pondIdx / batchSize)); // 0, 1, 2, 3
                const pondStartWeek = currentWeek + batchIdx;
                const pondEndWeek = pondStartWeek + durationWeeks - 1;
                if (pondEndWeek > maxEndWeek) maxEndWeek = pondEndWeek;

                if (pondEndWeek <= horizonWeeks) {
                    const hatcheryPool = shouldStockMonodon ? tier1MonodonHatcheries : tier1VannameiHatcheries;
                    const stckSource = hatcheryPool[(pondIdx + mState.waveCounter) % hatcheryPool.length];

                    scheduledCycles.push({
                        pondId: pond.pondId,
                        moduleId: mState.modKey,
                        areaHa: pond.areaHa,
                        species,
                        plType: shouldStockMonodon ? "MONODON" : (isMonsoonStocking ? "SPR" : (strategy.geneticLineDefault || "SPF")),
                        bsLine: shouldStockMonodon ? "CP THAI" : (isMonsoonStocking ? "API GOLDEN" : "SYAQUA"),
                        stckSource,
                        strategyCode,
                        harvestPlanCount: strategy.harvestPlanCount,
                        stockDensityPlM2: shouldStockMonodon ? 48 : strategy.defaultDensityPlM2,
                        startWeekIndex: pondStartWeek,
                        endWeekIndex: pondEndWeek,
                        targetFinalDoc: docDays,
                        stockMonth,
                        dopDays: mState.waveCounter === 0 ? 45 : restWeeks * 7,
                        prevHadDisease: false,
                        olderActivePondsCount: 0,
                        diseasedNeighborsCount: 0
                    });

                    addMonthPonds(pondStartWeek, 1);
                }
            });

            // Update module and farm counters
            mState.waveCounter += 1;
            mState.annualCycleCounts.set(stockYear, cyclesInCurrentYear + 1);
            if (shouldStockMonodon) {
                mState.monodonWaveCount += 1;
                mState.annualMonodonCycles.set(stockYear, (mState.annualMonodonCycles.get(stockYear) || 0) + 1);
                monthlyMonodonModules.set(monthKey, (monthlyMonodonModules.get(monthKey) || 0) + 1);
                yrStats.monodonPonds += pondsToStock;
            }
            yrStats.totalPonds += pondsToStock;

            // Next wave ready after the last pond in this wave finishes + restWeeks (Golden Rest)
            mState.nextReadyWeek = maxEndWeek + 1 + restWeeks;
        }

        currentWeek += 1;
    }

    return scheduledCycles;
}
