/**
 * iSHARP DBMS 2.0 — Telaga Putat Hatchery (TPH)
 * 64-Tank Interactive Matrix Map & Maturation Block Controller
 * Faithfully mirrors physical hatchery layout: Blocks D, C, Artemia Room, B, A
 */

import { HatcheryRepository } from "../../infrastructure/repositories/hatcheryRepository.js";
import { escapeHtml } from "../../utils/formatters.js";
import { Toast } from "../../components/Toast.js";

export class HatcheryTankMap {
    constructor(containerEl, onNavigate) {
        this.container = containerEl;
        this.onNavigate = onNavigate; // callback (route) => void
        this.tanks = [];
        this.matBlockA = null;
        this.matBlockB = null;

        this.filterBlock = "ALL";
        this.filterStatus = "ALL";
        this.searchQuery = "";

        this.selectedTankCode = null;
        this.tankDetailData = null;
        this.activeDrawerTab = "overview"; // 'overview' | 'events' | 'ponds' | 'lab'
    }

    async init() {
        this.renderLoading();
        await this.loadData();
        this.render();
    }

    async loadData() {
        try {
            const [tankList, blockA, blockB] = await Promise.all([
                HatcheryRepository.getTankMap(),
                HatcheryRepository.getActiveMaturationBlock("A"),
                HatcheryRepository.getActiveMaturationBlock("B")
            ]);

            this.tanks = tankList;
            this.matBlockA = blockA;
            this.matBlockB = blockB;
        } catch (err) {
            console.error("Failed to load hatchery map data:", err);
            Toast.error("Failed to load Hatchery tank telemetry.");
        }
    }

    renderLoading() {
        if (!this.container) return;
        this.container.innerHTML = `
            <div class="hatchery-loading-state">
                <div class="hatchery-loading-spinner"></div>
                <p>Loading Telaga Putat Hatchery live tank telemetry...</p>
            </div>
        `;
    }

