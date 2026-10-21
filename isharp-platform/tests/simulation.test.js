/**
 * iSHARP DBMS 2.0 — Phase 3 Frontier Simulation Engine Unit & Empirical Backtest Suite
 * Runs via Node.js native test runner: `node --test tests/simulation.test.js`
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
    SPECIES,
    GENETIC_LINES,
    CULTURE_STRATEGIES,
    DEFAULT_EMPIRICAL_PRIORS,
    deduplicateByPondIndex,
    classifySpecies,
    resolveGeneticLine,
    calibrateEmpiricalPriors,
    evaluateTurnaroundEffect,
    evaluateModuleEffect,
    evaluateHatcheryAndBroodstockEffect,
    evaluateMonsoonEffect,
    evaluateDensityAndCarryingCapacity,
    inferActivePondGrowthQuantile,
    projectActivePondHarvestDoc,
    simulatePondCycleTrajectory,
    CHEMICAL_FERTILIZER_MRP_CATALOG,
    partitionHarvestQualityGrades,
    calculateEffectiveSellingPrice,
    calculatePondChemicalMRP,
    calculatePondCyclePnL,
    spliceActualYtdWithForecast,
    auditScheduleRisks,
    generateOptimal156WeekSchedule,
    weekIndexToCalendar,
    evaluateActiveShocks,
    run156WeekSimulation,
    runCorrelatedMonteCarlo
} from "../src/domain/simulation/index.js";

describe("Phase 3 Frontier Simulation Engine — Pillar 0 & Calibration", () => {
    it("deduplicateByPondIndex keeps highest index_no per pond_index", () => {
        const raw = [
            { pond_index: "M01-P01-C01", index_no: 101, final_kg: 3000 },
            { pond_index: "M01-P01-C01", index_no: 205, final_kg: 3850 },
            { pond_index: "M01-P02-C01", index_no: 99, final_kg: 4100 }
        ];
        const deduped = deduplicateByPondIndex(raw);
        assert.equal(deduped.length, 2);
        const p1 = deduped.find(r => r.pond_index === "M01-P01-C01");
        assert.equal(p1.index_no, 205);
        assert.equal(p1.final_kg, 3850);
    });

    it("classifySpecies & resolveGeneticLine strictly separate P. Monodon and L. Vannamei", () => {
        assert.equal(classifySpecies({ bsLine: "CP THAI", stockDensity: 44 }), SPECIES.MONODON);
        assert.equal(classifySpecies({ bsLine: "MOANA", stockDensity: 45 }), SPECIES.MONODON);
        assert.equal(classifySpecies({ bsLine: "MADAGASCAR" }), SPECIES.MONODON);
        assert.equal(classifySpecies({ strategy: "DS4" }), SPECIES.MONODON);
        assert.equal(classifySpecies({ bsLine: "SYAQUA", stockDensity: 95 }), SPECIES.VANNAMEI);
        assert.equal(classifySpecies({ bsLine: "API GOLDEN", stockDensity: 96 }), SPECIES.VANNAMEI);

        assert.equal(resolveGeneticLine({ bsLine: "CP THAI" }), GENETIC_LINES.MONODON);
        assert.equal(resolveGeneticLine({ bsLine: "API GOLDEN" }), GENETIC_LINES.SPR);
        assert.equal(resolveGeneticLine({ bsLine: "SYAQUA" }), GENETIC_LINES.SPT);
        assert.equal(resolveGeneticLine({ plType: "SPF" }), GENETIC_LINES.SPF);
    });

    it("CULTURE_STRATEGIES defines all 10 strategies (DS1-DS4, NT1-NT3, PT1-PT3)", () => {
        const expectedCodes = ["DS1", "DS2", "DS3", "DS4", "NT1", "NT2", "NT3", "PT1", "PT2", "PT3"];
        for (const code of expectedCodes) {
            assert.ok(CULTURE_STRATEGIES[code], `Missing strategy ${code}`);
        }
        assert.equal(CULTURE_STRATEGIES.NT2.harvestPlanCount, 2);
        assert.equal(CULTURE_STRATEGIES.PT3.harvestPlanCount, 3);
        assert.equal(CULTURE_STRATEGIES.DS4.speciesDefault, SPECIES.MONODON);
    });
});

describe("Phase 3 Frontier Simulation Engine — Pillars 1 to 4 Biological & Pathology Laws", () => {
    it("Pillar 1: Golden Rest (36-60d DOP) outperforms Rushed Prep (<=20d DOP) and penalizes post-disease relapse", () => {
        const rushed = evaluateTurnaroundEffect(14, false);
        const rushedAfterDisease = evaluateTurnaroundEffect(14, true);
        const goldenRest = evaluateTurnaroundEffect(45, false);
        const goldenAfterDisease = evaluateTurnaroundEffect(45, true);

        assert.equal(rushed.bucketKey, "RUSHED");
        assert.equal(goldenRest.bucketKey, "GOLDEN_REST");
        assert.ok(goldenRest.adgMultiplier > rushed.adgMultiplier);
        assert.ok(rushed.hazardMultiplier > goldenRest.hazardMultiplier);
        assert.ok(rushedAfterDisease.hazardMultiplier > rushed.hazardMultiplier);
        assert.ok(goldenAfterDisease.hazardMultiplier < rushedAfterDisease.hazardMultiplier);
    });

    it("Pillar 2: Captures Species-Divergent Modules (M08 & M09 love Monodon, hate Vannamei) and All-In/All-Out cohesion", () => {
        const m04Van = evaluateModuleEffect({ moduleId: "M04", species: SPECIES.VANNAMEI, olderActivePondsCount: 0 });
        const m08Van = evaluateModuleEffect({ moduleId: "M08", species: SPECIES.VANNAMEI, olderActivePondsCount: 0 });
        const m08Mon = evaluateModuleEffect({ moduleId: "M08", species: SPECIES.MONODON, olderActivePondsCount: 0 });

        assert.equal(m04Van.moduleTier, "CHAMPION");
        assert.equal(m08Van.isSpeciesModuleMismatch, true);
        assert.equal(m08Mon.isSpeciesModuleMismatch, false);
        assert.equal(m08Mon.moduleTier, "MONODON_STRONGHOLD");
        assert.ok(m08Mon.hazardMultiplier < m08Van.hazardMultiplier);

        // Staggered overlap vs All-In/All-Out
        const staggered = evaluateModuleEffect({ moduleId: "M04", species: SPECIES.VANNAMEI, olderActivePondsCount: 4 });
        assert.equal(staggered.cohesionMode, "STAGGERED_OVERLAP");
        assert.ok(m04Van.adgMultiplier > staggered.adgMultiplier);
        assert.ok(staggered.hazardMultiplier > m04Van.hazardMultiplier);
    });

    it("Pillar 3: Penalizes Multi-Hatchery Tank Mixing (SHT,GS) and Secondary Hatcheries (GSR) vs Tier-1 Single (SHT)", () => {
        const cleanSingle = evaluateHatcheryAndBroodstockEffect({
            species: SPECIES.VANNAMEI,
            bsLine: "API GOLDEN",
            stckSource: "SHT",
            monthlyLinePondsCount: 15
        });
        const mixedTank = evaluateHatcheryAndBroodstockEffect({
            species: SPECIES.VANNAMEI,
            bsLine: "SYAQUA",
            stckSource: "SHT,GS",
            monthlyLinePondsCount: 15
        });
        const tier2Gsr = evaluateHatcheryAndBroodstockEffect({
            species: SPECIES.VANNAMEI,
            bsLine: "SYAQUA",
            stckSource: "GSR",
            monthlyLinePondsCount: 15
        });

        assert.equal(cleanSingle.isMixedOrHighRiskHatchery, false);
        assert.equal(mixedTank.isMixedOrHighRiskHatchery, true);
        assert.equal(tier2Gsr.isMixedOrHighRiskHatchery, true);
        assert.ok(mixedTank.hazardMultiplier > cleanSingle.hazardMultiplier * 1.8);
        assert.ok(cleanSingle.survivalMultiplier > mixedTank.survivalMultiplier);
    });

    it("Pillar 3 & 4: Reproduces Setiu Northeast Monsoon Stocking Cliff for both Monodon (Sep-Oct) and Vannamei (Nov)", () => {
        const monApr = evaluateMonsoonEffect(4, SPECIES.MONODON);
        const monSep = evaluateMonsoonEffect(9, SPECIES.MONODON);
        assert.equal(monApr.isMonsoonCliff, false);
        assert.equal(monSep.isMonsoonCliff, true);
        assert.ok(monSep.hazardMultiplier > monApr.hazardMultiplier * 3.0);

        const vanJul = evaluateMonsoonEffect(7, SPECIES.VANNAMEI);
        const vanNov = evaluateMonsoonEffect(11, SPECIES.VANNAMEI);
        assert.equal(vanJul.isMonsoonCliff, false);
        assert.equal(vanNov.isMonsoonCliff, true);
        assert.ok(vanJul.adgMultiplier > vanNov.adgMultiplier);
        assert.ok(vanNov.hazardMultiplier > vanJul.hazardMultiplier);
    });

    it("Pillar 4: 2X and 3X Partial Harvest strategies relieve carrying capacity and boost total yield & EBITDA vs 1X", () => {
        const ds1Traj = simulatePondCycleTrajectory({
            pondId: "M04-P01",
            moduleId: "M04",
            strategyCode: "DS1",
            species: SPECIES.VANNAMEI,
            bsLine: "API GOLDEN",
            stckSource: "SHT",
            stockDensityPlM2: 96,
            stockMonth: 4,
            dopDays: 45
        });
        const ds2Traj = simulatePondCycleTrajectory({
            pondId: "M04-P01",
            moduleId: "M04",
            strategyCode: "DS2",
            species: SPECIES.VANNAMEI,
            bsLine: "API GOLDEN",
            stckSource: "SHT",
            stockDensityPlM2: 112,
            stockMonth: 4,
            dopDays: 45
        });
        const ds3Traj = simulatePondCycleTrajectory({
            pondId: "M04-P01",
            moduleId: "M04",
            strategyCode: "DS3",
            species: SPECIES.VANNAMEI,
            bsLine: "API GOLDEN",
            stckSource: "SHT",
            stockDensityPlM2: 122,
            stockMonth: 4,
            dopDays: 45
        });

        assert.equal(ds1Traj.partialHarvestEvents.length, 0);
        assert.equal(ds2Traj.partialHarvestEvents.length, 1);
        assert.equal(ds3Traj.partialHarvestEvents.length, 2);

        assert.ok(ds2Traj.expectedOutcomes.expectedTotalYieldKg > ds1Traj.expectedOutcomes.expectedTotalYieldKg);
        assert.ok(ds3Traj.expectedOutcomes.expectedTotalYieldKg > ds2Traj.expectedOutcomes.expectedTotalYieldKg);

        const pnl1 = calculatePondCyclePnL(ds1Traj);
        const pnl2 = calculatePondCyclePnL(ds2Traj);
        const pnl3 = calculatePondCyclePnL(ds3Traj);
        assert.ok(pnl2.ebitdaRM > pnl1.ebitdaRM);
        assert.ok(pnl3.ebitdaRM > pnl2.ebitdaRM);
    });

    it("Pillar 4: Bayesian active-pond conditioning adjusts growth quantile from biometrics_sampling", () => {
        const fastPond = inferActivePondGrowthQuantile(SPECIES.VANNAMEI, 60, 15.5);
        const slowPond = inferActivePondGrowthQuantile(SPECIES.VANNAMEI, 60, 7.2);

        assert.equal(fastPond.isConditioned, true);
        assert.ok(fastPond.bayesianAdgMultiplier > 1.15);
        assert.ok(fastPond.estimatedPercentile > 65);

        assert.equal(slowPond.isConditioned, true);
        assert.ok(slowPond.bayesianAdgMultiplier < 0.85);
        assert.ok(slowPond.estimatedPercentile < 35);
    });

    it("Pillar 4: projectActivePondHarvestDoc projects harvest out to target final DOC and conditions on sampling", () => {
        // 1. Unconditioned active pond (e.g. DOC 47 on DS1 target 92d)
        const unconditioned = projectActivePondHarvestDoc({
            species: SPECIES.VANNAMEI,
            strategyCode: "DS1",
            docDays: 47
        });
        assert.equal(unconditioned.isConditioned, false);
        assert.equal(unconditioned.targetFinalDoc, 92);
        assert.equal(unconditioned.durationWeeks, 14); // Math.ceil(92 / 7) = 14

        // 2. High growth pond (DOC 47, sampled at DOC 45 with high ABW 12.5g vs typical ~7.5g)
        const fastPond = projectActivePondHarvestDoc(
            { species: SPECIES.VANNAMEI, strategyCode: "DS1", docDays: 47 },
            { smplDoc: 45, smplAbw: 12.5 }
        );
        assert.equal(fastPond.isConditioned, true);
        assert.ok(fastPond.targetFinalDoc < 92, `Expected fast pond harvest DOC < 92, got ${fastPond.targetFinalDoc}`);
        assert.ok(fastPond.targetFinalDoc >= 92 - 14, "Within -14d clamp");

        // 3. Slow growth pond (DOC 47, sampled at DOC 45 with low ABW 4.0g)
        const slowPond = projectActivePondHarvestDoc(
            { species: SPECIES.VANNAMEI, strategyCode: "DS1", docDays: 47 },
            { smplDoc: 45, smplAbw: 4.0 }
        );
        assert.equal(slowPond.isConditioned, true);
        assert.ok(slowPond.targetFinalDoc > 92, `Expected slow pond harvest DOC > 92, got ${slowPond.targetFinalDoc}`);
        assert.ok(slowPond.targetFinalDoc <= 92 + 14, "Within +14d clamp");

        // 4. Clamping safety: target DOC never projects in the past (at least currentDoc + 7)
        const latePond = projectActivePondHarvestDoc({
            species: SPECIES.VANNAMEI,
            strategyCode: "DS1",
            docDays: 95
        });
        assert.ok(latePond.targetFinalDoc >= 102); // 95 + 7
    });
});

describe("Phase 3 Frontier Simulation Engine — Pillar 5 Financial & Chemicals/Fertilizers (cons_of_chem_fert)", () => {
    it("Calculates Chemicals & Fertilizers (cons_of_chem_fert) aligned with Finance Table empirical priors", () => {
        assert.equal(CHEMICAL_FERTILIZER_MRP_CATALOG.length, 0); // Deprecated synthetic 28-catalog
        const mrpVannamei = calculatePondChemicalMRP({ species: SPECIES.VANNAMEI, areaHa: 0.5, dopDays: 45, activeDocDays: 92 });
        assert.equal(mrpVannamei.items.length, 0);
        assert.ok(mrpVannamei.prepCostRM > 0);
        assert.ok(mrpVannamei.cultureCostRM > 0);
        assert.equal(Number((mrpVannamei.prepCostRM + mrpVannamei.cultureCostRM).toFixed(2)), mrpVannamei.totalChemFertCostRM);
        assert.equal(mrpVannamei.totalChemFertCostRM, 1711.0); // Vannamei empirical ground truth

        const mrpMonodon = calculatePondChemicalMRP({ species: SPECIES.MONODON, areaHa: 0.5, dopDays: 45, activeDocDays: 112 });
        assert.equal(mrpMonodon.totalChemFertCostRM, 2114.0); // Monodon empirical ground truth at standard 112-day DOC

        // Shorter culture (DOC 92 vs 112 std) scales down culture chemical consumption proportionally
        const mrpMonodonShorter = calculatePondChemicalMRP({ species: SPECIES.MONODON, areaHa: 0.5, dopDays: 45, activeDocDays: 92 });
        assert.equal(mrpMonodonShorter.totalChemFertCostRM, 1887.50);
    });

    it("Models Electricity strictly as RM/active pond-day (~RM 95.40/d) and dilutes fixed overhead by active pond count", () => {
        const traj = simulatePondCycleTrajectory({
            pondId: "M04-P01",
            moduleId: "M04",
            strategyCode: "DS4",
            species: SPECIES.MONODON,
            bsLine: "CP THAI",
            stckSource: "KSK",
            stockMonth: 4,
            dopDays: 45
        });

        const pnlHighUtil = calculatePondCyclePnL(traj, { concurrentActivePondsOnFarm: 160 });
        const pnlLowUtil = calculatePondCyclePnL(traj, { concurrentActivePondsOnFarm: 45 });

        const expectedElec = Number(
            (traj.expectedOutcomes.expectedActiveDocDays * DEFAULT_EMPIRICAL_PRIORS.financialRates.electricityRmPerActivePondDay).toFixed(2)
        );
        assert.equal(pnlHighUtil.costElementsRM.electricity, expectedElec);

        // When active ponds drop from 160 to 45 (like Q4 2025 / Q1 2026), allocated fixed overhead per pond spikes
        assert.ok(pnlLowUtil.costElementsRM.wages_indirect > pnlHighUtil.costElementsRM.wages_indirect * 3);
        assert.ok(pnlLowUtil.costElementsRM.depreciation_fc > pnlHighUtil.costElementsRM.depreciation_fc * 3);
        assert.ok(pnlHighUtil.ebitdaRM > pnlLowUtil.ebitdaRM);
    });

    it("Splices Actual YTD + Rolling Forecast into Full-Year LE and computes Variance vs BP", () => {
        const actuals = [
            { month: 1, stockedPonds: 20, pondsHarvested: 15, yieldKg: 60000, revenueRM: 1320000, cashCostRM: 950000, ebitdaRM: 370000 },
            { month: 2, stockedPonds: 25, pondsHarvested: 18, yieldKg: 72000, revenueRM: 1650000, cashCostRM: 1100000, ebitdaRM: 550000 }
        ];
        const forecast = Array.from({ length: 12 }, (_, idx) => ({
            month: idx + 1,
            stockedPonds: 30,
            pondsHarvested: 22,
            yieldKg: 85000,
            revenueRM: 1870000,
            cashCostRM: 1300000,
            ebitdaRM: 570000
        }));
        const bp = Array.from({ length: 12 }, (_, idx) => ({
            month: idx + 1,
            stockedPonds: 28,
            pondsHarvested: 20,
            yieldKg: 80000,
            revenueRM: 1760000,
            cashCostRM: 1250000,
            ebitdaRM: 510000
        }));

        const spliced = spliceActualYtdWithForecast({
            actualMonths: actuals,
            forecastMonths: forecast,
            bpMonths: bp,
            cutoffMonth: 2
        });

        assert.equal(spliced.splicedMonths[0].sourceType, "ACTUAL_YTD");
        assert.equal(spliced.splicedMonths[1].sourceType, "ACTUAL_YTD");
        assert.equal(spliced.splicedMonths[2].sourceType, "ROLLING_FORECAST");
        assert.equal(spliced.actualYtdTotal.yieldKg, 132000);
        assert.equal(spliced.rollingRemainingTotal.yieldKg, 850000);
        assert.equal(spliced.fullYearLatestEstimate.yieldKg, 982000);
        assert.equal(spliced.fullYearBusinessPlan.yieldKg, 960000);
        assert.equal(spliced.varianceLeVsBp.yieldKgDiff, 22000);
    });
});

describe("Phase 3 Frontier Simulation Engine — 156-Week Scheduler, Risk Auditor & Monte Carlo", () => {
    it("auditScheduleRisks detects all 6 empirical hazard violations in a flawed schedule", () => {
        const badSchedule = [
            // Older pond in M08
            {
                pondId: "M08-P01",
                moduleId: "M08",
                species: SPECIES.VANNAMEI, // Mismatch in M08!
                bsLine: "SYAQUA",
                stckSource: "SHT,GS",       // Mixed hatchery!
                stockDensityPlM2: 135,      // Overcrowded!
                startWeekIndex: 1,
                stockMonth: 11,             // Monsoon cliff!
                dopDays: 14,                // Rushed turnaround!
                prevHadDisease: true
            },
            // Second pond stocked 5 weeks later into same module M08 (Staggered overlap!)
            {
                pondId: "M08-P02",
                moduleId: "M08",
                species: SPECIES.VANNAMEI,
                bsLine: "SYAQUA",
                stckSource: "SHT",
                stockDensityPlM2: 95,
                startWeekIndex: 6,
                stockMonth: 2,
                dopDays: 45
            }
        ];

        const audit = auditScheduleRisks(badSchedule);
        assert.ok(audit.totalAlerts >= 6);
        assert.ok(audit.alertsByCategory.RUSHED_TURNAROUND >= 1);
        assert.ok(audit.alertsByCategory.STAGGERED_MODULE_OVERLAP >= 1);
        assert.ok(audit.alertsByCategory.SPECIES_MODULE_MISMATCH >= 1);
        assert.ok(audit.alertsByCategory.MONSOON_CLIFF_EXPOSURE >= 1);
        assert.ok(audit.alertsByCategory.HATCHERY_MIXING_OVERFLOW >= 1);
        assert.ok(audit.alertsByCategory.OVERCROWDED_DENSITY >= 1);
    });

    it("generateOptimal156WeekSchedule produces a 3-year schedule with ZERO empirical violations", () => {
        const samplePonds = [
            { pondId: "M04-P01", moduleId: "M04", areaHa: 0.5 },
            { pondId: "M04-P02", moduleId: "M04", areaHa: 0.5 },
            { pondId: "M08-P01", moduleId: "M08", areaHa: 0.5 },
            { pondId: "M08-P02", moduleId: "M08", areaHa: 0.5 }
        ];

        const optimalSchedule = generateOptimal156WeekSchedule(samplePonds, {
            horizonWeeks: 156,
            baseYear: 2026,
            baseMonth: 1
        });

        assert.ok(optimalSchedule.length >= 20);
        const audit = auditScheduleRisks(optimalSchedule);
        assert.equal(audit.totalAlerts, 0, `Expected 0 alerts on optimal schedule, got: ${JSON.stringify(audit.alerts)}`);

        // Run full 156-week simulation on the optimal schedule
        const simResult = run156WeekSimulation({
            scheduledCycles: optimalSchedule,
            horizonWeeks: 156,
            baseYear: 2026,
            baseMonth: 1
        });

        assert.equal(simResult.weeklyTimeline.length, 156);
        assert.ok(simResult.monthlySummary.length >= 35);
        assert.ok(simResult.grandTotals.totalFarm.yieldMt > 0);
        assert.ok(simResult.grandTotals.totalFarm.ebitdaRM > 0);
        assert.ok(simResult.grandTotals.bySpecies.MONODON.ebitdaRM > 0);
        assert.ok(simResult.grandTotals.bySpecies.VANNAMEI.ebitdaRM > 0);
    });

    it("generateOptimal156WeekSchedule enforces <=50 ponds/mo, M01-M03 monsoon elevation & 4-week spread", () => {
        const fullFarmPonds = [];
        for (let m = 1; m <= 10; m++) {
            const mStr = String(m).padStart(2, "0");
            for (let p = 1; p <= 24; p++) {
                fullFarmPonds.push({
                    pondId: `${mStr}.01.${String(p).padStart(2, "0")}`,
                    moduleId: mStr,
                    areaHa: 0.5
                });
            }
        }

        const schedule = generateOptimal156WeekSchedule(fullFarmPonds, {
            horizonWeeks: 52,
            baseYear: 2026,
            baseMonth: 1,
            maxPondsPerMonth: 50
        });

        // 1. Verify monthly stocking counts across all 12 months never exceed 50
        const monthlyCounts = {};
        for (const c of schedule) {
            const cal = weekIndexToCalendar(c.startWeekIndex, 2026, 1);
            const mKey = `M${cal.month}`;
            monthlyCounts[mKey] = (monthlyCounts[mKey] || 0) + 1;
        }

        for (const [mKey, count] of Object.entries(monthlyCounts)) {
            assert.ok(count <= 50, `Month ${mKey} had ${count} ponds stocked, which exceeds 50-pond limit!`);
        }

        // 2. Verify only elevated modules (M01, M02, M03) stock during peak monsoon (Months 11-12)
        const monsoonCycles = schedule.filter(c => c.stockMonth === 11 || c.stockMonth === 12);
        const monsoonMods = new Set(monsoonCycles.map(c => c.moduleId));
        for (const mod of monsoonMods) {
            assert.ok(["01", "02", "03"].includes(mod), `Non-elevated module ${mod} was stocked during monsoon!`);
        }
        for (const c of monsoonCycles) {
            assert.equal(c.strategyCode, "DS2", "Monsoon stocking in elevated modules must use hardy SPR DS2");
            assert.equal(c.plType, "SPR");
        }

        // 3. Verify 4-week spread: within any 24-pond module wave, ponds are spread across 4 weeks (~6 ponds/wk)
        const m01Wave1 = schedule.filter(c => c.moduleId === "01" && c.startWeekIndex <= 6);
        const startWeeks = new Set(m01Wave1.map(c => c.startWeekIndex));
        assert.ok(startWeeks.size >= 4, `Module 01 should be spread across 4 distinct weeks, got: ${Array.from(startWeeks)}`);
    });

    it("Evaluates time-scoped TemporalShockEvent and Correlated Monte Carlo P10/P50/P90 risk bands", () => {
        const samplePonds = [
            { pondId: "M04-P01", moduleId: "M04", areaHa: 0.5 },
            { pondId: "M08-P01", moduleId: "M08", areaHa: 0.5 }
        ];
        const schedule = generateOptimal156WeekSchedule(samplePonds, { horizonWeeks: 52 });

        const baseSim = run156WeekSimulation({ scheduledCycles: schedule, horizonWeeks: 52 });
        const shockedSim = run156WeekSimulation({
            scheduledCycles: schedule,
            horizonWeeks: 52,
            shocks: [
                {
                    id: "shock_energy_feed",
                    startWeek: 1,
                    durationWeeks: 52,
                    targetScope: { type: "FARM_WIDE" },
                    impactModifiers: {
                        electricityTariffMultiplier: 1.30,
                        feedCostMultiplier: 1.15
                    }
                }
            ]
        });

        assert.ok(shockedSim.grandTotals.totalFarm.cashCostRM > baseSim.grandTotals.totalFarm.cashCostRM);
        assert.ok(shockedSim.grandTotals.totalFarm.ebitdaRM < baseSim.grandTotals.totalFarm.ebitdaRM);

        const mc = runCorrelatedMonteCarlo({ scheduledCycles: schedule, horizonWeeks: 52 }, DEFAULT_EMPIRICAL_PRIORS, {
            iterations: 50,
            seed: 42
        });

        assert.equal(mc.iterations, 50);
        assert.ok(mc.quantiles.P10_Downside.ebitdaRM <= mc.quantiles.P50_Median.ebitdaRM);
        assert.ok(mc.quantiles.P50_Median.ebitdaRM <= mc.quantiles.P90_Upside.ebitdaRM);
    });

    it("generateOptimal156WeekSchedule rotates Monodon across all modules (supervisor equity), enforces <=30% seed cap, and aims for 2 cycles/year", () => {
        const fullFarmPonds = [];
        for (let m = 1; m <= 10; m++) {
            const mStr = String(m).padStart(2, "0");
            for (let p = 1; p <= 24; p++) {
                fullFarmPonds.push({
                    pondId: `${mStr}.01.${String(p).padStart(2, "0")}`,
                    moduleId: mStr,
                    areaHa: 0.5
                });
            }
        }

        const schedule = generateOptimal156WeekSchedule(fullFarmPonds, {
            horizonWeeks: 156,
            baseYear: 2026,
            baseMonth: 1
        });

        // 1. Audit risks: must have zero empirical violations
        const audit = auditScheduleRisks(schedule);
        assert.equal(audit.totalAlerts, 0, `Expected 0 violations, got: ${JSON.stringify(audit.alerts)}`);

        // 2. Check supervisor equity: modules across the farm get a taste of Monodon over the 3-year horizon
        const monodonModules = new Set(schedule.filter(c => c.species === SPECIES.MONODON).map(c => c.moduleId));
        assert.ok(monodonModules.size >= 8, `Expected at least 8 modules to get Monodon rotation, got ${monodonModules.size}`);

        // 3. Farm-wide annual Monodon ratio <= 30% for each calendar year
        const byYear = {};
        for (const c of schedule) {
            const cal = weekIndexToCalendar(c.startWeekIndex, 2026, 1);
            if (!byYear[cal.year]) byYear[cal.year] = { total: 0, monodon: 0 };
            byYear[cal.year].total += 1;
            if (c.species === SPECIES.MONODON) byYear[cal.year].monodon += 1;
        }

        for (const [yr, stats] of Object.entries(byYear)) {
            const ratio = stats.monodon / stats.total;
            assert.ok(ratio <= 0.35, `Year ${yr} Monodon ratio ${ratio.toFixed(2)} exceeded cap!`);
        }
    });
});
