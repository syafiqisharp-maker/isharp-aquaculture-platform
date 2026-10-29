/**
 * iSHARP Platform — Hatchery Operations & Production Domain Analytics
 * Pure functions for aggregating monthly performance ledgers and daily operational timelines.
 */

/**
 * Aggregates monthly performance rollup across hatchery tank runs, harvest dispatches, and flushes.
 * Mirrors official management metrics (PL Prod & Sheet3 benchmarks).
 *
 * @param {Array<object>} runs Hatchery tank runs (stockings and culture)
 * @param {Array<object>} dispatches Harvest dispatch records
 * @param {Array<object>} flushes Tank flush/discard events
 * @param {string} [filterYear="ALL"] e.g. "2026", "2025", "ALL"
 * @param {string} [filterSpecies="ALL"] "ALL", "VAN", "MON"
 * @returns {Array<object>} Monthly performance summaries sorted by monthKey desc
 */
export function aggregateMonthlyHatcheryRollup(runs = [], dispatches = [], flushes = [], filterYear = "ALL", filterSpecies = "ALL") {
    const monthMap = new Map();

    const getOrCreateMonth = (mKey) => {
        if (!monthMap.has(mKey)) {
            monthMap.set(mKey, {
                monthKey: mKey,
                year: mKey.slice(0, 4),
                monthNum: mKey.slice(5, 7),
                stockedTanks: new Set(),
                naupliiStockedK: 0,
                harvestedTanks: new Set(),
                plHarvestedK: 0,
                flushedTanks: new Set(),
                naupliiFlushedK: 0,
                sgoHarvestK: 0,
                externalHarvestK: 0,
                stages: [],
                speciesSet: new Set()
            });
        }
        return monthMap.get(mKey);
    };

    // 1. Process Stocking Runs
    runs.forEach(r => {
        if (!r.stock_date) return;
        const rYear = r.stock_date.slice(0, 4);
        if (filterYear !== "ALL" && rYear !== filterYear) return;
        const rSpecies = (r.species || "VAN").toUpperCase().includes("MON") ? "MON" : "VAN";
        if (filterSpecies !== "ALL" && rSpecies !== filterSpecies) return;

        const mKey = r.stock_date.slice(0, 7);
        const m = getOrCreateMonth(mKey);
        m.stockedTanks.add(r.tank_code);
        m.naupliiStockedK += Number(r.nauplii_stocked_k) || 0;
        m.speciesSet.add(rSpecies);
    });

    // 2. Process Harvest Dispatches
    dispatches.forEach(d => {
        if (!d.harvest_date) return;
        const dYear = d.harvest_date.slice(0, 4);
        if (filterYear !== "ALL" && dYear !== filterYear) return;
        const dSpecies = (d.species || "VAN").toUpperCase().includes("MON") ? "MON" : "VAN";
        if (filterSpecies !== "ALL" && dSpecies !== filterSpecies) return;

        const mKey = d.harvest_date.slice(0, 7);
        const m = getOrCreateMonth(mKey);
        m.harvestedTanks.add(d.tank_code);
        const qty = Number(d.qty_k) || 0;
        m.plHarvestedK += qty;
        if (d.pl_stage) m.stages.push(Number(d.pl_stage));
        m.speciesSet.add(dSpecies);

        if (d.buyer_type === "EXTERNAL") {
            m.externalHarvestK += qty;
        } else {
            m.sgoHarvestK += qty;
        }
    });

    // 3. Process Tank Flushes
    flushes.forEach(f => {
        if (!f.event_date) return;
        const fYear = f.event_date.slice(0, 4);
        if (filterYear !== "ALL" && fYear !== filterYear) return;
        const fSpecies = (f.species || "VAN").toUpperCase().includes("MON") ? "MON" : "VAN";
        if (filterSpecies !== "ALL" && fSpecies !== filterSpecies) return;

        const mKey = f.event_date.slice(0, 7);
        const m = getOrCreateMonth(mKey);
        m.flushedTanks.add(f.tank_code);
        m.naupliiFlushedK += Number(f.qty_k) || 0;
    });

    // 4. Transform into finalized analytical records
    const results = Array.from(monthMap.values()).map(m => {
        const stockedCount = m.stockedTanks.size;
        const harvestedCount = m.harvestedTanks.size;
        const flushedCount = m.flushedTanks.size;

        const srPct = m.naupliiStockedK > 0 
            ? ((m.plHarvestedK / m.naupliiStockedK) * 100) 
            : null;

        const avgStage = m.stages.length > 0 
            ? (m.stages.reduce((sum, val) => sum + val, 0) / m.stages.length) 
            : null;

        const dominantSpecies = m.speciesSet.has("MON") && !m.speciesSet.has("VAN") 
            ? "P.Monodon" 
            : (m.speciesSet.has("MON") && m.speciesSet.has("VAN") ? "Mixed (VAN/MON)" : "L.Vannamei");

        return {
            monthKey: m.monthKey,
            year: m.year,
            monthNum: m.monthNum,
            species: dominantSpecies,
            stockedTanksCount: stockedCount,
            naupliiStockedK: Math.round(m.naupliiStockedK),
            harvestedTanksCount: harvestedCount,
            plHarvestedK: Math.round(m.plHarvestedK),
            flushedTanksCount: flushedCount,
            naupliiFlushedK: Math.round(m.naupliiFlushedK),
            overallSrPct: srPct !== null ? Number(srPct.toFixed(1)) : null,
            avgPlStage: avgStage !== null ? Number(avgStage.toFixed(1)) : null,
            sgoHarvestK: Math.round(m.sgoHarvestK),
            externalHarvestK: Math.round(m.externalHarvestK)
        };
    });

    return results.sort((a, b) => b.monthKey.localeCompare(a.monthKey));
}