    render() {
        if (!this.container) return;

        // Metrics calculation
        const activeRuns = this.tanks.filter(t => t.run_status === "CULTURE");
        const harvestedRuns = this.tanks.filter(t => t.run_status === "HARVESTED");
        const flushedRuns = this.tanks.filter(t => t.run_status === "FLUSHED");
        const totalActiveNauplii = activeRuns.reduce((sum, t) => sum + (Number(t.nauplii_stocked_k) || 0), 0);

        this.container.innerHTML = `
            <div class="hatchery-dashboard">
                <!-- 1. Top Command Header -->
                <header class="hatchery-header">
                    <div class="hatchery-title-group">
                        <div class="hatchery-icon-badge">🌊</div>
                        <div>
                            <div class="hatchery-subtitle-row">
                                <span class="hatchery-badge-pill">TPH / SHT</span>
                                <span class="hatchery-badge-pill secondary">64 PL TANKS + 2 MAT BLOCKS</span>
                            </div>
                            <h1 class="hatchery-title">Telaga Putat Hatchery (TPH) — Command Center</h1>
                        </div>
                    </div>

                    <div class="hatchery-action-toolbar">
                        <button class="hatchery-nav-btn primary" id="btn-to-pl-report" title="Open PL Harvest & Production Breakdown">
                            <span class="btn-icon">🌊</span>
                            <span>PL Harvest Report</span>
                        </button>
                        <button class="hatchery-nav-btn accent" id="btn-to-broodstock-report" title="Open Broodstock & Maturation Performance">
                            <span class="btn-icon">🦐</span>
                            <span>Broodstock Report</span>
                        </button>
                        <button class="hatchery-nav-btn portal-back" id="btn-hatchery-to-portal" title="Return to Portal Hub">
                            <span class="btn-icon">⬅</span>
                            <span>Back to Portal</span>
                        </button>
                    </div>
                </header>

                <!-- 2. Live KPI Telemetry Bento -->
                <section class="hatchery-kpi-bento">
                    <div class="kpi-card-glass kpi-cyan">
                        <div class="kpi-icon-orbit">🧪</div>
                        <div class="kpi-body">
                            <span class="kpi-label">Active Culture Tanks</span>
                            <span class="kpi-value">${activeRuns.length} <small>/ 64</small></span>
                            <span class="kpi-caption">${totalActiveNauplii.toLocaleString(undefined, { maximumFractionDigits: 0 })}k nauplii currently in culture</span>
                        </div>
                    </div>

                    <div class="kpi-card-glass kpi-blue">
                        <div class="kpi-icon-orbit">📦</div>
                        <div class="kpi-body">
                            <span class="kpi-label">Recently Harvested Tanks</span>
                            <span class="kpi-value">${harvestedRuns.length}</span>
                            <span class="kpi-caption">Ready for pond stocking or harvest</span>
                        </div>
                    </div>

                    <div class="kpi-card-glass kpi-amber">
                        <div class="kpi-icon-orbit">⚠️</div>
                        <div class="kpi-body">
                            <span class="kpi-label">Flushed / Terminated</span>
                            <span class="kpi-value">${flushedRuns.length}</span>
                            <span class="kpi-caption">Zoea syndrome, overstock or discard</span>
                        </div>
                    </div>

                    <div class="kpi-card-glass kpi-purple">
                        <div class="kpi-icon-orbit">🧬</div>
                        <div class="kpi-body">
                            <span class="kpi-label">Maturation Spawning Blocks</span>
                            <span class="kpi-value">A &amp; B</span>
                            <span class="kpi-caption">Active broodstock holding &amp; nauplii supply</span>
                        </div>
                    </div>
                </section>

                <!-- 3. Maturation Blocks A & B Overview (Decision 20: Display HR-A only) -->
                <section class="hatchery-maturation-section">
                    <div class="maturation-block-card block-a">
                        <div class="mat-card-header">
                            <div class="mat-badge">BLOCK A</div>
                            <h3 class="mat-title">Maturation Block A (SHA)</h3>
                            <span class="mat-status-pill ${this.matBlockA ? 'live' : 'idle'}">
                                ${this.matBlockA ? '● ACTIVE SPAWNING' : '○ IDLE'}
                            </span>
                        </div>
                        <div class="mat-card-grid">
                            <div class="mat-stat">
                                <span class="mat-stat-label">Active Batch</span>
                                <span class="mat-stat-val highlight">${escapeHtml(this.matBlockA?.batch_code || 'S1/2026')}</span>
                            </div>
                            <div class="mat-stat">
                                <span class="mat-stat-label">Broodstock DOC</span>
                                <span class="mat-stat-val">${this.matBlockA?.doc !== null && this.matBlockA?.doc !== undefined ? 'DOC ' + this.matBlockA.doc : 'N/A'}</span>
                            </div>
                            <div class="mat-stat">
                                <span class="mat-stat-label">Hatching Rate (HR-A)</span>
                                <span class="mat-stat-val hr-val">${this.matBlockA?.hr_a_pct !== null && this.matBlockA?.hr_a_pct !== undefined ? this.matBlockA.hr_a_pct + '%' : 'N/A'}</span>
                            </div>
                            <div class="mat-stat">
                                <span class="mat-stat-label">Nauplii Gross</span>
                                <span class="mat-stat-val">${this.matBlockA?.nauplii_gross_k ? Number(this.matBlockA.nauplii_gross_k).toLocaleString() + 'k' : 'N/A'}</span>
                            </div>
                        </div>
                    </div>

                    <div class="maturation-block-card block-b">
                        <div class="mat-card-header">
                            <div class="mat-badge">BLOCK B</div>
                            <h3 class="mat-title">Maturation Block B (SHB)</h3>
                            <span class="mat-status-pill ${this.matBlockB ? 'live' : 'idle'}">
                                ${this.matBlockB ? '● ACTIVE SPAWNING' : '○ IDLE'}
                            </span>
                        </div>
                        <div class="mat-card-grid">
                            <div class="mat-stat">
                                <span class="mat-stat-label">Active Batch</span>
                                <span class="mat-stat-val highlight">${escapeHtml(this.matBlockB?.batch_code || 'STL 1/2026')}</span>
                            </div>
                            <div class="mat-stat">
                                <span class="mat-stat-label">Broodstock DOC</span>
                                <span class="mat-stat-val">${this.matBlockB?.doc !== null && this.matBlockB?.doc !== undefined ? 'DOC ' + this.matBlockB.doc : 'N/A'}</span>
                            </div>
                            <div class="mat-stat">
                                <span class="mat-stat-label">Hatching Rate (HR-A)</span>
                                <span class="mat-stat-val hr-val">${this.matBlockB?.hr_a_pct !== null && this.matBlockB?.hr_a_pct !== undefined ? this.matBlockB.hr_a_pct + '%' : 'N/A'}</span>
                            </div>
                            <div class="mat-stat">
                                <span class="mat-stat-label">Nauplii Gross</span>
                                <span class="mat-stat-val">${this.matBlockB?.nauplii_gross_k ? Number(this.matBlockB.nauplii_gross_k).toLocaleString() + 'k' : 'N/A'}</span>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- 4. Interactive Filters & Search -->
                <div class="hatchery-controls-bar">
                    <div class="filter-group">
                        <label for="filter-block-select" class="filter-label">Block:</label>
                        <select id="filter-block-select" class="hatchery-select">
                            <option value="ALL" ${this.filterBlock === 'ALL' ? 'selected' : ''}>All Blocks (64 Tanks)</option>
                            <option value="D" ${this.filterBlock === 'D' ? 'selected' : ''}>Block D (D01–D16)</option>
                            <option value="C" ${this.filterBlock === 'C' ? 'selected' : ''}>Block C (C01–C16)</option>
                            <option value="B" ${this.filterBlock === 'B' ? 'selected' : ''}>Block B (B01–B16)</option>
                            <option value="A" ${this.filterBlock === 'A' ? 'selected' : ''}>Block A (A01–A16)</option>
                        </select>
                    </div>

                    <div class="filter-group">
                        <label for="filter-status-select" class="filter-label">Status:</label>
                        <select id="filter-status-select" class="hatchery-select">
                            <option value="ALL" ${this.filterStatus === 'ALL' ? 'selected' : ''}>All Statuses</option>
                            <option value="CULTURE" ${this.filterStatus === 'CULTURE' ? 'selected' : ''}>Culture Only (Active)</option>
                            <option value="HARVESTED" ${this.filterStatus === 'HARVESTED' ? 'selected' : ''}>Harvested</option>
                            <option value="FLUSHED" ${this.filterStatus === 'FLUSHED' ? 'selected' : ''}>Flushed</option>
                        </select>
                    </div>

                    <div class="search-group">
                        <input 
                            type="search" 
                            id="hatchery-tank-search" 
                            class="hatchery-search-input" 
                            placeholder="🔍 Search tank code (e.g. A01, B12)..." 
                            value="${escapeHtml(this.searchQuery)}"
                        />
                    </div>

                    <div class="legend-group">
                        <span class="legend-item"><span class="legend-dot dot-culture"></span> Culture</span>
                        <span class="legend-item"><span class="legend-dot dot-harvested"></span> Harvested</span>
                        <span class="legend-item"><span class="legend-dot dot-flushed"></span> Flushed</span>
                        <span class="legend-item"><span class="legend-dot dot-idle"></span> Idle</span>
                    </div>
                </div>

                <!-- 5. 64-Tank Matrix Layout (Mirrors Physical Facility Map) -->
                <main class="hatchery-matrix-stage">
                    ${this.renderBlock('D')}
                    ${this.renderBlock('C')}

                    <!-- Central Artemia Preparation Facility -->
                    <div class="hatchery-facility-room">
                        <div class="facility-signboard">
                            <span class="facility-icon">🏺</span>
                            <span class="facility-title">ARTEMIA ROOM</span>
                            <span class="facility-subtag">Central Live Feed &amp; Nauplii Hydration Corridor</span>
                        </div>
                    </div>

                    ${this.renderBlock('B')}
                    ${this.renderBlock('A')}
                </main>

                <!-- 6. Interactive Tank Detail Drawer / Modal -->
                <div id="hatchery-drawer" class="hatchery-drawer-backdrop hidden">
                    <div class="hatchery-drawer-panel" id="hatchery-drawer-content">
                        <!-- Content rendered dynamically via openTankDrawer -->
                    </div>
                </div>
            </div>
        `;

        this.bindEvents();
    }

