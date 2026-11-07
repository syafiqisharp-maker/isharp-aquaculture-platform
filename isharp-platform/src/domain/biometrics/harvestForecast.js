/**
 * iSHARP DBMS 2.0 — Harvest Readiness, Forecasting & 12-Month Moving Aggregation
 * Pure Domain Functions: classifyHarvestReadiness, projectHarvestForecast,
 * and aggregate12MonthMovingHarvest.
 */

/**
 * Single Source of Truth (SSOT): COO Harvest Readiness & Action Gate Policy
 * Established by Chief Operating Officer (COO) for commercial harvesting standards.
 */
export const COO_HARVEST_READINESS_THRESHOLDS = Object.freeze({
    VANNAMEI: {
        OPTIMUM_ABW_G: 16.0,      // Prime commercial count weight
        MINIMUM_ABW_G: 10.0,      // Minimum commercial thinning / liquidation eligibility
        STUNTED_DOC_LIMIT: 80,    // DOC limit for stunted cycle evaluation
        STUNTED_MAX_ABW_G: 10.0,  // Weight threshold below which DOC 80+ is forced harvest
        GROWTH_WATCH_DOC: 70,     // DOC threshold for pre-alert watch
        GROWTH_WATCH_MIN_ADG: 0.15, // Minimum acceptable ADG pace at DOC 70+
        EMERGENCY_MIN_ABW_G: 8.0  // Emergency liquidatable weight on pathogen alert
    },
    MONODON: {
        OPTIMUM_ABW_G: 30.0,      // Jumbo premium weight
        MINIMUM_ABW_G: 25.0,      // Minimum commercial size
        STUNTED_DOC_LIMIT: 120,   // DOC limit for stunted cycle evaluation
        STUNTED_MAX_ABW_G: 25.0,  // Weight threshold below which DOC 120+ is forced harvest
        GROWTH_WATCH_DOC: 110,    // DOC threshold for pre-alert watch
        GROWTH_WATCH_MIN_ADG: 0.18, // Minimum acceptable ADG pace at DOC 110+
        EMERGENCY_MIN_ABW_G: 18.0 // Emergency liquidatable weight on pathogen alert
    }
});

/**
 * Dedicated pathogen evaluation distinguishing acute lethal agents (WSSV, EMS/AHPND)
 * from chronic microsporidians (EHP). Unlike acute viruses that require immediate emergency liquidation,
 * EHP affects growth rates; only stunted or growth-stalled EHP ponds trigger Forced/Alert status,
 * while EHP-positive ponds with good growth are allowed to grow to commercial harvest size.
 *
 * @param {object} params
 * @returns {object|null} Alert classification override or null if normal evaluation proceeds
 */
