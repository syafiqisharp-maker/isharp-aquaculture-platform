/**
 * iSHARP Platform — Hatchery Operations & Production Domain Analytics
 * Pure functions for aggregating monthly executive performance ledgers and operational metrics.
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
    const entryMap = new Map();

    const getOrCreateEntry = (mKey, speciesCode) => {
        const compositeKey = `${mKey}__${speciesCode}`;
        if (!entryMap.has(compositeKey)) {
            entryMap.set(compositeKey, {
                compositeKey,
                monthKey: mKey,
                year: mKey.slice(0, 4),
                monthNum: mKey.slice(5, 7),
                speciesCode,
                species: speciesCode === "MON" ? "P.Monodon" : "L.Vannamei",
                stockedTanks: new Set(),
                naupliiStockedK: 0,
                harvestedTanks: new Set(),
                plHarvestedK: 0,
                flushedTanks: new Set(),
                naupliiFlushedK: 0,
                sgoHarvestK: 0,
                externalHarvestK: 0,
                stages: [],
                srList: []
            });
        }
        return entryMap.get(compositeKey);
    };

    // 1. Process Stocking Runs
    runs.forEach(r => {
        if (!r.stock_date) return;
        const rYear = r.stock_date.slice(0, 4);
        if (filterYear !== "ALL" && rYear !== filterYear) return;
        const rSpecies = (r.species || "VAN").toUpperCase().includes("MON") ? "MON" : "VAN";
        if (filterSpecies !== "ALL" && rSpecies !== filterSpecies) return;

        const mKey = r.stock_date.slice(0, 7);
        const entry = getOrCreateEntry(mKey, rSpecies);
        entry.stockedTanks.add(r.tank_code);
        entry.naupliiStockedK += Number(r.nauplii_stocked_k) || 0;
    });

    // 2. Process Harvest Dispatches
    dispatches.forEach(d => {
        if (!d.harvest_date) return;
        const dYear = d.harvest_date.slice(0, 4);
        if (filterYear !== "ALL" && dYear !== filterYear) return;
        const dSpecies = (d.species || "VAN").toUpperCase().includes("MON") ? "MON" : "VAN";
        if (filterSpecies !== "ALL" && dSpecies !== filterSpecies) return;

        const mKey = d.harvest_date.slice(0, 7);
        const entry = getOrCreateEntry(mKey, dSpecies);
        entry.harvestedTanks.add(d.tank_code);
        const qty = Number(d.qty_k) || 0;
        entry.plHarvestedK += qty;
        if (d.pl_stage) entry.stages.push(Number(d.pl_stage));
        if (d.sr_reported_pct !== null && d.sr_reported_pct !== undefined && !isNaN(d.sr_reported_pct)) {
            entry.srList.push(Number(d.sr_reported_pct));
        }

        if (d.buyer_type === "EXTERNAL") {
            entry.externalHarvestK += qty;
        } else {
            entry.sgoHarvestK += qty;
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
        const entry = getOrCreateEntry(mKey, fSpecies);
        entry.flushedTanks.add(f.tank_code);
        entry.naupliiFlushedK += Number(f.qty_k) || 0;
    });

    // 4. Transform into finalized analytical records
    const results = Array.from(entryMap.values()).map(m => {
        const stockedCount = m.stockedTanks.size;
        const harvestedCount = m.harvestedTanks.size;
        const flushedCount = m.flushedTanks.size;

        const avgReportedSr = m.srList.length > 0 
            ? (m.srList.reduce((sum, val) => sum + val, 0) / m.srList.length)
            : (m.naupliiStockedK > 0 ? ((m.plHarvestedK / m.naupliiStockedK) * 100) : null);

        const avgStage = m.stages.length > 0 
            ? (m.stages.reduce((sum, val) => sum + val, 0) / m.stages.length) 
            : null;

        const totalHarvest = Math.round(m.plHarvestedK);
        const sgoHarvest = Math.round(m.sgoHarvestK);
        const externalHarvest = Math.round(m.externalHarvestK);

        const sgoPct = totalHarvest > 0 ? Number(((sgoHarvest / totalHarvest) * 100).toFixed(1)) : 0;
        const externalPct = totalHarvest > 0 ? Number(((externalHarvest / totalHarvest) * 100).toFixed(1)) : 0;

        return {
            monthKey: m.monthKey,
            year: m.year,
            monthNum: m.monthNum,
            species: m.species,
            speciesCode: m.speciesCode,
            stockedTanksCount: stockedCount,
            naupliiStockedK: Math.round(m.naupliiStockedK),
            harvestedTanksCount: harvestedCount,
            harvestTanksList: Array.from(m.harvestedTanks).sort(),
            plHarvestedK: totalHarvest,
            flushedTanksCount: flushedCount,
            flushedTanksList: Array.from(m.flushedTanks).sort(),
            naupliiFlushedK: Math.round(m.naupliiFlushedK),
            overallSrPct: avgReportedSr !== null ? Number(avgReportedSr.toFixed(1)) : null,
            avgPlStage: avgStage !== null ? Number(avgStage.toFixed(1)) : null,
            sgoHarvestK: sgoHarvest,
            externalHarvestK: externalHarvest,
            sgoPct,
            externalPct
        };
    });

    return results.sort((a, b) => {
        const monthCmp = b.monthKey.localeCompare(a.monthKey);
        if (monthCmp !== 0) return monthCmp;
        return a.speciesCode === "VAN" ? -1 : 1;
    });
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
    const totalSgoK = filteredDispatches.filter(d => d.buyer_type !== "EXTERNAL").reduce((sum, d) => sum + (Number(d.qty_k) || 0), 0);
    const totalExternalK = filteredDispatches.filter(d => d.buyer_type === "EXTERNAL").reduce((sum, d) => sum + (Number(d.qty_k) || 0), 0);
    const totalFlushedK = filteredFlushes.reduce((sum, f) => sum + (Number(f.qty_k) || 0), 0);
    const totalStockedK = filteredRuns.reduce((sum, r) => sum + (Number(r.nauplii_stocked_k) || 0), 0);

    const srDispatches = filteredDispatches.filter(d => d.sr_reported_pct !== null && d.sr_reported_pct !== undefined && d.sr_reported_pct <= 100);
    const avgSr = srDispatches.length > 0 
        ? (srDispatches.reduce((sum, d) => sum + Number(d.sr_reported_pct), 0) / srDispatches.length).toFixed(1) 
        : (totalStockedK > 0 && totalHarvestedK > 0 ? ((totalHarvestedK / totalStockedK) * 100).toFixed(1) : "—");

    const sgoPct = totalHarvestedK > 0 ? ((totalSgoK / totalHarvestedK) * 100).toFixed(1) : "0.0";
    const externalPct = totalHarvestedK > 0 ? ((totalExternalK / totalHarvestedK) * 100).toFixed(1) : "0.0";

    return {
        totalHarvestedK: Math.round(totalHarvestedK),
        totalSgoK: Math.round(totalSgoK),
        totalExternalK: Math.round(totalExternalK),
        sgoPct,
        externalPct,
        totalFlushedK: Math.round(totalFlushedK),
        totalStockedK: Math.round(totalStockedK),
        totalDispatchesCount: filteredDispatches.length,
        avgSr: avgSr !== "—" ? `${avgSr}%` : "—"
    };
}
