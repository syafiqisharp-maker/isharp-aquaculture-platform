/**
 * iSHARP DBMS 2.0 — Frontier Simulation Engine (Phase 3)
 * Module: baselineCalibrator.js
 *
 * PURE DOMAIN MODULE (Zero DOM dependencies, Zero network/fetch calls).
 *
 * Responsibilities:
 * 1. Deduplicates historical legacy & financial tables by `pond_index` (keeping highest `index_no`).
 * 2. Strictly partitions all biological & financial regimes by Root Species (Pillar 0: MONODON vs VANNAMEI)
 *    and Genetic Line (SPF, SPR, SPT, MONODON).
 * 3. Provides the empirically validated 2018-2026 Setiu Priors (`DEFAULT_EMPIRICAL_PRIORS`) across Pillars 0-5.
 * 4. Dynamically recalibrates empirical priors when supplied with fresh database arrays.
 */

export const SPECIES = Object.freeze({
    MONODON: "MONODON",
    VANNAMEI: "VANNAMEI"
});

export const GENETIC_LINES = Object.freeze({
    MONODON: "MONODON",
    SPF: "SPF",
    SPR: "SPR",
    SPT: "SPT"
});

/**
 * Known P. monodon broodstock lines from 2018-2026 Setiu historical records.
 */
export const MONODON_BROODSTOCK_LINES = Object.freeze([
    "CP THAI",
    "MOANA",
    "MADAGASCAR",
    "KSSB",
    "THAI HYBRID",
    "SPF",
    "TOP GENE",
    "MOZAMBIQUE"
]);

/**
 * Known L. vannamei broodstock lines from 2018-2026 Setiu historical records.
 */
export const VANNAMEI_BROODSTOCK_LINES = Object.freeze([
    "SYAQUA",
    "HONDURAS",
    "KONABAY BL",
    "CP",
    "API GOLDEN",
    "SK/25",
    "API FIRE DRAGON",
    "KONABAY",
    "TOP AQUA",
    "YHL-PHI TIK",
    "YHL-PIH TIK",
    "THAI PACIFIC",
    "KONABAY SL",
    "HYBRID",
    "THAI UNION",
    "SIS",
    "SPF-CP",
    "BRL"
]);

/**
 * 10 Culture Strategies (DS1-DS4 Direct Stocking, NT1-NT3 Nursery Transfer, PT1-PT3 Pond Transfer)
 * Single Source of Truth across Domain Engine, StockingThemesTab ('ass'), and ModulePlannerGrid ('main').
 */