export function evaluateBiosecurityAndEhpStatus({
    flag = "GREEN",
    note = "",
    species = "VAN",
    weight = 0,
    age = 0,
    adg = 0.22,
    awg = null,
    rules
}) {
    const rawNote = String(note || "").toUpperCase();
    const rawFlag = String(flag || "").toUpperCase();
    const pace = Number(adg) || 0;
    const weeklyPace = (awg !== null && !isNaN(awg)) ? Number(awg) : pace;

    // 1. Acute Lethal Pathogens (WSSV, EMS/AHPND, IMNV, Yellow Head)
    // Cause rapid mass mortality in 48-72h. Require immediate emergency salvage liquidation.
    const isAcutePathogen = rawNote.includes("WSSV") || rawNote.includes("EMS") || rawNote.includes("AHPND") || rawNote.includes("IMNV") || rawNote.includes("YELLOW");
    if (isAcutePathogen || (rawFlag === "RED" && !rawNote.includes("EHP"))) {
        if (weight >= rules.EMERGENCY_MIN_ABW_G) {
            return {
                category: "ALERT",
                subCategory: "EMERGENCY",
                label: "Emergency Harvest",
                badgeType: "rose-alert",
                urgency: "IMMEDIATE",
                actionText: "Liquidate Now",
                criterion: "EMERGENCY_PATHOGEN",
                reason: `Acute Pathogen (${rawNote || "RED Flag"}) - Salvage harvest before mass mortality`,
                metricsDetail: `Salvage ABW ${weight.toFixed(1)}g ≥ ${rules.EMERGENCY_MIN_ABW_G}g target • ${rawNote || "RED Flag"}`
            };
        }
    }

    // 2. Chronic Microsporidian: EHP (Enterocytozoon hepatopenaei)
    // EHP is a chronic growth parasite. Not all EHP ponds have stunted growth; some have good growth.
    // Evaluate growth trajectory against COO stunting & watch limits.
    const isEhp = rawNote.includes("EHP");
    if (isEhp) {
        // Case A: EHP Stunted Pond -> Exceeded DOC limit without commercial weight (High FCR risk)
        if (age >= rules.STUNTED_DOC_LIMIT && weight < rules.STUNTED_MAX_ABW_G) {
            return {
                category: "ALERT",
                subCategory: "FORCED",
                label: "Forced Harvest",
                badgeType: "rose-action",
                urgency: "HIGH",
                actionText: "Terminate Pond",
                criterion: "EHP_STUNTED",
                ehpStatus: "STUNTED",
                reason: `Stunted by EHP (DOC ${age}d ≥ ${rules.STUNTED_DOC_LIMIT}d • ABW ${weight.toFixed(1)}g < ${rules.STUNTED_MAX_ABW_G}g - High FCR Risk)`,
                metricsDetail: `EHP Stunted: DOC ${age}d ≥ ${rules.STUNTED_DOC_LIMIT}d • ABW ${weight.toFixed(1)}g < ${rules.STUNTED_MAX_ABW_G}g`
            };
        }

        // Case B: EHP Slowdown Pond -> Approaching harvest DOC with stalled daily or weekly growth
        if (age >= rules.GROWTH_WATCH_DOC && (pace < rules.GROWTH_WATCH_MIN_ADG || (weeklyPace > 0 && weeklyPace < 0.10))) {
            return {
                category: "ALERT",
                subCategory: "WATCH",
                label: "Growth Watch",
                badgeType: "honey-watch",
                urgency: "MODERATE",
                actionText: "Review Feed & Water",
                criterion: "EHP_SLOWDOWN",
                ehpStatus: "SLOWDOWN",
                reason: `EHP Growth Slowdown (DOC ${age}d • ADG ${pace.toFixed(2)}g/d < ${rules.GROWTH_WATCH_MIN_ADG}g/d min)`,
                metricsDetail: `EHP Slowdown: ADG ${pace.toFixed(2)}g/d < ${rules.GROWTH_WATCH_MIN_ADG}g/d • DOC ${age}d`
            };
        }

        // Case C: EHP Pond with Normal / Good Growth!
        // Do NOT force emergency liquidation. Return special metadata indicating good growth,
        // allowing subsequent commercial weight classification (OPTIMUM, MINIMUM, GROWING).
        return {
            isEhpTolerant: true,
            ehpStatus: "TOLERANT_GOOD_GROWTH",
            biosecurityNote: "EHP Positive (Good Growth)"
        };
    }

    return null;
}

