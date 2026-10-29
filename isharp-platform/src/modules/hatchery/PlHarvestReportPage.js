/**
 * iSHARP DBMS 2.0 — Telaga Putat Hatchery (TPH)
 * PL Harvest & Distribution Report Sub-Page
 * Visualizes monthly production & distribution summary, individual harvest dispatches, and tank culture runs.
 */

import { HatcheryRepository } from "../../infrastructure/repositories/hatcheryRepository.js";
import { escapeHtml } from "../../utils/formatters.js";
import { Toast } from "../../components/Toast.js";
import {
    aggregateMonthlyHatcheryRollup,
    calculateHatcheryKpiStats
} from "../../domain/hatcheryAnalytics.js";

export class PlHarvestReportPage {
    constructor(containerEl, onNavigate) {
        this.container = containerEl;
        this.onNavigate = onNavigate;
        this.monthlyData = [];
        this.dispatches = [];
        this.allRuns = [];
        this.flushes = [];

        // Master Filter State (Default: Full Year 2026 Executive View)
        this.selectedYear = "2026";
        this.selectedMonth = "ALL";
        this.selectedSpecies = "ALL";

        // Lower Tab & Search State
        this.activeViewTab = "dispatches"; // "dispatches" | "runs"
        this.filterSpecies = "ALL";
        this.filterDestination = "ALL";
        this.searchQuery = "";
    }

    async init() {
        this.renderLoading();
        await this.loadData();
        this.render();
    }

    async loadData() {
        try {
            const [monthly, dispatches, runs, flushes] = await Promise.all([
                HatcheryRepository.getPlMonthlyRollup(),
                HatcheryRepository.getHarvestDispatches(1200),
                HatcheryRepository.getAllTankRuns(1500),
                HatcheryRepository.getFlushEvents(600)
            ]);
            this.monthlyData = monthly;
            this.dispatches = dispatches;
            this.allRuns = runs;
            this.flushes = flushes;
        } catch (err) {
            console.error("Failed to load PL Harvest Report data:", err);
            Toast.error("Failed to load PL harvest data.");
        }
    }

    renderLoading() {
        if (!this.container) return;
        this.container.innerHTML = `
            <div class="hatchery-loading-state">
                <div class="hatchery-loading-spinner"></div>
                <p>Loading PL Harvest and Production records...</p>
            </div>
        `;
    }

    getMonthName(num) {
        const months = {
            "01": "January", "02": "February", "03": "March", "04": "April",
            "05": "May", "06": "June", "07": "July", "08": "August",
            "09": "September", "10": "October", "11": "November", "12": "December"
        };
        return months[num] || num;
    }

