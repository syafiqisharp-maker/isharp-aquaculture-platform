/**
 * iSHARP DBMS 2.0 — Executive Metric Detail Page Controller
 * Dedicated full-screen report view replacing cramped popup modal.
 * Features:
 * - Full-viewport responsive layout with sticky breadcrumb navigation
 * - Quick-switcher tabs across all 7 farm metrics
 * - 12-Month Interactive Canvas Timeline with clickable month buckets
 * - Synchronized Month Filter and Live Text Search
 * - Spacious data table with sticky headers
 * - One-click RFC-4180 CSV export
 * 
 * Clean Coding Standard: Pure view controller delegating aggregation to ExecutiveMetricsPresenter.
 */

import { ExecutiveMetricsPresenter, METRIC_TYPES, formatMonthLabel } from "./ExecutiveMetricsPresenter.js";
import { downloadCsv } from "../../utils/csvExporter.js";
import { Toast } from "../../components/Toast.js";
import { PondRepository } from "../../infrastructure/repositories/pondRepository.js";
import { HarvestRepository } from "../../infrastructure/repositories/harvestRepository.js";
import { LabRepository } from "../../infrastructure/repositories/labRepository.js";
import { SamplingRepository } from "../../infrastructure/repositories/samplingRepository.js";

const METRIC_TABS = [
    { key: METRIC_TYPES.HARVEST, label: "Total Harvest", icon: "🌾" },
    { key: METRIC_TYPES.STOCKING, label: "Total Stocking", icon: "🦐" },
    { key: METRIC_TYPES.SPECIES_COMP, label: "Species Comp", icon: "🧬" },
    { key: METRIC_TYPES.DOC_COMP, label: "DOC Stages", icon: "⏱️" },
    { key: METRIC_TYPES.ACTIVE_PONDS, label: "Active Ponds", icon: "🗺️" },
    { key: METRIC_TYPES.PREP_IDLE, label: "Prep & Idle", icon: "🚜" },
    { key: METRIC_TYPES.BIOSECURITY, label: "Growth & Survival", icon: "🦐" }
];

export class ExecutiveDetailPage {
    constructor(containerId = "view-executive-detail") {
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        this.currentMetric = METRIC_TYPES.HARVEST;
        this.activePondChartMode = "AVG";
        this.prepChartMode = "TOTAL";
        this.growthSpecies = "ALL";
        this.growthChartMode = "ADG";
        this.growthViewPerspective = "MODULE";
        this.growthDocCohort = "MID_LATE";
        this.selectedMonth = "ALL";
        this.searchQuery = "";
        this.sortColIndex = null;
        this.sortDirection = null; // null | 'asc' | 'desc'
        this.chartBarHitboxes = [];
        this.dataBundle = {
            activePonds: [],
            activeCycles: [],
            operationalCycles: [],
            dailyProgress: [],
            issues: [],
            dailyHarvests: [],
            salesRecords: [],
            stockingBatches: [],
            samplings: [],
            samplings12M: []
        };
        this.isInitialized = false;
        this.isLoading = false;
    }

    ensureInitialized() {
        if (!this.isInitialized) {
            this.isInitialized = true;
            this.handleRoute();
        }
    }

    /**
     * Reads current URL hash parameters e.g. #/executive-detail?metric=HARVEST
     */
    handleRoute() {
        const hash = window.location.hash || "";
        let metricFromUrl = null;

        if (hash.includes("?")) {
            const queryStr = hash.split("?")[1] || "";
            const params = new URLSearchParams(queryStr);
            metricFromUrl = params.get("metric");
        } else if (hash.includes("/")) {
            const parts = hash.split("/");
            if (parts.length > 2 && parts[2]) {
                metricFromUrl = parts[2].toUpperCase();
            }
        }

        if (metricFromUrl && METRIC_TYPES[metricFromUrl]) {
            this.currentMetric = METRIC_TYPES[metricFromUrl];
        } else if (metricFromUrl && Object.values(METRIC_TYPES).includes(metricFromUrl.toUpperCase())) {
            this.currentMetric = metricFromUrl.toUpperCase();
        }

        this.renderSkeleton();
        this.loadData();
    }

    renderSkeleton() {
        if (!this.container) return;
        this.container.innerHTML = `
            <div class="exec-detail-page-layout">
                <header class="exec-detail-header">
                    <div class="exec-detail-header-left">
                        <button type="button" class="btn-detail-back" data-nav-view="executive">
                            <span>← Back to Executive Dashboard</span>
                        </button>
                    </div>
                </header>
                <div class="exec-detail-body" style="text-align: center; padding: 4rem 1rem;">
                    <div class="spinner-sm" style="margin: 0 auto 1rem auto;"></div>
                    <div style="font-weight: 700; color: #0f172a;">Loading Executive Deep-Dive Report...</div>
                    <div style="font-size: 0.8rem; color: #64748b; margin-top: 0.35rem;">Aggregating 12-month farm data across 9 modules</div>
                </div>
            </div>
        `;
    }

