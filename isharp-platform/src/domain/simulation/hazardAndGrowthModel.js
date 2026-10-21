/**
 * iSHARP DBMS 2.0 — Frontier Simulation Engine (Phase 3)
 * Module: hazardAndGrowthModel.js
 *
 * PURE DOMAIN MODULE (Zero DOM dependencies, Zero network/fetch calls).
 *
 * Implements the Species-Partitioned Biological & Pathology Equations:
 * - Pillar 0: Root Species Bifurcation (MONODON vs VANNAMEI)
 * - Pillar 1: Pond Turnaround Idle Days (DOP) & Post-Disease Relapse Hazard
 * - Pillar 2: Species-Specific Module Suitability (M01-M11), All-In/All-Out Cohesion & Neighbor Contagion
 * - Pillar 3: Monsoon Biological Cliff, Broodstock Resilience & Multi-Hatchery Tank Mixing Hazard
 * - Pillar 4: Species Stocking Density Curve, Standing Biomass Carrying Capacity & 2X/3X Partial Harvest Relief
 */

import {
    SPECIES,
    CULTURE_STRATEGIES,
    DEFAULT_EMPIRICAL_PRIORS,
    classifySpecies,
    resolveGeneticLine
} from "./baselineCalibrator.js";

/**
 * Normalizes a module identifier (e.g. "M04", "MODL-04", "04", "4") to a 2-digit key ("01".."11").
 * @param {string|number} moduleId
 * @returns {string}
 */
export function normalizeModuleKey(moduleId) {
    if (moduleId === null || moduleId === undefined) return "01";
    const digits = String(moduleId).replace(/\D/g, "");
    if (!digits) return "01";
    const num = Math.max(1, Math.min(11, parseInt(digits, 10)));
    return String(num).padStart(2, "0");
}

/**
 * PILLAR 1: Evaluates Pond Turnaround Idle Time (`DOP = stock_date - close_date`)
 * and prior cycle disease carryover.
 *
 * @param {number} dopDays Idle days between previous cycle close and new stocking
 * @param {boolean} [prevHadDisease=false] True if previous cycle ended in Forced Harvest, Cull, or Disease
 * @param {Object} [priors=DEFAULT_EMPIRICAL_PRIORS]
 * @returns {Object} Turnaround multipliers & diagnostic label
 */
export function evaluateTurnaroundEffect(dopDays, prevHadDisease = false, priors = DEFAULT_EMPIRICAL_PRIORS) {
    const dop = Number.isFinite(Number(dopDays)) ? Math.max(0, Number(dopDays)) : 45;
    const buckets = priors.turnaroundBuckets;

    let bucket = buckets.EXTENDED;
    let bucketKey = "EXTENDED";
    if (dop <= buckets.RUSHED.maxDopDays) {
        bucket = buckets.RUSHED;
        bucketKey = "RUSHED";
    } else if (dop <= buckets.SHORT.maxDopDays) {
        bucket = buckets.SHORT;
        bucketKey = "SHORT";
    } else if (dop <= buckets.GOLDEN_REST.maxDopDays) {
        bucket = buckets.GOLDEN_REST;
        bucketKey = "GOLDEN_REST";
    }

    const hazardMultiplier = prevHadDisease
        ? bucket.postDiseaseRelapseHazardMultiplier
        : bucket.hazardMultiplier;

    const adgMultiplier = prevHadDisease && dop <= buckets.SHORT.maxDopDays
        ? bucket.adgMultiplier * 0.94
        : bucket.adgMultiplier;

    return {
        dopDays: dop,
        bucketKey,
        label: bucket.label,
        prevHadDisease: Boolean(prevHadDisease),
        adgMultiplier: Number(adgMultiplier.toFixed(4)),
        survivalMultiplier: bucket.survivalMultiplier,
        fcrMultiplier: bucket.fcrMultiplier,
        hazardMultiplier: Number(hazardMultiplier.toFixed(4)),
        isRushedRisk: dop <= buckets.RUSHED.maxDopDays || (prevHadDisease && dop <= buckets.SHORT.maxDopDays)
    };
}

/**
 * PILLAR 2: Evaluates Species-Specific Module Suitability (`M01-M11`),
 * All-In/All-Out Module Cohesion, and Active Neighbor Disease Contagion.
 *
 * @param {Object} params
 * @param {string} params.moduleId e.g. "M04", "M08"
 * @param {"MONODON"|"VANNAMEI"} params.species
 * @param {number} [params.olderActivePondsCount=0] Ponds in same module already >25d DOC at stock date
 * @param {number} [params.diseasedNeighborsCount=0] Concurrent ponds in same module with active disease
 * @param {Object} [priors=DEFAULT_EMPIRICAL_PRIORS]
 * @returns {Object} Module multipliers & suitability metadata
 */