export function classifyHarvestReadiness({ species = "VAN", abw = 0, doc = 0, adg = 0.22, awg = null, issueFlag = "GREEN", issueNote = "" }) {
    const sp = String(species || "VAN").toUpperCase().includes("MON") ? "MON" : "VAN";
    const rules = sp === "MON" ? COO_HARVEST_READINESS_THRESHOLDS.MONODON : COO_HARVEST_READINESS_THRESHOLDS.VANNAMEI;
    const weight = Number(abw) || 0;
    const age = Number(doc) || 0;
    const pace = Number(adg) || 0;
    const weeklyPace = (awg !== null && !isNaN(awg)) ? Number(awg) : pace;

    if (weight <= 0) {
        return {
            category: "NO_DATA",
            subCategory: "PENDING",
            label: "Awaiting Sample",
            badgeType: "neutral",
            urgency: "NONE",
            actionText: "Cast Net",
            criterion: "AWAITING_SAMPLE",
            reason: "No biometrics record logged yet",
            metricsDetail: "No weight sampled"
        };
    }

    // Evaluate biosecurity & EHP growth dynamics
    const biosecEval = evaluateBiosecurityAndEhpStatus({
        flag: issueFlag,
        note: issueNote,
        species: sp,
        weight,
        age,
        adg: pace,
        awg: weeklyPace,
        rules
    });

    if (biosecEval && biosecEval.category === "ALERT") {
        return biosecEval;
    }

    const ehpBadgeInfo = (biosecEval && biosecEval.isEhpTolerant)
        ? { ehpStatus: "TOLERANT_GOOD_GROWTH", ehpNote: "EHP+ (Good Growth)" }
        : {};

    // Stunted Cycle (Non-EHP general rule)
    if (age >= rules.STUNTED_DOC_LIMIT && weight < rules.STUNTED_MAX_ABW_G) {
        return {
            category: "ALERT",
            subCategory: "FORCED",
            label: "Forced Harvest",
            badgeType: "rose-action",
            urgency: "HIGH",
            actionText: "Terminate Pond",
            criterion: "STUNTED_CYCLE",
            reason: `Stunted cycle (DOC ≥ ${rules.STUNTED_DOC_LIMIT} with ABW < ${rules.STUNTED_MAX_ABW_G}g)`,
            metricsDetail: `Stunted: DOC ${age}d ≥ ${rules.STUNTED_DOC_LIMIT}d • ABW ${weight.toFixed(1)}g < ${rules.STUNTED_MAX_ABW_G}g`,
            ...ehpBadgeInfo
        };
    }

    // Optimum Premium Weight
    if (weight >= rules.OPTIMUM_ABW_G) {
        const diffOpt = weight - rules.OPTIMUM_ABW_G;
        return {
            category: "OPTIMUM",
            subCategory: "OPTIMUM",
            label: sp === "MON" ? "Optimum Jumbo" : "Optimum Harvest",
            badgeType: "emerald",
            urgency: "NORMAL",
            actionText: "Schedule Plant",
            criterion: "PRIME_WEIGHT",
            reason: `Prime weight (ABW ≥ ${rules.OPTIMUM_ABW_G}g, premium count)`,
            metricsDetail: `ABW ${weight.toFixed(1)}g (≥ ${rules.OPTIMUM_ABW_G}g Optimum target • +${diffOpt.toFixed(1)}g)`,
            ...ehpBadgeInfo
        };
    }

    // Minimum Commercial Weight (Thinning window)
    if (weight >= rules.MINIMUM_ABW_G) {
        const diffMin = weight - rules.MINIMUM_ABW_G;
        const toOpt = rules.OPTIMUM_ABW_G - weight;
        return {
            category: "MINIMUM",
            subCategory: "MINIMUM",
            label: "Minimum Ready",
            badgeType: "amber",
            urgency: "LOW",
            actionText: "Partial / Liquidate",
            criterion: "COMMERCIAL_MIN",
            reason: `Commercial size (${rules.MINIMUM_ABW_G}g–${rules.OPTIMUM_ABW_G}g, thinning window)`,
            metricsDetail: `ABW ${weight.toFixed(1)}g (+${diffMin.toFixed(1)}g vs Min • -${toOpt.toFixed(1)}g to Opt)`,
            ...ehpBadgeInfo
        };
    }

    // Growth Watch (Sub-optimal pace approaching harvest window)
    if (age >= rules.GROWTH_WATCH_DOC && pace < rules.GROWTH_WATCH_MIN_ADG) {
        return {
            category: "ALERT",
            subCategory: "WATCH",
            label: "Growth Watch",
            badgeType: "honey-watch",
            urgency: "MODERATE",
            actionText: "Review Feed & Water",
            criterion: "SLOW_GROWTH",
            reason: `Approaching limit (DOC ≥ ${rules.GROWTH_WATCH_DOC} with slow growth)`,
            metricsDetail: `Slow Growth: ADG ${pace.toFixed(2)}g/d < ${rules.GROWTH_WATCH_MIN_ADG}g/d • DOC ${age}d`,
            ...ehpBadgeInfo
        };
    }

    // Standard Active Growout
    return {
        category: "GROWING",
        subCategory: "GROWING",
        label: "Active Growout",
        badgeType: "sky",
        urgency: "NONE",
        actionText: "Monitor",
        criterion: "STANDARD_GROWOUT",
        reason: "Standard growout trajectory",
        metricsDetail: `Active Growout (ABW ${weight.toFixed(1)}g, DOC ${age}d, ADG ${pace.toFixed(2)}g/d)`,
        ...ehpBadgeInfo
    };
}

