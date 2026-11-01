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
                    <button type="button" class="btn-mode ${this.growthSpecies === 'ALL' ? 'active' : ''}" data-growth-species="ALL">All Species</button>
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
                    if (this.selectedMonth === hit.monthKey) {
                        this.selectedMonth = "ALL"; // Toggle off back to all
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
        const padding = { left: 45, right: 25, top: 25, bottom: 35 };
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
            ctx.fillText(String(val), padding.left - 6, y + 3);
        }

        const stepX = plotW / timeline.length;
        const barW = Math.max(14, stepX * 0.52);

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
            const radius = Math.min(4, barW / 2);
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
                ctx.font = isSelected ? "bold 10px sans-serif" : "9px sans-serif";
                ctx.textAlign = "center";
                let valText = String(item.value);
                if (item.unit === "Days") valText = `${item.value}d`;
                else if (item.unit === "g/day") valText = `${item.value}g/d`;
                else if (item.unit === "%") valText = `${item.value}%`;
                ctx.fillText(valText, x + barW / 2, Math.max(12, y - 5));
            }

            // Month / Module X-Axis Label
            const shortLabel = (item.monthKey && item.monthKey.startsWith("M"))
                ? item.monthKey
                : ((item.monthLabel || item.monthKey || "").split(" ")[0]);
            ctx.fillStyle = isSelected ? "#0284c7" : "#64748b";
            ctx.font = isSelected ? "bold 10px sans-serif" : "9px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(shortLabel, x + barW / 2, h - 14);

            // Record Hitbox for click interaction (entire vertical column)
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
