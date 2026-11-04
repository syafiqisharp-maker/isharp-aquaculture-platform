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
        this.harvestChartMode = "TONNAGE";
        this.harvestSpecies = "ALL";
        this.stockingChartMode = "MILLION";
        this.stockingSpecies = "ALL";
        this.speciesCompScope = "YTD";
        this.speciesCompMode = "PONDS";
        this.speciesCompSpecies = "ALL";
        this.activePondChartMode = "AVG";
        this.prepChartMode = "TOTAL";
        this.growthSpecies = "ALL";
        this.growthChartMode = "ADG";
        this.growthViewPerspective = "MODULE";
        this.growthDocCohort = "MID_LATE";
        this.docSpeciesFilter = "ALL";
        this.docStageFilter = "ALL";
        this.isDocTableExpanded = false;
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
        const needsDailyProgress = !this.dataBundle.dailyProgress || this.dataBundle.dailyProgress.length === 0;
        const needsOpCycles = !this.dataBundle.operationalCycles || this.dataBundle.operationalCycles.length === 0;
        const needsSamplings = !this.dataBundle.samplings || this.dataBundle.samplings.length === 0;
        const needsSamplings12M = !this.dataBundle.samplings12M || this.dataBundle.samplings12M.length === 0;

        if (needsHarvest || needsStocking || needsPonds || needsDailyProgress || needsOpCycles || needsSamplings || needsSamplings12M) {
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

                if (!needsPonds && needsDailyProgress) {
                    fetches.push(PondRepository.getDailyPondProgress());
                } else {
                    fetches.push(Promise.resolve(null));
                }

                const [harvestRes, stockingBatches, opCycles, samplings, samplings12M, pondPack, standaloneDailyProgress] = await Promise.all(fetches);

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
                if (standaloneDailyProgress) {
                    this.dataBundle.dailyProgress = standaloneDailyProgress || [];
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

    /**
     * Builds the 2x2 Visual Business Intelligence Chart Grid for Species Composition,
     * Hatchery Supply Mix, Broodstock Genetic Lines & Module Allocation (zero pond table).
     * @param {object} va visualAnalytics object from ExecutiveMetricsPresenter
     * @returns {string}
     */
    buildSpeciesVisualAnalyticsHtml(va) {
        if (!va) return "";

        const isPondsMode = va.chartMode === "PONDS";
        const vanPalette = ["#0284c7", "#0ea5e9", "#38bdf8", "#6366f1", "#8b5cf6", "#64748b"];
        const monPalette = ["#059669", "#10b981", "#34d399", "#0d9488", "#14b8a6", "#64748b"];

        const buildDonutSvg = (items, palette, centerTop, centerSub, accentColor) => {
            const radius = 50;
            const circumference = 2 * Math.PI * radius;
            let cumulativePct = 0;

            if (!items || items.length === 0) {
                return `
                    <svg width="136" height="136" viewBox="0 0 136 136" style="flex-shrink: 0;">
                        <circle cx="68" cy="68" r="${radius}" fill="none" stroke="#e2e8f0" stroke-width="16"></circle>
                        <text x="68" y="66" text-anchor="middle" font-size="14" font-weight="800" fill="#64748b">0</text>
                        <text x="68" y="82" text-anchor="middle" font-size="9.5" font-weight="600" fill="#94a3b8">No Data</text>
                    </svg>
                `;
            }

            const totalRaw = items.reduce((acc, it) => acc + (isPondsMode ? it.ponds : it.pcs), 0);
            const slicesHtml = items.slice(0, 6).map((it, idx) => {
                const rawVal = isPondsMode ? it.ponds : it.pcs;
                const frac = totalRaw > 0 ? (rawVal / totalRaw) : 0;
                const dash = Math.max(0, frac * circumference);
                const offset = -cumulativePct * circumference;
                cumulativePct += frac;
                const color = palette[idx % palette.length];
                return `<circle cx="68" cy="68" r="${radius}" fill="none" stroke="${color}" stroke-width="16" stroke-dasharray="${dash} ${circumference}" stroke-dashoffset="${offset}" transform="rotate(-90 68 68)"></circle>`;
            }).join("");

            return `
                <svg width="136" height="136" viewBox="0 0 136 136" style="flex-shrink: 0;">
                    <circle cx="68" cy="68" r="${radius}" fill="none" stroke="#f1f5f9" stroke-width="16"></circle>
                    ${slicesHtml}
                    <text x="68" y="64" text-anchor="middle" font-size="14.5" font-weight="800" fill="${accentColor}">${centerTop}</text>
                    <text x="68" y="81" text-anchor="middle" font-size="9.5" font-weight="600" fill="#64748b">${centerSub}</text>
                </svg>
            `;
        };

        const buildHatcheryRowsHtml = (items, palette) => {
            if (!items || items.length === 0) {
                return `<div style="padding: 1.25rem; text-align: center; color: #94a3b8; font-size: 0.82rem;">No hatchery dispatches recorded in this period.</div>`;
            }
            const maxShare = Math.max(...items.map(i => i.sharePct), 1);
            return items.map((h, idx) => {
                const color = palette[idx % palette.length];
                const barWidth = Math.max(4, Math.round((h.sharePct / maxShare) * 100));
                const plBadge = h.avgPlSize ? `<span style="background: #f1f5f9; color: #475569; padding: 0.1rem 0.4rem; border-radius: 4px; font-size: 0.68rem; font-weight: 700;">Avg PL ${h.avgPlSize}</span>` : "";
                return `
                    <div style="margin-bottom: 0.6rem;">
                        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.78rem; margin-bottom: 0.2rem; gap: 0.4rem;">
                            <div style="display: flex; align-items: center; gap: 0.4rem; font-weight: 700; color: #0f172a;">
                                <span style="width: 9px; height: 9px; border-radius: 2px; background: ${color}; display: inline-block;"></span>
                                <span>${h.source}</span>
                                ${plBadge}
                            </div>
                            <div style="font-size: 0.75rem; color: #334155; font-weight: 600;">
                                <strong>${h.ponds} Ponds</strong> • ${h.millionPcs.toFixed(2)} M <span style="color: ${color}; font-weight: 800; margin-left: 0.25rem;">(${h.sharePct}%)</span>
                            </div>
                        </div>
                        <div style="width: 100%; height: 7px; background: #f1f5f9; border-radius: 999px; overflow: hidden;">
                            <div style="width: ${barWidth}%; height: 100%; background: ${color}; border-radius: 999px;"></div>
                        </div>
                    </div>
                `;
            }).join("");
        };

        const vanCenterTop = isPondsMode ? `${va.vanTotalPonds} Ponds` : `${va.vanTotalMillion.toFixed(1)}M`;
        const vanCenterSub = isPondsMode ? `${va.vanTotalMillion.toFixed(2)}M VAN Fry` : `${va.vanTotalPonds} VAN Ponds`;
        const monCenterTop = isPondsMode ? `${va.monTotalPonds} Ponds` : `${va.monTotalMillion.toFixed(1)}M`;
        const monCenterSub = isPondsMode ? `${va.monTotalMillion.toFixed(2)}M MON Fry` : `${va.monTotalPonds} MON Ponds`;

        // Panel 3: Broodstock Genetic Lines & PL Size Profile
        const buildGeneticLineHtml = (lines, colorHex, spBadgeClass) => {
            if (!lines || lines.length === 0) {
                return `<div style="color: #94a3b8; font-size: 0.76rem; padding: 0.35rem 0;">No genetic line records</div>`;
            }
            return lines.map(l => `
                <div style="margin-bottom: 0.55rem;">
                    <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.76rem; margin-bottom: 0.18rem;">
                        <div style="display: flex; align-items: center; gap: 0.35rem; font-weight: 700; color: #1e293b;">
                            <span class="drilldown-badge ${spBadgeClass}" style="font-size: 0.65rem; padding: 0.08rem 0.35rem;">${l.species}</span>
                            <span>${l.line}</span>
                        </div>
                        <span style="font-weight: 600; color: #334155;">
                            <strong>${l.ponds} Ponds</strong> • ${l.millionPcs.toFixed(2)} M <span style="color: ${colorHex}; font-weight: 800;">(${l.sharePct}%)</span>
                        </span>
                    </div>
                    <div style="width: 100%; height: 6px; background: #f1f5f9; border-radius: 999px; overflow: hidden;">
                        <div style="width: ${Math.max(4, l.sharePct)}%; height: 100%; background: ${colorHex}; border-radius: 999px;"></div>
                    </div>
                </div>
            `).join("");
        };

        const maxPlPonds = Math.max(...(va.plSizeBuckets || []).map(b => Math.max(b.vanPonds, b.monPonds, 1)), 1);
        const plHistogramHtml = (va.plSizeBuckets || []).map(b => {
            const vanW = Math.round((b.vanPonds / maxPlPonds) * 100);
            const monW = Math.round((b.monPonds / maxPlPonds) * 100);
            return `
                <div style="margin-bottom: 0.65rem;">
                    <div style="display: flex; justify-content: space-between; font-size: 0.75rem; font-weight: 700; color: #1e293b; margin-bottom: 0.22rem;">
                        <span>${b.label}</span>
                        <span style="font-weight: 600; color: #475569;">
                            <span style="color: #0284c7; font-weight: 700;">${b.vanPonds} VAN</span> • <span style="color: #059669; font-weight: 700;">${b.monPonds} MON</span> Ponds
                        </span>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 3px;">
                        <div style="display: flex; align-items: center; gap: 0.4rem;">
                            <div style="flex: 1; height: 6px; background: #f1f5f9; border-radius: 999px; overflow: hidden;">
                                <div style="width: ${b.vanPonds > 0 ? Math.max(5, vanW) : 0}%; height: 100%; background: #0284c7; border-radius: 999px;"></div>
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.4rem;">
                            <div style="flex: 1; height: 6px; background: #f1f5f9; border-radius: 999px; overflow: hidden;">
                                <div style="width: ${b.monPonds > 0 ? Math.max(5, monW) : 0}%; height: 100%; background: #10b981; border-radius: 999px;"></div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join("");

        // Panel 4: Module Spatial Allocation (M01 - M09)
        const maxModPonds = Math.max(...(va.moduleAllocation || []).map(m => Math.max(m.activeTotal, 24)), 24);
        const moduleRowsHtml = (va.moduleAllocation || []).map(m => {
            const vanBarPct = Math.round((m.vanPonds / maxModPonds) * 100);
            const monBarPct = Math.round((m.monPonds / maxModPonds) * 100);
            return `
                <div style="display: grid; grid-template-columns: 78px 1fr 145px; align-items: center; gap: 0.65rem; margin-bottom: 0.52rem; font-size: 0.76rem;">
                    <div style="font-weight: 800; color: #0f172a;">${m.moduleLabel}</div>
                    <div style="height: 11px; background: #f1f5f9; border-radius: 999px; overflow: hidden; display: flex;">
                        ${m.vanPonds > 0 ? `<div style="width: ${vanBarPct}%; height: 100%; background: #0284c7;" title="${m.vanPonds} VAN Ponds"></div>` : ""}
                        ${m.monPonds > 0 ? `<div style="width: ${monBarPct}%; height: 100%; background: #10b981;" title="${m.monPonds} MON Ponds"></div>` : ""}
                    </div>
                    <div style="text-align: right; font-weight: 600; color: #334155; font-size: 0.73rem;">
                        <span style="color: #0284c7; font-weight: 800;">${m.vanPonds} VAN</span> • <span style="color: #059669; font-weight: 800;">${m.monPonds} MON</span>
                    </div>
                </div>
            `;
        }).join("");

        // Bottom Section: Realized Harvest Performance by Hatchery (Final SR % & ADG — Min / Avg / Max)
        const buildHarvestedPerfRowsHtml = (items, primaryColor, rangeBgColor) => {
            return ExecutiveMetricsPresenter.renderHatcheryHarvestPerfRowsHtml(items, primaryColor, rangeBgColor);
        };

        return `
            <section class="species-bi-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); gap: 1rem; margin-top: 0.25rem;">
                <!-- Card 1: Vannamei (VAN) Hatchery Supply Mix -->
                <div class="exec-detail-table-card" style="padding: 1.15rem 1.25rem;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.9rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.6rem;">
                        <div>
                            <div style="font-size: 0.92rem; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 0.4rem;">
                                <span style="width: 10px; height: 10px; border-radius: 3px; background: #0284c7; display: inline-block;"></span>
                                <span>Vannamei (VAN) Hatchery Composition</span>
                            </div>
                            <div style="font-size: 0.73rem; color: #64748b; margin-top: 0.15rem;">${va.scopeLabel} • Ranked by ${isPondsMode ? "Stocked Ponds" : "Fry Volume (M)"}</div>
                        </div>
                        <span class="drilldown-badge badge-sp-van">${va.vanHatcheries.length} Hatcheries</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 1.25rem; flex-wrap: wrap;">
                        ${buildDonutSvg(va.vanHatcheries, vanPalette, vanCenterTop, vanCenterSub, "#0284c7")}
                        <div style="flex: 1; min-width: 220px;">
                            ${buildHatcheryRowsHtml(va.vanHatcheries, vanPalette)}
                        </div>
                    </div>
                </div>

                <!-- Card 2: Monodon (MON) Hatchery Supply Mix -->
                <div class="exec-detail-table-card" style="padding: 1.15rem 1.25rem;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.9rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.6rem;">
                        <div>
                            <div style="font-size: 0.92rem; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 0.4rem;">
                                <span style="width: 10px; height: 10px; border-radius: 3px; background: #10b981; display: inline-block;"></span>
                                <span>Monodon (MON) Hatchery Composition</span>
                            </div>
                            <div style="font-size: 0.73rem; color: #64748b; margin-top: 0.15rem;">${va.scopeLabel} • Ranked by ${isPondsMode ? "Stocked Ponds" : "Fry Volume (M)"}</div>
                        </div>
                        <span class="drilldown-badge badge-sp-mon">${va.monHatcheries.length} Hatcheries</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 1.25rem; flex-wrap: wrap;">
                        ${buildDonutSvg(va.monHatcheries, monPalette, monCenterTop, monCenterSub, "#059669")}
                        <div style="flex: 1; min-width: 220px;">
                            ${buildHatcheryRowsHtml(va.monHatcheries, monPalette)}
                        </div>
                    </div>
                </div>

                <!-- Card 3: Broodstock Genetic Line Portfolio & PL Size Distribution -->
                <div class="exec-detail-table-card" style="padding: 1.15rem 1.25rem;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.9rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.6rem;">
                        <div>
                            <div style="font-size: 0.92rem; font-weight: 800; color: #0f172a;">🧬 Broodstock Genetic Lines &amp; PL Size Profile</div>
                            <div style="font-size: 0.73rem; color: #64748b; margin-top: 0.15rem;">Genetic Line (bs_line) Share &amp; Post-Larvae Size Class at Stocking</div>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.25rem;">
                        <div>
                            <div style="font-size: 0.74rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; color: #475569; margin-bottom: 0.55rem;">Broodstock Genetic Lines</div>
                            ${buildGeneticLineHtml(va.vanGeneticLines, "#0284c7", "badge-sp-van")}
                            <div style="height: 0.35rem;"></div>
                            ${buildGeneticLineHtml(va.monGeneticLines, "#059669", "badge-sp-mon")}
                        </div>
                        <div>
                            <div style="font-size: 0.74rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; color: #475569; margin-bottom: 0.55rem;">Stocked PL Size Distribution</div>
                            ${plHistogramHtml}
                        </div>
                    </div>
                </div>

                <!-- Card 4: Spatial Species Allocation Across 9 Farm Modules (M01 - M09) -->
                <div class="exec-detail-table-card" style="padding: 1.15rem 1.25rem;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.9rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.6rem;">
                        <div>
                            <div style="font-size: 0.92rem; font-weight: 800; color: #0f172a;">🗺️ Module Species Allocation (M01 – M09)</div>
                            <div style="font-size: 0.73rem; color: #64748b; margin-top: 0.15rem;">Vannamei vs Monodon Zoning Across Setiu Farm Modules (${va.scopeLabel})</div>
                        </div>
                        <div style="display: inline-flex; align-items: center; gap: 0.6rem; font-size: 0.72rem; font-weight: 700;">
                            <span style="display: inline-flex; align-items: center; gap: 0.25rem; color: #0284c7;"><span style="width: 8px; height: 8px; border-radius: 2px; background: #0284c7; display: inline-block;"></span>VAN</span>
                            <span style="display: inline-flex; align-items: center; gap: 0.25rem; color: #059669;"><span style="width: 8px; height: 8px; border-radius: 2px; background: #10b981; display: inline-block;"></span>MON</span>
                        </div>
                    </div>
                    <div>
                        ${moduleRowsHtml}
                    </div>
                </div>

                <!-- Card 5 (Bottom Left): Vannamei (VAN) Realized Harvest SR % & ADG by Hatchery -->
                <div class="exec-detail-table-card" style="padding: 1.15rem 1.25rem;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.9rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.6rem;">
                        <div>
                            <div style="font-size: 0.92rem; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 0.4rem;">
                                <span style="width: 10px; height: 10px; border-radius: 3px; background: #0284c7; display: inline-block;"></span>
                                <span>Vannamei (VAN) Harvested SR % &amp; ADG by Hatchery</span>
                            </div>
                            <div style="font-size: 0.73rem; color: #64748b; margin-top: 0.15rem;">Realized Final Harvest Outcomes (${va.currentYear} Harvested Ponds Only • Min / Avg / Max)</div>
                        </div>
                        <span class="drilldown-badge badge-sp-van">${(va.vanHarvestPerf || []).reduce((a, b) => a + b.harvestedPonds, 0)} Harvested Ponds</span>
                    </div>
                    <div>
                        ${buildHarvestedPerfRowsHtml(va.vanHarvestPerf || [], "#0284c7", "#38bdf8")}
                    </div>
                </div>

                <!-- Card 6 (Bottom Right): Monodon (MON) Realized Harvest SR % & ADG by Hatchery -->
                <div class="exec-detail-table-card" style="padding: 1.15rem 1.25rem;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.9rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.6rem;">
                        <div>
                            <div style="font-size: 0.92rem; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 0.4rem;">
                                <span style="width: 10px; height: 10px; border-radius: 3px; background: #10b981; display: inline-block;"></span>
                                <span>Monodon (MON) Harvested SR % &amp; ADG by Hatchery</span>
                            </div>
                            <div style="font-size: 0.73rem; color: #64748b; margin-top: 0.15rem;">Realized Final Harvest Outcomes (${va.currentYear} Harvested Ponds Only • Min / Avg / Max)</div>
                        </div>
                        <span class="drilldown-badge badge-sp-mon">${(va.monHarvestPerf || []).reduce((a, b) => a + b.harvestedPonds, 0)} Harvested Ponds</span>
                    </div>
                    <div>
                        ${buildHarvestedPerfRowsHtml(va.monHarvestPerf || [], "#059669", "#34d399")}
                    </div>
                </div>
            </section>
        `;
    }

    /**
     * Builds the 4-Card Business Intelligence Visual Suite for DOC & Culture Stage Composition.
     * @param {object} docVa Visual analytics bundle from ExecutiveMetricsPresenter
     * @returns {string} HTML string
     */
    buildDocVisualAnalyticsHtml(docVa) {
        if (!docVa) return "";

        const van = docVa.vanStats || {};
        const mon = docVa.monStats || {};
        const overall = docVa.overallStats || {};
        const isVanFilter = docVa.docSpeciesFilter === "VAN";
        const isMonFilter = docVa.docSpeciesFilter === "MON";

        // Helper to render stage funnel bar
        const renderStageBar = (earlyPct, midPct, finPct, primaryColor) => {
            return `
                <div style="position: relative; height: 12px; background: #e2e8f0; border-radius: 999px; overflow: hidden; display: flex; margin: 0.5rem 0 0.25rem 0;">
                    <div style="width: ${earlyPct}%; background: ${primaryColor}; opacity: 0.35;" title="Early: ${earlyPct}%"></div>
                    <div style="width: ${midPct}%; background: ${primaryColor}; opacity: 0.7;" title="Mid: ${midPct}%"></div>
                    <div style="width: ${finPct}%; background: ${primaryColor}; opacity: 1;" title="Finishing: ${finPct}%"></div>
                </div>
            `;
        };

        // Module Synchrony Rows
        const moduleRowsHtml = (docVa.moduleSynchrony || []).map(m => {
            return `
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.65rem; padding: 0.35rem 0.5rem; background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 6px; margin-bottom: 0.35rem; font-size: 0.74rem;">
                    <div style="min-width: 65px; font-weight: 800; color: #0f172a;">${m.module} (${m.totalActive} P)</div>
                    <div style="flex: 1; height: 8px; background: #e2e8f0; border-radius: 999px; overflow: hidden; display: flex;">
                        <div style="width: ${m.earlyPct}%; background: #38bdf8;" title="Early: ${m.early} ponds"></div>
                        <div style="width: ${m.midPct}%; background: #f59e0b;" title="Mid: ${m.mid} ponds"></div>
                        <div style="width: ${m.finishingPct}%; background: #10b981;" title="Finishing: ${m.finishing} ponds"></div>
                    </div>
                    <div style="min-width: 130px; text-align: right;">
                        <span class="drilldown-badge ${m.syncBadgeClass}" style="font-size: 0.65rem; padding: 0.1rem 0.45rem;">${m.syncStatus}</span>
                    </div>
                </div>
            `;
        }).join("");

        // Harvest Tiers
        const imminentCount = docVa.imminentCandidates?.length || 0;
        const nearTermCount = docVa.nearTermCandidates?.length || 0;
        const approachingCount = docVa.approachingCandidates?.length || 0;

        return `
            <section class="doc-bi-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); gap: 1rem; margin-top: 0.25rem;">
                
                <!-- Card 1: Culture Stage Progression Funnel (VAN vs MON) -->
                <div class="exec-detail-table-card" style="padding: 1.15rem 1.25rem;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.9rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.6rem;">
                        <div>
                            <div style="font-size: 0.92rem; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 0.4rem;">
                                <span>🔄 Culture Stage Progression Funnel</span>
                            </div>
                            <div style="font-size: 0.73rem; color: #64748b; margin-top: 0.15rem;">Species Lifecycle Asymmetry • Early ➔ Mid ➔ Finishing Tracks</div>
                        </div>
                        <span class="drilldown-badge badge-status-culture">${isVanFilter ? `${van.count} VAN Ponds` : (isMonFilter ? `${mon.count} MON Ponds` : `${overall.count} Active Ponds`)}</span>
                    </div>

                    <!-- Vannamei Funnel -->
                    <div style="margin-bottom: 1.1rem; padding: 0.75rem 0.85rem; background: #f0f9ff; border: ${isVanFilter ? '2px solid #0284c7' : '1px solid #e0f2fe'}; border-radius: 0.6rem; ${isMonFilter ? 'opacity: 0.55;' : ''} transition: all 0.2s ease;">
                        <div style="display: flex; justify-content: space-between; align-items: baseline; font-size: 0.78rem;">
                            <span style="font-weight: 800; color: #0369a1; display: inline-flex; align-items: center; gap: 0.4rem;">
                                <span>Vannamei (VAN) — ${van.count} Ponds</span>
                                ${isVanFilter ? '<span class="drilldown-badge badge-sp-van" style="font-size: 0.62rem; padding: 0.05rem 0.4rem;">Selected Lens</span>' : ''}
                            </span>
                            <span style="font-size: 0.72rem; color: #0284c7; font-weight: 700;">Avg ${van.avgDoc}d (Min ${van.minDoc}d – Max ${van.maxDoc}d)</span>
                        </div>
                        ${renderStageBar(van.earlyPct, van.midPct, van.finishingPct, "#0284c7")}
                        <div style="display: flex; justify-content: space-between; font-size: 0.7rem; color: #475569; font-weight: 600; margin-top: 0.35rem;">
                            <span>🌱 Early (<30d): ${van.early} P (${van.earlyPct}%)</span>
                            <span>⚡ Mid (30–60d): ${van.mid} P (${van.midPct}%)</span>
                            <span>🎯 Finishing (>60d): ${van.finishing} P (${van.finishingPct}%)</span>
                        </div>
                        ${van.extended > 0 ? `
                            <div style="margin-top: 0.45rem; padding: 0.25rem 0.5rem; background: #fee2e2; color: #991b1b; border-radius: 4px; font-size: 0.68rem; font-weight: 700; display: flex; align-items: center; justify-content: space-between;">
                                <span>⚠️ ${van.extended} Vannamei Ponds at Extended DOC (> 90d)</span>
                                <span>Max ${van.maxDoc}d</span>
                            </div>
                        ` : ""}
                    </div>

                    <!-- Monodon Funnel -->
                    <div style="padding: 0.75rem 0.85rem; background: #ecfdf5; border: ${isMonFilter ? '2px solid #059669' : '1px solid #d1fae5'}; border-radius: 0.6rem; ${isVanFilter ? 'opacity: 0.55;' : ''} transition: all 0.2s ease;">
                        <div style="display: flex; justify-content: space-between; align-items: baseline; font-size: 0.78rem;">
                            <span style="font-weight: 800; color: #065f46; display: inline-flex; align-items: center; gap: 0.4rem;">
                                <span>Monodon (MON) — ${mon.count} Ponds</span>
                                ${isMonFilter ? '<span class="drilldown-badge badge-sp-mon" style="font-size: 0.62rem; padding: 0.05rem 0.4rem;">Selected Lens</span>' : ''}
                            </span>
                            <span style="font-size: 0.72rem; color: #059669; font-weight: 700;">Avg ${mon.avgDoc}d (Min ${mon.minDoc}d – Max ${mon.maxDoc}d)</span>
                        </div>
                        ${renderStageBar(mon.earlyPct, mon.midPct, mon.finishingPct, "#059669")}
                        <div style="display: flex; justify-content: space-between; font-size: 0.7rem; color: #475569; font-weight: 600; margin-top: 0.35rem;">
                            <span>🌱 Early (<50d): ${mon.early} P (${mon.earlyPct}%)</span>
                            <span>⚡ Mid (50–90d): ${mon.mid} P (${mon.midPct}%)</span>
                            <span>🎯 Finishing (>90d): ${mon.finishing} P (${mon.finishingPct}%)</span>
                        </div>
                        ${mon.extended > 0 ? `
                            <div style="margin-top: 0.45rem; padding: 0.25rem 0.5rem; background: #fee2e2; color: #991b1b; border-radius: 4px; font-size: 0.68rem; font-weight: 700; display: flex; align-items: center; justify-content: space-between;">
                                <span>⚠️ ${mon.extended} Monodon Ponds at Extended DOC (> 120d)</span>
                                <span>Max ${mon.maxDoc}d</span>
                            </div>
                        ` : ""}
                    </div>
                </div>

                <!-- Card 2: Harvest Readiness & Maturation Pipeline -->
                <div class="exec-detail-table-card" style="padding: 1.15rem 1.25rem;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.9rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.6rem;">
                        <div>
                            <div style="font-size: 0.92rem; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 0.4rem;">
                                <span>🎯 Harvest Readiness &amp; Commercial Pipeline</span>
                            </div>
                            <div style="font-size: 0.73rem; color: #64748b; margin-top: 0.15rem;">Actionable Harvest Schedule Across 3 Maturation Horizons</div>
                        </div>
                        <span class="drilldown-badge badge-status-ready">${imminentCount + nearTermCount} Near-Term${isVanFilter ? " (VAN)" : (isMonFilter ? " (MON)" : "")}</span>
                    </div>

                    <!-- Tier 1: Imminent Harvest (Ready Now) -->
                    <div style="padding: 0.75rem 0.85rem; background: #fff1f2; border: 1px solid #fecdd3; border-radius: 0.6rem; margin-bottom: 0.65rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <div style="font-size: 0.8rem; font-weight: 800; color: #9f1239;">🚨 Tier 1: Harvest Candidates (Ready Now)</div>
                                <div style="font-size: 0.7rem; color: #be123c; margin-top: 0.15rem;">${isMonFilter ? "MON DOC ≥ 110d (Immediate Action)" : (isVanFilter ? "VAN DOC ≥ 80d (Immediate Action)" : "VAN DOC ≥ 80d • MON DOC ≥ 110d (Immediate Action)")}</div>
                            </div>
                            <span class="drilldown-badge badge-alert-red">${imminentCount} Ponds</span>
                        </div>
                    </div>

                    <!-- Tier 2: 14-Day Next-in-Line Candidates -->
                    <div style="padding: 0.75rem 0.85rem; background: #fffbeb; border: 1px solid #fef3c7; border-radius: 0.6rem; margin-bottom: 0.65rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <div style="font-size: 0.8rem; font-weight: 800; color: #92400e;">🟡 Tier 2: 14-Day Next-in-Line Window</div>
                                <div style="font-size: 0.7rem; color: #b45309; margin-top: 0.15rem;">${isMonFilter ? "MON DOC 90–109d (Buyer Sizing Sampling)" : (isVanFilter ? "VAN DOC 70–79d (Buyer Sizing Sampling)" : "VAN DOC 70–79d • MON DOC 90–109d (Buyer Sizing Sampling)")}</div>
                            </div>
                            <span class="drilldown-badge badge-alert-yellow">${nearTermCount} Ponds</span>
                        </div>
                    </div>

                    <!-- Tier 3: 30-Day Pipeline -->
                    <div style="padding: 0.75rem 0.85rem; background: #f0fdf4; border: 1px solid #dcfce7; border-radius: 0.6rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <div style="font-size: 0.8rem; font-weight: 800; color: #166534;">🟢 Tier 3: 30-Day Maturing Cohort</div>
                                <div style="font-size: 0.7rem; color: #15803d; margin-top: 0.15rem;">${isMonFilter ? "MON DOC 75–89d (Pre-Harvest Feed & ABW)" : (isVanFilter ? "VAN DOC 55–69d (Pre-Harvest Feed & ABW)" : "VAN DOC 55–69d • MON DOC 75–89d (Pre-Harvest Feed & ABW)")}</div>
                            </div>
                            <span class="drilldown-badge badge-alert-green">${approachingCount} Ponds</span>
                        </div>
                    </div>
                </div>

                <!-- Card 3: Spatial Module Stage Synchrony (M01 – M09) -->
                <div class="exec-detail-table-card" style="padding: 1.15rem 1.25rem;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.9rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.6rem;">
                        <div>
                            <div style="font-size: 0.92rem; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 0.4rem;">
                                <span>🗺️ Spatial Module Stage Synchrony</span>
                            </div>
                            <div style="font-size: 0.73rem; color: #64748b; margin-top: 0.15rem;">${isVanFilter ? "Vannamei Stage Mix across Modules (M01 – M09)" : (isMonFilter ? "Monodon Stage Mix across Modules (M01 – M09)" : "Module-Wide Cohort Age Mix (M01 – M09) • Batch Turnaround Potential")}</div>
                        </div>
                        <div style="display: inline-flex; align-items: center; gap: 0.5rem; font-size: 0.68rem; font-weight: 700;">
                            <span style="color: #38bdf8;">■ Early</span>
                            <span style="color: #f59e0b;">■ Mid</span>
                            <span style="color: #10b981;">■ Fin</span>
                        </div>
                    </div>
                    <div>
                        ${moduleRowsHtml}
                    </div>
                </div>

                <!-- Card 4: Biosecurity Health & Risk by Culture Stage -->
                <div class="exec-detail-table-card" style="padding: 1.15rem 1.25rem;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.9rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.6rem;">
                        <div>
                            <div style="font-size: 0.92rem; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 0.4rem;">
                                <span>🛡️ Biosecurity Health &amp; Risk by Stage</span>
                            </div>
                            <div style="font-size: 0.73rem; color: #64748b; margin-top: 0.15rem;">Cross-Tabulation of Lab Pathogen &amp; Mortality Alerts by Life Stage${isVanFilter ? " (VAN Only)" : (isMonFilter ? " (MON Only)" : "")}</div>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; text-align: center;">
                        <!-- Early Stage Box -->
                        <div style="padding: 0.85rem 0.5rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0.6rem;">
                            <div style="font-size: 0.74rem; font-weight: 800; color: #0284c7; text-transform: uppercase;">${isVanFilter ? "🌱 Early (&lt;30d)" : (isMonFilter ? "🌱 Early (&lt;50d)" : "🌱 Early (VAN &lt;30d • MON &lt;50d)")}</div>
                            <div style="font-size: 1.35rem; font-weight: 900; color: #0f172a; margin: 0.35rem 0;">${docVa.stageBiosecurity?.early?.total || 0}</div>
                            <div style="font-size: 0.68rem; color: #64748b; line-height: 1.4;">
                                <div><strong style="color: #059669;">${docVa.stageBiosecurity?.early?.green || 0}</strong> Clean</div>
                                <div><strong style="color: #d97706;">${docVa.stageBiosecurity?.early?.yellow || 0}</strong> Yellow</div>
                                <div><strong style="color: #dc2626;">${docVa.stageBiosecurity?.early?.red || 0}</strong> Red Alert</div>
                            </div>
                        </div>

                        <!-- Mid Stage Box -->
                        <div style="padding: 0.85rem 0.5rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0.6rem;">
                            <div style="font-size: 0.74rem; font-weight: 800; color: #d97706; text-transform: uppercase;">${isVanFilter ? "⚡ Mid (30–60d)" : (isMonFilter ? "⚡ Mid (50–90d)" : "⚡ Mid (VAN 30–60d • MON 50–90d)")}</div>
                            <div style="font-size: 1.35rem; font-weight: 900; color: #0f172a; margin: 0.35rem 0;">${docVa.stageBiosecurity?.mid?.total || 0}</div>
                            <div style="font-size: 0.68rem; color: #64748b; line-height: 1.4;">
                                <div><strong style="color: #059669;">${docVa.stageBiosecurity?.mid?.green || 0}</strong> Clean</div>
                                <div><strong style="color: #d97706;">${docVa.stageBiosecurity?.mid?.yellow || 0}</strong> Yellow</div>
                                <div><strong style="color: #dc2626;">${docVa.stageBiosecurity?.mid?.red || 0}</strong> Red Alert</div>
                            </div>
                        </div>

                        <!-- Finishing Stage Box -->
                        <div style="padding: 0.85rem 0.5rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0.6rem;">
                            <div style="font-size: 0.74rem; font-weight: 800; color: #059669; text-transform: uppercase;">${isVanFilter ? "🎯 Finishing (&gt;60d)" : (isMonFilter ? "🎯 Finishing (&gt;90d)" : "🎯 Finishing (VAN &gt;60d • MON &gt;90d)")}</div>
                            <div style="font-size: 1.35rem; font-weight: 900; color: #0f172a; margin: 0.35rem 0;">${docVa.stageBiosecurity?.finishing?.total || 0}</div>
                            <div style="font-size: 0.68rem; color: #64748b; line-height: 1.4;">
                                <div><strong style="color: #059669;">${docVa.stageBiosecurity?.finishing?.green || 0}</strong> Clean</div>
                                <div><strong style="color: #d97706;">${docVa.stageBiosecurity?.finishing?.yellow || 0}</strong> Yellow</div>
                                <div><strong style="color: #dc2626;">${docVa.stageBiosecurity?.finishing?.red || 0}</strong> Red Alert</div>
                            </div>
                        </div>
                    </div>
                </div>

            </section>
        `;
    }

    render() {
        if (!this.container) return;

        const vm = ExecutiveMetricsPresenter.getMetricDrillDownData(
            this.currentMetric,
            this.dataBundle,
            this.selectedMonth,
            this.searchQuery,
            {
                harvestChartMode: this.harvestChartMode,
                harvestSpecies: this.harvestSpecies,
                stockingChartMode: this.stockingChartMode,
                stockingSpecies: this.stockingSpecies,
                speciesCompScope: this.speciesCompScope,
                speciesCompMode: this.speciesCompMode,
                speciesCompSpecies: this.speciesCompSpecies,
                activePondMode: this.activePondChartMode,
                prepChartMode: this.prepChartMode,
                growthSpecies: this.growthSpecies,
                growthChartMode: this.growthChartMode,
                growthViewPerspective: this.growthViewPerspective,
                growthDocCohort: this.growthDocCohort,
                docSpeciesFilter: this.docSpeciesFilter,
                docStageFilter: this.docStageFilter
            }
        );

        // Metric Switcher Tabs HTML
        const switcherTabsHtml = METRIC_TABS.map(tab => `
            <button type="button" class="btn-metric-pill ${this.currentMetric === tab.key ? 'active' : ''}" data-switch-metric="${tab.key}">
                <span>${tab.icon} ${tab.label}</span>
            </button>
        `).join("");

        // Harvest Mode Toggle (for HARVEST: Biomass MT vs Harvested Ponds + Dual Bar Species Legend)
        const isHarvestMetric = this.currentMetric === METRIC_TYPES.HARVEST;
        const harvestModeToggleHtml = isHarvestMetric ? `
            <div class="harvest-toggle-container" style="display: inline-flex; align-items: center; gap: 0.65rem; flex-wrap: wrap;">
                <div class="timeline-mode-toggle" aria-label="Harvest Chart Mode">
                    <span class="mode-toggle-label">Metric:</span>
                    <button type="button" class="btn-mode ${this.harvestChartMode === 'TONNAGE' ? 'active' : ''}" data-harvest-mode="TONNAGE" title="Show monthly harvested biomass in Metric Tons (MT)">Biomass (MT)</button>
                    <button type="button" class="btn-mode ${this.harvestChartMode === 'PONDS' ? 'active' : ''}" data-harvest-mode="PONDS" title="Show monthly number of harvested ponds (Supabase DBMS + Daily Excel)">Harvested Ponds</button>
                </div>
                <div class="timeline-mode-toggle" aria-label="Harvest Species Filter">
                    <span class="mode-toggle-label">Species:</span>
                    <button type="button" class="btn-mode ${this.harvestSpecies === 'ALL' ? 'active' : ''}" data-harvest-species="ALL" title="Compare Vannamei vs Monodon side-by-side">Both (VAN vs MON)</button>
                    <button type="button" class="btn-mode ${this.harvestSpecies === 'VAN' ? 'active' : ''}" data-harvest-species="VAN" title="Filter to Vannamei (VAN) harvests" style="display: inline-flex; align-items: center; gap: 0.3rem;">
                        <span style="width: 8px; height: 8px; border-radius: 2px; background: #0284c7; display: inline-block;"></span>VAN
                    </button>
                    <button type="button" class="btn-mode ${this.harvestSpecies === 'MON' ? 'active' : ''}" data-harvest-species="MON" title="Filter to Monodon (MON) harvests" style="display: inline-flex; align-items: center; gap: 0.3rem;">
                        <span style="width: 8px; height: 8px; border-radius: 2px; background: #10b981; display: inline-block;"></span>MON
                    </button>
                </div>
            </div>
        ` : '';

        // Stocking Mode Toggle (for STOCKING: Fry Volume M vs Stocked Ponds + Dual Bar Species Legend)
        const isStockingMetric = this.currentMetric === METRIC_TYPES.STOCKING;
        const stockingModeToggleHtml = isStockingMetric ? `
            <div class="stocking-toggle-container" style="display: inline-flex; align-items: center; gap: 0.65rem; flex-wrap: wrap;">
                <div class="timeline-mode-toggle" aria-label="Stocking Chart Mode">
                    <span class="mode-toggle-label">Metric:</span>
                    <button type="button" class="btn-mode ${this.stockingChartMode === 'MILLION' ? 'active' : ''}" data-stocking-mode="MILLION" title="Show monthly stocked fry volume in Millions (M)">Fry Volume (M)</button>
                    <button type="button" class="btn-mode ${this.stockingChartMode === 'PONDS' ? 'active' : ''}" data-stocking-mode="PONDS" title="Show monthly number of stocked ponds (Supabase DBMS + Daily Excel)">Stocked Ponds</button>
                </div>
                <div class="timeline-mode-toggle" aria-label="Stocking Species Filter">
                    <span class="mode-toggle-label">Species:</span>
                    <button type="button" class="btn-mode ${this.stockingSpecies === 'ALL' ? 'active' : ''}" data-stocking-species="ALL" title="Compare Vannamei vs Monodon side-by-side">Both (VAN vs MON)</button>
                    <button type="button" class="btn-mode ${this.stockingSpecies === 'VAN' ? 'active' : ''}" data-stocking-species="VAN" title="Filter to Vannamei (VAN) stocking" style="display: inline-flex; align-items: center; gap: 0.3rem;">
                        <span style="width: 8px; height: 8px; border-radius: 2px; background: #0284c7; display: inline-block;"></span>VAN
                    </button>
                    <button type="button" class="btn-mode ${this.stockingSpecies === 'MON' ? 'active' : ''}" data-stocking-species="MON" title="Filter to Monodon (MON) stocking" style="display: inline-flex; align-items: center; gap: 0.3rem;">
                        <span style="width: 8px; height: 8px; border-radius: 2px; background: #10b981; display: inline-block;"></span>MON
                    </button>
                </div>
            </div>
        ` : '';

        // Species Composition & Hatchery Intelligence Mode Toggle (for SPECIES_COMP)
        const isSpeciesCompMetric = this.currentMetric === METRIC_TYPES.SPECIES_COMP;
        const speciesCompToggleHtml = isSpeciesCompMetric ? `
            <div class="species-comp-toggle-container" style="display: inline-flex; align-items: center; gap: 0.65rem; flex-wrap: wrap;">
                <div class="timeline-mode-toggle" aria-label="Species Composition Scope">
                    <span class="mode-toggle-label">Scope:</span>
                    <button type="button" class="btn-mode ${this.speciesCompScope === 'YTD' ? 'active' : ''}" data-spcomp-scope="YTD" title="All ponds stocked in Calendar Year (YTD)">Calendar YTD</button>
                    <button type="button" class="btn-mode ${this.speciesCompScope === 'ACTIVE' ? 'active' : ''}" data-spcomp-scope="ACTIVE" title="Currently active culturing ponds only">Active Culturing Crop</button>
                </div>
                <div class="timeline-mode-toggle" aria-label="Species Composition Metric Mode">
                    <span class="mode-toggle-label">Metric:</span>
                    <button type="button" class="btn-mode ${this.speciesCompMode === 'PONDS' ? 'active' : ''}" data-spcomp-mode="PONDS" title="Rank and display by Stocked Ponds">Stocked Ponds</button>
                    <button type="button" class="btn-mode ${this.speciesCompMode === 'MILLION' ? 'active' : ''}" data-spcomp-mode="MILLION" title="Rank and display by Fry Volume in Millions (M)">Fry Volume (M)</button>
                </div>
                <div class="timeline-mode-toggle" aria-label="Species Composition Species Filter">
                    <span class="mode-toggle-label">Species:</span>
                    <button type="button" class="btn-mode ${this.speciesCompSpecies === 'ALL' ? 'active' : ''}" data-spcomp-species="ALL" title="Compare Vannamei vs Monodon side-by-side">Both (VAN vs MON)</button>
                    <button type="button" class="btn-mode ${this.speciesCompSpecies === 'VAN' ? 'active' : ''}" data-spcomp-species="VAN" style="display: inline-flex; align-items: center; gap: 0.3rem;">
                        <span style="width: 8px; height: 8px; border-radius: 2px; background: #0284c7; display: inline-block;"></span>VAN
                    </button>
                    <button type="button" class="btn-mode ${this.speciesCompSpecies === 'MON' ? 'active' : ''}" data-spcomp-species="MON" style="display: inline-flex; align-items: center; gap: 0.3rem;">
                        <span style="width: 8px; height: 8px; border-radius: 2px; background: #10b981; display: inline-block;"></span>MON
                    </button>
                </div>
            </div>
        ` : '';

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
                    <button type="button" class="btn-mode ${this.growthSpecies === 'ALL' ? 'active' : ''}" data-growth-species="ALL" title="Compare Vannamei vs Monodon side-by-side">Both (VAN vs MON)</button>
                    <button type="button" class="btn-mode ${this.growthSpecies === 'VAN' ? 'active' : ''}" data-growth-species="VAN" title="Penaeus vannamei crops only" style="display: inline-flex; align-items: center; gap: 0.3rem;">
                        <span style="width: 8px; height: 8px; border-radius: 2px; background: #0284c7; display: inline-block;"></span>VAN
                    </button>
                    <button type="button" class="btn-mode ${this.growthSpecies === 'MON' ? 'active' : ''}" data-growth-species="MON" title="Penaeus monodon crops only" style="display: inline-flex; align-items: center; gap: 0.3rem;">
                        <span style="width: 8px; height: 8px; border-radius: 2px; background: #10b981; display: inline-block;"></span>MON
                    </button>
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

        // DOC & Culture Stage Mode Toggles
        const docCompToggleHtml = this.currentMetric === METRIC_TYPES.DOC_COMP ? `
            <div class="timeline-mode-toggle" aria-label="DOC Cohort Species">
                <span class="mode-toggle-label">Species:</span>
                <button type="button" class="btn-mode ${this.docSpeciesFilter === 'ALL' ? 'active' : ''}" data-doc-species="ALL" title="View Both Vannamei &amp; Monodon cohorts">Both Species</button>
                <button type="button" class="btn-mode ${this.docSpeciesFilter === 'VAN' ? 'active' : ''}" data-doc-species="VAN" title="View Vannamei (VAN) cohorts only">VAN Only</button>
                <button type="button" class="btn-mode ${this.docSpeciesFilter === 'MON' ? 'active' : ''}" data-doc-species="MON" title="View Monodon (MON) cohorts only">MON Only</button>
            </div>
        ` : '';

        let earlyFilterLabel = "🌱 Early";
        let midFilterLabel = "⚡ Mid";
        let finishingFilterLabel = "🎯 Finishing";
        let extendedFilterLabel = "⚠️ Extended";
        if (this.docSpeciesFilter === "VAN") {
            earlyFilterLabel = "🌱 Early (&lt;30d)";
            midFilterLabel = "⚡ Mid (30–60d)";
            finishingFilterLabel = "🎯 Finishing (&gt;60d)";
            extendedFilterLabel = "⚠️ Extended (&gt;90d)";
        } else if (this.docSpeciesFilter === "MON") {
            earlyFilterLabel = "🌱 Early (&lt;50d)";
            midFilterLabel = "⚡ Mid (50–90d)";
            finishingFilterLabel = "🎯 Finishing (&gt;90d)";
            extendedFilterLabel = "⚠️ Extended (&gt;120d)";
        }

        const docStageFilterHtml = this.currentMetric === METRIC_TYPES.DOC_COMP ? `
            <div class="detail-control-item" style="display: flex; align-items: center; gap: 0.35rem; margin-left: 0.35rem;">
                <label class="detail-toolbar-label">Stage Filter:</label>
                <div class="timeline-toggle-group">
                    <button type="button" class="btn-toggle-timeline ${this.docStageFilter === 'ALL' ? 'active' : ''}" data-doc-stage="ALL">All Active</button>
                    <button type="button" class="btn-toggle-timeline ${this.docStageFilter === 'EARLY' ? 'active' : ''}" data-doc-stage="EARLY">${earlyFilterLabel}</button>
                    <button type="button" class="btn-toggle-timeline ${this.docStageFilter === 'MID' ? 'active' : ''}" data-doc-stage="MID">${midFilterLabel}</button>
                    <button type="button" class="btn-toggle-timeline ${this.docStageFilter === 'FINISHING' ? 'active' : ''}" data-doc-stage="FINISHING">${finishingFilterLabel}</button>
                    <button type="button" class="btn-toggle-timeline ${this.docStageFilter === 'EXTENDED' ? 'active' : ''}" data-doc-stage="EXTENDED">${extendedFilterLabel}</button>
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
                                    ${harvestModeToggleHtml}
                                    ${stockingModeToggleHtml}
                                    ${speciesCompToggleHtml}
                                    ${modeToggleHtml}
                                    ${prepModeToggleHtml}
                                    ${bioModeToggleHtml}
                                    ${docCompToggleHtml}
                                </div>
                                <span class="timeline-interactive-hint">${vm.hideDataTable ? "💡 Click any month bar to filter the visual charts below" : (this.currentMetric === METRIC_TYPES.DOC_COMP ? "💡 Click any cohort bar to filter & expand the pond directory below" : "💡 Click any month bar to instantly filter the table below")}</span>
                            </div>
                            <div class="exec-detail-canvas-box">
                                <canvas id="detail-timeline-canvas" class="exec-detail-canvas"></canvas>
                            </div>
                        </section>
                    ` : ""}

                    ${this.currentMetric === METRIC_TYPES.DOC_COMP && vm.visualAnalytics ? `
                        <div id="detail-doc-visual-mount" style="margin-bottom: 1.25rem;">
                            ${this.buildDocVisualAnalyticsHtml(vm.visualAnalytics)}
                        </div>
                    ` : ""}

                    ${this.currentMetric === METRIC_TYPES.DOC_COMP ? `
                        <!-- Collapsible Pond Directory & Table Card for DOC & Culture Stage -->
                        <section class="exec-detail-table-card doc-collapsible-table-card" style="margin-bottom: 1.5rem;">
                            <!-- Collapsible Header Banner -->
                            <div class="doc-table-collapse-header" id="btn-toggle-doc-table" style="cursor: pointer; padding: 1rem 1.25rem;">
                                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem;">
                                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                                        <div style="width: 36px; height: 36px; border-radius: 8px; background: #f0fdf4; border: 1px solid #bbf7d0; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0;">📋</div>
                                        <div>
                                            <div style="font-size: 0.95rem; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                                                <span>Detailed Pond Cohort Directory &amp; Ledger</span>
                                                <span class="detail-count-badge" id="detail-doc-header-count">${vm.countDisplay}</span>
                                            </div>
                                            <div style="font-size: 0.74rem; color: #64748b; margin-top: 0.15rem;">
                                                Filter and inspect individual pond biometrics, ABW, biomass, and biosecurity status
                                            </div>
                                        </div>
                                    </div>
                                    <button type="button" class="btn-mode doc-table-toggle-btn ${this.isDocTableExpanded ? 'active' : ''}" id="btn-doc-table-collapse-action" style="padding: 0.45rem 0.95rem; font-weight: 700; display: inline-flex; align-items: center; gap: 0.4rem; cursor: pointer;">
                                        <span id="doc-table-toggle-icon">${this.isDocTableExpanded ? "▲" : "▼"}</span>
                                        <span id="doc-table-toggle-text">${this.isDocTableExpanded ? "Hide Pond Table" : "Show Pond Table"}</span>
                                    </button>
                                </div>
                            </div>

                            <!-- Collapsible Body Container (Holds Controls Toolbar & Table) -->
                            <div id="detail-doc-table-container" style="${this.isDocTableExpanded ? 'display: block;' : 'display: none;'} border-top: 1px solid #e2e8f0; padding: 1.15rem 1.25rem;">
                                <!-- Controls Toolbar -->
                                <div class="exec-detail-toolbar" style="margin-bottom: 1.15rem; background: #f8fafc; border: 1px solid #e2e8f0;">
                                    <div class="detail-toolbar-left">
                                        <div class="detail-control-item">
                                            <label for="detail-month-select" class="detail-toolbar-label">Age Cohort:</label>
                                            <select id="detail-month-select" class="detail-toolbar-select">
                                                ${monthOptionsHtml}
                                            </select>
                                        </div>

                                        ${docStageFilterHtml}

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
                                </div>

                                <!-- Full-Viewport Table Wrapper -->
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
                            </div>
                        </section>
                    ` : `
                        <!-- Controls Toolbar -->
                        <section class="exec-detail-toolbar">
                            <div class="detail-toolbar-left">
                                <div class="detail-control-item">
                                    <label for="detail-month-select" class="detail-toolbar-label">Month Period:</label>
                                    <select id="detail-month-select" class="detail-toolbar-select">
                                        ${monthOptionsHtml}
                                    </select>
                                </div>

                                ${!vm.hideDataTable ? `
                                    <div class="detail-search-box">
                                        <span class="detail-search-icon">🔍</span>
                                        <input type="text" id="detail-search-input" class="detail-search-input" placeholder="Search pond, module, species, status..." value="${this.searchQuery}" />
                                        ${this.searchQuery ? `<button type="button" id="btn-clear-detail-search" class="btn-detail-clear-search">✕</button>` : ""}
                                    </div>
                                ` : ""}
                            </div>

                            <div class="detail-toolbar-right">
                                <span class="detail-count-badge" id="detail-count-display">${vm.countDisplay}</span>
                                <button type="button" id="btn-detail-export-csv" class="btn-detail-csv" title="Download Excel-Compatible CSV">
                                    <span>📥 Export CSV</span>
                                </button>
                            </div>
                        </section>

                        ${vm.hideDataTable ? `
                            <div id="detail-visual-analytics-mount">
                                ${this.buildSpeciesVisualAnalyticsHtml(vm.visualAnalytics)}
                            </div>
                        ` : `
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
                        `}
                    `}

                </main>

            </div>
        `;

        if (hasTimeline) {
            this.drawTimelineChart(vm.timeline);
        }
    }

    bindEvents() {
        // Harvest Metric Mode Toggle (TONNAGE, PONDS)
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

        // Stocking Metric Mode Toggle (MILLION, PONDS)
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

        // Species Composition Scope Toggle (YTD, ACTIVE)
        const spCompScopeBtns = this.container.querySelectorAll("[data-spcomp-scope]");
        spCompScopeBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                const scope = btn.getAttribute("data-spcomp-scope");
                if (scope && this.speciesCompScope !== scope) {
                    this.speciesCompScope = scope;
                    spCompScopeBtns.forEach(b => b.classList.toggle("active", b.getAttribute("data-spcomp-scope") === scope));
                    this.refreshContent(true);
                }
            });
        });

        // Species Composition Metric Mode Toggle (PONDS, MILLION)
        const spCompModeBtns = this.container.querySelectorAll("[data-spcomp-mode]");
        spCompModeBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                const mode = btn.getAttribute("data-spcomp-mode");
                if (mode && this.speciesCompMode !== mode) {
                    this.speciesCompMode = mode;
                    spCompModeBtns.forEach(b => b.classList.toggle("active", b.getAttribute("data-spcomp-mode") === mode));
                    this.refreshContent(true);
                }
            });
        });

        // Species Composition Species Filter Toggle (ALL, VAN, MON)
        const spCompSpeciesBtns = this.container.querySelectorAll("[data-spcomp-species]");
        spCompSpeciesBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                const sp = btn.getAttribute("data-spcomp-species");
                if (sp && this.speciesCompSpecies !== sp) {
                    this.speciesCompSpecies = sp;
                    spCompSpeciesBtns.forEach(b => b.classList.toggle("active", b.getAttribute("data-spcomp-species") === sp));
                    this.refreshContent(true);
                }
            });
        });

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

        // DOC & Culture Stage Species Filter Toggle (ALL, VAN, MON)
        const docSpBtns = this.container.querySelectorAll("[data-doc-species]");
        docSpBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                const sp = btn.getAttribute("data-doc-species");
                if (sp && this.docSpeciesFilter !== sp) {
                    this.docSpeciesFilter = sp;
                    docSpBtns.forEach(b => b.classList.toggle("active", b.getAttribute("data-doc-species") === sp));
                    this.refreshContent(true);
                }
            });
        });

        // DOC & Culture Stage Filter Toggle (ALL, EARLY, MID, FINISHING, EXTENDED)
        const docStageBtns = this.container.querySelectorAll("[data-doc-stage]");
        docStageBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                const stage = btn.getAttribute("data-doc-stage");
                if (stage && this.docStageFilter !== stage) {
                    this.docStageFilter = stage;
                    docStageBtns.forEach(b => b.classList.toggle("active", b.getAttribute("data-doc-stage") === stage));
                    this.refreshContent(false);
                }
            });
        });

        // Collapsible Pond Table Toggle (for DOC_COMP)
        const toggleHeader = this.container.querySelector("#btn-toggle-doc-table");
        if (toggleHeader) {
            toggleHeader.addEventListener("click", () => {
                this.updateDocTableCollapseState();
            });
        }

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
                    this.harvestChartMode = "TONNAGE";
                    this.harvestSpecies = "ALL";
                    this.stockingChartMode = "MILLION";
                    this.stockingSpecies = "ALL";
                    this.speciesCompScope = "YTD";
                    this.speciesCompMode = "PONDS";
                    this.speciesCompSpecies = "ALL";
                    this.prepChartMode = "TOTAL";
                    this.activePondChartMode = "AVG";
                    this.growthSpecies = "ALL";
                    this.growthChartMode = "ADG";
                    this.growthViewPerspective = "MODULE";
                    this.growthDocCohort = "MID_LATE";
                    this.docSpeciesFilter = "ALL";
                    this.docStageFilter = "ALL";
                    this.isDocTableExpanded = false;
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
                        harvestChartMode: this.harvestChartMode,
                        harvestSpecies: this.harvestSpecies,
                        stockingChartMode: this.stockingChartMode,
                        stockingSpecies: this.stockingSpecies,
                        speciesCompScope: this.speciesCompScope,
                        speciesCompMode: this.speciesCompMode,
                        speciesCompSpecies: this.speciesCompSpecies,
                        activePondMode: this.activePondChartMode,
                        prepChartMode: this.prepChartMode,
                        growthSpecies: this.growthSpecies,
                        growthChartMode: this.growthChartMode,
                        growthViewPerspective: this.growthViewPerspective,
                        growthDocCohort: this.growthDocCohort,
                        docSpeciesFilter: this.docSpeciesFilter,
                        docStageFilter: this.docStageFilter
                    }
                );
                let rowsToExport = (vm.tableRows && vm.tableRows.length > 0) ? vm.tableRows : (vm.csvRows || []);
                let headersToExport = (vm.tableHeaders && vm.tableHeaders.length > 0) ? vm.tableHeaders : (vm.csvHeaders || []);
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
                    if (hit.species && (hit.species === "VAN" || hit.species === "MON")) {
                        if (this.currentMetric === METRIC_TYPES.BIOSECURITY) {
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
                        } else if (this.currentMetric === METRIC_TYPES.STOCKING) {
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
                        } else if (this.currentMetric === METRIC_TYPES.SPECIES_COMP) {
                            const isSameMonthAndSpecies = this.selectedMonth === hit.monthKey && this.speciesCompSpecies === hit.species;
                            if (isSameMonthAndSpecies) {
                                this.selectedMonth = "ALL";
                                this.speciesCompSpecies = "ALL";
                            } else {
                                this.selectedMonth = hit.monthKey;
                                this.speciesCompSpecies = hit.species;
                            }
                            const spCompBtns = this.container.querySelectorAll("[data-spcomp-species]");
                            spCompBtns.forEach(b => b.classList.toggle("active", b.getAttribute("data-spcomp-species") === this.speciesCompSpecies));
                        } else if (this.currentMetric === METRIC_TYPES.DOC_COMP) {
                            const isSameMonthAndSpecies = this.selectedMonth === hit.monthKey && this.docSpeciesFilter === hit.species;
                            if (isSameMonthAndSpecies) {
                                this.selectedMonth = "ALL";
                                this.docSpeciesFilter = "ALL";
                            } else {
                                this.selectedMonth = hit.monthKey;
                                this.docSpeciesFilter = hit.species;
                            }
                            const docSpBtns = this.container.querySelectorAll("[data-doc-species]");
                            docSpBtns.forEach(b => b.classList.toggle("active", b.getAttribute("data-doc-species") === this.docSpeciesFilter));
                            if (!this.isDocTableExpanded) {
                                this.updateDocTableCollapseState(true);
                            }
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
                            this.selectedMonth = "ALL";
                        } else {
                            this.selectedMonth = hit.monthKey;
                        }
                        if (this.currentMetric === METRIC_TYPES.DOC_COMP && !this.isDocTableExpanded) {
                            this.updateDocTableCollapseState(true);
                        }
                    }
                    this.sortColIndex = null;
                    this.sortDirection = null;
                    this.refreshContent();
                }
            });
        }
    }

    /**
     * Toggles or forces the expanded/collapsed state of the DOC_COMP pond table container.
     * @param {boolean|null} forceState Optional boolean to force state
     */
    updateDocTableCollapseState(forceState = null) {
        if (forceState !== null) {
            this.isDocTableExpanded = Boolean(forceState);
        } else {
            this.isDocTableExpanded = !this.isDocTableExpanded;
        }

        const container = this.container.querySelector("#detail-doc-table-container");
        const toggleIcon = this.container.querySelector("#doc-table-toggle-icon");
        const toggleText = this.container.querySelector("#doc-table-toggle-text");
        const toggleBtn = this.container.querySelector("#btn-doc-table-collapse-action");

        if (container) {
            container.style.display = this.isDocTableExpanded ? "block" : "none";
        }
        if (toggleIcon) {
            toggleIcon.textContent = this.isDocTableExpanded ? "▲" : "▼";
        }
        if (toggleText) {
            toggleText.textContent = this.isDocTableExpanded ? "Hide Pond Table" : "Show Pond Table";
        }
        if (toggleBtn) {
            toggleBtn.classList.toggle("active", this.isDocTableExpanded);
        }
    }

    refreshContent(redrawCanvas = true) {
        const vm = ExecutiveMetricsPresenter.getMetricDrillDownData(
            this.currentMetric,
            this.dataBundle,
            this.selectedMonth,
            this.searchQuery,
            {
                harvestChartMode: this.harvestChartMode,
                harvestSpecies: this.harvestSpecies,
                stockingChartMode: this.stockingChartMode,
                stockingSpecies: this.stockingSpecies,
                speciesCompScope: this.speciesCompScope,
                speciesCompMode: this.speciesCompMode,
                speciesCompSpecies: this.speciesCompSpecies,
                activePondMode: this.activePondChartMode,
                prepChartMode: this.prepChartMode,
                growthSpecies: this.growthSpecies,
                growthChartMode: this.growthChartMode,
                growthViewPerspective: this.growthViewPerspective,
                growthDocCohort: this.growthDocCohort,
                docSpeciesFilter: this.docSpeciesFilter,
                docStageFilter: this.docStageFilter
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

        // Update header count badge for collapsible DOC_COMP table
        const headerCountBadge = this.container.querySelector("#detail-doc-header-count");
        if (headerCountBadge) headerCountBadge.textContent = vm.countDisplay;

        // Update timeline title & page subtitle
        const headline = this.container.querySelector(".timeline-headline");
        if (headline && vm.timelineTitle) headline.textContent = `📈 ${vm.timelineTitle}`;
        const subEl = this.container.querySelector(".exec-detail-sub");
        if (subEl && vm.subtitle) subEl.textContent = vm.subtitle;

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

        // Update visual analytics mount if present (e.g. SPECIES_COMP)
        const visualMount = this.container.querySelector("#detail-visual-analytics-mount");
        if (visualMount && vm.hideDataTable) {
            visualMount.innerHTML = this.buildSpeciesVisualAnalyticsHtml(vm.visualAnalytics);
        }

        // Update doc visual mount if present (e.g. DOC_COMP)
        const docVisualMount = this.container.querySelector("#detail-doc-visual-mount");
        if (docVisualMount && vm.visualAnalytics && this.currentMetric === METRIC_TYPES.DOC_COMP) {
            docVisualMount.innerHTML = this.buildDocVisualAnalyticsHtml(vm.visualAnalytics);
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

        const padding = { left: 52, right: 34, top: 30, bottom: 42 };
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
            ctx.fillText(tickLabel, padding.left - 8, y + 3);
        }

        const stepX = plotW / timeline.length;
        const barW = Math.max(16, stepX * 0.52);

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
                const groupW = Math.max(22, Math.min(54, stepX * 0.72));
                const gap = Math.max(3, Math.round(groupW * 0.1));
                const singleW = Math.max(9, Math.floor((groupW - gap) / 2));
                const groupX = padding.left + stepX * idx + (stepX - (singleW * 2 + gap)) / 2;

                const vanVal = Number(item.vanValue) || 0;
                const monVal = Number(item.monValue) || 0;
                const vanH = maxVal > 0 ? (vanVal / maxVal) * plotH : 0;
                const monH = maxVal > 0 ? (monVal / maxVal) * plotH : 0;
                const vanY = padding.top + (plotH - vanH);
                const monY = padding.top + (plotH - monH);
                const vanX = groupX;
                const monX = groupX + singleW + gap;

                // Selected month/module backdrop highlight
                if (isSelected) {
                    ctx.fillStyle = "rgba(2, 132, 199, 0.08)";
                    ctx.fillRect(padding.left + stepX * idx + 2, padding.top - 10, stepX - 4, plotH + 14);
                }

                // Empty baseline indicator when both are 0
                if (vanVal <= 0 && monVal <= 0) {
                    drawRoundedTopBar(vanX, padding.top + plotH - 3, singleW, 3, "#e2e8f0");
                    drawRoundedTopBar(monX, padding.top + plotH - 3, singleW, 3, "#e2e8f0");
                } else {
                    if (vanVal > 0) {
                        drawRoundedTopBar(vanX, vanY, singleW, Math.max(3, vanH), isSelected ? "#0369a1" : "#0284c7");
                        ctx.fillStyle = isSelected ? "#0369a1" : "#0284c7";
                        ctx.font = isSelected ? "bold 9.5px sans-serif" : "9px sans-serif";
                        ctx.textAlign = "center";
                        ctx.fillText(formatBarVal(vanVal, item.unit, true), vanX + singleW / 2, Math.max(12, vanY - 4));
                    } else {
                        drawRoundedTopBar(vanX, padding.top + plotH - 2, singleW, 2, "#e2e8f0");
                    }

                    if (monVal > 0) {
                        drawRoundedTopBar(monX, monY, singleW, Math.max(3, monH), isSelected ? "#047857" : "#10b981");
                        ctx.fillStyle = isSelected ? "#047857" : "#059669";
                        ctx.font = isSelected ? "bold 9.5px sans-serif" : "9px sans-serif";
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

                // Individual bar hitboxes for VAN and MON, plus month label area
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

                // Value label above bar
                if (item.value > 0) {
                    ctx.fillStyle = labelColor;
                    ctx.font = isSelected ? "bold 10.5px sans-serif" : "10px sans-serif";
                    ctx.textAlign = "center";
                    ctx.fillText(formatBarVal(item.value, item.unit, false), x + barW / 2, Math.max(14, y - 5));
                }

                // Record Hitbox for click interaction
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
            ctx.font = isSelected ? "bold 11px sans-serif" : "10px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(shortLabel, centerX, h - 18);

            // Sampled pond count pill below X-Axis label for BIOSECURITY
            if (item.pondCount !== undefined && (chartMode === "ADG" || chartMode === "SR" || chartMode === "LAGGING" || chartMode === "CRITICAL_SR" || chartMode === "ALERTS")) {
                ctx.fillStyle = item.pondCount > 0 ? "#64748b" : "#cbd5e1";
                ctx.font = "9px ui-monospace, monospace";
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
                    ctx.font = "bold 9.5px sans-serif";
                    const textW = ctx.measureText(benchmarkLabel).width;
                    ctx.fillStyle = "rgba(236, 253, 245, 0.92)";
                    ctx.fillRect(w - padding.right - textW - 10, Math.max(2, benchY - 13), textW + 8, 12);
                    ctx.fillStyle = "#047857";
                    ctx.textAlign = "right";
                    ctx.fillText(benchmarkLabel, w - padding.right - 6, Math.max(11, benchY - 4));
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
                ctx.font = "bold 9.5px sans-serif";
                const textW = ctx.measureText(avgLabel).width;
                ctx.fillStyle = "rgba(255, 251, 235, 0.92)";
                ctx.fillRect(padding.left + 4, Math.max(2, avgY - 13), textW + 8, 12);
                ctx.fillStyle = "#b45309";
                ctx.textAlign = "left";
                ctx.fillText(avgLabel, padding.left + 8, Math.max(11, avgY - 4));
                ctx.restore();
            }
        }
    }
}
