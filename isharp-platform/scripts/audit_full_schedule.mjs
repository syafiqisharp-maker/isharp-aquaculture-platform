import { simulationStore } from "../src/state/simulationStore.js";
import { weekIndexToCalendar } from "../src/domain/simulation/constraintScheduler.js";

async function inspectFullSchedule() {
    await simulationStore.init(156, 2026, 1);
    const schedule = simulationStore.scheduledCycles;

    console.log("=== FULL SCHEDULE AUDIT ===");
    console.log("Total scheduled cycles:", schedule.length);

    // 1. Monthly Stocking Distribution across 3 years (2026, 2027, 2028)
    const monthlySummary = new Map(); // "YYYY-MM" => { total: 0, van: 0, mon: 0, modules: new Set() }

    for (const c of schedule) {
        if (!c.startWeekIndex) continue;
        const cal = weekIndexToCalendar(c.startWeekIndex, 2026, 1);
        const k = `${cal.year}-${String(cal.month).padStart(2, "0")}`;
        if (!monthlySummary.has(k)) {
            monthlySummary.set(k, { total: 0, van: 0, mon: 0, modules: new Set(), ponds: [] });
        }
        const m = monthlySummary.get(k);
        m.total += 1;
        if (c.species === "PENAEUS MONODON" || c.species === "MONODON") m.mon += 1;
        else m.van += 1;
        m.modules.add(c.moduleId);
        m.ponds.push({ pondId: c.pondId, startW: c.startWeekIndex, endW: c.endWeekIndex, species: c.species });
    }

    console.log("\n--- MONTHLY STOCKINGS (2026 - 2028) ---");
    const sortedMonths = Array.from(monthlySummary.keys()).sort();
    for (const mo of sortedMonths) {
        const d = monthlySummary.get(mo);
        const modStr = Array.from(d.modules).sort().join(",");
        console.log(`${mo}: Total=${String(d.total).padStart(2)} ponds (VAN=${String(d.van).padStart(2)}, MON=${String(d.mon).padStart(2)}) | Modules: [${modStr}]`);
    }

    // 2. Per-Module Breakdown and Gap / Idle (DOP) Analysis
    console.log("\n--- PER-MODULE CYCLE BREAKDOWN & IDLE GAPS ---");
    const byPond = new Map();
    for (const c of schedule) {
        if (!byPond.has(c.pondId)) byPond.set(c.pondId, []);
        byPond.get(c.pondId).push(c);
    }

    const extremeGaps = []; // gaps > 90 days or < 30 days
    const pondOverlaps = []; // cycle overlaps

    for (const [pondId, cycles] of byPond.entries()) {
        cycles.sort((a, b) => a.startWeekIndex - b.startWeekIndex);
        for (let i = 0; i < cycles.length - 1; i++) {
            const cur = cycles[i];
            const next = cycles[i + 1];
            const gapWeeks = next.startWeekIndex - cur.endWeekIndex - 1;
            const gapDays = gapWeeks * 7;
            if (gapWeeks < 0) {
                pondOverlaps.push({ pondId, c1: cur, c2: next, gapWeeks });
            } else if (gapDays > 75) {
                extremeGaps.push({ pondId, mod: cur.moduleId, gapDays, gapWeeks, endW: cur.endWeekIndex, nextStartW: next.startWeekIndex });
            }
        }
    }

    console.log(`Pond Overlaps detected: ${pondOverlaps.length}`);
    if (pondOverlaps.length > 0) {
        console.log("FIRST 5 OVERLAPS:", pondOverlaps.slice(0, 5));
    }

    console.log(`Extreme Idle Gaps (>75 days) detected: ${extremeGaps.length}`);
    if (extremeGaps.length > 0) {
        // Group extreme gaps by module
        const gapsByMod = new Map();
        for (const g of extremeGaps) {
            gapsByMod.set(g.mod, (gapsByMod.get(g.mod) || 0) + 1);
        }
        console.log("Extreme gaps by module:", Object.fromEntries(gapsByMod));
        console.log("Sample extreme gaps:", extremeGaps.slice(0, 10).map(g => `${g.pondId} gap: ${g.gapDays}d (${g.gapWeeks}w) between W${g.endW} and W${g.nextStartW}`));
    }

    // 3. Species Allocation per module per year
    console.log("\n--- SPECIES ALLOCATION PER MODULE (YEARLY) ---");
    const modYearSpecies = new Map(); // "mod::year" => { van: 0, mon: 0 }
    for (const c of schedule) {
        const cal = weekIndexToCalendar(c.startWeekIndex, 2026, 1);
        const k = `${c.moduleId}::${cal.year}`;
        if (!modYearSpecies.has(k)) modYearSpecies.set(k, { van: 0, mon: 0 });
        const s = modYearSpecies.get(k);
        if (c.species === "PENAEUS MONODON" || c.species === "MONODON") s.mon += 1;
        else s.van += 1;
    }
    for (const [k, s] of Array.from(modYearSpecies.entries()).sort()) {
        console.log(`Module ${k}: VAN = ${s.van}, MON = ${s.mon}`);
    }
}

inspectFullSchedule().catch(console.error);
