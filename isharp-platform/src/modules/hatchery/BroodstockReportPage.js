/**
 * iSHARP DBMS 2.0 — Telaga Putat Hatchery (TPH)
 * Broodstock & Maturation Performance Report Sub-Page
 * Visualizes batch arrivals, daily spawning production, Hatching Rate (HR-A only per Decision 20),
 * and nauplii distribution to PL culture tanks.
 */

import { HatcheryRepository } from "../../infrastructure/repositories/hatcheryRepository.js";
import { escapeHtml, getLocalDateStr } from "../../utils/formatters.js";
import { Toast } from "../../components/Toast.js";
import { calculateBroodstockDOC } from "../../domain/biometrics.js";

export class BroodstockReportPage {
    constructor(containerEl, onNavigate) {
        this.container = containerEl;
        this.onNavigate = onNavigate;
        this.batches = [];
        this.selectedBatchCode = "";
        this.dailyRecords = [];
    }

    async init() {
        this.renderLoading();
        await this.loadData();
        this.render();
    }

    async loadData() {
        try {
            const batchList = await HatcheryRepository.getBroodstockBatches();
            this.batches = batchList;
            if (this.batches.length > 0 && !this.selectedBatchCode) {
                // Default to latest batch
                this.selectedBatchCode = this.batches[0].batch_code;
            }
            if (this.selectedBatchCode) {
                this.dailyRecords = await HatcheryRepository.getBroodstockDailyRecords(this.selectedBatchCode);
            }
        } catch (err) {
            console.error("Failed to load Broodstock Report data:", err);
            Toast.error("Failed to load broodstock batches.");
        }
    }

    async selectBatch(batchCode) {
        this.selectedBatchCode = batchCode;
        this.renderLoading();
        this.dailyRecords = await HatcheryRepository.getBroodstockDailyRecords(batchCode);
        this.render();
    }

    renderLoading() {
        if (!this.container) return;
        this.container.innerHTML = `
            <div class="hatchery-loading-state">
                <div class="hatchery-loading-spinner"></div>
                <p>Loading Broodstock Maturation telemetry &amp; daily records...</p>
            </div>
        `;
    }