    render() {
        if (!this.container) return;

        // Dynamic KPI calculations reacting to selected period
        const kpiStats = calculateHatcheryKpiStats(
            this.allRuns,
            this.dispatches,
            this.flushes,
            this.selectedYear,
            this.selectedMonth,
            this.selectedSpecies
        );

        let scopeLabel = "All Historical Periods";
        if (this.selectedYear !== "ALL" && this.selectedMonth !== "ALL") {
            scopeLabel = `${this.getMonthName(this.selectedMonth)} ${this.selectedYear}`;
        } else if (this.selectedYear !== "ALL") {
            scopeLabel = `Full Year ${this.selectedYear}`;
        } else if (this.selectedMonth !== "ALL") {
            scopeLabel = `All ${this.getMonthName(this.selectedMonth)}s`;
        }

        // Filtered Dispatches for Lower Detail Register
        const filteredDispatches = this.dispatches.filter(d => {
            if (this.filterSpecies !== "ALL" && d.species !== this.filterSpecies) return false;
            if (this.filterDestination !== "ALL" && d.buyer_type !== this.filterDestination) return false;
            if (this.searchQuery) {
                const q = this.searchQuery.toLowerCase();
                const tank = (d.tank_code || "").toLowerCase();
                const buyer = (d.buyer || "").toLowerCase();
                const lot = (d.lot_no || "").toLowerCase();
                const doNo = (d.do_number || "").toLowerCase();
                const ponds = (d.linked_ponds || []).join(" ").toLowerCase();
                return tank.includes(q) || buyer.includes(q) || lot.includes(q) || doNo.includes(q) || ponds.includes(q);
            }
            return true;
        });

        // Filtered Runs for Lower Master Log
        const filteredRuns = this.allRuns.filter(r => {
            if (this.filterSpecies !== "ALL" && r.species !== this.filterSpecies) return false;
            if (this.searchQuery) {
                const q = this.searchQuery.toLowerCase();
                const tank = (r.tank_code || "").toLowerCase();
                const src = (r.source_code || "").toLowerCase();
                return tank.includes(q) || src.includes(q);
            }
            return true;
        });

        // Monthly Rollup calculation
        const monthlyRollup = aggregateMonthlyHatcheryRollup(
            this.allRuns,
            this.dispatches,
            this.flushes,
            this.selectedYear,
            this.selectedSpecies
        );
        const displayRollup = this.selectedMonth === "ALL"
            ? monthlyRollup
            : monthlyRollup.filter(m => m.monthNum === this.selectedMonth);

        this.container.innerHTML = `
            <div class="hatchery-report-page">
                <!-- Top Navigation & Title Header -->
                <header class="report-header">
                    <div class="report-header-left">
                        <button class="hatchery-nav-btn secondary" id="btn-back-to-map" title="Back to 64-Tank Map">
                            <span class="btn-icon">⬅</span>
                            <span>Back to Hatchery Map</span>
                        </button>
                        <div class="report-title-group">
                            <span class="report-badge">PRODUCTION &amp; DISTRIBUTION</span>
                            <h1 class="report-title">Post-Larvae (PL) Harvest &amp; Distribution Report</h1>
                        </div>
                    </div>

                    <div class="report-header-right">
                        <button class="hatchery-nav-btn accent" id="btn-export-pl-csv" title="Export Monthly Summary to CSV">
                            <span class="btn-icon">📥</span>
                            <span>Export Summary CSV</span>
                        </button>
                    </div>
                </header>

                <!-- Dynamic KPI Bento (Reacts to Selected Period) -->
                <section class="hatchery-kpi-bento">
                    <div class="kpi-card-glass kpi-cyan">
                        <div class="kpi-icon-orbit">📦</div>
                        <div class="kpi-body">
                            <span class="kpi-label">Total PL Harvested</span>
                            <span class="kpi-value">${(kpiStats.totalHarvestedK / 1000).toFixed(2)}M <small>PL</small></span>
                            <span class="kpi-caption">${kpiStats.totalHarvestedK.toLocaleString()}k in ${scopeLabel}</span>
                        </div>
                    </div>

                    <div class="kpi-card-glass kpi-emerald">
                        <div class="kpi-icon-orbit">🚜</div>
                        <div class="kpi-body">
                            <span class="kpi-label">SGO Farm Deliveries</span>
                            <span class="kpi-value">${(kpiStats.totalSgoK / 1000).toFixed(2)}M <small>PL</small></span>
                            <span class="kpi-caption">${kpiStats.sgoPct}% sent to Setiu Growout Ponds</span>
                        </div>
                    </div>

                    <div class="kpi-card-glass kpi-blue">
                        <div class="kpi-icon-orbit">🚚</div>
                        <div class="kpi-body">
                            <span class="kpi-label">External Sales</span>
                            <span class="kpi-value">${(kpiStats.totalExternalK / 1000).toFixed(2)}M <small>PL</small></span>
                            <span class="kpi-caption">${kpiStats.externalPct}% sold to external buyers</span>
                        </div>
                    </div>

                    <div class="kpi-card-glass kpi-purple">
                        <div class="kpi-icon-orbit">📈</div>
                        <div class="kpi-body">
                            <span class="kpi-label">Average Harvest SR%</span>
                            <span class="kpi-value">${kpiStats.avgSr}</span>
                            <span class="kpi-caption">Across ${kpiStats.totalDispatchesCount} logged deliveries</span>
                        </div>
                    </div>
                </section>

                <!-- Monthly Production & Distribution Summary Section -->
                <section class="report-section-glass">
                    <div class="section-title-row">
                        <div class="title-with-badge">
                            <h3 class="section-title">📊 Monthly Production &amp; Distribution Summary</h3>
                            <span class="section-subtag">Executive production ledger &amp; destination split (SGO Farm vs External Sales)</span>
                        </div>

                        <div class="filter-scope-display">
                            <span class="active-scope-badge">
                                Scope: <strong>${scopeLabel}</strong> • Species: <strong>${this.selectedSpecies === 'ALL' ? 'All Species' : (this.selectedSpecies === 'MON' ? 'P.Monodon' : 'L.Vannamei')}</strong>
                            </span>
                        </div>
                    </div>

                    <!-- Master Filter Bar -->
                    <div class="hatchery-filter-bar">
                        <div class="filter-group">
                            <label for="ops-filter-year" class="filter-label">Year:</label>
                            <select id="ops-filter-year" class="hatchery-select">
                                <option value="ALL" ${this.selectedYear === 'ALL' ? 'selected' : ''}>All Years</option>
                                <option value="2026" ${this.selectedYear === '2026' ? 'selected' : ''}>2026</option>
                                <option value="2025" ${this.selectedYear === '2025' ? 'selected' : ''}>2025</option>
                                <option value="2024" ${this.selectedYear === '2024' ? 'selected' : ''}>2024</option>
                            </select>
                        </div>

                        <div class="filter-group">
                            <label for="ops-filter-month" class="filter-label">Month:</label>
                            <select id="ops-filter-month" class="hatchery-select">
                                <option value="ALL" ${this.selectedMonth === 'ALL' ? 'selected' : ''}>All Months</option>
                                <option value="01" ${this.selectedMonth === '01' ? 'selected' : ''}>01 - January</option>
                                <option value="02" ${this.selectedMonth === '02' ? 'selected' : ''}>02 - February</option>
                                <option value="03" ${this.selectedMonth === '03' ? 'selected' : ''}>03 - March</option>
                                <option value="04" ${this.selectedMonth === '04' ? 'selected' : ''}>04 - April</option>
                                <option value="05" ${this.selectedMonth === '05' ? 'selected' : ''}>05 - May</option>
                                <option value="06" ${this.selectedMonth === '06' ? 'selected' : ''}>06 - June</option>
                                <option value="07" ${this.selectedMonth === '07' ? 'selected' : ''}>07 - July</option>
                                <option value="08" ${this.selectedMonth === '08' ? 'selected' : ''}>08 - August</option>
                                <option value="09" ${this.selectedMonth === '09' ? 'selected' : ''}>09 - September</option>
                                <option value="10" ${this.selectedMonth === '10' ? 'selected' : ''}>10 - October</option>
                                <option value="11" ${this.selectedMonth === '11' ? 'selected' : ''}>11 - November</option>
                                <option value="12" ${this.selectedMonth === '12' ? 'selected' : ''}>12 - December</option>
                            </select>
                        </div>

                        <div class="filter-group">
                            <label for="ops-filter-species" class="filter-label">Species:</label>
                            <select id="ops-filter-species" class="hatchery-select">
                                <option value="ALL" ${this.selectedSpecies === 'ALL' ? 'selected' : ''}>All Species</option>
                                <option value="VAN" ${this.selectedSpecies === 'VAN' ? 'selected' : ''}>L.Vannamei</option>
                                <option value="MON" ${this.selectedSpecies === 'MON' ? 'selected' : ''}>P.Monodon</option>
                            </select>
                        </div>

                        <div class="filter-summary-text text-muted text-xs" style="margin-left: auto;">
                            Showing <strong>${displayRollup.length}</strong> monthly ledger records
                        </div>
                    </div>

                    <!-- Monthly Production Ledger Table -->
                    <div class="table-responsive">
                        <table class="hatchery-table ops-monthly-table">
                            <thead>
                                <tr>
                                    <th style="min-width: 110px;">Month</th>
                                    <th style="min-width: 110px;">Species</th>
                                    <th style="min-width: 140px;">Tanks Harvested</th>
                                    <th style="min-width: 150px;">Total PL Produced</th>
                                    <th style="min-width: 170px;">SGO Farm Deliveries</th>
                                    <th style="min-width: 160px;">External Sales</th>
                                    <th style="min-width: 100px;">Avg Stage</th>
                                    <th style="min-width: 110px;">Harvest SR %</th>
                                    <th style="min-width: 130px;">Tanks Flushed</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${displayRollup.length > 0 ? displayRollup.map(m => {
                                    const srVal = m.overallSrPct;
                                    let srClass = "text-muted";
                                    if (srVal !== null) {
                                        if (srVal >= 70) srClass = "sr-badge good";
                                        else if (srVal >= 50) srClass = "sr-badge medium";
                                        else srClass = "sr-badge low";
                                    }

                                    const tankListStr = m.harvestTanksList && m.harvestTanksList.length > 0 
                                        ? m.harvestTanksList.join(", ") 
                                        : "—";

                                    const flushListStr = m.flushedTanksList && m.flushedTanksList.length > 0
                                        ? m.flushedTanksList.join(", ")
                                        : "None";

                                    return `
                                        <tr>
                                            <td>
                                                <strong class="font-mono font-bold text-base">${m.monthKey}</strong>
                                                <div class="text-xs text-muted">${this.getMonthName(m.monthNum)}</div>
                                            </td>
                                            <td>
                                                <span class="badge ${m.species.includes('Monodon') ? 'badge-neutral' : 'badge-info'}">
                                                    ${escapeHtml(m.species)}
                                                </span>
                                            </td>
                                            <td>
                                                <strong>${m.harvestedTanksCount} Tanks</strong>
                                                <div class="text-xs text-muted" style="max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${tankListStr}">
                                                    ${tankListStr}
                                                </div>
                                            </td>
                                            <td>
                                                <strong class="font-mono text-primary text-base">${(m.plHarvestedK / 1000).toFixed(2)}M</strong>
                                                <div class="font-mono text-xs text-muted">${m.plHarvestedK.toLocaleString()}k PL</div>
                                            </td>
                                            <td>
                                                <div class="dist-cell">
                                                    <strong class="font-mono text-success">${m.sgoHarvestK.toLocaleString()}k</strong>
                                                    <span class="badge badge-success text-xs font-mono">${m.sgoPct}%</span>
                                                </div>
                                                <div class="text-xs text-muted">to Setiu Growout</div>
                                            </td>
                                            <td>
                                                <div class="dist-cell">
                                                    <strong class="font-mono ${m.externalHarvestK > 0 ? 'text-primary' : 'text-muted'}">${m.externalHarvestK.toLocaleString()}k</strong>
                                                    ${m.externalHarvestK > 0 ? `<span class="badge badge-info text-xs font-mono">${m.externalPct}%</span>` : ''}
                                                </div>
                                                <div class="text-xs text-muted">to External Buyers</div>
                                            </td>
                                            <td>
                                                <span class="font-mono">${m.avgPlStage ? `PL ${m.avgPlStage}` : '—'}</span>
                                            </td>
                                            <td>
                                                <span class="${srClass}">
                                                    ${srVal !== null ? srVal + '%' : '—'}
                                                </span>
                                            </td>
                                            <td>
                                                ${m.flushedTanksCount > 0 ? `
                                                    <strong class="text-amber">${m.flushedTanksCount} Tanks</strong>
                                                    <div class="font-mono text-xs text-amber">${m.naupliiFlushedK.toLocaleString()}k Discard</div>
                                                ` : `<span class="text-muted font-mono">—</span>`}
                                            </td>
                                        </tr>
                                    `;
                                }).join('') : `
                                    <tr><td colspan="9" class="text-center text-muted py-4">No monthly production records found for the selected filter.</td></tr>
                                `}
                            </tbody>
                        </table>
                    </div>
                </section>

                <!-- Detailed Register Section (Tabs: PL Dispatches vs Tank Runs) -->
                <div class="hatchery-controls-bar">
                    <div class="hatchery-tab-group" style="display: flex; gap: 0.5rem;">
                        <button class="hatchery-nav-btn ${this.activeViewTab === 'dispatches' ? 'accent' : 'secondary'}" id="btn-tab-dispatches">
                            <span>🦐 PL Harvest Dispatches (${filteredDispatches.length})</span>
                        </button>
                        <button class="hatchery-nav-btn ${this.activeViewTab === 'runs' ? 'accent' : 'secondary'}" id="btn-tab-runs">
                            <span>📋 Tank Culture Runs (${filteredRuns.length})</span>
                        </button>
                    </div>

                    <div class="filter-group">
                        <label for="filter-species-select" class="filter-label">Species:</label>
                        <select id="filter-species-select" class="hatchery-select">
                            <option value="ALL" ${this.filterSpecies === 'ALL' ? 'selected' : ''}>All Species</option>
                            <option value="VAN" ${this.filterSpecies === 'VAN' ? 'selected' : ''}>L.Vannamei</option>
                            <option value="MON" ${this.filterSpecies === 'MON' ? 'selected' : ''}>P.Monodon</option>
                        </select>
                    </div>

                    ${this.activeViewTab === 'dispatches' ? `
                        <div class="filter-group">
                            <label for="filter-dest-select" class="filter-label">Destination:</label>
                            <select id="filter-dest-select" class="hatchery-select">
                                <option value="ALL" ${this.filterDestination === 'ALL' ? 'selected' : ''}>All Destinations</option>
                                <option value="SGO" ${this.filterDestination === 'SGO' ? 'selected' : ''}>SGO (Setiu Farm)</option>
                                <option value="KGO" ${this.filterDestination === 'KGO' ? 'selected' : ''}>KGO (Kedah Farm)</option>
                                <option value="EXTERNAL" ${this.filterDestination === 'EXTERNAL' ? 'selected' : ''}>External Buyers</option>
                            </select>
                        </div>
                    ` : ''}

                    <div class="search-group">
                        <input 
                            type="search" 
                            id="runs-search-input" 
                            class="hatchery-search-input" 
                            placeholder="🔍 Search tank (e.g. C11), lot, DO, or pond..." 
                            value="${escapeHtml(this.searchQuery)}"
                        />
                    </div>
                </div>

                <!-- Main Section: PL Harvest Dispatches vs Runs Log -->
                ${this.activeViewTab === 'dispatches' ? `
                    <section class="report-section-glass">
                        <div class="section-title-row">
                            <h3 class="section-title">🦐 PL Harvest &amp; Dispatch Register</h3>
                            <span class="section-subtag">Showing ${filteredDispatches.length} of ${this.dispatches.length} dispatches</span>
                        </div>

                        <div class="table-responsive">
                            <table class="hatchery-table">
                                <thead>
                                    <tr>
                                        <th>Tank</th>
                                        <th>Harvest Date</th>
                                        <th>Stage</th>
                                        <th>Harvested (k)</th>
                                        <th>Destination / Buyer</th>
                                        <th>Linked Farm Pond(s)</th>
                                        <th>DO / Lot #</th>
                                        <th>Nauplii Origin</th>
                                        <th>SR %</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${filteredDispatches.length > 0 ? filteredDispatches.map(d => {
                                        const badgeClass = d.buyer_type === 'SGO' ? 'badge-success' : (d.buyer_type === 'KGO' ? 'badge-info' : 'badge-neutral');
                                        const pondsHtml = (d.linked_ponds && d.linked_ponds.length > 0)
                                            ? d.linked_ponds.map(p => `
                                                <a href="#/dbms?pond=${encodeURIComponent(p)}" class="spawn-block-tag sha font-mono" title="Jump to Pond ${p} in DBMS" style="text-decoration: none; margin-right: 0.2rem;">
                                                    ${p}
                                                </a>
                                            `).join('')
                                            : `<span class="text-muted" style="font-size: 0.75rem;">—</span>`;

                                        return `
                                            <tr>
                                                <td><span class="tank-code-badge font-mono font-bold">${d.tank_code}</span></td>
                                                <td class="font-mono">${d.harvest_date}</td>
                                                <td><span class="hatchery-status-tag culture">PL ${d.pl_stage}</span></td>
                                                <td><strong class="font-mono text-primary">${d.qty_k ? Number(d.qty_k).toLocaleString() + 'k' : '—'}</strong></td>
                                                <td>
                                                    <span class="badge ${badgeClass}">${escapeHtml(d.buyer)}</span>
                                                </td>
                                                <td>${pondsHtml}</td>
                                                <td class="font-mono text-muted text-xs">${escapeHtml(d.do_number || d.lot_no || '—')}</td>
                                                <td><span class="source-tag">${escapeHtml(d.source_code)}</span></td>
                                                <td class="font-mono ${d.sr_reported_pct >= 70 ? 'text-success font-bold' : ''}">
                                                    ${d.sr_reported_pct !== null && d.sr_reported_pct !== undefined ? d.sr_reported_pct + '%' : '—'}
                                                </td>
                                            </tr>
                                        `;
                                    }).join('') : `
                                        <tr><td colspan="9" class="text-center text-muted">No harvest dispatches match the selected filters.</td></tr>
                                    `}
                                </tbody>
                            </table>
                        </div>
                    </section>
                ` : `
                    <section class="report-section-glass">
                        <div class="section-title-row">
                            <h3 class="section-title">📋 Tank Culture Runs Master Log</h3>
                            <span class="section-subtag">Showing ${filteredRuns.length} of ${this.allRuns.length} runs</span>
                        </div>

                        <div class="table-responsive">
                            <table class="hatchery-table">
                                <thead>
                                    <tr>
                                        <th>Tank</th>
                                        <th>Stock Date</th>
                                        <th>Species</th>
                                        <th>Source</th>
                                        <th>Stocked (k)</th>
                                        <th>Status</th>
                                        <th>First Harvest</th>
                                        <th>Last Harvest</th>
                                        <th>Harvested (k)</th>
                                        <th>Flushed (k)</th>
                                        <th>Run SR%</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${filteredRuns.length > 0 ? filteredRuns.map(r => `
                                        <tr>
                                            <td><span class="tank-code-badge font-mono font-bold">${r.tank_code}</span></td>
                                            <td class="font-mono">${r.stock_date}</td>
                                            <td>${r.species === 'MON' ? 'P.Monodon' : 'L.Vannamei'}</td>
                                            <td><span class="source-tag">${escapeHtml(r.source_code)}</span></td>
                                            <td class="font-mono">${r.nauplii_stocked_k ? Number(r.nauplii_stocked_k).toLocaleString() + 'k' : '—'}</td>
                                            <td>
                                                <span class="hatchery-status-tag ${r.status.toLowerCase()}">${r.status}</span>
                                            </td>
                                            <td class="font-mono">${r.first_harvest_date || '—'}</td>
                                            <td class="font-mono">${r.last_harvest_date || '—'}</td>
                                            <td class="font-mono"><strong>${r.harvested_total_k ? Number(r.harvested_total_k).toLocaleString() + 'k' : '0k'}</strong></td>
                                            <td class="font-mono">${r.flushed_total_k ? Number(r.flushed_total_k).toLocaleString() + 'k' : '0k'}</td>
                                            <td class="font-mono ${r.sr_pct >= 70 ? 'text-success font-bold' : ''}">
                                                ${r.sr_pct !== null && r.sr_pct !== undefined ? r.sr_pct + '%' : '—'}
                                            </td>
                                        </tr>
                                    `).join('') : `
                                        <tr><td colspan="11" class="text-center text-muted">No runs matched the selected filters.</td></tr>
                                    `}
                                </tbody>
                            </table>
                        </div>
                    </section>
                `}
            </div>
        `;

        this.bindEvents();
    }