export const CULTURE_STRATEGIES = {
    DS1: {
        code: "DS1",
        category: "DIRECT",
        name: "DS1 • Direct Stocking 1X (SPF)",
        label: "Direct Stocking 1X (Standard)",
        speciesDefault: SPECIES.VANNAMEI,
        geneticLineDefault: GENETIC_LINES.SPF,
        initialWeightGrams: 0.01,
        transferSurvivalPct: 100.0,
        harvestPlanCount: 1,
        partialSkimKg: [0, 0],
        partialTriggerDoc: [],
        targetFinalDoc: 92,
        durationWeeks: 13,
        restWeeks: 5,
        defaultDensityPlM2: 96,
        expectedYieldPondKg: 2950,
        expectedAbwG: 16.5,
        expectedSrPct: 68.0,
        expectedFcr: 1.55,
        expectedFeedPondMt: 4.6,
        expectedEbitdaPondRm: 14500,
        targetYieldPondKg: 3500,
        targetAbwG: 18.0,
        targetSrPct: 76.0,
        targetFcr: 1.45,
        targetEbitdaPondRm: 21500,
        feedWk: 0.45,
        plM: 0.48,
        badgeClass: "bg-theme-ds1",
        description: "Standard 1X direct-stocked SPF Vannamei crop for baseline cycle completion."
    },
    DS2: {
        code: "DS2",
        category: "DIRECT",
        name: "DS2 • Direct Stocking 2X (SPR)",
        label: "Direct Stocking 2X (Partial + Final)",
        speciesDefault: SPECIES.VANNAMEI,
        geneticLineDefault: GENETIC_LINES.SPR,
        initialWeightGrams: 0.01,
        transferSurvivalPct: 100.0,
        harvestPlanCount: 2,
        partialSkimKg: [1000, 0],
        partialTriggerDoc: [70],
        targetFinalDoc: 98,
        durationWeeks: 14,
        restWeeks: 5,
        defaultDensityPlM2: 112,
        expectedYieldPondKg: 4200,
        expectedAbwG: 19.5,
        expectedSrPct: 74.0,
        expectedFcr: 1.58,
        expectedFeedPondMt: 6.6,
        expectedEbitdaPondRm: 24200,
        targetYieldPondKg: 4800,
        targetAbwG: 21.0,
        targetSrPct: 80.0,
        targetFcr: 1.48,
        targetEbitdaPondRm: 31800,
        feedWk: 0.50,
        plM: 0.56,
        badgeClass: "bg-theme-ds2",
        description: "Hardy SPR broodstock (API Golden/Fire Dragon) with 1,000kg partial thinning at DOC 70."
    },
    DS3: {
        code: "DS3",
        category: "DIRECT",
        name: "DS3 • Direct Stocking 3X (SPT)",
        label: "Direct Stocking 3X (2 Partials + Final)",
        speciesDefault: SPECIES.VANNAMEI,
        geneticLineDefault: GENETIC_LINES.SPT,
        initialWeightGrams: 0.01,
        transferSurvivalPct: 100.0,
        harvestPlanCount: 3,
        partialSkimKg: [900, 900],
        partialTriggerDoc: [68, 84],
        targetFinalDoc: 105,
        durationWeeks: 15,
        restWeeks: 5,
        defaultDensityPlM2: 122,
        expectedYieldPondKg: 4850,
        expectedAbwG: 20.4,
        expectedSrPct: 75.0,
        expectedFcr: 1.56,
        expectedFeedPondMt: 7.5,
        expectedEbitdaPondRm: 29800,
        targetYieldPondKg: 5500,
        targetAbwG: 22.0,
        targetSrPct: 82.0,
        targetFcr: 1.46,
        targetEbitdaPondRm: 38400,
        feedWk: 0.52,
        plM: 0.61,
        badgeClass: "bg-theme-ds3",
        description: "Commercial 3X Vannamei strategy with two 900kg partial skims at DOC 68 & 84."
    },
    DS4: {
        code: "DS4",
        category: "DIRECT",
        name: "DS4 • Direct Stocking Monodon",
        label: "Direct Stocking Monodon (Black Tiger)",
        speciesDefault: SPECIES.MONODON,
        geneticLineDefault: GENETIC_LINES.MONODON,
        initialWeightGrams: 0.015,
        transferSurvivalPct: 100.0,
        harvestPlanCount: 1,
        partialSkimKg: [0, 0],
        partialTriggerDoc: [],
        targetFinalDoc: 112,
        durationWeeks: 16,
        restWeeks: 6,
        defaultDensityPlM2: 45,
        expectedYieldPondKg: 4500,
        expectedAbwG: 32.0,
        expectedSrPct: 73.0,
        expectedFcr: 1.91,
        expectedFeedPondMt: 8.6,
        expectedEbitdaPondRm: 38500,
        targetYieldPondKg: 5100,
        targetAbwG: 35.0,
        targetSrPct: 78.0,
        targetFcr: 1.80,
        targetEbitdaPondRm: 46500,
        feedWk: 0.54,
        plM: 0.23,
        badgeClass: "bg-theme-ds4",
        description: "Premium Penaeus monodon (CP Thai/Moana) in dedicated high-salinity strongholds (M07–M09)."
    },
    NT1: {
        code: "NT1",
        category: "NURSERY_TRANSFER",
        name: "NT1 • Nursery Transfer 1X",
        label: "Nursery Transfer 1X (1.0g Juvenile)",
        speciesDefault: SPECIES.VANNAMEI,
        geneticLineDefault: GENETIC_LINES.SPR,
        isNurseryTransfer: true,
        initialWeightGrams: 1.0,
        transferSurvivalPct: 80.0,
        harvestPlanCount: 1,
        partialSkimKg: [0, 0],
        partialTriggerDoc: [],
        targetFinalDoc: 72,
        durationWeeks: 11,
        restWeeks: 5,
        defaultDensityPlM2: 95,
        expectedYieldPondKg: 4400,
        expectedAbwG: 20.0,
        expectedSrPct: 78.0,
        expectedFcr: 1.50,
        expectedFeedPondMt: 6.6,
        expectedEbitdaPondRm: 27800,
        targetYieldPondKg: 4900,
        targetAbwG: 21.5,
        targetSrPct: 84.0,
        targetFcr: 1.42,
        targetEbitdaPondRm: 34200,
        feedWk: 0.60,
        plM: 0.48,
        badgeClass: "bg-theme-nt1",
        description: "Pre-conditioned 1.0g nursery juveniles transferred for rapid 72-day growout."
    },
    NT2: {
        code: "NT2",
        category: "NURSERY_TRANSFER",
        name: "NT2 • Nursery Transfer 2X",
        label: "Nursery Transfer 2X (1.0g + 1,200kg Skim)",
        speciesDefault: SPECIES.VANNAMEI,
        geneticLineDefault: GENETIC_LINES.SPR,
        isNurseryTransfer: true,
        initialWeightGrams: 1.0,
        transferSurvivalPct: 80.0,
        harvestPlanCount: 2,
        partialSkimKg: [1200, 0],
        partialTriggerDoc: [55],
        targetFinalDoc: 78,
        durationWeeks: 12,
        restWeeks: 5,
        defaultDensityPlM2: 115,
        expectedYieldPondKg: 5200,
        expectedAbwG: 21.5,
        expectedSrPct: 82.0,
        expectedFcr: 1.52,
        expectedFeedPondMt: 7.9,
        expectedEbitdaPondRm: 34500,
        targetYieldPondKg: 5800,
        targetAbwG: 23.0,
        targetSrPct: 86.0,
        targetFcr: 1.44,
        targetEbitdaPondRm: 42100,
        feedWk: 0.66,
        plM: 0.58,
        badgeClass: "bg-theme-nt2",
        description: "High-density 1.0g nursery stock with mid-cycle 1,200kg carrying-capacity skim at DOC 55."
    },
    NT3: {
        code: "NT3",
        category: "NURSERY_TRANSFER",
        name: "NT3 • Nursery Transfer 3X",
        label: "Nursery Transfer 3X (1.0g + 2x1,200kg Skim)",
        speciesDefault: SPECIES.VANNAMEI,
        geneticLineDefault: GENETIC_LINES.SPR,
        isNurseryTransfer: true,
        initialWeightGrams: 1.0,
        transferSurvivalPct: 80.0,
        harvestPlanCount: 3,
        partialSkimKg: [1200, 1200],
        partialTriggerDoc: [52, 68],
        targetFinalDoc: 85,
        durationWeeks: 13,
        restWeeks: 5,
        defaultDensityPlM2: 125,
        expectedYieldPondKg: 6050,
        expectedAbwG: 23.2,
        expectedSrPct: 83.0,
        expectedFcr: 1.49,
        expectedFeedPondMt: 9.0,
        expectedEbitdaPondRm: 46800,
        targetYieldPondKg: 6700,
        targetAbwG: 25.0,
        targetSrPct: 88.0,
        targetFcr: 1.40,
        targetEbitdaPondRm: 55200,
        feedWk: 0.69,
        plM: 0.63,
        badgeClass: "bg-theme-nt2",
        description: "Two 1,200kg partial skims on 1.0g nursery stock for maximum annual pond turnover."
    },
    PT1: {
        code: "PT1",
        category: "POND_TRANSFER",
        name: "PT1 • Pond Transfer 1X",
        label: "Pond Transfer 1X (1.2g Juvenile)",
        speciesDefault: SPECIES.VANNAMEI,
        geneticLineDefault: GENETIC_LINES.SPT,
        initialWeightGrams: 1.2,
        transferSurvivalPct: 70.0,
        harvestPlanCount: 1,
        partialSkimKg: [0, 0],
        partialTriggerDoc: [],
        targetFinalDoc: 70,
        durationWeeks: 10,
        restWeeks: 5,
        defaultDensityPlM2: 90,
        expectedYieldPondKg: 4100,
        expectedAbwG: 19.5,
        expectedSrPct: 72.0,
        expectedFcr: 1.56,
        expectedFeedPondMt: 6.4,
        expectedEbitdaPondRm: 23400,
        targetYieldPondKg: 4600,
        targetAbwG: 21.0,
        targetSrPct: 78.0,
        targetFcr: 1.48,
        targetEbitdaPondRm: 29800,
        feedWk: 0.64,
        plM: 0.45,
        badgeClass: "bg-theme-pt2",
        description: "2-stage pond-to-pond transfer of 1.2g juveniles for shortened 10-week finishing phase."
    },
    PT2: {
        code: "PT2",
        category: "POND_TRANSFER",
        name: "PT2 • Pond Transfer 2X",
        label: "Pond Transfer 2X (1.2g + 800kg Skim)",
        speciesDefault: SPECIES.VANNAMEI,
        geneticLineDefault: GENETIC_LINES.SPT,
        initialWeightGrams: 1.2,
        transferSurvivalPct: 70.0,
        harvestPlanCount: 2,
        partialSkimKg: [800, 0],
        partialTriggerDoc: [52],
        targetFinalDoc: 76,
        durationWeeks: 11,
        restWeeks: 5,
        defaultDensityPlM2: 110,
        expectedYieldPondKg: 4950,
        expectedAbwG: 20.2,
        expectedSrPct: 74.0,
        expectedFcr: 1.56,
        expectedFeedPondMt: 7.7,
        expectedEbitdaPondRm: 31200,
        targetYieldPondKg: 5500,
        targetAbwG: 22.0,
        targetSrPct: 80.0,
        targetFcr: 1.46,
        targetEbitdaPondRm: 38900,
        feedWk: 0.70,
        plM: 0.55,
        badgeClass: "bg-theme-pt2",
        description: "Skims 800kg at DOC 52 after 1.2g pond transfer to unlock compensatory late-stage growth."
    },
    PT3: {
        code: "PT3",
        category: "POND_TRANSFER",
        name: "PT3 • Multi-Skim 3X Max Yield",
        label: "Pond Transfer 3X (1.2g + 2x800kg Skim)",
        speciesDefault: SPECIES.VANNAMEI,
        geneticLineDefault: GENETIC_LINES.SPR,
        initialWeightGrams: 1.2,
        transferSurvivalPct: 70.0,
        harvestPlanCount: 3,
        partialSkimKg: [800, 800],
        partialTriggerDoc: [50, 65],
        targetFinalDoc: 82,
        durationWeeks: 12,
        restWeeks: 6,
        defaultDensityPlM2: 120,
        expectedYieldPondKg: 6150,
        expectedAbwG: 24.5,
        expectedSrPct: 84.0,
        expectedFcr: 1.48,
        expectedFeedPondMt: 9.1,
        expectedEbitdaPondRm: 50200,
        targetYieldPondKg: 6800,
        targetAbwG: 26.0,
        targetSrPct: 88.0,
        targetFcr: 1.40,
        targetEbitdaPondRm: 59500,
        feedWk: 0.76,
        plM: 0.60,
        badgeClass: "bg-theme-pt3",
        description: "Two mid-cycle 800kg partial skims enabling maximum biomass yield per ha."
    }
};

