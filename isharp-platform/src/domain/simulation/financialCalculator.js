/**
 * iSHARP DBMS 2.0 — Frontier Simulation Engine (Phase 3)
 * Module: financialCalculator.js
 *
 * PURE DOMAIN MODULE (Zero DOM dependencies, Zero network/fetch calls).
 *
 * Implements:
 * 1. 4-Tier Commercial Quality Grade Partition (`Premium`, `Grade 2`, `Small`, `BelowAvg`) & Festive Pricing
 * 2. 28 Pond-Prep & Culture Chemicals/Fertilizers MRP Engine
 * 3. 16-Element Econometric Pond & Farm P&L Calculator (with `electricity` strictly as RM/active pond-day)
 * 4. Spliced Executive Reporting (`Actual YTD + Rolling Forecast = Full-Year LE` vs `BP`)
 */

import { SPECIES, DEFAULT_EMPIRICAL_PRIORS } from "./baselineCalibrator.js";

/**
 * Complete 28-Item Pond-Prep & Culture Chemicals / Fertilizers Catalog (matching `wek` & `mth` MRP).
 */
export const CHEMICAL_FERTILIZER_MRP_CATALOG = Object.freeze([
    { code: "CH01", name: "Dolomite",                 unit: "kg", prepPerHaM01_10: 1200, prepPerHaM11: 400, weeklyPerHa: 80,  unitPriceRM: 0.42 },
    { code: "CH02", name: "Ca(ClO)2 Gas (Chlorine)",  unit: "kg", prepPerHaM01_10: 50,   prepPerHaM11: 25,  weeklyPerHa: 0,   unitPriceRM: 6.80 },
    { code: "CH03", name: "Ca(ClO)2 Powder (70%)",    unit: "kg", prepPerHaM01_10: 120,  prepPerHaM11: 60,  weeklyPerHa: 5,   unitPriceRM: 7.50 },
    { code: "CH04", name: "CaCO3 (Agri Lime)",        unit: "kg", prepPerHaM01_10: 800,  prepPerHaM11: 300, weeklyPerHa: 60,  unitPriceRM: 0.38 },
    { code: "CH05", name: "Ca(OH)2 (Hydrated Lime)",  unit: "kg", prepPerHaM01_10: 300,  prepPerHaM11: 100, weeklyPerHa: 25,  unitPriceRM: 0.65 },
    { code: "CH06", name: "Grain Pellet (Ferment)",   unit: "kg", prepPerHaM01_10: 60,   prepPerHaM11: 20,  weeklyPerHa: 10,  unitPriceRM: 2.10 },
    { code: "CH07", name: "Rice Bran",                unit: "kg", prepPerHaM01_10: 80,   prepPerHaM11: 30,  weeklyPerHa: 12,  unitPriceRM: 1.65 },
    { code: "CH08", name: "Molasses",                 unit: "kg", prepPerHaM01_10: 100,  prepPerHaM11: 40,  weeklyPerHa: 35,  unitPriceRM: 1.45 },
    { code: "CH09", name: "Tea Seed Cake (Saponin)",  unit: "kg", prepPerHaM01_10: 45,   prepPerHaM11: 15,  weeklyPerHa: 4,   unitPriceRM: 3.90 },
    { code: "CH10", name: "Urea Fertilizer",          unit: "kg", prepPerHaM01_10: 25,   prepPerHaM11: 10,  weeklyPerHa: 2,   unitPriceRM: 2.80 },
    { code: "CH11", name: "TSP (Triple Super Phos)",  unit: "kg", prepPerHaM01_10: 15,   prepPerHaM11: 5,   weeklyPerHa: 1,   unitPriceRM: 3.10 },
    { code: "CH12", name: "PVP-I (Povidone Iodine)",  unit: "L",  prepPerHaM01_10: 4,    prepPerHaM11: 2,   weeklyPerHa: 0.8, unitPriceRM: 28.00 },
    { code: "CH13", name: "CuSO4 (Copper Sulfate)",   unit: "kg", prepPerHaM01_10: 8,    prepPerHaM11: 2,   weeklyPerHa: 0.5, unitPriceRM: 12.50 },
    { code: "CH14", name: "BKC (Benzalkonium 80%)",   unit: "L",  prepPerHaM01_10: 6,    prepPerHaM11: 3,   weeklyPerHa: 1.0, unitPriceRM: 22.00 },
    { code: "CH15", name: "EM Activated Probiotic",   unit: "L",  prepPerHaM01_10: 40,   prepPerHaM11: 20,  weeklyPerHa: 25,  unitPriceRM: 3.20 },
    { code: "CH16", name: "Super Biotic (Bacillus)",  unit: "kg", prepPerHaM01_10: 4,    prepPerHaM11: 2,   weeklyPerHa: 2.2, unitPriceRM: 48.00 },
    { code: "CH17", name: "HCl (Hydrochloric Acid)",  unit: "L",  prepPerHaM01_10: 20,   prepPerHaM11: 10,  weeklyPerHa: 0,   unitPriceRM: 2.40 },
    { code: "CH18", name: "KMnO4 (Pot. Permanganate)",unit: "kg", prepPerHaM01_10: 5,    prepPerHaM11: 2,   weeklyPerHa: 0.2, unitPriceRM: 19.50 },
    { code: "CH19", name: "Zeolite Granular",         unit: "kg", prepPerHaM01_10: 200,  prepPerHaM11: 50,  weeklyPerHa: 40,  unitPriceRM: 0.85 },
    { code: "CH20", name: "Sodium Bicarbonate",       unit: "kg", prepPerHaM01_10: 50,   prepPerHaM11: 20,  weeklyPerHa: 30,  unitPriceRM: 1.95 },
    { code: "CH21", name: "Magnesium Chloride",       unit: "kg", prepPerHaM01_10: 80,   prepPerHaM11: 25,  weeklyPerHa: 20,  unitPriceRM: 1.35 },
    { code: "CH22", name: "Potassium Chloride (KCl)", unit: "kg", prepPerHaM01_10: 40,   prepPerHaM11: 15,  weeklyPerHa: 12,  unitPriceRM: 2.60 },
    { code: "CH23", name: "Calcium Chloride",         unit: "kg", prepPerHaM01_10: 40,   prepPerHaM11: 15,  weeklyPerHa: 10,  unitPriceRM: 1.80 },
    { code: "CH24", name: "Vitamin C Feed Coat",      unit: "kg", prepPerHaM01_10: 0,    prepPerHaM11: 0,   weeklyPerHa: 1.2, unitPriceRM: 36.00 },
    { code: "CH25", name: "Gut Probiotic Binder",     unit: "kg", prepPerHaM01_10: 0,    prepPerHaM11: 0,   weeklyPerHa: 1.5, unitPriceRM: 42.00 },
    { code: "CH26", name: "Trace Mineral Premix",     unit: "kg", prepPerHaM01_10: 15,   prepPerHaM11: 5,   weeklyPerHa: 6.0, unitPriceRM: 6.50 },
    { code: "CH27", name: "Hydrogen Peroxide (50%)",  unit: "L",  prepPerHaM01_10: 10,   prepPerHaM11: 5,   weeklyPerHa: 1.5, unitPriceRM: 4.80 },
    { code: "CH28", name: "Formalin Disinfectant",    unit: "L",  prepPerHaM01_10: 12,   prepPerHaM11: 6,   weeklyPerHa: 0,   unitPriceRM: 5.20 }
]);

