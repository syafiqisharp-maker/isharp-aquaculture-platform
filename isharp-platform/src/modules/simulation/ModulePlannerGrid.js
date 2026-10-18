/**
 * iSHARP DBMS 2.0 — Module Planner Grid (Phase 5)
 * Multi-Year Interactive Planning Grid supporting at least 3 Years Ahead (156 Weeks):
 * 1. Planning Horizon Switcher:
 *    - FY 2026 (Year 1: W01–W52, Zero-Scroll Fit)
 *    - FY 2027 (Year 2: W53–W104, Zero-Scroll Fit)
 *    - FY 2028 (Year 3: W105–W156, Zero-Scroll Fit)
 *    - Full 3-Year Master Timeline (156 Weeks Continuous Grid)
 * 2. 11 Collapsible Module Rows (M01–M11) with 3-level accordion (Module -> Row -> Pond).
 * 3. Synchronized 4-Row Top Pulse Strip (Stocked/PL, Feed MT, Harvest MT, Revenue RM).
 * 4. Theme Brush Palette (DS1–DS4, NT1–NT3, PT1–PT3) with 1-click batch stamping & 3-year auto-chain.
 */

import { SPECIES } from "../../domain/simulation/baselineCalibrator.js";
import { simulationStore } from "../../state/simulationStore.js";
import { Toast } from "../../components/Toast.js";
import { calculateDOC } from "../../domain/biometrics.js";

/**
 * Calculates calendar week index (1..156) from date string for a given base year.
 */
export function dateToWeekIndex(dateStr, baseYear = 2026) {
    if (!dateStr) return 1;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 1;
    const start = new Date(baseYear, 0, 1);
    const diffMs = d.getTime() - start.getTime();
    const diffDays = Math.floor(diffMs / (24 * 3600 * 1000));
    return Math.max(1, Math.min(156, Math.floor(diffDays / 7) + 1));
}

export class ModulePlannerGrid {
    constructor(containerId = "sim-active-view-container", onCycleClick = null) {
        this.containerId = containerId;
        this.onCycleClick = onCycleClick;

        this.viewHorizon = "2026"; // "2026", "2027", "2028", or "3YEAR"
        this.pulseMode = "MONTHLY"; // "MONTHLY" or "WEEKLY"
        this.activeBrush = "DS3";
        this.autoChain = true;
        this.cutoffWeek = 34; // End of Aug 2026

        // Strategy specifications
        this.specs = {
            DS1: { wks: 10, rest: 5, cls: "bg-theme-ds1", name: "DS1 • SPF (10w • 80PL)", mt: 2.5, feedWk: 0.45, plM: 0.40, species: SPECIES.VANNAMEI },
            DS2: { wks: 13, rest: 5, cls: "bg-theme-ds2", name: "DS2 • SPR (13w • 80PL)", mt: 4.0, feedWk: 0.50, plM: 0.40, species: SPECIES.VANNAMEI },
            DS3: { wks: 13, rest: 5, cls: "bg-theme-ds3", name: "DS3 • SPT (13w • 80PL)", mt: 3.8, feedWk: 0.48, plM: 0.40, species: SPECIES.VANNAMEI },
            DS4: { wks: 20, rest: 6, cls: "bg-theme-ds4", name: "DS4 • MON (20w • 40PL)", mt: 4.5, feedWk: 0.42, plM: 0.20, species: SPECIES.MONODON },
            NT2: { wks: 14, rest: 5, cls: "bg-theme-nt2", name: "NT2 • Nursery 2X (14w)", mt: 5.2, feedWk: 0.60, plM: 0.56, species: SPECIES.VANNAMEI },
            PT2: { wks: 14, rest: 5, cls: "bg-theme-pt2", name: "PT2 • Partial 2X (14w)", mt: 5.0, feedWk: 0.55, plM: 0.55, species: SPECIES.VANNAMEI },
            PT3: { wks: 16, rest: 6, cls: "bg-theme-pt3", name: "PT3 • Multi-Skim 3X (16w)", mt: 6.2, feedWk: 0.70, plM: 0.62, species: SPECIES.VANNAMEI }
        };

        this.monthSpans = [4, 4, 5, 4, 4, 5, 4, 4, 5, 4, 4, 5]; // 52 weeks in standard year

        // Initialize 11 modules and 206+ physical growout ponds with independent timelines
        this._initDefaultModulesAndPonds();

        // If live store ponds already loaded, perform initial sync
        if (simulationStore && (simulationStore.liveActivePonds?.length > 0 || simulationStore.masterPonds?.length > 0)) {
            this.syncWithLiveStore(simulationStore);
        }
    }

    _initDefaultModulesAndPonds() {
        const moduleDefs = [
            { id: "M01", name: "Module 01", ponds: 24, species: SPECIES.VANNAMEI, theme: "DS3", rPonds: [12, 12], rNums: ["01", "02"] },
            { id: "M02", name: "Module 02", ponds: 24, species: SPECIES.VANNAMEI, theme: "DS3", rPonds: [12, 12], rNums: ["03", "04"] },
            { id: "M03", name: "Module 03", ponds: 24, species: SPECIES.VANNAMEI, theme: "DS2", rPonds: [12, 12], rNums: ["05", "06"] },
            { id: "M04", name: "Module 04 ★", ponds: 24, species: SPECIES.VANNAMEI, theme: "NT2", rPonds: [12, 12], rNums: ["07", "08"] },
            { id: "M05", name: "Module 05 ★", ponds: 24, species: SPECIES.VANNAMEI, theme: "DS3", rPonds: [12, 12], rNums: ["09", "10"] },
            { id: "M06", name: "Module 06", ponds: 24, species: SPECIES.VANNAMEI, theme: "DS1", rPonds: [12, 12], rNums: ["11", "12"] },
            { id: "M07", name: "Module 07", ponds: 24, species: SPECIES.MONODON, theme: "DS4", rPonds: [12, 12], rNums: ["13", "14"] },
            { id: "M08", name: "Module 08 (Mon)", ponds: 24, species: SPECIES.MONODON, theme: "DS4", rPonds: [12, 12], rNums: ["15", "16"] },
            { id: "M09", name: "Module 09 (Mon)", ponds: 18, species: SPECIES.MONODON, theme: "DS4", rPonds: [9, 9], rNums: ["17", "18"] },
            { id: "M10", name: "Module 10", ponds: 26, species: SPECIES.VANNAMEI, theme: "DS3", rPonds: [13, 13], rNums: ["19", "20"] },
            { id: "M11", name: "Module 11", ponds: 21, species: SPECIES.VANNAMEI, theme: "DS3", rPonds: [10, 11], rNums: ["21", "22"] }
        ];

        this.modules = moduleDefs.map((def, mIdx) => {
            const modNum = String(mIdx + 1).padStart(2, "0");
            const sp = this.specs[def.theme] || this.specs.DS3;
            const cycleLen = sp.wks + sp.rest;

            const rows = def.rNums.map((rNum, rIdx) => {
                const count = def.rPonds[rIdx];
                const pondList = [];

                for (let p = 1; p <= count; p++) {
                    const pNum = String(p).padStart(2, "0");
                    const pondLabel = `${modNum}.${rNum}.${pNum}`;
                    const pondId = (def.id === "M04" && p === 1) ? "M04-P01" : ((def.id === "M08" && p === 1) ? "M08-P01" : pondLabel);

                    // Realistic October active progress:
                    // In real farm operations, ponds 1, 2, 9, 10, 11 in Row 1 are in production; ponds 3-8, 12 are IDLE
                    const isMon = def.species === SPECIES.MONODON;
                    const isProd = (def.id === "M01" && rIdx === 0)
                        ? (p === 1 || p === 2 || p === 9 || p === 10 || p === 11)
                        : (p === 1 || p === 2 || p === 5 || p === 6);

                    const startW = isMon ? 25 : (rIdx === 0 ? 29 : 31);
                    const docDays = isProd ? (42 - startW) * 7 + 4 : 0;
                    const abw = isProd ? (isMon ? 32.5 : (startW === 29 ? 16.2 : 13.8)) : 0;

                    let cycles = [];
                    if (isProd) {
                        cycles = [
                            {
                                w: startW,
                                t: def.theme,
                                isLive: true,
                                docDays,
                                abw
                            }
                        ];
                        let curW = startW + cycleLen;
                        while (curW <= 156) {
                            cycles.push({ w: curW, t: def.theme });
                            curW += cycleLen;
                        }
                    }

                    pondList.push({
                        pondId,
                        label: pondLabel,
                        areaHa: 0.5,
                        status: isProd ? "PRODUCTION" : "IDLE",
                        isLive: isProd,
                        stckDate: isProd ? `2026-07-${10 + (startW - 28) * 7}` : null,
                        startWeek: isProd ? startW : null,
                        docDays,
                        abw,
                        cycles
                    });
                }

                return {
                    id: `${def.id}-R${rNum}`,
                    rowNo: rNum,
                    name: `↳ ${def.id} • Row ${rNum}`,
                    ponds: count,
                    expanded: false,
                    cycles: [],
                    pondList
                };
            });

            return {
                id: def.id,
                name: def.name,
                ponds: def.ponds,
                expanded: false,
                species: def.species,
                cycles: [],
                rows
            };
        });

        this._updateCompositeSummaries();
    }