export function projectHarvestForecast(ponds = [], days = 14) {
    const horizon = Number(days) || 14;
    const candidates = [];
    let totalProjectedKg = 0;
    let optCount = 0;
    let minCount = 0;

    (ponds || []).forEach(p => {
        const abw = Number(p.abw) || 0;
        const sp = (p.species || "VAN").toUpperCase().includes("MON") ? "MON" : "VAN";
        const rules = sp === "MON" ? COO_HARVEST_READINESS_THRESHOLDS.MONODON : COO_HARVEST_READINESS_THRESHOLDS.VANNAMEI;
        const adg = Number(p.adg) > 0 ? Number(p.adg) : (sp === "MON" ? 0.28 : 0.22);
        const projectedAbw = Math.round((abw + (adg * horizon)) * 100) / 100;
        const biomass = Number(p.biomassKg) || 0;

        const isCurrentlyReady = abw >= rules.MINIMUM_ABW_G;
        const willBeReady = projectedAbw >= rules.MINIMUM_ABW_G;
        const willBeOptimum = projectedAbw >= rules.OPTIMUM_ABW_G;

        if (willBeReady && !isCurrentlyReady) {
            if (willBeOptimum) optCount++;
            else minCount++;

            // Compound growth to day +14 instead of freezing at current biomass
            const projectedBiomassKg = (abw > 0 && biomass > 0)
                ? Math.round(biomass * (projectedAbw / abw))
                : biomass;
            totalProjectedKg += projectedBiomassKg;

            candidates.push({
                ...p,
                projectedAbw,
                projectedBiomassKg,
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

export function aggregate12MonthMovingHarvest(dailyHarvests = [], salesRecords = [], speciesFilter = "ALL") {
    const filter = (speciesFilter || "ALL").toUpperCase();
    const spOf = r => {
        const s = String(r.species || r.stck_species || "UNK").toUpperCase();
        if (s.includes("MON")) return "MON";
        if (s.includes("VAN")) return "VAN";
        return "UNK";
    };
    const emptySp = () => ({ weightKg: 0, revenue: 0, abwWeightedSum: 0, abwWeight: 0, runs: 0, abwList: [] });
    const newBucket = month => ({
        month, runs: 0, weightKg: 0, revenue: 0, terminationKg: 0, partialKg: 0,
        abwList: [], abwWeightedSum: 0, abwWeight: 0,
        sp: { VAN: emptySp(), MON: emptySp(), UNK: emptySp() }
    });

    // Build sales lookup by pond_index to reconcile revenue when harv_revenue is 0 or missing in daily logs
    const salesByCycle = new Map();
    (salesRecords || []).forEach(s => {
        if (!s || !s.pond_index) return;
        const k = String(s.pond_index).trim();
        const net = parseFloat(s.net_sales || 0);
        salesByCycle.set(k, (salesByCycle.get(k) || 0) + net);
    });

    const seen = new Set();
    const unique = [];
    (dailyHarvests || []).forEach(r => {
        const key = `${r.pond_index || ""}_${r.harv_date || ""}_${(r.harv_status || "").toUpperCase()}_${parseFloat(r.harv_weight || 0).toFixed(2)}`;
        if (!seen.has(key)) { seen.add(key); unique.push(r); }
    });

    const monthMap = new Map();
    let totalWeight = 0;
    let totalRevenue = 0;
    const totalsSp = { VAN: emptySp(), MON: emptySp(), UNK: emptySp() };

    unique.forEach(r => {
        if (!r.harv_date) return;
        const sp = spOf(r);
        if (filter !== "ALL" && sp !== filter) return;

        const mKey = String(r.harv_date).substring(0, 7);
        if (!monthMap.has(mKey)) monthMap.set(mKey, newBucket(mKey));
        const b = monthMap.get(mKey);

        const w = parseFloat(r.harv_weight || 0);
        const abw = parseFloat(r.harv_abw || 0);
        let rev = parseFloat(r.harv_revenue || 0);
        if (rev <= 0 && r.pond_index) {
            const pKey = String(r.pond_index).trim();
            const cycleNet = salesByCycle.get(pKey) || 0;
            if (cycleNet > 0) {
                rev = cycleNet;
                salesByCycle.delete(pKey); // consume once to prevent duplicate allocation across multiple partial records
            }
        }
        const isPartial = (r.harv_status || "").toUpperCase().includes("PARTIAL");

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
            if (abw > 0) {
                s.abwList.push(abw);
                if (w > 0) { s.abwWeightedSum += abw * w; s.abwWeight += w; }
            }
        });

        totalWeight += w;
        totalRevenue += rev;
    });

    // -------------------------------------------------------------
    // YEAR-TO-DATE (YTD) COMMERCIAL PACKOUT & OFF-TAKER ANALYSIS
    // Strictly uses current calendar year (or latest active year)
    // Zero hardcoded estimates — all losses derived from actual sales slips
    // -------------------------------------------------------------
    const currentCalendarYear = new Date().getFullYear();
    const salesYears = (salesRecords || []).map(s => parseInt(String(s.hvt_date || "").substring(0, 4), 10)).filter(y => !isNaN(y) && y > 2000);
    const ytdYear = salesYears.length > 0 ? (salesYears.includes(currentCalendarYear) ? currentCalendarYear : Math.max(...salesYears)) : currentCalendarYear;

    const ytdSales = (salesRecords || []).filter(s => s && s.hvt_date && String(s.hvt_date).startsWith(String(ytdYear)));

    // Calculate empirical weighted average Prime Price (good_prc) per species from actual invoice data
    const primePriceStats = {
        ALL: { weightedGoodSum: 0, goodWeight: 0, highestSlipPrice: 0 },
        VAN: { weightedGoodSum: 0, goodWeight: 0, highestSlipPrice: 0 },
        MON: { weightedGoodSum: 0, goodWeight: 0, highestSlipPrice: 0 }
    };

    ytdSales.forEach(s => {
        const sp = spOf(s);
        const gw = parseFloat(s.good_wgt || 0);
        const gp = parseFloat(s.good_prc || 0);
        const raw = parseFloat(s.raw_wgt || 0);
        const net = parseFloat(s.net_sales || 0);
        const slipUnitPrc = raw > 0 && net > 0 ? net / raw : 0;

        if (gw > 0 && gp > 0) {
            primePriceStats.ALL.weightedGoodSum += gw * gp;
            primePriceStats.ALL.goodWeight += gw;
            if (primePriceStats[sp]) {
                primePriceStats[sp].weightedGoodSum += gw * gp;
                primePriceStats[sp].goodWeight += gw;
            }
        }
        if (slipUnitPrc > primePriceStats.ALL.highestSlipPrice) {
            primePriceStats.ALL.highestSlipPrice = slipUnitPrc;
        }
        if (primePriceStats[sp] && slipUnitPrc > primePriceStats[sp].highestSlipPrice) {
            primePriceStats[sp].highestSlipPrice = slipUnitPrc;
        }
    });

    const getRealizedPrimePrice = sp => {
        const stat = primePriceStats[sp] || primePriceStats.ALL;
        if (stat.goodWeight > 0) return stat.weightedGoodSum / stat.goodWeight;
        if (primePriceStats.ALL.goodWeight > 0) return primePriceStats.ALL.weightedGoodSum / primePriceStats.ALL.goodWeight;
        return stat.highestSlipPrice || 0;
    };

    const speciesPackMap = {
        ALL: { good: 0, sec: 0, small: 0, below: 0, rubbish: 0, lossTotal: 0, lossSec: 0, lossSmall: 0, lossReject: 0 },
        VAN: { good: 0, sec: 0, small: 0, below: 0, rubbish: 0, lossTotal: 0, lossSec: 0, lossSmall: 0, lossReject: 0 },
        MON: { good: 0, sec: 0, small: 0, below: 0, rubbish: 0, lossTotal: 0, lossSec: 0, lossSmall: 0, lossReject: 0 }
    };
    const buyersMap = new Map();
    let totalBuyerSales = 0;

    ytdSales.forEach(s => {
        const sp = spOf(s);
        const g = parseFloat(s.good_wgt || 0), s2 = parseFloat(s.second_grade_wgt || 0), sm = parseFloat(s.small_wgt || 0);
        const bl = parseFloat(s.below_wgt || 0), rb = parseFloat(s.rubbish_wgt || 0);
        const raw = parseFloat(s.raw_wgt || 0) || (g + s2 + sm + bl + rb);
        const net = parseFloat(s.net_sales || 0);

        // Actual empirical prime price for this transaction (from slip or empirical species average)
        const slipPrimePrice = parseFloat(s.good_prc || 0) > 0 ? parseFloat(s.good_prc) : getRealizedPrimePrice(sp);

        // Theoretical revenue if 100% met Prime Quality on this invoice:
        const potentialPrimeRev = raw * slipPrimePrice;
        // Actual invoice revenue:
        const actualRev = net > 0 ? net : (g * slipPrimePrice);
        // Realized revenue lost on this slip due to lower grades:
        const slipLoss = Math.max(0, potentialPrimeRev - actualRev);

        const nonPrimeWgt = s2 + sm + bl + rb;
        const slipLossSec = nonPrimeWgt > 0 ? slipLoss * (s2 / nonPrimeWgt) : 0;
        const slipLossSmall = nonPrimeWgt > 0 ? slipLoss * (sm / nonPrimeWgt) : 0;
        const slipLossReject = nonPrimeWgt > 0 ? slipLoss * ((bl + rb) / nonPrimeWgt) : 0;

        // Accumulate into ALL and species
        [speciesPackMap.ALL, speciesPackMap[sp]].filter(Boolean).forEach(target => {
            target.good += g;
            target.sec += s2;
            target.small += sm;
            target.below += bl;
            target.rubbish += rb;
            target.lossTotal += slipLoss;
            target.lossSec += slipLossSec;
            target.lossSmall += slipLossSmall;
            target.lossReject += slipLossReject;
        });

        // Track YTD Off-Takers
        const buyer = (s.hvt_buyer || "Other Off-Takers").trim();
        const bKey = buyer + "|" + sp;
        if (!buyersMap.has(bKey)) buyersMap.set(bKey, { buyer, species: sp, totalSales: 0, totalWeight: 0 });
        const e = buyersMap.get(bKey);
        e.totalSales += net;
        e.totalWeight += raw;
        totalBuyerSales += net;
    });

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
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const b = monthMap.get(k) || newBucket(k);
        const minAbw = b.abwList.length ? Math.min(...b.abwList) : 0;
        const maxAbw = b.abwList.length ? Math.max(...b.abwList) : 0;
        const vMin = b.sp.VAN.abwList.length ? Math.min(...b.sp.VAN.abwList) : 0;
        const vMax = b.sp.VAN.abwList.length ? Math.max(...b.sp.VAN.abwList) : 0;
        const mMin = b.sp.MON.abwList.length ? Math.min(...b.sp.MON.abwList) : 0;
        const mMax = b.sp.MON.abwList.length ? Math.max(...b.sp.MON.abwList) : 0;
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
            vanMinAbw: Math.round(vMin * 10) / 10,
            vanMaxAbw: Math.round(vMax * 10) / 10,
            monAbw: abwOf(b.sp.MON),
            monMinAbw: Math.round(mMin * 10) / 10,
            monMaxAbw: Math.round(mMax * 10) / 10,
            terminationTons: Math.round(b.terminationKg / 100) / 10,
            partialTons: Math.round(b.partialKg / 100) / 10
        });
    }

    const peakMonthlyTonnage = Math.max(...monthlyBuckets.map(b => b.tonnage || 0), 1);
    monthlyBuckets.forEach((b, idx) => {
        b.blendedPricePerKg = b.weightKg > 0 && b.grossRevenue > 0
            ? Math.round((b.grossRevenue / b.weightKg) * 100) / 100
            : 0;
        b.vanSharePct = b.tonnage > 0 ? Math.round((b.vanTons / b.tonnage) * 1000) / 10 : 0;
        b.monSharePct = b.tonnage > 0 ? Math.round((b.monTons / b.tonnage) * 1000) / 10 : 0;
        b.partialSharePct = b.tonnage > 0 ? Math.round((b.partialTons / b.tonnage) * 1000) / 10 : 0;
        b.terminationSharePct = b.tonnage > 0 ? Math.round((b.terminationTons / b.tonnage) * 1000) / 10 : 0;
        b.peakRatio = Math.round((b.tonnage / peakMonthlyTonnage) * 100);

        const prev = idx > 0 ? monthlyBuckets[idx - 1] : null;
        b.momDeltaPct = (prev && prev.tonnage > 0)
            ? Math.round(((b.tonnage - prev.tonnage) / prev.tonnage) * 1000) / 10
            : null;
    });

    const buildPackoutStats = (data, spCode = "ALL") => {
        const rawGood = data.good;
        const rawSec = data.sec;
        const rawSmall = data.small;
        const rejectKg = data.below + data.rubbish;
        const totalKg = rawGood + rawSec + rawSmall + rejectKg;
        const packTotal = Math.max(1, totalKg);
        const pct = v => Math.round((v / packTotal) * 1000) / 10;

        const goodPct = pct(rawGood);
        const secondPct = pct(rawSec);
        const smallPct = pct(rawSmall);
        const rejectPct = pct(rejectKg);

        const revenueLostRm = Math.round(data.lossTotal);
        const lossSecondRm = Math.round(data.lossSec);
        const lossSmallRm = Math.round(data.lossSmall);
        const lossRejectRm = Math.round(data.lossReject);

        return {
            species: spCode,
            ytdYear,
            goodKg: Math.round(rawGood),
            secondKg: Math.round(rawSec),
            smallKg: Math.round(rawSmall),
            rejectKg: Math.round(rejectKg),
            totalKg: Math.round(totalKg),
            totalTons: Math.round((totalKg / 1000) * 10) / 10,
            goodTons: Math.round((rawGood / 1000) * 10) / 10,
            secondTons: Math.round((rawSec / 1000) * 10) / 10,
            smallTons: Math.round((rawSmall / 1000) * 10) / 10,
            rejectTons: Math.round((rejectKg / 1000) * 10) / 10,
            goodPct,
            secondPct,
            smallPct,
            rejectPct,
            goodTarget: 75.0,
            goodStatus: goodPct >= 75.0 ? "MET" : (goodPct >= 65.0 ? "WARN" : "ALERT"),
            smallAlert: smallPct > 15.0,
            rejectAlert: rejectPct > 2.0,
            revenueLostRm,
            lossSecondRm,
            lossSmallRm,
            lossRejectRm,
            downgradeLossRm: revenueLostRm // backwards compatibility
        };
    };

    const packoutBySpecies = {
        ALL: buildPackoutStats(speciesPackMap.ALL, "ALL"),
        VAN: buildPackoutStats(speciesPackMap.VAN, "VAN"),
        MON: buildPackoutStats(speciesPackMap.MON, "MON")
    };

    const buildBuyerList = (bMap, targetFilter = "ALL") => {
        let list = Array.from(bMap.values());
        if (targetFilter !== "ALL") {
            list = list.filter(b => b.species === targetFilter);
        }
        const filteredSales = list.reduce((sum, b) => sum + b.totalSales, 0);
        const filteredWeight = list.reduce((sum, b) => sum + b.totalWeight, 0);

        const sorted = list
            .sort((a, b) => b.totalSales - a.totalSales)
            .slice(0, 6)
            .map(b => {
                const revenueSharePct = filteredSales > 0 ? Math.round((b.totalSales / filteredSales) * 1000) / 10 : 0;
                const volumeSharePct = filteredWeight > 0 ? Math.round((b.totalWeight / filteredWeight) * 1000) / 10 : 0;
                return {
                    buyer: b.buyer,
                    species: b.species,
                    totalSales: Math.round(b.totalSales),
                    totalWeight: Math.round(b.totalWeight),
                    totalTons: Math.round((b.totalWeight / 1000) * 10) / 10,
                    avgPrice: b.totalWeight > 0 ? Math.round((b.totalSales / b.totalWeight) * 100) / 100 : 0,
                    revenueSharePct,
                    volumeSharePct,
                    pctShare: revenueSharePct
                };
            });

        const top3Share = sorted.slice(0, 3).reduce((sum, b) => sum + b.revenueSharePct, 0);
        return {
            buyers: sorted,
            top3ConcentrationPct: Math.round(top3Share * 10) / 10,
            totalSales: Math.round(filteredSales),
            totalTons: Math.round((filteredWeight / 1000) * 10) / 10
        };
    };

    const topBuyersBySpecies = {
        ALL: buildBuyerList(buyersMap, "ALL"),
        VAN: buildBuyerList(buyersMap, "VAN"),
        MON: buildBuyerList(buyersMap, "MON")
    };

    const activePackout = packoutBySpecies[filter] || packoutBySpecies.ALL;
    const activeBuyers = topBuyersBySpecies[filter] || topBuyersBySpecies.ALL;

    return {
        monthlyBuckets,
        totals: {
            totalTonnage: Math.round(totalWeight / 100) / 10,
            totalWeightKg: Math.round(totalWeight),
            totalRevenue: Math.round(totalRevenue),
            blendedPricePerKg: totalWeight > 0 && totalRevenue > 0 ? Math.round((totalRevenue / totalWeight) * 100) / 100 : 0,
            vanPricePerKg: price(totalsSp.VAN),
            monPricePerKg: price(totalsSp.MON),
            vanTons: Math.round(totalsSp.VAN.weightKg / 100) / 10,
            monTons: Math.round(totalsSp.MON.weightKg / 100) / 10,
            vanSharePct: totalWeight > 0 ? Math.round((totalsSp.VAN.weightKg / totalWeight) * 1000) / 10 : 0,
            monSharePct: totalWeight > 0 ? Math.round((totalsSp.MON.weightKg / totalWeight) * 1000) / 10 : 0,
            vanAbw: abwOf(totalsSp.VAN),
            vanMinAbw: totalsSp.VAN.abwList.length ? Math.round(Math.min(...totalsSp.VAN.abwList) * 10) / 10 : 0,
            vanMaxAbw: totalsSp.VAN.abwList.length ? Math.round(Math.max(...totalsSp.VAN.abwList) * 10) / 10 : 0,
            monAbw: abwOf(totalsSp.MON),
            monMinAbw: totalsSp.MON.abwList.length ? Math.round(Math.min(...totalsSp.MON.abwList) * 10) / 10 : 0,
            monMaxAbw: totalsSp.MON.abwList.length ? Math.round(Math.max(...totalsSp.MON.abwList) * 10) / 10 : 0,
            totalRuns: monthlyBuckets.reduce((sum, b) => sum + (b.runs || 0), 0),
            weightedAbw: totalWeight > 0
                ? Math.round((monthlyBuckets.reduce((sum, b) => sum + ((b.weightedAbw || 0) * (b.weightKg || 0)), 0) / totalWeight) * 100) / 100
                : 0,
            terminationTons: Math.round(monthlyBuckets.reduce((sum, b) => sum + (b.terminationTons || 0), 0) * 10) / 10,
            partialTons: Math.round(monthlyBuckets.reduce((sum, b) => sum + (b.partialTons || 0), 0) * 10) / 10,
            unresolvedTons: Math.round(totalsSp.UNK.weightKg / 100) / 10,
            peakMonthlyTonnage
        },
        packoutSummary: activePackout,
        packoutBySpecies,
        topBuyers: activeBuyers.buyers,
        topBuyersBySpecies,
        top3BuyerConcentration: activeBuyers.top3ConcentrationPct
    };
}