/**
 * Partitions harvested shrimp biomass into the 4 commercial quality grades
 * (`Premium`, `Grade2`, `Small`, `BelowAvg`) based on species, ABW, density, and forced-harvest status.
 *
 * @param {Object} params
 * @param {"MONODON"|"VANNAMEI"} params.species
 * @param {number} params.abwGrams
 * @param {boolean} [params.isForcedHarvest=false]
 * @param {number} [params.densityPlM2=95]
 * @returns {Object} Grade weight shares summing to 1.0 (`{ premium, grade2, small, belowAvg }`)
 */
export function partitionHarvestQualityGrades({
    species = SPECIES.VANNAMEI,
    abwGrams = 15.0,
    isForcedHarvest = false,
    densityPlM2 = 95
} = {}) {
    const abw = Math.max(4, Number(abwGrams) || 15);
    const sd = Number(densityPlM2) || 95;

    if (isForcedHarvest) {
        // Forced harvests (EHP/EMS/WSSV) have elevated softshell/small/chilled shares
        if (abw < 11) {
            return { premium: 0.08, grade2: 0.27, small: 0.40, belowAvg: 0.25 };
        }
        return { premium: 0.22, grade2: 0.38, small: 0.22, belowAvg: 0.18 };
    }

    if (species === SPECIES.MONODON) {
        if (abw >= 30) return { premium: 0.68, grade2: 0.22, small: 0.06, belowAvg: 0.04 };
        if (abw >= 24) return { premium: 0.56, grade2: 0.28, small: 0.10, belowAvg: 0.06 };
        return { premium: 0.38, grade2: 0.34, small: 0.18, belowAvg: 0.10 };
    }

    // Healthy Vannamei grading
    const crowdingPenalty = sd >= 120 ? 0.06 : 0;
    if (abw >= 20) {
        return {
            premium: Number((0.64 - crowdingPenalty).toFixed(3)),
            grade2: 0.24,
            small: Number((0.08 + crowdingPenalty / 2).toFixed(3)),
            belowAvg: Number((0.04 + crowdingPenalty / 2).toFixed(3))
        };
    }
    if (abw >= 15) {
        return {
            premium: Number((0.52 - crowdingPenalty).toFixed(3)),
            grade2: 0.30,
            small: Number((0.12 + crowdingPenalty / 2).toFixed(3)),
            belowAvg: Number((0.06 + crowdingPenalty / 2).toFixed(3))
        };
    }
    return {
        premium: 0.30,
        grade2: 0.34,
        small: 0.26,
        belowAvg: 0.10
    };
}

