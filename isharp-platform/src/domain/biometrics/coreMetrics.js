/**
 * iSHARP DBMS 2.0 — Core Biometrics & Growth Math
 * Pure Domain Functions: DOC, Broodstock DOC, Biomass, Survival Rate, ADG,
 * Standard Growth Curves, and Effective Biomass Gain (Partial Harvest SSOT).
 */

import { isCycleClosed } from "../rollover.js";

/**
 * Calculates Day of Culture (DOC) given a stocking date and reference date.
 * If pond is not yet stocked or date is invalid, returns 0.
 * @param {string|Date} stckDate
 * @param {string|Date} [referenceDate]
 * @returns {number}
 */
export function calculateDOC(stckDate, referenceDate = new Date()) {
    if (!stckDate) return 0;

    const normalize = (val) => {
        if (!val) return null;
        if (val instanceof Date) {
            return new Date(val.getFullYear(), val.getMonth(), val.getDate());
        }
        if (typeof val === "string") {
            const parts = val.split("T")[0].split("-").map(Number);
            if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
                return new Date(parts[0], parts[1] - 1, parts[2]);
            }
        }
        const dt = new Date(val);
        return isNaN(dt.getTime()) ? null : new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
    };

    const start = normalize(stckDate);
    const end = normalize(referenceDate) || normalize(new Date());

    if (!start || !end) return 0;

    const diffMs = end.getTime() - start.getTime();
    const doc = Math.round(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(0, doc);
}

/**
 * Calculates Day of Culture (DOC) for Broodstock given an arrival date and target record/spawning date.
 * Strictly implements Option 1 (0-based): arrival date = DOC 0, 1 day after = DOC 1.
 * @param {string|Date} arrivalDate
 * @param {string|Date} [referenceDate]
 * @returns {number}
 */
export function calculateBroodstockDOC(arrivalDate, referenceDate = new Date()) {
    if (!arrivalDate) return 0;
    return calculateDOC(arrivalDate, referenceDate);
}

/**
 * Calculates estimated Pond Biomass in Kilograms.
 * Formula: (Stocked Pcs * Survival % * ABW in grams) / 1000 / 100
 * @param {number} stockedPcs
 * @param {number} survivalPct (e.g. 85 for 85%)
 * @param {number} abwGrams
 * @returns {number} Biomass in kg rounded to 1 decimal place
 */
export function calculateBiomass(stockedPcs, survivalPct, abwGrams) {
    const pcs = Number(stockedPcs) || 0;
    const sr = Number(survivalPct) || 0;
    const abw = Number(abwGrams) || 0;

    if (pcs <= 0 || sr <= 0 || abw <= 0) return 0;
    const biomassKg = (pcs * (sr / 100) * abw) / 1000;
    return Math.round(biomassKg * 10) / 10;
}

/**
 * Single source of truth helper to extract Survival Rate (%) from a sampling record.
 * @param {Object} samplingRecord
 * @returns {number|null} Survival percentage (e.g. 82.5) or null if unavailable
 */
export function getLatestSurvivalRate(samplingRecord) {
    if (!samplingRecord) return null;
    const raw = samplingRecord.smpl_surv ?? samplingRecord.smpl_srv;
    if (raw === null || raw === undefined || raw === "" || isNaN(Number(raw))) {
        return null;
    }
    return parseFloat(raw);
}

/**
 * Calculates Average Daily Gain (ADG) in grams per day between two samplings.
 * Formula: (ABW2 - ABW1) / Days Between
 * @param {number} abwInitial (grams)
 * @param {number} abwFinal (grams)
 * @param {number} days
 * @returns {number} ADG in g/day rounded to 2 decimal places
 */
export function calculateADG(abwInitial, abwFinal, days) {
    const initial = Number(abwInitial) || 0;
    const final = Number(abwFinal) || 0;
    const d = Number(days) || 0;

    if (d <= 0) return 0;
    const adg = (final - initial) / d;
    return Math.round(adg * 100) / 100;
}

/**
 * Benchmark target standard ABW growth curve for Penaeus vannamei and Penaeus monodon.
 * @param {number} doc Days of culture
 * @param {string} [species='VAN'] 'VAN' or 'MON'
 * @returns {number} Standard target ABW in grams
 */
export function getStandardABW(doc, species = "VAN") {
    const d = Number(doc) || 0;
    if (d <= 0) return 0;
    const isMonodon = String(species || "VAN").toUpperCase().includes("MON");

    if (isMonodon) {
        if (d < 35) return Math.round((d * 0.08) * 10) / 10;
        if (d < 70) return Math.round((2.8 + (d - 35) * 0.24) * 10) / 10;
        if (d < 105) return Math.round((11.2 + (d - 70) * 0.38) * 10) / 10;
        return Math.round((24.5 + (d - 105) * 0.42) * 10) / 10;
    }

    if (d < 30) return Math.round((d * 0.12) * 10) / 10;
    if (d < 60) return Math.round((3.6 + (d - 30) * 0.22) * 10) / 10;
    if (d < 90) return Math.round((10.2 + (d - 60) * 0.28) * 10) / 10;
    return Math.round((18.6 + (d - 90) * 0.32) * 10) / 10;
}