export function evaluateModuleEffect({
    moduleId = "M01",
    species = SPECIES.VANNAMEI,
    olderActivePondsCount = 0,
    diseasedNeighborsCount = 0
} = {}, priors = DEFAULT_EMPIRICAL_PRIORS) {
    const modKey = normalizeModuleKey(moduleId);
    const sp = species === SPECIES.MONODON ? SPECIES.MONODON : SPECIES.VANNAMEI;
    const modTable = priors.moduleFixedEffects[sp] || priors.moduleFixedEffects.VANNAMEI;
    const modSpec = modTable[modKey] || modTable["01"];

    const cohesionCfg = priors.moduleCohesionAndContagion;
    const olderCount = Math.max(0, Number(olderActivePondsCount) || 0);
    let cohesion = cohesionCfg.allInAllOutBonus;
    let cohesionMode = "ALL_IN_ALL_OUT";

    if (olderCount > cohesionCfg.staggeredModeratePenalty.maxOlderPonds) {
        cohesion = cohesionCfg.staggeredSeverePenalty;
        cohesionMode = "STAGGERED_SEVERE";
    } else if (olderCount > 0) {
        cohesion = cohesionCfg.staggeredModeratePenalty;
        cohesionMode = "STAGGERED_OVERLAP";
    }

    const diseasedNeighbors = Math.max(0, Number(diseasedNeighborsCount) || 0);
    const contagionHazardMult = 1 + diseasedNeighbors * cohesionCfg.neighborContagionPerDiseasedPond.hazardSlopePerNeighbor;
    const contagionFcrMult = 1 + diseasedNeighbors * cohesionCfg.neighborContagionPerDiseasedPond.fcrSlopePerNeighbor;

    return {
        moduleKey: modKey,
        species: sp,
        moduleTier: modSpec.tier,
        cohesionMode,
        olderActivePondsCount: olderCount,
        diseasedNeighborsCount: diseasedNeighbors,
        adgMultiplier: Number((modSpec.adgMult * cohesion.adgMultiplier).toFixed(4)),
        survivalMultiplier: Number((modSpec.srMult * cohesion.survivalMultiplier).toFixed(4)),
        hazardMultiplier: Number((modSpec.hazardMult * cohesion.hazardMultiplier * contagionHazardMult).toFixed(4)),
        fcrMultiplier: Number((modSpec.fcrMult * contagionFcrMult).toFixed(4)),
        isSpeciesModuleMismatch: sp === SPECIES.VANNAMEI && (modKey === "08" || modKey === "09")
    };
}

/**
 * PILLAR 3: Evaluates Broodstock Resilience (`bs_line`) and Hatchery Supply Tier /
 * Multi-Hatchery Tank Mixing (`stck_source`).
 *
 * @param {Object} params
 * @param {"MONODON"|"VANNAMEI"} params.species
 * @param {string} [params.bsLine=""]
 * @param {string} [params.stckSource="SHT"]
 * @param {number} [params.monthlyLinePondsCount=10] Concurrent ponds stocked in same month from same hatchery
 * @param {Object} [priors=DEFAULT_EMPIRICAL_PRIORS]
 * @returns {Object} Broodstock & hatchery multipliers
 */
export function evaluateHatcheryAndBroodstockEffect({
    species = SPECIES.VANNAMEI,
    bsLine = "",
    stckSource = "SHT",
    monthlyLinePondsCount = 10
} = {}, priors = DEFAULT_EMPIRICAL_PRIORS) {
    const cfg = priors.broodstockAndHatcheryEffects;
    const bsUpper = String(bsLine || "").toUpperCase().trim();
    const bsSpec = cfg.broodstockMultipliers[bsUpper] || {
        species,
        adgMult: 1.0,
        srMult: 1.0,
        hazardMult: 1.0
    };

    const srcUpper = String(stckSource || "SHT").toUpperCase().trim();
    const hasExplicitMultiHatcheryMix = /[,/+&]/.test(srcUpper);
    const isTier2Secondary = cfg.hatcheryTiers.TIER_2_SECONDARY.codes.some(code => srcUpper === code);
    const singleCap = cfg.hatcheryTiers.TIER_1_SINGLE.monthlyCapacityPondsPerHatchery || 28;
    const exceedsSingleHatcheryCap = Number(monthlyLinePondsCount) > singleCap;

    let hatcherySpec = cfg.hatcheryTiers.TIER_1_SINGLE;
    let hatcheryTierKey = "TIER_1_SINGLE";

    if (hasExplicitMultiHatcheryMix || exceedsSingleHatcheryCap) {
        hatcherySpec = cfg.hatcheryTiers.MULTI_HATCHERY_MIXED;
        hatcheryTierKey = "MULTI_HATCHERY_MIXED";
    } else if (isTier2Secondary) {
        hatcherySpec = cfg.hatcheryTiers.TIER_2_SECONDARY;
        hatcheryTierKey = "TIER_2_SECONDARY";
    }

    return {
        bsLine: bsUpper || (species === SPECIES.MONODON ? "CP THAI" : "SYAQUA"),
        stckSource: srcUpper,
        hatcheryTierKey,
        hatcheryLabel: hatcherySpec.label,
        isMixedOrHighRiskHatchery: hatcheryTierKey !== "TIER_1_SINGLE",
        adgMultiplier: Number((bsSpec.adgMult * hatcherySpec.adgMult).toFixed(4)),
        survivalMultiplier: Number((bsSpec.srMult * hatcherySpec.srMult).toFixed(4)),
        hazardMultiplier: Number((bsSpec.hazardMult * hatcherySpec.hazardMult).toFixed(4)),
        fcrMultiplier: hatcherySpec.fcrMult || 1.0
    };
}

/**
 * PILLAR 3 & 4: Evaluates Species-Specific Setiu Northeast Monsoon Seasonality (`stockMonth = 1..12`).
 *
 * @param {number} stockMonth Calendar month of stocking (1 = Jan ... 12 = Dec)
 * @param {"MONODON"|"VANNAMEI"} species
 * @param {Object} [priors=DEFAULT_EMPIRICAL_PRIORS]
 * @returns {Object} Monsoon multipliers & risk flags
 */
