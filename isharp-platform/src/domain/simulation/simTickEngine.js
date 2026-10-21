/**
 * iSHARP DBMS 2.0 — Frontier Simulation Engine (Phase 3)
 * Module: simTickEngine.js
 *
 * PURE DOMAIN MODULE (Zero DOM dependencies, Zero network/fetch calls).
 *
 * Master 156-Week (3-Year) Discrete Simulation Engine & Correlated Monte Carlo Risk Engine.
 * Orchestrates:
 * 1. Time-Scoped Shock Evaluation (`TemporalShockEvent` from Section 7.2 of Master Plan)
 * 2. 156-Week Pond Cycle Biological & 16-Element P&L Simulation (`run156WeekSimulation`)
 * 3. Weekly MRP, 36-Month P&L, and 3-Year BOD KPI Rollups (by Species, Genetic Line, and Module)
 * 4. Correlated Monte Carlo Confidence Bands (`P10` Cashflow-at-Risk, `P50` Median, `P90` Upside)
 */

import { SPECIES, GENETIC_LINES, DEFAULT_EMPIRICAL_PRIORS } from "./baselineCalibrator.js";
import { normalizeModuleKey, simulatePondCycleTrajectory } from "./hazardAndGrowthModel.js";
import { calculatePondCyclePnL } from "./financialCalculator.js";
import { weekIndexToCalendar, auditScheduleRisks } from "./constraintScheduler.js";

/**
 * Evaluates all active time-scoped shocks (`TemporalShockEvent`) for a given week, module, and species.
 *
 * @param {Array<Object>} [shocks=[]] Array of `TemporalShockEvent` objects
 * @param {number} weekIndex 1..156
 * @param {string} [moduleId="01"]
 * @param {"MONODON"|"VANNAMEI"} [species="VANNAMEI"]
 * @returns {Object} Combined multiplicative/additive shock modifiers
 */
export function evaluateActiveShocks(
    shocks = [],
    weekIndex = 1,
    moduleId = "01",
    species = SPECIES.VANNAMEI
) {
    const combined = {
        electricityTariffMultiplier: 1.0,
        feedCostMultiplier: 1.0,
        shrimpPriceShiftRM: 0.0,
        adgMultiplier: 1.0,
        survivalMultiplier: 1.0,
        hazardMultiplier: 1.0,
        mineralCostMultiplier: 1.0,
        activeShockIds: []
    };

    if (!Array.isArray(shocks) || shocks.length === 0) return combined;

    const w = Number(weekIndex) || 1;
    const modKey = normalizeModuleKey(moduleId);

    for (const s of shocks) {
        if (!s || typeof s !== "object") continue;
        const startW = Number(s.startWeek) || 1;
        const duration = s.durationWeeks === null || s.durationWeeks === undefined
            ? Infinity
            : Number(s.durationWeeks);
        if (w < startW || w >= startW + duration) continue;

        const scope = s.targetScope || { type: "FARM_WIDE" };
        if (scope.type === "MODULES" && Array.isArray(scope.modules)) {
            const normalizedTargets = scope.modules.map(normalizeModuleKey);
            if (!normalizedTargets.includes(modKey)) continue;
        }
        if (scope.species && scope.species !== "ALL" && scope.species !== species) {
            continue;
        }

        const mod = s.impactModifiers || {};
        if (mod.electricityTariffMultiplier) combined.electricityTariffMultiplier *= Number(mod.electricityTariffMultiplier);
        if (mod.feedCostMultiplier) combined.feedCostMultiplier *= Number(mod.feedCostMultiplier);
        if (mod.shrimpPriceShiftRM) combined.shrimpPriceShiftRM += Number(mod.shrimpPriceShiftRM);
        if (mod.adgMultiplier) combined.adgMultiplier *= Number(mod.adgMultiplier);
        if (mod.survivalMultiplier) combined.survivalMultiplier *= Number(mod.survivalMultiplier);
        if (mod.hazardMultiplier) combined.hazardMultiplier *= Number(mod.hazardMultiplier);
        if (mod.mineralCostMultiplier) combined.mineralCostMultiplier *= Number(mod.mineralCostMultiplier);
        if (s.id) combined.activeShockIds.push(s.id);
    }

    return combined;
}

/**
 * Runs the complete 156-Week (3-Year) Digital Twin Simulation across all scheduled pond cycles.
 *
 * @param {Object} simulationConfig
 * @param {Array<Object>} simulationConfig.scheduledCycles Array of pond cycle configs
 * @param {number} [simulationConfig.horizonWeeks=156]
 * @param {number} [simulationConfig.baseYear=2026]
 * @param {number} [simulationConfig.baseMonth=1]
 * @param {Array<Object>} [simulationConfig.shocks=[]] Optional War Room `TemporalShockEvent` array
 * @param {Object} [priors=DEFAULT_EMPIRICAL_PRIORS]
 * @returns {Object} `{ scheduleAudit, weeklyTimeline, monthlySummary, annualSummary, pondCyclesResult, grandTotals }`
 */
