/**
 * iSHARP DBMS 2.0 — Pond EBITDA Estimator
 * Module: ebitdaEstimator.js
 *
 * PURE DOMAIN MODULE (Zero DOM dependencies, Zero network/fetch calls).
 *
 * Implements:
 * 1. Historical unit-economics calibration from past 12 months audited cycle financials (growout_pond_finance)
 * 2. Species normalization (VANNAMEI vs MONODON)
 * 3. ABW size-band pricing interpolation and fallbacks
 * 4. Multi-scenario EBITDA simulation (Conservative P25, Base Median P50, Optimistic P75)
 * 5. Full 5-element cost ledger & unit cost decomposition
 */

export const ESTIMATOR_SPECIES = Object.freeze({
    VANNAMEI: "VANNAMEI",
    MONODON: "MONODON"
});

/**
 * Normalizes user or database species string into canonical "VANNAMEI" or "MONODON".
 * @param {string} rawSpecies
 * @returns {"VANNAMEI"|"MONODON"}
 */
export function normaliseSpecies(rawSpecies) {
    if (!rawSpecies) return ESTIMATOR_SPECIES.VANNAMEI;
    const s = String(rawSpecies).toUpperCase().trim();
    if (s.includes("MONODON") || s.includes("MONO") || s.includes("BLACK TIGER")) {
        return ESTIMATOR_SPECIES.MONODON;
    }
    return ESTIMATOR_SPECIES.VANNAMEI;
}

/**
 * Computes standard percentile of an array of numbers.
 * @param {Array<number>} arr
 * @param {number} p Percentile between 0 and 100
 * @returns {number}
 */
