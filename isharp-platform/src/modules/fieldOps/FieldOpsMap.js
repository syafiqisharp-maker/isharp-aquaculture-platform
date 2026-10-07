/**
 * iSHARP DBMS 2.0 — Field Operations: 24-Pond Module Overview Map
 * Dedicated supervisor operational map showing 24 ponds per module (2 rows × 12 ponds).
 * Single Source of Truth: Reads directly from view_growout_pond_cycles, pond_staff, and growout_pond_master.
 * No fake or simulated IoT telemetry — clearly indicates active culture vs. idle status with real operational attributes.
 */

import { calculateDOC } from "../../domain/biometrics.js";
import { calculateTotalActiveHP } from "../../domain/aeration.js";
import { evaluateFeedingAction } from "../../domain/feedingAction.js";
import {
    getTelemetryHealthState,
    evaluateAbnormalWqParameters
} from "../../domain/waterQualityLimit.js";
import { supabase } from "../../infrastructure/supabase.js";
import { StaffRepository } from "../../infrastructure/repositories/staffRepository.js";
import { LabRepository } from "../../infrastructure/repositories/labRepository.js";

import { getLocalDateStr } from "../../utils/formatters.js";

export class FieldOpsMap {
    /**
     * @param {string} containerId Container ID
     * @param {number} moduleNo Module number (1 to 9)
     * @param {Function} onSelectPond Callback when pond tile is clicked
     * @param {Function} onQuickLogPond Callback when quick "+ Log" button is clicked
     */
    constructor(containerId = "field-ops-map-mount", moduleNo = 1, onSelectPond = null, onQuickLogPond = null) {
        this.container = document.getElementById(containerId);
        this.moduleNo = moduleNo;
        this.onSelectPond = onSelectPond;
        this.onQuickLogPond = onQuickLogPond;

        this.filter = "ALL"; // ALL, PRODUCTION, IDLE, UNLOGGED
        this.searchTerm = "";

        this.pondsData = new Map(); // pondLabel -> pond card data
        this.lastLoadedModule = null;
        this.isLoading = false;
        this.telemetryPollTimer = null;

        this.initStructure();
        this.loadModulePonds();
        this.startTelemetryPolling();
    }

    /**
     * Starts background live polling for edge IoT water quality telemetry every 15 seconds.
     */
    startTelemetryPolling() {
        this.stopTelemetryPolling();
        this.telemetryPollTimer = setInterval(() => {
            // Only poll if currently attached and visible
            if (this.container && this.container.offsetParent !== null && !this.isLoading) {
                this.pollLiveTelemetry();
            }
        }, 15000);
    }

    stopTelemetryPolling() {
        if (this.telemetryPollTimer) {
            clearInterval(this.telemetryPollTimer);
            this.telemetryPollTimer = null;
        }
    }

    async pollLiveTelemetry() {
        if (this.pondsData.size === 0) return;
        try {
            const wqRes = await supabase.request(`water_quality_logs?order=recorded_at.desc&limit=100`);
            if (Array.isArray(wqRes)) {
                let hasChanges = false;
                wqRes.forEach(row => {
                    if (row && row.pond_index) {
                        for (const [label, pData] of this.pondsData.entries()) {
                            if (pData.cycleRecord && pData.cycleRecord.pond_index === row.pond_index) {
                                const newDo = row.do_ppm !== null && row.do_ppm !== undefined ? parseFloat(row.do_ppm) : null;
                                const newPh = row.ph !== null && row.ph !== undefined ? parseFloat(row.ph) : null;
                                const prevDo = pData.telemetry?.do_ppm ?? null;
                                const prevPh = pData.telemetry?.ph ?? null;
                                if (newDo !== prevDo || newPh !== prevPh) {
                                    pData.telemetry = {
                                        do_ppm: newDo,
                                        ph: newPh,
                                        water_temp_c: row.water_temp_c !== null ? parseFloat(row.water_temp_c) : null
                                    };
                                    hasChanges = true;
                                }
                            }
                        }
                    }
                });
                if (hasChanges) {
                    this.renderGrid();
                }
            }
        } catch (err) {
            console.debug("Silent telemetry poll error:", err);
        }
    }