/**
 * Aggregates day-by-day operational timeline for a specific month.
 * Unifies Stocking, Harvesting, and Flushing into a single daily cadence.
 *
 * @param {Array<object>} runs
 * @param {Array<object>} dispatches
 * @param {Array<object>} flushes
 * @param {string} targetMonthKey "YYYY-MM" e.g. "2026-10"
 * @param {string} [filterSpecies="ALL"]
 * @returns {Array<object>} Array of daily operational summaries sorted by date asc
 */
export function aggregateDailyHatcheryOperations(runs = [], dispatches = [], flushes = [], targetMonthKey, filterSpecies = "ALL") {
    if (!targetMonthKey) return [];

    const dailyMap = new Map();

    const getOrCreateDay = (dateStr) => {
        if (!dailyMap.has(dateStr)) {
            dailyMap.set(dateStr, {
                date: dateStr,
                monthKey: targetMonthKey,
                stockings: [],
                harvests: [],
                flushes: [],
                totalStockedK: 0,
                totalHarvestedK: 0,
                totalFlushedK: 0
            });
        }
        return dailyMap.get(dateStr);
    };

    // 1. Stocking Events
    runs.forEach(r => {
        if (!r.stock_date || !r.stock_date.startsWith(targetMonthKey)) return;
        const rSpecies = (r.species || "VAN").toUpperCase().includes("MON") ? "MON" : "VAN";
        if (filterSpecies !== "ALL" && rSpecies !== filterSpecies) return;

        const day = getOrCreateDay(r.stock_date);
        day.stockings.push(r);
        day.totalStockedK += Number(r.nauplii_stocked_k) || 0;
    });

    // 2. Harvest Dispatches
    dispatches.forEach(d => {
        if (!d.harvest_date || !d.harvest_date.startsWith(targetMonthKey)) return;
        const dSpecies = (d.species || "VAN").toUpperCase().includes("MON") ? "MON" : "VAN";
        if (filterSpecies !== "ALL" && dSpecies !== filterSpecies) return;

        const day = getOrCreateDay(d.harvest_date);
        day.harvests.push(d);
        day.totalHarvestedK += Number(d.qty_k) || 0;
    });

    // 3. Flush Events
    flushes.forEach(f => {
        if (!f.event_date || !f.event_date.startsWith(targetMonthKey)) return;
        const fSpecies = (f.species || "VAN").toUpperCase().includes("MON") ? "MON" : "VAN";
        if (filterSpecies !== "ALL" && fSpecies !== filterSpecies) return;

        const day = getOrCreateDay(f.event_date);
        day.flushes.push(f);
        day.totalFlushedK += Number(f.qty_k) || 0;
    });

    const days = Array.from(dailyMap.values()).map(d => {
        const uniqueStockTanks = Array.from(new Set(d.stockings.map(s => s.tank_code))).sort();
        const uniqueHarvestTanks = Array.from(new Set(d.harvests.map(h => h.tank_code))).sort();
        const uniqueFlushTanks = Array.from(new Set(d.flushes.map(f => f.tank_code))).sort();
        const linkedPonds = Array.from(new Set(d.harvests.flatMap(h => h.linked_ponds || []))).sort();

        // Calculate average harvest stage for the day
        const stages = d.harvests.map(h => Number(h.pl_stage)).filter(s => !isNaN(s) && s > 0);
        const avgStage = stages.length > 0 ? (stages.reduce((a, b) => a + b, 0) / stages.length).toFixed(1) : null;

        return {
            date: d.date,
            monthKey: d.monthKey,
            stockingsCount: d.stockings.length,
            harvestsCount: d.harvests.length,
            flushesCount: d.flushes.length,
            totalStockedK: Math.round(d.totalStockedK),
            totalHarvestedK: Math.round(d.totalHarvestedK),
            totalFlushedK: Math.round(d.totalFlushedK),
            stockTanks: uniqueStockTanks,
            harvestTanks: uniqueHarvestTanks,
            flushTanks: uniqueFlushTanks,
            linkedPonds,
            avgStage,
            hasActivity: (d.stockings.length + d.harvests.length + d.flushes.length) > 0
        };
    });

    // Sort ascending by date (Day 1 -> Day 31)
    return days.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Calculates high-level KPI card metrics filtered by Year, Month, and Species.
 *
 * @param {Array<object>} runs
 * @param {Array<object>} dispatches
 * @param {Array<object>} flushes
 * @param {string} [filterYear="ALL"]
 * @param {string} [filterMonth="ALL"]
 * @param {string} [filterSpecies="ALL"]
 * @returns {object}
 */
export function calculateHatcheryKpiStats(runs = [], dispatches = [], flushes = [], filterYear = "ALL", filterMonth = "ALL", filterSpecies = "ALL") {
    const matchesPeriod = (dateStr) => {
        if (!dateStr) return false;
        if (filterYear !== "ALL" && !dateStr.startsWith(filterYear)) return false;
        if (filterMonth !== "ALL") {
            const m = dateStr.slice(5, 7);
            if (m !== filterMonth) return false;
        }
        return true;
    };

    const matchesSpecies = (speciesStr) => {
        if (filterSpecies === "ALL") return true;
        const norm = (speciesStr || "VAN").toUpperCase().includes("MON") ? "MON" : "VAN";
        return norm === filterSpecies;
    };

    const filteredDispatches = dispatches.filter(d => matchesPeriod(d.harvest_date) && matchesSpecies(d.species));
    const filteredRuns = runs.filter(r => matchesPeriod(r.stock_date) && matchesSpecies(r.species));
    const filteredFlushes = flushes.filter(f => matchesPeriod(f.event_date) && matchesSpecies(f.species));

    const totalHarvestedK = filteredDispatches.reduce((sum, d) => sum + (Number(d.qty_k) || 0), 0);
    const totalFlushedK = filteredFlushes.reduce((sum, f) => sum + (Number(f.qty_k) || 0), 0);
    const totalStockedK = filteredRuns.reduce((sum, r) => sum + (Number(r.nauplii_stocked_k) || 0), 0);

    const srDispatches = filteredDispatches.filter(d => d.sr_reported_pct !== null && d.sr_reported_pct !== undefined && d.sr_reported_pct <= 100);
    const avgSr = srDispatches.length > 0 
        ? (srDispatches.reduce((sum, d) => sum + Number(d.sr_reported_pct), 0) / srDispatches.length).toFixed(1) 
        : (totalStockedK > 0 && totalHarvestedK > 0 ? ((totalHarvestedK / totalStockedK) * 100).toFixed(1) : "—");

    return {
        totalHarvestedK: Math.round(totalHarvestedK),
        totalFlushedK: Math.round(totalFlushedK),
        totalStockedK: Math.round(totalStockedK),
        totalDispatchesCount: filteredDispatches.length,
        avgSr: avgSr !== "—" ? `${avgSr}%` : "—"
    };
}