/**
 * Calculates the realized selling price (RM/kg) for a harvest lot based on Species,
 * ABW (tail count per kg), 4-Tier Quality Grades, and Festive Calendar Multipliers.
 *
 * @param {Object} params
 * @param {"MONODON"|"VANNAMEI"} params.species
 * @param {number} params.abwGrams
 * @param {number} [params.harvestMonth=6] 1..12
 * @param {boolean} [params.isForcedHarvest=false]
 * @param {number} [params.densityPlM2=95]
 * @param {number} [params.priceShiftRM=0] War Room macro price shift (+/- RM/kg)
 * @param {Object} [priors=DEFAULT_EMPIRICAL_PRIORS]
 * @returns {Object} `{ effectivePriceRmPerKg, tailCountPerKg, gradeShares, gradePricesRM, festiveMultiplier }`
 */
export function calculateEffectiveSellingPrice({
    species = SPECIES.VANNAMEI,
    abwGrams = 15.0,
    harvestMonth = 6,
    isForcedHarvest = false,
    densityPlM2 = 95,
    priceShiftRM = 0
} = {}, priors = DEFAULT_EMPIRICAL_PRIORS) {
    const sp = species === SPECIES.MONODON ? SPECIES.MONODON : SPECIES.VANNAMEI;
    const abw = Math.max(4, Number(abwGrams) || (sp === SPECIES.MONODON ? 29.9 : 14.7));
    const tailCountPerKg = Math.round(1000 / abw);

    let premiumBaseRM;
    if (sp === SPECIES.MONODON) {
        // Monodon size price curve (calibrated around RM 27.58/kg at 30g)
        if (abw >= 35) premiumBaseRM = 33.50;
        else if (abw >= 30) premiumBaseRM = 30.20;
        else if (abw >= 25) premiumBaseRM = 27.00;
        else if (abw >= 20) premiumBaseRM = 23.80;
        else premiumBaseRM = 20.50;
    } else {
        // Vannamei size price curve (calibrated around RM 20.34/kg at 14.7g)
        if (abw >= 24) premiumBaseRM = 26.80;
        else if (abw >= 20) premiumBaseRM = 24.40;
        else if (abw >= 17) premiumBaseRM = 22.50;
        else if (abw >= 14.5) premiumBaseRM = 21.20;
        else if (abw >= 12) premiumBaseRM = 19.40;
        else premiumBaseRM = 16.80;
    }

    const gradePricesRM = {
        premium: premiumBaseRM,
        grade2: Number((premiumBaseRM * 0.91).toFixed(2)),
        small: Number((premiumBaseRM * 0.78).toFixed(2)),
        belowAvg: Number((premiumBaseRM * 0.62).toFixed(2))
    };

    const gradeShares = partitionHarvestQualityGrades({
        species: sp,
        abwGrams: abw,
        isForcedHarvest,
        densityPlM2
    });

    const weightedBaseRM =
        gradeShares.premium * gradePricesRM.premium +
        gradeShares.grade2 * gradePricesRM.grade2 +
        gradeShares.small * gradePricesRM.small +
        gradeShares.belowAvg * gradePricesRM.belowAvg;

    const m = Math.max(1, Math.min(12, Math.round(Number(harvestMonth) || 6)));
    const festiveMultiplier = priors.festivePriceMultipliersByMonth?.[m] || 1.0;

    const effectivePriceRmPerKg = Math.max(
        8.0,
        weightedBaseRM * festiveMultiplier + (Number(priceShiftRM) || 0)
    );

    return {
        species: sp,
        abwGrams: Number(abw.toFixed(2)),
        tailCountPerKg,
        harvestMonth: m,
        festiveMultiplier,
        gradeShares,
        gradePricesRM,
        effectivePriceRmPerKg: Number(effectivePriceRmPerKg.toFixed(2))
    };
}

