/**
 * iSHARP DBMS 2.0 — Monthly Production Roll-Up Tab (Phase 5)
 * 1:1 Replacement for Excel "prt" sheet.
 * Pure Semantic CSS — renders complete tables, sticky headers, quarterly & annual roll-ups.
 */

import { simulationStore } from "../../state/simulationStore.js";
import { SPECIES } from "../../domain/simulation/baselineCalibrator.js";

export class MonthlyProductionTab {
    constructor(containerId = "sim-active-view-container", onYearChange = null) {
        this.containerId = containerId;
        this.onYearChange = onYearChange;
        this.selectedYear = 2026;
        this.selectedSpecies = "ALL";
    }

    setYear(year) {
        this.selectedYear = Number(year) || 2026;
        this.render();
    }

    render() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        const simResult = simulationStore.simulationResult;
        const actualMonths = simulationStore.actualMonths || [];
        const cutoffMonth = simulationStore.cutoffMonth || 10;
        const yr = this.selectedYear;

        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

        const rawMonthly = simResult?.monthlyMatrix || simResult?.monthlySummary || [];
        const monthlyMatrix = Array.isArray(rawMonthly)
            ? rawMonthly.filter(m => m.year === yr)
            : [];

        container.innerHTML = `
            <div class="sim-stack-layout">
                
                <!-- Toolbar -->
                <div class="sim-command-bar">
                    <div class="sim-toolbar-group">
                        <h2 class="sim-section-heading">
                            <span>📊</span> Monthly Production Roll-Up (Replaces Excel 'prt')
                        </h2>
                        <div class="sim-pill-group">
                            <button type="button" id="btn-prt-yr-2026" class="btn-pill-item ${yr === 2026 ? "active" : ""}">FY 2026</button>
                            <button type="button" id="btn-prt-yr-2027" class="btn-pill-item ${yr === 2027 ? "active" : ""}">FY 2027</button>
                            <button type="button" id="btn-prt-yr-2028" class="btn-pill-item ${yr === 2028 ? "active" : ""}">FY 2028</button>
                        </div>
                    </div>

                    <div class="sim-toolbar-group" style="font-size: 0.75rem;">
                        <div style="display: flex; align-items: center; gap: 0.35rem; font-weight: 700;">
                            <span style="color: #64748b;">Species:</span>
                            <select id="select-prt-species" class="sim-select-control" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">
                                <option value="ALL" ${this.selectedSpecies === "ALL" ? "selected" : ""}>Blended (All Species)</option>
                                <option value="${SPECIES.VANNAMEI}" ${this.selectedSpecies === SPECIES.VANNAMEI ? "selected" : ""}>L. vannamei</option>
                                <option value="${SPECIES.MONODON}" ${this.selectedSpecies === SPECIES.MONODON ? "selected" : ""}>P. monodon</option>
                            </select>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.35rem;">
                            <span class="sim-badge-actual">● Actual YTD (Jan–Oct)</span>
                            <span class="sim-badge-forecast">● Rolling Plan (Nov–Dec)</span>
                        </div>
                    </div>
                </div>

                <!-- 1:1 "prt" Production Matrix Table -->
                <div class="sim-table-container">
                    <table class="sim-data-table-styled">
                        <thead>
                            <tr>
                                <th class="sim-sticky-cell" style="width: 220px; text-align: left;">Key Metric (Excel 'prt')</th>
                                <th style="width: 60px;">Unit</th>
                                ${monthNames.map((mName, mIdx) => {
                                    const mNum = mIdx + 1;
                                    const isActual = yr === 2026 && mNum <= cutoffMonth;
                                    const colCls = isActual ? "sim-actual-col" : "sim-forecast-col";
                                    const borderStyle = (mNum === cutoffMonth && yr === 2026) ? "border-right: 2px solid #10b981;" : "";
                                    return `
                                        <th class="${colCls}" style="${borderStyle}">
                                            ${mName} ${isActual ? "🔒" : "✏️"}
                                        </th>
                                    `;
                                }).join("")}
                                <th style="background: #e0f2fe; color: #0369a1; font-weight: 900;">Full Year (LE)</th>
                                <th>Q1</th>
                                <th>Q2</th>
                                <th>Q3</th>
                                <th>Q4</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this._renderTableRows(monthlyMatrix, actualMonths, cutoffMonth)}
                        </tbody>
                    </table>
                </div>

            </div>
        `;