/**
 * Registers or updates a custom culture strategy in the shared `CULTURE_STRATEGIES` registry
 * so that `StockingThemesTab`, `ModulePlannerGrid`, `PondCycleModal`, and `simTickEngine`
 * all share a single source of truth.
 *
 * @param {Object} customDef
 * @returns {Object} The normalized strategy entry
 */
export function registerCustomStrategy(customDef = {}) {
    const code = String(customDef.code || "DS5").trim().toUpperCase();
    const durationWeeks = Number(customDef.durationWeeks) || 12;
    const densityPlM2 = Number(customDef.defaultDensityPlM2 ?? customDef.densityPlM2) || 90;
    const expectedYieldPondKg = Number(customDef.expectedYieldPondKg) || 3800;
    const expectedFeedPondMt = Number(customDef.expectedFeedPondMt) || 5.8;

    const entry = {
        code,
        category: customDef.category || "DIRECT",
        name: customDef.name || `${code} • Custom Strategy`,
        label: customDef.label || customDef.name || `${code} Custom Strategy`,
        speciesDefault: customDef.speciesDefault || customDef.species || SPECIES.VANNAMEI,
        geneticLineDefault: customDef.geneticLineDefault || customDef.geneticLine || GENETIC_LINES.SPT,
        initialWeightGrams: Number(customDef.initialWeightGrams) || 0.01,
        transferSurvivalPct: Number(customDef.transferSurvivalPct) || 100.0,
        harvestPlanCount: Number(customDef.harvestPlanCount) || 1,
        partialSkimKg: Array.isArray(customDef.partialSkimKg) ? customDef.partialSkimKg : [0, 0],
        partialTriggerDoc: Array.isArray(customDef.partialTriggerDoc) ? customDef.partialTriggerDoc : [],
        targetFinalDoc: Number(customDef.targetFinalDoc ?? customDef.targetDocDays) || (durationWeeks * 7),
        durationWeeks,
        restWeeks: Number(customDef.restWeeks) || 5,
        defaultDensityPlM2: densityPlM2,
        expectedYieldPondKg,
        expectedAbwG: Number(customDef.expectedAbwG) || 18.5,
        expectedSrPct: Number(customDef.expectedSrPct) || 72.0,
        expectedFcr: Number(customDef.expectedFcr) || 1.56,
        expectedFeedPondMt,
        expectedEbitdaPondRm: Number(customDef.expectedEbitdaPondRm) || 21000,
        targetYieldPondKg: Number(customDef.targetYieldPondKg) || Math.round(expectedYieldPondKg * 1.15),
        targetAbwG: Number(customDef.targetAbwG) || 20.0,
        targetSrPct: Number(customDef.targetSrPct) || 78.0,
        targetFcr: Number(customDef.targetFcr) || 1.45,
        targetEbitdaPondRm: Number(customDef.targetEbitdaPondRm) || 27500,
        feedWk: Number((expectedFeedPondMt / Math.max(1, durationWeeks)).toFixed(2)),
        plM: Number(((densityPlM2 * 5000) / 1000000).toFixed(2)),
        badgeClass: customDef.badgeClass || "bg-theme-ds3",
        description: customDef.description || "Custom user-configured stocking strategy."
    };

    CULTURE_STRATEGIES[code] = entry;
    return entry;
}

/**
 * Deduplicates an array of database records by `pond_index`, keeping the record
 * with the highest `id` or `index_no`.
 *
 * @param {Array<Object>} rows
 * @returns {Array<Object>} Deduplicated records
 */