    async loadData() {
        this.isLoading = true;

        // Try to pull existing in-memory state from ExecutiveView / PondGridMap
        const execView = window.__isharpApp?.executiveView || window.app?.executiveView;
        if (execView && typeof execView.getDataBundle === "function") {
            const bundle = execView.getDataBundle();
            if (bundle && (bundle.activePonds?.length > 0 || bundle.dailyHarvests?.length > 0)) {
                this.dataBundle = bundle;
            }
        }

        // If harvest, stocking, operational, or sampling data is missing, fetch directly from repositories
        const needsHarvest = !this.dataBundle.dailyHarvests || this.dataBundle.dailyHarvests.length === 0;
        const needsStocking = !this.dataBundle.stockingBatches || this.dataBundle.stockingBatches.length === 0;
        const needsPonds = !this.dataBundle.activePonds || this.dataBundle.activePonds.length === 0;
        const needsOpCycles = !this.dataBundle.operationalCycles || this.dataBundle.operationalCycles.length === 0;
        const needsSamplings = !this.dataBundle.samplings || this.dataBundle.samplings.length === 0;
        const needsSamplings12M = !this.dataBundle.samplings12M || this.dataBundle.samplings12M.length === 0;

        if (needsHarvest || needsStocking || needsPonds || needsOpCycles || needsSamplings || needsSamplings12M) {
            try {
                const fetches = [];
                if (needsHarvest) fetches.push(HarvestRepository.get12MonthHarvestData(12));
                else fetches.push(Promise.resolve(null));

                if (needsStocking) fetches.push(PondRepository.get12MonthStockingBatches(12));
                else fetches.push(Promise.resolve(null));

                if (needsOpCycles) fetches.push(PondRepository.get12MonthOperationalCycles(12));
                else fetches.push(Promise.resolve(null));

                if (needsSamplings) fetches.push(SamplingRepository.getRecentSamplings(1500));
                else fetches.push(Promise.resolve(null));

                if (needsSamplings12M) fetches.push(SamplingRepository.get12MonthMatureSamplings(12, 50));
                else fetches.push(Promise.resolve(null));

                if (needsPonds) {
                    fetches.push(Promise.all([
                        PondRepository.getActiveCycles(),
                        PondRepository.getActiveOperationalPonds(),
                        LabRepository.getAllRecentIssues(1000),
                        PondRepository.getDailyPondProgress()
                    ]));
                } else {
                    fetches.push(Promise.resolve(null));
                }

                const [harvestRes, stockingBatches, opCycles, samplings, samplings12M, pondPack] = await Promise.all(fetches);

                if (harvestRes) {
                    this.dataBundle.dailyHarvests = harvestRes.dailyHarvests || [];
                    this.dataBundle.salesRecords = harvestRes.salesRecords || [];
                }
                if (stockingBatches) {
                    this.dataBundle.stockingBatches = stockingBatches || [];
                }
                if (opCycles) {
                    this.dataBundle.operationalCycles = opCycles || [];
                }
                if (samplings) {
                    this.dataBundle.samplings = samplings || [];
                }
                if (samplings12M) {
                    this.dataBundle.samplings12M = samplings12M || [];
                }
                if (pondPack) {
                    const [activeCycles, activePonds, issues, dailyProgress] = pondPack;
                    this.dataBundle.activeCycles = activeCycles || [];
                    this.dataBundle.issues = issues || [];
                    this.dataBundle.dailyProgress = dailyProgress || [];
                    
                    // If executive gridMap is available, use evaluated ponds
                    if (execView?.gridMap?.allEvaluatedPonds?.length > 0) {
                        this.dataBundle.activePonds = execView.gridMap.allEvaluatedPonds;
                    } else {
                        this.dataBundle.activePonds = (activeCycles || []).map(c => ({
                            pondCode: c.pond,
                            pondIndex: c.pond_index,
                            speciesLabel: c.stck_species || "VAN",
                            isActive: (c.pond_status || "").toUpperCase() === "PRODUCTION",
                            doc: 45,
                            progressState: (c.pond_status || "").toUpperCase() === "PRODUCTION" ? "CULTURE" : "IDLE",
                            health: "GREEN"
                        }));
                    }
                }
            } catch (err) {
                console.warn("Could not background-sync detail data:", err);
            }
        }

        this.isLoading = false;
        this.render();
        this.bindEvents();
    }

