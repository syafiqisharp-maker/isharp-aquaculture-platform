/**
 * iSHARP DBMS 2.0 — Executive Metric Drilldown Modal
 * High-performance interactive modal featuring:
 * - 12-Month Interactive Canvas Timeline Chart (Click bar to filter month)
 * - Live Search & Month Selector Toolbar
 * - Tailored Breakdown Table with Status Badges
 * - One-Click RFC-4180 CSV Exporter
 * 
 * Clean Coding Standard: Decoupled view-model via ExecutiveMetricsPresenter.
 */

import { ExecutiveMetricsPresenter, METRIC_TYPES, formatMonthLabel } from "./ExecutiveMetricsPresenter.js";
import { downloadCsv } from "../../utils/csvExporter.js";
import { Toast } from "../../components/Toast.js";

export class ExecutiveMetricModal {
    static _instance = null;

    static getInstance() {
        if (!this._instance) {
            this._instance = new ExecutiveMetricModal();
        }
        return this._instance;
    }

    /**
     * Opens the modal for the given metric.
     * @param {string} metricType 
     * @param {object} dataBundle 
     */
    static open(metricType, dataBundle = {}) {
        const instance = this.getInstance();
        instance.show(metricType, dataBundle);
    }

    constructor() {
        this.container = null;
        this.currentMetricType = METRIC_TYPES.HARVEST;
        this.dataBundle = {};
        this.selectedMonth = "ALL";
        this.harvestChartMode = "TONNAGE";
        this.harvestSpecies = "ALL";
        this.stockingChartMode = "MILLION";
        this.stockingSpecies = "ALL";
        this.activePondChartMode = "AVG";
        this.prepChartMode = "TOTAL";
        this.growthSpecies = "ALL";
        this.growthChartMode = "ADG";
        this.growthViewPerspective = "MODULE";
        this.growthDocCohort = "MID_LATE";
        this.searchQuery = "";
        this.sortColIndex = null;
        this.sortDirection = null; // null | 'asc' | 'desc'
        this.chartBarHitboxes = [];
        this._keydownHandler = null;

        this.injectModalDom();
    }

    injectModalDom() {
        let el = document.getElementById("modal-exec-metric-drilldown");
        if (!el) {
            el = document.createElement("div");
            el.id = "modal-exec-metric-drilldown";
            el.className = "exec-metric-modal-overlay";
            el.style.display = "none";
            document.body.appendChild(el);
        }
        this.container = el;
    }

    show(metricType, dataBundle = {}) {
        this.currentMetricType = metricType;
        this.dataBundle = dataBundle;
        this.selectedMonth = "ALL";
        this.harvestChartMode = "TONNAGE";
        this.harvestSpecies = "ALL";
        this.stockingChartMode = "MILLION";
        this.stockingSpecies = "ALL";
        this.activePondChartMode = "AVG";
        this.prepChartMode = "TOTAL";
        this.growthSpecies = "ALL";
        this.growthChartMode = "ADG";
        this.growthViewPerspective = "MODULE";
        this.growthDocCohort = "MID_LATE";
        this.searchQuery = "";
        this.sortColIndex = null;
        this.sortDirection = null;

        this.container.style.display = "flex";
        document.body.style.overflow = "hidden";

        this.render();
        this.bindEvents();

        // Bind global Escape key
        if (!this._keydownHandler) {
            this._keydownHandler = (e) => {
                if (e.key === "Escape") this.close();
            };
            window.addEventListener("keydown", this._keydownHandler);
        }
    }

