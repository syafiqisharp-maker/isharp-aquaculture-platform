/**
 * iSHARP DBMS 2.0 — Telaga Putat Hatchery (TPH)
 * PL Harvest Report Sub-Page
 * Visualizes monthly aggregate harvest KPIs, stages, survival rates, and complete run logs
 */

import { HatcheryRepository } from "../../infrastructure/repositories/hatcheryRepository.js";
import { escapeHtml } from "../../utils/formatters.js";
import { Toast } from "../../components/Toast.js";

export class PlHarvestReportPage {
    constructor(containerEl, onNavigate) {
        this.container = containerEl;
        this.onNavigate = onNavigate;
        this.monthlyData = [];
        this.allRuns = [];

        this.filterSpecies = "ALL";
        this.filterOrigin = "ALL";
        this.filterStatus = "ALL";
        this.searchQuery = "";
    }

    async init() {
        this.renderLoading();
        await this.loadData();
        this.render();
    }

    async loadData() {
        try {
            const [monthly, runs] = await Promise.all([
                HatcheryRepository.getPlMonthlyRollup(),
                HatcheryRepository.getAllTankRuns(500)
            ]);
            this.monthlyData = monthly;
            this.allRuns = runs;
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

    render() {
        if (!this.container) return;

        // KPI aggregates
        const totalHarvestedK = this.allRuns.reduce((sum, r) => sum + (Number(r.harvested_total_k) || 0), 0);
        const totalFlushedK = this.allRuns.reduce((sum, r) => sum + (Number(r.flushed_total_k) || 0), 0);
        const srRuns = this.allRuns.filter(r => r.sr_pct !== null && r.sr_pct !== undefined && r.sr_pct <= 100);
        const avgSr = srRuns.length > 0 ? (srRuns.reduce((sum, r) => sum + Number(r.sr_pct), 0) / srRuns.length).toFixed(1) : '—';
        const activeRunsCount = this.allRuns.filter(r => r.status === "CULTURE").length;

        // Filtered runs
        const filteredRuns = this.allRuns.filter(r => {
            if (this.filterSpecies !== "ALL" && r.species !== this.filterSpecies) return false;
            if (this.filterStatus !== "ALL" && r.status !== this.filterStatus) return false;
            if (this.searchQuery) {
                const q = this.searchQuery.toLowerCase();
                const tank = (r.tank_code || "").toLowerCase();
                const src = (r.source_code || "").toLowerCase();
                return tank.includes(q) || src.includes(q);
            }
            return true;
        });

        this.container.innerHTML = `
            <div class="hatchery-report-page">
                <!-- Header -->
                <header class="report-header">
                    <div class="report-header-left">
                        <button class="hatchery-nav-btn secondary" id="btn-back-to-map" title="Back to 64-Tank Map">
                            <span class="btn-icon">⬅</span>
                            <span>Back to Hatchery Map</span>
                        </button>
                        <div class="report-title-group">
                            <span class="report-badge">PRODUCTION &amp; HARVEST LOG</span>
                            <h1 class="report-title">Post-Larvae (PL) Harvest &amp; Distribution Report</h1>
                        </div>
                    </div>

                    <div class="report-header-right">
                        <button class="hatchery-nav-btn accent" id="btn-export-pl-csv" title="Export to CSV">
                            <span class="btn-icon">📥</span>
                            <span>Export CSV</span>
                        </button>
                    </div>
                </header>

                <!-- KPI Bento -->
                <section class="hatchery-kpi-bento">
                    <div class="kpi-card-glass kpi-cyan">
                        <div class="kpi-icon-orbit">📦</div>
                        <div class="kpi-body">
                            <span class="kpi-label">Total PL Harvested</span>
                            <span class="kpi-value">${(totalHarvestedK / 1000).toFixed(2)}M <small>PL</small></span>
                            <span class="kpi-caption">${totalHarvestedK.toLocaleString()}k total post-larvae</span>
                        </div>
                    </div>

                    <div class="kpi-card-glass kpi-amber">
                        <div class="kpi-icon-orbit">⚠️</div>
                        <div class="kpi-body">
                            <span class="kpi-label">Total Flushed Discard</span>
                            <span class="kpi-value">${(totalFlushedK / 1000).toFixed(2)}M <small>PL</small></span>
                            <span class="kpi-caption">Early Zoea &amp; discard flushes</span>
                        </div>
                    </div>

                    <div class="kpi-card-glass kpi-blue">
                        <div class="kpi-icon-orbit">📈</div>
                        <div class="kpi-body">
                            <span class="kpi-label">Average Tank Survival Rate</span>
                            <span class="kpi-value">${avgSr}%</span>
                            <span class="kpi-caption">Excluding data entry outliers</span>
                        </div>
                    </div>

                    <div class="kpi-card-glass kpi-purple">
                        <div class="kpi-icon-orbit">🧪</div>
                        <div class="kpi-body">
                            <span class="kpi-label">Culture Runs Active</span>
                            <span class="kpi-value">${activeRunsCount}</span>
                            <span class="kpi-caption">Currently growing in tanks</span>
                        </div>
                    </div>
                </section>

                <!-- Monthly Breakdown Section -->
                <section class="report-section-glass">
                    <div class="section-title-row">
                        <h3 class="section-title">📅 Monthly Production &amp; Harvest Breakdown</h3>
                        <span class="section-subtag">Source: v_hatchery_pl_monthly</span>
                    </div>

                    <div class="table-responsive">
                        <table class="hatchery-table">
                            <thead>
                                <tr>
                                    <th>Month</th>
                                    <th>Event Type</th>
                                    <th>Origin</th>
                                    <th>Species</th>
                                    <th>Run Count</th>
                                    <th>Total Quantity (k)</th>
                                    <th>Avg Stage</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${this.monthlyData.length > 0 ? this.monthlyData.map(m => `
                                    <tr>
                                        <td><strong>${m.month_key}</strong></td>
                                        <td>
                                            <span class="hatchery-status-tag ${m.event_type.toLowerCase()}">${m.event_type}</span>
                                        </td>
                                        <td>${m.source_origin}</td>
                                        <td>${m.species === 'MON' ? 'P.Monodon' : 'L.Vannamei'}</td>
                                        <td>${m.run_count}</td>
                                        <td><strong>${Number(m.total_qty_k).toLocaleString()}k</strong></td>
                                        <td>PL ${m.avg_pl_stage || '—'}</td>
                                    </tr>
                                `).join('') : `
                                    <tr><td colspan="7" class="text-center text-muted">No monthly breakdown data found.</td></tr>
                                `}
                            </tbody>
                        </table>
                    </div>
                </section>

                <!-- Filter Controls -->
                <div class="hatchery-controls-bar">
                    <div class="filter-group">
                        <label for="filter-species-select" class="filter-label">Species:</label>
                        <select id="filter-species-select" class="hatchery-select">
                            <option value="ALL" ${this.filterSpecies === 'ALL' ? 'selected' : ''}>All Species</option>
                            <option value="VAN" ${this.filterSpecies === 'VAN' ? 'selected' : ''}>L.Vannamei</option>
                            <option value="MON" ${this.filterSpecies === 'MON' ? 'selected' : ''}>P.Monodon</option>
                        </select>
                    </div>

                    <div class="filter-group">
                        <label for="filter-status-select" class="filter-label">Status:</label>
                        <select id="filter-status-select" class="hatchery-select">
                            <option value="ALL" ${this.filterStatus === 'ALL' ? 'selected' : ''}>All Statuses</option>
                            <option value="HARVESTED" ${this.filterStatus === 'HARVESTED' ? 'selected' : ''}>Harvested</option>
                            <option value="CULTURE" ${this.filterStatus === 'CULTURE' ? 'selected' : ''}>In Culture</option>
                            <option value="FLUSHED" ${this.filterStatus === 'FLUSHED' ? 'selected' : ''}>Flushed</option>
                        </select>
                    </div>

                    <div class="search-group">
                        <input 
                            type="search" 
                            id="runs-search-input" 
                            class="hatchery-search-input" 
                            placeholder="🔍 Filter by tank code or source..." 
                            value="${escapeHtml(this.searchQuery)}"
                        />
                    </div>
                </div>

                <!-- Complete Tank Runs Log Table -->
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
                                    <th>Flags</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${filteredRuns.length > 0 ? filteredRuns.map(r => `
                                    <tr>
                                        <td><strong>${r.tank_code}</strong></td>
                                        <td>${r.stock_date}</td>
                                        <td>${r.species === 'MON' ? 'P.Monodon' : 'L.Vannamei'}</td>
                                        <td><span class="source-tag">${escapeHtml(r.source_code)}</span></td>
                                        <td>${r.nauplii_stocked_k ? Number(r.nauplii_stocked_k).toLocaleString() + 'k' : '—'}</td>
                                        <td>
                                            <span class="hatchery-status-tag ${r.status.toLowerCase()}">${r.status}</span>
                                        </td>
                                        <td>${r.first_harvest_date || '—'}</td>
                                        <td>${r.last_harvest_date || '—'}</td>
                                        <td><strong>${r.harvested_total_k ? Number(r.harvested_total_k).toLocaleString() + 'k' : '0k'}</strong></td>
                                        <td>${r.flushed_total_k ? Number(r.flushed_total_k).toLocaleString() + 'k' : '0k'}</td>
                                        <td class="${r.sr_pct >= 70 ? 'text-success' : ''}">
                                            <strong>${r.sr_pct !== null && r.sr_pct !== undefined ? r.sr_pct + '%' : '—'}</strong>
                                        </td>
                                        <td>
                                            ${(r.flags || []).map(f => `<span class="flag-pill">${f}</span>`).join(' ')}
                                        </td>
                                    </tr>
                                `).join('') : `
                                    <tr><td colspan="12" class="text-center text-muted">No runs matched the selected filters.</td></tr>
                                `}
                            </tbody>
                        </table>
                    </div>
                </section>
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

        const speciesSelect = document.getElementById("filter-species-select");
        if (speciesSelect) {
            speciesSelect.addEventListener("change", (e) => {
                this.filterSpecies = e.target.value;
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
        if (!this.allRuns || this.allRuns.length === 0) {
            Toast.warning("No runs available to export.");
            return;
        }

        const headers = ["Tank", "Stock Date", "Species", "Source", "Stocked (k)", "Status", "First Harvest", "Last Harvest", "Harvested (k)", "Flushed (k)", "SR %", "Flags"];
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
            r.sr_pct !== null ? r.sr_pct : "",
            (r.flags || []).join(";")
        ]);

        const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\r\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `TPH_PL_Harvest_Report_${new Date().toISOString().split("T")[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        Toast.success("Exported PL Harvest Report CSV!");
    }
}