    renderBlock(blockLetter) {
        if (this.filterBlock !== "ALL" && this.filterBlock !== blockLetter) {
            return "";
        }

        const blockTanks = this.tanks.filter(t => t.block === blockLetter);

        // Physical layout rules:
        // Top row: 09 to 16 (left to right)
        // Bottom row: 08 down to 01 (left to right)
        const topRowTanks = [];
        for (let i = 9; i <= 16; i++) {
            const t = blockTanks.find(item => item.tank_no === i);
            if (t && this.matchesFilter(t)) topRowTanks.push(t);
        }

        const bottomRowTanks = [];
        for (let i = 8; i >= 1; i--) {
            const t = blockTanks.find(item => item.tank_no === i);
            if (t && this.matchesFilter(t)) bottomRowTanks.push(t);
        }

        return `
            <section class="hatchery-block-container" data-block="${blockLetter}">
                <div class="block-indicator-pill">
                    <span class="block-indicator-dot"></span>
                    <span class="block-indicator-label">BLOCK ${blockLetter}</span>
                </div>

                <div class="block-tanks-grid">
                    <!-- Top Row: Tanks 09 to 16 -->
                    <div class="block-tank-row row-top">
                        ${topRowTanks.map(t => this.renderTankCard(t)).join('')}
                    </div>

                    <!-- Bottom Row: Tanks 08 down to 01 -->
                    <div class="block-tank-row row-bottom">
                        ${bottomRowTanks.map(t => this.renderTankCard(t)).join('')}
                    </div>
                </div>
            </section>
        `;
    }

