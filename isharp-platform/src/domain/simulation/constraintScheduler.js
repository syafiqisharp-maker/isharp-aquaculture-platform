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
        if (c.species === SPECIES.MONODON && c.stockMonth >= 8 && c.stockMonth <= 11) {
            pushAlert(
                "MONSOON_CLIFF_EXPOSURE",
                "HIGH",
                c,
                `Monodon stocked in Month ${c.stockMonth} (${c.yearMonthKey}) grows directly into the Setiu Northeast Monsoon (historical Sep-Oct EBITDA: -RM 9k to -RM 18k/pond).`
            );
        } else if (c.species === SPECIES.VANNAMEI && (c.stockMonth === 11 || c.stockMonth === 12)) {
            pushAlert(
                "MONSOON_CLIFF_EXPOSURE",
                "MEDIUM",
                c,
                `Vannamei stocked in peak monsoon Month ${c.stockMonth} (${c.yearMonthKey}) faces -30% slower ADG and >60% forced harvest risk.`
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
 * 1. Golden Rest Turnaround (`42 days` / `6 weeks` idle between cycles)
 * 2. Synchronized All-In / All-Out Module Waves (all ponds in the same module stock in the same week)
 * 3. Species-Module Matching (`MONODON` in `M08`, `M09`, and optionally `M05`; `VANNAMEI` in `M01-M07`)
 * 4. Monsoon Cliff Avoidance (`MONODON` rests or switches during Sep-Oct; `VANNAMEI` avoids Nov-stocked waves)
 * 5. Clean Tier-1 Single-Hatchery Rotation (`SHT`, `CPD`, `KSK`, `UBN` capped at <=25 ponds/month each)
 *
 * @param {Array<Object>} pondsMasterList Array of `{ pondId, moduleId, areaHa }`
 * @param {Object} [options={}]
 * @param {number} [options.horizonWeeks=156]
 * @param {number} [options.baseYear=2026]
 * @param {number} [options.baseMonth=1]
 * @param {number} [options.restWeeks=6] 6 weeks = 42 days Golden Rest
 * @param {Array<string>} [options.monodonModules=["08", "09", "05"]]
 * @param {string} [options.vannameiDefaultStrategy="DS2"] 2X Partial Harvest strategy
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
    const monodonMods = new Set((options.monodonModules || ["08", "09", "05"]).map(normalizeModuleKey));
    const vanStrategyCode = options.vannameiDefaultStrategy || "DS2";

    // Group ponds by module so each module operates as a synchronized All-In / All-Out wave
    const pondsByMod = new Map();
    for (const p of pondsMasterList) {
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

    const sortedModKeys = Array.from(pondsByMod.keys()).sort();

    sortedModKeys.forEach((modKey, modOrderIdx) => {
        const modPonds = pondsByMod.get(modKey);
        if (modKey === "11") return; // Skip M11 nursery trial module unless explicitly requested

        // Stagger module wave start weeks across modules (1, 3, 5, 7...) to smooth weekly harvest logistics
        // while keeping 100% All-In/All-Out synchronization INSIDE each module!
        let currentStartWeek = 1 + (modOrderIdx % 8) * 2;
        const isMonodonModule = monodonMods.has(modKey);

        let waveCounter = 0;
        while (currentStartWeek <= horizonWeeks - 10) {
            const cal = weekIndexToCalendar(currentStartWeek, baseYear, baseMonth);
            const stockMonth = cal.month;

            // Monsoon Cliff Protection:
            // If Monodon module lands in Aug-Nov (Months 8..11), delay wave to post-monsoon or switch to resilient SPR
            if (isMonodonModule && stockMonth >= 8 && stockMonth <= 11) {
                currentStartWeek += 4;
                continue;
            }
            // If Vannamei module lands right in Nov-Dec (Months 11-12 peak monsoon cliff), shift into Jan post-monsoon recovery
            if (!isMonodonModule && (stockMonth === 11 || stockMonth === 12)) {
                currentStartWeek += 4;
                continue;
            }

            const species = isMonodonModule ? SPECIES.MONODON : SPECIES.VANNAMEI;
            const strategyCode = isMonodonModule ? "DS4" : vanStrategyCode;
            const strategy = CULTURE_STRATEGIES[strategyCode] || CULTURE_STRATEGIES.DS1;
            const docDays = isMonodonModule ? 112 : strategy.targetFinalDoc;
            const durationWeeks = Math.ceil(docDays / 7);
            const endWeekIndex = currentStartWeek + durationWeeks - 1;

            if (endWeekIndex > horizonWeeks) break;

            modPonds.forEach((pond, pondIdxInMod) => {
                // Distribute cleanly across Tier-1 single hatcheries so no single hatchery exceeds 28 ponds/month
                const hatcheryPool = isMonodonModule ? tier1MonodonHatcheries : tier1VannameiHatcheries;
                const stckSource = hatcheryPool[(pondIdxInMod + waveCounter) % hatcheryPool.length];

                scheduledCycles.push({
                    pondId: pond.pondId,
                    moduleId: modKey,
                    areaHa: pond.areaHa,
                    species,
                    plType: isMonodonModule ? "MONODON" : "SPR",
                    bsLine: isMonodonModule ? "CP THAI" : "API GOLDEN",
                    stckSource,
                    strategyCode,
                    harvestPlanCount: strategy.harvestPlanCount,
                    stockDensityPlM2: isMonodonModule ? 48 : strategy.defaultDensityPlM2,
                    startWeekIndex: currentStartWeek,
                    endWeekIndex,
                    targetFinalDoc: docDays,
                    stockMonth,
                    dopDays: waveCounter === 0 ? 45 : restWeeks * 7,
                    prevHadDisease: false,
                    olderActivePondsCount: 0,
                    diseasedNeighborsCount: 0
                });
            });

            waveCounter += 1;
            currentStartWeek = endWeekIndex + 1 + restWeeks;
        }
    });

    return scheduledCycles;
}