export function evaluateMonsoonEffect(stockMonth, species = SPECIES.VANNAMEI, priors = DEFAULT_EMPIRICAL_PRIORS) {
    const m = Math.max(1, Math.min(12, Math.round(Number(stockMonth) || 4)));
    const sp = species === SPECIES.MONODON ? SPECIES.MONODON : SPECIES.VANNAMEI;
    const table = priors.monsoonSeasonalityByStockMonth[sp] || priors.monsoonSeasonalityByStockMonth.VANNAMEI;
    const spec = table[m] || table[4];

    const isMonsoonCliff = sp === SPECIES.MONODON
        ? (m >= 8 && m <= 11)
        : (m >= 9 && m <= 12);

    return {
        stockMonth: m,
        species: sp,
        seasonLabel: spec.label,
        adgMultiplier: spec.adgMult,
        survivalMultiplier: spec.srMult,
        hazardMultiplier: spec.hazardMult,
        fcrMultiplier: spec.fcrMult,
        isMonsoonCliff
    };
}

/**
 * PILLAR 4: Evaluates Species-Specific Stocking Density Bracket (`PL/m2`) and
 * Dynamic Standing Biomass Carrying Capacity (`kg/m2`) with Partial Harvest (`2X`/`3X`) Relief.
 *
 * @param {Object} params
 * @param {"MONODON"|"VANNAMEI"} params.species
 * @param {number} params.densityPlM2
 * @param {number} [params.standingBiomassKg=0]
 * @param {number} [params.areaHa=0.5]
 * @param {number} [params.harvestPlanCount=1] 1, 2, or 3
 * @param {boolean} [params.hasSkimmedPartial=false] True after 1st partial harvest has thinned the pond
 * @param {Object} [priors=DEFAULT_EMPIRICAL_PRIORS]
 * @returns {Object} Density & carrying capacity multipliers
 */
export function evaluateDensityAndCarryingCapacity({
    species = SPECIES.VANNAMEI,
    densityPlM2 = 95,
    standingBiomassKg = 0,
    areaHa = 0.5,
    harvestPlanCount = 1,
    hasSkimmedPartial = false
} = {}, priors = DEFAULT_EMPIRICAL_PRIORS) {
    const sp = species === SPECIES.MONODON ? SPECIES.MONODON : SPECIES.VANNAMEI;
    const sd = Math.max(1, Number(densityPlM2) || (sp === SPECIES.MONODON ? 45 : 95));
    const brackets = priors.densityBrackets[sp] || priors.densityBrackets.VANNAMEI;

    let bracket = brackets[brackets.length - 1];
    for (const b of brackets) {
        if (sd <= b.maxPlM2) {
            bracket = b;
            break;
        }
    }

    // If Vannamei is stocked at 120-129 PL/m2 WITHOUT partial harvest (1X), apply crowding penalty
    const hpCount = Math.max(1, Math.min(3, Math.round(Number(harvestPlanCount) || 1)));
    let densityAdgMult = bracket.adgMult;
    let densityHazardMult = bracket.hazardMult;
    if (sp === SPECIES.VANNAMEI && sd >= 115 && sd < 130 && hpCount === 1) {
        densityAdgMult = 0.90;
        densityHazardMult = 1.25;
    }

    const areaM2 = Math.max(500, (Number(areaHa) || 0.5) * 10000);
    const standingKgPerM2 = Math.max(0, Number(standingBiomassKg) || 0) / areaM2;
    const critKgPerM2 = priors.carryingCapacityAndPartialHarvest.criticalKgPerM2[sp] || 0.76;
    const reliefSpec = priors.carryingCapacityAndPartialHarvest.partialHarvestRelief[hpCount]
        || priors.carryingCapacityAndPartialHarvest.partialHarvestRelief[1];

    let biomassCrowdingAdgMult = 1.0;
    let biomassCrowdingHazardMult = 1.0;

    if (standingKgPerM2 > critKgPerM2) {
        const excessRatio = (standingKgPerM2 - critKgPerM2) / critKgPerM2;
        biomassCrowdingAdgMult = Math.max(0.55, 1 - 0.65 * excessRatio);
        biomassCrowdingHazardMult = 1 + 1.8 * excessRatio;
    }

    if (hasSkimmedPartial && hpCount >= 2) {
        biomassCrowdingAdgMult *= reliefSpec.postSkimAdgBoost;
        biomassCrowdingHazardMult *= reliefSpec.lateHazardMultiplier;
    }

    return {
        species: sp,
        densityPlM2: sd,
        densityLabel: bracket.label,
        standingKgPerM2: Number(standingKgPerM2.toFixed(3)),
        critKgPerM2,
        isOverCarryingCapacity: standingKgPerM2 > critKgPerM2,
        isOvercrowdedStocking: sp === SPECIES.VANNAMEI ? sd >= 130 : sd > 58,
        adgMultiplier: Number((densityAdgMult * biomassCrowdingAdgMult).toFixed(4)),
        survivalMultiplier: Number((bracket.srMult * reliefSpec.survivalBonusMult).toFixed(4)),
        hazardMultiplier: Number((densityHazardMult * biomassCrowdingHazardMult).toFixed(4)),
        fcrMultiplier: bracket.fcrMult
    };
}

/**
 * PILLAR 4 (Bayesian Live Updating): Conditions an active pond's remaining growth trajectory
 * on its latest field sampling record `(smpl_doc, smpl_abw)` from `biometrics_sampling`.
 *
 * @param {"MONODON"|"VANNAMEI"} species
 * @param {number} smplDoc Latest sampled Day of Culture
 * @param {number} smplAbw Latest sampled Average Body Weight (grams)
 * @param {number} [initialWeightGrams=0.01]
 * @param {Object} [priors=DEFAULT_EMPIRICAL_PRIORS]
 * @returns {Object} Bayesian conditioning multiplier & estimated percentile
 */
