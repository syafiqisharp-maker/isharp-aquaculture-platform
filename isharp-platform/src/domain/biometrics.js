/**
 * iSHARP DBMS 2.0 — Aquaculture Biometrics Calculations
 * PURE DOMAIN FUNCTIONS (No DOM dependencies, No network dependencies)
 */

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
        if (typeof val === 'string') {
            const parts = val.split('T')[0].split('-').map(Number);
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
 * Benchmark target standard ABW growth curve for Penaeus vannamei in Setiu farm.
 * @param {number} doc 
 * @returns {number} Standard target ABW in grams
 */
export function getStandardABW(doc) {
    const d = Number(doc) || 0;
    if (d <= 0) return 0;
    if (d < 30) return Math.round((d * 0.12) * 10) / 10;
    if (d < 60) return Math.round((3.6 + (d - 30) * 0.22) * 10) / 10;
    if (d < 90) return Math.round((10.2 + (d - 60) * 0.28) * 10) / 10;
    return Math.round((18.6 + (d - 90) * 0.32) * 10) / 10;
}

/**
 * Classifies an active culture pond into executive harvest decision categories.
 * Evaluates weight thresholds, age limits, growth pace, and biosecurity flags.
 * 
 * Rules:
 * - Emergency: issueFlag === 'RED' or PCR positive
 * - Vannamei:
 *   - Optimum: ABW >= 16.0g
 *   - Minimum: 10.0g <= ABW < 16.0g
 *   - Slow Growth Watch: DOC >= 70 and ADG < 0.15 g/day
 *   - Forced Harvest: DOC >= 80 and ABW < 10.0g
 * - Monodon:
 *   - Optimum: ABW >= 30.0g
 *   - Minimum: 25.0g <= ABW < 30.0g
 *   - Slow Growth Watch: DOC >= 110 and ADG < 0.18 g/day
 *   - Forced Harvest: DOC >= 120 and ABW < 25.0g
 * 
 * @param {object} params
 * @param {string} params.species e.g. "VAN" or "MON"
 * @param {number} params.abw Current Average Body Weight in grams
 * @param {number} params.doc Days of Culture
 * @param {number} [params.adg=0.22] Average Daily Gain in g/day
 * @param {string} [params.issueFlag='GREEN'] Biosecurity flag: 'RED', 'YELLOW', 'GREEN'
 * @param {string} [params.issueNote=''] Pathology note e.g. 'POSITIVE', 'NEGATIVE'
 * @returns {{ category: string, label: string, badgeType: string, urgency: string, actionText: string, reason: string }}
 */
export function classifyHarvestReadiness({ species = 'VAN', abw = 0, doc = 0, adg = 0.22, issueFlag = 'GREEN', issueNote = '' }) {
    const sp = String(species || 'VAN').toUpperCase().includes('MON') ? 'MON' : 'VAN';
    const weight = Number(abw) || 0;
    const age = Number(doc) || 0;
    const pace = Number(adg) || 0;
    const flag = String(issueFlag || '').toUpperCase();
    const note = String(issueNote || '').toUpperCase();

    // 1. Biosecurity Emergency Trigger
    const isEmergency = flag === 'RED' || note.includes('POSITIVE');
    if (isEmergency && weight >= (sp === 'VAN' ? 8.0 : 18.0)) {
        return {
            category: 'ALERT',
            subCategory: 'EMERGENCY',
            label: 'Emergency Harvest',
            badgeType: 'rose-alert',
            urgency: 'IMMEDIATE',
            actionText: 'Liquidate Now',
            reason: 'Active Pathogen / RED Flag detected'
        };
    }

    if (weight <= 0) {
        return {
            category: 'NO_DATA',
            subCategory: 'PENDING',
            label: 'Awaiting Sample',
            badgeType: 'neutral',
            urgency: 'NONE',
            actionText: 'Cast Net',
            reason: 'No biometrics record logged yet'
        };
    }

    if (sp === 'VAN') {
        // Vannamei Rules
        if (age >= 80 && weight < 10.0) {
            return {
                category: 'ALERT',
                subCategory: 'FORCED',
                label: 'Forced Harvest',
                badgeType: 'rose-action',
                urgency: 'HIGH',
                actionText: 'Terminate Pond',
                reason: 'Stunted cycle (DOC ≥ 80 with ABW < 10g)'
            };
        }
        if (weight >= 16.0) {
            return {
                category: 'OPTIMUM',
                subCategory: 'OPTIMUM',
                label: 'Optimum Harvest',
                badgeType: 'emerald',
                urgency: 'NORMAL',
                actionText: 'Schedule Plant',
                reason: 'Prime weight (ABW ≥ 16g, premium count)'
            };
        }
        if (weight >= 10.0) {
            return {
                category: 'MINIMUM',
                subCategory: 'MINIMUM',
                label: 'Minimum Ready',
                badgeType: 'amber',
                urgency: 'LOW',
                actionText: 'Partial / Liquidate',
                reason: 'Commercial size (10g–16g, thinning window)'
            };
        }
        if (age >= 70 && pace < 0.15) {
            return {
                category: 'ALERT',
                subCategory: 'WATCH',
                label: 'Growth Watch',
                badgeType: 'honey-watch',
                urgency: 'MODERATE',
                actionText: 'Review Feed & Water',
                reason: 'Approaching limit (DOC ≥ 70 with slow growth)'
            };
        }
        return {
            category: 'GROWING',
            subCategory: 'GROWING',
            label: 'Active Growout',
            badgeType: 'sky',
            urgency: 'NONE',
            actionText: 'Monitor',
            reason: 'Standard growout trajectory'
        };
    } else {
        // Monodon Rules
        if (age >= 120 && weight < 25.0) {
            return {
                category: 'ALERT',
                subCategory: 'FORCED',
                label: 'Forced Harvest',
                badgeType: 'rose-action',
                urgency: 'HIGH',
                actionText: 'Terminate Pond',
                reason: 'Stunted cycle (DOC ≥ 120 with ABW < 25g)'
            };
        }
        if (weight >= 30.0) {
            return {
                category: 'OPTIMUM',
                subCategory: 'OPTIMUM',
                label: 'Optimum Jumbo',
                badgeType: 'emerald',
                urgency: 'NORMAL',
                actionText: 'Schedule Plant',
                reason: 'Prime jumbo weight (ABW ≥ 30g)'
            };
        }
        if (weight >= 25.0) {
            return {
                category: 'MINIMUM',
                subCategory: 'MINIMUM',
                label: 'Minimum Ready',
                badgeType: 'amber',
                urgency: 'LOW',
                actionText: 'Partial / Liquidate',
                reason: 'Commercial size (25g–30g, thinning window)'
            };
        }
        if (age >= 110 && pace < 0.18) {
            return {
                category: 'ALERT',
                subCategory: 'WATCH',
                label: 'Growth Watch',
                badgeType: 'honey-watch',
                urgency: 'MODERATE',
                actionText: 'Review Feed & Water',
                reason: 'Approaching limit (DOC ≥ 110 with slow growth)'
            };
        }
        return {
            category: 'GROWING',
            subCategory: 'GROWING',
            label: 'Active Growout',
            badgeType: 'sky',
            urgency: 'NONE',
            actionText: 'Monitor',
            reason: 'Standard growout trajectory'
        };
    }
}

/**
 * Projects near-term forward harvest arrivals for active ponds.
 * Calculates projected ABW across forward window (7 or 14 days).
 * 
 * @param {Array<object>} ponds Array of active pond objects with { abw, doc, adg, species, biomassKg }
 * @param {number} [days=14] Horizon in days (7 or 14)
 * @returns {{ candidatePonds: Array<object>, totalProjectedBiomassTons: number, optimumPondsCount: number, minimumPondsCount: number }}
 */
export function projectHarvestForecast(ponds = [], days = 14) {
    const horizon = Number(days) || 14;
    const candidates = [];
    let totalProjectedKg = 0;
    let optCount = 0;
    let minCount = 0;

    (ponds || []).forEach(p => {
        const abw = Number(p.abw) || 0;
        const adg = Number(p.adg) > 0 ? Number(p.adg) : (p.species === 'MON' ? 0.28 : 0.22);
        const projectedAbw = Math.round((abw + (adg * horizon)) * 100) / 100;
        const sp = (p.species || 'VAN').toUpperCase().includes('MON') ? 'MON' : 'VAN';
        const biomass = Number(p.biomassKg) || 0;

        const isCurrentlyReady = (sp === 'VAN' && abw >= 10.0) || (sp === 'MON' && abw >= 25.0);
        const willBeReady = (sp === 'VAN' && projectedAbw >= 10.0) || (sp === 'MON' && projectedAbw >= 25.0);
        const willBeOptimum = (sp === 'VAN' && projectedAbw >= 16.0) || (sp === 'MON' && projectedAbw >= 30.0);

        // Include if pond crosses into harvest window within horizon
        if (willBeReady && !isCurrentlyReady) {
            if (willBeOptimum) optCount++;
            else minCount++;

            totalProjectedKg += biomass;
            candidates.push({
                ...p,
                projectedAbw,
                projectedDoc: (Number(p.doc) || 0) + horizon,
                willBeOptimum
            });
        }
    });

    return {
        candidatePonds: candidates,
        totalProjectedBiomassTons: Math.round((totalProjectedKg / 1000) * 10) / 10,
        optimumPondsCount: optCount,
        minimumPondsCount: minCount
    };
}

/**
 * Aggregates 12 continuous rolling monthly buckets from daily harvest and buyer sales records.
 * All prices are derived strictly from recorded revenue / recorded weight and are ALWAYS
 * reported separately for Vannamei (VAN) and Monodon (MON). Records whose species cannot be
 * resolved ('UNK') count toward volume/revenue totals but never toward a species price.
 *
 * @param {Array<object>} dailyHarvests  rows tagged with .species ('VAN'|'MON'|'UNK')
 * @param {Array<object>} salesRecords   rows tagged with .species
 * @param {string} [speciesFilter='ALL']
 * @returns {{ monthlyBuckets: Array<object>, totals: object, packoutSummary: object, topBuyers: Array<object> }}
 */
export function aggregate12MonthMovingHarvest(dailyHarvests = [], salesRecords = [], speciesFilter = 'ALL') {
    const filter = (speciesFilter || 'ALL').toUpperCase();
    const spOf = r => {
        const s = String(r.species || r.stck_species || 'UNK').toUpperCase();
        if (s.includes('MON')) return 'MON';
        if (s.includes('VAN')) return 'VAN';
        return 'UNK';
    };
    const emptySp = () => ({ weightKg: 0, revenue: 0, abwWeightedSum: 0, abwWeight: 0, runs: 0 });
    const newBucket = month => ({
        month, runs: 0, weightKg: 0, revenue: 0, terminationKg: 0, partialKg: 0,
        abwList: [], abwWeightedSum: 0, abwWeight: 0,
        sp: { VAN: emptySp(), MON: emptySp(), UNK: emptySp() }
    });

    // Deduplicate repeated harvest runs (same pond, date, status, weight)
    const seen = new Set();
    const unique = [];
    (dailyHarvests || []).forEach(r => {
        const key = `${r.pond_index || ''}_${r.harv_date || ''}_${(r.harv_status || '').toUpperCase()}_${parseFloat(r.harv_weight || 0).toFixed(2)}`;
        if (!seen.has(key)) { seen.add(key); unique.push(r); }
    });

    const monthMap = new Map();
    let totalWeight = 0;
    let totalRevenue = 0;
    const totalsSp = { VAN: emptySp(), MON: emptySp(), UNK: emptySp() };

    unique.forEach(r => {
        if (!r.harv_date) return;
        const sp = spOf(r);
        if (filter !== 'ALL' && sp !== filter) return;

        const mKey = String(r.harv_date).substring(0, 7);
        if (!monthMap.has(mKey)) monthMap.set(mKey, newBucket(mKey));
        const b = monthMap.get(mKey);

        const w = parseFloat(r.harv_weight || 0);
        const abw = parseFloat(r.harv_abw || 0);
        const rev = parseFloat(r.harv_revenue || 0);
        const isPartial = (r.harv_status || '').toUpperCase().includes('PARTIAL');

        b.runs += 1;
        b.weightKg += w;
        b.revenue += rev;
        if (isPartial) b.partialKg += w; else b.terminationKg += w;
        if (abw > 0) {
            b.abwList.push(abw);
            if (w > 0) { b.abwWeightedSum += abw * w; b.abwWeight += w; }
        }

        [b.sp[sp], totalsSp[sp]].forEach(s => {
            s.runs += 1; s.weightKg += w; s.revenue += rev;
            if (abw > 0 && w > 0) { s.abwWeightedSum += abw * w; s.abwWeight += w; }
        });

        totalWeight += w;
        totalRevenue += rev;
    });

    // Packout & buyers (from real buyer delivery records)
    let good = 0, sec = 0, small = 0, below = 0, rubbish = 0;
    const buyersMap = new Map();
    let totalBuyerSales = 0;
    (salesRecords || []).forEach(s => {
        const sp = spOf(s);
        if (filter !== 'ALL' && sp !== filter) return;
        const g = parseFloat(s.good_wgt || 0), s2 = parseFloat(s.second_grade_wgt || 0), sm = parseFloat(s.small_wgt || 0);
        const bl = parseFloat(s.below_wgt || 0), rb = parseFloat(s.rubbish_wgt || 0);
        const raw = parseFloat(s.raw_wgt || 0) || (g + s2 + sm + bl + rb);
        const net = parseFloat(s.net_sales || 0);
        good += g; sec += s2; small += sm; below += bl; rubbish += rb;

        const buyer = (s.hvt_buyer || 'Other Off-Takers').trim();
        const bKey = buyer + '|' + sp;
        if (!buyersMap.has(bKey)) buyersMap.set(bKey, { buyer, species: sp, totalSales: 0, totalWeight: 0 });
        const e = buyersMap.get(bKey);
        e.totalSales += net;
        e.totalWeight += raw;
        totalBuyerSales += net;
    });

    // Continuous 12 months ending at the latest of (today, latest harvest)
    let refYear = new Date().getFullYear();
    let refMonth = new Date().getMonth();
    unique.forEach(r => {
        if (!r.harv_date) return;
        const y = parseInt(String(r.harv_date).substring(0, 4), 10);
        const m = parseInt(String(r.harv_date).substring(5, 7), 10) - 1;
        if (y > refYear || (y === refYear && m > refMonth)) { refYear = y; refMonth = m; }
    });

    const price = s => (s.weightKg > 0 && s.revenue > 0 ? Math.round((s.revenue / s.weightKg) * 100) / 100 : 0);
    const abwOf = s => (s.abwWeight > 0 ? Math.round((s.abwWeightedSum / s.abwWeight) * 100) / 100 : 0);

    const monthlyBuckets = [];
    for (let i = 11; i >= 0; i--) {
        const d = new Date(refYear, refMonth - i, 1);
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const b = monthMap.get(k) || newBucket(k);
        const minAbw = b.abwList.length ? Math.min(...b.abwList) : 0;
        const maxAbw = b.abwList.length ? Math.max(...b.abwList) : 0;
        monthlyBuckets.push({
            month: k,
            tonnage: Math.round(b.weightKg / 100) / 10,
            weightKg: Math.round(b.weightKg),
            runs: b.runs,
            weightedAbw: b.abwWeight > 0 ? Math.round((b.abwWeightedSum / b.abwWeight) * 100) / 100 : 0,
            minAbw: Math.round(minAbw * 10) / 10,
            maxAbw: Math.round(maxAbw * 10) / 10,
            grossRevenue: Math.round(b.revenue),
            vanTons: Math.round(b.sp.VAN.weightKg / 100) / 10,
            monTons: Math.round(b.sp.MON.weightKg / 100) / 10,
            vanPricePerKg: price(b.sp.VAN),
            monPricePerKg: price(b.sp.MON),
            vanAbw: abwOf(b.sp.VAN),
            monAbw: abwOf(b.sp.MON),
            terminationTons: Math.round(b.terminationKg / 100) / 10,
            partialTons: Math.round(b.partialKg / 100) / 10
        });
    }

    const packTotal = Math.max(1, good + sec + small + below + rubbish);
    const pct = v => Math.round((v / packTotal) * 1000) / 10;

    const topBuyers = Array.from(buyersMap.values())
        .sort((a, b) => b.totalSales - a.totalSales)
        .slice(0, 6)
        .map(b => ({
            buyer: b.buyer,
            species: b.species,
            totalSales: Math.round(b.totalSales),
            totalTons: Math.round(b.totalWeight / 100) / 10,
            avgPrice: b.totalWeight > 0 ? Math.round((b.totalSales / b.totalWeight) * 100) / 100 : 0,
            pctShare: totalBuyerSales > 0 ? Math.round((b.totalSales / totalBuyerSales) * 1000) / 10 : 0
        }));

    return {
        monthlyBuckets,
        totals: {
            totalTonnage: Math.round(totalWeight / 100) / 10,
            totalRevenue: Math.round(totalRevenue),
            vanPricePerKg: price(totalsSp.VAN),
            monPricePerKg: price(totalsSp.MON),
            vanTons: Math.round(totalsSp.VAN.weightKg / 100) / 10,
            monTons: Math.round(totalsSp.MON.weightKg / 100) / 10,
            unresolvedTons: Math.round(totalsSp.UNK.weightKg / 100) / 10
        },
        packoutSummary: { goodPct: pct(good), secondPct: pct(sec), smallPct: pct(small), rejectPct: pct(below + rubbish) },
        topBuyers
    };
}