export function percentile(arr, p) {
    if (!arr || arr.length === 0) return 0;
    const sorted = arr.filter(v => typeof v === "number" && !isNaN(v)).sort((a, b) => a - b);
    if (sorted.length === 0) return 0;
    if (sorted.length === 1) return sorted[0];

    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    if (upper >= sorted.length) return sorted[sorted.length - 1];
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * Filter out statistical outliers using realistic aquaculture and accounting bounds.
 * @param {Array<object>} records
 * @returns {Array<object>}
 */
export function filterOutliers(records) {
    if (!records || !Array.isArray(records)) return [];

    return records.filter(r => {
        // Must have valid harvest biomass > 200 kg and valid DOC between 25 and 200 days
        if (!r.totalHarvestKg || r.totalHarvestKg < 200) return false;
        if (!r.doc || r.doc < 25 || r.doc > 200) return false;
        // Must have sensible revenue/kg (RM 8 to RM 65)
        if (r.revenuePerKg && (r.revenuePerKg < 8 || r.revenuePerKg > 65)) return false;
        // Must have sensible cost/kg (RM 6 to RM 80)
        if (r.costPerKg && (r.costPerKg < 6 || r.costPerKg > 80)) return false;
        return true;
    });
}

/**
 * Size bands for ABW grouping (in grams).
 */
export const ABW_SIZE_BANDS = {
    VANNAMEI: [
        { key: "V_SMALL", label: "< 13.0g", min: 0, max: 13.0 },
        { key: "V_MED_LOW", label: "13.0g - 15.5g", min: 13.0, max: 15.5 },
        { key: "V_MEDIUM", label: "15.5g - 18.0g", min: 15.5, max: 18.0 },
        { key: "V_MED_HIGH", label: "18.0g - 21.0g", min: 18.0, max: 21.0 },
        { key: "V_LARGE", label: ">= 21.0g", min: 21.0, max: 999.0 }
    ],
    MONODON: [
        { key: "M_SMALL", label: "< 24.0g", min: 0, max: 24.0 },
        { key: "M_MEDIUM", label: "24.0g - 30.0g", min: 24.0, max: 30.0 },
        { key: "M_LARGE", label: "30.0g - 35.0g", min: 30.0, max: 35.0 },
        { key: "M_JUMBO", label: ">= 35.0g", min: 35.0, max: 999.0 }
    ]
};

/**
 * Finds matching ABW band definition.
 * @param {"VANNAMEI"|"MONODON"} species
 * @param {number} abw
 * @returns {object}
 */
export function getAbwBand(species, abw) {
    const sp = normaliseSpecies(species);
    const bands = ABW_SIZE_BANDS[sp] || ABW_SIZE_BANDS.VANNAMEI;
    const val = Number(abw) || 15;
    for (const b of bands) {
        if (val >= b.min && val < b.max) return b;
    }
    return bands[bands.length - 1];
}

/**
 * Extracts and prepares cycle features from historical database rows.
 * @param {Object} params
 * @param {Array<object>} params.financeRecords Audited growout_pond_finance rows
 * @param {Map<string, object>} params.harvestMap Map of pond_index -> aggregated harvest
 * @param {Map<string, object>} params.stockMap Map of pond_index -> aggregated stocking
 * @param {Map<string, number>} params.feedMap Map of pond_index -> total feed kg
 * @returns {Array<object>}
 */
export function buildHistoricalFeatures({
    financeRecords = [],
    harvestMap = new Map(),
    stockMap = new Map(),
    feedMap = new Map()
} = {}) {
    const cleaned = [];

    for (const f of financeRecords) {
        const pIdx = f.pond_index;
        if (!pIdx) continue;

        const h = harvestMap.get(pIdx);
        const s = stockMap.get(pIdx);
        const feedKg = feedMap.get(pIdx) || 0;

        const totalHarvestKg = h ? Number(h.totalHarvestKg || 0) : 0;
        if (totalHarvestKg < 100) continue; // Skip incomplete or negligible harvests

        const abw = h && h.weightedAbwSum > 0 ? (h.weightedAbwSum / totalHarvestKg) : Number(h?.finalAbw || 0);
        const species = normaliseSpecies(s?.stck_species || "VANNAMEI");

        // Calculate DOC (last harvest date - stocking date)
        let doc = 0;
        if (s?.stck_date && h?.lastHarvestDate) {
            const dStock = new Date(s.stck_date);
            const dHarv = new Date(h.lastHarvestDate);
            const diffTime = dHarv.getTime() - dStock.getTime();
            doc = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)));
        }
        if (doc <= 0) doc = Number(s?.doc || 90);

        const stockedPcs = Number(s?.stck_pcs || 0);
        const revenue = Number(f.revenue || 0);
        const consFeed = Number(f.cons_of_feed || 0);
        const consFries = Number(f.cons_of_fries || 0);
        const ebitda = Number(f.ebitda || 0);
        const totalCost = Number(f.total_cost || 0);
        const deprFc = Number(f.depreciation_fc || 0);
        const sag = Number(f.sag || 0);

        // Effective cash operating cost (excluding non-cash depreciation)
        const cashCost = Number(f.cash_cost_per_kg) > 0 
            ? Number(f.cash_cost_per_kg) * totalHarvestKg 
            : Math.max(0, totalCost - deprFc);

        // Decompose costs:
        // 1. Feed cost
        const feedCostPerKgFeed = feedKg > 0 ? (consFeed / feedKg) : null;
        // 2. Fry cost per PL and per kg harvested
        const fryCostPerPl = stockedPcs > 0 ? (consFries / stockedPcs) : null;
        const fryCostPerKg = totalHarvestKg > 0 ? (consFries / totalHarvestKg) : null;
        // 3. Variable operational costs: chem/fert, supplies, harvest expenses
        const chemCost = Number(f.cons_of_chem_fert || 0);
        const suppCost = Number(f.cons_of_supplies || 0);
        const harvExp = Number(f.harvest_expenses || 0);
        const variableCostSum = chemCost + suppCost + harvExp;
        const variableCostPerKg = totalHarvestKg > 0 ? (variableCostSum / totalHarvestKg) : 0;
        // 4. Daily fixed costs: electricity, wages (direct + indirect), maintenance, rental, etc.
        const electricity = Number(f.electricity || 0);
        const wagesDirect = Number(f.wages_direct || 0);
        const wagesIndirect = Number(f.wages_indirect || 0);
        const repair = Number(f.repair_maintenance || 0);
        const consultant = Number(f.consultant || 0);
        const rental = Number(f.rental || 0);
        const travel = Number(f.travel_entertainment || 0);
        const training = Number(f.training_seminar || 0);
        const security = Number(f.security_charges || 0);
        const otherUtil = Number(f.other_utilities_ins || 0);
        const otherCharges = Number(f.other_charges || 0);
        const fixedCostSum = electricity + wagesDirect + wagesIndirect + repair + consultant + rental + travel + training + security + otherUtil + otherCharges;
        const dailyFixedCostPerDay = doc > 0 ? (fixedCostSum / doc) : 0;

        const revPerKg = Number(f.revenue_per_kg) > 0 ? Number(f.revenue_per_kg) : (revenue / totalHarvestKg);
        const costPerKg = Number(f.cost_per_kg) > 0 ? Number(f.cost_per_kg) : (totalCost / totalHarvestKg);
        const cashCostPerKg = Number(f.cash_cost_per_kg) > 0 ? Number(f.cash_cost_per_kg) : (cashCost / totalHarvestKg);

        cleaned.push({
            pond_index: pIdx,
            species,
            totalHarvestKg,
            abw,
            doc,
            stockedPcs,
            feedKg,
            revenue,
            ebitda,
            revenuePerKg: revPerKg,
            costPerKg,
            cashCostPerKg,
            feedCostPerKgFeed,
            fryCostPerPl,
            fryCostPerKg,
            variableCostPerKg,
            dailyFixedCostPerDay,
            lastHarvestDate: h?.lastHarvestDate || null
        });
    }

    return filterOutliers(cleaned);
}