export function inferActivePondGrowthQuantile(
    species = SPECIES.VANNAMEI,
    smplDoc = 0,
    smplAbw = 0,
    initialWeightGrams = 0.01,
    priors = DEFAULT_EMPIRICAL_PRIORS
) {
    const doc = Number(smplDoc) || 0;
    const abw = Number(smplAbw) || 0;
    if (doc < 15 || abw <= 0) {
        return { isConditioned: false, bayesianAdgMultiplier: 1.0, estimatedPercentile: 50 };
    }

    const sp = species === SPECIES.MONODON ? SPECIES.MONODON : SPECIES.VANNAMEI;
    const baseAdg = priors.speciesBaselines[sp].baseAdgGramsPerDay;
    const expectedAbwAtDoc = initialWeightGrams + baseAdg * doc;
    if (expectedAbwAtDoc <= 0) {
        return { isConditioned: false, bayesianAdgMultiplier: 1.0, estimatedPercentile: 50 };
    }

    const rawRatio = abw / expectedAbwAtDoc;
    // Shrinkage towards prior mean (empirical Bayes credibility weight increases with DOC)
    const credibility = Math.min(0.85, doc / 90);
    const bayesianAdgMultiplier = Math.max(0.55, Math.min(1.45, 1.0 + credibility * (rawRatio - 1.0)));
    const estimatedPercentile = Math.max(5, Math.min(95, Math.round(50 + (bayesianAdgMultiplier - 1.0) * 110)));

    return {
        isConditioned: true,
        smplDoc: doc,
        smplAbw: abw,
        expectedAbwAtDoc: Number(expectedAbwAtDoc.toFixed(2)),
        bayesianAdgMultiplier: Number(bayesianAdgMultiplier.toFixed(4)),
        estimatedPercentile
    };
}

/**
 * PILLAR 4 (Bayesian Harvest Timing Projection):
 * Determines the expected harvest DOC and week duration for an active production pond.
 *
 * Mathematical Logic:
 * 1. Base Target DOC from Strategy (e.g. DS1 = 92d, DS2 = 98d, DS3 = 105d, DS4 = 112d).
 * 2. If recent biometrics sampling exists (smplDoc >= 15, smplAbw > 0), conditions the remaining
 *    growth rate via Bayesian quantile inference towards the strategy's target harvest ABW (targetAbwG):
 *    remainingDaysNeeded = Math.round((targetAbw - smplAbw) / (baseAdg * bayesianAdgMultiplier))
 *    projectedDoc = smplDoc + remainingDaysNeeded
 * 3. Enforces biological clamp [baseTargetDoc - 14 .. baseTargetDoc + 14] and ensures projectedDoc
 *    never places harvest in the past (at least currentDoc + 7).
 *
 * @param {Object} pond
 * @param {Object|null} sampling Latest sampling record `{ smplDoc, smplAbw, smplSurv }`
 * @param {Object} [priors=DEFAULT_EMPIRICAL_PRIORS]
 * @returns {Object} `{ targetFinalDoc, durationWeeks, isConditioned, estimatedPercentile, bayesianAdgMultiplier }`
 */
export function projectActivePondHarvestDoc(
    pond = {},
    sampling = null,
    priors = DEFAULT_EMPIRICAL_PRIORS
) {
    const stratCode = String(pond.strategyCode || (pond.species === SPECIES.MONODON ? "DS4" : "DS1")).toUpperCase().trim();
    const strat = CULTURE_STRATEGIES[stratCode] || CULTURE_STRATEGIES.DS1;
    const species = pond.species || strat.speciesDefault || SPECIES.VANNAMEI;
    const baseTargetDoc = Number(strat.targetFinalDoc) || (species === SPECIES.MONODON ? 112 : 92);
    const targetAbw = Number(strat.targetAbwG) || (species === SPECIES.MONODON ? 32.5 : 18.0);
    const currentDoc = Math.max(0, Number(pond.docDays) || 0);

    const docSmpl = sampling ? Number(sampling.smplDoc) : 0;
    const abwSmpl = sampling ? Number(sampling.smplAbw) : 0;

    if (!sampling || docSmpl < 15 || abwSmpl <= 0) {
        // No valid sampling yet: harvest is projected at standard strategy target DOC
        const finalDoc = Math.max(currentDoc + 7, baseTargetDoc);
        return {
            targetFinalDoc: finalDoc,
            durationWeeks: Math.max(1, Math.ceil(finalDoc / 7)),
            isConditioned: false,
            estimatedPercentile: 50,
            bayesianAdgMultiplier: 1.0
        };
    }

    // Bayesian ADG conditioning from sampling
    const bayes = inferActivePondGrowthQuantile(
        species,
        docSmpl,
        abwSmpl,
        strat.initialWeightGrams || 0.01,
        priors
    );

    const baseSpecies = priors?.speciesBaselines?.[species] || DEFAULT_EMPIRICAL_PRIORS.speciesBaselines[species];
    const effectiveAdg = baseSpecies.baseAdgGramsPerDay * bayes.bayesianAdgMultiplier;

    // Remaining weight gap to reach targetAbw
    const weightGap = targetAbw - bayes.smplAbw;
    let projectedDoc = baseTargetDoc;

    if (weightGap > 0 && effectiveAdg > 0.05) {
        const remainingDaysNeeded = Math.round(weightGap / effectiveAdg);
        projectedDoc = bayes.smplDoc + remainingDaysNeeded;
    } else if (weightGap <= 0) {
        // Target ABW already achieved! Ready for harvest in current/next week
        projectedDoc = Math.max(bayes.smplDoc, currentDoc + 7);
    }

    // Clamp within realistic window: strategy target ± 14 days, and at least currentDoc + 7
    const minDoc = Math.max(35, baseTargetDoc - 14);
    const maxDoc = baseTargetDoc + 14;
    const clampedDoc = Math.max(currentDoc + 7, Math.min(maxDoc, Math.max(minDoc, projectedDoc)));

    return {
        targetFinalDoc: clampedDoc,
        durationWeeks: Math.max(1, Math.ceil(clampedDoc / 7)),
        isConditioned: true,
        estimatedPercentile: bayes.estimatedPercentile,
        bayesianAdgMultiplier: bayes.bayesianAdgMultiplier
    };
}