    renderTankCard(t) {
        const isSelected = this.selectedTankCode === t.tank_code;
        const statusClass = (t.run_status || "IDLE").toLowerCase();
        const isCulture = t.run_status === "CULTURE";
        const isHarvested = t.run_status === "HARVESTED";
        const isFlushed = t.run_status === "FLUSHED";

        let mainMetric = "";
        let subMetric = "";

        if (isCulture) {
            mainMetric = t.current_doc !== null ? `DOC ${t.current_doc}` : 'DOC —';
            subMetric = t.nauplii_stocked_k ? `${Number(t.nauplii_stocked_k).toLocaleString()}k nauplii` : '';
        } else if (isHarvested) {
            mainMetric = t.sr_pct !== null ? `${t.sr_pct}% SR` : 'Harvested';
            subMetric = t.harvested_total_k ? `${Number(t.harvested_total_k).toLocaleString()}k PL` : '';
        } else if (isFlushed) {
            mainMetric = 'FLUSHED';
            subMetric = t.flushed_total_k ? `${Number(t.flushed_total_k).toLocaleString()}k` : 'Discard';
        } else {
            mainMetric = 'IDLE';
            subMetric = 'Ready for stock';
        }

        return `
            <div 
                class="hatchery-tank-card status-${statusClass} ${isSelected ? 'selected' : ''}" 
                data-tank-code="${t.tank_code}"
                tabindex="0"
                role="button"
                aria-label="Tank ${t.tank_code}, Status ${t.run_status}"
            >
                <div class="tank-card-header">
                    <span class="tank-code">${t.tank_code}</span>
                    <span class="tank-status-dot dot-${statusClass}" title="${t.run_status}"></span>
                </div>

                <div class="tank-card-body">
                    <span class="tank-main-metric">${mainMetric}</span>
                    <span class="tank-sub-metric">${subMetric}</span>
                </div>

                <div class="tank-card-footer">
                    <span class="tank-source-tag" title="${escapeHtml(t.source_display_name || t.source_code || 'No source')}">
                        ${escapeHtml(t.source_display_name || t.source_code || '—')}
                    </span>
                    ${t.harvest_window_state === 'WINDOW' || t.harvest_window_state === 'APPROACHING' ? `
                        <span class="harvest-window-pill ${t.harvest_window_state.toLowerCase()}">${t.harvest_window_state}</span>
                    ` : ''}
                </div>
            </div>
        `;
    }

    matchesFilter(t) {
        if (this.filterStatus !== "ALL" && t.run_status !== this.filterStatus) {
            return false;
        }
        if (this.searchQuery) {
            const q = this.searchQuery.toLowerCase().trim();
            const code = (t.tank_code || "").toLowerCase();
            const source = (t.source_display_name || t.source_code || "").toLowerCase();
            const batch = (t.broodstock_batch || "").toLowerCase();
            return code.includes(q) || source.includes(q) || batch.includes(q);
        }
        return true;
    }

