/**
 * iSHARP DBMS 2.0 — Telaga Putat Hatchery (TPH)
 * PL Harvest & Distribution Report Sub-Page
 * Visualizes daily operations timeline, monthly performance ledger, individual harvest dispatches, and tank culture runs.
 */

import { HatcheryRepository } from "../../infrastructure/repositories/hatcheryRepository.js";
import { escapeHtml } from "../../utils/formatters.js";
import { Toast } from "../../components/Toast.js";
import {
    aggregateMonthlyHatcheryRollup,
    aggregateDailyHatcheryOperations,
    calculateHatcheryKpiStats
} from "../../domain/hatcheryAnalytics.js";

function getDayOfWeek(dateStr) {
    if (!dateStr) return "";
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const d = new Date(dateStr + "T00:00:00");
    return isNaN(d.getDay()) ? "" : days[d.getDay()];
}

export class PlHarvestReportPage {
    constructor(containerEl, onNavigate) {
        this.container = containerEl;
        this.onNavigate = onNavigate;
        this.monthlyData = [];
        this.dispatches = [];
        this.allRuns = [];
        this.flushes = [];

        // Master Filter & Cadence State (Default: October 2026 Daily Operations)
        this.selectedYear = "2026";
        this.selectedMonth = "10";
        this.selectedSpecies = "ALL";
        this.cadenceView = "daily"; // "daily" | "monthly"

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
                <p>Loading PL Harvest and Operational records...</p>
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

        // Determine target month key for Daily Operations
        const activeYear = this.selectedYear === "ALL" ? "2026" : this.selectedYear;
        const targetMonthKey = this.selectedMonth !== "ALL" ? `${activeYear}-${this.selectedMonth}` : null;
        const dailyOps = targetMonthKey 
            ? aggregateDailyHatcheryOperations(this.allRuns, this.dispatches, this.flushes, targetMonthKey, this.selectedSpecies)
            : [];

        // Determine monthly rollup
        const monthlyRollup = aggregateMonthlyHatcheryRollup(this.allRuns, this.dispatches, this.flushes, this.selectedYear, this.selectedSpecies);
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
                            <span class="report-badge">PRODUCTION &amp; OPERATIONS MONITOR</span>
                            <h1 class="report-title">Post-Larvae (PL) Harvest &amp; Operations Report</h1>
                        </div>
                    </div>

                    <div class="report-header-right">
                        <button class="hatchery-nav-btn accent" id="btn-export-pl-csv" title="Export current view to CSV">
                            <span class="btn-icon">📥</span>
                            <span>Export CSV</span>
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

                    <div class="kpi-card-glass kpi-blue">
                        <div class="kpi-icon-orbit">🚚</div>
                        <div class="kpi-body">
                            <span class="kpi-label">Harvest Dispatches</span>
                            <span class="kpi-value">${kpiStats.totalDispatchesCount}</span>
                            <span class="kpi-caption">Farm &amp; external delivery trips</span>
                        </div>
                    </div>

                    <div class="kpi-card-glass kpi-purple">
                        <div class="kpi-icon-orbit">📈</div>
                        <div class="kpi-body">
                            <span class="kpi-label">Average Reported SR%</span>
                            <span class="kpi-value">${kpiStats.avgSr}</span>
                            <span class="kpi-caption">Mean harvest survival rate</span>
                        </div>
                    </div>

                    <div class="kpi-card-glass kpi-amber">
                        <div class="kpi-icon-orbit">⚠️</div>
                        <div class="kpi-body">
                            <span class="kpi-label">Total Flushed Discard</span>
                            <span class="kpi-value">${(kpiStats.totalFlushedK / 1000).toFixed(2)}M <small>PL</small></span>
                            <span class="kpi-caption">Early Zoea &amp; discard flushes</span>
                        </div>
                    </div>
                </section>

                <!-- Operations Monitor Section (Daily Timeline vs Monthly Ledger) -->
                <section class="report-section-glass ops-monitor-section">
                    <div class="section-title-row">
                        <div class="title-with-badge">
                            <h3 class="section-title">
                                ${this.cadenceView === 'daily' ? '📅 Hatchery Daily Operations Timeline' : '📊 Monthly Production &amp; Harvest Summary'}
                            </h3>
                            <span class="section-subtag">
                                ${this.cadenceView === 'daily' 
                                    ? `Day-by-day operations (Stocking, Harvest, Flush) for ${scopeLabel}` 
                                    : `Aggregated monthly performance ledger for ${scopeLabel}`}
                            </span>
                        </div>

                        <!-- Cadence Toggle Buttons -->
                        <div class="hatchery-cadence-toggle">
                            <button class="hatchery-cadence-btn ${this.cadenceView === 'daily' ? 'active' : ''}" id="btn-cadence-daily" title="View Daily Operational Timeline">
                                📅 Daily Operations Timeline
                            </button>
                            <button class="hatchery-cadence-btn ${this.cadenceView === 'monthly' ? 'active' : ''}" id="btn-cadence-monthly" title="View Monthly Performance Ledger">
                                📊 Monthly Performance Ledger
                            </button>
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

                        <div class="filter-scope-display">
                            <span class="active-scope-badge">
                                Active Scope: <strong>${scopeLabel}</strong> • Species: <strong>${this.selectedSpecies === 'ALL' ? 'All Species' : (this.selectedSpecies === 'MON' ? 'P.Monodon' : 'L.Vannamei')}</strong>
                            </span>
                        </div>
                    </div>

                    <!-- Mode B: Daily Operations Timeline -->
                    ${this.cadenceView === 'daily' ? `
                        ${this.selectedMonth === 'ALL' ? `
                            <div class="hatchery-empty-prompt">
                                <div class="prompt-icon">📅</div>
                                <div class="prompt-text">
                                    <h4>Select a Specific Month to View Daily Operations</h4>
                                    <p>The daily timeline displays day-by-day tank stockings, harvest dispatches, and discards for a single month.</p>
                                </div>
                                <button class="hatchery-nav-btn accent" id="btn-jump-october">
                                    <span>📅 Jump to October 2026 Daily Timeline</span>
                                </button>
                            </div>
                        ` : `
                            <div class="table-responsive">
                                <table class="hatchery-table ops-timeline-table">
                                    <thead>
                                        <tr>
                                            <th style="min-width: 120px;">Date</th>
                                            <th style="min-width: 170px;">Activity Summary</th>
                                            <th style="min-width: 200px;">Stocking (Nauplii In)</th>
                                            <th style="min-width: 220px;">Harvest Dispatches (PL Out)</th>
                                            <th style="min-width: 200px;">Target Farm Pond(s)</th>
                                            <th style="min-width: 180px;">Flushes &amp; Discards</th>
                                            <th style="min-width: 140px;">Daily Net Balance</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${dailyOps.length > 0 ? dailyOps.map(d => {
                                            const dayOfWeek = getDayOfWeek(d.date);
                                            const hasStocking = d.stockingsCount > 0;
                                            const hasHarvest = d.harvestsCount > 0;
                                            const hasFlush = d.flushesCount > 0;

                                            const stockingHtml = hasStocking ? `
                                                <div class="op-event-cell">
                                                    <div class="op-qty-main text-success">
                                                        <strong>+${d.totalStockedK.toLocaleString()}k</strong>
                                                        <small class="text-muted">(${d.stockTanks.length} ${d.stockTanks.length === 1 ? 'Tank' : 'Tanks'})</small>
                                                    </div>
                                                    <div class="op-tank-badges">
                                                        ${d.stockTanks.map(t => `<span class="tank-code-badge stock font-mono font-bold">${t}</span>`).join(' ')}
                                                    </div>
                                                </div>
                                            ` : `<span class="text-muted font-mono">—</span>`;

                                            const harvestHtml = hasHarvest ? `
                                                <div class="op-event-cell">
                                                    <div class="op-qty-main text-primary">
                                                        <strong>${d.totalHarvestedK.toLocaleString()}k PL</strong>
                                                        <small class="text-muted">(${d.harvestTanks.length} ${d.harvestTanks.length === 1 ? 'Tank' : 'Tanks'})</small>
                                                    </div>
                                                    <div class="op-tank-badges">
                                                        ${d.harvestTanks.map(t => `<span class="tank-code-badge harvest font-mono font-bold">${t}</span>`).join(' ')}
                                                    </div>
                                                    ${d.avgStage ? `<div class="op-sub-info font-mono text-xs text-muted">Avg Stage: PL ${d.avgStage}</div>` : ''}
                                                </div>
                                            ` : `<span class="text-muted font-mono">—</span>`;

                                            const pondsHtml = (d.linkedPonds && d.linkedPonds.length > 0)
                                                ? d.linkedPonds.map(p => `
                                                    <a href="#/dbms?pond=${encodeURIComponent(p)}" class="spawn-block-tag sha font-mono" title="Jump to Pond ${p} in DBMS" style="text-decoration: none; margin-right: 0.25rem; display: inline-block;">
                                                        ${p}
                                                    </a>
                                                `).join('')
                                                : (hasHarvest ? `<span class="badge badge-neutral">External / Hatchery Dispatch</span>` : `<span class="text-muted font-mono">—</span>`);

                                            const flushHtml = hasFlush ? `
                                                <div class="op-event-cell">
                                                    <div class="op-qty-main text-amber">
                                                        <strong>⚠️ ${d.totalFlushedK.toLocaleString()}k</strong>
                                                        <small class="text-muted">(${d.flushTanks.length} ${d.flushTanks.length === 1 ? 'Tank' : 'Tanks'})</small>
                                                    </div>
                                                    <div class="op-tank-badges">
                                                        ${d.flushTanks.map(t => `<span class="tank-code-badge flush font-mono font-bold">${t}</span>`).join(' ')}
                                                    </div>
                                                </div>
                                            ` : `<span class="text-muted font-mono">—</span>`;

                                            const inQty = d.totalStockedK;
                                            const outQty = d.totalHarvestedK + d.totalFlushedK;

                                            return `
                                                <tr class="daily-ops-row">
                                                    <td>
                                                        <div class="daily-date-cell">
                                                            <strong class="font-mono">${d.date}</strong>
                                                            <span class="day-tag">${dayOfWeek}</span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div class="activity-pill-group">
                                                            ${hasStocking ? `<span class="daily-op-pill stocking">📥 Stocking (${d.stockingsCount})</span>` : ''}
                                                            ${hasHarvest ? `<span class="daily-op-pill harvest">🦐 Harvest (${d.harvestsCount})</span>` : ''}
                                                            ${hasFlush ? `<span class="daily-op-pill flush">⚠️ Flush (${d.flushesCount})</span>` : ''}
                                                        </div>
                                                    </td>
                                                    <td>${stockingHtml}</td>
                                                    <td>${harvestHtml}</td>
                                                    <td>${pondsHtml}</td>
                                                    <td>${flushHtml}</td>
                                                    <td>
                                                        <div class="daily-balance-cell font-mono text-xs">
                                                            <div>In: <strong class="text-success">+${inQty.toLocaleString()}k</strong></div>
                                                            <div>Out: <strong class="text-primary">-${outQty.toLocaleString()}k</strong></div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            `;
                                        }).join('') : `
                                            <tr>
                                                <td colspan="7" class="text-center text-muted py-4">
                                                    No operational activities (stockings, harvests, or flushes) recorded for ${this.getMonthName(this.selectedMonth)} ${activeYear}.
                                                </td>
                                            </tr>
                                        `}
                                    </tbody>
                                </table>
                            </div>
                        `}
                    ` : `
                        <!-- Mode A: Monthly Performance Ledger -->
                        <div class="table-responsive">
                            <table class="hatchery-table ops-monthly-table">
                                <thead>
                                    <tr>
                                        <th>Month</th>
                                        <th>Species</th>
                                        <th>Tanks Stocked</th>
                                        <th>Tanks Harvested</th>
                                        <th>Overall SR %</th>
                                        <th>Avg Stage</th>
                                        <th>Farm vs Ext Split</th>
                                        <th>Tanks Flushed</th>
                                        <th>Operational Timeline</th>
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

                                        return `
                                            <tr>
                                                <td><strong class="font-mono font-bold">${m.monthKey}</strong></td>
                                                <td><span class="badge ${m.species.includes('Monodon') ? 'badge-neutral' : 'badge-info'}">${escapeHtml(m.species)}</span></td>
                                                <td>
                                                    <strong>${m.stockedTanksCount} Tanks</strong>
                                                    <div class="font-mono text-xs text-muted">${m.naupliiStockedK.toLocaleString()}k Nauplii</div>
                                                </td>
                                                <td>
                                                    <strong class="text-primary">${m.harvestedTanksCount} Tanks</strong>
                                                    <div class="font-mono text-xs text-primary font-bold">${m.plHarvestedK.toLocaleString()}k PL</div>
                                                </td>
                                                <td>
                                                    <span class="${srClass}">${srVal !== null ? srVal + '%' : '—'}</span>
                                                </td>
                                                <td>${m.avgPlStage ? `PL ${m.avgPlStage}` : '—'}</td>
                                                <td>
                                                    <div class="text-xs">
                                                        <div>SGO: <strong>${m.sgoHarvestK.toLocaleString()}k</strong></div>
                                                        <div>Ext: <strong>${m.externalHarvestK.toLocaleString()}k</strong></div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <strong>${m.flushedTanksCount} Tanks</strong>
                                                    <div class="font-mono text-xs text-amber">${m.naupliiFlushedK.toLocaleString()}k Discard</div>
                                                </td>
                                                <td>
                                                    <button class="btn-ops-drilldown" data-month="${m.monthNum}" data-year="${m.year}" title="Open Daily Operations for ${m.monthKey}">
                                                        <span>📅 View Daily ↗</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        `;
                                    }).join('') : `
                                        <tr><td colspan="9" class="text-center text-muted py-4">No monthly records match the selected filters.</td></tr>
                                    `}
                                </tbody>
                            </table>
                        </div>
                    `}
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

        // Cadence View Toggle
        const btnCadenceDaily = document.getElementById("btn-cadence-daily");
        if (btnCadenceDaily) {
            btnCadenceDaily.addEventListener("click", () => {
                this.cadenceView = "daily";
                if (this.selectedMonth === "ALL") {
                    this.selectedMonth = "10"; // Default to October when switching to daily
                }
                this.render();
            });
        }

        const btnCadenceMonthly = document.getElementById("btn-cadence-monthly");
        if (btnCadenceMonthly) {
            btnCadenceMonthly.addEventListener("click", () => {
                this.cadenceView = "monthly";
                this.render();
            });
        }

        // Master Filters
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

        // Jump to October button from prompt
        const btnJumpOctober = document.getElementById("btn-jump-october");
        if (btnJumpOctober) {
            btnJumpOctober.addEventListener("click", () => {
                this.selectedYear = "2026";
                this.selectedMonth = "10";
                this.cadenceView = "daily";
                this.render();
            });
        }

        // Drill-down buttons in Monthly Ledger
        const drilldownBtns = this.container.querySelectorAll(".btn-ops-drilldown");
        drilldownBtns.forEach(btn => {
            btn.addEventListener("click", (e) => {
                const target = e.currentTarget;
                const mNum = target.getAttribute("data-month");
                const mYear = target.getAttribute("data-year");
                if (mNum && mYear) {
                    this.selectedYear = mYear;
                    this.selectedMonth = mNum;
                    this.cadenceView = "daily";
                    this.render();
                }
            });
        });

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
        if (this.cadenceView === "daily" && this.selectedMonth !== "ALL") {
            const activeYear = this.selectedYear === "ALL" ? "2026" : this.selectedYear;
            const targetMonthKey = `${activeYear}-${this.selectedMonth}`;
            const dailyOps = aggregateDailyHatcheryOperations(this.allRuns, this.dispatches, this.flushes, targetMonthKey, this.selectedSpecies);

            if (!dailyOps || dailyOps.length === 0) {
                Toast.warning("No daily operations data available to export.");
                return;
            }

            const headers = ["Date", "Day of Week", "Stockings Count", "Stocked Nauplii (k)", "Stock Tanks", "Harvests Count", "Harvested PL (k)", "Avg Stage", "Harvest Tanks", "Linked Ponds", "Flushes Count", "Flushed Nauplii (k)", "Flush Tanks"];
            const rows = dailyOps.map(d => [
                d.date,
                getDayOfWeek(d.date),
                d.stockingsCount,
                d.totalStockedK,
                d.stockTanks.join("; "),
                d.harvestsCount,
                d.totalHarvestedK,
                d.avgStage || "",
                d.harvestTanks.join("; "),
                d.linkedPonds.join("; "),
                d.flushesCount,
                d.totalFlushedK,
                d.flushTanks.join("; ")
            ]);

            this._downloadCsv(headers, rows, `TPH_Daily_Operations_${targetMonthKey}.csv`);
            Toast.success(`Exported Daily Operations CSV for ${targetMonthKey}!`);
            return;
        }

        if (this.cadenceView === "monthly") {
            const monthlyRollup = aggregateMonthlyHatcheryRollup(this.allRuns, this.dispatches, this.flushes, this.selectedYear, this.selectedSpecies);
            const displayRollup = this.selectedMonth === "ALL"
                ? monthlyRollup
                : monthlyRollup.filter(m => m.monthNum === this.selectedMonth);

            if (!displayRollup || displayRollup.length === 0) {
                Toast.warning("No monthly summary data available to export.");
                return;
            }

            const headers = ["Month", "Species", "Stocked Tanks", "Stocked Nauplii (k)", "Harvested Tanks", "Harvested PL (k)", "Overall SR %", "Avg Stage", "SGO Harvest (k)", "External Harvest (k)", "Flushed Tanks", "Flushed Nauplii (k)"];
            const rows = displayRollup.map(m => [
                m.monthKey,
                m.species,
                m.stockedTanksCount,
                m.naupliiStockedK,
                m.harvestedTanksCount,
                m.plHarvestedK,
                m.overallSrPct !== null ? `${m.overallSrPct}%` : "",
                m.avgPlStage || "",
                m.sgoHarvestK,
                m.externalHarvestK,
                m.flushedTanksCount,
                m.naupliiFlushedK
            ]);

            this._downloadCsv(headers, rows, `TPH_Monthly_Production_Summary_${this.selectedYear}.csv`);
            Toast.success("Exported Monthly Production Summary CSV!");
            return;
        }

        // Fallback or explicit lower view
        if (this.activeViewTab === "dispatches") {
            if (!this.dispatches || this.dispatches.length === 0) {
                Toast.warning("No dispatches available to export.");
                return;
            }

            const headers = ["Tank", "Harvest Date", "Stage", "Quantity (k)", "Destination/Buyer", "Linked Ponds", "DO Number", "Lot Number", "Nauplii Source", "Reported SR %"];
            const rows = this.dispatches.map(d => [
                d.tank_code,
                d.harvest_date,
                `PL ${d.pl_stage}`,
                d.qty_k || "0",
                d.buyer,
                (d.linked_ponds || []).join("; "),
                d.do_number || "",
                d.lot_no || "",
                d.source_code || "",
                d.sr_reported_pct !== null ? `${d.sr_reported_pct}%` : ""
            ]);

            this._downloadCsv(headers, rows, `TPH_PL_Harvest_Dispatches_${new Date().toISOString().split("T")[0]}.csv`);
            Toast.success("Exported PL Harvest Dispatches CSV!");
        } else {
            if (!this.allRuns || this.allRuns.length === 0) {
                Toast.warning("No runs available to export.");
                return;
            }

            const headers = ["Tank", "Stock Date", "Species", "Source", "Stocked (k)", "Status", "First Harvest", "Last Harvest", "Harvested (k)", "Flushed (k)", "SR %"];
            const rows = this.allRuns.map(r => [
                r.tank_code,
                r.stock_date,
                r.species,
                r.source_code,
                r.nauplii_stocked_k || "",
                r.status,
                r.first_harvest_date || "",
                r.last_harvest_date || "",
                r.harvested_total_k || "0",
                r.flushed_total_k || "0",
                r.sr_pct !== null ? `${r.sr_pct}%` : ""
            ]);

            this._downloadCsv(headers, rows, `TPH_Tank_Runs_Log_${new Date().toISOString().split("T")[0]}.csv`);
            Toast.success("Exported Tank Runs CSV!");
        }
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