/**
 * Calculates the 28 Pond-Prep & Culture Chemicals/Fertilizers MRP quantities & costs
 * for a pond cycle.
 *
 * @param {Object} params
 * @param {string} [params.moduleId="01"]
 * @param {number} [params.areaHa=0.5]
 * @param {number} [params.dopDays=45]
 * @param {boolean} [params.prevHadDisease=false]
 * @param {number} [params.activeDocDays=90]
 * @param {number} [params.mineralCostMultiplier=1.0]
 * @returns {Object} `{ items: Array, prepCostRM, cultureCostRM, totalChemFertCostRM }`
 */
export function calculatePondChemicalMRP({
    moduleId = "01",
    areaHa = 0.5,
    dopDays = 45,
    prevHadDisease = false,
    activeDocDays = 90,
    mineralCostMultiplier = 1.0
} = {}) {
    const isM11 = String(moduleId).includes("11");
    const ha = Math.max(0.05, Number(areaHa) || 0.5);
    const activeWeeks = Math.max(1, (Number(activeDocDays) || 90) / 7);
    const costMult = Number(mineralCostMultiplier) || 1.0;

    // Extra disinfection surcharge if previous cycle had disease or rushed DOP
    const sanitationPrepMultiplier = prevHadDisease ? 1.25 : (Number(dopDays) <= 20 ? 1.15 : 1.0);

    let prepCostRM = 0;
    let cultureCostRM = 0;
    const items = [];

    for (const item of CHEMICAL_FERTILIZER_MRP_CATALOG) {
        const basePrepPerHa = isM11 ? item.prepPerHaM11 : item.prepPerHaM01_10;
        const prepQty = basePrepPerHa * ha * sanitationPrepMultiplier;
        const cultureQty = item.weeklyPerHa * ha * activeWeeks;
        const totalQty = prepQty + cultureQty;

        const itemPrepCost = prepQty * item.unitPriceRM * costMult;
        const itemCultureCost = cultureQty * item.unitPriceRM * costMult;
        const itemTotalCost = itemPrepCost + itemCultureCost;

        prepCostRM += itemPrepCost;
        cultureCostRM += itemCultureCost;

        items.push({
            code: item.code,
            name: item.name,
            unit: item.unit,
            prepQty: Number(prepQty.toFixed(2)),
            cultureQty: Number(cultureQty.toFixed(2)),
            totalQty: Number(totalQty.toFixed(2)),
            unitPriceRM: item.unitPriceRM,
            totalCostRM: Number(itemTotalCost.toFixed(2))
        });
    }

    return {
        items,
        prepCostRM: Number(prepCostRM.toFixed(2)),
        cultureCostRM: Number(cultureCostRM.toFixed(2)),
        totalChemFertCostRM: Number((prepCostRM + cultureCostRM).toFixed(2))
    };
}