/**
 * Calculates historical baseline distributions (P25, Median, P75) for a given species and ABW.
 * @param {Array<object>} cleanRecords
 * @param {"VANNAMEI"|"MONODON"} targetSpecies
 * @param {number} targetAbw
 * @returns {object} Calibrated empirical unit economics
 */
export function calculateUnitEconomics(cleanRecords = [], targetSpecies = ESTIMATOR_SPECIES.VANNAMEI, targetAbw = 16.5) {
    const sp = normaliseSpecies(targetSpecies);
    const abw = Math.max(5, Number(targetAbw) || (sp === ESTIMATOR_SPECIES.MONODON ? 28 : 16.5));

    // Filter by species
    const speciesRecords = cleanRecords.filter(r => r.species === sp);
    const cycleCount = speciesRecords.length;

    // Default fallbacks calibrated from 2018-2026 Setiu Priors if data is sparse (< 3 cycles)
    const fallbackPriors = {
        VANNAMEI: {
            pricePerKg: abw >= 24 ? 26.5 : abw >= 20 ? 24.0 : abw >= 17 ? 22.0 : abw >= 14 ? 20.0 : 17.5,
            feedCostPerKgFeed: 5.85,
            fryCostPerPl: 0.022,
            fryCostPerKg: 2.85,
            variableCostPerKg: 1.45,
            dailyFixedCostPerDay: 235.0
        },
        MONODON: {
            pricePerKg: abw >= 35 ? 33.0 : abw >= 30 ? 30.0 : abw >= 25 ? 26.5 : 22.5,
            feedCostPerKgFeed: 6.45,
            fryCostPerPl: 0.038,
            fryCostPerKg: 3.90,
            variableCostPerKg: 1.85,
            dailyFixedCostPerDay: 260.0
        }
    }[sp];

    // Identify ABW band and extract price distribution
    const band = getAbwBand(sp, abw);
    const bandRecords = speciesRecords.filter(r => r.abw >= band.min && r.abw < band.max && r.revenuePerKg > 0);

    let priceP25, priceP50, priceP75;
    if (bandRecords.length >= 3) {
        const prices = bandRecords.map(r => r.revenuePerKg);
        priceP25 = percentile(prices, 25);
        priceP50 = percentile(prices, 50);
        priceP75 = percentile(prices, 75);
    } else if (speciesRecords.length >= 5) {
        // Fall back to overall species distribution shifted by size difference
        const allPrices = speciesRecords.map(r => r.revenuePerKg);
        const baseP50 = percentile(allPrices, 50);
        // Estimate price slope: ~RM 0.45 per gram for Vannamei, RM 0.65 per gram for Monodon
        const slope = sp === ESTIMATOR_SPECIES.MONODON ? 0.65 : 0.45;
        const avgSpeciesAbw = speciesRecords.reduce((acc, r) => acc + r.abw, 0) / speciesRecords.length;
        const abwDelta = abw - avgSpeciesAbw;
        const adjustedBase = Math.max(10, baseP50 + abwDelta * slope);
        const spread = (percentile(allPrices, 75) - percentile(allPrices, 25)) / 2;
        priceP25 = adjustedBase - spread;
        priceP50 = adjustedBase;
        priceP75 = adjustedBase + spread;
    } else {
        priceP50 = fallbackPriors.pricePerKg;
        priceP25 = priceP50 * 0.93;
        priceP75 = priceP50 * 1.07;
    }

    // Feed cost per kg feed distribution
    const feedRates = speciesRecords
        .map(r => r.feedCostPerKgFeed)
        .filter(v => typeof v === "number" && v >= 3.5 && v <= 12.0);
    const feedCostP25 = feedRates.length >= 3 ? percentile(feedRates, 25) : fallbackPriors.feedCostPerKgFeed * 0.96;
    const feedCostP50 = feedRates.length >= 3 ? percentile(feedRates, 50) : fallbackPriors.feedCostPerKgFeed;
    const feedCostP75 = feedRates.length >= 3 ? percentile(feedRates, 75) : fallbackPriors.feedCostPerKgFeed * 1.04;

    // Fry cost per PL distribution
    const plRates = speciesRecords
        .map(r => r.fryCostPerPl)
        .filter(v => typeof v === "number" && v >= 0.010 && v <= 0.065);
    const fryPlP25 = plRates.length >= 3 ? percentile(plRates, 25) : fallbackPriors.fryCostPerPl * 0.95;
    const fryPlP50 = plRates.length >= 3 ? percentile(plRates, 50) : fallbackPriors.fryCostPerPl;
    const fryPlP75 = plRates.length >= 3 ? percentile(plRates, 75) : fallbackPriors.fryCostPerPl * 1.05;

    // Fry cost per kg harvested distribution (fallback when PL count is not provided)
    const fryKgRates = speciesRecords
        .map(r => r.fryCostPerKg)
        .filter(v => typeof v === "number" && v >= 0.5 && v <= 8.0);
    const fryKgP25 = fryKgRates.length >= 3 ? percentile(fryKgRates, 25) : fallbackPriors.fryCostPerKg * 0.92;
    const fryKgP50 = fryKgRates.length >= 3 ? percentile(fryKgRates, 50) : fallbackPriors.fryCostPerKg;
    const fryKgP75 = fryKgRates.length >= 3 ? percentile(fryKgRates, 75) : fallbackPriors.fryCostPerKg * 1.08;

    // Variable other cost per kg (chemicals, supplies, harvest labor)
    const varRates = speciesRecords
        .map(r => r.variableCostPerKg)
        .filter(v => typeof v === "number" && v >= 0.2 && v <= 5.0);
    const varCostP25 = varRates.length >= 3 ? percentile(varRates, 25) : fallbackPriors.variableCostPerKg * 0.90;
    const varCostP50 = varRates.length >= 3 ? percentile(varRates, 50) : fallbackPriors.variableCostPerKg;
    const varCostP75 = varRates.length >= 3 ? percentile(varRates, 75) : fallbackPriors.variableCostPerKg * 1.10;

    // Daily fixed costs per active pond day (wages, electricity, maintenance, rental, farm overhead)
    const fixedRates = speciesRecords
        .map(r => r.dailyFixedCostPerDay)
        .filter(v => typeof v === "number" && v >= 50 && v <= 500);
    const fixedCostP25 = fixedRates.length >= 3 ? percentile(fixedRates, 25) : fallbackPriors.dailyFixedCostPerDay * 0.90;
    const fixedCostP50 = fixedRates.length >= 3 ? percentile(fixedRates, 50) : fallbackPriors.dailyFixedCostPerDay;
    const fixedCostP75 = fixedRates.length >= 3 ? percentile(fixedRates, 75) : fallbackPriors.dailyFixedCostPerDay * 1.10;

    return {
        species: sp,
        targetAbw: abw,
        cycleCount,
        abwBand: band.label,
        abwBandCycleCount: bandRecords.length,
        confidenceLevel: cycleCount >= 20 ? "HIGH" : cycleCount >= 5 ? "MODERATE" : "LOW",
        drivers: {
            pricePerKg: { p25: priceP25, p50: priceP50, p75: priceP75 },
            feedCostPerKgFeed: { p25: feedCostP25, p50: feedCostP50, p75: feedCostP75 },
            fryCostPerPl: { p25: fryPlP25, p50: fryPlP50, p75: fryPlP75 },
            fryCostPerKg: { p25: fryKgP25, p50: fryKgP50, p75: fryKgP75 },
            variableCostPerKg: { p25: varCostP25, p50: varCostP50, p75: varCostP75 },
            dailyFixedCostPerDay: { p25: fixedCostP25, p50: fixedCostP50, p75: fixedCostP75 }
        }
    };
}

