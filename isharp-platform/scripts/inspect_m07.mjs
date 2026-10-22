import { simulationStore } from "../src/state/simulationStore.js";

async function inspectM07() {
    await simulationStore.init(156, 2026, 1);
    const m07 = simulationStore.scheduledCycles.filter(c => c.moduleId === "07" || c.pondId.startsWith("07."));
    const byW = new Map();
    for (const c of m07) {
        const k = `W${c.startWeekIndex}-${c.endWeekIndex}::${c.species}`;
        byW.set(k, (byW.get(k) || 0) + 1);
    }
    console.log("Module 07 cycles:", Object.fromEntries(byW));
}

inspectM07().catch(console.error);