/**
 * Allocates a weekly feed amount (kg) to the appropriate SAP Feed SKU based on current shrimp ABW.
 *
 * @param {"MONODON"|"VANNAMEI"} species
 * @param {number} currentAbwGrams
 * @param {number} feedKg
 * @param {Object} [priors=DEFAULT_EMPIRICAL_PRIORS]
 * @returns {Object} `{ sapCode, skuName, feedKg, unitPriceRM, costRM }`
 */
export function resolveWeeklySapFeedSku(species, currentAbwGrams, feedKg, priors = DEFAULT_EMPIRICAL_PRIORS) {
    const sp = species === SPECIES.MONODON ? SPECIES.MONODON : SPECIES.VANNAMEI;
    const skus = priors.financialRates.sapFeedSkus[sp] || priors.financialRates.sapFeedSkus.VANNAMEI;
    const abw = Math.max(0, Number(currentAbwGrams) || 0);
    const kg = Math.max(0, Number(feedKg) || 0);

    let chosen = skus[skus.length - 1];
    for (const sku of skus) {
        if (abw <= sku.maxAbwGrams) {
            chosen = sku;
            break;
        }
    }

    return {
        sapCode: chosen.sapCode,
        skuName: chosen.name,
        feedKg: Number(kg.toFixed(1)),
        unitPriceRM: chosen.priceRmPerKg,
        costRM: Number((kg * chosen.priceRmPerKg).toFixed(2))
    };
}

/**
 * Simulates a single pond cycle week-by-week across its culture duration, integrating
 * Pillar 0 (Species), Pillar 1 (DOP Turnaround), Pillar 2 (Module Suitability & Cohesion),
 * Pillar 3 (Monsoon, Broodstock, Hatchery Mixing & Conditional Hazard), and
 * Pillar 4 (Density, Carrying Capacity, 2X/3X Partial Harvest Skimming & Bayesian Live Updating).
 *
 * @param {Object} pondConfig
 * @param {string} pondConfig.pondId e.g. "M04-P01"
 * @param {string} [pondConfig.moduleId="M04"]
 * @param {number} [pondConfig.areaHa=0.5]
 * @param {string} [pondConfig.strategyCode="DS1"] One of DS1..DS4, NT1..NT3, PT1..PT3
 * @param {string} [pondConfig.species] "MONODON" or "VANNAMEI"
 * @param {string} [pondConfig.plType] "SPF", "SPR", "SPT", "MONODON"
 * @param {string} [pondConfig.bsLine] e.g. "CP THAI", "API GOLDEN", "SYAQUA"
 * @param {string} [pondConfig.stckSource="SHT"] e.g. "SHT", "UBN", "SHT,GS"
 * @param {number} [pondConfig.stockDensityPlM2]
 * @param {number} [pondConfig.stockMonth=4] 1..12
 * @param {number} [pondConfig.startWeekIndex=1] 1..156
 * @param {number} [pondConfig.dopDays=45] Idle turnaround days prior to stocking
 * @param {boolean} [pondConfig.prevHadDisease=false]
 * @param {number} [pondConfig.olderActivePondsCount=0]
 * @param {number} [pondConfig.diseasedNeighborsCount=0]
 * @param {number} [pondConfig.monthlyLinePondsCount=12]
 * @param {number} [pondConfig.targetFinalDoc] Optional override for harvest DOC
 * @param {Object} [pondConfig.latestSampling] Optional `{ smplDoc, smplAbw, smplSurv }` for active ponds
 * @param {Object} [priors=DEFAULT_EMPIRICAL_PRIORS]
 * @param {Function} [getWeekShockModifiers] Optional `(weekIndex) => { adgMultiplier, survivalMultiplier, hazardMultiplier }`
 * @returns {Object} Full biological & partial/final harvest trajectory
 */