export function deduplicateByPondIndex(rows) {
    if (!Array.isArray(rows) || rows.length === 0) return [];
    const byPondIndex = new Map();

    for (const row of rows) {
        if (!row || typeof row !== "object") continue;
        const pIdx = row.pond_index ? String(row.pond_index).trim() : "";
        if (!pIdx) continue;

        const existing = byPondIndex.get(pIdx);
        const currRank = Number(row.id ?? row.index_no) || 0;
        const prevRank = existing ? (Number(existing.id ?? existing.index_no) || 0) : -Infinity;

        if (!existing || currRank >= prevRank) {
            byPondIndex.set(pIdx, row);
        }
    }

    return Array.from(byPondIndex.values());
}

/**
 * Strictly classifies a pond cycle into Root Species (`MONODON` vs `VANNAMEI`)
 * using explicit species tag, `pl_type`, `bs_line`, strategy, and stocking density.
 *
 * @param {Object} params
 * @param {string} [params.species]
 * @param {string} [params.plType]
 * @param {string} [params.bsLine]
 * @param {string} [params.strategy]
 * @param {number} [params.stockDensity]
 * @returns {"MONODON" | "VANNAMEI"}
 */
export function classifySpecies({ species = "", plType = "", bsLine = "", strategy = "", stockDensity = 0 } = {}) {
    const spUpper = String(species || "").toUpperCase().trim();
    if (spUpper === "MONODON" || spUpper === "MON" || spUpper.includes("MONODON") || spUpper.includes("TIGER")) {
        return SPECIES.MONODON;
    }
    if (spUpper === "VANNAMEI" || spUpper === "VAN" || spUpper.includes("VANNAMEI")) {
        return SPECIES.VANNAMEI;
    }

    const plUpper = String(plType || "").toUpperCase().trim();
    if (plUpper.includes("MONODON") || plUpper === "MON") {
        return SPECIES.MONODON;
    }

    const stUpper = String(strategy || "").toUpperCase().trim();
    if (stUpper === "DS4" || stUpper.endsWith(".M")) {
        return SPECIES.MONODON;
    }

    const bsUpper = String(bsLine || "").toUpperCase().trim();
    if (MONODON_BROODSTOCK_LINES.includes(bsUpper)) {
        return SPECIES.MONODON;
    }
    if (VANNAMEI_BROODSTOCK_LINES.includes(bsUpper)) {
        return SPECIES.VANNAMEI;
    }

    const sd = Number(stockDensity) || 0;
    if (sd > 0 && sd <= 58) {
        return SPECIES.MONODON;
    }

    return SPECIES.VANNAMEI;
}

/**
 * Resolves the genetic sub-line (`MONODON`, `SPR`, `SPT`, `SPF`) for reporting & PL pricing.
 *
 * @param {Object} params
 * @param {string} [params.species]
 * @param {string} [params.plType]
 * @param {string} [params.bsLine]
 * @returns {"MONODON" | "SPR" | "SPT" | "SPF"}
 */
export function resolveGeneticLine({ species = "", plType = "", bsLine = "" } = {}) {
    const resolvedSp = classifySpecies({ species, plType, bsLine });
    if (resolvedSp === SPECIES.MONODON) return GENETIC_LINES.MONODON;

    const plUpper = String(plType || "").toUpperCase().trim();
    if (plUpper.includes("SPR")) return GENETIC_LINES.SPR;
    if (plUpper.includes("SPT")) return GENETIC_LINES.SPT;
    if (plUpper.includes("SPF")) return GENETIC_LINES.SPF;

    const bsUpper = String(bsLine || "").toUpperCase().trim();
    if (bsUpper.includes("API GOLDEN") || bsUpper.includes("API FIRE DRAGON") || bsUpper.includes("HONDURAS") || bsUpper.includes("KONABAY")) {
        return GENETIC_LINES.SPR;
    }
    if (bsUpper.includes("SYAQUA") || bsUpper.includes("SK/25") || bsUpper.includes("TOP AQUA")) {
        return GENETIC_LINES.SPT;
    }
    return GENETIC_LINES.SPF;
}

/**
 * Default Empirically Calibrated Priors (2018-2026 iSHARP Setiu Dataset: 7,665 Unique Cycles & 7,475 Financial Ledgers)
 */