/**
 * Computes effective biomass gain to be used for FCR calculation (RULES.md §15).
 * @param {object} pond Pond master record
 * @param {object|null} latestSampling Latest biometrics sampling
 * @param {object|null} harvestSummary Harvest summary from HarvestRepository
 * @returns {{ effectiveGainKg: number, currentBiomassKg: number, partialWeightKg: number, totalHarvestKg: number, isFinal: boolean, hasPartial: boolean }}
 */
export function getEffectiveBiomassGain(pond, latestSampling, harvestSummary) {
    const isClosed = isCycleClosed(pond);
    const currentBiomassKg = latestSampling ? parseFloat(latestSampling.smpl_bms || 0) : 0;

    const hasHarvest = !!(harvestSummary && harvestSummary.hasHarvest && harvestSummary.totalWeightKg > 0);
    const hasFinal = !!(harvestSummary && harvestSummary.hasFinalHarvest);
    const hasPartial = !!(harvestSummary && harvestSummary.hasPartialHarvest);
    const partialWeightKg = harvestSummary ? parseFloat(harvestSummary.partialWeightKg || 0) : 0;
    const totalHarvestKg = harvestSummary ? parseFloat(harvestSummary.totalWeightKg || 0) : 0;

    if (hasHarvest && (isClosed || hasFinal)) {
        return {
            effectiveGainKg: totalHarvestKg,
            currentBiomassKg,
            partialWeightKg,
            totalHarvestKg,
            isFinal: true,
            hasPartial
        };
    }

    if (hasPartial && !hasFinal && !isClosed) {
        return {
            effectiveGainKg: Math.round((currentBiomassKg + partialWeightKg) * 10) / 10,
            currentBiomassKg,
            partialWeightKg,
            totalHarvestKg,
            isFinal: false,
            hasPartial: true
        };
    }

    return {
        effectiveGainKg: currentBiomassKg,
        currentBiomassKg,
        partialWeightKg: 0,
        totalHarvestKg: 0,
        isFinal: false,
        hasPartial: false
    };
}

/**
 * Single source of truth for species-differentiated culture stage definitions across iSHARP DBMS 2.0.
 * - Vannamei (VAN): Early (<30d), Mid (30–60d), Finishing (>60d), Extended (>90d)
 * - Monodon (MON): Early (<50d), Mid (50–90d), Finishing (>90d), Extended (>120d)
 */
export const CULTURE_STAGE_DEFINITIONS = {
    VAN: {
        EARLY: { code: "EARLY", label: "Early (<30d)", minDoc: 0, maxDoc: 29 },
        MID: { code: "MID", label: "Mid (30–60d)", minDoc: 30, maxDoc: 60 },
        FINISHING: { code: "FINISHING", label: "Finishing (>60d)", minDoc: 61, maxDoc: 999 },
        EXTENDED: { code: "EXTENDED", label: "Extended (>90d)", minDoc: 91, maxDoc: 999 }
    },
    MON: {
        EARLY: { code: "EARLY", label: "Early (<50d)", minDoc: 0, maxDoc: 49 },
        MID: { code: "MID", label: "Mid (50–90d)", minDoc: 50, maxDoc: 90 },
        FINISHING: { code: "FINISHING", label: "Finishing (>90d)", minDoc: 91, maxDoc: 999 },
        EXTENDED: { code: "EXTENDED", label: "Extended (>120d)", minDoc: 121, maxDoc: 999 }
    }
};

/**
 * Resolves the culture stage code and metadata for a given pond based on species and DOC.
 * @param {number} doc Days of culture
 * @param {string} [species="VAN"] Species code or label ("VAN" | "MON")
 * @returns {{ stageCode: "EARLY"|"MID"|"FINISHING", stageLabel: string, isFinishing: boolean, isExtended: boolean }}
 */
export function getCultureStage(doc, species = "VAN") {
    const d = Math.max(0, Number(doc) || 0);
    const isMon = String(species || "").toUpperCase().includes("MON");

    if (isMon) {
        if (d < 50) return { stageCode: "EARLY", stageLabel: "Early (< 50d)", isFinishing: false, isExtended: false };
        if (d <= 90) return { stageCode: "MID", stageLabel: "Mid (50–90d)", isFinishing: false, isExtended: false };
        const isExt = d > 120;
        return {
            stageCode: "FINISHING",
            stageLabel: isExt ? "Extended (> 120d)" : "Finishing (> 90d)",
            isFinishing: true,
            isExtended: isExt
        };
    } else {
        if (d < 30) return { stageCode: "EARLY", stageLabel: "Early (< 30d)", isFinishing: false, isExtended: false };
        if (d <= 60) return { stageCode: "MID", stageLabel: "Mid (30–60d)", isFinishing: false, isExtended: false };
        const isExt = d > 90;
        return {
            stageCode: "FINISHING",
            stageLabel: isExt ? "Extended (> 90d)" : "Finishing (> 60d)",
            isFinishing: true,
            isExtended: isExt
        };
    }
}