    /**
     * Builds HTML for table headers with interactive sort indicators and ARIA attributes.
     * @param {Array<string>} headers 
     * @returns {string}
     */
    buildTableHeadersHtml(headers = []) {
        return headers.map((h, idx) => {
            const isSorted = this.sortColIndex === idx;
            let sortClass = "";
            let sortIcon = "↕";
            let ariaSort = "none";
            if (isSorted) {
                if (this.sortDirection === "asc") {
                    sortClass = "sorted-asc";
                    sortIcon = "▲";
                    ariaSort = "ascending";
                } else if (this.sortDirection === "desc") {
                    sortClass = "sorted-desc";
                    sortIcon = "▼";
                    ariaSort = "descending";
                }
            }
            return `
                <th class="sortable-th ${sortClass}" data-sort-col="${idx}" role="columnheader" aria-sort="${ariaSort}" tabindex="0" title="Click to sort by ${h}">
                    <span class="th-content">
                        <span class="th-label">${h}</span>
                        <span class="th-sort-icon">${sortIcon}</span>
                    </span>
                </th>
            `;
        }).join("");
    }

    /**
     * Builds HTML for table rows, sorting them if sortColIndex and sortDirection are active.
     * @param {Array<Array<any>>} rawRows 
     * @param {number} colCount 
     * @returns {string}
     */
    buildTableRowsHtml(rawRows = [], colCount = 1) {
        let rows = rawRows || [];
        if (this.sortColIndex !== null && this.sortDirection) {
            rows = ExecutiveMetricsPresenter.sortRows(rows, this.sortColIndex, this.sortDirection);
        }

        if (rows.length === 0) {
            return `
                <tr>
                    <td colspan="${Math.max(1, colCount)}" class="exec-detail-empty-cell">
                        No records found for the selected month or search query.
                    </td>
                </tr>
            `;
        }

        return rows.map(row => {
            const cellsHtml = row.map((cell) => {
                const cellStr = String(cell);
                let badgeClass = "";
                if (cellStr === "VAN" || cellStr.includes("VANNAMEI")) badgeClass = "badge-sp-van";
                else if (cellStr === "MON" || cellStr.includes("MONODON")) badgeClass = "badge-sp-mon";
                else if (cellStr === "RED" || cellStr.startsWith("Red:")) badgeClass = "badge-alert-red";
                else if (cellStr === "YELLOW" || cellStr.startsWith("Yellow:")) badgeClass = "badge-alert-yellow";
                else if (cellStr === "GREEN" || cellStr.includes("Normal") || cellStr.includes("Negative")) badgeClass = "badge-alert-green";
                else if (cellStr === "READY") badgeClass = "badge-status-ready";
                else if (cellStr === "CULTURE" || cellStr === "Active Culture") badgeClass = "badge-status-culture";
                else if (cellStr === "IDLE" || cellStr.includes("Closed")) badgeClass = "badge-status-idle";
                else if (cellStr === "FINISHING") badgeClass = "badge-stage-finishing";
                else if (cellStr === "MID") badgeClass = "badge-stage-mid";
                else if (cellStr === "EARLY") badgeClass = "badge-stage-early";

                if (badgeClass) {
                    return `<td><span class="drilldown-badge ${badgeClass}">${cellStr}</span></td>`;
                }
                return `<td>${cellStr}</td>`;
            }).join("");

            return `<tr>${cellsHtml}</tr>`;
        }).join("");
    }