export const DEFAULT_EMPIRICAL_PRIORS = Object.freeze({
    version: "2.0.0-Setiu-Empirical",

    // =========================================================================
    // PILLAR 0: ROOT SPECIES BASELINES (2018-2026 SEPARATED)
    // =========================================================================
    speciesBaselines: {
        MONODON: {
            avgDensityPlM2: 44.5,
            avgYieldKg: 3943,
            avgAbwGrams: 29.9,
            avgSurvivalPct: 73.3,
            baseAdgGramsPerDay: 0.246,
            baseFcr: 1.91,
            baseFailRatePct: 32.3,
            baseCullRatePct: 7.9,
            baseSellingPriceRmPerKg: 27.58,
            avgEbitdaRm: 32103,
            standardDocDays: 112,
            standingBiomassCritKgPerM2: 0.85
        },
        VANNAMEI: {
            avgDensityPlM2: 93.6,
            avgYieldKg: 3489,
            avgAbwGrams: 14.7,
            avgSurvivalPct: 64.2,
            baseAdgGramsPerDay: 0.186,
            baseFcr: 1.60,
            baseFailRatePct: 52.9,
            baseCullRatePct: 9.7,
            baseSellingPriceRmPerKg: 20.34,
            avgEbitdaRm: 14389,
            standardDocDays: 92,
            standingBiomassCritKgPerM2: 0.76
        }
    },

    // =========================================================================
    // PILLAR 1: POND TURNAROUND IDLE TIME (DOP = stock_date - close_date)
    // =========================================================================
    turnaroundBuckets: {
        RUSHED: {
            maxDopDays: 20,
            label: "Rushed Prep (<=20d idle)",
            adgMultiplier: 0.782,       // 0.140 / 0.179
            survivalMultiplier: 0.929,  // 61.1% / 65.8%
            fcrMultiplier: 1.072,
            hazardMultiplier: 1.38,
            postDiseaseRelapseHazardMultiplier: 1.85 // Produces net loss (-RM 4,118) when rushed after disease
        },
        SHORT: {
            maxDopDays: 35,
            label: "Short Prep (21-35d idle)",
            adgMultiplier: 0.894,       // 0.160 / 0.179
            survivalMultiplier: 0.980,  // 64.5% / 65.8%
            fcrMultiplier: 1.030,
            hazardMultiplier: 1.14,
            postDiseaseRelapseHazardMultiplier: 1.32
        },
        GOLDEN_REST: {
            maxDopDays: 60,
            label: "Golden Rest (36-60d idle)",
            adgMultiplier: 1.000,       // Baseline equilibrium (ADG 0.179, EBITDA +RM 13,744)
            survivalMultiplier: 1.000,
            fcrMultiplier: 1.000,
            hazardMultiplier: 1.00,
            postDiseaseRelapseHazardMultiplier: 1.04 // Full recovery (+RM 12,849) after 36-60d rest
        },
        EXTENDED: {
            maxDopDays: 9999,
            label: "Extended Rest (>60d idle)",
            adgMultiplier: 1.035,       // Slight biological gain (0.188), but overhead dilution hurts farm P&L
            survivalMultiplier: 1.020,
            fcrMultiplier: 0.990,
            hazardMultiplier: 0.96,
            postDiseaseRelapseHazardMultiplier: 0.98
        }
    },

    // =========================================================================
    // PILLAR 2: SPECIES-SPECIFIC MODULE SUITABILITY, COHESION & CONTAGION
    // =========================================================================
    moduleFixedEffects: {
        VANNAMEI: {
            "01": { tier: "CORE", adgMult: 1.02, srMult: 1.01, hazardMult: 1.01, fcrMult: 0.99, histEbitda: 17617 },
            "02": { tier: "CORE", adgMult: 1.00, srMult: 1.01, hazardMult: 0.97, fcrMult: 1.00, histEbitda: 16836 },
            "03": { tier: "MID_RISK", adgMult: 0.95, srMult: 1.00, hazardMult: 1.02, fcrMult: 0.99, histEbitda: 12151 },
            "04": { tier: "CHAMPION", adgMult: 1.03, srMult: 1.12, hazardMult: 0.81, fcrMult: 0.95, histEbitda: 24517 },
            "05": { tier: "CHAMPION", adgMult: 1.04, srMult: 0.99, hazardMult: 0.87, fcrMult: 1.00, histEbitda: 21119 },
            "06": { tier: "MID_RISK", adgMult: 1.00, srMult: 0.93, hazardMult: 1.07, fcrMult: 1.09, histEbitda: 12695 },
            "07": { tier: "MID_RISK", adgMult: 1.01, srMult: 1.03, hazardMult: 1.03, fcrMult: 0.98, histEbitda: 12238 },
            "08": { tier: "SPECIES_DIVERGENT_POOR", adgMult: 0.94, srMult: 0.94, hazardMult: 1.22, fcrMult: 1.03, histEbitda: 2278 },
            "09": { tier: "SPECIES_DIVERGENT_POOR", adgMult: 0.98, srMult: 0.97, hazardMult: 1.25, fcrMult: 1.00, histEbitda: 199 },
            "10": { tier: "CORE", adgMult: 1.00, srMult: 1.00, hazardMult: 1.00, fcrMult: 1.00, histEbitda: 14389 },
            "11": { tier: "NURSERY", adgMult: 1.08, srMult: 0.85, hazardMult: 1.10, fcrMult: 1.00, histEbitda: -31144 }
        },
        MONODON: {
            "01": { tier: "CORE", adgMult: 0.96, srMult: 0.93, hazardMult: 1.15, fcrMult: 1.02, histEbitda: 24771 },
            "02": { tier: "CORE", adgMult: 0.96, srMult: 1.01, hazardMult: 1.02, fcrMult: 1.08, histEbitda: 27512 },
            "03": { tier: "MID_RISK", adgMult: 0.96, srMult: 0.88, hazardMult: 1.12, fcrMult: 1.11, histEbitda: 21455 },
            "04": { tier: "CHAMPION", adgMult: 1.06, srMult: 1.10, hazardMult: 0.95, fcrMult: 0.94, histEbitda: 44303 },
            "05": { tier: "CHAMPION", adgMult: 1.11, srMult: 0.98, hazardMult: 0.55, fcrMult: 1.00, histEbitda: 48603 },
            "06": { tier: "CHAMPION", adgMult: 1.05, srMult: 1.04, hazardMult: 0.65, fcrMult: 0.97, histEbitda: 35608 },
            "07": { tier: "MID_RISK", adgMult: 0.98, srMult: 0.92, hazardMult: 1.15, fcrMult: 1.04, histEbitda: 21825 },
            "08": { tier: "MONODON_STRONGHOLD", adgMult: 1.00, srMult: 1.08, hazardMult: 0.86, fcrMult: 0.91, histEbitda: 33325 },
            "09": { tier: "MONODON_STRONGHOLD", adgMult: 0.93, srMult: 1.06, hazardMult: 0.89, fcrMult: 0.99, histEbitda: 32415 },
            "10": { tier: "CORE", adgMult: 1.00, srMult: 1.00, hazardMult: 1.00, fcrMult: 1.00, histEbitda: 32103 },
            "11": { tier: "NURSERY", adgMult: 1.00, srMult: 0.90, hazardMult: 1.10, fcrMult: 1.00, histEbitda: 0 }
        }
    },

    moduleCohesionAndContagion: {
        allInAllOutBonus: {
            maxOlderPonds: 0,
            adgMultiplier: 1.04,
            survivalMultiplier: 1.03,
            hazardMultiplier: 0.88 // Clean module start (+RM 22,966 EBITDA)
        },
        staggeredModeratePenalty: {
            maxOlderPonds: 5,
            adgMultiplier: 0.91,
            survivalMultiplier: 0.92,
            hazardMultiplier: 1.24 // Asynchronous overlap drops EBITDA by 78% (+RM 5,001)
        },
        staggeredSeverePenalty: {
            maxOlderPonds: 99,
            adgMultiplier: 0.86,
            survivalMultiplier: 0.88,
            hazardMultiplier: 1.38
        },
        neighborContagionPerDiseasedPond: {
            hazardSlopePerNeighbor: 0.065, // 9+ diseased neighbors drives FCR to 1.78 and EBITDA down from 50k to 9.8k
            fcrSlopePerNeighbor: 0.022
        }
    },

    // =========================================================================
    // PILLAR 3: MONSOON SEASONALITY, BROODSTOCK & HATCHERY SUPPLY MIXING
    // =========================================================================
    monsoonSeasonalityByStockMonth: {
        // Indexed by stocking calendar month (1 = Jan ... 12 = Dec)
        VANNAMEI: {
            1:  { adgMult: 0.92, srMult: 1.10, hazardMult: 0.88, fcrMult: 0.94, label: "Post-Monsoon Recovery" },
            2:  { adgMult: 0.96, srMult: 1.04, hazardMult: 1.02, fcrMult: 0.98, label: "Early Dry Wave" },
            3:  { adgMult: 0.97, srMult: 0.98, hazardMult: 0.96, fcrMult: 1.04, label: "Spring Transition" },
            4:  { adgMult: 1.02, srMult: 1.02, hazardMult: 0.82, fcrMult: 1.00, label: "Dry Prime" },
            5:  { adgMult: 1.05, srMult: 1.02, hazardMult: 0.88, fcrMult: 0.95, label: "Dry Prime" },
            6:  { adgMult: 1.03, srMult: 1.04, hazardMult: 0.95, fcrMult: 0.94, label: "Mid-Year Prime" },
            7:  { adgMult: 1.12, srMult: 0.98, hazardMult: 0.90, fcrMult: 0.96, label: "Summer Peak ADG" },
            8:  { adgMult: 1.08, srMult: 0.98, hazardMult: 0.90, fcrMult: 0.97, label: "Late Summer Prime" },
            9:  { adgMult: 0.98, srMult: 0.90, hazardMult: 1.18, fcrMult: 1.02, label: "Pre-Monsoon Transition" },
            10: { adgMult: 0.94, srMult: 0.92, hazardMult: 1.22, fcrMult: 1.07, label: "Into Monsoon Hazard" },
            11: { adgMult: 0.79, srMult: 0.96, hazardMult: 1.36, fcrMult: 1.09, label: "Peak Monsoon Cliff" },
            12: { adgMult: 0.88, srMult: 0.96, hazardMult: 1.18, fcrMult: 1.14, label: "Late Monsoon" }
        },
        MONODON: {
            1:  { adgMult: 1.01, srMult: 0.90, hazardMult: 1.15, fcrMult: 1.08, label: "Jan Transition" },
            2:  { adgMult: 1.02, srMult: 0.97, hazardMult: 1.00, fcrMult: 1.02, label: "Feb Post-Monsoon" },
            3:  { adgMult: 1.02, srMult: 1.00, hazardMult: 0.74, fcrMult: 1.00, label: "Mar Prime" },
            4:  { adgMult: 1.07, srMult: 1.03, hazardMult: 0.50, fcrMult: 0.99, label: "Apr Golden Window (+RM 54k)" },
            5:  { adgMult: 1.03, srMult: 1.01, hazardMult: 0.56, fcrMult: 0.90, label: "May Golden Window (+RM 53k)" },
            6:  { adgMult: 1.08, srMult: 1.03, hazardMult: 0.68, fcrMult: 0.93, label: "Jun Prime (+RM 49k)" },
            7:  { adgMult: 1.07, srMult: 1.12, hazardMult: 0.48, fcrMult: 0.88, label: "Jul Prime (+RM 45k)" },
            8:  { adgMult: 0.89, srMult: 0.98, hazardMult: 1.55, fcrMult: 1.01, label: "Aug Pre-Monsoon Drop" },
            9:  { adgMult: 0.81, srMult: 0.78, hazardMult: 2.25, fcrMult: 1.25, label: "Sep Monsoon Crash (-RM 18k)" },
            10: { adgMult: 0.75, srMult: 0.94, hazardMult: 1.45, fcrMult: 1.12, label: "Oct Monsoon Crash (-RM 9k)" },
            11: { adgMult: 0.76, srMult: 0.94, hazardMult: 2.05, fcrMult: 1.10, label: "Nov Monsoon Cliff" },
            12: { adgMult: 0.90, srMult: 1.00, hazardMult: 1.65, fcrMult: 1.07, label: "Dec Late Monsoon" }
        }
    },

    broodstockAndHatcheryEffects: {
        broodstockMultipliers: {
            "CP THAI":         { species: "MONODON", adgMult: 1.04, srMult: 1.05, hazardMult: 0.82 },
            "MOANA":           { species: "MONODON", adgMult: 1.03, srMult: 1.02, hazardMult: 0.88 },
            "MADAGASCAR":      { species: "MONODON", adgMult: 1.06, srMult: 1.05, hazardMult: 0.80 },
            "KSSB":            { species: "MONODON", adgMult: 0.97, srMult: 0.98, hazardMult: 1.00 },
            "API GOLDEN":      { species: "VANNAMEI", adgMult: 1.03, srMult: 1.08, hazardMult: 0.76 },
            "API FIRE DRAGON": { species: "VANNAMEI", adgMult: 1.01, srMult: 1.06, hazardMult: 0.80 },
            "KONABAY BL":      { species: "VANNAMEI", adgMult: 1.00, srMult: 1.02, hazardMult: 0.92 },
            "HONDURAS":        { species: "VANNAMEI", adgMult: 0.99, srMult: 1.00, hazardMult: 0.96 },
            "SYAQUA":          { species: "VANNAMEI", adgMult: 1.00, srMult: 0.98, hazardMult: 1.05 },
            "SK/25":           { species: "VANNAMEI", adgMult: 0.86, srMult: 0.84, hazardMult: 1.62 } // 82.6% EHP in H2 2025
        },
        hatcheryTiers: {
            TIER_1_SINGLE: {
                codes: ["SHT", "UBN", "KSK", "CPD", "C.P.", "CP"],
                monthlyCapacityPondsPerHatchery: 28,
                adgMult: 1.03,
                srMult: 1.04,
                hazardMult: 0.85,
                fcrMult: 0.96,
                label: "Tier-1 Clean Single Hatchery"
            },
            MULTI_HATCHERY_MIXED: {
                // Triggered when stck_source has comma/slash (e.g. "SHT,GS", "SHT,KS") or monthly demand exceeds single hatchery cap
                adgMult: 0.84,
                srMult: 0.72,
                hazardMult: 1.72, // 91.3% forced harvest & 60.9% EHP in 2026 SHT,GS
                fcrMult: 1.16,
                label: "Multi-Hatchery Tank Mixing Penalty"
            },
            TIER_2_SECONDARY: {
                codes: ["GSR", "BZYR", "GS", "BZY"],
                adgMult: 0.82,
                srMult: 0.68,
                hazardMult: 1.78, // 95.2% forced harvest in GSR 2026
                fcrMult: 1.18,
                label: "Tier-2 Secondary Hatchery Risk"
            }
        }
    },

    // =========================================================================
    // PILLAR 4: SPECIES DENSITY CURVE, CARRYING CAPACITY & QUALITY GRADING
    // =========================================================================
    densityBrackets: {
        VANNAMEI: [
            { maxPlM2: 74.9,  label: "Under-Stocked (<75 PL/m2)",      adgMult: 1.06, srMult: 1.02, hazardMult: 1.05, fcrMult: 1.01 },
            { maxPlM2: 89.9,  label: "Moderate (75-89 PL/m2)",         adgMult: 1.01, srMult: 1.00, hazardMult: 1.00, fcrMult: 1.01 },
            { maxPlM2: 104.9, label: "Standard 1X (90-104 PL/m2)",     adgMult: 1.00, srMult: 1.01, hazardMult: 0.96, fcrMult: 0.98 },
            { maxPlM2: 119.9, label: "High (105-119 PL/m2)",           adgMult: 0.97, srMult: 0.97, hazardMult: 1.02, fcrMult: 1.00 },
            { maxPlM2: 129.9, label: "Very High 2X/3X (120-129 PL/m2)",adgMult: 0.98, srMult: 1.02, hazardMult: 0.92, fcrMult: 0.95 },
            { maxPlM2: 999.0, label: "Overcrowded (>=130 PL/m2)",      adgMult: 0.75, srMult: 0.88, hazardMult: 1.55, fcrMult: 1.10 }
        ],
        MONODON: [
            { maxPlM2: 39.9,  label: "Low Monodon (<40 PL/m2)",        adgMult: 0.97, srMult: 1.03, hazardMult: 1.25, fcrMult: 0.99 },
            { maxPlM2: 48.5,  label: "Standard Monodon (40-48 PL/m2)", adgMult: 1.00, srMult: 1.00, hazardMult: 1.00, fcrMult: 1.00 },
            { maxPlM2: 58.0,  label: "Prime High Monodon (49-58 PL/m2)",adgMult: 1.01, srMult: 1.06, hazardMult: 0.85, fcrMult: 0.94 },
            { maxPlM2: 999.0, label: "Overcrowded Monodon (>58 PL/m2)", adgMult: 0.82, srMult: 0.84, hazardMult: 1.48, fcrMult: 1.14 }
        ]
    },

    carryingCapacityAndPartialHarvest: {
        // Standing biomass threshold (kg/m2) where oxygen/waste crowding starts slowing ADG and raising late-DOC hazard
        criticalKgPerM2: {
            VANNAMEI: 0.76, // ~3,800 kg in a 0.5 ha pond
            MONODON: 0.85   // ~4,250 kg in a 0.5 ha pond
        },
        partialHarvestRelief: {
            1: { lateHazardMultiplier: 1.00, postSkimAdgBoost: 1.00, survivalBonusMult: 1.00 },
            2: { lateHazardMultiplier: 0.42, postSkimAdgBoost: 1.14, survivalBonusMult: 1.08 }, // Drops fail from 47% to 15.8%, boosts yield to 5,004kg
            3: { lateHazardMultiplier: 0.30, postSkimAdgBoost: 1.22, survivalBonusMult: 1.14 }  // Drops fail to 10%, boosts yield to 6,172kg
        },
        weeklyFarmHarvestLogisticsCapMt: 45.0 // Flag congestion if >45 MT harvested in a single week
    },

    festivePriceMultipliersByMonth: {
        1:  1.06, // New Year / Pre-CNY
        2:  1.10, // Chinese New Year Premium
        3:  1.03, // Ramadhan / Early Raya
        4:  1.05, // Hari Raya Aidilfitri Premium
        5:  1.00,
        6:  0.98,
        7:  0.99,
        8:  1.00,
        9:  0.99,
        10: 1.01, // Deepavali
        11: 0.98,
        12: 1.05  // Year-End Festive Demand
    },

    // =========================================================================
    // PILLAR 5: 16-ELEMENT ECONOMETRIC COST, SAP FEED & 28-CHEMICAL MRP RATES
    // =========================================================================
    financialRates: {
        // 1. Fries / PL unit prices (RM per PL piece)
        plCostPerPieceRM: {
            SPF: 0.021,
            SPR: 0.023,
            SPT: 0.022,
            MONODON: 0.038
        },

        // 2. SAP Feed SKUs & Unit Prices (RM per kg)
        sapFeedSkus: {
            VANNAMEI: [
                { sapCode: "3202", name: "Starter #1 (Crumble)", maxAbwGrams: 2.5,  priceRmPerKg: 6.10 },
                { sapCode: "3203", name: "Starter #2 (Mini Pellet)", maxAbwGrams: 7.0, priceRmPerKg: 5.95 },
                { sapCode: "3205", name: "Grower #3 (Pellet)", maxAbwGrams: 15.0, priceRmPerKg: 5.75 },
                { sapCode: "3206", name: "Finisher #4 (Pellet)", maxAbwGrams: 999, priceRmPerKg: 5.65 }
            ],
            MONODON: [
                { sapCode: "3301", name: "Monodon Starter #1/#2", maxAbwGrams: 5.0,  priceRmPerKg: 6.60 },
                { sapCode: "3302", name: "Monodon Grower #3",     maxAbwGrams: 18.0, priceRmPerKg: 6.40 },
                { sapCode: "3303", name: "Monodon Finisher #4/#5",maxAbwGrams: 999,  priceRmPerKg: 6.25 }
            ]
        },

        // 3. Chemicals & Fertilizers Accounting Cost Driver (from growout_pond_finance.cons_of_chem_fert)
        // Allocated 40% at pond preparation (stocking week) and 60% across active culture weeks.
        chemFertBaseRmPerCycle: {
            VANNAMEI: 1711.0,
            MONODON: 2114.0
        },
        chemFertPrepShare: 0.40,

        // 4. Electricity Accounting Cost Driver (Strictly RM per active pond-day from growout_pond_finance)
        // Aeration is NOT modeled biologically because pond_aerator_inventory is unreliable.
        electricityRmPerActivePondDay: 95.40,
        estimatedTnbTariffRmPerKwh: 0.48,

        // 5. Direct & Variable Pond-Day / Harvest-MT Cost Drivers (from 7,475 audited finance records)
        suppliesRmPerActivePondDay: 9.80,
        harvestExpensesRmPerKg: 0.42,
        directWagesRmPerActivePondDay: 36.50,
        repairMaintenanceBaseRmPerCycle: 1450.0,
        repairMaintenanceMinorSurchargeRM: 2800.0,
        repairMaintenanceMajorSurchargeRM: 7500.0,

        // Monthly Farm-Wide Fixed Overhead Pools (allocated across active ponds each month)
        // When active pond count drops (like Q4 2025 / Q1 2026), overhead per pond spikes automatically.
        monthlyFarmFixedOverheadsRM: {
            wages_indirect: 185000,
            consultant: 12000,
            rental: 18000,
            travel_entertainment: 6500,
            training_seminar: 3200,
            security_charges: 24000,
            other_utilities_ins: 31000,
            other_charges: 14000,
            depreciation_fc: 245000,
            sag: 165000
        }
    }
});