    bindEvents() {
        const btnBack = document.getElementById("btn-back-to-map");
        if (btnBack) {
            btnBack.addEventListener("click", () => {
                if (this.onNavigate) this.onNavigate("hatchery");
            });
        }

        const btnExport = document.getElementById("btn-export-pl-csv");
        if (btnExport) {
            btnExport.addEventListener("click", () => this.exportCsv());
        }

        // Master Filters for Monthly Summary
        const opsYearSelect = document.getElementById("ops-filter-year");
        if (opsYearSelect) {
            opsYearSelect.addEventListener("change", (e) => {
                this.selectedYear = e.target.value;
                this.render();
            });
        }

        const opsMonthSelect = document.getElementById("ops-filter-month");
        if (opsMonthSelect) {
            opsMonthSelect.addEventListener("change", (e) => {
                this.selectedMonth = e.target.value;
                this.render();
            });
        }

        const opsSpeciesSelect = document.getElementById("ops-filter-species");
        if (opsSpeciesSelect) {
            opsSpeciesSelect.addEventListener("change", (e) => {
                this.selectedSpecies = e.target.value;
                this.render();
            });
        }

        // Lower detail register tabs
        const tabDispatches = document.getElementById("btn-tab-dispatches");
        if (tabDispatches) {
            tabDispatches.addEventListener("click", () => {
                this.activeViewTab = "dispatches";
                this.render();
            });
        }

        const tabRuns = document.getElementById("btn-tab-runs");
        if (tabRuns) {
            tabRuns.addEventListener("click", () => {
                this.activeViewTab = "runs";
                this.render();
            });
        }

        const speciesSelect = document.getElementById("filter-species-select");
        if (speciesSelect) {
            speciesSelect.addEventListener("change", (e) => {
                this.filterSpecies = e.target.value;
                this.render();
            });
        }

        const destSelect = document.getElementById("filter-dest-select");
        if (destSelect) {
            destSelect.addEventListener("change", (e) => {
                this.filterDestination = e.target.value;
                this.render();
            });
        }

        const searchInput = document.getElementById("runs-search-input");
        if (searchInput) {
            searchInput.addEventListener("input", (e) => {
                this.searchQuery = e.target.value;
                this.render();
                const newSearch = document.getElementById("runs-search-input");
                if (newSearch) {
                    newSearch.focus();
                    newSearch.setSelectionRange(newSearch.value.length, newSearch.value.length);
                }
            });
        }
    }