        this._bindEvents(container);
    }

    _resolveSpeciesSlice(monthItem) {
        if (!monthItem) return null;
        if (this.selectedSpecies === "ALL") return monthItem;
        if (monthItem.bySpecies && monthItem.bySpecies[this.selectedSpecies]) {
            return monthItem.bySpecies[this.selectedSpecies];
        }
        return monthItem;
    }

    _renderTableRows(monthlyMatrix, actualMonths, cutoffMonth) {
        const yr = this.selectedYear;

        const renderRow = (label, unit, extractor, isAvg = false, decimals = 1, isBold = false) => {
            const vals = [];
            for (let m = 1; m <= 12; m++) {
                const rawMData = monthlyMatrix.find(item => item.month === m);
                const rawAData = actualMonths.find(item => item.month === m);
                const isActual = yr === 2026 && m <= cutoffMonth && Boolean(rawAData);

                const mData = this._resolveSpeciesSlice(rawMData);
                const aData = this._resolveSpeciesSlice(rawAData);

                let val = 0;
                if (isActual && aData) {
                    val = extractor(aData, true);
                } else if (mData) {
                    val = extractor(mData, false);
                }
                vals.push({ val: Number(val) || 0, isActual });
            }

            const sumSlice = (arr) => arr.reduce((acc, x) => acc + x.val, 0);
            const avgSlice = (arr) => {
                const active = arr.filter(x => x.val !== 0);
                return active.length > 0 ? (sumSlice(active) / active.length) : 0;
            };

            const q1 = isAvg ? avgSlice(vals.slice(0, 3)) : sumSlice(vals.slice(0, 3));
            const q2 = isAvg ? avgSlice(vals.slice(3, 6)) : sumSlice(vals.slice(3, 6));
            const q3 = isAvg ? avgSlice(vals.slice(6, 9)) : sumSlice(vals.slice(6, 9));
            const q4 = isAvg ? avgSlice(vals.slice(9, 12)) : sumSlice(vals.slice(9, 12));
            const fy = isAvg ? avgSlice(vals) : sumSlice(vals);

            const rowStyle = isBold ? "font-weight: 800; background: #f8fafc;" : "";

            return `
                <tr style="${rowStyle}">
                    <td class="sim-sticky-cell" style="text-align: left;">${label}</td>
                    <td style="text-align: center; color: #64748b; font-family: monospace;">${unit}</td>
                    ${vals.map((item, idx) => {
                        const mNum = idx + 1;
                        const borderStyle = (mNum === cutoffMonth && yr === 2026) ? "border-right: 2px solid #10b981;" : "";
                        const bgStyle = item.isActual ? "background: rgba(16,185,129,0.05); font-weight: 700; color: #065f46;" : "";
                        return `
                            <td style="text-align: right; ${borderStyle} ${bgStyle}">
                                ${decimals === 0 ? Math.round(item.val).toLocaleString() : item.val.toFixed(decimals)}
                            </td>
                        `;
                    }).join("")}
                    <td style="text-align: right; font-weight: 900; background: #f0f9ff; color: #0284c7;">
                        ${decimals === 0 ? Math.round(fy).toLocaleString() : fy.toFixed(decimals)}
                    </td>
                    <td style="text-align: right; color: #475569;">${decimals === 0 ? Math.round(q1).toLocaleString() : q1.toFixed(decimals)}</td>
                    <td style="text-align: right; color: #475569;">${decimals === 0 ? Math.round(q2).toLocaleString() : q2.toFixed(decimals)}</td>
                    <td style="text-align: right; color: #475569;">${decimals === 0 ? Math.round(q3).toLocaleString() : q3.toFixed(decimals)}</td>
                    <td style="text-align: right; color: #475569;">${decimals === 0 ? Math.round(q4).toLocaleString() : q4.toFixed(decimals)}</td>
                </tr>
            `;
        };

        return `
            <tr class="sim-category-header">
                <td colspan="18">1. Pond Turnaround &amp; Stocking Execution</td>
            </tr>
            ${renderRow("Idle Days (DOP Rest)", "days", (d) => d.dop_days || d.dopDays || 0, true, 0)}
            ${renderRow("Ponds Stocked", "ponds", (d) => d.stocked_ponds || d.stockedPonds || d.stockedPondsCount || 0, false, 0)}
            ${renderRow("Water Area Stocked", "ha", (d) => (d.stocked_ponds || d.stockedPonds || d.stockedPondsCount || 0) * 0.5, false, 1)}
            ${renderRow("Stocked Fry (PL)", "M pcs", (d) => d.stocked_pl_m || (d.stockedPlPcs ? (d.stockedPlPcs / 1000000) : 0), false, 2)}
            ${renderRow("Average Stocking Density", "PL/m²", (d) => d.density || d.averageDensityPlM2 || 0, true, 0)}

            <tr class="sim-category-header" style="background: #ecfdf5; color: #065f46;">
                <td colspan="18">2. Harvest Biomass, Size &amp; Productivity</td>
            </tr>
            ${renderRow("Partial Harvest Ponds", "ponds", (d) => d.partial_harvest_ponds || 0, false, 0)}
            ${renderRow("Partial Harvest Tonnage", "MT", (d) => d.partial_harvest_mt || 0, false, 1)}
            ${renderRow("Final Harvest Ponds", "ponds", (d) => d.harvested_ponds || d.pondsHarvested || d.harvestedPondsCount || 0, false, 0)}
            ${renderRow("Total Harvest Tonnage", "MT", (d) => d.harvest_mt || d.yieldMt || d.harvestYieldMt || 0, false, 1, true)}
            ${renderRow("Average Body Weight (ABW)", "g/pc", (d) => d.final_abw || d.averageHarvestAbwG || d.abw || 0, true, 1)}
            ${renderRow("Average Daily Gain (ADG)", "g/day", (d) => d.adg || d.final_adg || 0, true, 3)}
            ${renderRow("Productivity per Pond", "MT/pond", (d) => {
                const hPonds = d.harvested_ponds || d.pondsHarvested || d.harvestedPondsCount || 0;
                const hMt = d.harvest_mt || d.yieldMt || d.harvestYieldMt || 0;
                return hPonds > 0 ? hMt / hPonds : 0;
            }, true, 2)}
            ${renderRow("Yield per Hectare", "MT/ha", (d) => {
                const hPonds = d.harvested_ponds || d.pondsHarvested || d.harvestedPondsCount || 0;
                const hMt = d.harvest_mt || d.yieldMt || d.harvestYieldMt || 0;
                return hPonds > 0 ? hMt / (hPonds * 0.5) : 0;
            }, true, 2)}

            <tr class="sim-category-header" style="background: #fef3c7; color: #92400e;">
                <td colspan="18">3. Biological Efficiency, Feed &amp; Farm EBITDA</td>
            </tr>
            ${renderRow("Survival Rate (SR)", "%", (d) => d.final_sr || d.averageSurvivalRatePct || d.sr || 0, true, 1)}
            ${renderRow("Feed Conversion Ratio (FCR)", "ratio", (d) => d.final_fcr || d.fcr || 0, true, 2)}
            ${renderRow("Feed Consumed", "MT", (d) => (d.feed_kg || d.feedKg || 0) / 1000, false, 1)}
            ${renderRow("Sales Revenue", "RM '000", (d) => (d.revenue_rm || d.revenueRM || d.revenueRm || 0) / 1000, false, 0, true)}
            ${renderRow("Farm EBITDA", "RM '000", (d) => (d.ebitda_rm || d.ebitdaRM || d.ebitdaRm || 0) / 1000, false, 0, true)}
        `;
    }

    _bindEvents(container) {
        [2026, 2027, 2028].forEach(yr => {
            container.querySelector(`#btn-prt-yr-${yr}`)?.addEventListener("click", () => {
                this.selectedYear = yr;
                if (typeof this.onYearChange === "function") {
                    this.onYearChange(yr);
                } else {
                    this.render();
                }
            });
        });

        container.querySelector("#select-prt-species")?.addEventListener("change", (e) => {
            this.selectedSpecies = e.target.value;
            this.render();
        });
    }
}