/**
 * Dynamically recalibrates empirical priors from raw historical database rows
 * (`growout_pond_final_legacy`, `growout_pond_finance`, `growout_pond_master`, `pond_stocking_batches`),
 * falling back smoothly to `DEFAULT_EMPIRICAL_PRIORS` for any sparse strata.
 *
 * @param {Object} rawTables
 * @param {Array<Object>} [rawTables.finals]
 * @param {Array<Object>} [rawTables.finances]
 * @param {Array<Object>} [rawTables.masters]
 * @param {Array<Object>} [rawTables.batches]
 * @returns {Object} Calibrated Priors Object
 */
export function calibrateEmpiricalPriors({
    finals = [],
    finances = [],
    masters = [],
    batches = []
} = {}) {
    const cleanFinals = deduplicateByPondIndex(finals);
    const cleanFinances = deduplicateByPondIndex(finances);

    if (cleanFinals.length < 50) {
        return structuredClone(DEFAULT_EMPIRICAL_PRIORS);
    }

    const priors = structuredClone(DEFAULT_EMPIRICAL_PRIORS);
    const finMap = new Map(cleanFinances.map(f => [String(f.pond_index).trim(), f]));
    const mstMap = new Map((masters || []).filter(m => m && m.pond_index).map(m => [String(m.pond_index).trim(), m]));
    const batMap = new Map((batches || []).filter(b => b && b.pond_index).map(b => [String(b.pond_index).trim(), b]));

    const statsBySpecies = {
        MONODON: { kgs: [], abws: [], srs: [], adgs: [], fcrs: [], ebitdas: [], elecPerDay: [], chemFerts: [] },
        VANNAMEI: { kgs: [], abws: [], srs: [], adgs: [], fcrs: [], ebitdas: [], elecPerDay: [], chemFerts: [] }
    };

    for (const r of cleanFinals) {
        const pIdx = String(r.pond_index || "").trim();
        const stDate = String(r.stock_date || r.date_cycle || "");
        if (!pIdx || stDate < "2018-01-01") continue;

        const fin = finMap.get(pIdx) || {};
        const mst = mstMap.get(pIdx) || {};
        const bat = batMap.get(pIdx) || {};

        const sd = Number(r.stock_density) || 0;
        const bsLine = r.bs_line || bat.bs_line || "";
        const plType = bat.pl_type || "";
        const strategy = mst.strategy || "";

        const sp = classifySpecies({ plType, bsLine, strategy, stockDensity: sd });
        const bucket = statsBySpecies[sp];

        const kg = Number(r.final_kg) || 0;
        const abw = Number(r.final_abw) || 0;
        let sr = Number(r.final_sr) || 0;
        if (sr > 0 && sr <= 1.5) sr *= 100;
        const adg = Number(r.final_adg) || 0;
        const fcr = Number(r.final_fcr) || 0;
        const doc = Number(r.final_doc) || 0;

        if (kg >= 0) bucket.kgs.push(kg);
        if (abw > 0) bucket.abws.push(abw);
        if (sr > 0 && sr <= 130) bucket.srs.push(sr);
        if (adg > 0.02 && adg <= 0.8) bucket.adgs.push(adg);
        if (fcr >= 0.6 && fcr <= 3.8) bucket.fcrs.push(fcr);
        if (fin.ebitda !== undefined && fin.ebitda !== null && !isNaN(Number(fin.ebitda))) {
            bucket.ebitdas.push(Number(fin.ebitda));
        }
        if (Number(fin.cons_of_chem_fert) > 0) {
            bucket.chemFerts.push(Number(fin.cons_of_chem_fert));
        }
        if (doc >= 20 && Number(fin.electricity) > 0) {
            const epd = Number(fin.electricity) / doc;
            if (epd >= 20 && epd <= 300) bucket.elecPerDay.push(epd);
        }
    }

    const mean = (arr, fallback) => (arr.length >= 10 ? arr.reduce((a, b) => a + b, 0) / arr.length : fallback);

    for (const sp of [SPECIES.MONODON, SPECIES.VANNAMEI]) {
        const b = statsBySpecies[sp];
        const base = priors.speciesBaselines[sp];
        base.avgYieldKg = Math.round(mean(b.kgs, base.avgYieldKg));
        base.avgAbwGrams = Math.round(mean(b.abws, base.avgAbwGrams) * 10) / 10;
        base.avgSurvivalPct = Math.round(mean(b.srs, base.avgSurvivalPct) * 10) / 10;
        base.baseAdgGramsPerDay = Math.round(mean(b.adgs, base.baseAdgGramsPerDay) * 1000) / 1000;
        base.baseFcr = Math.round(mean(b.fcrs, base.baseFcr) * 100) / 100;
        base.avgEbitdaRm = Math.round(mean(b.ebitdas, base.avgEbitdaRm));
        if (b.chemFerts.length >= 10) {
            priors.financialRates.chemFertBaseRmPerCycle[sp] =
                Math.round(mean(b.chemFerts, priors.financialRates.chemFertBaseRmPerCycle[sp]));
        }
    }

    const allElec = [...statsBySpecies.MONODON.elecPerDay, ...statsBySpecies.VANNAMEI.elecPerDay];
    if (allElec.length >= 20) {
        priors.financialRates.electricityRmPerActivePondDay =
            Math.round((allElec.reduce((a, b) => a + b, 0) / allElec.length) * 100) / 100;
    }

    return priors;
}