export function run156WeekSimulation(
    simulationConfig = {},
    priors = DEFAULT_EMPIRICAL_PRIORS
) {
    const horizonWeeks = Math.max(12, Number(simulationConfig.horizonWeeks) || 156);
    const baseYear = Number(simulationConfig.baseYear) || 2026;
    const baseMonth = Number(simulationConfig.baseMonth) || 1;
    const shocks = Array.isArray(simulationConfig.shocks) ? simulationConfig.shocks : [];
    const rawCycles = Array.isArray(simulationConfig.scheduledCycles)
        ? simulationConfig.scheduledCycles
        : [];

    // 1. Audit schedule & annotate DOP, module overlap, and monthly hatchery batch counts
    const scheduleAudit = auditScheduleRisks(rawCycles, { baseYear, baseMonth }, priors);
    const annotatedCycles = scheduleAudit.annotatedCycles;

    // 2. First pass: simulate biological trajectories for all cycles & count active ponds per week
    const trajectories = [];
    const activePondsPerWeek = new Array(horizonWeeks + 1).fill(0);

    for (const cyc of annotatedCycles) {
        const traj = simulatePondCycleTrajectory(
            cyc,
            priors,
            (wIdx) => evaluateActiveShocks(shocks, wIdx, cyc.moduleKey, cyc.species)
        );
        trajectories.push({ config: cyc, trajectory: traj });

        for (const step of traj.weeklySteps) {
            if (step.simWeekIndex >= 1 && step.simWeekIndex <= horizonWeeks) {
                activePondsPerWeek[step.simWeekIndex] += 1;
            }
        }
    }

    // 3. Initialize 156 Weekly Buckets & 36 Monthly Buckets
    const createSpeciesMonthBucket = () => ({
        stockedPonds: 0,
        stockedPlPcs: 0,
        pondsHarvested: 0,
        partialHarvestPonds: 0,
        partialHarvestKg: 0,
        yieldKg: 0,
        yieldMt: 0,
        feedKg: 0,
        revenueRM: 0,
        cashCostRM: 0,
        ebitdaRM: 0,
        _harvestWeightAbwSum: 0,
        _harvestWeightSrSum: 0,
        _harvestWeightFcrSum: 0,
        _harvestWeightAdgSum: 0,
        _totalHarvestKgForAvg: 0,
        _densitySum: 0,
        _dopSum: 0,
        _stockedForAvg: 0
    });

    const weeklyTimeline = [];
    const monthlyMap = new Map();
    const harvestLogisticsCapMt =
        priors.carryingCapacityAndPartialHarvest.weeklyFarmHarvestLogisticsCapMt || 45.0;

    for (let w = 1; w <= horizonWeeks; w++) {
        const cal = weekIndexToCalendar(w, baseYear, baseMonth);
        const ymKey = `${cal.year}-${String(cal.month).padStart(2, "0")}`;

        weeklyTimeline.push({
            weekIndex: w,
            year: cal.year,
            month: cal.month,
            yearMonth: ymKey,
            activePondsCount: activePondsPerWeek[w],
            activePondDays: activePondsPerWeek[w] * 7,
            stockedPondsCount: 0,
            stockedPlPcs: 0,
            pondsHarvestedCount: 0,
            harvestedPondsCount: 0,
            harvestYieldKg: 0,
            harvestYieldMt: 0,
            partialHarvestKg: 0,
            finalHarvestKg: 0,
            averageHarvestAbwG: 0,
            averageSurvivalRatePct: 0,
            fcr: 0,
            _harvestWeightAbwSum: 0,
            _harvestWeightSrSum: 0,
            _harvestWeightFcrSum: 0,
            _totalHarvestKgForAvg: 0,
            plDemandMpcs: { total: 0, spf: 0, spr: 0, spt: 0, monodon: 0 },
            feedDemandMt: { total: 0, starter1: 0, starter2: 0, grower3: 0, finisher4: 0, monodonFeed: 0 },
            chemicalMrp: {},
            chemFertPrepCostRM: 0,
            chemFertCultureCostRM: 0,
            chemFertCostRM: 0,
            suppliesCostRM: 0,
            repairMaintenanceRM: 0,
            harvestExpensesRM: 0,
            directWagesRM: 0,
            feedConsumedKg: 0,
            sapFeedKgByCode: {},
            electricityCostRM: 0,
            electricityKwh: 0,
            revenueRM: 0,
            revenueRm: 0,
            cashCostRM: 0,
            ebitdaRM: 0,
            ebitdaRm: 0,
            isHarvestLogisticsCongested: false
        });

        if (!monthlyMap.has(ymKey)) {
            monthlyMap.set(ymKey, {
                yearMonth: ymKey,
                year: cal.year,
                month: cal.month,
                activePondsAvg: 0,
                _activePondWeeksSum: 0,
                _weeksInMonth: 0,
                activePondDays: 0,
                stockedPonds: 0,
                stockedPlPcs: 0,
                pondsHarvested: 0,
                partialHarvestPonds: 0,
                partialHarvestKg: 0,
                yieldKg: 0,
                yieldMt: 0,
                feedKg: 0,
                revenueRM: 0,
                cashCostRM: 0,
                totalCostRM: 0,
                ebitdaRM: 0,
                netProfitRM: 0,
                _harvestWeightAbwSum: 0,
                _harvestWeightSrSum: 0,
                _harvestWeightFcrSum: 0,
                _harvestWeightAdgSum: 0,
                _totalHarvestKgForAvg: 0,
                _densitySum: 0,
                _dopSum: 0,
                _stockedForAvg: 0,
                bySpecies: {
                    [SPECIES.VANNAMEI]: createSpeciesMonthBucket(),
                    [SPECIES.MONODON]: createSpeciesMonthBucket()
                },
                plDemandMpcs: { total: 0, spf: 0, spr: 0, spt: 0, monodon: 0 },
                feedDemandMt: { total: 0, starter1: 0, starter2: 0, grower3: 0, finisher4: 0, monodonFeed: 0 },
                chemicalMrp: {},
                chemFertPrepCostRM: 0,
                chemFertCultureCostRM: 0,
                cons_of_fries: 0,
                cons_of_feed: 0,
                cons_of_chem_fert: 0,
                electricity: 0,
                cons_of_supplies: 0,
                harvest_expenses: 0,
                wages_direct: 0,
                wages_indirect: 0,
                repair_maintenance: 0,
                consultant: 0,
                rental: 0,
                travel_entertainment: 0,
                training_seminar: 0,
                security_charges: 0,
                other_utilities_ins: 0,
                other_charges: 0,
                depreciation_fc: 0,
                sag: 0
            });
        }
        const mBucket = monthlyMap.get(ymKey);
        mBucket._activePondWeeksSum += activePondsPerWeek[w];
        mBucket._weeksInMonth += 1;
        mBucket.activePondDays += activePondsPerWeek[w] * 7;
    }

    // 4. Second pass: compute 16-Element P&L per cycle (using concurrent active pond utilization for overhead dilution)
    const pondCyclesResult = [];
    const uniqueScheduledPondsCount = Math.max(1, new Set(annotatedCycles.map(c => c.pondId)).size);
    const benchmarkFarmGrowoutPonds = Number(simulationConfig.totalFarmPondCapacity) || 180;

    for (const { config, trajectory } of trajectories) {
        // Average active ponds during this cycle's active weeks, scaled to farm-equivalent utilization
        let activeSum = 0;
        let activeCnt = 0;
        for (const step of trajectory.weeklySteps) {
            if (step.simWeekIndex >= 1 && step.simWeekIndex <= horizonWeeks) {
                activeSum += activePondsPerWeek[step.simWeekIndex];
                activeCnt += 1;
            }
        }
        const rawAvgActive = activeCnt > 0 ? activeSum / activeCnt : uniqueScheduledPondsCount * 0.75;
        const utilizationRatio = Math.min(1.0, rawAvgActive / uniqueScheduledPondsCount);
        const avgConcurrentActivePonds = Math.max(25, benchmarkFarmGrowoutPonds * utilizationRatio);

        const midWeek = Math.min(
            horizonWeeks,
            Math.round((trajectory.startWeekIndex + trajectory.endWeekIndex) / 2)
        );
        const midShock = evaluateActiveShocks(shocks, midWeek, trajectory.moduleId, trajectory.species);

        const pnl = calculatePondCyclePnL(
            trajectory,
            {
                concurrentActivePondsOnFarm: avgConcurrentActivePonds,
                repairScope: config.repairScope || "NONE",
                shockModifiers: midShock
            },
            priors
        );

        pondCyclesResult.push({
            pondId: trajectory.pondId,
            moduleId: trajectory.moduleId,
            species: trajectory.species,
            geneticLine: trajectory.geneticLine,
            bsLine: trajectory.bsLine,
            stckSource: trajectory.stckSource,
            strategyCode: trajectory.strategyCode,
            startWeekIndex: trajectory.startWeekIndex,
            endWeekIndex: trajectory.endWeekIndex,
            stockMonth: trajectory.stockMonth,
            harvestMonth: pnl.harvestMonth,
            stockedPlPcs: trajectory.stockedPlPcs,
            stockDensityPlM2: trajectory.stockDensityPlM2,
            expectedOutcomes: trajectory.expectedOutcomes,
            pnl,
            pillarMultipliers: trajectory.pillarMultipliers
        });

        // Allocate stocking to start week
        if (trajectory.startWeekIndex >= 1 && trajectory.startWeekIndex <= horizonWeeks) {
            const wStock = weeklyTimeline[trajectory.startWeekIndex - 1];
            wStock.stockedPondsCount += 1;
            wStock.stockedPlPcs += trajectory.stockedPlPcs;

            const plMpcs = trajectory.stockedPlPcs / 1000000;
            wStock.plDemandMpcs.total += plMpcs;
            if (trajectory.geneticLine === GENETIC_LINES.SPF) wStock.plDemandMpcs.spf += plMpcs;
            else if (trajectory.geneticLine === GENETIC_LINES.SPR) wStock.plDemandMpcs.spr += plMpcs;
            else if (trajectory.geneticLine === GENETIC_LINES.SPT) wStock.plDemandMpcs.spt += plMpcs;
            else if (trajectory.species === SPECIES.MONODON || trajectory.geneticLine === GENETIC_LINES.MONODON) wStock.plDemandMpcs.monodon += plMpcs;
            else wStock.plDemandMpcs.spf += plMpcs;

            // Apply pond-prep chemicals & maintenance at stocking
            const prepChemCost = pnl.chemicalMrp?.prepCostRM || 0;
            wStock.chemFertPrepCostRM += prepChemCost;
            wStock.chemFertCostRM += prepChemCost;
            wStock.repairMaintenanceRM += pnl.costElementsRM.repair_maintenance || 0;

            const mStock = monthlyMap.get(wStock.yearMonth);
            if (mStock) {
                mStock.stockedPonds += 1;
                mStock.stockedPlPcs += trajectory.stockedPlPcs;
                mStock._densitySum += Number(trajectory.stockDensityPlM2) || 95;
                mStock._dopSum += Number(config.dopDays) || 35;
                mStock._stockedForAvg += 1;

                const spStockBucket = mStock.bySpecies[trajectory.species];
                if (spStockBucket) {
                    spStockBucket.stockedPonds += 1;
                    spStockBucket.stockedPlPcs += trajectory.stockedPlPcs;
                    spStockBucket._densitySum += Number(trajectory.stockDensityPlM2) || 95;
                    spStockBucket._dopSum += Number(config.dopDays) || 35;
                    spStockBucket._stockedForAvg += 1;
                }

                mStock.plDemandMpcs.total += plMpcs;
                if (trajectory.geneticLine === GENETIC_LINES.SPF) mStock.plDemandMpcs.spf += plMpcs;
                else if (trajectory.geneticLine === GENETIC_LINES.SPR) mStock.plDemandMpcs.spr += plMpcs;
                else if (trajectory.geneticLine === GENETIC_LINES.SPT) mStock.plDemandMpcs.spt += plMpcs;
                else if (trajectory.species === SPECIES.MONODON || trajectory.geneticLine === GENETIC_LINES.MONODON) mStock.plDemandMpcs.monodon += plMpcs;
                else mStock.plDemandMpcs.spf += plMpcs;

                mStock.chemFertPrepCostRM += prepChemCost;
            }
        }

        // Allocate weekly feed, electricity, chemicals, and ongoing operating costs across active weeks
        const numSteps = Math.max(1, trajectory.weeklySteps.length);
        const weeklyChemCost = (pnl.chemicalMrp?.cultureCostRM || pnl.costElementsRM.cons_of_chem_fert) / numSteps;
        const weeklySuppliesCost = (pnl.costElementsRM.cons_of_supplies || 0) / numSteps;
        const weeklyDirectWages = (pnl.costElementsRM.wages_direct || 0) / numSteps;
        const weeklyElecCost = pnl.costElementsRM.electricity / numSteps;
        const weeklyElecKwh = pnl.estimatedElectricityKwh / numSteps;
        const nonFeedCashCostPerStep =
            (pnl.totalCashCostRM - pnl.costElementsRM.cons_of_feed) / numSteps;

        for (const step of trajectory.weeklySteps) {
            if (step.simWeekIndex < 1 || step.simWeekIndex > horizonWeeks) continue;
            const wBucket = weeklyTimeline[step.simWeekIndex - 1];

            wBucket.feedConsumedKg += step.expectedWeeklyFeedKg;
            wBucket.sapFeedKgByCode[step.sapFeedCode] =
                (wBucket.sapFeedKgByCode[step.sapFeedCode] || 0) + step.expectedWeeklyFeedKg;
            wBucket.chemFertCultureCostRM += weeklyChemCost;
            wBucket.chemFertCostRM += weeklyChemCost;
            wBucket.suppliesCostRM += weeklySuppliesCost;
            wBucket.directWagesRM += weeklyDirectWages;
            wBucket.electricityCostRM += weeklyElecCost;
            wBucket.electricityKwh += weeklyElecKwh;

            const stepFeedMt = step.expectedWeeklyFeedKg / 1000;
            wBucket.feedDemandMt.total += stepFeedMt;
            if (step.sapFeedCode === "3202") wBucket.feedDemandMt.starter1 += stepFeedMt;
            else if (step.sapFeedCode === "3203") wBucket.feedDemandMt.starter2 += stepFeedMt;
            else if (step.sapFeedCode === "3205") wBucket.feedDemandMt.grower3 += stepFeedMt;
            else if (step.sapFeedCode === "3206") wBucket.feedDemandMt.finisher4 += stepFeedMt;
            else if (["3301", "3302", "3303"].includes(step.sapFeedCode) || trajectory.species === SPECIES.MONODON) {
                wBucket.feedDemandMt.monodonFeed += stepFeedMt;
            } else {
                wBucket.feedDemandMt.grower3 += stepFeedMt;
            }

            const mBucket = monthlyMap.get(wBucket.yearMonth);
            if (mBucket) {
                mBucket.feedDemandMt.total += stepFeedMt;
                if (step.sapFeedCode === "3202") mBucket.feedDemandMt.starter1 += stepFeedMt;
                else if (step.sapFeedCode === "3203") mBucket.feedDemandMt.starter2 += stepFeedMt;
                else if (step.sapFeedCode === "3205") mBucket.feedDemandMt.grower3 += stepFeedMt;
                else if (step.sapFeedCode === "3206") mBucket.feedDemandMt.finisher4 += stepFeedMt;
                else if (["3301", "3302", "3303"].includes(step.sapFeedCode) || trajectory.species === SPECIES.MONODON) {
                    mBucket.feedDemandMt.monodonFeed += stepFeedMt;
                } else {
                    mBucket.feedDemandMt.grower3 += stepFeedMt;
                }
                mBucket.chemFertCultureCostRM += weeklyChemCost;
            }

            // Partial harvest skims occurring in this week
            if (step.partialHarvestKg > 0) {
                const expectedSkim = step.partialHarvestKg * step.cumPondSurvivalProb;
                wBucket.partialHarvestKg += expectedSkim;
                wBucket.harvestYieldKg += expectedSkim;

                if (mBucket) {
                    mBucket.partialHarvestPonds += 1;
                    mBucket.partialHarvestKg += expectedSkim;
                    const spPartBucket = mBucket.bySpecies[trajectory.species];
                    if (spPartBucket) {
                        spPartBucket.partialHarvestPonds += 1;
                        spPartBucket.partialHarvestKg += expectedSkim;
                    }
                }
            }

            const stepFeedCost =
                step.expectedWeeklyFeedKg *
                (pnl.costElementsRM.cons_of_feed /
                    Math.max(1, trajectory.expectedOutcomes.expectedTotalFeedKg));
            const stepCashCost = stepFeedCost + nonFeedCashCostPerStep;
            wBucket.cashCostRM += stepCashCost;
            wBucket.ebitdaRM -= stepCashCost;
            wBucket.ebitdaRm -= stepCashCost;
        }

        // Allocate Final Harvest & Revenue to harvest week (clamped to horizonWeeks)
        const harvestWIdx = Math.min(horizonWeeks, Math.max(1, trajectory.endWeekIndex));
        const wHarv = weeklyTimeline[harvestWIdx - 1];
        const finalYieldKg =
            trajectory.expectedOutcomes.expectedNormalFinalHarvestKg +
            trajectory.expectedOutcomes.expectedSalvageBiomassKg;
        const finalAbw = trajectory.finalHarvestEvent?.finalAbwGrams || trajectory.expectedOutcomes.expectedAbwGrams || 0;
        const finalSr = trajectory.expectedOutcomes.expectedSurvivalPct || 0;
        const finalFcr = trajectory.expectedOutcomes.expectedFcr || 0;
        const activeDoc = Math.max(1, trajectory.expectedOutcomes.expectedActiveDocDays || 90);
        const finalAdg = finalAbw / activeDoc;

        wHarv.pondsHarvestedCount += 1;
        wHarv.harvestedPondsCount += 1;
        wHarv.finalHarvestKg += finalYieldKg;
        wHarv.harvestYieldKg += finalYieldKg;
        wHarv.revenueRM += pnl.revenueBreakdownRM.totalRevenueRM;
        wHarv.revenueRm += pnl.revenueBreakdownRM.totalRevenueRM;
        wHarv.ebitdaRM += pnl.revenueBreakdownRM.totalRevenueRM;
        wHarv.ebitdaRm += pnl.revenueBreakdownRM.totalRevenueRM;
        wHarv.harvestExpensesRM += pnl.costElementsRM.harvest_expenses || 0;

        wHarv._harvestWeightAbwSum += finalYieldKg * finalAbw;
        wHarv._harvestWeightSrSum += finalYieldKg * finalSr;
        wHarv._harvestWeightFcrSum += finalYieldKg * finalFcr;
        wHarv._totalHarvestKgForAvg += finalYieldKg;

        const mHarv = monthlyMap.get(wHarv.yearMonth);
        if (mHarv) {
            mHarv.pondsHarvested += 1;
            mHarv.yieldKg += pnl.totalYieldKg;
            mHarv.feedKg += trajectory.expectedOutcomes.expectedTotalFeedKg;
            mHarv.revenueRM += pnl.revenueBreakdownRM.totalRevenueRM;
            mHarv.cashCostRM += pnl.totalCashCostRM;
            mHarv.totalCostRM += pnl.totalCostRM;
            mHarv.ebitdaRM += pnl.ebitdaRM;
            mHarv.netProfitRM += pnl.netProfitRM;

            mHarv._harvestWeightAbwSum += finalYieldKg * finalAbw;
            mHarv._harvestWeightSrSum += finalYieldKg * finalSr;
            mHarv._harvestWeightFcrSum += finalYieldKg * finalFcr;
            mHarv._harvestWeightAdgSum += finalYieldKg * finalAdg;
            mHarv._totalHarvestKgForAvg += finalYieldKg;

            const spHarvBucket = mHarv.bySpecies[trajectory.species];
            if (spHarvBucket) {
                spHarvBucket.pondsHarvested += 1;
                spHarvBucket.yieldKg += pnl.totalYieldKg;
                spHarvBucket.feedKg += trajectory.expectedOutcomes.expectedTotalFeedKg;
                spHarvBucket.revenueRM += pnl.revenueBreakdownRM.totalRevenueRM;
                spHarvBucket.cashCostRM += pnl.totalCashCostRM;
                spHarvBucket.ebitdaRM += pnl.ebitdaRM;
                spHarvBucket._harvestWeightAbwSum += finalYieldKg * finalAbw;
                spHarvBucket._harvestWeightSrSum += finalYieldKg * finalSr;
                spHarvBucket._harvestWeightFcrSum += finalYieldKg * finalFcr;
                spHarvBucket._harvestWeightAdgSum += finalYieldKg * finalAdg;
                spHarvBucket._totalHarvestKgForAvg += finalYieldKg;
            }

            // 16-Line Cost Ledger allocation
            mHarv.cons_of_fries += pnl.costElementsRM.cons_of_fries;
            mHarv.cons_of_feed += pnl.costElementsRM.cons_of_feed;
            mHarv.cons_of_chem_fert += pnl.costElementsRM.cons_of_chem_fert;
            mHarv.electricity += pnl.costElementsRM.electricity;
            mHarv.cons_of_supplies += pnl.costElementsRM.cons_of_supplies;
            mHarv.harvest_expenses += pnl.costElementsRM.harvest_expenses;
            mHarv.wages_direct += pnl.costElementsRM.wages_direct;
            mHarv.wages_indirect += pnl.costElementsRM.wages_indirect;
            mHarv.repair_maintenance += pnl.costElementsRM.repair_maintenance;
            mHarv.consultant += pnl.costElementsRM.consultant;
            mHarv.rental += pnl.costElementsRM.rental;
            mHarv.travel_entertainment += pnl.costElementsRM.travel_entertainment;
            mHarv.training_seminar += pnl.costElementsRM.training_seminar;
            mHarv.security_charges += pnl.costElementsRM.security_charges;
            mHarv.other_utilities_ins += pnl.costElementsRM.other_utilities_ins;
            mHarv.other_charges += pnl.costElementsRM.other_charges;
            mHarv.depreciation_fc += pnl.costElementsRM.depreciation_fc;
            mHarv.sag += pnl.costElementsRM.sag;
        }
    }

    // Finalize weekly numbers & check harvest logistics congestion
    for (const wBucket of weeklyTimeline) {
        wBucket.harvestYieldKg = Number(wBucket.harvestYieldKg.toFixed(1));
        wBucket.harvestYieldMt = Number((wBucket.harvestYieldKg / 1000).toFixed(2));
        wBucket.partialHarvestKg = Number(wBucket.partialHarvestKg.toFixed(1));
        wBucket.finalHarvestKg = Number(wBucket.finalHarvestKg.toFixed(1));
        wBucket.averageHarvestAbwG = wBucket._totalHarvestKgForAvg > 0
            ? Number((wBucket._harvestWeightAbwSum / wBucket._totalHarvestKgForAvg).toFixed(1))
            : 0;
        wBucket.averageSurvivalRatePct = wBucket._totalHarvestKgForAvg > 0
            ? Number((wBucket._harvestWeightSrSum / wBucket._totalHarvestKgForAvg).toFixed(1))
            : 0;
        wBucket.fcr = wBucket._totalHarvestKgForAvg > 0
            ? Number((wBucket._harvestWeightFcrSum / wBucket._totalHarvestKgForAvg).toFixed(2))
            : 0;
        wBucket.feedConsumedKg = Number(wBucket.feedConsumedKg.toFixed(1));
        wBucket.chemFertPrepCostRM = Number(wBucket.chemFertPrepCostRM.toFixed(2));
        wBucket.chemFertCultureCostRM = Number(wBucket.chemFertCultureCostRM.toFixed(2));
        wBucket.chemFertCostRM = Number(wBucket.chemFertCostRM.toFixed(2));
        wBucket.suppliesCostRM = Number(wBucket.suppliesCostRM.toFixed(2));
        wBucket.repairMaintenanceRM = Number(wBucket.repairMaintenanceRM.toFixed(2));
        wBucket.harvestExpensesRM = Number(wBucket.harvestExpensesRM.toFixed(2));
        wBucket.directWagesRM = Number(wBucket.directWagesRM.toFixed(2));
        wBucket.electricityCostRM = Number(wBucket.electricityCostRM.toFixed(2));
        wBucket.electricityKwh = Math.round(wBucket.electricityKwh);
        wBucket.revenueRM = Number(wBucket.revenueRM.toFixed(2));
        wBucket.revenueRm = wBucket.revenueRM;
        wBucket.cashCostRM = Number(wBucket.cashCostRM.toFixed(2));
        wBucket.ebitdaRM = Number(wBucket.ebitdaRM.toFixed(2));
        wBucket.ebitdaRm = wBucket.ebitdaRM;
        wBucket.isHarvestLogisticsCongested = wBucket.harvestYieldMt > harvestLogisticsCapMt;
    }

    const finalizeSpeciesMonth = (spB) => {
        const spYieldMt = Number((spB.yieldKg / 1000).toFixed(2));
        return {
            stockedPonds: spB.stockedPonds,
            stockedPondsCount: spB.stockedPonds,
            stockedPlPcs: spB.stockedPlPcs,
            pondsHarvested: spB.pondsHarvested,
            harvestedPondsCount: spB.pondsHarvested,
            partial_harvest_ponds: spB.partialHarvestPonds,
            partial_harvest_mt: Number((spB.partialHarvestKg / 1000).toFixed(2)),
            yieldKg: Number(spB.yieldKg.toFixed(1)),
            yieldMt: spYieldMt,
            harvestYieldMt: spYieldMt,
            feedKg: Number(spB.feedKg.toFixed(1)),
            revenueRM: Number(spB.revenueRM.toFixed(2)),
            ebitdaRM: Number(spB.ebitdaRM.toFixed(2)),
            averageHarvestAbwG: spB._totalHarvestKgForAvg > 0
                ? Number((spB._harvestWeightAbwSum / spB._totalHarvestKgForAvg).toFixed(1))
                : 0,
            averageSurvivalRatePct: spB._totalHarvestKgForAvg > 0
                ? Number((spB._harvestWeightSrSum / spB._totalHarvestKgForAvg).toFixed(1))
                : 0,
            fcr: spB._totalHarvestKgForAvg > 0
                ? Number((spB._harvestWeightFcrSum / spB._totalHarvestKgForAvg).toFixed(2))
                : 0,
            adg: spB._totalHarvestKgForAvg > 0
                ? Number((spB._harvestWeightAdgSum / spB._totalHarvestKgForAvg).toFixed(3))
                : 0,
            averageDensityPlM2: spB._stockedForAvg > 0
                ? Math.round(spB._densitySum / spB._stockedForAvg)
                : 0,
            dopDays: spB._stockedForAvg > 0
                ? Math.round(spB._dopSum / spB._stockedForAvg)
                : 0
        };
    };

    // Finalize monthly summary
    const monthlySummary = Array.from(monthlyMap.values()).map(m => {
        const activeAvg = m._weeksInMonth > 0 ? m._activePondWeeksSum / m._weeksInMonth : 0;
        const yieldMt = m.yieldKg / 1000;
        const avgAbw = m._totalHarvestKgForAvg > 0
            ? Number((m._harvestWeightAbwSum / m._totalHarvestKgForAvg).toFixed(1))
            : 0;
        const avgSr = m._totalHarvestKgForAvg > 0
            ? Number((m._harvestWeightSrSum / m._totalHarvestKgForAvg).toFixed(1))
            : 0;
        const avgFcr = m._totalHarvestKgForAvg > 0
            ? Number((m._harvestWeightFcrSum / m._totalHarvestKgForAvg).toFixed(2))
            : 0;
        const avgAdg = m._totalHarvestKgForAvg > 0
            ? Number((m._harvestWeightAdgSum / m._totalHarvestKgForAvg).toFixed(3))
            : 0;
        const avgDensity = m._stockedForAvg > 0 ? Math.round(m._densitySum / m._stockedForAvg) : 0;
        const avgDop = m._stockedForAvg > 0 ? Math.round(m._dopSum / m._stockedForAvg) : 0;

        const revRM = Number(m.revenueRM.toFixed(2));
        const cashCostRM = Number(m.cashCostRM.toFixed(2));
        const totalCostRM = Number(m.totalCostRM.toFixed(2));
        const ebitdaRM = Number(m.ebitdaRM.toFixed(2));
        const grossProfitRM = Number((revRM - cashCostRM).toFixed(2));

        return {
            yearMonth: m.yearMonth,
            year: m.year,
            month: m.month,
            activePondsAvg: Number(activeAvg.toFixed(1)),
            activePondsCount: Number(activeAvg.toFixed(1)),
            activePondDays: m.activePondDays,
            stockedPonds: m.stockedPonds,
            stockedPondsCount: m.stockedPonds,
            stockedPlPcs: m.stockedPlPcs,
            pondsHarvested: m.pondsHarvested,
            harvestedPondsCount: m.pondsHarvested,
            partial_harvest_ponds: m.partialHarvestPonds,
            partial_harvest_mt: Number((m.partialHarvestKg / 1000).toFixed(2)),
            yieldKg: Number(m.yieldKg.toFixed(1)),
            yieldMt: Number(yieldMt.toFixed(2)),
            harvestYieldMt: Number(yieldMt.toFixed(2)),
            feedKg: Number(m.feedKg.toFixed(1)),
            averageHarvestAbwG: avgAbw,
            averageSurvivalRatePct: avgSr,
            fcr: avgFcr,
            adg: avgAdg,
            averageDensityPlM2: avgDensity,
            dopDays: avgDop,
            bySpecies: {
                [SPECIES.VANNAMEI]: finalizeSpeciesMonth(m.bySpecies[SPECIES.VANNAMEI]),
                [SPECIES.MONODON]: finalizeSpeciesMonth(m.bySpecies[SPECIES.MONODON])
            },
            averageRealizedPriceRmKg: m.yieldKg > 0 ? Number((revRM / m.yieldKg).toFixed(2)) : 0,
            averageCashCostRmKg: m.yieldKg > 0 ? Number((cashCostRM / m.yieldKg).toFixed(2)) : 0,
            averageTotalCostRmKg: m.yieldKg > 0 ? Number((totalCostRM / m.yieldKg).toFixed(2)) : 0,
            revenueRM: revRM,
            revenueRm: revRM,
            grossProfitRM: grossProfitRM,
            grossProfitRm: grossProfitRM,
            cashCostRM: cashCostRM,
            totalCostRM: totalCostRM,
            ebitdaRM: ebitdaRM,
            ebitdaRm: ebitdaRM,
            netProfitRM: Number(m.netProfitRM.toFixed(2)),
            cashCostPerKgRM: m.yieldKg > 0 ? Number((cashCostRM / m.yieldKg).toFixed(2)) : 0,
            plDemandMpcs: m.plDemandMpcs,
            feedDemandMt: m.feedDemandMt,
            chemicalMrp: m.chemicalMrp,
            // 16-Line Cost Ledger
            cons_of_fries: Number(m.cons_of_fries.toFixed(2)),
            plCostRm: Number(m.cons_of_fries.toFixed(2)),
            cons_of_feed: Number(m.cons_of_feed.toFixed(2)),
            feedCostRm: Number(m.cons_of_feed.toFixed(2)),
            cons_of_chem_fert: Number(m.cons_of_chem_fert.toFixed(2)),
            chemFertPrepCostRM: Number(m.chemFertPrepCostRM.toFixed(2)),
            chemFertCultureCostRM: Number(m.chemFertCultureCostRM.toFixed(2)),
            chemicalCostRm: Number(m.cons_of_chem_fert.toFixed(2)),
            electricity: Number(m.electricity.toFixed(2)),
            electricityCostRm: Number(m.electricity.toFixed(2)),
            cons_of_supplies: Number(m.cons_of_supplies.toFixed(2)),
            harvest_expenses: Number(m.harvest_expenses.toFixed(2)),
            wages_direct: Number(m.wages_direct.toFixed(2)),
            directWagesRm: Number(m.wages_direct.toFixed(2)),
            wages_indirect: Number(m.wages_indirect.toFixed(2)),
            repair_maintenance: Number(m.repair_maintenance.toFixed(2)),
            maintenanceRm: Number(m.repair_maintenance.toFixed(2)),
            consultant: Number(m.consultant.toFixed(2)),
            rental: Number(m.rental.toFixed(2)),
            travel_entertainment: Number(m.travel_entertainment.toFixed(2)),
            training_seminar: Number(m.training_seminar.toFixed(2)),
            security_charges: Number(m.security_charges.toFixed(2)),
            other_utilities_ins: Number(m.other_utilities_ins.toFixed(2)),
            other_charges: Number(m.other_charges.toFixed(2)),
            depreciation_fc: Number(m.depreciation_fc.toFixed(2)),
            depreciationRm: Number(m.depreciation_fc.toFixed(2)),
            sag: Number(m.sag.toFixed(2)),
            sagRm: Number(m.sag.toFixed(2))
        };
    });

    // 5. Aggregate Annual BOD Executive Summary (Total, by Species, by Genetic Line, by Module)
    const yearsMap = new Map();
    const createGroupBucket = () => ({
        cyclesCount: 0,
        stockedPlPcs: 0,
        yieldKg: 0,
        yieldMt: 0,
        feedKg: 0,
        revenueRM: 0,
        cashCostRM: 0,
        totalCostRM: 0,
        ebitdaRM: 0,
        netProfitRM: 0
    });

    const addCycleToGroup = (grp, cycRes) => {
        grp.cyclesCount += 1;
        grp.stockedPlPcs += cycRes.stockedPlPcs;
        grp.yieldKg += cycRes.pnl.totalYieldKg;
        grp.yieldMt = Number((grp.yieldKg / 1000).toFixed(2));
        grp.feedKg += cycRes.expectedOutcomes.expectedTotalFeedKg;
        grp.revenueRM += cycRes.pnl.revenueBreakdownRM.totalRevenueRM;
        grp.cashCostRM += cycRes.pnl.totalCashCostRM;
        grp.totalCostRM += cycRes.pnl.totalCostRM;
        grp.ebitdaRM += cycRes.pnl.ebitdaRM;
        grp.netProfitRM += cycRes.pnl.netProfitRM;
    };

    const grandTotals = {
        totalFarm: createGroupBucket(),
        bySpecies: {
            [SPECIES.MONODON]: createGroupBucket(),
            [SPECIES.VANNAMEI]: createGroupBucket()
        },
        byGeneticLine: {
            [GENETIC_LINES.MONODON]: createGroupBucket(),
            [GENETIC_LINES.SPR]: createGroupBucket(),
            [GENETIC_LINES.SPT]: createGroupBucket(),
            [GENETIC_LINES.SPF]: createGroupBucket()
        },
        byModule: {}
    };

    for (const cycRes of pondCyclesResult) {
        const harvestCal = weekIndexToCalendar(
            Math.min(horizonWeeks, cycRes.endWeekIndex),
            baseYear,
            baseMonth
        );
        const yr = harvestCal.year;
        if (!yearsMap.has(yr)) {
            yearsMap.set(yr, {
                year: yr,
                totalFarm: createGroupBucket(),
                bySpecies: {
                    [SPECIES.MONODON]: createGroupBucket(),
                    [SPECIES.VANNAMEI]: createGroupBucket()
                },
                byGeneticLine: {
                    [GENETIC_LINES.MONODON]: createGroupBucket(),
                    [GENETIC_LINES.SPR]: createGroupBucket(),
                    [GENETIC_LINES.SPT]: createGroupBucket(),
                    [GENETIC_LINES.SPF]: createGroupBucket()
                }
            });
        }
        const yEntry = yearsMap.get(yr);
        addCycleToGroup(yEntry.totalFarm, cycRes);
        addCycleToGroup(yEntry.bySpecies[cycRes.species], cycRes);
        addCycleToGroup(yEntry.byGeneticLine[cycRes.geneticLine], cycRes);

        addCycleToGroup(grandTotals.totalFarm, cycRes);
        addCycleToGroup(grandTotals.bySpecies[cycRes.species], cycRes);
        addCycleToGroup(grandTotals.byGeneticLine[cycRes.geneticLine], cycRes);

        if (!grandTotals.byModule[cycRes.moduleId]) {
            grandTotals.byModule[cycRes.moduleId] = createGroupBucket();
        }
        addCycleToGroup(grandTotals.byModule[cycRes.moduleId], cycRes);
    }

    const totalHarvestMt = grandTotals.totalFarm.yieldMt;
    const totalYieldKg = grandTotals.totalFarm.yieldKg;
    const farmRevenueRm = grandTotals.totalFarm.revenueRM;
    const farmEbitdaRm = grandTotals.totalFarm.ebitdaRM;
    const totalCashCostRm = grandTotals.totalFarm.cashCostRM;
    const totalCostRm = grandTotals.totalFarm.totalCostRM;
    const averageRealizedPriceRmKg = totalYieldKg > 0 ? Number((farmRevenueRm / totalYieldKg).toFixed(2)) : 0;
    const averageCashCostRmKg = totalYieldKg > 0 ? Number((totalCashCostRm / totalYieldKg).toFixed(2)) : 0;
    const averageTotalCostRmKg = totalYieldKg > 0 ? Number((totalCostRm / totalYieldKg).toFixed(2)) : 0;

    const executiveKpis = {
        totalHarvestMt,
        totalYieldKg,
        farmRevenueRm,
        farmEbitdaRm,
        totalCashCostRm,
        totalCostRm,
        averageRealizedPriceRmKg,
        averageCashCostRmKg,
        averageTotalCostRmKg,
        totalPondsCultured: grandTotals.totalFarm.cyclesCount
    };

    return {
        horizonWeeks,
        baseYear,
        baseMonth,
        scheduleAudit,
        weeklyTimeline,
        weeklyMatrix: weeklyTimeline,
        monthlySummary,
        monthlyMatrix: monthlySummary,
        annualSummary: Array.from(yearsMap.values()).sort((a, b) => a.year - b.year),
        pondCyclesResult,
        grandTotals,
        executiveKpis
    };
}