    render() {
        if (!this.container) return;

        const vm = ExecutiveMetricsPresenter.getMetricDrillDownData(
            this.currentMetric,
            this.dataBundle,
            this.selectedMonth,
            this.searchQuery,
            {
                activePondMode: this.activePondChartMode,
                prepChartMode: this.prepChartMode,
                growthSpecies: this.growthSpecies,
                growthChartMode: this.growthChartMode,
                growthViewPerspective: this.growthViewPerspective,
                growthDocCohort: this.growthDocCohort
            }
        );

        // Metric Switcher Tabs HTML
        const switcherTabsHtml = METRIC_TABS.map(tab => `
            <button type="button" class="btn-metric-pill ${this.currentMetric === tab.key ? 'active' : ''}" data-switch-metric="${tab.key}">
                <span>${tab.icon} ${tab.label}</span>
            </button>
        `).join("");

        // Operational Mode Toggle (for ACTIVE_PONDS)
        const isOperationalMetric = this.currentMetric === METRIC_TYPES.ACTIVE_PONDS;
        const modeToggleHtml = isOperationalMetric ? `
            <div class="timeline-mode-toggle" aria-label="Operational Pond Metric Mode">
                <span class="mode-toggle-label">Mode:</span>
                <button type="button" class="btn-mode ${this.activePondChartMode === 'AVG' ? 'active' : ''}" data-pond-mode="AVG" title="Show monthly average operational ponds">Average</button>
                <button type="button" class="btn-mode ${this.activePondChartMode === 'MAX' ? 'active' : ''}" data-pond-mode="MAX" title="Show peak operational capacity">Peak (Max)</button>
                <button type="button" class="btn-mode ${this.activePondChartMode === 'MIN' ? 'active' : ''}" data-pond-mode="MIN" title="Show lowest operational count">Lowest (Min)</button>
            </div>
        ` : '';

        // Preparation & Turnaround Mode Toggle (for PREP_IDLE)
        const isPrepMetric = this.currentMetric === METRIC_TYPES.PREP_IDLE;
        const prepModeToggleHtml = isPrepMetric ? `
            <div class="prep-toggle-container" style="display: inline-flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
                <!-- Group 1: Duration (Days) -->
                <div class="timeline-mode-toggle" aria-label="Turnaround Stage Duration Mode">
                    <span class="mode-toggle-label">Duration:</span>
                    <button type="button" class="btn-mode ${this.prepChartMode === 'TOTAL' ? 'active' : ''}" data-prep-mode="TOTAL" title="Total turnaround days from harvest to stocking">Total</button>
                    <button type="button" class="btn-mode ${this.prepChartMode === 'IDLE_CLEAN' ? 'active' : ''}" data-prep-mode="IDLE_CLEAN" title="Days from idle drying to cleaning start">Idle ➔ Clean</button>
                    <button type="button" class="btn-mode ${this.prepChartMode === 'CLEAN_FILL' ? 'active' : ''}" data-prep-mode="CLEAN_FILL" title="Days for cleaning, scraping and repairs">Clean ➔ Fill</button>
                    <button type="button" class="btn-mode ${this.prepChartMode === 'FILL_STOCK' ? 'active' : ''}" data-prep-mode="FILL_STOCK" title="Days for water treatment and bioassay">Fill ➔ Stock</button>
                </div>
                <!-- Group 2: Count of Ponds -->
                <div class="timeline-mode-toggle" aria-label="Count of Ponds Worked Mode">
                    <span class="mode-toggle-label">Count of Ponds:</span>
                    <button type="button" class="btn-mode ${this.prepChartMode === 'COUNT_CLEANED' ? 'active' : ''}" data-prep-mode="COUNT_CLEANED" title="Count of ponds cleaned this month">Cleaned</button>
                    <button type="button" class="btn-mode ${this.prepChartMode === 'COUNT_REPAIRED' ? 'active' : ''}" data-prep-mode="COUNT_REPAIRED" title="Count of ponds repaired this month">Repaired</button>
                    <button type="button" class="btn-mode ${this.prepChartMode === 'COUNT_FILLED' ? 'active' : ''}" data-prep-mode="COUNT_FILLED" title="Count of ponds filled with water this month">Water Filled</button>
                </div>
            </div>
        ` : '';

        // Shrimp Health, Growth & Survival Toggle (for BIOSECURITY)
        const isBioMetric = this.currentMetric === METRIC_TYPES.BIOSECURITY;
        const bioModeToggleHtml = isBioMetric ? `
            <div class="bio-toggle-container" style="display: inline-flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
                <!-- Species Filter -->
                <div class="timeline-mode-toggle" aria-label="Filter by Species">
                    <span class="mode-toggle-label">Species:</span>
                    <button type="button" class="btn-mode ${this.growthSpecies === 'ALL' ? 'active' : ''}" data-growth-species="ALL" title="All active culturing ponds">All Species</button>
                    <button type="button" class="btn-mode ${this.growthSpecies === 'VAN' ? 'active' : ''}" data-growth-species="VAN" title="Penaeus vannamei crops only">Vannamei (VAN)</button>
                    <button type="button" class="btn-mode ${this.growthSpecies === 'MON' ? 'active' : ''}" data-growth-species="MON" title="Penaeus monodon crops only">Monodon (MON)</button>
                </div>

                <!-- Rate Metrics -->
                <div class="timeline-mode-toggle" aria-label="Growth & Survival Metric">
                    <span class="mode-toggle-label">Rates:</span>
                    <button type="button" class="btn-mode ${this.growthChartMode === 'ADG' ? 'active' : ''}" data-growth-mode="ADG" title="Average Daily Growth (ABW ÷ DOC in g/day)">Daily Growth (g/d)</button>
                    <button type="button" class="btn-mode ${this.growthChartMode === 'SR' ? 'active' : ''}" data-growth-mode="SR" title="Average Survival Rate %">Survival %</button>
                </div>

                <!-- Accountability Pond Counts -->
                <div class="timeline-mode-toggle" aria-label="Production Flags Mode">
                    <span class="mode-toggle-label">Count:</span>
                    <button type="button" class="btn-mode ${this.growthChartMode === 'LAGGING' ? 'active' : ''}" data-growth-mode="LAGGING" title="Ponds behind target growth (<80%)">Behind Target</button>
                    <button type="button" class="btn-mode ${this.growthChartMode === 'CRITICAL_SR' ? 'active' : ''}" data-growth-mode="CRITICAL_SR" title="Ponds with critical low survival (<60%)">Low Survival (&lt;60%)</button>
                    <button type="button" class="btn-mode ${this.growthChartMode === 'ALERTS' ? 'active' : ''}" data-growth-mode="ALERTS" title="Active Red & Yellow Lab Alerts">Lab Alerts</button>
                </div>

                <!-- Honest Sampling Cohort Filter -->
                <div class="timeline-mode-toggle" aria-label="Filter by DOC Cohort">
                    <span class="mode-toggle-label">DOC Cohort:</span>
                    <button type="button" class="btn-mode ${this.growthDocCohort === 'MID_LATE' ? 'active' : ''}" data-growth-cohort="MID_LATE" title="Mid & Late stage crops (DOC ≥ 50d) — Excludes early nursery bias">Mid &amp; Late (DOC ≥ 50d)</button>
                    <button type="button" class="btn-mode ${this.growthDocCohort === 'LATE_ONLY' ? 'active' : ''}" data-growth-cohort="LATE_ONLY" title="Harvest candidate window only (DOC > 70d)">Late Only (DOC &gt; 70d)</button>
                </div>

                <!-- View Perspective -->
                <div class="timeline-mode-toggle" aria-label="View Perspective Mode">
                    <span class="mode-toggle-label">View:</span>
                    <button type="button" class="btn-mode ${this.growthViewPerspective === 'MODULE' ? 'active' : ''}" data-growth-perspective="MODULE" title="Compare Module Teams (M01 – M11)">By Module (M01–M11)</button>
                    <button type="button" class="btn-mode ${this.growthViewPerspective === 'MONTHLY' ? 'active' : ''}" data-growth-perspective="MONTHLY" title="12-Month Rolling Trend">12-Month Trend</button>
                </div>
            </div>
        ` : '';

        // KPI Summary Cards
        const statCardsHtml = (vm.summaryBadges || []).map(b => `
            <div class="exec-detail-stat-card">
                <div class="exec-detail-stat-label">${b.label}</div>
                <div class="exec-detail-stat-val">${b.value}</div>
                <div class="exec-detail-stat-sub">${b.sub}</div>
            </div>
        `).join("");

        // Month Selector Options
        const monthOptionsHtml = (vm.monthOptions || []).map(opt => `
            <option value="${opt.key}" ${this.selectedMonth === opt.key ? "selected" : ""}>${opt.label}</option>
        `).join("");

        // Table Headers & Rows
        const tableHeadersHtml = this.buildTableHeadersHtml(vm.tableHeaders || []);
        const tableRowsHtml = this.buildTableRowsHtml(vm.tableRows || [], (vm.tableHeaders || []).length);

        const hasTimeline = (vm.timeline || []).length > 0;

        this.container.innerHTML = `
            <div class="exec-detail-page-layout">
                
                <!-- Sticky Top Navigation Bar -->
                <header class="exec-detail-header">
                    <div class="exec-detail-header-left">
                        <button type="button" class="btn-detail-back" data-nav-view="executive" title="Return to 216-Pond Farm Map">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="19" y1="12" x2="5" y2="12"></line>
                                <polyline points="12 19 5 12 12 5"></polyline>
                            </svg>
                            <span>Back to Executive Dashboard</span>
                        </button>

                        <div class="exec-detail-title-group">
                            <span class="exec-detail-icon">${vm.icon}</span>
                            <div>
                                <h1 class="exec-detail-title">${vm.title}</h1>
                                <p class="exec-detail-sub">${vm.subtitle}</p>
                            </div>
                        </div>
                    </div>

                    <!-- Metric Quick Switcher -->
                    <nav class="exec-detail-switcher" aria-label="Metric Quick Navigation">
                        ${switcherTabsHtml}
                    </nav>
                </header>

                <!-- Page Content Body -->
                <main class="exec-detail-body">
                    
                    <!-- KPI Summary Strip -->
                    <section class="exec-detail-stat-strip" aria-label="KPI Summary Cards">
                        ${statCardsHtml}
                    </section>

                    <!-- Interactive 12-Month Progression Canvas Timeline -->
                    ${hasTimeline ? `
                        <section class="exec-detail-timeline-panel">
                            <div class="exec-detail-timeline-header">
                                <div class="timeline-header-left">
                                    <span class="timeline-headline">📈 ${vm.timelineTitle || "Monthly Operational Pond Capacity (12-Month)"}</span>
                                    ${modeToggleHtml}
                                    ${prepModeToggleHtml}
                                    ${bioModeToggleHtml}
                                </div>
                                <span class="timeline-interactive-hint">💡 Click any month bar to instantly filter the table below</span>
                            </div>
                            <div class="exec-detail-canvas-box">
                                <canvas id="detail-timeline-canvas" class="exec-detail-canvas"></canvas>
                            </div>
                        </section>
                    ` : ""}

                    <!-- Controls Toolbar -->
                    <section class="exec-detail-toolbar">
                        <div class="detail-toolbar-left">
                            <div class="detail-control-item">
                                <label for="detail-month-select" class="detail-toolbar-label">Month Period:</label>
                                <select id="detail-month-select" class="detail-toolbar-select">
                                    ${monthOptionsHtml}
                                </select>
                            </div>

                            <div class="detail-search-box">
                                <span class="detail-search-icon">🔍</span>
                                <input type="text" id="detail-search-input" class="detail-search-input" placeholder="Search pond, module, species, status..." value="${this.searchQuery}" />
                                ${this.searchQuery ? `<button type="button" id="btn-clear-detail-search" class="btn-detail-clear-search">✕</button>` : ""}
                            </div>
                        </div>

                        <div class="detail-toolbar-right">
                            <span class="detail-count-badge" id="detail-count-display">${vm.countDisplay}</span>
                            <button type="button" id="btn-detail-export-csv" class="btn-detail-csv" title="Download Excel-Compatible CSV">
                                <span>📥 Export CSV</span>
                            </button>
                        </div>
                    </section>

                    <!-- Full-Viewport Table Card -->
                    <section class="exec-detail-table-card">
                        <div class="exec-detail-table-wrapper">
                            <table class="exec-detail-table">
                                <thead>
                                    <tr>${tableHeadersHtml}</tr>
                                </thead>
                                <tbody id="detail-table-body">
                                    ${tableRowsHtml}
                                </tbody>
                            </table>
                        </div>
                    </section>

                </main>

            </div>
        `;

        if (hasTimeline) {
            this.drawTimelineChart(vm.timeline);
        }
    }

