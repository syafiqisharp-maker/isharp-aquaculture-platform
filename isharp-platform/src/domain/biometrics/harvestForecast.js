/**
 * iSHARP DBMS 2.0 — Harvest Readiness, Forecasting & 12-Month Moving Aggregation
 * Pure Domain Functions: classifyHarvestReadiness, projectHarvestForecast,
 * and aggregate12MonthMovingHarvest.
 */

export function classifyHarvestReadiness({ species = "VAN", abw = 0, doc = 0, adg = 0.22, issueFlag = "GREEN", issueNote = "" }) {
    const sp = String(species || "VAN").toUpperCase().includes("MON") ? "MON" : "VAN";
    const weight = Number(abw) || 0;
    const age = Number(doc) || 0;
    const pace = Number(adg) || 0;
    const flag = String(issueFlag || "").toUpperCase();
    const note = String(issueNote || "").toUpperCase();

    const isEmergency = flag === "RED" || note.includes("POSITIVE");
    if (isEmergency && weight >= (sp === "VAN" ? 8.0 : 18.0)) {
        return {
            category: "ALERT",
            subCategory: "EMERGENCY",
            label: "Emergency Harvest",
            badgeType: "rose-alert",
            urgency: "IMMEDIATE",
            actionText: "Liquidate Now",
            reason: "Active Pathogen / RED Flag detected"
        };
    }

    if (weight <= 0) {
        return {
            category: "NO_DATA",
            subCategory: "PENDING",
            label: "Awaiting Sample",
            badgeType: "neutral",
            urgency: "NONE",
            actionText: "Cast Net",
            reason: "No biometrics record logged yet"
        };
    }

    if (sp === "VAN") {
        if (age >= 80 && weight < 10.0) {
            return {
                category: "ALERT",
                subCategory: "FORCED",
                label: "Forced Harvest",
                badgeType: "rose-action",
                urgency: "HIGH",
                actionText: "Terminate Pond",
                reason: "Stunted cycle (DOC ≥ 80 with ABW < 10g)"
            };
        }
        if (weight >= 16.0) {
            return {
                category: "OPTIMUM",
                subCategory: "OPTIMUM",
                label: "Optimum Harvest",
                badgeType: "emerald",
                urgency: "NORMAL",
                actionText: "Schedule Plant",
                reason: "Prime weight (ABW ≥ 16g, premium count)"
            };
        }
        if (weight >= 10.0) {
            return {
                category: "MINIMUM",
                subCategory: "MINIMUM",
                label: "Minimum Ready",
                badgeType: "amber",
                urgency: "LOW",
                actionText: "Partial / Liquidate",
                reason: "Commercial size (10g–16g, thinning window)"
            };
        }
        if (age >= 70 && pace < 0.15) {
            return {
                category: "ALERT",
                subCategory: "WATCH",
                label: "Growth Watch",
                badgeType: "honey-watch",
                urgency: "MODERATE",
                actionText: "Review Feed & Water",
                reason: "Approaching limit (DOC ≥ 70 with slow growth)"
            };
        }
        return {
            category: "GROWING",
            subCategory: "GROWING",
            label: "Active Growout",
            badgeType: "sky",
            urgency: "NONE",
            actionText: "Monitor",
            reason: "Standard growout trajectory"
        };
    } else {
        if (age >= 120 && weight < 25.0) {
            return {
                category: "ALERT",
                subCategory: "FORCED",
                label: "Forced Harvest",
                badgeType: "rose-action",
                urgency: "HIGH",
                actionText: "Terminate Pond",
                reason: "Stunted cycle (DOC ≥ 120 with ABW < 25g)"
            };
        }
        if (weight >= 30.0) {
            return {
                category: "OPTIMUM",
                subCategory: "OPTIMUM",
                label: "Optimum Jumbo",
                badgeType: "emerald",
                urgency: "NORMAL",
                actionText: "Schedule Plant",
                reason: "Prime jumbo weight (ABW ≥ 30g)"
            };
        }
        if (weight >= 25.0) {
            return {
                category: "MINIMUM",
                subCategory: "MINIMUM",
                label: "Minimum Ready",
                badgeType: "amber",
                urgency: "LOW",
                actionText: "Partial / Liquidate",
                reason: "Commercial size (25g–30g, thinning window)"
            };
        }
        if (age >= 110 && pace < 0.18) {
            return {
                category: "ALERT",
                subCategory: "WATCH",
                label: "Growth Watch",
                badgeType: "honey-watch",
                urgency: "MODERATE",
                actionText: "Review Feed & Water",
                reason: "Approaching limit (DOC ≥ 110 with slow growth)"
            };
        }
        return {
            category: "GROWING",
            subCategory: "GROWING",
            label: "Active Growout",
            badgeType: "sky",
            urgency: "NONE",
            actionText: "Monitor",
            reason: "Standard growout trajectory"
        };
    }
}