export function simulatePondCycleTrajectory(
    pondConfig = {},
    priors = DEFAULT_EMPIRICAL_PRIORS,
    getWeekShockModifiers = null
) {
    const strategyCode = String(pondConfig.strategyCode || "DS1").toUpperCase().trim();
    const strategy = CULTURE_STRATEGIES[strategyCode] || CULTURE_STRATEGIES.DS1;

    const species = classifySpecies({
        species: pondConfig.species || strategy.speciesDefault,
        plType: pondConfig.plType,
        bsLine: pondConfig.bsLine,
        strategy: strategyCode,
        stockDensity: pondConfig.stockDensityPlM2
    });

    const geneticLine = resolveGeneticLine({
        species,
        plType: pondConfig.plType,
        bsLine: pondConfig.bsLine
    });

    const baseSpecies = priors.speciesBaselines[species];
    const areaHa = Math.max(0.05, Number(pondConfig.areaHa) || 0.5);
    const areaM2 = areaHa * 10000;
    const stockDensityPlM2 = Math.max(
        5,
        Number(pondConfig.stockDensityPlM2) ||
            (species === SPECIES.MONODON ? 45 : strategy.defaultDensityPlM2)
    );

    const stockedPlPcs = Math.round(areaM2 * stockDensityPlM2);
    const transferSurvivalRatio = (strategy.transferSurvivalPct || 100) / 100;
    const initialGrowoutPopPcs = Math.round(stockedPlPcs * transferSurvivalRatio);

    const harvestPlanCount = Number(pondConfig.harvestPlanCount) || strategy.harvestPlanCount || 1;
    const targetFinalDoc = Math.max(
        35,
        Number(pondConfig.targetFinalDoc) ||
            (species === SPECIES.MONODON ? baseSpecies.standardDocDays : strategy.targetFinalDoc)
    );

    const stockMonth = Math.max(1, Math.min(12, Number(pondConfig.stockMonth) || 4));
    const startWeekIndex = Math.max(1, Number(pondConfig.startWeekIndex) || 1);

    // Evaluate Pillar 1, 2, 3 static cycle priors
    const pillar1 = evaluateTurnaroundEffect(pondConfig.dopDays ?? 45, pondConfig.prevHadDisease, priors);
    const pillar2 = evaluateModuleEffect({
        moduleId: pondConfig.moduleId || pondConfig.pondId || "M01",
        species,
        olderActivePondsCount: pondConfig.olderActivePondsCount || 0,
        diseasedNeighborsCount: pondConfig.diseasedNeighborsCount || 0
    }, priors);
    const pillar3Hatchery = evaluateHatcheryAndBroodstockEffect({
        species,
        bsLine: pondConfig.bsLine,
        stckSource: pondConfig.stckSource || (species === SPECIES.MONODON ? "KSK" : "SHT"),
        monthlyLinePondsCount: pondConfig.monthlyLinePondsCount || 10
    }, priors);
    const pillar3Monsoon = evaluateMonsoonEffect(stockMonth, species, priors);

    const bayesianUpdate = pondConfig.latestSampling
        ? inferActivePondGrowthQuantile(
              species,
              pondConfig.latestSampling.smplDoc,
              pondConfig.latestSampling.smplAbw,
              strategy.initialWeightGrams,
              priors
          )
        : { isConditioned: false, bayesianAdgMultiplier: 1.0, estimatedPercentile: 50 };

    const totalWeeks = Math.max(5, Math.ceil(targetFinalDoc / 7));

    // Calibrate weekly base survival & hazard rates so baseline conditions match historical SR & Fail rates
    const targetCycleSurvivalRatio = Math.min(
        0.96,
        Math.max(
            0.25,
            (baseSpecies.avgSurvivalPct / 100) *
                pillar1.survivalMultiplier *
                pillar2.survivalMultiplier *
                pillar3Hatchery.survivalMultiplier *
                pillar3Monsoon.survivalMultiplier
        )
    );
    const baseWeeklySurviveRatio = Math.pow(targetCycleSurvivalRatio, 1 / totalWeeks);

    const compositeStaticHazardMult =
        pillar1.hazardMultiplier *
        pillar2.hazardMultiplier *
        pillar3Hatchery.hazardMultiplier *
        pillar3Monsoon.hazardMultiplier;

    const rawCycleFailProb = Math.min(
        0.92,
        Math.max(0.05, (baseSpecies.baseFailRatePct / 100) * Math.pow(compositeStaticHazardMult, 0.55))
    );

    let currentAbwGrams = strategy.initialWeightGrams || 0.01;
    let currentPopPcs = initialGrowoutPopPcs;
    let cumPondSurvivalProb = 1.0;
    let hasSkimmedPartial = false;
    let partialCountCompleted = 0;

    const weeklySteps = [];
    const partialHarvestEvents = [];
    const sapFeedTotalsByCode = {};
    let totalHealthyFeedKg = 0;
    let expectedTotalFeedKg = 0;
    let expectedSalvageBiomassKg = 0;
    let expectedCullProbTotal = 0;
    let expectedForcedHarvestProbTotal = 0;
    let expectedActiveDocDays = 0;

    for (let w = 1; w <= totalWeeks; w++) {
        const simWeekIndex = startWeekIndex + w - 1;
        const docStart = (w - 1) * 7 + 1;
        const docEnd = Math.min(targetFinalDoc, w * 7);
        const daysInStep = Math.max(1, docEnd - docStart + 1);

        const currentStandingBiomassKg = (currentPopPcs * currentAbwGrams) / 1000;

        const pillar4Density = evaluateDensityAndCarryingCapacity({
            species,
            densityPlM2: stockDensityPlM2,
            standingBiomassKg: currentStandingBiomassKg,
            areaHa,
            harvestPlanCount,
            hasSkimmedPartial
        }, priors);

        const shock = typeof getWeekShockModifiers === "function"
            ? (getWeekShockModifiers(simWeekIndex) || {})
            : {};
        const shockAdgMult = Number(shock.adgMultiplier) || 1.0;
        const shockSrMult = Number(shock.survivalMultiplier) || 1.0;
        const shockHazardMult = Number(shock.hazardMultiplier) || 1.0;

        // Age-dependent growth curve factor (slower in first 21 days, peak in mid-culture)
        const ageAdgFactor = docEnd <= 21 ? 0.68 : (docEnd <= 42 ? 0.96 : 1.08);
        const effectiveDailyAdg =
            baseSpecies.baseAdgGramsPerDay *
            ageAdgFactor *
            pillar1.adgMultiplier *
            pillar2.adgMultiplier *
            pillar3Hatchery.adgMultiplier *
            pillar3Monsoon.adgMultiplier *
            pillar4Density.adgMultiplier *
            bayesianUpdate.bayesianAdgMultiplier *
            shockAdgMult;

        const prevAbwGrams = currentAbwGrams;
        currentAbwGrams = Math.max(prevAbwGrams, prevAbwGrams + effectiveDailyAdg * daysInStep);

        // If active pond has a known sampling at this DOC, anchor ABW & population
        if (bayesianUpdate.isConditioned && Math.abs(docEnd - bayesianUpdate.smplDoc) <= 3) {
            currentAbwGrams = bayesianUpdate.smplAbw;
            if (pondConfig.latestSampling?.smplSurv > 0) {
                currentPopPcs = Math.round(stockedPlPcs * (Number(pondConfig.latestSampling.smplSurv) / 100));
            }
        }

        // Chronic weekly natural mortality inside surviving pond
        const stepSurvRatio = Math.min(0.998, baseWeeklySurviveRatio * Math.pow(pillar4Density.survivalMultiplier * shockSrMult, 1 / totalWeeks));
        currentPopPcs = Math.round(currentPopPcs * stepSurvRatio);

        const biomassBeforeSkimKg = (currentPopPcs * currentAbwGrams) / 1000;
        const biomassGainStepKg = Math.max(
            15,
            currentPopPcs * ((currentAbwGrams - prevAbwGrams) / 1000)
        );

        const effectiveStepFcr =
            baseSpecies.baseFcr *
            pillar1.fcrMultiplier *
            pillar2.fcrMultiplier *
            pillar3Hatchery.fcrMultiplier *
            pillar3Monsoon.fcrMultiplier *
            pillar4Density.fcrMultiplier;

        const stepFeedKg = biomassGainStepKg * effectiveStepFcr;
        const sapFeedAllocation = resolveWeeklySapFeedSku(species, currentAbwGrams, stepFeedKg, priors);

        totalHealthyFeedKg += stepFeedKg;
        expectedTotalFeedKg += stepFeedKg * cumPondSurvivalProb;

        if (!sapFeedTotalsByCode[sapFeedAllocation.sapCode]) {
            sapFeedTotalsByCode[sapFeedAllocation.sapCode] = {
                sapCode: sapFeedAllocation.sapCode,
                skuName: sapFeedAllocation.skuName,
                unitPriceRM: sapFeedAllocation.unitPriceRM,
                healthyKg: 0,
                expectedKg: 0,
                expectedCostRM: 0
            };
        }
        sapFeedTotalsByCode[sapFeedAllocation.sapCode].healthyKg += stepFeedKg;
        sapFeedTotalsByCode[sapFeedAllocation.sapCode].expectedKg += stepFeedKg * cumPondSurvivalProb;
        sapFeedTotalsByCode[sapFeedAllocation.sapCode].expectedCostRM +=
            stepFeedKg * cumPondSurvivalProb * sapFeedAllocation.unitPriceRM;

        // Check for Partial Harvest Skimming (2X or 3X strategy)
        let partialSkimmedKgThisWeek = 0;
        const triggerDocs = strategy.partialTriggerDoc || [];
        if (
            harvestPlanCount >= 2 &&
            partialCountCompleted < harvestPlanCount - 1 &&
            w < totalWeeks
        ) {
            const targetTriggerDoc = triggerDocs[partialCountCompleted] || (partialCountCompleted === 0 ? 65 : 80);
            if (docEnd >= targetTriggerDoc && biomassBeforeSkimKg >= 2200) {
                const plannedSkimKg = strategy.partialSkimKg[partialCountCompleted] || 1000;
                partialSkimmedKgThisWeek = Math.min(plannedSkimKg, biomassBeforeSkimKg * 0.35);
                const pcsRemoved = Math.round((partialSkimmedKgThisWeek * 1000) / Math.max(1, currentAbwGrams));
                currentPopPcs = Math.max(10000, currentPopPcs - pcsRemoved);
                hasSkimmedPartial = true;
                partialCountCompleted += 1;

                partialHarvestEvents.push({
                    partialIndex: partialCountCompleted,
                    simWeekIndex,
                    doc: docEnd,
                    abwGrams: Number(currentAbwGrams.toFixed(2)),
                    healthySkimKg: Number(partialSkimmedKgThisWeek.toFixed(1)),
                    expectedSkimKg: Number((partialSkimmedKgThisWeek * cumPondSurvivalProb).toFixed(1)),
                    pcsRemoved
                });
            }
        }

        // Conditional Weekly Pond Failure Hazard (Early Cull vs Mid/Late Forced Harvest)
        const baseWeeklyHazard = 1 - Math.pow(1 - rawCycleFailProb, 1 / totalWeeks);
        const stepHazard = Math.min(
            0.35,
            baseWeeklyHazard *
                (pillar4Density.hazardMultiplier / (pillar4Density.adgMultiplier || 1)) *
                shockHazardMult
        );

        const unconditionalFailProbThisWeek = cumPondSurvivalProb * stepHazard;
        const isEarlyCullWindow = docEnd <= 38;

        if (isEarlyCullWindow) {
            expectedCullProbTotal += unconditionalFailProbThisWeek;
        } else {
            expectedForcedHarvestProbTotal += unconditionalFailProbThisWeek;
            // Forced harvest recovers salvageable biomass (roughly 68% of current standing biomass)
            const standingAfterSkimKg = (currentPopPcs * currentAbwGrams) / 1000;
            expectedSalvageBiomassKg += unconditionalFailProbThisWeek * standingAfterSkimKg * 0.68;
        }

        expectedActiveDocDays += daysInStep * cumPondSurvivalProb;
        cumPondSurvivalProb = Math.max(0.05, cumPondSurvivalProb * (1 - stepHazard));

        const standingBiomassEndKg = (currentPopPcs * currentAbwGrams) / 1000;

        weeklySteps.push({
            cycleWeek: w,
            simWeekIndex,
            docStart,
            docEnd,
            daysInStep,
            abwGrams: Number(currentAbwGrams.toFixed(2)),
            adgGramsPerDay: Number(effectiveDailyAdg.toFixed(3)),
            survivingPopPcs: currentPopPcs,
            standingBiomassKg: Number(standingBiomassEndKg.toFixed(1)),
            partialHarvestKg: Number(partialSkimmedKgThisWeek.toFixed(1)),
            weeklyFeedKg: Number(stepFeedKg.toFixed(1)),
            expectedWeeklyFeedKg: Number((stepFeedKg * cumPondSurvivalProb).toFixed(1)),
            sapFeedCode: sapFeedAllocation.sapCode,
            cumPondSurvivalProb: Number(cumPondSurvivalProb.toFixed(4)),
            weeklyHazardProb: Number(stepHazard.toFixed(4)),
            isOverCarryingCapacity: pillar4Density.isOverCarryingCapacity
        });
    }

    const finalStep = weeklySteps[weeklySteps.length - 1];
    const healthyFinalHarvestKg = finalStep ? finalStep.standingBiomassKg : 0;
    const healthyPartialHarvestKg = partialHarvestEvents.reduce((sum, e) => sum + e.healthySkimKg, 0);
    const expectedPartialHarvestKg = partialHarvestEvents.reduce((sum, e) => sum + e.expectedSkimKg, 0);
    const expectedNormalFinalHarvestKg = healthyFinalHarvestKg * cumPondSurvivalProb;

    const expectedTotalYieldKg =
        expectedPartialHarvestKg + expectedNormalFinalHarvestKg + expectedSalvageBiomassKg;

    const totalPartialPcsRemoved = partialHarvestEvents.reduce((sum, e) => sum + e.pcsRemoved, 0);
    const healthyTotalSurvivingPcs = (finalStep ? finalStep.survivingPopPcs : 0) + totalPartialPcsRemoved;
    const healthySurvivalPct = (healthyTotalSurvivingPcs / Math.max(1, stockedPlPcs)) * 100;
    const expectedSurvivalPct = healthySurvivalPct * (cumPondSurvivalProb + 0.55 * expectedForcedHarvestProbTotal);

    const expectedRealizedAbwGrams =
        cumPondSurvivalProb + expectedForcedHarvestProbTotal > 0
            ? (cumPondSurvivalProb * (finalStep?.abwGrams || baseSpecies.avgAbwGrams) +
                  expectedForcedHarvestProbTotal * ((finalStep?.abwGrams || baseSpecies.avgAbwGrams) * 0.76)) /
              (cumPondSurvivalProb + expectedForcedHarvestProbTotal)
            : baseSpecies.avgAbwGrams;

    const expectedRealizedFcr =
        expectedTotalYieldKg > 0 ? expectedTotalFeedKg / expectedTotalYieldKg : baseSpecies.baseFcr;

    return {
        pondId: pondConfig.pondId || "M01-P01",
        moduleId: normalizeModuleKey(pondConfig.moduleId || pondConfig.pondId || "M01"),
        areaHa,
        species,
        geneticLine,
        bsLine: pillar3Hatchery.bsLine,
        stckSource: pillar3Hatchery.stckSource,
        strategyCode,
        harvestPlanCount,
        stockMonth,
        startWeekIndex,
        endWeekIndex: startWeekIndex + totalWeeks - 1,
        targetFinalDoc,
        stockedPlPcs,
        stockDensityPlM2,
        pillarMultipliers: {
            pillar1Turnaround: pillar1,
            pillar2Module: pillar2,
            pillar3Hatchery,
            pillar3Monsoon,
            bayesianUpdate
        },
        weeklySteps,
        partialHarvestEvents,
        finalHarvestEvent: {
            simWeekIndex: startWeekIndex + totalWeeks - 1,
            doc: targetFinalDoc,
            healthyFinalKg: Number(healthyFinalHarvestKg.toFixed(1)),
            expectedNormalFinalKg: Number(expectedNormalFinalHarvestKg.toFixed(1)),
            expectedSalvageKg: Number(expectedSalvageBiomassKg.toFixed(1)),
            finalAbwGrams: Number((finalStep?.abwGrams || 0).toFixed(2))
        },
        sapFeedByCode: Object.values(sapFeedTotalsByCode).map(s => ({
            ...s,
            healthyKg: Number(s.healthyKg.toFixed(1)),
            expectedKg: Number(s.expectedKg.toFixed(1)),
            expectedCostRM: Number(s.expectedCostRM.toFixed(2))
        })),
        expectedOutcomes: {
            healthyTotalYieldKg: Number((healthyFinalHarvestKg + healthyPartialHarvestKg).toFixed(1)),
            expectedTotalYieldKg: Number(expectedTotalYieldKg.toFixed(1)),
            expectedPartialHarvestKg: Number(expectedPartialHarvestKg.toFixed(1)),
            expectedNormalFinalHarvestKg: Number(expectedNormalFinalHarvestKg.toFixed(1)),
            expectedSalvageBiomassKg: Number(expectedSalvageBiomassKg.toFixed(1)),
            expectedAbwGrams: Number(expectedRealizedAbwGrams.toFixed(2)),
            expectedSurvivalPct: Number(Math.min(100, expectedSurvivalPct).toFixed(1)),
            expectedFcr: Number(expectedRealizedFcr.toFixed(2)),
            expectedActiveDocDays: Number(expectedActiveDocDays.toFixed(1)),
            expectedNormalHarvestProb: Number(cumPondSurvivalProb.toFixed(4)),
            expectedForcedHarvestProb: Number(expectedForcedHarvestProbTotal.toFixed(4)),
            expectedCullProb: Number(expectedCullProbTotal.toFixed(4)),
            healthyTotalFeedKg: Number(totalHealthyFeedKg.toFixed(1)),
            expectedTotalFeedKg: Number(expectedTotalFeedKg.toFixed(1))
        }
    };
}