    exportCsv() {
        const monthlyRollup = aggregateMonthlyHatcheryRollup(
            this.allRuns,
            this.dispatches,
            this.flushes,
            this.selectedYear,
            this.selectedSpecies
        );
        const displayRollup = this.selectedMonth === "ALL"
            ? monthlyRollup
            : monthlyRollup.filter(m => m.monthNum === this.selectedMonth);

        if (!displayRollup || displayRollup.length === 0) {
            Toast.warning("No monthly summary data available to export.");
            return;
        }

        const headers = [
            "Month",
            "Species",
            "Tanks Harvested Count",
            "Harvested Tanks List",
            "Total PL Produced (k)",
            "SGO Farm Deliveries (k)",
            "SGO Share %",
            "External Sales (k)",
            "External Share %",
            "Avg Harvest Stage",
            "Harvest SR %",
            "Tanks Flushed Count",
            "Nauplii Flushed (k)"
        ];

        const rows = displayRollup.map(m => [
            m.monthKey,
            m.species,
            m.harvestedTanksCount,
            (m.harvestTanksList || []).join("; "),
            m.plHarvestedK,
            m.sgoHarvestK,
            `${m.sgoPct}%`,
            m.externalHarvestK,
            `${m.externalPct}%`,
            m.avgPlStage || "",
            m.overallSrPct !== null ? `${m.overallSrPct}%` : "",
            m.flushedTanksCount,
            m.naupliiFlushedK
        ]);

        this._downloadCsv(headers, rows, `TPH_Monthly_Production_Distribution_Summary_${this.selectedYear}.csv`);
        Toast.success("Exported Monthly Production & Distribution Summary CSV!");
    }

    _downloadCsv(headers, rows, filename) {
        const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(row => row.map(v => `"${String(v !== null && v !== undefined ? v : '').replace(/"/g, '""')}"`).join(","))].join("\r\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}