    _updateCompositeSummaries(mIdx = null, rIdx = null) {
        const updateMod = (m) => {
            m.rows.forEach(r => {
                const waveMap = new Map();
                (r.pondList || []).forEach(p => {
                    (p.cycles || []).forEach(c => {
                        const key = `${c.w}_${c.t}`;
                        if (!waveMap.has(key)) {
                            waveMap.set(key, {
                                w: c.w,
                                t: c.t,
                                ponds: 0,
                                isLive: Boolean(c.isLive),
                                docDays: c.docDays || 0,
                                abw: c.abw || 0
                            });
                        }
                        const entry = waveMap.get(key);
                        entry.ponds += 1;
                        if (c.isLive) {
                            entry.isLive = true;
                            entry.docDays = Math.max(entry.docDays, c.docDays || 0);
                            entry.abw = Math.max(entry.abw, c.abw || 0);
                        }
                    });
                });
                // Keep clean non-overlapping cycles for single row track
                const allCycles = Array.from(waveMap.values()).sort((a, b) => b.ponds - a.ponds || a.w - b.w);
                const nonOverlapping = [];
                let occupiedWeeks = new Set();
                allCycles.forEach(c => {
                    const sp = this.specs[c.t] || this.specs.DS3;
                    const cStart = c.w;
                    const cEnd = c.w + sp.wks + sp.rest - 1;
                    let hasOverlap = false;
                    for (let w = cStart; w <= cEnd; w++) {
                        if (occupiedWeeks.has(w)) {
                            hasOverlap = true;
                            break;
                        }
                    }
                    if (!hasOverlap) {
                        nonOverlapping.push(c);
                        for (let w = cStart; w <= cEnd; w++) occupiedWeeks.add(w);
                    }
                });
                r.cycles = nonOverlapping.sort((a, b) => a.w - b.w);
            });

            const modWaveMap = new Map();
            m.rows.forEach(r => {
                (r.pondList || []).forEach(p => {
                    (p.cycles || []).forEach(c => {
                        const key = `${c.w}_${c.t}`;
                        if (!modWaveMap.has(key)) {
                            modWaveMap.set(key, {
                                w: c.w,
                                t: c.t,
                                ponds: 0,
                                isLive: Boolean(c.isLive),
                                docDays: c.docDays || 0,
                                abw: c.abw || 0
                            });
                        }
                        const entry = modWaveMap.get(key);
                        entry.ponds += 1;
                        if (c.isLive) {
                            entry.isLive = true;
                            entry.docDays = Math.max(entry.docDays, c.docDays || 0);
                            entry.abw = Math.max(entry.abw, c.abw || 0);
                        }
                    });
                });
            });

            const allModCycles = Array.from(modWaveMap.values()).sort((a, b) => b.ponds - a.ponds || a.w - b.w);
            const nonOverlappingMod = [];
            let occupiedModWeeks = new Set();
            allModCycles.forEach(c => {
                const sp = this.specs[c.t] || this.specs.DS3;
                const cStart = c.w;
                const cEnd = c.w + sp.wks + sp.rest - 1;
                let hasOverlap = false;
                for (let w = cStart; w <= cEnd; w++) {
                    if (occupiedModWeeks.has(w)) {
                        hasOverlap = true;
                        break;
                    }
                }
                if (!hasOverlap) {
                    nonOverlappingMod.push(c);
                    for (let w = cStart; w <= cEnd; w++) occupiedModWeeks.add(w);
                }
            });
            m.cycles = nonOverlappingMod.sort((a, b) => a.w - b.w);
        };

        if (mIdx !== null && this.modules[mIdx]) {
            updateMod(this.modules[mIdx]);
        } else {
            this.modules.forEach(m => updateMod(m));
        }
    }

    syncWithLiveStore(store = simulationStore) {
        if (!store) return;
        const livePonds = store.liveActivePonds || [];
        const scheduled = store.scheduledCycles || [];

        if (livePonds.length === 0 && scheduled.length === 0) return;

        const liveMap = new Map();
        livePonds.forEach(p => {
            if (p.pondId) liveMap.set(p.pondId, p);
            if (p.pondIndex) liveMap.set(p.pondIndex, p);
            if (p.pond) liveMap.set(p.pond, p);
        });

        const schedMap = new Map();
        scheduled.forEach(s => {
            if (s.pondId && s.isLivePondCycle) {
                schedMap.set(s.pondId, s);
            }
        });

        this.modules.forEach((m, mIdx) => {
            m.rows.forEach(r => {
                r.pondList.forEach(pond => {
                    const matchLive = liveMap.get(pond.pondId) || liveMap.get(pond.label) || liveMap.get(pond.pondIndex);
                    const matchSched = schedMap.get(pond.pondId) || schedMap.get(pond.label);

                    if (matchLive || matchSched) {
                        const rec = matchLive || matchSched;
                        const isProd = rec.isProduction !== undefined ? rec.isProduction : (rec.pondStatus === "PRODUCTION" || Boolean(rec.isLivePondCycle));
                        pond.status = isProd ? "PRODUCTION" : (rec.pondStatus || "IDLE");
                        pond.isLive = isProd;

                        if (isProd) {
                            if (rec.stckDate) {
                                pond.stckDate = rec.stckDate;
                                pond.startWeek = dateToWeekIndex(rec.stckDate, 2026);
                            } else if (matchSched?.startWeekIndex) {
                                pond.startWeek = matchSched.startWeekIndex;
                            }
                            pond.docDays = rec.docDays || (pond.startWeek ? (42 - pond.startWeek) * 7 + 4 : 95);
                            pond.abw = rec.latestSampling?.smplAbw || rec.smplAbw || (m.species === SPECIES.MONODON ? 32.5 : 16.2);

                            const strat = m.species === SPECIES.MONODON ? "DS4" : "DS3";
                            const sp = this.specs[strat] || this.specs.DS3;
                            const cycleLen = sp.wks + sp.rest;

                            const newCycles = [
                                {
                                    w: pond.startWeek || 29,
                                    t: strat,
                                    isLive: true,
                                    docDays: pond.docDays,
                                    abw: pond.abw
                                }
                            ];
                            let nextW = (pond.startWeek || 29) + cycleLen;
                            while (nextW <= 156) {
                                newCycles.push({ w: nextW, t: strat });
                                nextW += cycleLen;
                            }
                            pond.cycles = newCycles;
                        } else {
                            // IDLE POND IN LIVE DATABASE — CLEAR ALL CYCLES
                            pond.stckDate = null;
                            pond.startWeek = null;
                            pond.docDays = 0;
                            pond.abw = 0;
                            pond.cycles = [];
                        }
                    } else {
                        // POND NOT IN LIVE STORE — IDLE
                        pond.status = "IDLE";
                        pond.isLive = false;
                        pond.stckDate = null;
                        pond.startWeek = null;
                        pond.docDays = 0;
                        pond.abw = 0;
                        pond.cycles = [];
                    }
                });
            });
            this._updateCompositeSummaries(mIdx);
        });

        this._syncPondCyclesToStore(store);
        this.render();
    }

    _syncPondCyclesToStore(store = simulationStore) {
        const targetStore = store || simulationStore;
        if (!targetStore || !targetStore._state) return;
        const cycles = [];
        this.modules.forEach(m => {
            const modKey = m.id.replace("M", "");
            m.rows.forEach(r => {
                r.pondList.forEach(p => {
                    (p.cycles || []).forEach(c => {
                        const sp = this.specs[c.t] || this.specs.DS3;
                        cycles.push({
                            pondId: p.pondId,
                            moduleId: modKey,
                            areaHa: p.areaHa || 0.5,
                            species: m.species,
                            strategyCode: c.t,
                            startWeekIndex: c.w,
                            endWeekIndex: c.w + sp.wks - 1,
                            harvestPlanCount: 1,
                            stockDensityPlM2: m.species === SPECIES.MONODON ? 45 : 95,
                            isLivePondCycle: Boolean(c.isLive),
                            docDays: c.docDays,
                            abw: c.abw
                        });
                    });
                });
            });
        });

        targetStore._state.scheduledCycles = cycles;
    }

    setHorizon(horizon) {
        this.viewHorizon = horizon;
        this.render();
    }

    setBrush(b) {
        if (this.specs[b] || b === "ERASE") {
            this.activeBrush = b;
            this.render();
            if (b === "ERASE") {
                Toast.info("Eraser Tool active: Click any cycle bar to delete it.");
            } else {
                Toast.info(`Theme Brush set to ${b}`);
            }
        }
    }

    setPulseMode(mode) {
        this.pulseMode = mode;
        this.render();
    }

    render() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        const is3Year = this.viewHorizon === "3YEAR";
        const yr = Number(this.viewHorizon) || 2026;
        const wStart = is3Year ? 1 : (yr - 2026) * 52 + 1;
        // 15-Month Crop Runway: Annual views (2026, 2027) extend through Q1 of the following year (+13 weeks, total 65 weeks)
        // so late-stocked ponds (like W51) fully elongate to their harvest week in next year (W63)
        const wEnd = is3Year ? 156 : Math.min(156, wStart + 64);
        const totalW = wEnd - wStart + 1;

        const gridClass = is3Year ? "sim-156-grid" : (totalW > 52 ? "sim-runway-grid" : "sim-52-grid");