export function projectHarvestForecast(ponds = [], days = 14) {
    const horizon = Number(days) || 14;
    const candidates = [];
    let totalProjectedKg = 0;
    let optCount = 0;
    let minCount = 0;

    (ponds || []).forEach(p => {
        const abw = Number(p.abw) || 0;
        const adg = Number(p.adg) > 0 ? Number(p.adg) : (p.species === "MON" ? 0.28 : 0.22);
        const projectedAbw = Math.round((abw + (adg * horizon)) * 100) / 100;
        const sp = (p.species || "VAN").toUpperCase().includes("MON") ? "MON" : "VAN";
        const biomass = Number(p.biomassKg) || 0;

        const isCurrentlyReady = (sp === "VAN" && abw >= 10.0) || (sp === "MON" && abw >= 25.0);
        const willBeReady = (sp === "VAN" && projectedAbw >= 10.0) || (sp === "MON" && projectedAbw >= 25.0);
        const willBeOptimum = (sp === "VAN" && projectedAbw >= 16.0) || (sp === "MON" && projectedAbw >= 30.0);

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

export function aggregate12MonthMovingHarvest(dailyHarvests = [], salesRecords = [], speciesFilter = "ALL") {
    const filter = (speciesFilter || "ALL").toUpperCase();
    const spOf = r => {
        const s = String(r.species || r.stck_species || "UNK").toUpperCase();
        if (s.includes("MON")) return "MON";
        if (s.includes("VAN")) return "VAN";
        return "UNK";
    };
    const emptySp = () => ({ weightKg: 0, revenue: 0, abwWeightedSum: 0, abwWeight: 0, runs: 0 });
    const newBucket = month => ({
        month, runs: 0, weightKg: 0, revenue: 0, terminationKg: 0, partialKg: 0,
        abwList: [], abwWeightedSum: 0, abwWeight: 0,
        sp: { VAN: emptySp(), MON: emptySp(), UNK: emptySp() }
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
        const rev = parseFloat(r.harv_revenue || 0);
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
            if (abw > 0 && w > 0) { s.abwWeightedSum += abw * w; s.abwWeight += w; }
        });

        totalWeight += w;
        totalRevenue += rev;
    });

    let good = 0, sec = 0, small = 0, below = 0, rubbish = 0;
    const buyersMap = new Map();
    let totalBuyerSales = 0;
    (salesRecords || []).forEach(s => {
        const sp = spOf(s);
        if (filter !== "ALL" && sp !== filter) return;
        const g = parseFloat(s.good_wgt || 0), s2 = parseFloat(s.second_grade_wgt || 0), sm = parseFloat(s.small_wgt || 0);
        const bl = parseFloat(s.below_wgt || 0), rb = parseFloat(s.rubbish_wgt || 0);
        const raw = parseFloat(s.raw_wgt || 0) || (g + s2 + sm + bl + rb);
        const net = parseFloat(s.net_sales || 0);
        good += g; sec += s2; small += sm; below += bl; rubbish += rb;

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