/**
 * PILLAR 5: Computes the full 16-Element Econometric Pond Cycle P&L, Revenue, Cash Cost/kg,
 * Total Cost/kg, and EBITDA from a simulated pond cycle trajectory (`simulatePondCycleTrajectory`).
 *
 * Note on Electricity (`electricity`):
 * Because `pond_aerator_inventory` is unreliable in legacy data and Finance allocates TNB bills
 * strictly by active pond-days, `electricity` is calculated as:
 *   `expectedActiveDocDays * electricityRmPerActivePondDay * electricityTariffMultiplier`
 *
 * @param {Object} cycleTrajectory Result from `simulatePondCycleTrajectory()`
 * @param {Object} [options={}]
 * @param {number} [options.concurrentActivePondsOnFarm=135] Used to allocate monthly fixed farm overheads
 * @param {string} [options.repairScope="NONE"] "NONE", "MINOR", or "MAJOR"
 * @param {Object} [options.shockModifiers={}] Optional `{ electricityTariffMultiplier, feedCostMultiplier, shrimpPriceShiftRM, mineralCostMultiplier }`
 * @param {Object} [priors=DEFAULT_EMPIRICAL_PRIORS]
 * @returns {Object} Full 16-Line P&L Ledger & Unit Economics
 */
export function calculatePondCyclePnL(
    cycleTrajectory,
    options = {},
    priors = DEFAULT_EMPIRICAL_PRIORS
) {
    const rates = priors.financialRates;
    const outcomes = cycleTrajectory.expectedOutcomes;
    const shocks = options.shockModifiers || {};

    const feedCostMult = Number(shocks.feedCostMultiplier) || 1.0;
    const elecTariffMult = Number(shocks.electricityTariffMultiplier) || 1.0;
    const priceShiftRM = Number(shocks.shrimpPriceShiftRM) || 0.0;
    const mineralCostMult = Number(shocks.mineralCostMultiplier) || 1.0;

    // -------------------------------------------------------------------------
    // REVENUE (Normal Final + Partial Skims + Forced Harvest Salvage)
    // -------------------------------------------------------------------------
    const harvestMonth = ((cycleTrajectory.stockMonth - 1 + Math.round(outcomes.expectedActiveDocDays / 30)) % 12) + 1;

    const normalPriceInfo = calculateEffectiveSellingPrice({
        species: cycleTrajectory.species,
        abwGrams: cycleTrajectory.finalHarvestEvent.finalAbwGrams || outcomes.expectedAbwGrams,
        harvestMonth,
        isForcedHarvest: false,
        densityPlM2: cycleTrajectory.stockDensityPlM2,
        priceShiftRM
    }, priors);

    const salvagePriceInfo = calculateEffectiveSellingPrice({
        species: cycleTrajectory.species,
        abwGrams: outcomes.expectedAbwGrams * 0.76,
        harvestMonth,
        isForcedHarvest: true,
        densityPlM2: cycleTrajectory.stockDensityPlM2,
        priceShiftRM
    }, priors);

    let partialRevenueRM = 0;
    for (const pEvt of cycleTrajectory.partialHarvestEvents || []) {
        const pPrice = calculateEffectiveSellingPrice({
            species: cycleTrajectory.species,
            abwGrams: pEvt.abwGrams,
            harvestMonth,
            isForcedHarvest: false,
            densityPlM2: cycleTrajectory.stockDensityPlM2,
            priceShiftRM
        }, priors);
        partialRevenueRM += pEvt.expectedSkimKg * pPrice.effectivePriceRmPerKg;
    }

    const normalFinalRevenueRM =
        outcomes.expectedNormalFinalHarvestKg * normalPriceInfo.effectivePriceRmPerKg;
    const salvageRevenueRM =
        outcomes.expectedSalvageBiomassKg * salvagePriceInfo.effectivePriceRmPerKg;

    const totalRevenueRM = partialRevenueRM + normalFinalRevenueRM + salvageRevenueRM;
    const totalYieldKg = Math.max(0, outcomes.expectedTotalYieldKg);
    const realizedBlendedPriceRmPerKg =
        totalYieldKg > 0 ? totalRevenueRM / totalYieldKg : normalPriceInfo.effectivePriceRmPerKg;

    // -------------------------------------------------------------------------
    // 16-ELEMENT COST LEDGER (matching growout_pond_finance)
    // -------------------------------------------------------------------------
    // 1. Fries / PL Cost (`cons_of_fries`)
    const plUnitPrice = rates.plCostPerPieceRM[cycleTrajectory.geneticLine] || 0.022;
    const cons_of_fries = cycleTrajectory.stockedPlPcs * plUnitPrice;

    // 2. Feed Cost (`cons_of_feed`)
    const baseFeedCostRM = (cycleTrajectory.sapFeedByCode || []).reduce(
        (sum, s) => sum + s.expectedCostRM,
        0
    );
    const cons_of_feed = baseFeedCostRM * feedCostMult;

    // 3. 28 Chemicals & Fertilizers (`cons_of_chem_fert`)
    const chemMrp = calculatePondChemicalMRP({
        moduleId: cycleTrajectory.moduleId,
        areaHa: cycleTrajectory.areaHa,
        dopDays: cycleTrajectory.pillarMultipliers.pillar1Turnaround.dopDays,
        prevHadDisease: cycleTrajectory.pillarMultipliers.pillar1Turnaround.prevHadDisease,
        activeDocDays: outcomes.expectedActiveDocDays,
        mineralCostMultiplier: mineralCostMult
    });
    const cons_of_chem_fert = chemMrp.totalChemFertCostRM;

    // 4. Electricity (`electricity`) - Strictly RM per active pond-day
    const electricity =
        outcomes.expectedActiveDocDays *
        rates.electricityRmPerActivePondDay *
        elecTariffMult;
    const estimatedElectricityKwh = electricity / (rates.estimatedTnbTariffRmPerKwh * elecTariffMult);

    // 5. Supplies (`cons_of_supplies`)
    const cons_of_supplies = outcomes.expectedActiveDocDays * rates.suppliesRmPerActivePondDay;

    // 6. Harvest Expenses (`harvest_expenses`)
    const harvest_expenses = totalYieldKg * rates.harvestExpensesRmPerKg;

    // 7. Direct Wages (`wages_direct`)
    const wages_direct = outcomes.expectedActiveDocDays * rates.directWagesRmPerActivePondDay;

    // 8. Repair & Maintenance (`repair_maintenance`)
    const repairScope = String(options.repairScope || "NONE").toUpperCase();
    const repairSurcharge =
        repairScope === "MAJOR"
            ? rates.repairMaintenanceMajorSurchargeRM
            : repairScope === "MINOR"
            ? rates.repairMaintenanceMinorSurchargeRM
            : 0;
    const repair_maintenance = rates.repairMaintenanceBaseRmPerCycle + repairSurcharge;

    // 9-16. Allocated Monthly Farm Fixed Overheads (diluted by concurrentActivePondsOnFarm)
    const activeFarmPonds = Math.max(15, Number(options.concurrentActivePondsOnFarm) || 135);
    const cycleMonthsEquivalent = Math.max(1.0, outcomes.expectedActiveDocDays / 30.0);
    const pool = rates.monthlyFarmFixedOverheadsRM;
    const allocFactor = (cycleMonthsEquivalent / activeFarmPonds);

    const wages_indirect = pool.wages_indirect * allocFactor;
    const consultant = pool.consultant * allocFactor;
    const rental = pool.rental * allocFactor;
    const travel_entertainment = pool.travel_entertainment * allocFactor;
    const training_seminar = pool.training_seminar * allocFactor;
    const security_charges = pool.security_charges * allocFactor;
    const other_utilities_ins = pool.other_utilities_ins * allocFactor;
    const other_charges = pool.other_charges * allocFactor;
    const depreciation_fc = pool.depreciation_fc * allocFactor;
    const sag = pool.sag * allocFactor;

    // Cash Cost excludes non-cash depreciation_fc
    const totalCashCostRM =
        cons_of_fries +
        cons_of_feed +
        cons_of_chem_fert +
        electricity +
        cons_of_supplies +
        harvest_expenses +
        wages_direct +
        repair_maintenance +
        wages_indirect +
        consultant +
        rental +
        travel_entertainment +
        training_seminar +
        security_charges +
        other_utilities_ins +
        other_charges +
        sag;

    const totalCostRM = totalCashCostRM + depreciation_fc;
    const ebitdaRM = totalRevenueRM - totalCashCostRM;
    const netProfitRM = totalRevenueRM - totalCostRM;

    const cashCostPerKgRM = totalYieldKg > 0 ? totalCashCostRM / totalYieldKg : 0;
    const totalCostPerKgRM = totalYieldKg > 0 ? totalCostRM / totalYieldKg : 0;

    return {
        pondId: cycleTrajectory.pondId,
        moduleId: cycleTrajectory.moduleId,
        species: cycleTrajectory.species,
        geneticLine: cycleTrajectory.geneticLine,
        harvestMonth,
        totalYieldKg: Number(totalYieldKg.toFixed(1)),
        realizedSellingPriceRmPerKg: Number(realizedBlendedPriceRmPerKg.toFixed(2)),
        normalGradeBreakdown: normalPriceInfo,
        revenueBreakdownRM: {
            partialRevenueRM: Number(partialRevenueRM.toFixed(2)),
            normalFinalRevenueRM: Number(normalFinalRevenueRM.toFixed(2)),
            salvageRevenueRM: Number(salvageRevenueRM.toFixed(2)),
            totalRevenueRM: Number(totalRevenueRM.toFixed(2))
        },
        costElementsRM: {
            cons_of_fries: Number(cons_of_fries.toFixed(2)),
            cons_of_feed: Number(cons_of_feed.toFixed(2)),
            cons_of_chem_fert: Number(cons_of_chem_fert.toFixed(2)),
            electricity: Number(electricity.toFixed(2)),
            cons_of_supplies: Number(cons_of_supplies.toFixed(2)),
            harvest_expenses: Number(harvest_expenses.toFixed(2)),
            wages_direct: Number(wages_direct.toFixed(2)),
            wages_indirect: Number(wages_indirect.toFixed(2)),
            repair_maintenance: Number(repair_maintenance.toFixed(2)),
            consultant: Number(consultant.toFixed(2)),
            rental: Number(rental.toFixed(2)),
            travel_entertainment: Number(travel_entertainment.toFixed(2)),
            training_seminar: Number(training_seminar.toFixed(2)),
            security_charges: Number(security_charges.toFixed(2)),
            other_utilities_ins: Number(other_utilities_ins.toFixed(2)),
            other_charges: Number(other_charges.toFixed(2)),
            depreciation_fc: Number(depreciation_fc.toFixed(2)),
            sag: Number(sag.toFixed(2))
        },
        chemicalMrp: chemMrp,
        estimatedElectricityKwh: Math.round(estimatedElectricityKwh),
        totalCashCostRM: Number(totalCashCostRM.toFixed(2)),
        totalCostRM: Number(totalCostRM.toFixed(2)),
        ebitdaRM: Number(ebitdaRM.toFixed(2)),
        netProfitRM: Number(netProfitRM.toFixed(2)),
        cashCostPerKgRM: Number(cashCostPerKgRM.toFixed(2)),
        totalCostPerKgRM: Number(totalCostPerKgRM.toFixed(2))
    };
}