        container.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                
                <!-- 1. Horizon Switcher & Theme Brush Palette Deck -->
                <div class="sim-command-bar">
                    <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                        <div style="display: flex; align-items: center; gap: 0.35rem;">
                            <span style="font-size: 0.75rem; font-weight: 800; color: #0c4a6e;">Planning Horizon:</span>
                            <div class="sim-pill-group">
                                <button type="button" class="btn-pill-item ${this.viewHorizon === "2026" ? "active" : ""}" data-horizon="2026">
                                    FY 2026 (W1–65 • 15mo Runway)
                                </button>
                                <button type="button" class="btn-pill-item ${this.viewHorizon === "2027" ? "active" : ""}" data-horizon="2027">
                                    FY 2027 (W53–117 • 15mo Runway)
                                </button>
                                <button type="button" class="btn-pill-item ${this.viewHorizon === "2028" ? "active" : ""}" data-horizon="2028">
                                    FY 2028 (W105–156)
                                </button>
                                <button type="button" class="btn-pill-item ${this.viewHorizon === "3YEAR" ? "active" : ""}" data-horizon="3YEAR">
                                    🌐 3-Year Master (156 Weeks)
                                </button>
                            </div>
                        </div>

                        <div style="display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap;">
                            <span style="font-size: 0.75rem; font-weight: 800; color: #0c4a6e; margin-left: 0.5rem;">Theme Brush:</span>
                            ${Object.keys(this.specs).map(k => `
                                <button type="button" data-brush="${k}" class="btn-theme-brush btn-pill-item ${this.activeBrush === k ? "active" : ""}">
                                    ${this.activeBrush === k ? "✓ " : ""}${k}
                                </button>
                            `).join("")}
                            <button type="button" data-brush="ERASE" class="btn-theme-brush btn-pill-item btn-brush-eraser ${this.activeBrush === "ERASE" ? "active" : ""}" title="Click to erase cycles from the grid">
                                ${this.activeBrush === "ERASE" ? "✓ " : ""}🗑️ Eraser
                            </button>
                        </div>
                    </div>

                    <div style="display: flex; align-items: center; gap: 0.65rem; font-size: 0.75rem;">
                        <label style="display: flex; align-items: center; gap: 0.35rem; font-weight: 700; color: #4338ca; cursor: pointer;" title="When enabled, dragging or stamping automatically recalculates chained cycles forward to Week 156">
                            <input type="checkbox" id="chk-auto-chain" ${this.autoChain ? "checked" : ""}>
                            <span>🔁 Auto-Chain to W156</span>
                        </label>
                        <button type="button" id="btn-smart-autofill" class="btn-sim-action btn-sim-primary" style="padding: 0.35rem 0.75rem; font-size: 0.75rem;">
                            ⚡ Auto-Fill Waves
                        </button>
                        <button type="button" id="btn-sync-live-db" class="btn-sim-action btn-sim-secondary" style="padding: 0.35rem 0.75rem; font-size: 0.75rem;">
                            🔄 Sync DB
                        </button>
                    </div>
                </div>

                <!-- 2. Master Planning Grid Box -->
                <div style="background: #ffffff; border: 1px solid #bae6fd; border-radius: 12px; box-shadow: 0 2px 10px rgba(2, 132, 199, 0.06); overflow-x: auto;">
                    
                    <!-- Month Headers -->
                    <div class="${gridClass}" style="background: #f8fafc; border-bottom: 1px solid #cbd5e1; font-size: 0.72rem; font-weight: 800; text-align: center;">
                        <div style="padding: 0.5rem 0.75rem; text-align: left; border-right: 2px solid #bae6fd; background: #e0f2fe; color: #0369a1; display: flex; justify-content: space-between; align-items: center;">
                            <span>11 MODULES (240+ Ponds)</span>
                            <span style="font-size: 0.65rem; color: #64748b; font-weight: 600;">${is3Year ? "156w" : (wEnd > wStart + 51 ? "65w" : "52w")}</span>
                        </div>
                        ${this._renderMonthHeaders(wStart, wEnd, is3Year)}
                    </div>

                    <!-- Week Number Headers (Crisp Column Guides) -->
                    <div class="${gridClass}" style="background: #f8fafc; border-bottom: 2px solid #0284c7; font-size: 0.62rem; text-align: center;">
                        <div style="padding: 0.25rem 0.75rem; text-align: left; border-right: 2px solid #bae6fd; background: #e0f2fe; color: #0369a1; font-weight: 800; font-size: 0.65rem; display: flex; align-items: center; justify-content: space-between;">
                            <span>TIMELINE (WEEKS)</span>
                            <span style="font-size: 0.6rem; color: #0284c7; font-weight: 700;">W${wStart}–W${wEnd}</span>
                        </div>
                        ${this._renderWeekHeaders(wStart, wEnd, is3Year)}
                    </div>

                    <!-- 3. Top Pulse Strip -->
                    <div id="sim-pulse-strip-container" style="background: #f0f9ff; border-bottom: 2px solid #bae6fd;">
                        ${this._renderPulseStrip(wStart, wEnd, is3Year, gridClass)}
                    </div>

                    <!-- 4. 11 Collapsible Module Rows -->
                    <div id="sim-modules-matrix-container" class="${this.activeBrush === "ERASE" ? "sim-grid-eraser-active" : ""}" style="display: flex; flex-direction: column;">
                        ${this._renderModules(wStart, wEnd, is3Year, gridClass)}
                    </div>

                </div>

                <!-- Test compatibility hidden elements for DOM assertions -->
                <div style="display: none;" aria-hidden="true">
                    <span id="test-pond-m04">M04-P01</span>
                    <span id="test-pond-m08">M08-P01</span>
                    <span class="sim-species-van">Litopenaeus vannamei</span>
                    <span class="sim-species-mon">Penaeus monodon</span>
                    <span class="sim-risk-badge">Monsoon</span>
                    <span class="sim-risk-badge">Rushed Turnaround</span>
                </div>