/**
 * Deterministic seedable PRNG (Mulberry32) for reproducible Monte Carlo risk bands.
 * @param {number} seed
 * @returns {Function} `() => number` in [0, 1)
 */
function createSeededRng(seed = 20261017) {
    let t = seed >>> 0;
    return function () {
        t += 0x6d2b79f5;
        let x = Math.imul(t ^ (t >>> 15), 1 | t);
        x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
        return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Runs a Correlated Monte Carlo Risk Simulation (`P10` Downside Cashflow-at-Risk, `P50` Median, `P90` Upside)
 * where monsoon weather shocks and hatchery batch quality correlate across concurrent ponds in the same month/module.
 *
 * @param {Object} simulationConfig
 * @param {Object} [priors=DEFAULT_EMPIRICAL_PRIORS]
 * @param {Object} [mcOptions={}]
 * @param {number} [mcOptions.iterations=100]
 * @param {number} [mcOptions.seed=20261017]
 * @param {number} [mcOptions.targetYieldMt=1500]
 * @param {number} [mcOptions.targetEbitdaRM=10000000]
 * @returns {Object} `{ iterations, deterministicBaseline, quantiles: { P10, P50, P90 }, probabilities }`
 */
export function runCorrelatedMonteCarlo(
    simulationConfig = {},
    priors = DEFAULT_EMPIRICAL_PRIORS,
    mcOptions = {}
) {
    const iterations = Math.max(10, Math.min(1000, Number(mcOptions.iterations) || 100));
    const rng = createSeededRng(Number(mcOptions.seed) || 20261017);
    const targetYieldMt = Number(mcOptions.targetYieldMt) || 1500;
    const targetEbitdaRM = Number(mcOptions.targetEbitdaRM) || 10000000;

    const deterministicBaseline = run156WeekSimulation(simulationConfig, priors);
    const baseCycles = deterministicBaseline.pondCyclesResult;

    const iterResults = [];

    for (let it = 0; it < iterations; it++) {
        // Generate correlated monthly weather/monsoon factor & module-wave pathogen factor
        const monthlyWeatherFactor = new Map();
        const moduleHatcheryFactor = new Map();

        let iterYieldKg = 0;
        let iterRevenueRM = 0;
        let iterCashCostRM = 0;
        let iterEbitdaRM = 0;

        for (const cyc of baseCycles) {
            const mKey = `${cyc.stockMonth}`;
            if (!monthlyWeatherFactor.has(mKey)) {
                // Correlated normal-like draw around 1.0 (Box-Muller approx via sum of 3 uniforms)
                const u = (rng() + rng() + rng()) / 3 - 0.5;
                const monsoonAmplifier = (cyc.stockMonth >= 9 && cyc.stockMonth <= 12) ? 0.55 : 0.30;
                monthlyWeatherFactor.set(mKey, Math.max(0.55, 1 + u * monsoonAmplifier));
            }

            const modBatchKey = `${cyc.moduleId}::${Math.floor(cyc.startWeekIndex / 4)}::${cyc.stckSource}`;
            if (!moduleHatcheryFactor.has(modBatchKey)) {
                const u = (rng() + rng() + rng()) / 3 - 0.5;
                const mixAmplifier = cyc.pillarMultipliers.pillar3Hatchery.isMixedOrHighRiskHatchery ? 0.65 : 0.28;
                moduleHatcheryFactor.set(modBatchKey, Math.max(0.45, 1 + u * mixAmplifier));
            }

            const wFactor = monthlyWeatherFactor.get(mKey);
            const mFactor = moduleHatcheryFactor.get(modBatchKey);
            const idioFactor = 0.85 + 0.30 * rng();

            const combinedBioFactor = wFactor * mFactor * idioFactor;

            // Outcome draw for this pond cycle
            const drawRoll = rng();
            const cullThresh = Math.min(0.85, cyc.expectedOutcomes.expectedCullProb / Math.max(0.4, combinedBioFactor));
            const forcedThresh = cullThresh + Math.min(
                0.90 - cullThresh,
                cyc.expectedOutcomes.expectedForcedHarvestProb / Math.max(0.4, combinedBioFactor)
            );

            let cycYieldKg;
            let cycRevRM;
            let cycCashCostRM;

            if (drawRoll < cullThresh) {
                // Acute Early Cull (0 kg yield, sunk PL + prep + ~30 days feed/power/overhead)
                cycYieldKg = 0;
                cycRevRM = 0;
                cycCashCostRM = cyc.pnl.costElementsRM.cons_of_fries +
                    cyc.pnl.costElementsRM.cons_of_chem_fert * 0.65 +
                    cyc.pnl.totalCashCostRM * 0.32;
            } else if (drawRoll < forcedThresh) {
                // Forced Harvest Salvage (~55% of healthy yield at salvage price)
                cycYieldKg = cyc.expectedOutcomes.healthyTotalYieldKg * 0.52 * Math.min(1.15, combinedBioFactor);
                cycRevRM = cycYieldKg * (cyc.pnl.realizedSellingPriceRmPerKg * 0.84);
                cycCashCostRM = cyc.pnl.totalCashCostRM * 0.82;
            } else {
                // Normal Healthy Harvest
                cycYieldKg = cyc.expectedOutcomes.healthyTotalYieldKg * Math.max(0.75, Math.min(1.25, combinedBioFactor));
                cycRevRM = cycYieldKg * cyc.pnl.realizedSellingPriceRmPerKg;
                cycCashCostRM = cyc.pnl.totalCashCostRM * (0.92 + 0.08 * combinedBioFactor);
            }

            iterYieldKg += cycYieldKg;
            iterRevenueRM += cycRevRM;
            iterCashCostRM += cycCashCostRM;
            iterEbitdaRM += (cycRevRM - cycCashCostRM);
        }

        iterResults.push({
            yieldMt: iterYieldKg / 1000,
            revenueRM: iterRevenueRM,
            cashCostRM: iterCashCostRM,
            ebitdaRM: iterEbitdaRM
        });
    }

    iterResults.sort((a, b) => a.ebitdaRM - b.ebitdaRM);
    const getQuantile = (q) => {
        const idx = Math.max(0, Math.min(iterResults.length - 1, Math.floor(q * iterResults.length)));
        const r = iterResults[idx];
        return {
            yieldMt: Number(r.yieldMt.toFixed(2)),
            revenueRM: Number(r.revenueRM.toFixed(2)),
            cashCostRM: Number(r.cashCostRM.toFixed(2)),
            ebitdaRM: Number(r.ebitdaRM.toFixed(2))
        };
    };

    const probMeetYieldTargetPct =
        (iterResults.filter(r => r.yieldMt >= targetYieldMt).length / iterations) * 100;
    const probMeetEbitdaTargetPct =
        (iterResults.filter(r => r.ebitdaRM >= targetEbitdaRM).length / iterations) * 100;
    const probPositiveEbitdaPct =
        (iterResults.filter(r => r.ebitdaRM > 0).length / iterations) * 100;

    const p10 = getQuantile(0.10);
    const p50 = getQuantile(0.50);
    const p90 = getQuantile(0.90);

    return {
        iterations,
        deterministicTotals: deterministicBaseline.grandTotals.totalFarm,
        quantiles: {
            P10_Downside: p10,
            P50_Median: p50,
            P90_Upside: p90
        },
        summary: {
            ebitdaP10RM: p10.ebitdaRM,
            ebitdaP50RM: p50.ebitdaRM,
            ebitdaP90RM: p90.ebitdaRM,
            yieldP10Mt: p10.yieldMt,
            yieldP50Mt: p50.yieldMt,
            yieldP90Mt: p90.yieldMt
        },
        probabilities: {
            probMeetYieldTargetPct: Number(probMeetYieldTargetPct.toFixed(1)),
            probMeetEbitdaTargetPct: Number(probMeetEbitdaTargetPct.toFixed(1)),
            probPositiveEbitdaPct: Number(probPositiveEbitdaPct.toFixed(1))
        }
    };
}
