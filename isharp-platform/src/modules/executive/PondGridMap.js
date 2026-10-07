/**
 * iSHARP DBMS 2.0 — 216-Pond Interactive Farm Grid Map
 * Executive Biosecurity, Pathogen Surveillance, and Culture Stage Visualization
 * Setiu Farm (9 Modules × 2 Rows × 12 Ponds = 216 Ponds)
 * 
 * Clean Coding Standard: Controller delegates markup to dedicated templates.
 */

import { PondRepository } from "../../infrastructure/repositories/pondRepository.js";
import { LabRepository } from "../../infrastructure/repositories/labRepository.js";
import { SamplingRepository } from "../../infrastructure/repositories/samplingRepository.js";
import { appState } from "../../state/appState.js";
import { calculateDOC } from "../../domain/biometrics.js";
import { Toast } from "../../components/Toast.js";
import { getFarmMapShellHtml, renderPondTileHtml } from "./templates/pondGridCellTemplate.js";
import { getDrawerHtml, getDrawerSamplingHtml } from "./templates/pondDrawerTemplate.js";

const CACHE_KEY = "isharp_farm_map_cache_v2";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5-minute session cache

export class PondGridMap {
    /**
     * @param {string} [containerId="exec-map-container"]
     */
    constructor(containerId = "exec-map-container") {
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        // Internal State
        this.filters = {
            species: "ALL",      // ALL, VAN, MON
            health: "ALL",       // ALL, RED, YELLOW, GREEN, IDLE
            stage: "ALL",        // ALL, EARLY, MID, FINISHING
            search: ""
        };

        this.activeCycleMap = new Map(); // normalized pond_code (e.g. "04.08.02") -> stocking record
        this.issuesMap = new Map();      // pond_index -> array of issues
        this.selectedPond = null;
        this.isLoading = false;

        this.initStructure();
        this.initDrawer();
        this.bindEvents();
        this.loadData();
    }

    /**
     * Initialize static container layout (Toolbar + Grid Mount).
     */
    initStructure() {
        this.container.innerHTML = getFarmMapShellHtml();

        this.dom = {
            gridMount: document.getElementById("farm-grid-mount"),
            searchInput: document.getElementById("map-pond-search"),
            btnRefresh: document.getElementById("btn-map-refresh")
        };
    }

    /**
     * Initializes slide-out detail drawer DOM element.
     */
    initDrawer() {
        let backdrop = document.getElementById("pond-drawer-backdrop");
        if (!backdrop) {
            backdrop = document.createElement("div");
            backdrop.id = "pond-drawer-backdrop";
            backdrop.className = "pond-drawer-backdrop";
            document.body.appendChild(backdrop);
        }

        let drawer = document.getElementById("pond-detail-drawer");
        if (!drawer) {
            drawer = document.createElement("div");
            drawer.id = "pond-detail-drawer";
            drawer.className = "pond-detail-drawer";
            document.body.appendChild(drawer);
        }

        this.drawerBackdrop = backdrop;
        this.drawer = drawer;

        backdrop.addEventListener("click", () => this.closeDrawer());
    }

    /**
     * Event Listeners for Filters, Search, and Refresh.
     */
    bindEvents() {
        // Filter Buttons
        this.container.addEventListener("click", (e) => {
            const btn = e.target.closest(".farm-filter-btn[data-filter-type]");
            if (btn) {
                const type = btn.getAttribute("data-filter-type");
                const val = btn.getAttribute("data-filter-val");

                const group = btn.closest(".farm-filter-group");
                group.querySelectorAll(".farm-filter-btn").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");

                this.filters[type] = val;
                this.applyFilters();
            }
        });

        // Search Input
        if (this.dom.searchInput) {
            this.dom.searchInput.addEventListener("input", (e) => {
                this.filters.search = e.target.value.trim().toLowerCase();
                this.applyFilters();
            });
        }

        // Refresh Button
        if (this.dom.btnRefresh) {
            this.dom.btnRefresh.addEventListener("click", () => {
                this.loadData(true);
            });
        }
    }