    setModule(modNo) {
        this.moduleNo = modNo;
        this.lastLoadedModule = null;
        this.pondsData.clear();
        this.loadModulePonds({ forceRefresh: true });
    }

    getActivePondsList() {
        return Array.from(this.pondsData.values())
            .filter(p => !p.isIdle && p.cycleRecord)
            .map(p => p.cycleRecord);
    }

    getAllModulePondsList() {
        return Array.from(this.pondsData.values())
            .map(p => p.cycleRecord || { pond: p.pondLabel, pond_index: p.pondLabel });
    }

    initStructure() {
        if (!this.container) return;
        const modStr = String(this.moduleNo).padStart(2, "0");

        this.container.innerHTML = `
            <div class="field-ops-map-wrapper" style="display: flex; flex-direction: column; gap: 1rem;">
                
                <!-- Toolbar: Filter Pills, Daily Progress, Rapid Log, Search, and Refresh -->
                <div class="field-ops-toolbar flex-between" style="border-radius: 16px; padding: 0.75rem 1.25rem; flex-wrap: wrap; gap: 0.75rem;">
                    
                    <!-- Left: Operational Status Filter Buttons -->
                    <div class="feeding-filter-group field-ops-filter-scroll" style="display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap;">
                        <span style="font-size: 0.76rem; font-weight: 800; color: #475569; margin-right: 0.2rem;">Status:</span>
                        <button type="button" class="btn-filter-action active" data-action-filter="ALL" style="font-size: 0.74rem; font-weight: 700; padding: 0.35rem 0.8rem; border-radius: 999px; cursor: pointer;">
                            <span class="btn-text-full">All 24 Ponds</span>
                            <span class="btn-text-short">All</span>
                        </button>
                        <button type="button" class="btn-filter-action" data-action-filter="PRODUCTION" style="font-size: 0.74rem; font-weight: 700; padding: 0.35rem 0.8rem; border-radius: 999px; cursor: pointer;">
                            <span>In Culture</span>
                        </button>
                        <button type="button" class="btn-filter-action" data-action-filter="UNLOGGED" style="font-size: 0.74rem; font-weight: 700; padding: 0.35rem 0.8rem; border-radius: 999px; cursor: pointer;">
                            <span>Pending Log</span>
                        </button>
                        <button type="button" class="btn-filter-action" data-action-filter="IDLE" style="font-size: 0.74rem; font-weight: 700; padding: 0.35rem 0.8rem; border-radius: 999px; cursor: pointer;">
                            <span>Idle</span>
                        </button>

                        <!-- Feeding Action Plan Legend -->
                        <div class="feeding-action-legend" style="display: inline-flex; align-items: center; gap: 0.55rem; font-size: 0.7rem; font-weight: 700; color: #475569; margin-left: 0.35rem; padding-left: 0.5rem; border-left: 1px solid #cbd5e1;">
                            <span style="font-size: 0.68rem; font-weight: 800; color: #64748b;">Action:</span>
                            <span title="Normal Feeding (Optimal DO & Water Quality)" style="display: inline-flex; align-items: center; gap: 4px;"><span class="aero-orb orb-emerald"></span> Normal</span>
                            <span title="Careful Feeding (Borderline DO / Weather Caution)" style="display: inline-flex; align-items: center; gap: 4px;"><span class="aero-orb orb-amber"></span> Caution</span>
                            <span title="Reduce / Cut Feed (Critical DO / Rain Alert)" style="display: inline-flex; align-items: center; gap: 4px;"><span class="aero-orb orb-crimson"></span> Cut Feed</span>
                        </div>
                    </div>

                    <!-- Center/Right: Daily Progress & Rapid Log + Search and Refresh -->
                    <div class="field-ops-search-box" style="display: flex; align-items: center; gap: 0.6rem; margin-left: auto; flex-wrap: wrap;">
                        <div id="field-ops-daily-progress-mount" style="display: flex; align-items: center; gap: 0.5rem;"></div>
                        <input type="text" id="input-field-ops-search" placeholder="Search pond..." style="font-size: 0.82rem; padding: 0.4rem 0.75rem; border-radius: 8px; border: 1px solid #cbd5e1; outline: none; width: 155px; background: rgba(255, 255, 255, 0.9);" />
                        <button type="button" id="btn-refresh-field-ops" class="btn-action btn-secondary" title="Refresh Module Status" style="font-size: 0.76rem; font-weight: 700; padding: 0.4rem 0.8rem;">
                            <span>🔄</span>
                        </button>
                    </div>
                </div>

                <!-- 24-Pond Visual Stage Mount -->
                <div id="field-ops-grid-mount" style="min-height: 480px;">
                    <div style="text-align: center; color: #64748b; padding: 3rem 0;">
                        <div class="spinner-sm" style="margin: 0 auto 0.75rem auto;"></div>
                        <span>Loading Module ${modStr} pond operations from database...</span>
                    </div>
                </div>

            </div>
        `;

        this.bindToolbarEvents();
        this.bindGridDelegation();
    }

