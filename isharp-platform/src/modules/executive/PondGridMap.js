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
import { resolveHybridPondState, POND_PROGRESS_STATES } from "../../domain/biometrics.js";
import { Toast } from "../../components/Toast.js";
import { getFarmMapShellHtml, renderPondTileHtml } from "./templates/pondGridCellTemplate.js";
import { getDrawerHtml, getDrawerSamplingHtml } from "./templates/pondDrawerTemplate.js";

const CACHE_KEY = "isharp_farm_map_cache_v3";
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
            progress: "ALL",     // ALL, CULTURE, READY, WATER_CULTURE, REPAIRED, CLEANED, CLEANING, IDLE
            species: "ALL",      // ALL, VAN, MON
            health: "ALL",       // ALL, RED, YELLOW, GREEN, IDLE
            stage: "ALL",        // ALL, EARLY, MID, FINISHING
            search: ""
        };

        this.progressCounts = {
            ALL: 216,
            CULTURE: 0,
            READY: 0,
            WATER_CULTURE: 0,
            REPAIRED: 0,
            CLEANED: 0,
            CLEANING: 0,
            IDLE: 0
        };

        this.activeCycleMap = new Map();     // normalized pond_code (e.g. "04.08.02") -> stocking record
        this.dailyProgressMap = new Map();   // normalized pond_code -> daily progress record
        this.issuesMap = new Map();          // pond_index -> array of issues
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
     * Mounts to #view-executive (or document.body) inside a dedicated, non-scrolling
     * viewport container (#exec-drawer-viewport) so that in mobile virtual landscape
     * (CSS rotated 270°/90°), the drawer is anchored directly to the user's visible
     * viewport rather than the top of the scrolling layout.
     */
    initDrawer() {
        const mountTarget = this.container.closest("#view-executive") || document.getElementById("view-executive") || document.body;

        let viewport = document.getElementById("exec-drawer-viewport");
        if (!viewport) {
            viewport = document.createElement("div");
            viewport.id = "exec-drawer-viewport";
            viewport.className = "exec-drawer-viewport";
            mountTarget.appendChild(viewport);
        } else if (viewport.parentElement !== mountTarget) {
            mountTarget.appendChild(viewport);
        }

        let backdrop = document.getElementById("pond-drawer-backdrop");
        if (!backdrop) {
            backdrop = document.createElement("div");
            backdrop.id = "pond-drawer-backdrop";
            backdrop.className = "pond-drawer-backdrop";
            viewport.appendChild(backdrop);
        } else if (backdrop.parentElement !== viewport) {
            viewport.appendChild(backdrop);
        }

        let drawer = document.getElementById("pond-detail-drawer");
        if (!drawer) {
            drawer = document.createElement("div");
            drawer.id = "pond-detail-drawer";
            drawer.className = "pond-detail-drawer";
            viewport.appendChild(drawer);
        } else if (drawer.parentElement !== viewport) {
            viewport.appendChild(drawer);
        }

        this.drawerViewport = viewport;
        this.drawerBackdrop = backdrop;
        this.drawer = drawer;

        backdrop.addEventListener("click", () => this.closeDrawer());

        // Keyboard accessibility: ESC key dismisses drawer
        window.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && this.drawer && this.drawer.classList.contains("open")) {
                this.closeDrawer();
            }
        });

        this.bindDrawerTouchScroll();
    }

    /**
     * Touch and gesture scrolling for pond detail drawer body in mobile virtual landscape.
     */
    bindDrawerTouchScroll() {
        if (!this.drawer) return;

        let isTouching = false;
        let lastX = 0;
        let lastY = 0;
        let lastTime = 0;
        let velocity = 0;
        let animId = null;

        const stopInertia = () => {
            if (animId) {
                cancelAnimationFrame(animId);
                animId = null;
            }
            velocity = 0;
        };

        this.drawer.addEventListener("touchstart", (e) => {
            if (e.touches.length !== 1) return;
            if (e.target.closest("button, a, input, select, textarea")) return;

            stopInertia();
            isTouching = true;
            lastX = e.touches[0].clientX;
            lastY = e.touches[0].clientY;
            lastTime = performance.now();
        }, { passive: true });

        this.drawer.addEventListener("touchmove", (e) => {
            if (!isTouching || e.touches.length !== 1) return;

            const isPortrait = window.innerHeight > window.innerWidth && window.innerWidth <= 768;
            if (!isPortrait) return;

            const bodyEl = this.drawer.querySelector(".drawer-body");
            if (!bodyEl) return;

            const curX = e.touches[0].clientX;
            const curY = e.touches[0].clientY;
            const curTime = performance.now();
            const dt = Math.max(curTime - lastTime, 8);

            const dx = curX - lastX;
            const dy = curY - lastY;

            // Virtual landscape (270° counter-clockwise):
            // Dragging along physical X axis maps directly to visual vertical scroll
            const deltaScroll = Math.abs(dx) >= Math.abs(dy) ? dx : -dy;

            if (deltaScroll !== 0) {
                bodyEl.scrollTop -= deltaScroll;
                velocity = deltaScroll / dt;
            }

            lastX = curX;
            lastY = curY;
            lastTime = curTime;
        }, { passive: true });

        const endTouch = () => {
            if (!isTouching) return;
            isTouching = false;

            const bodyEl = this.drawer.querySelector(".drawer-body");
            if (!bodyEl) return;

            if (Math.abs(velocity) > 0.08) {
                const runInertia = () => {
                    if (Math.abs(velocity) < 0.02) {
                        animId = null;
                        return;
                    }
                    bodyEl.scrollTop -= velocity * 16;
                    velocity *= 0.94;
                    animId = requestAnimationFrame(runInertia);
                };
                animId = requestAnimationFrame(runInertia);
            }
        };

        this.drawer.addEventListener("touchend", endTouch, { passive: true });
        this.drawer.addEventListener("touchcancel", endTouch, { passive: true });

        this.drawer.addEventListener("wheel", (e) => {
            const isPortrait = window.innerHeight > window.innerWidth && window.innerWidth <= 768;
            if (isPortrait) {
                const bodyEl = this.drawer.querySelector(".drawer-body");
                if (bodyEl) {
                    const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
                    if (delta) {
                        bodyEl.scrollTop += delta;
                    }
                }
            }
        }, { passive: true });
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

                // Smart Filter Auto-Reset Logic
                if (type === "progress") {
                    // Selecting non-Culture preparation stage: auto-reset Culture-specific filters
                    if (val !== "ALL" && val !== "CULTURE") {
                        this.resetCultureFilters();
                    }
                } else if (type === "species" || type === "stage" || (type === "health" && val !== "ALL" && val !== "IDLE")) {
                    // Selecting Culture-specific filters: auto-reset progress if on a preparation stage
                    if (this.filters.progress !== "ALL" && this.filters.progress !== "CULTURE") {
                        this.resetProgressFilter();
                    }
                }

                const group = btn.closest(".farm-filter-group");
                if (group) {
                    group.querySelectorAll(".farm-filter-btn").forEach(b => b.classList.remove("active"));
                    btn.classList.add("active");
                }

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
     * Resets species, stage, and pathogen health filters to ALL.
     */
    resetCultureFilters() {
        this.filters.species = "ALL";
        this.filters.stage = "ALL";
        if (this.filters.health !== "ALL" && this.filters.health !== "IDLE") {
            this.filters.health = "ALL";
        }

        ["species", "stage", "health"].forEach(type => {
            const group = this.container.querySelector(`.farm-filter-group#filter-group-${type}`);
            if (group) {
                group.querySelectorAll(".farm-filter-btn").forEach(b => {
                    const val = b.getAttribute("data-filter-val");
                    if (val === this.filters[type]) b.classList.add("active");
                    else b.classList.remove("active");
                });
            }
        });
    }

    /**
     * Resets Pond Progress filter to ALL.
     */
    resetProgressFilter() {
        this.filters.progress = "ALL";
        const group = this.container.querySelector(".farm-filter-group#filter-group-pond-progress");
        if (group) {
            group.querySelectorAll(".farm-filter-btn").forEach(b => {
                if (b.getAttribute("data-filter-val") === "ALL") b.classList.add("active");
                else b.classList.remove("active");
            });
        }
    }

    /**
     * Loads live farm telemetry, daily progress, and active cycles across all 9 modules from Supabase.
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
                            this.populateFromData(parsed.activeCycles, parsed.activePonds, parsed.issues, parsed.dailyProgress || []);
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

            // Batch fetch non-closed cycles, gatekeeper, issues, and daily progress
            const [activeCycles, activePonds, issues, dailyProgress] = await Promise.all([
                PondRepository.getActiveCycles(),
                PondRepository.getActiveOperationalPonds(),
                LabRepository.getAllRecentIssues(1000),
                PondRepository.getDailyPondProgress()
            ]);

            // Save to session cache
            try {
                sessionStorage.setItem(CACHE_KEY, JSON.stringify({
                    timestamp: Date.now(),
                    activeCycles,
                    activePonds,
                    issues,
                    dailyProgress
                }));
            } catch (e) {
                console.warn("Could not cache farm map state in sessionStorage", e);
            }

            this.populateFromData(activeCycles, activePonds, issues, dailyProgress);
            this.renderGrid();
            Toast.success("Farm biosecurity & daily progress map updated across all 9 modules.");
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
     * Ingests cycles, gatekeeper active ponds, issues, and daily progress into fast lookup tables.
     */
    populateFromData(cycles = [], activePonds = [], issues = [], dailyProgress = []) {
        this.activeCycleMap.clear();
        this.issuesMap.clear();
        this.dailyProgressMap.clear();

        // 1. Map issues by pond_index
        (issues || []).forEach(issue => {
            if (!issue.pond_index) return;
            const pIdx = String(issue.pond_index);
            if (!this.issuesMap.has(pIdx)) {
                this.issuesMap.set(pIdx, []);
            }
            this.issuesMap.get(pIdx).push(issue);
        });

        // 2. Map daily progress by normalized pond code
        (dailyProgress || []).forEach(dp => {
            const code = this.normalizePondCode(dp.pond);
            if (code) {
                this.dailyProgressMap.set(code, dp);
            }
        });

        // 3. Build set of active gatekeeper ponds
        const gatekeeperSet = new Set();
        (activePonds || []).forEach(p => {
            const norm = this.normalizePondCode(p.pond) || this.derivePondCode(p.pond_index);
            if (norm) gatekeeperSet.add(norm);
        });

        // 4. Map cycles by normalized pond code (e.g. "02.03.07")
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

        // Reset progress counters
        this.progressCounts = {
            ALL: 0,
            CULTURE: 0,
            READY: 0,
            WATER_CULTURE: 0,
            REPAIRED: 0,
            CLEANED: 0,
            CLEANING: 0,
            IDLE: 0
        };

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
        this.updateFilterCountBadges();
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

            // Accumulate progress stage counts
            this.progressCounts.ALL = (this.progressCounts.ALL || 0) + 1;
            const pKey = pondData.progressState || "IDLE";
            if (this.progressCounts[pKey] !== undefined) {
                this.progressCounts[pKey] += 1;
            } else {
                this.progressCounts.IDLE = (this.progressCounts.IDLE || 0) + 1;
            }

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

    /**
     * Resolves single source of truth pond state using Smart Hybrid reconciliation.
     * @param {string} pondCode 
     * @param {object|null} cycle 
     * @returns {object}
     */
    evaluatePondState(pondCode, cycle) {
        const dailyRecord = this.dailyProgressMap.get(pondCode) || null;
        const pondIssues = cycle ? (this.issuesMap.get(String(cycle.pond_index)) || []) : [];
        return resolveHybridPondState(pondCode, cycle, dailyRecord, pondIssues);
    }

    bindPondTileEvents() {
        const tiles = this.container.querySelectorAll(".pond-tile");
        tiles.forEach(tile => {
            tile.addEventListener("click", () => {
                if (window.__isDraggingExecMap) return;
                const pondCode = tile.getAttribute("data-pond");
                const pondIndex = tile.getAttribute("data-index");
                this.openDrawer(pondCode, pondIndex);
            });
        });
    }

    async openDrawer(pondCode, pondIndex) {
        if (!this.drawer || !this.drawerBackdrop) return;

        const cycle = this.activeCycleMap.get(pondCode);
        const dailyProgress = this.dailyProgressMap.get(pondCode) || null;
        const issues = pondIndex ? (this.issuesMap.get(String(pondIndex)) || []) : [];
        const pondData = this.evaluatePondState(pondCode, cycle);

        let idleDays = pondData.progressDays || 0;
        if (!pondData.isActive && !dailyProgress && cycle) {
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
            isProd: pondData.isActive,
            dailyProgress,
            pondData
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

        if (pondIndex && pondData.isActive) {
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

    /**
     * Updates live count numbers inside filter pill buttons.
     */
    updateFilterCountBadges() {
        const badges = this.container.querySelectorAll(".filter-count-badge[data-count-key]");
        badges.forEach(badge => {
            const key = badge.getAttribute("data-count-key");
            if (this.progressCounts && this.progressCounts[key] !== undefined) {
                badge.textContent = this.progressCounts[key];
            }
        });
    }

    updateHeaderKPIs(active, idle, red, yellow, green) {
        const elActive = document.getElementById("exec-kpi-active");
        if (elActive) {
            elActive.innerHTML = `${active} <span style="font-size: 0.9rem; color: #64748b; font-weight: 500;">/ 216</span>`;
        }

        const elIdle = document.getElementById("exec-kpi-idle");
        if (elIdle) {
            elIdle.innerHTML = `${idle} <span style="font-size: 0.9rem; color: #64748b; font-weight: 500;">Ponds</span>`;
            
            // Dynamic sub-text breaking down In Prep vs Idle
            const cardParent = elIdle.closest(".exec-kpi-card");
            if (cardParent) {
                const sub = cardParent.querySelector(".exec-kpi-sub");
                if (sub) {
                    const prepCount = (this.progressCounts.READY || 0) + 
                                      (this.progressCounts.WATER_CULTURE || 0) + 
                                      (this.progressCounts.REPAIRED || 0) + 
                                      (this.progressCounts.CLEANED || 0) + 
                                      (this.progressCounts.CLEANING || 0);
                    const ready = this.progressCounts.READY || 0;
                    const trueIdle = this.progressCounts.IDLE || 0;
                    sub.textContent = `${prepCount} In Prep (${ready} Ready) • ${trueIdle} Idle`;
                }
            }
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
            const pr = tile.getAttribute("data-progress");
            const sp = tile.getAttribute("data-species");
            const hl = tile.getAttribute("data-health");
            const st = tile.getAttribute("data-stage");
            const pd = tile.getAttribute("data-pond").toLowerCase();

            let match = true;

            if (this.filters.progress !== "ALL" && this.filters.progress !== pr) match = false;
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