    /**
     * Loads live farm telemetry and active cycles across all 9 modules from Supabase.
     * @param {boolean} forceRefresh 
     */
    async loadData(forceRefresh = false) {
        if (this.isLoading) return;
        this.isLoading = true;

        if (this.dom.btnRefresh) {
            this.dom.btnRefresh.innerHTML = "<span>⏳ Syncing...</span>";
            this.dom.btnRefresh.disabled = true;
        }

        try {
            // Check session cache if not forced
            if (!forceRefresh) {
                const cached = sessionStorage.getItem(CACHE_KEY);
                if (cached) {
                    try {
                        const parsed = JSON.parse(cached);
                        if (Date.now() - parsed.timestamp < CACHE_TTL_MS) {
                            this.populateFromData(parsed.activeCycles, parsed.activePonds, parsed.issues);
                            this.renderGrid();
                            this.isLoading = false;
                            if (this.dom.btnRefresh) {
                                this.dom.btnRefresh.innerHTML = "<span>🔄 Refresh</span>";
                                this.dom.btnRefresh.disabled = false;
                            }
                            return;
                        }
                    } catch (e) {
                        sessionStorage.removeItem(CACHE_KEY);
                    }
                }
            }

            // Batch fetch non-closed cycles, gatekeeper, and issues
            const [activeCycles, activePonds, issues] = await Promise.all([
                PondRepository.getActiveCycles(),
                PondRepository.getActiveOperationalPonds(),
                LabRepository.getAllRecentIssues(1000)
            ]);

            // Save to session cache
            try {
                sessionStorage.setItem(CACHE_KEY, JSON.stringify({
                    timestamp: Date.now(),
                    activeCycles,
                    activePonds,
                    issues
                }));
            } catch (e) {
                console.warn("Could not cache farm map state in sessionStorage", e);
            }

            this.populateFromData(activeCycles, activePonds, issues);
            this.renderGrid();
            Toast.success("Farm biosecurity map updated across all 9 modules.");
        } catch (err) {
            console.error("Error loading farm map data:", err);
            Toast.error("Failed to sync farm map data. Using cached snapshot.");
        } finally {
            this.isLoading = false;
            if (this.dom.btnRefresh) {
                this.dom.btnRefresh.innerHTML = "<span>🔄 Refresh</span>";
                this.dom.btnRefresh.disabled = false;
            }
        }
    }

    /**
     * Ingests cycles, gatekeeper active ponds, and issues into fast lookup tables.
     */
    populateFromData(cycles = [], activePonds = [], issues = []) {
        this.activeCycleMap.clear();
        this.issuesMap.clear();

        // 1. Map issues by pond_index
        (issues || []).forEach(issue => {
            if (!issue.pond_index) return;
            const pIdx = String(issue.pond_index);
            if (!this.issuesMap.has(pIdx)) {
                this.issuesMap.set(pIdx, []);
            }
            this.issuesMap.get(pIdx).push(issue);
        });

        // 2. Build set of active gatekeeper ponds
        const gatekeeperSet = new Set();
        (activePonds || []).forEach(p => {
            const norm = this.normalizePondCode(p.pond) || this.derivePondCode(p.pond_index);
            if (norm) gatekeeperSet.add(norm);
        });

        // 3. Map cycles by normalized pond code (e.g. "02.03.07")
        (cycles || []).forEach(cycle => {
            let code = this.normalizePondCode(cycle.pond);
            if (!code && cycle.pond_index) {
                code = this.derivePondCode(cycle.pond_index);
            }
            if (!code) return;

            const isGatekeeper = gatekeeperSet.has(code);
            const isProd = (cycle.pond_status || "").toUpperCase() === "PRODUCTION";

            if (!this.activeCycleMap.has(code) || isGatekeeper || isProd) {
                this.activeCycleMap.set(code, cycle);
            }
        });
    }

    normalizePondCode(code) {
        if (!code) return "";
        const parts = String(code).trim().split(".");
        if (parts.length === 3) {
            return `${parts[0].padStart(2, "0")}.${parts[1].padStart(2, "0")}.${parts[2].padStart(2, "0")}`;
        }
        return String(code).trim();
    }

    derivePondCode(pondIndex) {
        if (!pondIndex || String(pondIndex).trim().length < 7) return "";
        const clean = String(pondIndex).trim();
        const m = clean.substring(1, 3);
        const r = clean.substring(3, 5);
        const p = clean.substring(5, 7);
        return `${m}.${r}.${p}`;
    }