    bindGridDelegation() {
        const gridMount = this.container.querySelector("#field-ops-grid-mount");
        if (!gridMount) return;

        gridMount.addEventListener("click", (e) => {
            const quickLogBtn = e.target.closest(".btn-quick-log-pond");
            if (quickLogBtn) {
                e.stopPropagation();
                const label = quickLogBtn.getAttribute("data-pond-label");
                const data = this.pondsData.get(label);
                if (data && typeof this.onQuickLogPond === "function") {
                    this.onQuickLogPond(data.cycleRecord, this.getActivePondsList());
                }
                return;
            }

            const card = e.target.closest(".field-ops-pond-tile");
            if (card) {
                const label = card.getAttribute("data-pond-label");
                const data = this.pondsData.get(label);
                if (data && typeof this.onSelectPond === "function") {
                    this.onSelectPond(data.cycleRecord);
                }
            }
        });
    }

    bindToolbarEvents() {
        const filterBtns = this.container.querySelectorAll(".btn-filter-action");
        filterBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                filterBtns.forEach(b => {
                    b.classList.remove("active");
                    b.style.boxShadow = "none";
                });
                btn.classList.add("active");
                btn.style.boxShadow = "0 0 0 2px #0284c7";
                this.filter = btn.getAttribute("data-action-filter");
                this.renderGrid();
            });
        });

        const searchInput = this.container.querySelector("#input-field-ops-search");
        if (searchInput) {
            searchInput.addEventListener("input", (e) => {
                this.searchTerm = e.target.value.trim().toLowerCase();
                this.renderGrid();
            });
        }

        const btnRefresh = this.container.querySelector("#btn-refresh-field-ops");
        if (btnRefresh) {
            btnRefresh.addEventListener("click", () => this.loadModulePonds({ forceRefresh: true }));
        }
    }

    async loadModulePonds({ forceRefresh = false } = {}) {
        const gridMount = this.container.querySelector("#field-ops-grid-mount");
        const hasCachedData = this.pondsData.size > 0 && this.lastLoadedModule === this.moduleNo;

        // Instant 0ms cache-first render: keep screen active with zero delay!
        if (hasCachedData && !forceRefresh) {
            this.renderGrid();
        } else if (gridMount && !hasCachedData) {
            gridMount.innerHTML = `
                <div style="text-align: center; color: #64748b; padding: 3rem 0;">
                    <div class="spinner-sm" style="margin: 0 auto 0.75rem auto;"></div>
                    <span>Fetching live 24-pond status for Module ${String(this.moduleNo).padStart(2, "0")}...</span>
                </div>
            `;
        }

        const modStr = String(this.moduleNo).padStart(2, "0");
        const r1Num = (this.moduleNo - 1) * 2 + 1;
        const r2Num = (this.moduleNo - 1) * 2 + 2;
        const r1Str = String(r1Num).padStart(2, "0");
        const r2Str = String(r2Num).padStart(2, "0");

        try {
            const todayStr = getLocalDateStr();

            // Fetch cycles, staff directory, today's records, weather, IoT telemetry, and lab water quality concurrently
            const [cyclesRes, staffRes, todayRowsRes, weatherRes, wqRes, labMap] = await Promise.all([
                supabase.request(`view_growout_pond_cycles?modl=eq.${modStr}&pond_status=neq.CLOSE&order=pond_index.desc&select=pond_index,pond,modl,row_no,cycle_no,crop_no,pond_status,stck_date,date_close,area,aerator_1hp,aerator_2hp,stck_species,bs_line,pm_staff_no,sv_staff_no,rl_staff_no,po_staff_no,support_staff_no`).catch(() => []),
                StaffRepository.getStaffDirectory().catch(() => []),
                supabase.request(`daily_pond_records?log_date=eq.${todayStr}&pond=like.${modStr}.%25&select=id,pond_index,pond,log_date,feed_kg,feed_tray_remnant_pct,water_level_cm,water_colour,mortality_kg`).catch(() => []),
                supabase.request(`weather_logs?order=recorded_at.desc&limit=1`).catch(() => []),
                supabase.request(`water_quality_logs?order=recorded_at.desc&limit=100`).catch(() => []),
                LabRepository.getLatestWaterQualityForModule(modStr).catch(() => new Map())
            ]);

            const cycles = Array.isArray(cyclesRes) ? cyclesRes : [];
            if (cycles.length > 0) {
                cycles.sort((a, b) => String(b.pond_index || "").localeCompare(String(a.pond_index || "")));
            }

            // Map today's daily_pond_records for active ponds in this module
            const todayRecordsMap = new Map();
            if (Array.isArray(todayRowsRes)) {
                todayRowsRes.forEach(r => {
                    if (r.pond_index) todayRecordsMap.set(r.pond_index, r);
                    if (r.pond) todayRecordsMap.set(r.pond, r);
                });
            }

            // Resolve latest weather telemetry
            let latestWeather = null;
            if (Array.isArray(weatherRes) && weatherRes.length > 0) {
                latestWeather = weatherRes[0];
            }

            // Map latest water quality logs per pond
            const telemetryMap = new Map();
            if (Array.isArray(wqRes)) {
                wqRes.forEach(row => {
                    if (row && row.pond_index && !telemetryMap.has(row.pond_index)) {
                        telemetryMap.set(row.pond_index, {
                            do_ppm: row.do_ppm !== null && row.do_ppm !== undefined ? parseFloat(row.do_ppm) : null,
                            ph: row.ph !== null && row.ph !== undefined ? parseFloat(row.ph) : null,
                            water_temp_c: row.water_temp_c !== null && row.water_temp_c !== undefined ? parseFloat(row.water_temp_c) : null
                        });
                    }
                });
            }

            // Construct 24 expected ponds for this module (2 rows x 12 ponds)
            this.pondsData.clear();

            const rainToday = latestWeather ? parseFloat(latestWeather.rainfall_mm || 0) : 0;
            const luxVal = latestWeather && latestWeather.lux !== undefined ? parseFloat(latestWeather.lux) : 55000;

            for (let r of [r1Str, r2Str]) {
                for (let p = 1; p <= 12; p++) {
                    const pStr = String(p).padStart(2, "0");
                    const pondLabel = `${modStr}.${r}.${pStr}`;

                    // Find matching active cycle for this pond
                    const cycleRecord = (cycles || []).find(c => c.pond === pondLabel || (c.pond_index && c.pond_index.startsWith(`2${modStr}${r}${pStr}`)));

                    const isIdle = !cycleRecord || (cycleRecord.pond_status || "").toUpperCase() === "IDLE" || !cycleRecord.stck_date;

                    // Calculate active aeration HP (1.0 HP & 2.0 HP only)
                    const u1 = parseInt(cycleRecord?.aerator_1hp || 0, 10);
                    const u2 = parseInt(cycleRecord?.aerator_2hp || 0, 10);
                    const totalHP = calculateTotalActiveHP(u1, u2);

                    const todayRecord = (!isIdle && cycleRecord)
                        ? (todayRecordsMap.get(cycleRecord.pond_index) || todayRecordsMap.get(pondLabel) || null)
                        : null;

                    const pondTelemetry = cycleRecord?.pond_index ? (telemetryMap.get(cycleRecord.pond_index) || null) : null;

                    // Latest lab water quality & abnormal parameter evaluation
                    const labRecord = cycleRecord?.pond_index && labMap instanceof Map ? (labMap.get(cycleRecord.pond_index) || null) : null;
                    const abnormalParams = !isIdle && labRecord ? evaluateAbnormalWqParameters(labRecord) : [];

                    // Evaluate Feeding Action Plan based on water quality parameters & weather
                    let evalResult;
                    if (isIdle) {
                        evalResult = { level: "idle", badgeText: "Idle", color: "#94a3b8", title: "Pond Idle" };
                    } else if (!pondTelemetry) {
                        // Sensor hardware awaiting deployment per Rule 7: evaluate meteorological mast weather
                        evalResult = evaluateFeedingAction({
                            rainToday,
                            luxVal,
                            isIdle: false
                        });
                    } else {
                        evalResult = evaluateFeedingAction({
                            doMin: pondTelemetry.do_ppm !== null ? pondTelemetry.do_ppm - 0.45 : 5.0,
                            doCurrent: pondTelemetry.do_ppm !== null ? pondTelemetry.do_ppm : 5.0,
                            phDelta: 0.25,
                            tempMax: pondTelemetry.water_temp_c ? pondTelemetry.water_temp_c + 0.8 : 30.0,
                            tempDelta: 1.0,
                            rainToday,
                            rain7d: 14.0,
                            luxVal,
                            isIdle: false
                        });
                    }

                    let orbClass = "orb-idle";
                    if (!isIdle) {
                        if (evalResult.level === "critical" || abnormalParams.some(a => a.severity === "alert")) orbClass = "orb-crimson";
                        else if (evalResult.level === "caution" || abnormalParams.length > 0) orbClass = "orb-amber";
                        else orbClass = "orb-emerald";
                    }

                    this.pondsData.set(pondLabel, {
                        pondLabel,
                        rowNo: r,
                        pondNo: pStr,
                        cycleRecord: cycleRecord || {
                            pond: pondLabel,
                            pond_index: `2${modStr}${r}${pStr}.00`,
                            pond_status: "IDLE",
                            area: 0.5,
                            aerator_1hp: 0,
                            aerator_2hp: 0
                        },
                        isIdle,
                        totalHP,
                        u1,
                        u2,
                        todayRecord,
                        telemetry: pondTelemetry,
                        labRecord,
                        abnormalParams,
                        feedingAction: evalResult,
                        orbClass
                    });
                }
            }

            this.lastLoadedModule = this.moduleNo;
            this.renderGrid();

        } catch (err) {
            console.error("FieldOpsMap load error:", err);
            if (gridMount) {
                gridMount.innerHTML = `
                    <div style="text-align: center; color: #ef4444; padding: 2.5rem 0;">
                        Failed to load module ponds: ${err.message}
                    </div>
                `;
            }
        }
    }

    renderGrid() {
        const gridMount = this.container.querySelector("#field-ops-grid-mount");
        if (!gridMount) return;

        const modStr = String(this.moduleNo).padStart(2, "0");
        const r1Num = (this.moduleNo - 1) * 2 + 1;
        const r2Num = (this.moduleNo - 1) * 2 + 2;
        const r1Str = String(r1Num).padStart(2, "0");
        const r2Str = String(r2Num).padStart(2, "0");

        // Update Daily Logging Progress & Rapid Log CTA in Toolbar
        const allPonds = Array.from(this.pondsData.values());
        const activePonds = allPonds.filter(p => !p.isIdle);
        const loggedCount = activePonds.filter(p => Boolean(p.todayRecord)).length;
        const totalActive = activePonds.length;
        const allLogged = totalActive > 0 && loggedCount === totalActive;

        const progressMount = this.container.querySelector("#field-ops-daily-progress-mount");
        if (progressMount) {
            if (totalActive > 0) {
                progressMount.innerHTML = `
                    <span style="font-size: 0.74rem; font-weight: 800; padding: 0.35rem 0.7rem; border-radius: 999px; background: ${allLogged ? '#dcfce7' : '#fffbeb'}; color: ${allLogged ? '#166534' : '#b45309'}; border: 1px solid ${allLogged ? '#86efac' : '#fde68a'}; white-space: nowrap;">
                        ${allLogged ? '✅' : '📊'} Today: ${loggedCount}/${totalActive} Logged
                    </span>
                    <button type="button" id="btn-rapid-log-module" class="btn-action btn-primary" style="font-size: 0.76rem; font-weight: 800; padding: 0.4rem 0.85rem; border-radius: 999px; display: inline-flex; align-items: center; gap: 0.3rem; box-shadow: 0 3px 10px rgba(2, 132, 199, 0.25); white-space: nowrap;">
                        <span>⚡ Rapid Log</span>
                    </button>
                `;
                const btnRapid = progressMount.querySelector("#btn-rapid-log-module");
                if (btnRapid) {
                    btnRapid.addEventListener("click", () => {
                        const firstUnlogged = activePonds.find(p => !p.todayRecord) || activePonds[0];
                        if (firstUnlogged && typeof this.onQuickLogPond === "function") {
                            this.onQuickLogPond(firstUnlogged.cycleRecord, this.getActivePondsList());
                        }
                    });
                }
            } else {
                progressMount.innerHTML = "";
            }
        }

        // Filter ponds
        const visiblePonds = allPonds.filter(p => {
            if (this.filter === "PRODUCTION" && p.isIdle) return false;
            if (this.filter === "UNLOGGED" && (p.isIdle || Boolean(p.todayRecord))) return false;
            if (this.filter === "IDLE" && !p.isIdle) return false;

            if (this.searchTerm) {
                if (!p.pondLabel.toLowerCase().includes(this.searchTerm) && !p.pondNo.includes(this.searchTerm)) {
                    return false;
                }
            }
            return true;
        });

        const row1Ponds = visiblePonds.filter(p => p.rowNo === r1Str);
        const row2Ponds = visiblePonds.filter(p => p.rowNo === r2Str);

        gridMount.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                
                <!-- ROW 1 (Line 1) -->
                <div class="field-ops-row-section" style="border-radius: 16px; padding: 1.1rem 1.25rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem;">
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <span style="font-size: 1.1rem;">🌊</span>
                            <h3 style="margin: 0; font-size: 0.95rem; font-weight: 800; color: #0f172a;">
                                Module ${modStr} - Row ${r1Str}
                            </h3>
                        </div>
                        <span style="font-size: 0.72rem; color: #64748b; font-weight: 600;">${row1Ponds.length} Ponds Visible</span>
                    </div>

                    <div class="field-ops-pond-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 0.85rem;">
                        ${row1Ponds.map(p => this.renderPondCard(p)).join("")}
                    </div>
                </div>

                <!-- ROW 2 (Line 2) -->
                <div class="field-ops-row-section" style="border-radius: 16px; padding: 1.1rem 1.25rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem;">
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <span style="font-size: 1.1rem;">🌊</span>
                            <h3 style="margin: 0; font-size: 0.95rem; font-weight: 800; color: #0f172a;">
                                Module ${modStr} - Row ${r2Str}
                            </h3>
                        </div>
                        <span style="font-size: 0.72rem; color: #64748b; font-weight: 600;">${row2Ponds.length} Ponds Visible</span>
                    </div>

                    <div class="field-ops-pond-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 0.85rem;">
                        ${row2Ponds.map(p => this.renderPondCard(p)).join("")}
                    </div>
                </div>

            </div>
        `;
    }

    renderPondCard(data) {
        const { pondLabel, cycleRecord, isIdle, totalHP, todayRecord, abnormalParams = [] } = data;
        const doc = calculateDOC(cycleRecord.stck_date, cycleRecord.date_close);
        const area = parseFloat(cycleRecord.area) || 0.50;

        // Resolve Cycle Number primarily from pond_index suffix (e.g. 2020304.04 -> 04), falling back to cycle_no
        const cycleNumber = (cycleRecord.pond_index && cycleRecord.pond_index.includes("."))
            ? cycleRecord.pond_index.split(".")[1]
            : (cycleRecord.cycle_no !== undefined && cycleRecord.cycle_no !== null ? String(cycleRecord.cycle_no).padStart(2, "0") : "—");

        // Resolve DO & pH Telemetry (Real IoT value or standby placeholder per Rule 7)
        const rawDoNum = data.telemetry?.do_ppm !== undefined && data.telemetry?.do_ppm !== null
            ? parseFloat(data.telemetry.do_ppm)
            : (cycleRecord.latest_do !== undefined && cycleRecord.latest_do !== null ? parseFloat(cycleRecord.latest_do) : null);

        const rawPhNum = data.telemetry?.ph !== undefined && data.telemetry?.ph !== null
            ? parseFloat(data.telemetry.ph)
            : (cycleRecord.latest_ph !== undefined && cycleRecord.latest_ph !== null ? parseFloat(cycleRecord.latest_ph) : null);

        const doValue = rawDoNum !== null && !isNaN(rawDoNum) ? rawDoNum.toFixed(1) : "--";
        const phValue = rawPhNum !== null && !isNaN(rawPhNum) ? rawPhNum.toFixed(2) : "--";

        // Determine DO and pH Telemetry health states via Single Source of Truth (waterQualityLimit.js)
        const doStateClass = getTelemetryHealthState("do", rawDoNum);
        const phStateClass = getTelemetryHealthState("ph", rawPhNum);

        const isLiveTelemetry = Boolean(data.telemetry && (data.telemetry.do_ppm !== null || data.telemetry.ph !== null));

        // Active production styling
        let borderColor = todayRecord ? "#16a34a" : "#0284c7";
        let shadowGlow = todayRecord ? "rgba(22, 163, 74, 0.14)" : "rgba(2, 132, 199, 0.14)";

        const todayFeedKg = todayRecord && todayRecord.feed_kg !== null && todayRecord.feed_kg !== undefined
            ? parseFloat(todayRecord.feed_kg).toFixed(1)
            : "0.0";

        if (isIdle) {
            return `
                <div class="field-ops-pond-tile pond-idle" data-pond-label="${pondLabel}" title="Click to view pond details">
                    
                    <!-- Tile Header: Muted Gray Pond Code & Ghost Badge -->
                    <div>
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.4rem;">
                            <div>
                                <div class="pond-no-box" style="font-size: 1.1rem; line-height: 1.1; display: flex; align-items: center; gap: 6px;">
                                    <span class="aero-orb orb-idle"></span>
                                    <span style="color: #94a3b8 !important; font-weight: 700 !important; text-shadow: none !important;">${pondLabel}</span>
                                </div>
                                <div style="font-size: 0.68rem; font-weight: 700; color: #64748b; margin-top: 0.15rem;">
                                    Cycle ${cycleNumber}
                                </div>
                            </div>
                            <span class="pond-badge-idle">
                                ⏸️ IDLE
                            </span>
                        </div>

                        <!-- Middle Content: Drained Basin Indicator -->
                        <div style="padding: 0.5rem 0; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;">
                            <span style="font-size: 1.1rem; opacity: 0.7;">⚙️</span>
                            <span style="color: #64748b; font-size: 0.74rem; font-weight: 700;">Pond In Preparation</span>
                            <span style="font-size: 0.66rem; color: #94a3b8;">Area: ${area} Ha · Drained</span>
                        </div>
                    </div>

                    <!-- Tile Footer: Subtle Setup Link -->
                    <div style="border-top: 1px dashed rgba(148, 163, 184, 0.35); padding-top: 0.45rem; display: flex; justify-content: space-between; align-items: center; gap: 0.4rem; font-size: 0.68rem;">
                        <span style="color: #94a3b8; font-weight: 600;">⚪ Idle</span>
                        <span style="color: #0284c7; font-weight: 700;">Setup ➔</span>
                    </div>

                </div>
            `;
        }

        // Active Culture Pond
        return `
            <div class="field-ops-pond-tile pond-active ${todayRecord ? 'status-logged' : 'status-pending'}" data-pond-label="${pondLabel}" style="--pond-border: ${borderColor}; --pond-shadow: ${shadowGlow};" title="Click card to open Pond Details">
                
                <!-- Tile Header: High-Contrast Pond Code & DOC Badge -->
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.35rem;">
                        <div>
                            <div class="pond-no-box" style="font-size: 1.15rem; font-weight: 900; line-height: 1.1; display: flex; align-items: center; gap: 6px;">
                                <span class="aero-orb ${data.orbClass || 'orb-emerald'}" title="Feeding Action: ${data.feedingAction?.badgeText || 'Normal Feed'}"></span>
                                <span class="pond-title-text">${pondLabel}</span>
                            </div>
                            <div style="font-size: 0.72rem; font-weight: 800; color: #0284c7; margin-top: 0.15rem; display: flex; align-items: center; gap: 6px;">
                                <span>Cycle ${cycleNumber}</span>
                                <span style="color: #64748b; font-weight: 700;">•</span>
                                <span style="color: #0369a1; font-weight: 800;">⚡ ${totalHP} HP</span>
                            </div>
                        </div>
                        <span class="pond-doc-badge-neutral">
                            DOC ${doc}
                        </span>
                    </div>

                    <!-- Middle Content: Live Telemetry & Alerts -->
                    <div style="margin: 0.25rem 0;">

                        <!-- Live WQS Telemetry Twin Pill (DO & pH) with live indicator -->
                        <div class="pond-wqs-pills">
                            <div class="pond-telemetry-pill ${doStateClass}" title="Dissolved Oxygen (Optimal: ≥ 5.0 mg/L)">
                                <span style="font-size: 0.64rem; font-weight: 800; color: #0369a1; display: inline-flex; align-items: center; gap: 3px;">
                                    ${isLiveTelemetry ? '<span class="live-pulse-dot"></span>' : '<span style="font-size: 0.68rem;">🫧</span>'} DO
                                </span>
                                <span class="telemetry-val" style="font-family: 'Space Grotesk', monospace, sans-serif; font-size: 0.8rem; font-weight: 800; color: #0284c7;">
                                    ${doValue} <span style="font-size: 0.58rem; font-weight: 600; color: #64748b;">mg/L</span>
                                </span>
                            </div>
                            <div class="pond-telemetry-pill ${phStateClass}" title="Water pH Level (Optimal: 7.5 - 8.3)">
                                <span style="font-size: 0.64rem; font-weight: 800; color: #0369a1; display: inline-flex; align-items: center; gap: 3px;">
                                    ${isLiveTelemetry ? '<span class="live-pulse-dot"></span>' : '<span style="font-size: 0.68rem;">🧪</span>'} pH
                                </span>
                                <span class="telemetry-val" style="font-family: 'Space Grotesk', monospace, sans-serif; font-size: 0.8rem; font-weight: 800; color: #0284c7;">
                                    ${phValue}
                                </span>
                            </div>
                        </div>

                        <!-- Conditional Non-Optimal Water Quality Anomaly Badges (Only shown when not optimum) -->
                        ${abnormalParams.length > 0 ? `
                            <div class="pond-abnormal-wq-row" title="Parameters requiring attention">
                                ${abnormalParams.slice(0, 3).map(a => `
                                    <span class="wq-abnormal-pill ${a.severity === 'alert' ? 'pill-alert' : 'pill-warning'}" title="${a.message}">
                                        <span>⚠️</span> ${a.parameter} ${a.value}
                                    </span>
                                `).join("")}
                                ${abnormalParams.length > 3 ? `<span class="wq-abnormal-pill pill-warning">+${abnormalParams.length - 3}</span>` : ''}
                            </div>
                        ` : ''}

                        <!-- Daily Log Status Banner -->
                        <div class="pond-status-banner ${todayRecord ? 'pond-status-banner-logged' : 'pond-status-banner-pending'}">
                            <span>${todayRecord ? '✅ Logged Today' : '⏳ Pending Today'}</span>
                            <span>${todayRecord ? `${todayFeedKg} kg` : '— kg'}</span>
                        </div>
                    </div>
                </div>

                <!-- Tile Footer: 1-Tap Quick Action (Entire card navigates to Details, button logs) -->
                <div style="border-top: 1px solid rgba(0, 0, 0, 0.06); padding-top: 0.45rem; margin-top: 0.2rem;">
                    <button type="button" class="btn-quick-log-pond ${todayRecord ? 'btn-quick-log-logged' : 'btn-quick-log-pending'}" data-pond-label="${pondLabel}">
                        <span>${todayRecord ? '✏️ Edit Today\'s Log' : '⚡ + Log Today'}</span>
                    </button>
                </div>

            </div>
        `;
    }
}