    bindEvents() {
        // Operational Pond Metric Mode Toggle (AVG, MAX, MIN)
        const modeBtns = this.container.querySelectorAll("[data-pond-mode]");
        modeBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                const mode = btn.getAttribute("data-pond-mode");
                if (mode && this.activePondChartMode !== mode) {
                    this.activePondChartMode = mode;
                    modeBtns.forEach(b => b.classList.toggle("active", b.getAttribute("data-pond-mode") === mode));
                    this.refreshContent(true);
                }
            });
        });

        // Preparation & Turnaround Stage Mode Toggle (TOTAL, IDLE_CLEAN, CLEAN_FILL, FILL_STOCK)
        const prepBtns = this.container.querySelectorAll("[data-prep-mode]");
        prepBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                const mode = btn.getAttribute("data-prep-mode");
                if (mode && this.prepChartMode !== mode) {
                    this.prepChartMode = mode;
                    prepBtns.forEach(b => b.classList.toggle("active", b.getAttribute("data-prep-mode") === mode));
                    this.refreshContent(true);
                }
            });
        });

        // Shrimp Health, Growth & Survival Mode Toggles
        const speciesBtns = this.container.querySelectorAll("[data-growth-species]");
        speciesBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                const sp = btn.getAttribute("data-growth-species");
                if (sp && this.growthSpecies !== sp) {
                    this.growthSpecies = sp;
                    speciesBtns.forEach(b => b.classList.toggle("active", b.getAttribute("data-growth-species") === sp));
                    this.refreshContent(true);
                }
            });
        });

        const growthModeBtns = this.container.querySelectorAll("[data-growth-mode]");
        growthModeBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                const mode = btn.getAttribute("data-growth-mode");
                if (mode && this.growthChartMode !== mode) {
                    this.growthChartMode = mode;
                    growthModeBtns.forEach(b => b.classList.toggle("active", b.getAttribute("data-growth-mode") === mode));
                    this.refreshContent(true);
                }
            });
        });

        const growthCohortBtns = this.container.querySelectorAll("[data-growth-cohort]");
        growthCohortBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                const cohort = btn.getAttribute("data-growth-cohort");
                if (cohort && this.growthDocCohort !== cohort) {
                    this.growthDocCohort = cohort;
                    growthCohortBtns.forEach(b => b.classList.toggle("active", b.getAttribute("data-growth-cohort") === cohort));
                    this.refreshContent(true);
                }
            });
        });

        const perspBtns = this.container.querySelectorAll("[data-growth-perspective]");
        perspBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                const p = btn.getAttribute("data-growth-perspective");
                if (p && this.growthViewPerspective !== p) {
                    this.growthViewPerspective = p;
                    this.selectedMonth = "ALL";
                    this.render();
                    this.bindEvents();
                }
            });
        });

        // Quick Metric Switcher Pills
        const pills = this.container.querySelectorAll("[data-switch-metric]");
        pills.forEach(pill => {
            pill.addEventListener("click", () => {
                const metric = pill.getAttribute("data-switch-metric");
                if (metric && this.currentMetric !== metric) {
                    this.currentMetric = metric;
                    this.selectedMonth = "ALL";
                    this.searchQuery = "";
                    this.sortColIndex = null;
                    this.sortDirection = null;
                    this.prepChartMode = "TOTAL";
                    this.activePondChartMode = "AVG";
                    this.growthSpecies = "ALL";
                    this.growthChartMode = "ADG";
                    this.growthViewPerspective = "MODULE";
                    this.growthDocCohort = "MID_LATE";
                    window.location.hash = `#/executive-detail?metric=${metric}`;
                    this.render();
                    this.bindEvents();
                }
            });
        });

        // Month Selector
        const selectMonth = this.container.querySelector("#detail-month-select");
        if (selectMonth) {
            selectMonth.addEventListener("change", (e) => {
                this.selectedMonth = e.target.value;
                this.sortColIndex = null;
                this.sortDirection = null;
                this.refreshContent();
            });
        }

        // Search Input
        const searchInput = this.container.querySelector("#detail-search-input");
        if (searchInput) {
            searchInput.addEventListener("input", (e) => {
                this.searchQuery = e.target.value;
                this.refreshContent(false);
            });
        }

        const btnClear = this.container.querySelector("#btn-clear-detail-search");
        if (btnClear) {
            btnClear.addEventListener("click", () => {
                this.searchQuery = "";
                this.refreshContent();
            });
        }

        // Export CSV
        const btnCsv = this.container.querySelector("#btn-detail-export-csv");
        if (btnCsv) {
            btnCsv.addEventListener("click", () => {
                const vm = ExecutiveMetricsPresenter.getMetricDrillDownData(
                    this.currentMetric,
                    this.dataBundle,
                    this.selectedMonth,
                    this.searchQuery,
                    {
                        activePondMode: this.activePondChartMode,
                        prepChartMode: this.prepChartMode,
                        growthSpecies: this.growthSpecies,
                        growthChartMode: this.growthChartMode,
                        growthViewPerspective: this.growthViewPerspective,
                        growthDocCohort: this.growthDocCohort
                    }
                );
                let rowsToExport = vm.tableRows || [];
                let headersToExport = vm.tableHeaders || [];
                if (this.sortColIndex !== null && this.sortDirection) {
                    rowsToExport = ExecutiveMetricsPresenter.sortRows(rowsToExport, this.sortColIndex, this.sortDirection);
                }
                const filename = `isharp_${this.currentMetric.toLowerCase()}_${this.selectedMonth}_${Date.now()}.csv`;
                downloadCsv(filename, headersToExport, rowsToExport);
                Toast.success(`Exported ${rowsToExport.length} records to ${filename}`);
            });
        }

        // Table Header Click for Sorting
        const tableThead = this.container.querySelector(".exec-detail-table thead");
        if (tableThead) {
            tableThead.addEventListener("click", (e) => {
                const th = e.target.closest("th.sortable-th");
                if (!th) return;
                const colIdx = parseInt(th.getAttribute("data-sort-col"), 10);
                if (isNaN(colIdx)) return;

                if (this.sortColIndex === colIdx) {
                    if (this.sortDirection === "asc") {
                        this.sortDirection = "desc";
                    } else if (this.sortDirection === "desc") {
                        this.sortColIndex = null;
                        this.sortDirection = null;
                    } else {
                        this.sortDirection = "asc";
                    }
                } else {
                    this.sortColIndex = colIdx;
                    this.sortDirection = "asc";
                }

                this.refreshContent(false);
            });

            // Keyboard accessibility (Enter / Space on header)
            tableThead.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    const th = e.target.closest("th.sortable-th");
                    if (th) {
                        e.preventDefault();
                        th.click();
                    }
                }
            });
        }

        // Timeline Canvas Click
        const canvas = this.container.querySelector("#detail-timeline-canvas");
        if (canvas) {
            canvas.addEventListener("click", (e) => {
                const rect = canvas.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const clickY = e.clientY - rect.top;

                const hit = this.chartBarHitboxes.find(hb => (
                    clickX >= hb.x && clickX <= hb.x + hb.w &&
                    clickY >= hb.y && clickY <= hb.y + hb.h
                ));

                if (hit) {
                    if (this.selectedMonth === hit.monthKey) {
                        this.selectedMonth = "ALL";
                    } else {
                        this.selectedMonth = hit.monthKey;
                    }
                    this.sortColIndex = null;
                    this.sortDirection = null;
                    this.refreshContent();
                }
            });
        }
    }

    refreshContent(redrawCanvas = true) {
        const vm = ExecutiveMetricsPresenter.getMetricDrillDownData(
            this.currentMetric,
            this.dataBundle,
            this.selectedMonth,
            this.searchQuery,
            {
                activePondMode: this.activePondChartMode,
                prepChartMode: this.prepChartMode,
                growthSpecies: this.growthSpecies,
                growthChartMode: this.growthChartMode,
                growthViewPerspective: this.growthViewPerspective,
                growthDocCohort: this.growthDocCohort
            }
        );

        // Update summary stat cards
        const statCards = this.container.querySelectorAll(".exec-detail-stat-card");
        if (statCards.length > 0 && vm.summaryBadges) {
            statCards.forEach((card, idx) => {
                const b = vm.summaryBadges[idx];
                if (b) {
                    const l = card.querySelector(".exec-detail-stat-label");
                    const v = card.querySelector(".exec-detail-stat-val");
                    const s = card.querySelector(".exec-detail-stat-sub");
                    if (l) l.textContent = b.label;
                    if (v) v.textContent = b.value;
                    if (s) s.textContent = b.sub;
                }
            });
        }

        // Update count badge
        const countBadge = this.container.querySelector("#detail-count-display");
        if (countBadge) countBadge.textContent = vm.countDisplay;

        // Update timeline title
        const headline = this.container.querySelector(".timeline-headline");
        if (headline && vm.timelineTitle) headline.textContent = `📈 ${vm.timelineTitle}`;

        // Update month select value if mismatched
        const selectMonth = this.container.querySelector("#detail-month-select");
        if (selectMonth && selectMonth.value !== this.selectedMonth) {
            selectMonth.value = this.selectedMonth;
        }

        // Update table headers
        const theadTr = this.container.querySelector(".exec-detail-table thead tr");
        if (theadTr && (vm.tableHeaders || []).length > 0) {
            theadTr.innerHTML = this.buildTableHeadersHtml(vm.tableHeaders);
        }

        // Update table rows
        const tbody = this.container.querySelector("#detail-table-body");
        if (tbody) {
            tbody.innerHTML = this.buildTableRowsHtml(vm.tableRows, (vm.tableHeaders || []).length);
        }

        if (redrawCanvas && (vm.timeline || []).length > 0) {
            this.drawTimelineChart(vm.timeline);
        }
    }

    /**
     * Draws interactive canvas timeline chart.
     * @param {Array<object>} timeline 
     */
    drawTimelineChart(timeline = []) {
        const canvas = this.container.querySelector("#detail-timeline-canvas");
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        const w = rect.width || canvas.parentElement?.clientWidth || 900;
        const h = 180;

        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.scale(dpr, dpr);

        this.chartBarHitboxes = [];

        if (timeline.length === 0) {
            ctx.clearRect(0, 0, w, h);
            return;
        }

        const values = timeline.map(t => Number(t.value) || 0);
        const maxVal = Math.max(1, Math.max(...values));
        const padding = { left: 50, right: 30, top: 25, bottom: 35 };
        const plotW = w - padding.left - padding.right;
        const plotH = h - padding.top - padding.bottom;

        ctx.clearRect(0, 0, w, h);

        // Gridlines
        ctx.strokeStyle = "rgba(226, 232, 240, 0.7)";
        ctx.lineWidth = 1;
        for (let i = 0; i <= 3; i++) {
            const y = padding.top + (plotH / 3) * i;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(w - padding.right, y);
            ctx.stroke();

            const val = Math.round(maxVal - (maxVal / 3) * i);
            ctx.fillStyle = "#94a3b8";
            ctx.font = "10px ui-monospace, monospace";
            ctx.textAlign = "right";
            ctx.fillText(String(val), padding.left - 8, y + 3);
        }

        const stepX = plotW / timeline.length;
        const barW = Math.max(16, stepX * 0.52);

        timeline.forEach((item, idx) => {
            const x = padding.left + stepX * idx + (stepX - barW) / 2;
            const barH = maxVal > 0 ? (item.value / maxVal) * plotH : 0;
            const y = padding.top + (plotH - barH);

            const isSelected = this.selectedMonth === item.monthKey;

            // Bar background / fill
            if (isSelected) {
                ctx.fillStyle = "#0284c7"; // Primary selected blue
            } else if (item.value > 0) {
                ctx.fillStyle = "#38bdf8"; // Sky light
            } else {
                ctx.fillStyle = "#e2e8f0"; // Empty neutral
            }

            // Rounded top bar
            const radius = Math.min(5, barW / 2);
            ctx.beginPath();
            ctx.moveTo(x, y + radius);
            ctx.quadraticCurveTo(x, y, x + radius, y);
            ctx.lineTo(x + barW - radius, y);
            ctx.quadraticCurveTo(x + barW, y, x + barW, y + radius);
            ctx.lineTo(x + barW, padding.top + plotH);
            ctx.lineTo(x, padding.top + plotH);
            ctx.closePath();
            ctx.fill();

            // Value label above bar
            if (item.value > 0) {
                ctx.fillStyle = isSelected ? "#0369a1" : "#475569";
                ctx.font = isSelected ? "bold 11px sans-serif" : "10px sans-serif";
                ctx.textAlign = "center";
                let valText = String(item.value);
                if (item.unit === "Days") valText = `${item.value}d`;
                else if (item.unit === "g/day") valText = `${item.value}g/d`;
                else if (item.unit === "%") valText = `${item.value}%`;
                ctx.fillText(valText, x + barW / 2, Math.max(14, y - 5));
            }

            // Month / Module X-Axis Label
            const shortLabel = (item.monthKey && item.monthKey.startsWith("M"))
                ? item.monthKey
                : ((item.monthLabel || item.monthKey || "").split(" ")[0]);
            ctx.fillStyle = isSelected ? "#0284c7" : "#64748b";
            ctx.font = isSelected ? "bold 11px sans-serif" : "10px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(shortLabel, x + barW / 2, h - 14);

            // Record Hitbox for click interaction
            this.chartBarHitboxes.push({
                monthKey: item.monthKey,
                x: padding.left + stepX * idx,
                y: padding.top,
                w: stepX,
                h: plotH + padding.bottom
            });
        });
    }
}