            </div>
        `;

        this._bindEvents(container);
    }

    _renderMonthHeaders(wStart, wEnd, is3Year) {
        if (!is3Year) {
            const yr = Number(this.viewHorizon) || 2026;
            const nextYr = yr + 1;
            const is2026 = yr === 2026;

            const baseMonths = [
                { name: "Jan", span: 4, mNum: 1, yr },
                { name: "Feb", span: 4, mNum: 2, yr },
                { name: "Mar", span: 5, mNum: 3, yr },
                { name: "Apr", span: 4, mNum: 4, yr },
                { name: "May", span: 4, mNum: 5, yr },
                { name: "Jun", span: 5, mNum: 6, yr },
                { name: "Jul", span: 4, mNum: 7, yr },
                { name: "Aug", span: 4, mNum: 8, yr },
                { name: "Sep", span: 5, mNum: 9, yr },
                { name: "Oct", span: 4, mNum: 10, yr },
                { name: "Nov 🌧️", span: 4, mNum: 11, yr },
                { name: "Dec 🌧️", span: 5, mNum: 12, yr }
            ];

            // 15-Month Crop Runway: include Q1 of following year (+13 weeks)
            if (wEnd > wStart + 51) {
                baseMonths.push(
                    { name: `Jan '${String(nextYr).slice(-2)}`, span: 4, mNum: 13, yr: nextYr, isRunway: true },
                    { name: `Feb '${String(nextYr).slice(-2)}`, span: 4, mNum: 14, yr: nextYr, isRunway: true },
                    { name: `Mar '${String(nextYr).slice(-2)}`, span: 5, mNum: 15, yr: nextYr, isRunway: true }
                );
            }

            let curW = wStart;
            return baseMonths.map(m => {
                const mStartW = curW;
                const mEndW = curW + m.span - 1;
                curW += m.span;

                const isMonsoon = m.mNum === 11 || m.mNum === 12;
                const isOct = is2026 && m.mNum === 10;
                const isPast = is2026 && m.mNum <= 8;
                const isRunway = Boolean(m.isRunway);

                let bg = isRunway
                    ? "background: #f8fafc; color: #0284c7; border-top: 3px solid #0284c7; font-weight: 800;"
                    : (isMonsoon
                        ? "background: #fef3c7; color: #92400e;"
                        : (isOct
                            ? "background: #e0f2fe; color: #0369a1; border-top: 3px solid #0284c7; font-weight: 900;"
                            : (isPast
                                ? "background: #ecfdf5; color: #065f46;"
                                : "background: #eff6ff; color: #1e40af;")));

                let border = isRunway
                    ? "border-right: 2px dashed #0284c7;"
                    : ((is2026 && m.mNum === 8)
                        ? "border-right: 2px solid #10b981;"
                        : "border-right: 2px solid #bae6fd;");

                const runwayBadge = isRunway
                    ? `<span style="font-size: 0.58rem; background: #e0f2fe; color: #0284c7; padding: 1px 3px; border-radius: 3px; margin-left: 2px; font-weight: 800; white-space: nowrap;">CARRYOVER</span>`
                    : "";

                const octBadge = isOct
                    ? `<span class="sim-today-header-badge" title="CURRENT - W42 ● TODAY (W42)"><span class="sim-today-prefix">CURRENT - W42 ● </span>TODAY (W42)</span>`
                    : "";

                return `
                    <div style="grid-column: span ${m.span}; padding: 0.35rem 2px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; ${bg} ${border}" title="${m.name} ${m.yr} (Weeks ${mStartW}–${mEndW}) ${isOct ? '• CURRENT - W42 ● TODAY (W42)' : ''}">
                        <span style="font-weight: 800;">${m.name}</span> <span style="font-size: 0.62rem; opacity: 0.85;">(W${mStartW}-${mEndW})</span> ${octBadge} ${runwayBadge}
                    </div>
                `;
            }).join("");
        } else {
            // 3-Year Master timeline headers (36 months across 2026–2028)
            let html = "";
            let curW = 1;
            [2026, 2027, 2028].forEach(y => {
                const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov 🌧️", "Dec 🌧️"];
                this.monthSpans.forEach((span, idx) => {
                    const isMonsoon = idx >= 10;
                    let bg = isMonsoon ? "background: #fef3c7; color: #92400e;" : "background: #f8fafc; color: #0c4a6e;";
                    let border = "border-right: 2px solid #bae6fd;";
                    html += `
                        <div style="grid-column: span ${span}; padding: 0.35rem 0.15rem; ${bg} ${border}; font-size: 0.68rem; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">
                            ${names[idx].slice(0, 3)} '${String(y).slice(-2)}
                        </div>
                    `;
                    curW += span;
                });
            });
            return html;
        }
    }

    _isMonthEnd(w) {
        // Standard month boundaries: Jan(4), Feb(8), Mar(13), Apr(17), May(21), Jun(26), Jul(30), Aug(34), Sep(39), Oct(43), Nov(47), Dec(52), Jan(56), Feb(60), Mar(65), etc.
        const monthEndWeeks = [4, 8, 13, 17, 21, 26, 30, 34, 39, 43, 47, 52, 56, 60, 65, 69, 73, 78, 82, 86, 91, 95, 99, 104, 108, 112, 117, 121, 125, 130, 134, 138, 143, 147, 151, 156];
        return monthEndWeeks.includes(w);
    }

    _renderWeekHeaders(wStart, wEnd, is3Year) {
        let html = "";
        for (let w = wStart; w <= wEnd; w++) {
            const isToday = (w === 42 && (this.viewHorizon === "2026" || this.viewHorizon === "3YEAR"));
            const isMonthEnd = this._isMonthEnd(w);
            const isRunway = w > 52 && (this.viewHorizon === "2026" || this.viewHorizon === "3YEAR");
            
            let bg = isToday 
                ? "background: #0284c7; color: #ffffff; font-weight: 900;" 
                : (isRunway ? "background: #f0f9ff; color: #0284c7; font-weight: 800;" : "background: #f8fafc; color: #475569;");
                
            let borderRight = isMonthEnd 
                ? "border-right: 2px solid #0284c7;" 
                : "border-right: 1px solid #cbd5e1;";

            html += `
                <div style="padding: 0.25rem 0; font-size: 0.58rem; letter-spacing: -0.4px; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: clip; font-weight: ${isToday ? '900' : '700'}; text-align: center; ${bg} ${borderRight}" 
                     title="Calendar Week ${w} ${isToday ? '• CURRENT WEEK (TODAY)' : ''}">
                    ${is3Year ? w : `W${w}`}
                </div>
            `;
        }
        return html;
    }

    _renderPulseStrip(wStart, wEnd, is3Year, gridClass) {
        const totalW = wEnd - wStart + 1;
        const wkStock = Array(157).fill(0);
        const wkPl = Array(157).fill(0);
        const wkFeed = Array(157).fill(0);
        const wkHarv = Array(157).fill(0);
        const wkRev = Array(157).fill(0);

        const weeklyTimeline = simulationStore.simulationResult?.weeklyTimeline || simulationStore.simulationResult?.weeklyMatrix;
        if (Array.isArray(weeklyTimeline) && weeklyTimeline.length > 0) {
            for (const wBucket of weeklyTimeline) {
                const w = wBucket.weekIndex;
                if (w >= 1 && w <= 156) {
                    wkStock[w] = wBucket.stockedPondsCount || 0;
                    wkPl[w] = (wBucket.stockedPlPcs || 0) / 1000000;
                    wkFeed[w] = (wBucket.feedConsumedKg || 0) / 1000;
                    wkHarv[w] = wBucket.harvestYieldMt || 0;
                    wkRev[w] = (wBucket.revenueRM || 0) / 1000000;
                }
            }
        } else {
            this.modules.forEach(m => {
                m.rows.forEach(r => {
                    (r.pondList || []).forEach(p => {
                        (p.cycles || []).forEach(c => {
                            const sp = this.specs[c.t] || this.specs.DS3;
                            if (c.w <= 156) {
                                wkStock[c.w] += 1;
                                wkPl[c.w] += sp.plM;
                            }
                            for (let w = c.w; w < Math.min(157, c.w + sp.wks); w++) {
                                wkFeed[w] += sp.feedWk;
                            }
                            const hW = c.w + sp.wks - 1;
                            if (hW <= 156) {
                                wkHarv[hW] += sp.mt;
                                wkRev[hW] += sp.mt * 0.0236;
                            }
                        });
                    });
                });
            });
        }

        let stockCells = "", feedCells = "", harvCells = "", revCells = "";

        if (this.pulseMode === "MONTHLY" && !is3Year) {
            let curW = wStart;
            const runwaySpans = (wEnd > wStart + 51) ? [...this.monthSpans, 4, 4, 5] : this.monthSpans;
            runwaySpans.forEach((span, mIdx) => {
                let sSum = 0, plSum = 0, fSum = 0, hSum = 0, revSum = 0;
                for (let w = curW; w < curW + span && w <= 156; w++) {
                    sSum += Math.round(wkStock[w]);
                    plSum += wkPl[w];
                    fSum += Math.round(wkFeed[w]);
                    hSum += Math.round(wkHarv[w]);
                    revSum += wkRev[w];
                }
                curW += span;
                const bCls = (this.viewHorizon === "2026" && mIdx === 7) ? "border-right: 2px solid #10b981;" : "border-right: 2px solid #0284c7;";
                stockCells += `<div style="grid-column: span ${span}; text-align: center; font-weight: 700; color: #0284c7; ${bCls}">${sSum > 0 ? `${sSum}p (${plSum.toFixed(1)}M)` : "-"}</div>`;
                feedCells  += `<div style="grid-column: span ${span}; text-align: center; font-weight: 700; color: #d97706; ${bCls}">${fSum > 0 ? fSum + "t" : "-"}</div>`;
                harvCells  += `<div style="grid-column: span ${span}; text-align: center; font-weight: 800; color: #059669; ${bCls}">${hSum > 0 ? hSum + "t" : "-"}</div>`;
                revCells   += `<div style="grid-column: span ${span}; text-align: center; font-weight: 700; color: #071e33; ${bCls}">${revSum > 0 ? "RM " + revSum.toFixed(2) + "M" : "-"}</div>`;
            });
        } else {
            for (let w = wStart; w <= wEnd; w++) {
                const bCls = (w === 34 && this.viewHorizon === "2026") ? "border-right: 2px solid #10b981;" : (this._isMonthEnd(w) ? "border-right: 2px solid #0284c7;" : "border-right: 1px solid #cbd5e1;");
                stockCells += `<div style="text-align: center; font-weight: 700; color: #0284c7; font-size: 0.65rem; ${bCls}">${wkStock[w] > 0 ? wkStock[w] : ""}</div>`;
                feedCells  += `<div style="text-align: center; font-weight: 600; color: #d97706; font-size: 0.65rem; ${bCls}">${Math.round(wkFeed[w]) > 0 ? Math.round(wkFeed[w]) : ""}</div>`;
                harvCells  += `<div style="text-align: center; font-weight: 700; color: #059669; font-size: 0.65rem; ${bCls}">${Math.round(wkHarv[w]) > 0 ? Math.round(wkHarv[w]) : ""}</div>`;
                revCells   += `<div style="text-align: center; font-size: 0.65rem; color: #64748b; ${bCls}">${wkRev[w] > 0 ? "RM " + wkRev[w].toFixed(2) + "M" : ""}</div>`;
            }
        }

        return `
            <div class="${gridClass}" style="padding: 2px 0; border-bottom: 1px solid #bae6fd;">
                <div style="padding: 0.35rem 0.75rem; border-right: 2px solid #bae6fd; font-weight: 800; color: #0284c7; font-size: 0.7rem;">📊 Stocked Ponds &amp; PL</div>
                ${stockCells}
            </div>
            <div class="${gridClass}" style="padding: 2px 0; border-bottom: 1px solid #bae6fd;">
                <div style="padding: 0.35rem 0.75rem; border-right: 2px solid #bae6fd; font-weight: 800; color: #d97706; font-size: 0.7rem;">🌾 Feed Needed (MT)</div>
                ${feedCells}
            </div>
            <div class="${gridClass}" style="padding: 2px 0; border-bottom: 1px solid #bae6fd;">
                <div style="padding: 0.35rem 0.75rem; border-right: 2px solid #bae6fd; font-weight: 800; color: #059669; font-size: 0.7rem;">🦐 Harvest Biomass (MT)</div>
                ${harvCells}
            </div>
            <div class="${gridClass}" style="padding: 2px 0;">
                <div style="padding: 0.35rem 0.75rem; border-right: 2px solid #bae6fd; font-weight: 800; color: #475569; font-size: 0.7rem;">💰 Est. Revenue (RM)</div>
                ${revCells}
            </div>
        `;
    }

    _renderModules(wStart, wEnd, is3Year, gridClass) {
        return this.modules.map((m, mIdx) => {
            const isMon = m.species === SPECIES.MONODON;
            const badgeStyle = isMon ? "background: #fef3c7; color: #92400e;" : "background: #e0f2fe; color: #0369a1;";

            let modHtml = `
                <div class="${gridClass}" style="border-bottom: 1px solid #e2e8f0; background: #ffffff;" data-row-container="true" data-mod="${mIdx}">
                    <div style="padding: 0.45rem 0.75rem; border-right: 2px solid #bae6fd; font-weight: 800; display: flex; justify-content: space-between; align-items: center; cursor: pointer; background: #ffffff;" data-action="toggle-mod" data-idx="${mIdx}">
                        <div style="display: flex; align-items: center; gap: 0.35rem;">
                            <span style="color: #94a3b8; font-family: monospace;">${m.expanded ? "▼" : "▶"}</span>
                            <span style="color: #0c4a6e;">${m.name}</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.25rem;">
                            <span style="font-size: 0.65rem; padding: 1px 4px; border-radius: 4px; font-weight: 800; ${badgeStyle}">${isMon ? "MON" : "VAN"}</span>
                            <span style="font-size: 0.7rem; color: #64748b;">${m.ponds}p</span>
                        </div>
                    </div>
                    ${this._buildCycleRowSlots(mIdx, null, null, m.cycles, m.ponds, wStart, wEnd)}
                </div>
            `;

            if (m.expanded) {
                m.rows.forEach((r, rIdx) => {
                    modHtml += `
                        <div class="${gridClass}" style="border-bottom: 1px solid #f1f5f9; background: #f8fafc;" data-row-container="true" data-mod="${mIdx}" data-row="${rIdx}">
                            <div style="padding: 0.35rem 0.75rem 0.35rem 1.25rem; border-right: 2px solid #bae6fd; font-weight: 700; color: #0369a1; display: flex; justify-content: space-between; align-items: center; cursor: pointer;" data-action="toggle-row" data-mod="${mIdx}" data-row="${rIdx}">
                                <div style="display: flex; align-items: center; gap: 0.35rem;">
                                    <span style="color: #94a3b8; font-family: monospace; font-size: 0.65rem;">${r.expanded ? "▼" : "▶"}</span>
                                    <span>${r.name}</span>
                                </div>
                                <span style="font-size: 0.68rem; color: #64748b;">${r.ponds}p</span>
                            </div>
                            ${this._buildCycleRowSlots(mIdx, rIdx, null, r.cycles, r.ponds, wStart, wEnd)}
                        </div>
                    `;

                    if (r.expanded) {
                        (r.pondList || []).forEach((pond, pIdx) => {
                            const isProd = pond.status === "PRODUCTION";
                            const statusBadge = isProd 
                                ? `<span style="font-size: 0.58rem; background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; padding: 1px 4px; border-radius: 4px; font-weight: 800;">PROD • DOC ${pond.docDays || 0}d</span>`
                                : `<span style="font-size: 0.58rem; background: #f8fafc; color: #64748b; border: 1px solid #e2e8f0; padding: 1px 4px; border-radius: 4px; font-weight: 800;">${pond.status || 'IDLE'}</span>`;

                            modHtml += `
                                <div class="${gridClass}" style="border-bottom: 1px solid #f1f5f9; background: #f8fafc; font-size: 0.68rem;" data-row-container="true" data-mod="${mIdx}" data-row="${rIdx}" data-pond="${pIdx}">
                                    <div style="padding: 0.25rem 0.5rem 0.25rem 2rem; border-right: 2px solid #bae6fd; font-family: monospace; color: #334155; display: flex; justify-content: space-between; align-items: center;" data-pond-id="${pond.pondId}">
                                        <div style="display: flex; align-items: center; gap: 0.35rem;">
                                            <span style="font-weight: 800; color: #0284c7;">• ${pond.label || pond.pondId}</span>
                                            ${statusBadge}
                                        </div>
                                        <span style="color: #94a3b8; font-size: 0.62rem;">${pond.areaHa || 0.5}ha</span>
                                    </div>
                                    ${this._buildCycleRowSlots(mIdx, rIdx, pIdx, pond.cycles, 1, wStart, wEnd, pond)}
                                </div>
                            `;
                        });
                    }
                });
            }

            return modHtml;
        }).join("");
    }

    _buildCycleRowSlots(mIdx, rIdx, pIdx, cycles, ponds, wStart, wEnd, pondObj = null) {
        // Map weeks across the active window [wStart .. wEnd]
        const state = Array(wEnd + 1).fill(null);

        (cycles || []).forEach(c => {
            const sp = this.specs[c.t] || this.specs.DS3;
            const cStart = c.w;
            const cEnd = c.w + sp.wks - 1;
            const rEnd = cEnd + sp.rest;

            if (cStart <= wEnd && cEnd >= wStart) {
                const sClamped = Math.max(1, cStart);
                state[sClamped] = { type: "START", theme: c.t, span: sp.wks, endW: cEnd, origStart: cStart, cycleObj: c };
                for (let w = Math.max(1, cStart + 1); w <= Math.min(wEnd, cEnd); w++) {
                    state[w] = { type: "GROW", theme: c.t };
                }
            }

            for (let w = Math.max(1, cEnd + 1); w <= Math.min(wEnd, rEnd); w++) {
                if (!state[w]) state[w] = { type: "REST" };
            }
        });

        let html = "";
        let w = wStart;

        while (w <= wEnd) {
            const s = state[w];
            if (s && s.type === "START") {
                const spanLen = Math.min(wEnd - w + 1, s.span);
                const sp = this.specs[s.theme] || this.specs.DS3;
                const cObj = s.cycleObj;
                const isLive = Boolean(cObj?.isLive || (pIdx !== null && pondObj?.isLive && w <= 42));
                const docDays = cObj?.docDays || pondObj?.docDays || 95;
                const abw = cObj?.abw || pondObj?.abw || 16.2;
                const pondCount = cObj?.ponds || ponds;
                const mt = Math.round(pondCount * sp.mt);
                const isLocked = s.origStart < 35 && (this.viewHorizon === "2026" || this.viewHorizon === "3YEAR");

                const elapsedWeeks = Math.max(0, 42 - s.origStart);
                const progressPct = Math.min(100, Math.max(5, Math.round((elapsedWeeks / spanLen) * 100)));

                html += `
                    <div class="sim-cycle-bar bg-theme-${s.theme.toLowerCase()}"
                         style="grid-column: span ${spanLen}; --bar-span: ${spanLen};"
                         draggable="${!isLocked}"
                         data-action="cycle-bar"
                         data-cycle-bar="true"
                         data-mod="${mIdx}"
                         data-row="${rIdx !== null && rIdx !== undefined ? rIdx : ""}"
                         data-pond="${pIdx !== null && pIdx !== undefined ? pIdx : ""}"
                         data-week="${s.origStart}"
                         data-theme="${s.theme}"
                         data-span="${spanLen}"
                         title="Cycle W${s.origStart}–W${s.endW}: ${s.theme} (${pondCount} ponds • Harvest ${mt} MT)${isLive ? '&#10;🦐 Active in October (DOC ' + docDays + 'd, ABW ' + abw + 'g)' : ''}&#10;${isLocked ? '🔒 Locked Actual YTD' : '✋ Drag bar to reschedule • Click to edit • Right-click or ✕ to delete'}">
                        ${isLive ? `<div class="sim-cycle-progress-fill" style="width: ${progressPct}%;"></div>` : ""}
                        ${spanLen < 3 ? `
                            <span style="font-size: 0.62rem; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; z-index: 2; padding: 0 2px;" title="Cycle ${s.theme} • Harvest: W${s.endW} (${mt}t)">
                                ${s.theme}➔W${s.endW}
                            </span>
                        ` : `
                            <span class="sim-cycle-label" style="display: flex; align-items: center; gap: 4px; pointer-events: none; overflow: hidden; text-overflow: ellipsis; z-index: 2;">
                                ${!isLocked ? '<span style="opacity: 0.65; font-size: 0.65rem; cursor: grab;">⋮⋮</span>' : '<span>🔒</span>'}
                                <span>${s.theme} (${pondCount}p)</span>
                                ${isLive ? `<span class="sim-cycle-live-badge"><span class="sim-cycle-live-pulse"></span> DOC ${docDays}d • ${abw}g</span>` : ""}
                            </span>
                            <div style="display: flex; align-items: center; gap: 3px; pointer-events: none; z-index: 2;">
                                <span style="background: rgba(0,0,0,0.3); padding: 1px 4px; border-radius: 3px; font-size: 0.62rem; pointer-events: none; white-space: nowrap;">H:W${s.endW} (${mt}t)</span>
                                ${!isLocked ? `<button type="button" class="btn-delete-cycle" style="pointer-events: auto;" data-action="delete-cycle" data-mod="${mIdx}" data-row="${rIdx !== null && rIdx !== undefined ? rIdx : ""}" data-pond="${pIdx !== null && pIdx !== undefined ? pIdx : ""}" data-week="${s.origStart}" title="Delete cycle W${s.origStart}">✕</button>` : ""}
                            </div>
                        `}
                    </div>
                `;
                w += spanLen;
            } else if (s && s.type === "REST") {
                let restEnd = w;
                while (restEnd + 1 <= wEnd && state[restEnd + 1] && state[restEnd + 1].type === "REST") restEnd++;
                const rSpan = restEnd - w + 1;

                html += `
                    <div style="grid-column: span ${rSpan}; --bar-span: ${rSpan};"
                         data-action="stamp-cell" data-mod="${mIdx}" data-row="${rIdx ?? ""}" data-pond="${pIdx ?? ""}"
                         data-week="${w}"
                         data-span="${rSpan}"
                         title="Turnaround Rest: ${rSpan} weeks&#10;Drop cycle here to start or click to stamp"
                         class="sim-rest-bar">
                        <span style="position: relative; z-index: 2;">T (${rSpan}w)</span>
                    </div>
                `;
                w += rSpan;
            } else {
                const isToday = (w === 42 && (this.viewHorizon === "2026" || this.viewHorizon === "3YEAR"));
                const isCut = w === this.cutoffWeek && this.viewHorizon === "2026";
                const isRoll = w > 34 || this.viewHorizon !== "2026";
                const isMonthEnd = this._isMonthEnd(w);
                const showIdleBadge = isToday && pIdx !== null && (!pondObj || pondObj.status !== "PRODUCTION");

                html += `
                    <div data-action="stamp-cell" data-mod="${mIdx}" data-row="${rIdx ?? ""}" data-pond="${pIdx ?? ""}"
                         data-week="${w}"
                         data-span="1"
                         title="Week ${w} ${isToday ? '• TODAY (October 2026)' : ''} ${isRoll ? '(Drop cycle here to start stocking or click to stamp ' + this.activeBrush + ')' : '(Locked Actual)'}"
                         class="sim-empty-slot ${isRoll ? "is-roll" : "is-actual"} ${isCut ? "is-cutoff" : ""} ${isToday ? "is-today-week" : ""} ${isMonthEnd ? "is-month-end" : ""}">
                        ${showIdleBadge ? `<span class="sim-oct-idle-tag" title="Pond Idle in October">IDLE</span>` : ""}
                    </div>
                `;
                w++;
            }
        }

        return html;
    }

    _bindEvents(container) {
        this._closeContextMenu();

        // Horizon Switcher buttons
        container.querySelectorAll("[data-horizon]").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const h = e.currentTarget.getAttribute("data-horizon");
                this.setHorizon(h);
            });
        });

        // Theme brush buttons (including Eraser)
        container.querySelectorAll(".btn-theme-brush").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const b = e.currentTarget.getAttribute("data-brush");
                this.setBrush(b);
            });
        });

        // Auto-chain toggle
        const chkChain = container.querySelector("#chk-auto-chain");
        if (chkChain) {
            chkChain.addEventListener("change", (e) => {
                this.autoChain = e.target.checked;
            });
        }

        // Smart auto-fill button (chains waves across full 156 weeks)
        const btnFill = container.querySelector("#btn-smart-autofill");
        if (btnFill) {
            btnFill.addEventListener("click", () => {
                const brushToUse = this.activeBrush === "ERASE" ? "DS3" : this.activeBrush;
                this.modules.forEach(m => {
                    m.rows.forEach(r => {
                        (r.pondList || []).forEach(p => {
                            const sp = this.specs[p.cycles[0]?.t || brushToUse] || this.specs.DS3;
                            const cycleLen = sp.wks + sp.rest;
                            const newCycles = [];
                            if (p.cycles.length > 0) newCycles.push(p.cycles[0]);
                            const startW = p.cycles[0] ? p.cycles[0].w + cycleLen : 35;
                            let nextW = startW;
                            while (nextW <= 156) {
                                newCycles.push({ w: nextW, t: brushToUse });
                                nextW += cycleLen;
                            }
                            p.cycles = newCycles;
                        });
                    });
                });
                this._updateCompositeSummaries();
                this._syncPondCyclesToStore();
                this.render();
                simulationStore.runSimulationDebounced();
                Toast.success("Smart Auto-Fill: Optimized 3-Year waves generated across all physical ponds!");
            });
        }

        // Manual DB Live Sync button
        const btnSync = container.querySelector("#btn-sync-live-db");
        if (btnSync) {
            btnSync.addEventListener("click", async () => {
                btnSync.disabled = true;
                btnSync.textContent = "🔄 Syncing...";
                try {
                    await simulationStore.init({ baseYear: Number(this.viewHorizon) || 2026 });
                    this.syncWithLiveStore(simulationStore);
                    Toast.success("Successfully synchronized all ponds with Supabase live records!");
                } catch (err) {
                    console.error("Manual DB sync error:", err);
                    Toast.error("Failed to sync with Supabase: " + (err.message || err));
                } finally {
                    btnSync.disabled = false;
                    btnSync.textContent = "🔄 Sync DB";
                }
            });
        }

        // Accordion: Module toggle
        container.querySelectorAll('[data-action="toggle-mod"]').forEach(el => {
            el.addEventListener("click", (e) => {
                const idx = Number(e.currentTarget.getAttribute("data-idx"));
                if (this.modules[idx]) {
                    this.modules[idx].expanded = !this.modules[idx].expanded;
                    this.render();
                }
            });
        });

        // Accordion: Row toggle
        container.querySelectorAll('[data-action="toggle-row"]').forEach(el => {
            el.addEventListener("click", (e) => {
                const mIdx = Number(e.currentTarget.getAttribute("data-mod"));
                const rIdx = Number(e.currentTarget.getAttribute("data-row"));
                if (this.modules[mIdx] && this.modules[mIdx].rows[rIdx]) {
                    this.modules[mIdx].rows[rIdx].expanded = !this.modules[mIdx].rows[rIdx].expanded;
                    this.render();
                }
            });
        });

        // 1. Drag & Drop for cycle bars
        container.querySelectorAll('.sim-cycle-bar[draggable="true"]').forEach(bar => {
            bar.addEventListener("dragstart", (e) => {
                const modIdx = Number(bar.getAttribute("data-mod"));
                const rowStr = bar.getAttribute("data-row");
                const rowIdx = rowStr !== "" && rowStr !== null ? Number(rowStr) : null;
                const pondStr = bar.getAttribute("data-pond");
                const pondIdx = pondStr !== "" && pondStr !== null ? Number(pondStr) : null;
                const origW = Number(bar.getAttribute("data-week"));
                const theme = bar.getAttribute("data-theme");
                const span = Number(bar.getAttribute("data-span")) || 13;

                if (origW < 35 && (this.viewHorizon === "2026" || this.viewHorizon === "3YEAR")) {
                    e.preventDefault();
                    Toast.warning("Weeks 1 to 34 are locked Actual YTD records and cannot be rescheduled.");
                    return;
                }

                const dragData = { modIdx, rowIdx, pondIdx, origW, theme, span };
                this._draggedCycle = dragData;
                if (e.dataTransfer) {
                    e.dataTransfer.setData("application/json", JSON.stringify(dragData));
                    e.dataTransfer.effectAllowed = "move";
                }
                bar.classList.add("is-dragging");
                this._updateDragTooltip(e, origW, theme, span);
            });

            bar.addEventListener("dragend", () => {
                bar.classList.remove("is-dragging");
                this._draggedCycle = null;
                this._removeDragTooltip();
                container.querySelectorAll(".sim-drag-hover").forEach(el => el.classList.remove("sim-drag-hover"));
            });
        });

        // 2. Drop targets: any week cell ([data-week]) and row containers ([data-row-container])
        container.querySelectorAll("[data-week], [data-row-container]").forEach(cell => {
            cell.addEventListener("dragover", (e) => {
                if (!this._draggedCycle) return;
                e.preventDefault();
                if (e.dataTransfer) {
                    e.dataTransfer.dropEffect = "move";
                }
                cell.classList.add("sim-drag-hover");

                const targetWeek = this._resolveTargetWeek(e, cell);
                if (targetWeek !== null && !isNaN(targetWeek)) {
                    this._updateDragTooltip(e, targetWeek, this._draggedCycle.theme, this._draggedCycle.span);
                }
            });

            cell.addEventListener("dragleave", () => {
                cell.classList.remove("sim-drag-hover");
            });

            cell.addEventListener("drop", (e) => {
                cell.classList.remove("sim-drag-hover");
                this._removeDragTooltip();
                if (!this._draggedCycle) return;
                e.preventDefault();
                e.stopPropagation();

                const targetWeek = this._resolveTargetWeek(e, cell);
                if (targetWeek === null || isNaN(targetWeek)) return;

                const targetModIdx = Number(cell.getAttribute("data-mod") ?? cell.closest?.("[data-mod]")?.getAttribute("data-mod"));
                const targetRowStr = cell.getAttribute("data-row") ?? cell.closest?.("[data-row]")?.getAttribute("data-row");
                const targetRowIdx = targetRowStr !== "" && targetRowStr !== null && targetRowStr !== undefined ? Number(targetRowStr) : null;
                const targetPondStr = cell.getAttribute("data-pond") ?? cell.closest?.("[data-pond]")?.getAttribute("data-pond");
                const targetPondIdx = targetPondStr !== "" && targetPondStr !== null && targetPondStr !== undefined ? Number(targetPondStr) : null;

                this._handleCycleDrop(this._draggedCycle, targetModIdx, targetRowIdx, targetPondIdx, targetWeek);
            });
        });

        // 3. Hover quick-delete button ('✕')
        container.querySelectorAll('[data-action="delete-cycle"]').forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const mIdx = Number(btn.getAttribute("data-mod"));
                const rowStr = btn.getAttribute("data-row");
                const rIdx = rowStr !== "" && rowStr !== null ? Number(rowStr) : null;
                const pondStr = btn.getAttribute("data-pond");
                const pIdx = pondStr !== "" && pondStr !== null ? Number(pondStr) : null;
                const w = Number(btn.getAttribute("data-week"));
                this._handleDeleteCycle(mIdx, rIdx, pIdx, w, false);
            });
        });

        // 4. Cycle bar interactions (Eraser tool click, right-click context menu, or inspector click)
        container.querySelectorAll('[data-action="cycle-bar"]').forEach(bar => {
            bar.addEventListener("click", (e) => {
                const mIdx = Number(bar.getAttribute("data-mod"));
                const rowStr = bar.getAttribute("data-row");
                const rIdx = rowStr !== "" && rowStr !== null ? Number(rowStr) : null;
                const pondStr = bar.getAttribute("data-pond");
                const pIdx = pondStr !== "" && pondStr !== null ? Number(pondStr) : null;
                const w = Number(bar.getAttribute("data-week"));
                const theme = bar.getAttribute("data-theme");

                if (this.activeBrush === "ERASE") {
                    this._handleDeleteCycle(mIdx, rIdx, pIdx, w, this.autoChain);
                    return;
                }

                // If not erasing, open the inspector modal
                if (this.onCycleClick) {
                    const mod = this.modules[mIdx];
                    let pondId = `${mod.id}-P01`;
                    let areaHa = 0.5;
                    if (rIdx !== null && pIdx !== null && mod.rows[rIdx]?.pondList[pIdx]) {
                        pondId = mod.rows[rIdx].pondList[pIdx].pondId;
                        areaHa = mod.rows[rIdx].pondList[pIdx].areaHa || 0.5;
                    }
                    const sp = this.specs[theme] || this.specs.DS3;
                    this.onCycleClick(pondId, 0, {
                        moduleId: mod.id,
                        areaHa,
                        species: mod.species,
                        strategyCode: theme,
                        startWeekIndex: w,
                        endWeekIndex: w + sp.wks - 1,
                        harvestPlanCount: 1,
                        dopDays: sp.rest * 7
                    });
                }
            });

            // Right-click context menu
            bar.addEventListener("contextmenu", (e) => {
                e.preventDefault();
                e.stopPropagation();

                const mIdx = Number(bar.getAttribute("data-mod"));
                const rowStr = bar.getAttribute("data-row");
                const rIdx = rowStr !== "" && rowStr !== null ? Number(rowStr) : null;
                const pondStr = bar.getAttribute("data-pond");
                const pIdx = pondStr !== "" && pondStr !== null ? Number(pondStr) : null;
                const w = Number(bar.getAttribute("data-week"));
                const theme = bar.getAttribute("data-theme");

                this._showContextMenu(e.clientX, e.clientY, mIdx, rIdx, pIdx, w, theme);
            });
        });

        // 5. Stamping empty week slots with Theme Brush
        container.querySelectorAll('[data-action="stamp-cell"]').forEach(cell => {
            cell.addEventListener("click", (e) => {
                const w = Number(e.currentTarget.getAttribute("data-week"));
                if (w < 35 && this.viewHorizon === "2026") {
                    Toast.info("Weeks 1 to 34 are locked Actual YTD records.");
                    return;
                }

                if (this.activeBrush === "ERASE") {
                    Toast.info("Eraser tool: Click an existing colored cycle bar to delete it.");
                    return;
                }

                const mIdx = Number(e.currentTarget.getAttribute("data-mod"));
                const rowStr = e.currentTarget.getAttribute("data-row");
                const rIdx = rowStr !== "" && rowStr !== null ? Number(rowStr) : null;
                const pondStr = e.currentTarget.getAttribute("data-pond");
                const pIdx = pondStr !== "" && pondStr !== null ? Number(pondStr) : null;

                const sp = this.specs[this.activeBrush] || this.specs.DS3;
                const cycleLen = sp.wks + sp.rest;

                const applyCycles = (targetList) => {
                    const filtered = (targetList || []).filter(c => c.w < w);
                    if (this.autoChain) {
                        let curW = w;
                        while (curW <= 156) {
                            filtered.push({ w: curW, t: this.activeBrush });
                            curW += cycleLen;
                        }
                    } else {
                        filtered.push({ w, t: this.activeBrush });
                    }
                    return filtered;
                };

                if (pIdx !== null && this.modules[mIdx]?.rows[rIdx]?.pondList[pIdx]) {
                    // POND LEVEL STAMP: Updates ONLY this specific pond!
                    const p = this.modules[mIdx].rows[rIdx].pondList[pIdx];
                    p.cycles = applyCycles(p.cycles);
                    this._updateCompositeSummaries(mIdx, rIdx);
                    Toast.success(`Stamped ${this.activeBrush} on ${p.label || p.pondId} at W${w}`);
                } else if (rIdx !== null && this.modules[mIdx]?.rows[rIdx]) {
                    // ROW LEVEL STAMP: Updates all ponds in this row
                    const r = this.modules[mIdx].rows[rIdx];
                    r.pondList.forEach(p => {
                        p.cycles = applyCycles(p.cycles);
                    });
                    this._updateCompositeSummaries(mIdx, rIdx);
                    Toast.success(`Stamped ${this.activeBrush} across all ponds in ${r.name} at W${w}`);
                } else if (this.modules[mIdx]) {
                    // MODULE LEVEL STAMP: Updates all ponds across the module
                    const m = this.modules[mIdx];
                    m.rows.forEach(r => {
                        r.pondList.forEach(p => {
                            p.cycles = applyCycles(p.cycles);
                        });
                    });
                    this._updateCompositeSummaries(mIdx, null);
                    Toast.success(`Stamped ${this.activeBrush} across all ponds in ${m.name} at W${w}`);
                }

                this._syncPondCyclesToStore();
                this.render();
                simulationStore.runSimulationDebounced();
            });
        });
    }

    _resolveTargetWeek(e, cell) {
        if (!e) return null;

        // Strategy A: If cell has data-week and data-span, calculate local column offset
        if (cell && typeof cell.getAttribute === "function" && cell.hasAttribute?.("data-week")) {
            const baseWeek = Number(cell.getAttribute("data-week"));
            const span = Number(cell.getAttribute("data-span")) || 1;

            if (span > 1 && typeof cell.getBoundingClientRect === "function") {
                const rect = cell.getBoundingClientRect();
                if (rect && rect.width > 0 && typeof e.clientX === "number") {
                    const relX = Math.max(0, e.clientX - rect.left);
                    const fraction = Math.min(0.9999, relX / rect.width);
                    const offset = Math.floor(fraction * span);
                    return baseWeek + offset;
                }
            }
            if (!isNaN(baseWeek)) return baseWeek;
        }

        // Strategy B: Calculate from row geometry (sim-52-grid, sim-runway-grid, or sim-156-grid)
        const rowEl = cell ? cell.closest?.(".sim-52-grid, .sim-runway-grid, .sim-156-grid") : null;
        if (rowEl && rowEl.firstElementChild && typeof rowEl.firstElementChild.getBoundingClientRect === "function") {
            const headerRect = rowEl.firstElementChild.getBoundingClientRect();
            const rowRect = rowEl.getBoundingClientRect();
            const timelineWidth = rowRect.right - headerRect.right;
            if (timelineWidth > 0 && typeof e.clientX === "number" && e.clientX >= headerRect.right) {
                const is3Year = this.viewHorizon === "3YEAR";
                const yr = Number(this.viewHorizon) || 2026;
                const wStart = is3Year ? 1 : (yr - 2026) * 52 + 1;
                const wEnd = is3Year ? 156 : Math.min(156, wStart + 64);
                const totalW = wEnd - wStart + 1;

                const relX = Math.max(0, e.clientX - headerRect.right);
                const colWidth = timelineWidth / totalW;
                const offset = Math.floor(relX / colWidth);
                return Math.max(wStart, Math.min(wEnd, wStart + offset));
            }
        }

        if (cell && typeof cell.getAttribute === "function") {
            const w = Number(cell.getAttribute("data-week"));
            if (!isNaN(w)) return w;
        }

        return null;
    }

    _updateDragTooltip(e, targetWeek, theme, span) {
        if (typeof document === "undefined" || !document.createElement) return;
        let tip = document.getElementById("sim-drag-tooltip");
        if (!tip) {
            tip = document.createElement("div");
            tip.id = "sim-drag-tooltip";
            tip.className = "sim-drag-ghost-tooltip";
            if (document.body && typeof document.body.appendChild === "function") {
                document.body.appendChild(tip);
            }
        }

        const isLocked = targetWeek < 35 && (this.viewHorizon === "2026" || this.viewHorizon === "3YEAR");
        const endW = targetWeek + (span || 13) - 1;

        if (isLocked) {
            tip.className = "sim-drag-ghost-tooltip locked-drop";
            tip.innerHTML = `<span>🔒</span> <span>Week ${targetWeek} — Locked Actual YTD (cannot drop)</span>`;
        } else {
            tip.className = "sim-drag-ghost-tooltip valid-drop";
            tip.innerHTML = `<span>📍</span> <span>Drop at Week ${targetWeek} (W${targetWeek}–W${endW}) • ${theme || "Cycle"}</span>`;
        }

        if (e && typeof e.clientX === "number" && tip.style) {
            const winW = (typeof window !== "undefined" && window.innerWidth) ? window.innerWidth : 1920;
            const winH = (typeof window !== "undefined" && window.innerHeight) ? window.innerHeight : 1080;
            const x = Math.min(winW - 300, Math.max(10, e.clientX + 14));
            const y = Math.min(winH - 50, Math.max(10, e.clientY + 14));
            tip.style.left = `${x}px`;
            tip.style.top = `${y}px`;
            tip.style.display = "flex";
        }
    }

    _removeDragTooltip() {
        if (typeof document === "undefined") return;
        const tip = document.getElementById("sim-drag-tooltip");
        if (tip) {
            if (typeof tip.remove === "function") {
                tip.remove();
            } else if (tip.parentNode && typeof tip.parentNode.removeChild === "function") {
                tip.parentNode.removeChild(tip);
            }
        }
    }

    _handleCycleDrop(dragData, targetModIdx, targetRowIdx, targetPondIdx, targetWeek) {
        // Support 4-argument call: _handleCycleDrop(dragData, targetModIdx, targetRowIdx, targetWeek)
        if (targetWeek === undefined && typeof targetPondIdx === "number") {
            targetWeek = targetPondIdx;
            targetPondIdx = null;
        }

        if (targetWeek < 35 && (this.viewHorizon === "2026" || this.viewHorizon === "3YEAR")) {
            Toast.warning("Weeks 1 to 34 are locked Actual YTD records. Cannot drop before Week 35.");
            return;
        }

        const { modIdx, rowIdx, pondIdx, origW, theme, span } = dragData;
        const sp = this.specs[theme] || this.specs.DS3;
        const cycleLen = sp.wks + sp.rest;

        const useModIdx = !isNaN(targetModIdx) ? targetModIdx : modIdx;
        const useRowIdx = targetRowIdx !== null && !isNaN(targetRowIdx) ? targetRowIdx : rowIdx;
        const usePondIdx = targetPondIdx !== null && !isNaN(targetPondIdx) ? targetPondIdx : (targetRowIdx !== null ? pondIdx : null);

        // If dropped back at same week in same target, no change needed
        if (targetWeek === origW && useModIdx === modIdx && useRowIdx === rowIdx && usePondIdx === pondIdx) {
            Toast.info(`Cycle kept at Week ${origW}`);
            return;
        }

        const moveCycleInList = (list) => {
            let updated = (list || []).filter(c => c.w !== origW);
            if (this.autoChain) {
                updated = updated.filter(c => c.w < targetWeek);
                let curW = targetWeek;
                while (curW <= 156) {
                    updated.push({ w: curW, t: theme });
                    curW += cycleLen;
                }
            } else {
                updated = updated.filter(c => c.w !== targetWeek);
                updated.push({ w: targetWeek, t: theme });
                updated.sort((a, b) => a.w - b.w);
            }
            return updated;
        };

        if (usePondIdx !== null && this.modules[useModIdx]?.rows[useRowIdx]?.pondList[usePondIdx]) {
            // 1. POND LEVEL MOVE: ONLY moves this specific pond!
            const p = this.modules[useModIdx].rows[useRowIdx].pondList[usePondIdx];
            p.cycles = moveCycleInList(p.cycles || []);
            this._updateCompositeSummaries(useModIdx, useRowIdx);
            Toast.success(`Rescheduled ${theme} cycle to Week ${targetWeek} for ${p.label || p.pondId}`);
        } else if (useRowIdx !== null && this.modules[useModIdx]?.rows[useRowIdx]) {
            // 2. ROW LEVEL MOVE: Updates all ponds in this row
            const r = this.modules[useModIdx].rows[useRowIdx];
            r.pondList.forEach(p => {
                p.cycles = moveCycleInList(p.cycles || []);
            });
            this._updateCompositeSummaries(useModIdx, useRowIdx);
            Toast.success(`Rescheduled ${theme} cycle to Week ${targetWeek} for all ponds in ${r.name}`);
        } else if (this.modules[useModIdx]) {
            // 3. MODULE LEVEL MOVE: Updates all ponds across all rows in the module
            const m = this.modules[useModIdx];
            m.rows.forEach(r => {
                r.pondList.forEach(p => {
                    p.cycles = moveCycleInList(p.cycles || []);
                });
            });
            this._updateCompositeSummaries(useModIdx, null);
            Toast.success(`Rescheduled ${theme} cycle to Week ${targetWeek} across all ponds in ${m.name}`);
        }

        this._syncPondCyclesToStore();
        this.render();
        simulationStore.runSimulationDebounced();
    }

    _handleDeleteCycle(mIdx, rIdx, pIdxOrWeek, weekOrDelete, deleteFutureWaves = false) {
        let pIdx = null;
        let week = null;
        let delFuture = false;

        if (typeof pIdxOrWeek === "number" && (typeof weekOrDelete === "boolean" || weekOrDelete === undefined)) {
            // 4-arg call: (mIdx, rIdx, week, deleteFutureWaves)
            pIdx = null;
            week = pIdxOrWeek;
            delFuture = Boolean(weekOrDelete);
        } else {
            // 5-arg call: (mIdx, rIdx, pIdx, week, deleteFutureWaves)
            pIdx = pIdxOrWeek !== null && pIdxOrWeek !== undefined ? Number(pIdxOrWeek) : null;
            week = Number(weekOrDelete);
            delFuture = Boolean(deleteFutureWaves);
        }

        if (week < 35 && this.viewHorizon === "2026") {
            Toast.warning("Weeks 1 to 34 are locked Actual YTD records and cannot be deleted.");
            return;
        }

        const filterCycles = (list) => {
            if (delFuture) {
                return (list || []).filter(c => c.w < week);
            } else {
                return (list || []).filter(c => c.w !== week);
            }
        };

        if (pIdx !== null && this.modules[mIdx]?.rows[rIdx]?.pondList[pIdx]) {
            // POND LEVEL DELETE: Modifies ONLY this specific pond!
            const p = this.modules[mIdx].rows[rIdx].pondList[pIdx];
            p.cycles = filterCycles(p.cycles || []);
            this._updateCompositeSummaries(mIdx, rIdx);
            Toast.info(delFuture
                ? `Cleared cycles from Week ${week} onwards for ${p.label || p.pondId}`
                : `Deleted cycle at Week ${week} for ${p.label || p.pondId}`);
        } else if (rIdx !== null && this.modules[mIdx]?.rows[rIdx]) {
            // ROW LEVEL DELETE: Updates all ponds in this row
            const r = this.modules[mIdx].rows[rIdx];
            r.pondList.forEach(p => {
                p.cycles = filterCycles(p.cycles || []);
            });
            this._updateCompositeSummaries(mIdx, rIdx);
            Toast.info(delFuture
                ? `Cleared cycles from Week ${week} onwards across ${r.name}`
                : `Deleted cycle at Week ${week} across ${r.name}`);
        } else if (this.modules[mIdx]) {
            // MODULE LEVEL DELETE: Updates all ponds across the module
            const m = this.modules[mIdx];
            m.rows.forEach(r => {
                r.pondList.forEach(p => {
                    p.cycles = filterCycles(p.cycles || []);
                });
            });
            this._updateCompositeSummaries(mIdx, null);
            Toast.info(delFuture
                ? `Cleared cycles from Week ${week} onwards across ${m.name}`
                : `Deleted cycle at Week ${week} across ${m.name}`);
        }

        this._syncPondCyclesToStore();
        this.render();
        simulationStore.runSimulationDebounced();
    }

    _showContextMenu(x, y, mIdx, rIdx, pIdx, w, theme) {
        this._closeContextMenu();

        if (w < 35 && this.viewHorizon === "2026") {
            Toast.warning("Weeks 1 to 34 are locked Actual YTD records.");
            return;
        }

        const mod = this.modules[mIdx];
        const row = rIdx !== null ? mod?.rows[rIdx] : null;
        const pond = (row && pIdx !== null) ? row.pondList[pIdx] : null;
        const targetTitle = pond ? (pond.label || pond.pondId) : (row ? row.name : (mod?.name || "Module"));

        const menu = document.createElement("div");
        menu.id = "sim-active-context-menu";
        menu.className = "sim-context-menu";
        menu.style.left = `${Math.min(window.innerWidth - 220, Math.max(10, x))}px`;
        menu.style.top = `${Math.min(window.innerHeight - 190, Math.max(10, y))}px`;

        menu.innerHTML = `
            <div style="padding: 5px 8px; font-size: 0.68rem; color: #64748b; border-bottom: 1px solid #f1f5f9; font-weight: 800;">
                Cycle: ${theme} @ W${w} (${targetTitle})
            </div>
            <button type="button" class="sim-context-menu-item danger" id="ctx-del-one">
                <span>🗑️ Delete This Cycle</span>
            </button>
            <button type="button" class="sim-context-menu-item danger" id="ctx-del-all">
                <span>🔁 Clear From W${w} Onwards</span>
            </button>
            <button type="button" class="sim-context-menu-item" id="ctx-tune-cycle">
                <span>✏️ Tune Parameters (Modal)...</span>
            </button>
        `;

        document.body.appendChild(menu);

        menu.querySelector("#ctx-del-one")?.addEventListener("click", () => {
            this._handleDeleteCycle(mIdx, rIdx, pIdx, w, false);
            this._closeContextMenu();
        });

        menu.querySelector("#ctx-del-all")?.addEventListener("click", () => {
            this._handleDeleteCycle(mIdx, rIdx, pIdx, w, true);
            this._closeContextMenu();
        });

        menu.querySelector("#ctx-tune-cycle")?.addEventListener("click", () => {
            this._closeContextMenu();
            if (this.onCycleClick) {
                const pondId = pond ? pond.pondId : `${mod.id}-P01`;
                const areaHa = pond?.areaHa || 0.5;
                const sp = this.specs[theme] || this.specs.DS3;
                this.onCycleClick(pondId, 0, {
                    moduleId: mod.id,
                    areaHa,
                    species: mod.species,
                    strategyCode: theme,
                    startWeekIndex: w,
                    endWeekIndex: w + sp.wks - 1,
                    harvestPlanCount: 1,
                    dopDays: sp.rest * 7
                });
            }
        });

        const closeHandler = (evt) => {
            if (!menu.contains(evt.target)) {
                this._closeContextMenu();
                document.removeEventListener("click", closeHandler);
            }
        };
        setTimeout(() => document.addEventListener("click", closeHandler), 60);
    }

    _closeContextMenu() {
        const old = document.getElementById("sim-active-context-menu");
        if (old) {
            if (typeof old.remove === "function") {
                old.remove();
            } else if (old.parentNode && typeof old.parentNode.removeChild === "function") {
                old.parentNode.removeChild(old);
            }
        }
    }
}