    /**
     * Generates the 216-pond matrix and renders into DOM.
     */
    renderGrid() {
        if (!this.dom.gridMount) return;

        let html = "";
        let redCount = 0;
        let yellowCount = 0;
        let greenCount = 0;
        let activeCount = 0;
        let idleCount = 0;

        // Loop through 9 Modules
        for (let m = 1; m <= 9; m++) {
            const modStr = String(m).padStart(2, "0");
            const r1 = (m * 2) - 1;
            const r2 = m * 2;
            const r1Str = String(r1).padStart(2, "0");
            const r2Str = String(r2).padStart(2, "0");

            html += `
                <div class="farm-module-block" data-module="${modStr}">
                    <div class="farm-module-header">
                        <div class="farm-module-name">
                            <span>Module ${modStr}</span>
                        </div>
                    </div>

                    <!-- Row 1 -->
                    <div class="farm-row-container">
                        <div class="farm-row-label">R${r1Str}</div>
                        <div class="farm-row-ponds">
                            ${this.renderRowPonds(modStr, r1Str, (stats) => {
                                redCount += stats.red;
                                yellowCount += stats.yellow;
                                greenCount += stats.green;
                                activeCount += stats.active;
                                idleCount += stats.idle;
                            })}
                        </div>
                    </div>

                    <!-- Row 2 -->
                    <div class="farm-row-container">
                        <div class="farm-row-label">R${r2Str}</div>
                        <div class="farm-row-ponds">
                            ${this.renderRowPonds(modStr, r2Str, (stats) => {
                                redCount += stats.red;
                                yellowCount += stats.yellow;
                                greenCount += stats.green;
                                activeCount += stats.active;
                                idleCount += stats.idle;
                            })}
                        </div>
                    </div>
                </div>
            `;
        }

        this.dom.gridMount.innerHTML = html;
        this.bindPondTileEvents();
        this.updateHeaderKPIs(activeCount, idleCount, redCount, yellowCount, greenCount);
        this.applyFilters();
    }

    renderRowPonds(modStr, rowStr, statCallback) {
        let cells = "";
        let red = 0, yellow = 0, green = 0, active = 0, idle = 0;

        for (let p = 1; p <= 12; p++) {
            const pStr = String(p).padStart(2, "0");
            const pondCode = `${modStr}.${rowStr}.${pStr}`;
            const cycle = this.activeCycleMap.get(pondCode);

            const pondData = this.evaluatePondState(pondCode, cycle);

            if (pondData.health === "RED") red++;
            else if (pondData.health === "YELLOW") yellow++;
            else if (pondData.health === "GREEN") green++;

            if (pondData.isActive) active++;
            else idle++;

            cells += renderPondTileHtml(pondData, pStr);
        }

        if (statCallback) statCallback({ red, yellow, green, active, idle });
        return cells;
    }

