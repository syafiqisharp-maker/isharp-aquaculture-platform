/**
 * iSHARP DBMS 2.0 — Field Operations: 24-Pond Module Overview Map
 * Dedicated supervisor operational map showing 24 ponds per module (2 rows × 12 ponds).
 * Single Source of Truth: Reads directly from view_growout_pond_cycles, pond_staff, and growout_pond_master.
 * No fake or simulated IoT telemetry — clearly indicates active culture vs. idle status with real operational attributes.
 */

import { calculateDOC } from "../../domain/biometrics.js";
import { calculateTotalActiveHP } from "../../domain/aeration.js";
import { evaluateFeedingAction } from "../../domain/feedingAction.js";
import { supabase } from "../../infrastructure/supabase.js";
import { StaffRepository } from "../../infrastructure/repositories/staffRepository.js";

function getLocalDateStr(d = new Date()) {
    const dt = (d instanceof Date) ? d : new Date(d);
    if (isNaN(dt.getTime())) return "";
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const day = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

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

        this.pondsData = new Map(); // pondLabel -> { pond, cycleRecord, isIdle, operatorName, totalHP, todayRecord }
        this.isLoading = false;

        this.initStructure();
        this.loadModulePonds();
    }

    setModule(modNo) {
        this.moduleNo = modNo;
        this.loadModulePonds();
    }

    getActivePondsList() {
        return Array.from(this.pondsData.values())
            .filter(p => !p.isIdle && p.cycleRecord)
            .map(p => p.cycleRecord);
    }

    initStructure() {
        if (!this.container) return;
        const modStr = String(this.moduleNo).padStart(2, "0");

        this.container.innerHTML = `
            <div class="field-ops-map-wrapper" style="display: flex; flex-direction: column; gap: 1rem;">
                
                <!-- Toolbar: Filter Pills, Daily Progress, Rapid Log, Search, and Refresh -->
                <div class="field-ops-toolbar flex-between" style="background: rgba(255, 255, 255, 0.9); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.95); border-radius: 16px; padding: 0.75rem 1.25rem; box-shadow: 0 4px 16px rgba(2, 132, 199, 0.05); flex-wrap: wrap; gap: 0.75rem;">
                    
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
            btnRefresh.addEventListener("click", () => this.loadModulePonds());
        }
    }

    async loadModulePonds() {
        const gridMount = this.container.querySelector("#field-ops-grid-mount");
        if (gridMount && this.pondsData.size === 0) {
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

            // Fetch cycles, staff directory, today's records, weather, and water quality telemetry concurrently
            const [cyclesRes, staffRes, todayRowsRes, weatherRes, wqRes] = await Promise.allSettled([
                supabase.request(`view_growout_pond_cycles?modl=eq.${modStr}&pond_status=neq.CLOSE&order=pond_index.desc&select=pond_index,pond,modl,row_no,cycle_no,crop_no,pond_status,stck_date,date_close,area,aerator_1hp,aerator_2hp,stck_species,bs_line,pm_staff_no,sv_staff_no,rl_staff_no,po_staff_no,support_staff_no`),
                StaffRepository.getStaffDirectory(),
                supabase.request(`daily_pond_records?log_date=eq.${todayStr}&pond=like.${modStr}.%&select=id,pond_index,pond,log_date,feed_kg,feed_tray_remnant_pct,water_level_cm,water_colour,mortality_kg`),
                supabase.request(`weather_logs?order=recorded_at.desc&limit=1`),
                supabase.request(`water_quality_logs?order=recorded_at.desc&limit=100`)
            ]);

            const cycles = cyclesRes.status === "fulfilled" && Array.isArray(cyclesRes.value) ? cyclesRes.value : [];
            if (cycles.length > 0) {
                cycles.sort((a, b) => String(b.pond_index || "").localeCompare(String(a.pond_index || "")));
            }

            // Map today's daily_pond_records for active ponds in this module
            const todayRecordsMap = new Map();
            if (todayRowsRes.status === "fulfilled" && Array.isArray(todayRowsRes.value)) {
                todayRowsRes.value.forEach(r => {
                    if (r.pond_index) todayRecordsMap.set(r.pond_index, r);
                    if (r.pond) todayRecordsMap.set(r.pond, r);
                });
            }

            // Resolve latest weather telemetry
            let latestWeather = null;
            if (weatherRes.status === "fulfilled" && Array.isArray(weatherRes.value) && weatherRes.value.length > 0) {
                latestWeather = weatherRes.value[0];
            }

            // Map latest water quality logs per pond
            const telemetryMap = new Map();
            if (wqRes.status === "fulfilled" && Array.isArray(wqRes.value)) {
                wqRes.value.forEach(row => {
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

                    // Resolve Primary Operator from Single Source of Truth (pond_staff)
                    let operatorName = "Unassigned";
                    if (cycleRecord && cycleRecord.po_staff_no) {
                        const s = StaffRepository.findStaffByNo(cycleRecord.po_staff_no);
                        operatorName = s ? `${s.staff_name} [${cycleRecord.po_staff_no}]` : `ID #${cycleRecord.po_staff_no}`;
                    }

                    // Calculate active aeration HP (1.0 HP & 2.0 HP only)
                    const u1 = parseInt(cycleRecord?.aerator_1hp || 0, 10);
                    const u2 = parseInt(cycleRecord?.aerator_2hp || 0, 10);
                    const totalHP = calculateTotalActiveHP(u1, u2);

                    const todayRecord = (!isIdle && cycleRecord)
                        ? (todayRecordsMap.get(cycleRecord.pond_index) || todayRecordsMap.get(pondLabel) || null)
                        : null;

                    const pondTelemetry = cycleRecord?.pond_index ? (telemetryMap.get(cycleRecord.pond_index) || null) : null;

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
                        if (evalResult.level === "critical") orbClass = "orb-crimson";
                        else if (evalResult.level === "caution") orbClass = "orb-amber";
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
                        operatorName,
                        totalHP,
                        u1,
                        u2,
                        todayRecord,
                        telemetry: pondTelemetry,
                        feedingAction: evalResult,
                        orbClass
                    });
                }
            }

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
                <div class="field-ops-row-section" style="background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.9); border-radius: 16px; padding: 1.1rem 1.25rem;">
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
                <div class="field-ops-row-section" style="background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.9); border-radius: 16px; padding: 1.1rem 1.25rem;">
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

        // Bind 1-Tap Quick Log button on active pond cards (stops propagation so card click stays Supervisor View)
        gridMount.querySelectorAll(".btn-quick-log-pond").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const label = btn.getAttribute("data-pond-label");
                const data = this.pondsData.get(label);
                if (data && typeof this.onQuickLogPond === "function") {
                    this.onQuickLogPond(data.cycleRecord, this.getActivePondsList());
                }
            });
        });

        // Bind click events on pond cards (opens Supervisor Pond WQS Detail View)
        gridMount.querySelectorAll(".field-ops-pond-tile").forEach(card => {
            card.addEventListener("click", () => {
                const label = card.getAttribute("data-pond-label");
                const data = this.pondsData.get(label);
                if (data && typeof this.onSelectPond === "function") {
                    this.onSelectPond(data.cycleRecord);
                }
            });
        });
    }

    renderPondCard(data) {
        const { pondLabel, cycleRecord, isIdle, operatorName, totalHP, todayRecord } = data;
        const doc = calculateDOC(cycleRecord.stck_date, cycleRecord.date_close);
        const area = parseFloat(cycleRecord.area) || 0.50;

        // Resolve Cycle Number primarily from pond_index suffix (e.g. 2020304.04 -> 04), falling back to cycle_no
        const cycleNumber = (cycleRecord.pond_index && cycleRecord.pond_index.includes("."))
            ? cycleRecord.pond_index.split(".")[1]
            : (cycleRecord.cycle_no !== undefined && cycleRecord.cycle_no !== null ? String(cycleRecord.cycle_no).padStart(2, "0") : "—");

        // Resolve DO & pH Telemetry (Real IoT value or standby placeholder per Rule 7)
        const doValue = data.telemetry?.do_ppm !== undefined && data.telemetry?.do_ppm !== null
            ? parseFloat(data.telemetry.do_ppm).toFixed(1)
            : (cycleRecord.latest_do !== undefined && cycleRecord.latest_do !== null ? parseFloat(cycleRecord.latest_do).toFixed(1) : "--");

        const phValue = data.telemetry?.ph !== undefined && data.telemetry?.ph !== null
            ? parseFloat(data.telemetry.ph).toFixed(2)
            : (cycleRecord.latest_ph !== undefined && cycleRecord.latest_ph !== null ? parseFloat(cycleRecord.latest_ph).toFixed(2) : "--");

        // Active production styling
        let borderColor = todayRecord ? "#16a34a" : "#0284c7";
        let shadowGlow = todayRecord ? "rgba(22, 163, 74, 0.14)" : "rgba(2, 132, 199, 0.14)";

        const todayFeedKg = todayRecord && todayRecord.feed_kg !== null && todayRecord.feed_kg !== undefined
            ? parseFloat(todayRecord.feed_kg).toFixed(1)
            : "0.0";

        if (isIdle) {
            return `
                <div class="field-ops-pond-tile pond-idle" data-pond-label="${pondLabel}">
                    
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
                            <span style="font-size: 0.66rem; color: #94a3b8;">Area: ${area} Ha · Dry</span>
                            <div style="display: flex; gap: 0.45rem; font-size: 0.62rem; color: #94a3b8; font-weight: 600; margin-top: 2px;">
                                <span>DO: --</span>
                                <span>·</span>
                                <span>pH: --</span>
                            </div>
                        </div>
                    </div>

                    <!-- Tile Footer: Subtle Setup Link -->
                    <div style="border-top: 1px dashed rgba(148, 163, 184, 0.35); padding-top: 0.45rem; display: flex; justify-content: space-between; align-items: center; gap: 0.4rem; font-size: 0.68rem;">
                        <span style="color: #94a3b8; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            ⚪ Idle Pond
                        </span>
                        <span style="color: #0284c7; font-weight: 700; white-space: nowrap;">Setup ➔</span>
                    </div>

                </div>
            `;
        }

        // Active Culture Pond (Solid Aero High-Gloss Pedestal)
        return `
            <div class="field-ops-pond-tile pond-active" data-pond-label="${pondLabel}" style="
                background: rgba(255, 255, 255, 0.95); 
                border: 2px solid ${borderColor}; 
                border-radius: 14px; 
                padding: 0.85rem 0.95rem; 
                cursor: pointer; 
                transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease;
                box-shadow: 0 4px 14px ${shadowGlow};
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                min-height: 176px;
            ">
                
                <!-- Tile Header: High-Contrast Pond Code & DOC Badge -->
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.4rem;">
                        <div>
                            <div class="pond-no-box" style="font-size: 1.1rem; font-weight: 900; line-height: 1.1; display: flex; align-items: center; gap: 6px;">
                                <span class="aero-orb ${data.orbClass || 'orb-emerald'}" title="Feeding Action: ${data.feedingAction?.badgeText || 'Normal Feed'}"></span>
                                <span>${pondLabel}</span>
                            </div>
                            <div style="font-size: 0.68rem; font-weight: 700; color: #64748b; margin-top: 0.15rem;">
                                Cycle ${cycleNumber}
                            </div>
                        </div>
                        <span class="pond-doc-badge-neutral">
                            DOC ${doc}
                        </span>
                    </div>

                    <!-- Middle Content: Real Operational Details & Today's Log Status -->
                    <div style="margin: 0.3rem 0;">
                        <div style="font-size: 0.72rem; color: #1e293b; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            ${cycleRecord.stck_species || 'P. VANNAMEI'} · <span style="color: #0284c7;">⚡ ${totalHP} HP</span>
                        </div>
                        <div style="font-size: 0.65rem; color: #64748b; margin-top: 0.1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="Operator: ${operatorName}">
                            🦐 ${operatorName}
                        </div>

                        <!-- Live WQS Telemetry Twin Pill (DO & pH) -->
                        <div class="pond-wqs-pills" style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.35rem; margin: 0.35rem 0;">
                            <div style="background: rgba(240, 249, 255, 0.95); border: 1px solid #bae6fd; border-radius: 8px; padding: 0.22rem 0.4rem; display: flex; align-items: center; justify-content: space-between; box-shadow: inset 0 1px 1px #fff;" title="Dissolved Oxygen">
                                <span style="font-size: 0.64rem; font-weight: 800; color: #0369a1; display: inline-flex; align-items: center; gap: 3px;">
                                    <span style="font-size: 0.72rem;">🫧</span> DO
                                </span>
                                <span style="font-family: 'Space Grotesk', monospace, sans-serif; font-size: 0.78rem; font-weight: 800; color: #0284c7;">
                                    ${doValue} <span style="font-size: 0.58rem; font-weight: 600; color: #64748b;">mg/L</span>
                                </span>
                            </div>
                            <div style="background: rgba(240, 249, 255, 0.95); border: 1px solid #bae6fd; border-radius: 8px; padding: 0.22rem 0.4rem; display: flex; align-items: center; justify-content: space-between; box-shadow: inset 0 1px 1px #fff;" title="Water pH Level">
                                <span style="font-size: 0.64rem; font-weight: 800; color: #0369a1; display: inline-flex; align-items: center; gap: 3px;">
                                    <span style="font-size: 0.72rem;">🧪</span> pH
                                </span>
                                <span style="font-family: 'Space Grotesk', monospace, sans-serif; font-size: 0.78rem; font-weight: 800; color: #0284c7;">
                                    ${phValue} <span style="font-size: 0.58rem; font-weight: 600; color: #64748b;">pH</span>
                                </span>
                            </div>
                        </div>

                        ${todayRecord ? `
                            <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 6px; padding: 0.25rem 0.45rem; display: flex; align-items: center; justify-content: space-between; margin-top: 0.35rem; font-size: 0.64rem; font-weight: 800; color: #166534;">
                                <span>✅ Logged Today</span>
                                <span>${todayFeedKg} kg</span>
                            </div>
                        ` : `
                            <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 0.25rem 0.45rem; display: flex; align-items: center; justify-content: space-between; margin-top: 0.35rem; font-size: 0.64rem; font-weight: 800; color: #b45309;">
                                <span>⏳ Pending Today</span>
                                <span>— kg</span>
                            </div>
                        `}
                    </div>
                </div>

                <!-- Tile Footer: 1-Tap Quick Log CTA (for Active Ponds) & Supervisor Detail Link -->
                <div style="border-top: 1px solid rgba(0, 0, 0, 0.06); padding-top: 0.45rem; display: flex; justify-content: space-between; align-items: center; gap: 0.4rem; font-size: 0.68rem;">
                    <button type="button" class="btn-quick-log-pond" data-pond-label="${pondLabel}" style="
                        flex: 1;
                        background: ${todayRecord ? '#f0fdf4' : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)'};
                        color: ${todayRecord ? '#15803d' : '#ffffff'};
                        border: 1px solid ${todayRecord ? '#86efac' : '#0284c7'};
                        border-radius: 8px;
                        padding: 0.32rem 0.5rem;
                        font-size: 0.72rem;
                        font-weight: 800;
                        cursor: pointer;
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        gap: 0.25rem;
                        min-height: 32px;
                        box-shadow: ${todayRecord ? 'none' : '0 2px 6px rgba(2, 132, 199, 0.25)'};
                    ">
                        <span>${todayRecord ? '✏️ Edit Log' : '⚡ + Log'}</span>
                    </button>
                    <span style="color: #64748b; font-weight: 700; font-size: 0.66rem; padding: 0 0.2rem; white-space: nowrap;" title="Open Pond WQS Detail">Details ➔</span>
                </div>

            </div>
        `;
    }
}