    close() {
        if (this.container) {
            this.container.style.display = "none";
            document.body.style.overflow = "";
        }
        if (this._keydownHandler) {
            window.removeEventListener("keydown", this._keydownHandler);
            this._keydownHandler = null;
        }
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
                    <td colspan="${Math.max(1, colCount)}" class="drilldown-empty-cell">
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
                else if (cellStr === "DAILY EXCEL (PENDING SYNC)" || cellStr === "HARVESTED (MID-WEEK)" || cellStr === "Pending DBMS Sync") badgeClass = "badge-alert-yellow";
                else if (cellStr === "SUPABASE DBMS") badgeClass = "badge-alert-green";

                if (badgeClass) {
                    return `<td><span class="drilldown-badge ${badgeClass}">${cellStr}</span></td>`;
                }
                return `<td>${cellStr}</td>`;
            }).join("");

            return `<tr>${cellsHtml}</tr>`;
        }).join("");
    }

    render() {
        const vm = ExecutiveMetricsPresenter.getMetricDrillDownData(
            this.currentMetricType,
            this.dataBundle,
            this.selectedMonth,
            this.searchQuery,
            {
                harvestChartMode: this.harvestChartMode,
                harvestSpecies: this.harvestSpecies,
                stockingChartMode: this.stockingChartMode,
                stockingSpecies: this.stockingSpecies,
                activePondMode: this.activePondChartMode,
                prepChartMode: this.prepChartMode,
                growthSpecies: this.growthSpecies,
                growthChartMode: this.growthChartMode,
                growthViewPerspective: this.growthViewPerspective,
                growthDocCohort: this.growthDocCohort
            }
        );

        const summaryBadgesHtml = (vm.summaryBadges || []).map(b => `
            <div class="drilldown-stat-card">
                <div class="drilldown-stat-label">${b.label}</div>
                <div class="drilldown-stat-val">${b.value}</div>
                <div class="drilldown-stat-sub">${b.sub}</div>
            </div>
        `).join("");

        const monthOptionsHtml = (vm.monthOptions || []).map(opt => `
            <option value="${opt.key}" ${this.selectedMonth === opt.key ? "selected" : ""}>${opt.label}</option>
        `).join("");

        const tableHeadersHtml = this.buildTableHeadersHtml(vm.tableHeaders || []);
        const tableRowsHtml = this.buildTableRowsHtml(vm.tableRows || [], (vm.tableHeaders || []).length);

        const hasTimeline = (vm.timeline || []).length > 0;
        const isHarvestMetric = this.currentMetricType === METRIC_TYPES.HARVEST;
        const harvestModeToggleHtml = isHarvestMetric ? `
            <div class="harvest-toggle-container" style="display: inline-flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                <div class="timeline-mode-toggle" aria-label="Harvest Chart Mode">
                    <span class="mode-toggle-label">Metric:</span>
                    <button type="button" class="btn-mode ${this.harvestChartMode === 'TONNAGE' ? 'active' : ''}" data-harvest-mode="TONNAGE">Biomass (MT)</button>
                    <button type="button" class="btn-mode ${this.harvestChartMode === 'PONDS' ? 'active' : ''}" data-harvest-mode="PONDS">Harvested Ponds</button>
                </div>
                <div class="timeline-mode-toggle" aria-label="Harvest Species Filter">
                    <span class="mode-toggle-label">Species:</span>
                    <button type="button" class="btn-mode ${this.harvestSpecies === 'ALL' ? 'active' : ''}" data-harvest-species="ALL">Both (VAN vs MON)</button>
                    <button type="button" class="btn-mode ${this.harvestSpecies === 'VAN' ? 'active' : ''}" data-harvest-species="VAN">VAN</button>
                    <button type="button" class="btn-mode ${this.harvestSpecies === 'MON' ? 'active' : ''}" data-harvest-species="MON">MON</button>
                </div>
            </div>
        ` : '';
        const isStockingMetric = this.currentMetricType === METRIC_TYPES.STOCKING;
        const stockingModeToggleHtml = isStockingMetric ? `
            <div class="stocking-toggle-container" style="display: inline-flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                <div class="timeline-mode-toggle" aria-label="Stocking Chart Mode">
                    <span class="mode-toggle-label">Metric:</span>
                    <button type="button" class="btn-mode ${this.stockingChartMode === 'MILLION' ? 'active' : ''}" data-stocking-mode="MILLION">Fry Volume (M)</button>
                    <button type="button" class="btn-mode ${this.stockingChartMode === 'PONDS' ? 'active' : ''}" data-stocking-mode="PONDS">Stocked Ponds</button>
                </div>
                <div class="timeline-mode-toggle" aria-label="Stocking Species Filter">
                    <span class="mode-toggle-label">Species:</span>
                    <button type="button" class="btn-mode ${this.stockingSpecies === 'ALL' ? 'active' : ''}" data-stocking-species="ALL">Both (VAN vs MON)</button>
                    <button type="button" class="btn-mode ${this.stockingSpecies === 'VAN' ? 'active' : ''}" data-stocking-species="VAN">VAN</button>
                    <button type="button" class="btn-mode ${this.stockingSpecies === 'MON' ? 'active' : ''}" data-stocking-species="MON">MON</button>
                </div>
            </div>
        ` : '';
        const isPrepMetric = this.currentMetricType === METRIC_TYPES.PREP_IDLE;
        const prepModeToggleHtml = isPrepMetric ? `
            <div class="prep-toggle-container" style="display: inline-flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                <div class="timeline-mode-toggle" aria-label="Turnaround Stage Duration Mode">
                    <span class="mode-toggle-label">Duration:</span>
                    <button type="button" class="btn-mode ${this.prepChartMode === 'TOTAL' ? 'active' : ''}" data-prep-mode="TOTAL">Total</button>
                    <button type="button" class="btn-mode ${this.prepChartMode === 'IDLE_CLEAN' ? 'active' : ''}" data-prep-mode="IDLE_CLEAN">Idle➔Clean</button>
                    <button type="button" class="btn-mode ${this.prepChartMode === 'CLEAN_FILL' ? 'active' : ''}" data-prep-mode="CLEAN_FILL">Clean➔Fill</button>
                    <button type="button" class="btn-mode ${this.prepChartMode === 'FILL_STOCK' ? 'active' : ''}" data-prep-mode="FILL_STOCK">Fill➔Stock</button>
                </div>
                <div class="timeline-mode-toggle" aria-label="Count of Ponds Worked Mode">
                    <span class="mode-toggle-label">Count of Ponds:</span>
                    <button type="button" class="btn-mode ${this.prepChartMode === 'COUNT_CLEANED' ? 'active' : ''}" data-prep-mode="COUNT_CLEANED">Cleaned</button>
                    <button type="button" class="btn-mode ${this.prepChartMode === 'COUNT_REPAIRED' ? 'active' : ''}" data-prep-mode="COUNT_REPAIRED">Repaired</button>
                    <button type="button" class="btn-mode ${this.prepChartMode === 'COUNT_FILLED' ? 'active' : ''}" data-prep-mode="COUNT_FILLED">Water Filled</button>
                </div>
            </div>
        ` : '';

        const isBioMetric = this.currentMetricType === METRIC_TYPES.BIOSECURITY;
        const bioModeToggleHtml = isBioMetric ? `
            <div class="bio-toggle-container" style="display: inline-flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                <div class="timeline-mode-toggle" aria-label="Filter by Species">
                    <span class="mode-toggle-label">Species:</span>
                    <button type="button" class="btn-mode ${this.growthSpecies === 'ALL' ? 'active' : ''}" data-growth-species="ALL">Both (VAN vs MON)</button>
                    <button type="button" class="btn-mode ${this.growthSpecies === 'VAN' ? 'active' : ''}" data-growth-species="VAN">VAN</button>
                    <button type="button" class="btn-mode ${this.growthSpecies === 'MON' ? 'active' : ''}" data-growth-species="MON">MON</button>
                </div>
                <div class="timeline-mode-toggle" aria-label="Growth & Survival Metric">
                    <span class="mode-toggle-label">Rates:</span>
                    <button type="button" class="btn-mode ${this.growthChartMode === 'ADG' ? 'active' : ''}" data-growth-mode="ADG">Daily Growth</button>
                    <button type="button" class="btn-mode ${this.growthChartMode === 'SR' ? 'active' : ''}" data-growth-mode="SR">Survival %</button>
                </div>
                <div class="timeline-mode-toggle" aria-label="Flags Mode">
                    <span class="mode-toggle-label">Count:</span>
                    <button type="button" class="btn-mode ${this.growthChartMode === 'LAGGING' ? 'active' : ''}" data-growth-mode="LAGGING">Behind Target</button>
                    <button type="button" class="btn-mode ${this.growthChartMode === 'CRITICAL_SR' ? 'active' : ''}" data-growth-mode="CRITICAL_SR">Low SR</button>
                    <button type="button" class="btn-mode ${this.growthChartMode === 'ALERTS' ? 'active' : ''}" data-growth-mode="ALERTS">Alerts</button>
                </div>
                <div class="timeline-mode-toggle" aria-label="Filter by DOC Cohort">
                    <span class="mode-toggle-label">DOC:</span>
                    <button type="button" class="btn-mode ${this.growthDocCohort === 'MID_LATE' ? 'active' : ''}" data-growth-cohort="MID_LATE" title="Mid & Late stage crops (DOC ≥ 50d)">Mid &amp; Late (&ge;50d)</button>
                    <button type="button" class="btn-mode ${this.growthDocCohort === 'LATE_ONLY' ? 'active' : ''}" data-growth-cohort="LATE_ONLY" title="Harvest candidate window only (DOC > 70d)">Late Only (&gt;70d)</button>
                </div>
                <div class="timeline-mode-toggle" aria-label="Perspective Mode">
                    <span class="mode-toggle-label">View:</span>
                    <button type="button" class="btn-mode ${this.growthViewPerspective === 'MODULE' ? 'active' : ''}" data-growth-perspective="MODULE">By Module</button>
                    <button type="button" class="btn-mode ${this.growthViewPerspective === 'MONTHLY' ? 'active' : ''}" data-growth-perspective="MONTHLY">12-Month</button>
                </div>
            </div>
        ` : '';

        this.container.innerHTML = `
            <div class="exec-metric-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="modal-metric-title">
                
                <!-- Modal Header -->
                <header class="metric-modal-header">
                    <div class="metric-modal-header-left">
                        <div class="metric-modal-icon">${vm.icon}</div>
                        <div>
                            <h2 id="modal-metric-title" class="metric-modal-title">${vm.title}</h2>
                            <p class="metric-modal-sub">${vm.subtitle}</p>
                        </div>
                    </div>
                    <button type="button" class="btn-metric-modal-close" id="btn-close-metric-modal" aria-label="Close Modal">✕</button>
                </header>

                <!-- KPI Summary Badges Strip -->
                <section class="drilldown-stat-strip">
                    ${summaryBadgesHtml}
                </section>

                <!-- Interactive Monthly Progression Timeline Canvas -->
                ${hasTimeline ? `
                    <section class="drilldown-timeline-panel">
                        <div class="timeline-panel-header">
                            <div style="display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
                                <span class="timeline-title">📈 ${vm.timelineTitle || "Monthly Operational Pond Capacity (12-Month)"}</span>
                                ${harvestModeToggleHtml}
                                ${stockingModeToggleHtml}
                                ${prepModeToggleHtml}
                                ${bioModeToggleHtml}
                            </div>
                            <span class="timeline-hint">💡 Click any bar to instantly filter the table below</span>
                        </div>
                        <div class="timeline-canvas-wrapper">
                            <canvas id="drilldown-timeline-canvas" class="drilldown-timeline-canvas"></canvas>
                        </div>
                    </section>
                ` : ""}

                <!-- Controls Toolbar -->
                <section class="drilldown-toolbar">
                    <div class="toolbar-left">
                        <div class="toolbar-control-group">
                            <label for="metric-month-select" class="toolbar-label">Filter Month:</label>
                            <select id="metric-month-select" class="toolbar-select">
                                ${monthOptionsHtml}
                            </select>
                        </div>

                        <div class="toolbar-search-box">
                            <span class="search-icon">🔍</span>
                            <input type="text" id="metric-search-input" class="toolbar-input" placeholder="Search pond, module, species..." value="${this.searchQuery}" />
                            ${this.searchQuery ? `<button type="button" id="btn-clear-search" class="btn-clear-search">✕</button>` : ""}
                        </div>
                    </div>

                    <div class="toolbar-right">
                        <span class="toolbar-count-badge" id="drilldown-count-display">${vm.countDisplay}</span>
                        <button type="button" id="btn-metric-export-csv" class="btn-action-csv" title="Download Excel CSV">
                            <span>📥 Export CSV</span>
                        </button>
                    </div>
                </section>

                <!-- Scrollable Table Section -->
                <div class="drilldown-table-container">
                    <table class="drilldown-table">
                        <thead>
                            <tr>${tableHeadersHtml}</tr>
                        </thead>
                        <tbody id="drilldown-table-body">
                            ${tableRowsHtml}
                        </tbody>
                    </table>
                </div>

                <!-- Modal Footer -->
                <footer class="metric-modal-footer">
                    <div class="footer-left-info">
                        Blue Archipelago Berhad • iSHARP Single Source of Truth
                    </div>
                    <button type="button" class="btn-modal-dismiss" id="btn-dismiss-metric-modal">
                        Close
                    </button>
                </footer>

            </div>
        `;

        if (hasTimeline) {
            this.drawTimelineChart(vm.timeline);
        }
    }

    bindEvents() {
        // Close Buttons
        const btnClose = this.container.querySelector("#btn-close-metric-modal");
        if (btnClose) btnClose.addEventListener("click", () => this.close());

        const btnDismiss = this.container.querySelector("#btn-dismiss-metric-modal");
        if (btnDismiss) btnDismiss.addEventListener("click", () => this.close());

        // Backdrop click
        this.container.addEventListener("click", (e) => {
            if (e.target === this.container) {
                this.close();
            }
        });

        // Month Selector
        const selectMonth = this.container.querySelector("#metric-month-select");
        if (selectMonth) {
            selectMonth.addEventListener("change", (e) => {
                this.selectedMonth = e.target.value;
                this.sortColIndex = null;
                this.sortDirection = null;
                this.refreshContent();
            });
        }

        // Harvest Mode Toggle (Biomass MT vs Harvested Ponds)
        const harvestModeBtns = this.container.querySelectorAll("[data-harvest-mode]");
        harvestModeBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                const mode = btn.getAttribute("data-harvest-mode");
                if (mode && this.harvestChartMode !== mode) {
                    this.harvestChartMode = mode;
                    harvestModeBtns.forEach(b => b.classList.toggle("active", b.getAttribute("data-harvest-mode") === mode));
                    this.refreshContent(true);
                }
            });
        });

        // Harvest Species Filter Toggle (ALL, VAN, MON)
        const harvestSpBtns = this.container.querySelectorAll("[data-harvest-species]");
        harvestSpBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                const sp = btn.getAttribute("data-harvest-species");
                if (sp && this.harvestSpecies !== sp) {
                    this.harvestSpecies = sp;
                    harvestSpBtns.forEach(b => b.classList.toggle("active", b.getAttribute("data-harvest-species") === sp));
                    this.refreshContent(true);
                }
            });
        });

        // Stocking Mode Toggle (MILLION, PONDS)
        const stockingModeBtns = this.container.querySelectorAll("[data-stocking-mode]");
        stockingModeBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                const mode = btn.getAttribute("data-stocking-mode");
                if (mode && this.stockingChartMode !== mode) {
                    this.stockingChartMode = mode;
                    stockingModeBtns.forEach(b => b.classList.toggle("active", b.getAttribute("data-stocking-mode") === mode));
                    this.refreshContent(true);
                }
            });
        });

        // Stocking Species Filter Toggle (ALL, VAN, MON)
        const stockingSpBtns = this.container.querySelectorAll("[data-stocking-species]");
        stockingSpBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                const sp = btn.getAttribute("data-stocking-species");
                if (sp && this.stockingSpecies !== sp) {
                    this.stockingSpecies = sp;
                    stockingSpBtns.forEach(b => b.classList.toggle("active", b.getAttribute("data-stocking-species") === sp));
                    this.refreshContent(true);
                }
            });
        });

        // Preparation Mode Toggle (Duration vs Count)
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

        // Growth & Survival Mode Toggles
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

        // Search Input
        const searchInput = this.container.querySelector("#metric-search-input");
        if (searchInput) {
            searchInput.addEventListener("input", (e) => {
                this.searchQuery = e.target.value;
                this.refreshContent(false); // Preserve canvas focus
            });
        }

        const btnClearSearch = this.container.querySelector("#btn-clear-search");
        if (btnClearSearch) {
            btnClearSearch.addEventListener("click", () => {
                this.searchQuery = "";
                this.refreshContent();
            });
        }

        // Export CSV
        const btnCsv = this.container.querySelector("#btn-metric-export-csv");
        if (btnCsv) {
            btnCsv.addEventListener("click", () => {
                const vm = ExecutiveMetricsPresenter.getMetricDrillDownData(
                    this.currentMetricType,
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
                const filename = `isharp_${this.currentMetricType.toLowerCase()}_${this.selectedMonth}_${Date.now()}.csv`;
                downloadCsv(filename, headersToExport, rowsToExport);
                Toast.success(`Exported ${rowsToExport.length} records to ${filename}`);
            });
        }

        // Table Header Click for Sorting
        const tableThead = this.container.querySelector(".drilldown-table thead");
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

            // Keyboard accessibility
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

        // Canvas Click Handler
        const canvas = this.container.querySelector("#drilldown-timeline-canvas");
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
                    if (hit.species && (hit.species === "VAN" || hit.species === "MON")) {
                        if (this.currentMetricType === METRIC_TYPES.BIOSECURITY) {
                            const isSameMonthAndSpecies = this.selectedMonth === hit.monthKey && this.growthSpecies === hit.species;
                            if (isSameMonthAndSpecies) {
                                this.selectedMonth = "ALL";
                                this.growthSpecies = "ALL";
                            } else {
                                this.selectedMonth = hit.monthKey;
                                this.growthSpecies = hit.species;
                            }
                            const growthSpBtns = this.container.querySelectorAll("[data-growth-species]");
                            growthSpBtns.forEach(b => b.classList.toggle("active", b.getAttribute("data-growth-species") === this.growthSpecies));
                        } else if (this.currentMetricType === METRIC_TYPES.STOCKING) {
                            const isSameMonthAndSpecies = this.selectedMonth === hit.monthKey && this.stockingSpecies === hit.species;
                            if (isSameMonthAndSpecies) {
                                this.selectedMonth = "ALL";
                                this.stockingSpecies = "ALL";
                            } else {
                                this.selectedMonth = hit.monthKey;
                                this.stockingSpecies = hit.species;
                            }
                            const stockingSpBtns = this.container.querySelectorAll("[data-stocking-species]");
                            stockingSpBtns.forEach(b => b.classList.toggle("active", b.getAttribute("data-stocking-species") === this.stockingSpecies));
                        } else {
                            const isSameMonthAndSpecies = this.selectedMonth === hit.monthKey && this.harvestSpecies === hit.species;
                            if (isSameMonthAndSpecies) {
                                this.selectedMonth = "ALL";
                                this.harvestSpecies = "ALL";
                            } else {
                                this.selectedMonth = hit.monthKey;
                                this.harvestSpecies = hit.species;
                            }
                            const harvestSpBtns = this.container.querySelectorAll("[data-harvest-species]");
                            harvestSpBtns.forEach(b => b.classList.toggle("active", b.getAttribute("data-harvest-species") === this.harvestSpecies));
                        }
                    } else {
                        if (this.selectedMonth === hit.monthKey) {
                            this.selectedMonth = "ALL"; // Toggle off back to all
                        } else {
                            this.selectedMonth = hit.monthKey;
                        }
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
            this.currentMetricType,
            this.dataBundle,
            this.selectedMonth,
            this.searchQuery,
            {
                harvestChartMode: this.harvestChartMode,
                harvestSpecies: this.harvestSpecies,
                stockingChartMode: this.stockingChartMode,
                stockingSpecies: this.stockingSpecies,
                activePondMode: this.activePondChartMode,
                prepChartMode: this.prepChartMode,
                growthSpecies: this.growthSpecies,
                growthChartMode: this.growthChartMode,
                growthViewPerspective: this.growthViewPerspective,
                growthDocCohort: this.growthDocCohort
            }
        );

        // Update count display
        const countEl = this.container.querySelector("#drilldown-count-display");
        if (countEl) countEl.textContent = vm.countDisplay;

        // Update timeline title
        const headline = this.container.querySelector(".timeline-title");
        if (headline && vm.timelineTitle) headline.textContent = `📈 ${vm.timelineTitle}`;

        // Update month select
        const monthSelect = this.container.querySelector("#metric-month-select");
        if (monthSelect && monthSelect.value !== this.selectedMonth) {
            monthSelect.value = this.selectedMonth;
        }

        // Update table headers
        const theadTr = this.container.querySelector(".drilldown-table thead tr");
        if (theadTr && (vm.tableHeaders || []).length > 0) {
            theadTr.innerHTML = this.buildTableHeadersHtml(vm.tableHeaders);
        }

        // Update table body
        const tbody = this.container.querySelector("#drilldown-table-body");
        if (tbody) {
            tbody.innerHTML = this.buildTableRowsHtml(vm.tableRows, (vm.tableHeaders || []).length);
        }

        if (redrawCanvas && (vm.timeline || []).length > 0) {
            this.drawTimelineChart(vm.timeline);
        }
    }

    /**
     * Draws the high-performance minimalist 12-month timeline on the canvas.
     * @param {Array<object>} timeline 
     */
    drawTimelineChart(timeline = []) {
        const canvas = this.container.querySelector("#drilldown-timeline-canvas");
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        const w = rect.width || canvas.parentElement?.clientWidth || 700;
        const h = 192;

        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.scale(dpr, dpr);

        this.chartBarHitboxes = [];

        if (timeline.length === 0) {
            ctx.clearRect(0, 0, w, h);
            return;
        }

        const firstItem = timeline[0] || {};
        const unit = firstItem.unit || "";
        const chartMode = firstItem.chartMode || "";
        const benchmarkVal = firstItem.benchmarkVal !== undefined ? firstItem.benchmarkVal : null;
        const benchmarkLabel = firstItem.benchmarkLabel || "";
        const farmAvgVal = firstItem.farmAvgVal !== undefined ? firstItem.farmAvgVal : null;

        const values = [];
        timeline.forEach(t => {
            if (t.isDualSpecies && (!t.speciesFilter || t.speciesFilter === "ALL")) {
                values.push(Number(t.vanValue) || 0, Number(t.monValue) || 0);
            } else {
                values.push(Number(t.value) || 0);
            }
        });
        if (benchmarkVal !== null && benchmarkVal > 0) values.push(Number(benchmarkVal) * 1.12);
        if (farmAvgVal !== null && farmAvgVal > 0) values.push(Number(farmAvgVal) * 1.1);

        let rawMax = Math.max(...values, 0);
        let maxVal = 1;
        if (unit === "g/day") {
            maxVal = Math.max(0.35, Math.ceil((rawMax + 0.04) * 20) / 20);
        } else if (unit === "%") {
            maxVal = Math.max(100, Math.ceil(rawMax / 10) * 10);
        } else {
            maxVal = Math.max(1, Math.ceil(rawMax * 1.12));
        }

        const padding = { left: 48, right: 28, top: 30, bottom: 42 };
        const plotW = w - padding.left - padding.right;
        const plotH = h - padding.top - padding.bottom;

        ctx.clearRect(0, 0, w, h);

        // Gridlines with decimal-aware Y-axis labels
        ctx.strokeStyle = "rgba(226, 232, 240, 0.75)";
        ctx.lineWidth = 1;
        for (let i = 0; i <= 3; i++) {
            const y = padding.top + (plotH / 3) * i;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(w - padding.right, y);
            ctx.stroke();

            const rawTick = maxVal - (maxVal / 3) * i;
            let tickLabel = "";
            if (unit === "g/day") {
                tickLabel = rawTick === 0 ? "0" : rawTick.toFixed(2);
            } else if (unit === "%") {
                tickLabel = `${Math.round(rawTick)}%`;
            } else {
                tickLabel = String(Math.round(rawTick));
            }
            ctx.fillStyle = "#94a3b8";
            ctx.font = "10px ui-monospace, monospace";
            ctx.textAlign = "right";
            ctx.fillText(tickLabel, padding.left - 6, y + 3);
        }

        const stepX = plotW / timeline.length;
        const barW = Math.max(14, stepX * 0.52);

        const drawRoundedTopBar = (bx, by, bw, bh, fillStyle) => {
            if (bh <= 0) return;
            ctx.fillStyle = fillStyle;
            const r = Math.min(4, bw / 2, bh / 2);
            ctx.beginPath();
            ctx.moveTo(bx, by + r);
            ctx.quadraticCurveTo(bx, by, bx + r, by);
            ctx.lineTo(bx + bw - r, by);
            ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + r);
            ctx.lineTo(bx + bw, padding.top + plotH);
            ctx.lineTo(bx, padding.top + plotH);
            ctx.closePath();
            ctx.fill();
        };

        const formatBarVal = (val, itemUnit, compact = false) => {
            if (itemUnit === "g/day") return compact ? Number(val).toFixed(2) : `${Number(val).toFixed(2)}g/d`;
            if (itemUnit === "%") return `${Math.round(Number(val))}%`;
            if (itemUnit === "Days") return `${val}d`;
            return String(val);
        };

        timeline.forEach((item, idx) => {
            const isSelected = this.selectedMonth === item.monthKey;
            const isDualAll = Boolean(item.isDualSpecies && (!item.speciesFilter || item.speciesFilter === "ALL"));
            const centerX = padding.left + stepX * idx + stepX / 2;

            if (isDualAll) {
                const groupW = Math.max(20, Math.min(46, stepX * 0.72));
                const gap = Math.max(2, Math.round(groupW * 0.1));
                const singleW = Math.max(8, Math.floor((groupW - gap) / 2));
                const groupX = padding.left + stepX * idx + (stepX - (singleW * 2 + gap)) / 2;

                const vanVal = Number(item.vanValue) || 0;
                const monVal = Number(item.monValue) || 0;
                const vanH = maxVal > 0 ? (vanVal / maxVal) * plotH : 0;
                const monH = maxVal > 0 ? (monVal / maxVal) * plotH : 0;
                const vanY = padding.top + (plotH - vanH);
                const monY = padding.top + (plotH - monH);
                const vanX = groupX;
                const monX = groupX + singleW + gap;

                if (isSelected) {
                    ctx.fillStyle = "rgba(2, 132, 199, 0.08)";
                    ctx.fillRect(padding.left + stepX * idx + 2, padding.top - 10, stepX - 4, plotH + 14);
                }

                if (vanVal <= 0 && monVal <= 0) {
                    drawRoundedTopBar(vanX, padding.top + plotH - 3, singleW, 3, "#e2e8f0");
                    drawRoundedTopBar(monX, padding.top + plotH - 3, singleW, 3, "#e2e8f0");
                } else {
                    if (vanVal > 0) {
                        drawRoundedTopBar(vanX, vanY, singleW, Math.max(3, vanH), isSelected ? "#0369a1" : "#0284c7");
                        ctx.fillStyle = isSelected ? "#0369a1" : "#0284c7";
                        ctx.font = isSelected ? "bold 9px sans-serif" : "8.5px sans-serif";
                        ctx.textAlign = "center";
                        ctx.fillText(formatBarVal(vanVal, item.unit, true), vanX + singleW / 2, Math.max(12, vanY - 4));
                    } else {
                        drawRoundedTopBar(vanX, padding.top + plotH - 2, singleW, 2, "#e2e8f0");
                    }

                    if (monVal > 0) {
                        drawRoundedTopBar(monX, monY, singleW, Math.max(3, monH), isSelected ? "#047857" : "#10b981");
                        ctx.fillStyle = isSelected ? "#047857" : "#059669";
                        ctx.font = isSelected ? "bold 9px sans-serif" : "8.5px sans-serif";
                        ctx.textAlign = "center";
                        ctx.fillText(formatBarVal(monVal, item.unit, true), monX + singleW / 2, Math.max(12, monY - 4));
                    } else {
                        drawRoundedTopBar(monX, padding.top + plotH - 2, singleW, 2, "#e2e8f0");
                    }
                }

                // Risk indicator dot at top of group if module/month has red alerts or critical SR
                if ((item.alertsCount > 0 || item.criticalCount > 0) && (item.chartMode === "ADG" || item.chartMode === "SR")) {
                    const topBarY = Math.min(vanVal > 0 ? vanY : padding.top + plotH, monVal > 0 ? monY : padding.top + plotH);
                    ctx.fillStyle = item.criticalCount > 0 ? "#ef4444" : "#f59e0b";
                    ctx.beginPath();
                    ctx.arc(centerX, Math.max(8, topBarY - 14), 3, 0, Math.PI * 2);
                    ctx.fill();
                }

                const midX = padding.left + stepX * idx + stepX / 2;
                this.chartBarHitboxes.push({
                    monthKey: item.monthKey,
                    species: "VAN",
                    x: padding.left + stepX * idx,
                    y: padding.top,
                    w: stepX / 2,
                    h: plotH
                });
                this.chartBarHitboxes.push({
                    monthKey: item.monthKey,
                    species: "MON",
                    x: midX,
                    y: padding.top,
                    w: stepX / 2,
                    h: plotH
                });
                this.chartBarHitboxes.push({
                    monthKey: item.monthKey,
                    species: null,
                    x: padding.left + stepX * idx,
                    y: padding.top + plotH,
                    w: stepX,
                    h: padding.bottom
                });
            } else {
                const x = padding.left + stepX * idx + (stepX - barW) / 2;
                const barH = maxVal > 0 ? (item.value / maxVal) * plotH : 0;
                const y = padding.top + (plotH - barH);

                const isMonOnly = item.isDualSpecies && item.speciesFilter === "MON";
                let fill = "#e2e8f0";
                let labelColor = "#475569";

                if (item.value > 0) {
                    if (item.chartMode === "LAGGING") {
                        fill = isSelected ? "#d97706" : "#f59e0b";
                        labelColor = "#b45309";
                    } else if (item.chartMode === "CRITICAL_SR" || item.chartMode === "ALERTS") {
                        fill = isSelected ? "#b91c1c" : "#ef4444";
                        labelColor = "#b91c1c";
                    } else if (item.chartMode === "SR" && item.value < 60) {
                        fill = isSelected ? "#b91c1c" : "#ef4444";
                        labelColor = "#b91c1c";
                    } else if (item.chartMode === "SR" && item.benchmarkVal && item.value < item.benchmarkVal) {
                        fill = isSelected ? "#d97706" : "#f59e0b";
                        labelColor = "#b45309";
                    } else if (item.chartMode === "ADG" && item.benchmarkVal && item.value < item.benchmarkVal * 0.8) {
                        fill = isSelected ? "#d97706" : "#f59e0b";
                        labelColor = "#b45309";
                    } else if (isSelected) {
                        fill = isMonOnly ? "#047857" : "#0284c7";
                        labelColor = isMonOnly ? "#047857" : "#0369a1";
                    } else {
                        fill = isMonOnly ? "#10b981" : "#38bdf8";
                        labelColor = isMonOnly ? "#059669" : "#0369a1";
                    }
                }

                drawRoundedTopBar(x, item.value > 0 ? y : (padding.top + plotH - 3), barW, item.value > 0 ? Math.max(3, barH) : 3, fill);

                if (item.value > 0) {
                    ctx.fillStyle = labelColor;
                    ctx.font = isSelected ? "bold 10px sans-serif" : "9px sans-serif";
                    ctx.textAlign = "center";
                    ctx.fillText(formatBarVal(item.value, item.unit, false), x + barW / 2, Math.max(12, y - 5));
                }

                this.chartBarHitboxes.push({
                    monthKey: item.monthKey,
                    x: padding.left + stepX * idx,
                    y: padding.top,
                    w: stepX,
                    h: plotH + padding.bottom
                });
            }

            // Month / Module X-Axis Label
            const shortLabel = (item.monthKey && item.monthKey.startsWith("M"))
                ? item.monthKey
                : ((item.monthLabel || item.monthKey || "").split(" ")[0]);
            ctx.fillStyle = isSelected ? "#0284c7" : "#475569";
            ctx.font = isSelected ? "bold 10px sans-serif" : "9px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(shortLabel, centerX, h - 18);

            // Sampled pond count pill below X-Axis label for BIOSECURITY
            if (item.pondCount !== undefined && (chartMode === "ADG" || chartMode === "SR" || chartMode === "LAGGING" || chartMode === "CRITICAL_SR" || chartMode === "ALERTS")) {
                ctx.fillStyle = item.pondCount > 0 ? "#64748b" : "#cbd5e1";
                ctx.font = "8.5px ui-monospace, monospace";
                ctx.textAlign = "center";
                ctx.fillText(`n=${item.pondCount}`, centerX, h - 6);
            }
        });

        // Draw Benchmark Target & Farm Average Dashed Reference Lines (for ADG & SR modes)
        if (benchmarkVal !== null && benchmarkVal > 0 && maxVal > 0) {
            const benchY = padding.top + plotH - (benchmarkVal / maxVal) * plotH;
            if (benchY >= padding.top - 4 && benchY <= padding.top + plotH) {
                ctx.save();
                ctx.setLineDash([5, 4]);
                ctx.strokeStyle = "rgba(16, 185, 129, 0.85)";
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(padding.left, benchY);
                ctx.lineTo(w - padding.right, benchY);
                ctx.stroke();

                if (benchmarkLabel) {
                    ctx.font = "bold 9px sans-serif";
                    const textW = ctx.measureText(benchmarkLabel).width;
                    ctx.fillStyle = "rgba(236, 253, 245, 0.92)";
                    ctx.fillRect(w - padding.right - textW - 8, Math.max(2, benchY - 12), textW + 6, 11);
                    ctx.fillStyle = "#047857";
                    ctx.textAlign = "right";
                    ctx.fillText(benchmarkLabel, w - padding.right - 5, Math.max(10, benchY - 4));
                }
                ctx.restore();
            }
        }

        if (farmAvgVal !== null && farmAvgVal > 0 && maxVal > 0) {
            const avgY = padding.top + plotH - (farmAvgVal / maxVal) * plotH;
            if (avgY >= padding.top - 4 && avgY <= padding.top + plotH) {
                ctx.save();
                ctx.setLineDash([3, 3]);
                ctx.strokeStyle = "rgba(245, 158, 11, 0.85)";
                ctx.lineWidth = 1.25;
                ctx.beginPath();
                ctx.moveTo(padding.left, avgY);
                ctx.lineTo(w - padding.right, avgY);
                ctx.stroke();

                const avgLabel = `Avg: ${formatBarVal(farmAvgVal, unit, false)}`;
                ctx.font = "bold 9px sans-serif";
                const textW = ctx.measureText(avgLabel).width;
                ctx.fillStyle = "rgba(255, 251, 235, 0.92)";
                ctx.fillRect(padding.left + 4, Math.max(2, avgY - 12), textW + 6, 11);
                ctx.fillStyle = "#b45309";
                ctx.textAlign = "left";
                ctx.fillText(avgLabel, padding.left + 7, Math.max(10, avgY - 4));
                ctx.restore();
            }
        }
    }
}