/**
 * Splices Realized Actual YTD Monthly Data with Frontier Rolling Forecast Monthly Data
 * to produce the Full-Year Latest Estimate (`LE`) and variances against Business Plan (`BP`).
 *
 * Formula:
 *   Full-Year LE = Sum(Actuals for m <= cutoffMonth) + Sum(Rolling Forecast for m > cutoffMonth)
 *
 * @param {Object} params
 * @param {Array<Object>} params.actualMonths Array of `{ month: 1..12, pondsHarvested, stockedPonds, yieldKg, revenueRM, cashCostRM, ebitdaRM }`
 * @param {Array<Object>} params.forecastMonths Array of `{ month: 1..12, pondsHarvested, stockedPonds, yieldKg, revenueRM, cashCostRM, ebitdaRM }`
 * @param {Array<Object>} [params.bpMonths=[]] Business Plan target rows by month
 * @param {number} [params.cutoffMonth=0] Last completed actual month (e.g. 6 for June YTD; 0 = 100% forecast)
 * @returns {Object} Spliced Monthly Series, YTD Summary, Remaining Forecast, Full-Year LE & Variance vs BP
 */
export function spliceActualYtdWithForecast({
    actualMonths = [],
    forecastMonths = [],
    bpMonths = [],
    cutoffMonth = 0
} = {}) {
    const cutoff = Math.max(0, Math.min(12, Math.round(Number(cutoffMonth) || 0)));
    const actByM = new Map(actualMonths.map(r => [Number(r.month), r]));
    const fcstByM = new Map(forecastMonths.map(r => [Number(r.month), r]));
    const bpByM = new Map(bpMonths.map(r => [Number(r.month), r]));

    const splicedMonths = [];
    const sumBucket = () => ({
        stockedPonds: 0,
        pondsHarvested: 0,
        yieldKg: 0,
        revenueRM: 0,
        cashCostRM: 0,
        ebitdaRM: 0
    });

    const actualYtdTotal = sumBucket();
    const rollingRemainingTotal = sumBucket();
    const fullYearLeTotal = sumBucket();
    const fullYearBpTotal = sumBucket();

    const addInto = (target, src) => {
        if (!src) return;
        target.stockedPonds += Number(src.stockedPonds) || 0;
        target.pondsHarvested += Number(src.pondsHarvested) || 0;
        target.yieldKg += Number(src.yieldKg) || 0;
        target.revenueRM += Number(src.revenueRM) || 0;
        target.cashCostRM += Number(src.cashCostRM) || 0;
        target.ebitdaRM += Number(src.ebitdaRM) || 0;
    };

    for (let m = 1; m <= 12; m++) {
        const isActual = m <= cutoff && actByM.has(m);
        const sourceRow = isActual ? actByM.get(m) : (fcstByM.get(m) || {});
        const bpRow = bpByM.get(m) || {};

        const normalized = {
            month: m,
            sourceType: isActual ? "ACTUAL_YTD" : "ROLLING_FORECAST",
            stockedPonds: Number(sourceRow.stockedPonds) || 0,
            pondsHarvested: Number(sourceRow.pondsHarvested) || 0,
            yieldKg: Number((Number(sourceRow.yieldKg) || 0).toFixed(1)),
            revenueRM: Number((Number(sourceRow.revenueRM) || 0).toFixed(2)),
            cashCostRM: Number((Number(sourceRow.cashCostRM) || 0).toFixed(2)),
            ebitdaRM: Number((Number(sourceRow.ebitdaRM) || 0).toFixed(2)),
            bpYieldKg: Number((Number(bpRow.yieldKg) || 0).toFixed(1)),
            bpEbitdaRM: Number((Number(bpRow.ebitdaRM) || 0).toFixed(2))
        };

        splicedMonths.push(normalized);

        if (isActual) {
            addInto(actualYtdTotal, normalized);
        } else {
            addInto(rollingRemainingTotal, normalized);
        }
        addInto(fullYearLeTotal, normalized);
        addInto(fullYearBpTotal, bpRow);
    }

    const finalize = (b) => ({
        stockedPonds: b.stockedPonds,
        pondsHarvested: b.pondsHarvested,
        yieldKg: Number(b.yieldKg.toFixed(1)),
        yieldMt: Number((b.yieldKg / 1000).toFixed(2)),
        revenueRM: Number(b.revenueRM.toFixed(2)),
        cashCostRM: Number(b.cashCostRM.toFixed(2)),
        ebitdaRM: Number(b.ebitdaRM.toFixed(2)),
        cashCostPerKgRM: b.yieldKg > 0 ? Number((b.cashCostRM / b.yieldKg).toFixed(2)) : 0
    });

    const leFinal = finalize(fullYearLeTotal);
    const bpFinal = finalize(fullYearBpTotal);

    return {
        cutoffMonth: cutoff,
        splicedMonths,
        actualYtdTotal: finalize(actualYtdTotal),
        rollingRemainingTotal: finalize(rollingRemainingTotal),
        fullYearLatestEstimate: leFinal,
        fullYearBusinessPlan: bpFinal,
        varianceLeVsBp: {
            yieldKgDiff: Number((leFinal.yieldKg - bpFinal.yieldKg).toFixed(1)),
            yieldMtDiff: Number((leFinal.yieldMt - bpFinal.yieldMt).toFixed(2)),
            revenueRmDiff: Number((leFinal.revenueRM - bpFinal.revenueRM).toFixed(2)),
            ebitdaRmDiff: Number((leFinal.ebitdaRM - bpFinal.ebitdaRM).toFixed(2))
        }
    };
}