/**
 * Executes multi-scenario EBITDA calculation from user inputs and calibrated unit economics.
 *
 * @param {Object} inputs User input parameters
 * @param {string} inputs.species "VANNAMEI" | "MONODON"
 * @param {number} inputs.doc Target Days of Culture (e.g. 90)
 * @param {number} inputs.tonnage Expected harvest biomass in Metric Tons (e.g. 3.5)
 * @param {number} inputs.totalFeed Total cumulative feed in kilograms (e.g. 5200)
 * @param {number} inputs.abw Average body weight in grams (e.g. 18.5)
 * @param {number} [inputs.stockedPl] Optional stocked PL count in pieces (e.g. 450,000)
 * @param {object} economics Calibrated economics from calculateUnitEconomics
 * @returns {object} Full EBITDA results, scenarios (Low, Base, High), and detailed breakdown
 */
export function estimateEbitda(inputs = {}, economics = null) {
    const sp = normaliseSpecies(inputs.species);
    const doc = Math.max(1, Number(inputs.doc) || 90);
    // Support harvest weight in kg (recommended) or legacy MT
    let tonnageKg;
    if (inputs.harvestKg !== undefined && inputs.harvestKg !== null) {
        tonnageKg = Math.max(10, Number(inputs.harvestKg) || 3500);
    } else if (inputs.tonnageKg !== undefined && inputs.tonnageKg !== null) {
        tonnageKg = Math.max(10, Number(inputs.tonnageKg) || 3500);
    } else {
        const rawTonnage = Number(inputs.tonnage) || 3500;
        tonnageKg = rawTonnage <= 100 ? rawTonnage * 1000.0 : rawTonnage;
    }
    const tonnageMt = tonnageKg / 1000.0;
    const totalFeedKg = Math.max(0, Number(inputs.totalFeed) || 0);
    const abw = Math.max(4.0, Number(inputs.abw) || (sp === ESTIMATOR_SPECIES.MONODON ? 28.0 : 16.5));
    const stockedPl = inputs.stockedPl && Number(inputs.stockedPl) > 0 ? Number(inputs.stockedPl) : null;

    const eco = economics || calculateUnitEconomics([], sp, abw);
    const d = eco.drivers;

    // FCR
    const fcr = tonnageKg > 0 ? (totalFeedKg / tonnageKg) : 0;

    /**
     * Helper to compute a single scenario:
     * - price: RM/kg
     * - feedCostRate: RM/kg feed
     * - fryRate: RM/PL or RM/kg harvest
     * - varCostRate: RM/kg harvest
     * - dailyFixedRate: RM/day
     */
    const computeScenario = (priceRate, feedRate, fryRate, varRate, fixedRate) => {
        const revenue = tonnageKg * priceRate;
        const feedCost = totalFeedKg * feedRate;
        const fryCost = stockedPl ? (stockedPl * fryRate) : (tonnageKg * fryRate);
        const variableCost = tonnageKg * varRate;
        const fixedCost = doc * fixedRate;
        const totalCashCost = feedCost + fryCost + variableCost + fixedCost;
        const ebitda = revenue - totalCashCost;
        const ebitdaPerKg = tonnageKg > 0 ? (ebitda / tonnageKg) : 0;
        const cashCostPerKg = tonnageKg > 0 ? (totalCashCost / tonnageKg) : 0;

        return {
            revenue: Number(revenue.toFixed(2)),
            feedCost: Number(feedCost.toFixed(2)),
            fryCost: Number(fryCost.toFixed(2)),
            variableCost: Number(variableCost.toFixed(2)),
            fixedCost: Number(fixedCost.toFixed(2)),
            totalCashCost: Number(totalCashCost.toFixed(2)),
            ebitda: Number(ebitda.toFixed(2)),
            ebitdaPerKg: Number(ebitdaPerKg.toFixed(2)),
            cashCostPerKg: Number(cashCostPerKg.toFixed(2)),
            effectivePricePerKg: Number(priceRate.toFixed(2))
        };
    };

    // Conservative / Low Scenario: Low selling price (P25) + High unit costs (P75)
    const lowFryRate = stockedPl ? d.fryCostPerPl.p75 : d.fryCostPerKg.p75;
    const low = computeScenario(
        d.pricePerKg.p25,
        d.feedCostPerKgFeed.p75,
        lowFryRate,
        d.variableCostPerKg.p75,
        d.dailyFixedCostPerDay.p75
    );

    // Base Scenario: Median selling price (P50) + Median unit costs (P50)
    const baseFryRate = stockedPl ? d.fryCostPerPl.p50 : d.fryCostPerKg.p50;
    const base = computeScenario(
        d.pricePerKg.p50,
        d.feedCostPerKgFeed.p50,
        baseFryRate,
        d.variableCostPerKg.p50,
        d.dailyFixedCostPerDay.p50
    );

    // Optimistic / High Scenario: High selling price (P75) + Low unit costs (P25)
    const highFryRate = stockedPl ? d.fryCostPerPl.p25 : d.fryCostPerKg.p25;
    const high = computeScenario(
        d.pricePerKg.p75,
        d.feedCostPerKgFeed.p25,
        highFryRate,
        d.variableCostPerKg.p25,
        d.dailyFixedCostPerDay.p25
    );

    // Diagnostic warnings
    const warnings = [];
    if (fcr < 1.1 || fcr > 2.4) {
        warnings.push(`Unusual FCR of ${fcr.toFixed(2)} (typical range is 1.25 – 1.85). Verify feed and tonnage inputs.`);
    }
    if (doc < 60 && tonnageMt > 3.0) {
        warnings.push(`Short DOC (${doc} days) with high harvest tonnage (${tonnageMt} MT) is rare for standard culture.`);
    }
    if (eco.confidenceLevel === "LOW") {
        warnings.push(`Limited historical cycles in database for ${sp}. Estimates rely on default empirical priors.`);
    }

    return {
        inputs: {
            species: sp,
            doc,
            tonnageMt,
            tonnageKg,
            harvestKg: tonnageKg,
            totalFeedKg,
            abw,
            stockedPl,
            fcr: Number(fcr.toFixed(2))
        },
        scenarios: {
            low,
            base,
            high
        },
        drivers: {
            pricePerKgP50: Number(d.pricePerKg.p50.toFixed(2)),
            feedCostPerKgFeedP50: Number(d.feedCostPerKgFeed.p50.toFixed(2)),
            fryCostRateP50: Number((stockedPl ? d.fryCostPerPl.p50 : d.fryCostPerKg.p50).toFixed(4)),
            fryCostUnit: stockedPl ? "RM/PL" : "RM/kg harvested",
            variableCostPerKgP50: Number(d.variableCostPerKg.p50.toFixed(2)),
            dailyFixedCostPerDayP50: Number(d.dailyFixedCostPerDay.p50.toFixed(2))
        },
        metadata: {
            cycleCount: eco.cycleCount,
            abwBand: eco.abwBand,
            abwBandCycleCount: eco.abwBandCycleCount,
            confidenceLevel: eco.confidenceLevel,
            warnings
        }
    };
}
