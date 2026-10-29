/**
 * iSHARP DBMS 2.0 — Telaga Putat Hatchery (TPH)
 * PL Harvest & Distribution Report Sub-Page
 * Visualizes individual harvest dispatches, tank numbers, linked ponds, and monthly production KPIs
 */

import { HatcheryRepository } from "../../infrastructure/repositories/hatcheryRepository.js";
import { escapeHtml } from "../../utils/formatters.js";
import { Toast } from "../../components/Toast.js";

export class PlHarvestReportPage {
    constructor(containerEl, onNavigate) {
        this.container = containerEl;
        this.onNavigate = onNavigate;
        this.monthlyData = [];
        this.dispatches = [];
        this.allRuns = [];

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
            const [monthly, dispatches, runs] = await Promise.all([
                HatcheryRepository.getPlMonthlyRollup(),
                HatcheryRepository.getHarvestDispatches(1200),
                HatcheryRepository.getAllTankRuns(500)
            ]);
            this.monthlyData = monthly;
            this.dispatches = dispatches;
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
                <p>Loading PL Harvest and Dispatch records...</p>
            </div>
        `;
    }

    render() {
        if (!this.container) return;

        // KPI aggregates
        const totalHarvestedK = this.dispatches.reduce((sum, d) => sum + (Number(d.qty_k) || 0), 0);
        const totalFlushedK = this.allRuns.reduce((sum, r) => sum + (Number(r.flushed_total_k) || 0), 0);
        const srDispatches = this.dispatches.filter(d => d.sr_reported_pct !== null && d.sr_reported_pct !== undefined && d.sr_reported_pct <= 100);
        const avgSr = srDispatches.length > 0 
            ? (srDispatches.reduce((sum, d) => sum + Number(d.sr_reported_pct), 0) / srDispatches.length).toFixed(1) 
            : "—";
        const totalDispatchesCount = this.dispatches.length;

        // Filtered Dispatches
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

        // Filtered Runs
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

        // Derive tanks harvested per month from dispatches
        const tanksByMonth = {};
        this.dispatches.forEach(d => {
            const mKey = (d.harvest_date || "").substring(0, 7);
            if (!tanksByMonth[mKey]) tanksByMonth[mKey] = new Set();
            tanksByMonth[mKey].add(d.tank_code);
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
                            <span class="kpi-caption">${Math.round(totalHarvestedK).toLocaleString()}k total post-larvae</span>
                        </div>
                    </div>

                    <div class="kpi-card-glass kpi-blue">
                        <div class="kpi-icon-orbit">🚚</div>
                        <div class="kpi-body">
                            <span class="kpi-label">Harvest Dispatches</span>
                            <span class="kpi-value">${totalDispatchesCount}</span>
                            <span class="kpi-caption">Logged farm &amp; external deliveries</span>
                        </div>
                    </div>

                    <div class="kpi-card-glass kpi-purple">
                        <div class="kpi-icon-orbit">📈</div>
                        <div class="kpi-body">
                            <span class="kpi-label">Average Reported SR%</span>
                            <span class="kpi-value">${avgSr}%</span>
                            <span class="kpi-caption">Mean harvest survival rate</span>
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
                </section>

                <!-- Monthly Breakdown Section -->
                <section class="report-section-glass">
                    <div class="section-title-row">
                        <h3 class="section-title">📅 Monthly Production &amp; Harvest Summary</h3>
                        <span class="section-subtag">Source: v_hatchery_pl_monthly &amp; Harvest Telemetry</span>
                    </div>

                    <div class="table-responsive">
                        <table class="hatchery-table">
                            <thead>
                                <tr>
                                    <th>Month</th>
                                    <th>Species</th>
                                    <th>Origin</th>
                                    <th>Tanks Harvested</th>
                                    <th>Total Quantity (k)</th>
                                    <th>Avg Stage</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${this.monthlyData.length > 0 ? this.monthlyData.map(m => {
                                    const mKey = m.month_key;
                                    const tanksSet = tanksByMonth[mKey];
                                    const tankList = tanksSet ? Array.from(tanksSet).sort().join(", ") : "—";
                                    const tankCount = tanksSet ? tanksSet.size : m.run_count;

                                    return `
                                        <tr>
                                            <td><strong>${m.month_key}</strong></td>
                                            <td>${m.species === 'MON' ? 'P.Monodon' : 'L.Vannamei'}</td>
                                            <td>${m.source_origin}</td>
                                            <td>
                                                <strong>${tankCount} Tanks</strong>
                                                <small class="text-muted block" style="font-size: 0.72rem; max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${tankList}">
                                                    ${tankList}
                                                </small>
                                            </td>
                                            <td><strong>${Number(m.total_qty_k).toLocaleString()}k</strong></td>
                                            <td>PL ${m.avg_pl_stage || '—'}</td>
                                        </tr>
                                    `;
                                }).join('') : `
                                    <tr><td colspan="6" class="text-center text-muted">No monthly breakdown data found.</td></tr>
                                `}
                            </tbody>
                        </table>
                    </div>
                </section>

                <!-- View Mode Tabs & Filter Controls -->
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

            const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\r\n");
            const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `TPH_PL_Harvest_Dispatches_${new Date().toISOString().split("T")[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
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

            const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\r\n");
            const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `TPH_Tank_Runs_Log_${new Date().toISOString().split("T")[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            Toast.success("Exported Tank Runs CSV!");
        }
    }
}