    render() {
        if (!this.container) return;

        const currentBatch = this.batches.find(b => b.batch_code === this.selectedBatchCode) || this.batches[0] || {};

        // Permanent Spawn Block (Broodstock batches do not move once stocked in the block)
        const rawBlock = this.dailyRecords.find(d => d.spawn_block)?.spawn_block || "";
        const isBlockB = rawBlock.toUpperCase().includes("SHB") || 
            ["STL", "SK", "AP3", "AP 1/2024"].some(k => (currentBatch.batch_code || "").includes(k));
        const blockName = isBlockB ? "Block B (SHB)" : "Block A (SHA)";
        const blockBadgeClass = isBlockB ? "block-b" : "block-a";

        // Arrived population (from Row 24: B24 Female & C24 Male)
        const arrivedF = currentBatch.arrived_pop_female;
        const arrivedM = currentBatch.arrived_pop_male;
        const totalArrived = (arrivedF != null || arrivedM != null) 
            ? ((Number(arrivedF) || 0) + (Number(arrivedM) || 0)) 
            : null;

        // Current Leftover Population: from latest non-zero daily record (Col K & L, or Col B & C)
        const popRecords = this.dailyRecords.filter(d => 
            (d.mat_pop_female != null && d.mat_pop_female > 0) || 
            (d.quar_pop_female != null && d.quar_pop_female > 0)
        );
        const latestPopRec = popRecords.length > 0 ? popRecords[popRecords.length - 1] : null;
        const currentLeftoverF = latestPopRec ? (latestPopRec.mat_pop_female ?? latestPopRec.quar_pop_female) : null;
        const currentLeftoverM = latestPopRec ? (latestPopRec.mat_pop_male ?? latestPopRec.quar_pop_male) : null;
        const currentLeftoverTotal = (currentLeftoverF != null || currentLeftoverM != null) 
            ? ((Number(currentLeftoverF) || 0) + (Number(currentLeftoverM) || 0)) 
            : null;
        const currentSurvivalPct = (totalArrived && currentLeftoverTotal) 
            ? ((currentLeftoverTotal / totalArrived) * 100).toFixed(1) + '%' 
            : null;

        // Aggregate statistics for selected batch
        const totalGrossNaupliiK = this.dailyRecords.reduce((sum, d) => sum + (Number(d.nauplii_gross_k) || 0), 0);
        const totalSpawns = this.dailyRecords.reduce((sum, d) => sum + (Number(d.spawning_count) || 0), 0);
        const validHrRecords = this.dailyRecords.filter(d => d.hr_a_pct !== null && d.hr_a_pct !== undefined && d.hr_a_pct > 0);
        const avgHrA = validHrRecords.length > 0 
            ? (validHrRecords.reduce((sum, d) => sum + Number(d.hr_a_pct), 0) / validHrRecords.length).toFixed(1) 
            : '—';
        const totalEggsK = this.dailyRecords.reduce((sum, d) => sum + (Number(d.eggs_k) || 0), 0);
        const totalDistributedK = this.dailyRecords.reduce((sum, d) => sum + (Number(d.distribution_tph_k) || 0), 0);

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
                            <span class="report-badge">BROODSTOCK MATURATION &amp; SPAWNING</span>
                            <h1 class="report-title">Broodstock Performance &amp; Daily Spawning Report</h1>
                        </div>
                    </div>

                    <div class="report-header-right">
                        <button class="hatchery-nav-btn accent" id="btn-export-brood-csv" title="Export Daily Records CSV">
                            <span class="btn-icon">📥</span>
                            <span>Export CSV</span>
                        </button>
                    </div>
                </header>

                <!-- Batch Selector Bar -->
                <div class="batch-selector-bar">
                    <div class="batch-select-label">
                        <span class="batch-icon">🧬</span>
                        <strong>Select Broodstock Batch:</strong>
                    </div>
                    <select id="broodstock-batch-select" class="hatchery-select batch-dropdown">
                        ${this.batches.map(b => `
                            <option value="${b.batch_code}" ${b.batch_code === this.selectedBatchCode ? 'selected' : ''}>
                                ${escapeHtml(b.batch_code)} — Arrived ${b.arrival_date} (${escapeHtml(b.supplier)})
                            </option>
                        `).join('')}
                    </select>
                </div>

                <!-- Batch Passport Glass Card -->
                <section class="batch-passport-glass">
                    <div class="passport-header">
                        <div class="passport-code-group">
                            <span class="passport-badge">BATCH PASSPORT</span>
                            <span class="spawn-block-tag ${blockBadgeClass}">● ${blockName}</span>
                            <h2 class="passport-code">${escapeHtml(currentBatch.batch_code || '—')}</h2>
                            <span class="passport-species">${escapeHtml(currentBatch.species || 'L.Vannamei')}</span>
                        </div>
                        <div class="passport-supplier-group">
                            <span class="passport-sublabel">Breeder &amp; Supplier:</span>
                            <span class="passport-supplier">${escapeHtml(currentBatch.supplier || '—')}</span>
                        </div>
                    </div>

                    <div class="passport-grid">
                        <div class="passport-stat">
                            <span class="pstat-label">Arrival Date</span>
                            <span class="pstat-val">${currentBatch.arrival_date || '—'} ${currentBatch.arrival_time ? '• ' + currentBatch.arrival_time : ''}</span>
                        </div>
                        <div class="passport-stat">
                            <span class="pstat-label">Batch Age</span>
                            <span class="pstat-val font-bold text-primary">${currentBatch.arrival_date ? 'DOC ' + calculateBroodstockDOC(currentBatch.arrival_date, new Date()) : '—'}</span>
                        </div>
                        <div class="passport-stat">
                            <span class="pstat-label">Maturation Block</span>
                            <span class="pstat-val font-bold ${isBlockB ? 'text-amber' : 'text-cyan'}">${blockName}</span>
                        </div>
                        <div class="passport-stat">
                            <span class="pstat-label">Arrived Population</span>
                            <span class="pstat-val">♀ ${arrivedF != null ? arrivedF : '—'} | ♂ ${arrivedM != null ? arrivedM : '—'} ${totalArrived ? `<small class="text-muted">(${totalArrived} tails)</small>` : ''}</span>
                        </div>
                        <div class="passport-stat">
                            <span class="pstat-label">Current Leftover</span>
                            <span class="pstat-val font-bold ${currentLeftoverTotal ? 'text-success' : ''}">
                                ${currentLeftoverTotal != null 
                                    ? `♀ ${currentLeftoverF} | ♂ ${currentLeftoverM} <small class="text-muted">(${currentLeftoverTotal} tails • ${currentSurvivalPct})</small>` 
                                    : '—'}
                            </span>
                        </div>
                        <div class="passport-stat">
                            <span class="pstat-label">Initial Female ABW</span>
                            <span class="pstat-val">${currentBatch.abw_female_g ? currentBatch.abw_female_g + ' g' : '—'}</span>
                        </div>
                        <div class="passport-stat">
                            <span class="pstat-label">Initial Male ABW</span>
                            <span class="pstat-val">${currentBatch.abw_male_g ? currentBatch.abw_male_g + ' g' : '—'}</span>
                        </div>
                    </div>
                </section>

                <!-- Batch Lifetime KPI Bento -->
                <section class="hatchery-kpi-bento">
                    <div class="kpi-card-glass kpi-cyan">
                        <div class="kpi-icon-orbit">✨</div>
                        <div class="kpi-body">
                            <span class="kpi-label">Total Nauplii Gross</span>
                            <span class="kpi-value">${(totalGrossNaupliiK / 1000).toFixed(2)}M <small>nauplii</small></span>
                            <span class="kpi-caption">${totalGrossNaupliiK.toLocaleString()}k total gross production</span>
                        </div>
                    </div>

                    <div class="kpi-card-glass kpi-green">
                        <div class="kpi-icon-orbit">🥚</div>
                        <div class="kpi-body">
                            <span class="kpi-label">Average Hatching Rate (HR-A)</span>
                            <span class="kpi-value hr-val">${avgHrA}%</span>
                            <span class="kpi-caption">Empirical display HR (Decision 20)</span>
                        </div>
                    </div>

                    <div class="kpi-card-glass kpi-blue">
                        <div class="kpi-icon-orbit">🦐</div>
                        <div class="kpi-body">
                            <span class="kpi-label">Total Spawning Events</span>
                            <span class="kpi-value">${totalSpawns}</span>
                            <span class="kpi-caption">Total mated female spawns</span>
                        </div>
                    </div>

                    <div class="kpi-card-glass kpi-purple">
                        <div class="kpi-icon-orbit">🚚</div>
                        <div class="kpi-body">
                            <span class="kpi-label">Distributed to TPH Tanks</span>
                            <span class="kpi-value">${(totalDistributedK / 1000).toFixed(2)}M</span>
                            <span class="kpi-caption">${totalDistributedK.toLocaleString()}k stocked into PL tanks</span>
                        </div>
                    </div>
                </section>

                <!-- Daily Monitoring Records Table -->
                <section class="report-section-glass">
                    <div class="section-title-row">
                        <h3 class="section-title">📅 Daily Maturation &amp; Spawning Monitoring Records</h3>
                        <span class="section-subtag">${this.dailyRecords.length} recorded daily shifts for ${escapeHtml(currentBatch.batch_code || '')}</span>
                    </div>

                    <div class="table-responsive">
                        <table class="hatchery-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>DOC</th>
                                    <th>Leftover Pop (♀ / ♂)</th>
                                    <th>Spawns</th>
                                    <th>Eggs (k)</th>
                                    <th>Fertilization %</th>
                                    <th>Nauplii Gross (k)</th>
                                    <th>Hatching Rate (HR-A)</th>
                                    <th>TPH Stocking (k)</th>
                                    <th>Target Tanks</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${this.dailyRecords.length > 0 ? this.dailyRecords.map(d => {
                                    const rowDoc = (d.doc !== null && d.doc !== undefined)
                                        ? d.doc
                                        : (currentBatch.arrival_date ? calculateBroodstockDOC(currentBatch.arrival_date, d.rec_date) : null);

                                    const femaleLeft = d.mat_pop_female ?? d.quar_pop_female;
                                    const maleLeft = d.mat_pop_male ?? d.quar_pop_male;
                                    let leftoverHtml = '—';
                                    if (femaleLeft != null && maleLeft != null) {
                                        const tot = Number(femaleLeft) + Number(maleLeft);
                                        leftoverHtml = `<span class="leftover-pop-pill">♀ ${femaleLeft} | ♂ ${maleLeft} <small class="text-muted">(${tot})</small></span>`;
                                    } else if (femaleLeft != null) {
                                        leftoverHtml = `<span class="leftover-pop-pill">♀ ${femaleLeft}</span>`;
                                    } else if (maleLeft != null) {
                                        leftoverHtml = `<span class="leftover-pop-pill">♂ ${maleLeft}</span>`;
                                    }

                                    return `
                                    <tr>
                                        <td><strong>${d.rec_date}</strong></td>
                                        <td>${rowDoc !== null ? 'DOC ' + rowDoc : '—'}</td>
                                        <td>${leftoverHtml}</td>
                                        <td>${d.spawning_count || '0'}</td>
                                        <td>${d.eggs_k ? Number(d.eggs_k).toLocaleString() + 'k' : '—'}</td>
                                        <td>${d.fertilization_rate_pct !== null && d.fertilization_rate_pct !== undefined ? d.fertilization_rate_pct + '%' : '—'}</td>
                                        <td><strong>${d.nauplii_gross_k ? Number(d.nauplii_gross_k).toLocaleString() + 'k' : '—'}</strong></td>
                                        <td class="hr-cell">
                                            <strong>${d.hr_a_pct !== null && d.hr_a_pct !== undefined ? d.hr_a_pct + '%' : '—'}</strong>
                                        </td>
                                        <td>${d.distribution_tph_k ? Number(d.distribution_tph_k).toLocaleString() + 'k' : '—'}</td>
                                        <td>
                                            ${d.distribution_tank_list ? `<span class="tank-target-pill">${escapeHtml(d.distribution_tank_list)}</span>` : '—'}
                                        </td>
                                    </tr>
                                    `;
                                }).join('') : `
                                    <tr><td colspan="10" class="text-center text-muted">No daily records found for this batch.</td></tr>
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

        const batchSelect = document.getElementById("broodstock-batch-select");
        if (batchSelect) {
            batchSelect.addEventListener("change", (e) => {
                this.selectBatch(e.target.value);
            });
        }

        const btnExport = document.getElementById("btn-export-brood-csv");
        if (btnExport) {
            btnExport.addEventListener("click", () => this.exportCsv());
        }
    }

    exportCsv() {
        if (!this.dailyRecords || this.dailyRecords.length === 0) {
            Toast.warning("No daily records to export.");
            return;
        }

        const currentBatch = this.batches.find(b => b.batch_code === this.selectedBatchCode);
        const headers = ["Batch", "Date", "DOC", "Leftover Female", "Leftover Male", "Leftover Total", "Spawning Count", "Eggs (k)", "Fertilization %", "Nauplii Gross (k)", "HR-A %", "Distribution TPH (k)", "Tanks"];
        const rows = this.dailyRecords.map(d => {
            const rowDoc = (d.doc !== null && d.doc !== undefined)
                ? d.doc
                : (currentBatch?.arrival_date ? calculateBroodstockDOC(currentBatch.arrival_date, d.rec_date) : "");
            const femaleLeft = d.mat_pop_female ?? d.quar_pop_female;
            const maleLeft = d.mat_pop_male ?? d.quar_pop_male;
            const totalLeft = (femaleLeft != null || maleLeft != null) 
                ? ((Number(femaleLeft) || 0) + (Number(maleLeft) || 0)) 
                : "";

            return [
                d.batch_code,
                d.rec_date,
                rowDoc !== null ? rowDoc : "",
                femaleLeft != null ? femaleLeft : "",
                maleLeft != null ? maleLeft : "",
                totalLeft,
                d.spawning_count || "0",
                d.eggs_k || "",
                d.fertilization_rate_pct !== null ? d.fertilization_rate_pct : "",
                d.nauplii_gross_k || "",
                d.hr_a_pct !== null ? d.hr_a_pct : "",
                d.distribution_tph_k || "",
                d.distribution_tank_list || ""
            ];
        });

        const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\r\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `TPH_Broodstock_Batch_${this.selectedBatchCode.replace(/[\/\s]/g, '_')}_${getLocalDateStr(new Date())}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        Toast.success("Exported Broodstock Daily Records CSV!");
    }
}