    bindEvents() {
        // Navigation buttons
        const btnPl = document.getElementById("btn-to-pl-report");
        if (btnPl) {
            btnPl.addEventListener("click", () => {
                if (this.onNavigate) this.onNavigate("hatchery/pl-report");
            });
        }

        const btnBrood = document.getElementById("btn-to-broodstock-report");
        if (btnBrood) {
            btnBrood.addEventListener("click", () => {
                if (this.onNavigate) this.onNavigate("hatchery/broodstock-report");
            });
        }

        const btnPortal = document.getElementById("btn-hatchery-to-portal");
        if (btnPortal) {
            btnPortal.addEventListener("click", () => {
                if (this.onNavigate) this.onNavigate("portal");
            });
        }

        // Filters
        const blockSelect = document.getElementById("filter-block-select");
        if (blockSelect) {
            blockSelect.addEventListener("change", (e) => {
                this.filterBlock = e.target.value;
                this.render();
            });
        }

        const statusSelect = document.getElementById("filter-status-select");
        if (statusSelect) {
            statusSelect.addEventListener("change", (e) => {
                this.filterStatus = e.target.value;
                this.render();
            });
        }

        const searchInput = document.getElementById("hatchery-tank-search");
        if (searchInput) {
            searchInput.addEventListener("input", (e) => {
                this.searchQuery = e.target.value;
                this.render();
                // Restore search focus
                const newSearch = document.getElementById("hatchery-tank-search");
                if (newSearch) {
                    newSearch.focus();
                    newSearch.setSelectionRange(newSearch.value.length, newSearch.value.length);
                }
            });
        }

        // Tank Card Click -> Open Drawer
        const tankCards = this.container.querySelectorAll(".hatchery-tank-card");
        tankCards.forEach(card => {
            const tankCode = card.getAttribute("data-tank-code");
            const openDrawer = () => this.openTankDrawer(tankCode);

            card.addEventListener("click", openDrawer);
            card.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openDrawer();
                }
            });
        });

        // Close Drawer backdrop click
        const drawerBackdrop = document.getElementById("hatchery-drawer");
        if (drawerBackdrop) {
            drawerBackdrop.addEventListener("click", (e) => {
                if (e.target === drawerBackdrop) {
                    this.closeTankDrawer();
                }
            });
        }
    }

    async openTankDrawer(tankCode) {
        this.selectedTankCode = tankCode;
        const drawer = document.getElementById("hatchery-drawer");
        const content = document.getElementById("hatchery-drawer-content");
        if (!drawer || !content) return;

        drawer.classList.remove("hidden");
        content.innerHTML = `
            <div class="drawer-loading">
                <div class="hatchery-loading-spinner"></div>
                <p>Retrieving history &amp; traceability for Tank ${escapeHtml(tankCode)}...</p>
            </div>
        `;

        const data = await HatcheryRepository.getTankHistory(tankCode);
        this.tankDetailData = data;
        this.renderDrawerContent();
    }

    closeTankDrawer() {
        const drawer = document.getElementById("hatchery-drawer");
        if (drawer) {
            drawer.classList.add("hidden");
        }
        this.selectedTankCode = null;
    }

    renderDrawerContent() {
        const content = document.getElementById("hatchery-drawer-content");
        if (!content || !this.tankDetailData) return;

        const { tank, runs, events, pondLinks } = this.tankDetailData;
        const currentRun = runs.length > 0 ? runs[0] : null;

        content.innerHTML = `
            <div class="drawer-header">
                <div class="drawer-title-row">
                    <span class="drawer-tank-badge">TANK ${escapeHtml(this.selectedTankCode)}</span>
                    <span class="drawer-status-pill ${currentRun?.status ? currentRun.status.toLowerCase() : 'idle'}">
                        ${currentRun?.status || 'IDLE'}
                    </span>
                    <button class="drawer-close-btn" id="btn-close-drawer" aria-label="Close Drawer">✕</button>
                </div>
                <div class="drawer-subtitle">
                    Block ${escapeHtml(this.selectedTankCode.charAt(0))} • Row ${tank?.row_pos || 'N/A'} • Column ${tank?.col_pos || 'N/A'}
                </div>
            </div>

            <!-- Drawer Tabs -->
            <div class="drawer-tabs-bar">
                <button class="drawer-tab ${this.activeDrawerTab === 'overview' ? 'active' : ''}" data-tab="overview">Overview</button>
                <button class="drawer-tab ${this.activeDrawerTab === 'events' ? 'active' : ''}" data-tab="events">Lifecycle Events (${events.length})</button>
                <button class="drawer-tab ${this.activeDrawerTab === 'ponds' ? 'active' : ''}" data-tab="ponds">Linked Ponds (${pondLinks.length})</button>
                <button class="drawer-tab ${this.activeDrawerTab === 'lab' ? 'active' : ''}" data-tab="lab">Lab Reports <span class="tab-badge-beta">Phase 2</span></button>
            </div>

            <!-- Drawer Body -->
            <div class="drawer-body">
                ${this.renderDrawerTabContent(tank, currentRun, events, pondLinks)}
            </div>
        `;

        // Drawer events
        const btnClose = document.getElementById("btn-close-drawer");
        if (btnClose) {
            btnClose.addEventListener("click", () => this.closeTankDrawer());
        }

        const tabs = content.querySelectorAll(".drawer-tab");
        tabs.forEach(tab => {
            tab.addEventListener("click", () => {
                this.activeDrawerTab = tab.getAttribute("data-tab");
                this.renderDrawerContent();
            });
        });
    }

    renderDrawerTabContent(tank, currentRun, events, pondLinks) {
        if (this.activeDrawerTab === "overview") {
            return `
                <div class="drawer-section">
                    <h4 class="drawer-sec-title">Current Culture Run Telemetry</h4>
                    <div class="drawer-meta-grid">
                        <div class="meta-item">
                            <span class="meta-label">Stocking Date</span>
                            <span class="meta-value">${currentRun?.stock_date || '—'}</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-label">Nauplii Stocked</span>
                            <span class="meta-value highlight">${currentRun?.nauplii_stocked_k ? Number(currentRun.nauplii_stocked_k).toLocaleString() + 'k' : '—'}</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-label">Species</span>
                            <span class="meta-value">${currentRun?.species === 'MON' ? 'P.Monodon' : 'L.Vannamei'}</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-label">Nauplii Source</span>
                            <span class="meta-value">${escapeHtml(currentRun?.source_code || '—')}</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-label">Days of Culture (DOC)</span>
                            <span class="meta-value">${tank?.current_doc !== null && tank?.current_doc !== undefined ? 'DOC ' + tank.current_doc : '—'}</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-label">Survival Rate (SR)</span>
                            <span class="meta-value ${currentRun?.sr_pct >= 70 ? 'success' : 'warn'}">${currentRun?.sr_pct !== null && currentRun?.sr_pct !== undefined ? currentRun.sr_pct + '%' : 'In Culture'}</span>
                        </div>
                    </div>
                </div>

                <div class="drawer-section">
                    <h4 class="drawer-sec-title">Broodstock &amp; Maturation Lineage</h4>
                    <div class="drawer-lineage-card">
                        <div class="lineage-row">
                            <span class="lineage-label">Broodstock Batch:</span>
                            <span class="lineage-val highlight">${escapeHtml(tank?.broodstock_batch || 'External / Not Assigned')}</span>
                        </div>
                        <div class="lineage-row">
                            <span class="lineage-label">Broodstock Supplier:</span>
                            <span class="lineage-val">${escapeHtml(tank?.broodstock_supplier || 'External Nauplii Supplier')}</span>
                        </div>
                        <div class="lineage-row">
                            <span class="lineage-label">Broodstock DOC at Spawning:</span>
                            <span class="lineage-val">${tank?.broodstock_doc !== null && tank?.broodstock_doc !== undefined ? 'DOC ' + tank.broodstock_doc : '—'}</span>
                        </div>
                        <div class="lineage-row">
                            <span class="lineage-label">Hatching Rate (HR-A):</span>
                            <span class="lineage-val hr-val">${tank?.display_hr_pct !== null && tank?.display_hr_pct !== undefined ? tank.display_hr_pct + '%' : '—'}</span>
                        </div>
                    </div>
                </div>
            `;
        }

        if (this.activeDrawerTab === "events") {
            if (events.length === 0) {
                return `<div class="drawer-empty-state">No lifecycle harvest or flush events logged for this tank.</div>`;
            }
            return `
                <div class="drawer-events-timeline">
                    ${events.map(ev => `
                        <div class="timeline-event-card event-${ev.event_type.toLowerCase()}">
                            <div class="event-header-row">
                                <span class="event-type-pill ${ev.event_type.toLowerCase()}">${ev.event_type}</span>
                                <span class="event-date">${ev.event_date}</span>
                            </div>
                            <div class="event-body-row">
                                <span class="event-qty">${Number(ev.qty_k).toLocaleString()}k PL</span>
                                <span class="event-stage">Stage PL ${ev.pl_stage || '—'}</span>
                                ${ev.sr_reported_pct ? `<span class="event-sr">SR: ${ev.sr_reported_pct}%</span>` : ''}
                            </div>
                            ${ev.flush_reason ? `<div class="event-reason">Reason: ${escapeHtml(ev.flush_reason)}</div>` : ''}
                            ${ev.lot_no ? `<div class="event-lot">Lot No: <code>${escapeHtml(ev.lot_no)}</code></div>` : ''}
                        </div>
                    `).join('')}
                </div>
            `;
        }

        if (this.activeDrawerTab === "ponds") {
            if (pondLinks.length === 0) {
                return `<div class="drawer-empty-state">No linked growout pond cycles matched for this tank harvest yet.</div>`;
            }
            return `
                <div class="drawer-pond-links-list">
                    ${pondLinks.map(link => `
                        <div class="pond-link-card">
                            <div class="pond-link-header">
                                <span class="pond-link-code">Pond Cycle: ${escapeHtml(link.pond_index)}</span>
                                <span class="pond-link-badge ${link.status.toLowerCase()}">${link.status}</span>
                            </div>
                            <div class="pond-link-meta">
                                <div>Stocked to Pond: <strong>${link.pond_stck_date}</strong></div>
                                <div>Match Method: <strong>${link.match_method}</strong></div>
                                <div>Confidence: <strong>${Math.round(link.confidence * 100)}%</strong></div>
                            </div>
                            ${link.review_notes ? `<div class="pond-link-notes">${escapeHtml(link.review_notes)}</div>` : ''}
                        </div>
                    `).join('')}
                </div>
            `;
        }

        if (this.activeDrawerTab === "lab") {
            return `
                <div class="drawer-lab-section">
                    <div class="lab-placeholder-banner">
                        <span class="lab-icon">🔬</span>
                        <h4>Hatchery Lab Reports — Phase 2</h4>
                        <p>Laboratory quality monitoring for each PL tank will be rendered here.</p>
                    </div>

                    <div class="lab-cards-preview">
                        <div class="lab-card-slot">
                            <h5>🌊 Water Quality Report</h5>
                            <p>Daily pH, Salinity, Temperature, DO, and Alkalinity monitoring for Tank ${escapeHtml(this.selectedTankCode)}.</p>
                            <span class="lab-status-badge">Awaiting Format Finalization</span>
                        </div>

                        <div class="lab-card-slot">
                            <h5>🧫 Microbiology Report</h5>
                            <p>Total Vibrio count, Green &amp; Yellow colony CFU/mL plate monitoring.</p>
                            <span class="lab-status-badge">Awaiting Format Finalization</span>
                        </div>

                        <div class="lab-card-slot">
                            <h5>🔍 Fry Health &amp; QC</h5>
                            <p>Gut fullness, Muscle-to-gut ratio, necrosis score, and stress challenge.</p>
                            <span class="lab-status-badge">Awaiting Format Finalization</span>
                        </div>

                        <div class="lab-card-slot">
                            <h5>🧬 Fry PCR Certificate</h5>
                            <p>WSSV, EHP, IHHNV, and IMNV pathogen screening clearance.</p>
                            <span class="lab-status-badge">Awaiting Format Finalization</span>
                        </div>
                    </div>
                </div>
            `;
        }

        return '';
    }
}