    evaluatePondState(pondCode, cycle) {
        if (!cycle) {
            return {
                pondCode,
                pondIndex: "",
                isActive: false,
                doc: 0,
                docDisplay: "—",
                speciesCode: "IDLE",
                speciesLabel: "IDLE",
                speciesBadgeClass: "sp-idle",
                health: "IDLE",
                healthDescription: "Idle / Preparation Pond",
                stageCode: "IDLE",
                cssClass: "risk-idle"
            };
        }

        const isProd = (cycle.pond_status || "").toUpperCase() === "PRODUCTION";
        const doc = cycle.stck_date ? calculateDOC(cycle.stck_date, cycle.date_close) : 0;
        
        let idleDays = 0;
        if (!isProd) {
            if (cycle.date_cycle) {
                const start = new Date(cycle.date_cycle);
                if (!isNaN(start.getTime())) {
                    idleDays = Math.max(0, Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24)));
                }
            } else if (cycle.idle_days) {
                idleDays = parseInt(cycle.idle_days, 10) || 0;
            }
        }

        const rawSpecies = (cycle.species || cycle.stck_species || "").toUpperCase();
        let speciesCode = "VAN";
        let speciesLabel = "VAN";
        let speciesBadgeClass = "sp-van";

        if (rawSpecies.includes("MON") || rawSpecies.includes("BLACK") || rawSpecies.includes("TIGER")) {
            speciesCode = "MON";
            speciesLabel = "MON";
            speciesBadgeClass = "sp-mon";
        }

        let stageCode = "EARLY";
        if (doc >= 30 && doc <= 70) stageCode = "MID";
        else if (doc > 70) stageCode = "FINISHING";

        // Biosecurity determination
        let health = "GREEN";
        let healthDesc = "Clean Biosecurity";
        let cssClass = "risk-green";

        if (!isProd) {
            health = "IDLE";
            healthDesc = `Idle / Preparation (${idleDays} days)`;
            speciesCode = "IDLE";
            speciesLabel = "IDLE";
            speciesBadgeClass = "sp-idle";
            cssClass = (idleDays > 30) ? "risk-idle idle-overdue" : "risk-idle";
        } else {
            const pondIssues = this.issuesMap.get(String(cycle.pond_index)) || [];
            const hasRed = pondIssues.some(i => (i.issue_flag || "").toUpperCase() === "RED" || (i.pcr_result || "").toUpperCase() === "POSITIVE");
            const hasYellow = pondIssues.some(i => (i.issue_flag || "").toUpperCase() === "YELLOW");

            if (hasRed) {
                health = "RED";
                healthDesc = "Red Alert: Active Pathogen Detected";
                cssClass = "risk-red";
            } else if (hasYellow) {
                health = "YELLOW";
                healthDesc = "Warning: Monitored Symptoms";
                cssClass = "risk-yellow";
            }
        }

        return {
            pondCode,
            pondIndex: cycle.pond_index,
            isActive: isProd,
            doc,
            docDisplay: isProd ? `${doc}` : `${idleDays}d`,
            speciesCode,
            speciesLabel,
            speciesBadgeClass,
            health,
            healthDescription: healthDesc,
            stageCode: isProd ? stageCode : "IDLE",
            cssClass,
            idleDays
        };
    }

    bindPondTileEvents() {
        const tiles = this.container.querySelectorAll(".pond-tile");
        tiles.forEach(tile => {
            tile.addEventListener("click", () => {
                const pondCode = tile.getAttribute("data-pond");
                const pondIndex = tile.getAttribute("data-index");
                this.openDrawer(pondCode, pondIndex);
            });
        });
    }

    async openDrawer(pondCode, pondIndex) {
        if (!this.drawer || !this.drawerBackdrop) return;

        const cycle = this.activeCycleMap.get(pondCode);
        const issues = pondIndex ? (this.issuesMap.get(String(pondIndex)) || []) : [];
        const isProd = cycle && (cycle.pond_status || "").toUpperCase() === "PRODUCTION";

        let idleDays = 0;
        if (cycle && !isProd) {
            if (cycle.date_cycle) {
                const start = new Date(cycle.date_cycle);
                if (!isNaN(start.getTime())) {
                    idleDays = Math.max(0, Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24)));
                }
            } else if (cycle.idle_days) {
                idleDays = parseInt(cycle.idle_days, 10) || 0;
            }
        }

        this.drawer.innerHTML = getDrawerHtml({
            pondCode,
            cycle,
            issues,
            idleDays,
            isProd
        });

        // Slide Drawer Open
        this.drawerBackdrop.classList.add("open");
        this.drawer.classList.add("open");

        const btnClose = this.drawer.querySelector("#btn-close-drawer");
        if (btnClose) btnClose.addEventListener("click", () => this.closeDrawer());

        const btnDbms = this.drawer.querySelector("#btn-drawer-to-dbms");
        if (btnDbms && cycle) {
            btnDbms.addEventListener("click", () => {
                this.closeDrawer();
                appState.setCurrentPond(cycle);
                window.location.hash = "#/dbms";
            });
        }

        if (pondIndex) {
            this.loadDrawerSampling(pondIndex, cycle);
        }
    }

    async loadDrawerSampling(pondIndex, cycle) {
        const container = document.getElementById("drawer-sampling-container");
        if (!container) return;

        try {
            const latest = await SamplingRepository.getLatestSampling(pondIndex);
            container.innerHTML = getDrawerSamplingHtml(latest, cycle);
        } catch (err) {
            container.innerHTML = `<div style="font-size: 0.76rem; color: #ef4444;">Could not load sampling records.</div>`;
        }
    }

    closeDrawer() {
        if (this.drawerBackdrop) this.drawerBackdrop.classList.remove("open");
        if (this.drawer) this.drawer.classList.remove("open");
    }

    updateHeaderKPIs(active, idle, red, yellow, green) {
        const elActive = document.getElementById("exec-kpi-active");
        if (elActive) {
            elActive.innerHTML = `${active} <span style="font-size: 0.9rem; color: #64748b; font-weight: 500;">/ 216</span>`;
        }

        const elIdle = document.getElementById("exec-kpi-idle");
        if (elIdle) {
            elIdle.innerHTML = `${idle} <span style="font-size: 0.9rem; color: #64748b; font-weight: 500;">Ponds</span>`;
        }

        const elHealth = document.getElementById("exec-kpi-health");
        if (elHealth) {
            if (red > 0) {
                elHealth.innerHTML = `<span style="color: #ef4444;">${red} Red Alerts</span>`;
            } else if (yellow > 0) {
                elHealth.innerHTML = `<span style="color: #d97706;">${yellow} Warnings</span>`;
            } else {
                elHealth.innerHTML = `<span style="color: #10b981;">All Clean</span>`;
            }
        }
    }

    applyFilters() {
        const tiles = this.container.querySelectorAll(".pond-tile");

        tiles.forEach(tile => {
            const sp = tile.getAttribute("data-species");
            const hl = tile.getAttribute("data-health");
            const st = tile.getAttribute("data-stage");
            const pd = tile.getAttribute("data-pond").toLowerCase();

            let match = true;

            if (this.filters.species !== "ALL" && this.filters.species !== sp) match = false;
            if (this.filters.health !== "ALL" && this.filters.health !== hl) match = false;
            if (this.filters.stage !== "ALL" && this.filters.stage !== st) match = false;
            if (this.filters.search && !pd.includes(this.filters.search)) match = false;

            if (match) {
                tile.classList.remove("dimmed");
            } else {
                tile.classList.add("dimmed");
            }
        });
    }
}
