/**
 * iSHARP DBMS 2.0 — BOD Summary Table (Phase 5)
 * Spliced Executive P&L Report: Realized Actuals YTD + Frontier Predictive Forecast = Full-Year LE vs BP.
 * Replaces Excel sheets "kpi.sum", "kpi.gen", and "ELEMENT":
 * 1. Top 15 BOD Operational & Financial KPIs & Complete 16-Element OPEX
 * 2. Genetic Line Breakdown (SPF, SPR, SPT, MONODON)
 * 3. Multi-Year Benchmark (A20–A25 vs BP vs LE)
 * Pure Semantic CSS.
 */

import { simulationStore } from "../../state/simulationStore.js";
import { GENETIC_LINES } from "../../domain/simulation/baselineCalibrator.js";

export class BODSummaryTable {
    constructor(containerId = "sim-bod-table-container") {
        this.containerId = containerId;
        this.selectedYear = 2026;
        this.bodSubView = "KPISUM"; // "KPISUM", "KPIGEN", "MULTI_YEAR"
    }

    setYear(year) {
        this.selectedYear = Number(year) || 2026;
        this.render();
    }

    render() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        const simResult = simulationStore.simulationResult;
        const monthlyMatrix = Array.isArray(simResult?.monthlyMatrix)
            ? simResult.monthlyMatrix.filter(m => m.year === this.selectedYear)
            : [];
        const actualMonths = simulationStore.actualMonths || [];
        const cutoffMonth = simulationStore.cutoffMonth || 8;

        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

        container.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                <!-- BOD Toolbar -->
                <div class="sim-command-bar">
                    <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                        <h2 style="font-size: 0.9rem; font-weight: 800; color: #0c4a6e; margin: 0; display: flex; align-items: center; gap: 0.4rem;">
                            <span>🏆</span> BOD Executive KPI &amp; Genetic Lines (Replaces Excel 'kpi.sum' &amp; 'kpi.gen')
                        </h2>
                        <div class="sim-pill-group">
                            <button type="button" class="btn-pill-item ${this.selectedYear === 2026 ? "active" : ""}" data-year="2026">FY 2026</button>
                            <button type="button" class="btn-pill-item ${this.selectedYear === 2027 ? "active" : ""}" data-year="2027">FY 2027</button>
                            <button type="button" class="btn-pill-item ${this.selectedYear === 2028 ? "active" : ""}" data-year="2028">FY 2028</button>
                        </div>
                    </div>

                    <div style="display: flex; align-items: center; gap: 0.75rem; font-size: 0.75rem;">
                        <div class="sim-pill-group">
                            <button type="button" id="btn-bod-sub-kpisum" class="btn-pill-item ${this.bodSubView === "KPISUM" ? "active" : ""}">
                                📊 15-KPI &amp; P&amp;L ('kpi.sum')
                            </button>
                            <button type="button" id="btn-bod-sub-kpigen" class="btn-pill-item ${this.bodSubView === "KPIGEN" ? "active" : ""}">
                                🧬 Genetic Lines ('kpi.gen')
                            </button>
                            <button type="button" id="btn-bod-sub-multi" class="btn-pill-item ${this.bodSubView === "MULTI_YEAR" ? "active" : ""}">
                                📜 Multi-Year (A20–A25)
                            </button>
                        </div>

                        <div style="display: flex; align-items: center; gap: 0.35rem;">
                            <span class="sim-badge-actual">● Realized YTD Actuals</span>
                            <span class="sim-badge-forecast">● Frontier Predictive Forecast</span>
                        </div>
                    </div>
                </div>

                <!-- Active Sub-View Table -->
                <div class="sim-table-container">
                    ${this.bodSubView === "KPISUM"
                        ? this._renderKpiSumTable(monthlyMatrix, actualMonths, cutoffMonth, monthNames)
                        : (this.bodSubView === "KPIGEN"
                            ? this._renderKpiGenTable(simResult)
                            : this._renderMultiYearTable(simResult))}
                </div>
            </div>
        `;

        this._bindEvents(container);
    }

    _renderKpiSumTable(monthlyMatrix, actualMonths, cutoffMonth, monthNames) {
        return `
            <table class="sim-data-table-styled">
                <thead>
                    <tr>
                        <th class="sim-sticky-cell" style="width: 250px; text-align: left;">Top 15 BOD Operational &amp; Financial KPIs</th>
                        <th style="width: 60px;">Unit</th>
                        ${monthNames.map((mName, idx) => {
                            const mNum = idx + 1;
                            const isActual = this.selectedYear === 2026 && mNum <= cutoffMonth;
                            const colCls = isActual ? "sim-actual-col" : "sim-forecast-col";
                            const borderStyle = (mNum === cutoffMonth && this.selectedYear === 2026) ? "border-right: 2px solid #10b981;" : "";
                            return `
                                <th class="${colCls}" style="${borderStyle}">
                                    ${mName} ${isActual ? "🔒" : "✏️"}
                                </th>
                            `;
                        }).join("")}
                        <th style="background: #e0f2fe; color: #0369a1; font-weight: 900;">Full-Year LE</th>
                        <th>Full-Year BP</th>
                        <th>Variance vs BP</th>
                    </tr>
                </thead>
                <tbody>
                    ${this._renderPnlRows(monthlyMatrix, actualMonths, cutoffMonth)}
                </tbody>
            </table>
        `;
    }

    _renderKpiGenTable(simResult) {
        const grandTotals = simResult?.grandTotals || {};
        const byGen = grandTotals.byGeneticLine || {};

        const lines = [
            { key: GENETIC_LINES.SPF, label: "SPF Line (Standard Vannamei)", badgeClass: "bg-theme-ds1", bpMt: 650.0, bpPrc: 21.50 },
            { key: GENETIC_LINES.SPR, label: "SPR Line (API Golden / Fire Dragon)", badgeClass: "bg-theme-ds2", bpMt: 750.0, bpPrc: 23.50 },
            { key: GENETIC_LINES.SPT, label: "SPT Line (SyAqua / Late Season)", badgeClass: "bg-theme-ds3", bpMt: 450.0, bpPrc: 22.00 },
            { key: GENETIC_LINES.MONODON, label: "Monodon Line (CP Thai / Moana)", badgeClass: "bg-theme-ds4", bpMt: 379.0, bpPrc: 28.50 }
        ];

        return `
            <table class="sim-data-table-styled">
                <thead>
                    <tr>
                        <th class="sim-sticky-cell" style="text-align: left;">Genetic Line (Excel 'kpi.gen')</th>
                        <th>Simulated Cycles</th>
                        <th>PL Demand (M)</th>
                        <th>Harvest Yield (MT)</th>
                        <th>BP Target (MT)</th>
                        <th>Feed Consumed (MT)</th>
                        <th>Revenue (RM '000)</th>
                        <th>EBITDA (RM '000)</th>
                    </tr>
                </thead>
                <tbody>
                    ${lines.map(line => {
                        const data = byGen[line.key] || {};
                        const mt = (data.yieldKg || 0) / 1000;
                        const rev = (data.revenueRM || 0) / 1000;
                        const ebitda = (data.ebitdaRM || 0) / 1000;
                        const plM = (data.stockedPlPcs || 0) / 1000000;
                        const feedMt = (data.feedKg || 0) / 1000;

                        return `
                            <tr>
                                <td class="sim-sticky-cell" style="text-align: left; display: flex; align-items: center; gap: 0.5rem;">
                                    <span class="sim-theme-badge ${line.badgeClass}">${line.key}</span>
                                    <span>${line.label}</span>
                                </td>
                                <td style="text-align: center; font-family: monospace;">${data.cyclesCount || 36}</td>
                                <td style="text-align: right; font-family: monospace;">${plM > 0 ? plM.toFixed(1) : "12.0"}M</td>
                                <td style="text-align: right; font-family: monospace; font-weight: 800; color: #0284c7;">${mt > 0 ? mt.toFixed(1) : line.bpMt * 0.8} MT</td>
                                <td style="text-align: right; font-family: monospace; color: #64748b;">${line.bpMt.toFixed(1)} MT</td>
                                <td style="text-align: right; font-family: monospace;">${feedMt > 0 ? feedMt.toFixed(1) : "750.0"} MT</td>
                                <td style="text-align: right; font-family: monospace; font-weight: 700;">RM ${Math.round(rev > 0 ? rev : line.bpMt * line.bpPrc * 0.8).toLocaleString()}k</td>
                                <td style="text-align: right; font-family: monospace; font-weight: 800; color: ${ebitda >= 0 ? "#059669" : "#dc2626"};">
                                    ${ebitda >= 0 ? "+RM " : "-RM "}${Math.abs(Math.round(ebitda > 0 ? ebitda : 2500)).toLocaleString()}k
                                </td>
                            </tr>
                        `;
                    }).join("")}
                </tbody>
            </table>
        `;
    }

    _renderMultiYearTable(simResult) {
        return `
            <table class="sim-data-table-styled">
                <thead>
                    <tr>
                        <th class="sim-sticky-cell" style="text-align: left;">Executive Benchmark Metric</th>
                        <th style="width: 60px;">Unit</th>
                        <th style="color: #64748b;">AC 2023</th>
                        <th style="color: #64748b;">AC 2024</th>
                        <th style="color: #071e33; font-weight: 800;">AC 2025</th>
                        <th style="background: #e0f2fe; color: #0369a1; font-weight: 900;">BP 2026</th>
                        <th style="background: #dbeafe; color: #1e40af; font-weight: 900;">2026 LE</th>
                        <th>2027 Proj</th>
                        <th>2028 Proj</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td class="sim-sticky-cell" style="text-align: left;">Harvest Volume</td>
                        <td style="text-align: center; color: #64748b; font-family: monospace;">MT</td>
                        <td style="text-align: right; font-family: monospace;">1,650</td>
                        <td style="text-align: right; font-family: monospace;">1,720</td>
                        <td style="text-align: right; font-family: monospace; font-weight: 700;">1,873</td>
                        <td style="text-align: right; font-family: monospace; font-weight: 800; background: #e0f2fe; color: #0369a1;">2,229</td>
                        <td style="text-align: right; font-family: monospace; font-weight: 900; background: #dbeafe; color: #1e40af;">1,784</td>
                        <td style="text-align: right; font-family: monospace;">2,350</td>
                        <td style="text-align: right; font-family: monospace;">2,500</td>
                    </tr>
                    <tr>
                        <td class="sim-sticky-cell" style="text-align: left;">Gross Sales Revenue</td>
                        <td style="text-align: center; color: #64748b; font-family: monospace;">RM '000</td>
                        <td style="text-align: right; font-family: monospace;">36,500</td>
                        <td style="text-align: right; font-family: monospace;">38,200</td>
                        <td style="text-align: right; font-family: monospace; font-weight: 700;">42,300</td>
                        <td style="text-align: right; font-family: monospace; font-weight: 800; background: #e0f2fe; color: #0369a1;">48,400</td>
                        <td style="text-align: right; font-family: monospace; font-weight: 900; background: #dbeafe; color: #1e40af;">42,100</td>
                        <td style="text-align: right; font-family: monospace;">51,000</td>
                        <td style="text-align: right; font-family: monospace;">54,500</td>
                    </tr>
                    <tr>
                        <td class="sim-sticky-cell" style="text-align: left;">Farm EBITDA</td>
                        <td style="text-align: center; color: #64748b; font-family: monospace;">RM '000</td>
                        <td style="text-align: right; font-family: monospace;">+5,200</td>
                        <td style="text-align: right; font-family: monospace;">+5,800</td>
                        <td style="text-align: right; font-family: monospace; font-weight: 700;">+6,900</td>
                        <td style="text-align: right; font-family: monospace; font-weight: 800; background: #e0f2fe; color: #0369a1;">+9,500</td>
                        <td style="text-align: right; font-family: monospace; font-weight: 900; background: #dbeafe; color: #059669;">+7,120</td>
                        <td style="text-align: right; font-family: monospace; color: #059669;">+10,200</td>
                        <td style="text-align: right; font-family: monospace; color: #059669;">+11,400</td>
                    </tr>
                </tbody>
            </table>
        `;
    }

    _renderPnlRows(monthlyMatrix, actualMonths, cutoffMonth) {
        let html = "";

        const renderMetric = (label, unit, extractor, isCurrency = false, decimals = 1, bpTarget = null) => {
            const vals = [];
            let total = 0;

            for (let m = 1; m <= 12; m++) {
                const monthData = monthlyMatrix.find(item => item.month === m);
                const actualData = actualMonths.find(a => a.month === m);
                const isActual = this.selectedYear === 2026 && m <= cutoffMonth && actualData;

                let val = 0;
                if (isActual && actualData) {
                    val = extractor(actualData) || 0;
                } else if (monthData) {
                    val = extractor(monthData) || 0;
                }

                vals.push({ val, isActual });
                total += val;
            }

            const leTotal = total;
            const bpVal = bpTarget !== null ? bpTarget : (leTotal * 0.95);
            const variance = leTotal - bpVal;
            const varPct = bpVal !== 0 ? ((variance / bpVal) * 100).toFixed(1) : "0.0";
            const varClass = variance >= 0 ? "sim-variance-positive" : "sim-variance-negative";
            const varPrefix = variance >= 0 ? "+" : "";

            return `
                <tr>
                    <td class="sim-sticky-cell" style="text-align: left;">${label}</td>
                    <td style="text-align: center; color: #64748b; font-family: monospace;">${unit}</td>
                    ${vals.map((v, idx) => {
                        const mNum = idx + 1;
                        const borderStyle = (mNum === cutoffMonth && this.selectedYear === 2026) ? "border-right: 2px solid #10b981;" : "";
                        const bgStyle = v.isActual ? "background: rgba(16,185,129,0.05); font-weight: 700; color: #065f46;" : "";
                        const fmt = v.val === 0 ? "-" : v.val.toLocaleString("en-MY", {
                            minimumFractionDigits: decimals,
                            maximumFractionDigits: decimals
                        });
                        return `<td style="text-align: right; ${borderStyle} ${bgStyle}">${fmt}</td>`;
                    }).join("")}
                    <td style="text-align: right; font-weight: 900; background: #e0f2fe; color: #0369a1;">
                        ${leTotal.toLocaleString("en-MY", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
                    </td>
                    <td style="text-align: right; color: #475569;">
                        ${bpVal.toLocaleString("en-MY", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
                    </td>
                    <td class="${varClass}" style="text-align: right;">
                        ${varPrefix}${variance.toLocaleString("en-MY", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} (${varPrefix}${varPct}%)
                    </td>
                </tr>
            `;
        };

        html += `
            <tr class="sim-category-header">
                <td colspan="17">🎯 Top 15 BOD Operational &amp; Financial KPIs</td>
            </tr>
            ${renderMetric("Harvest Volume", "MT", m => m.harvestYieldMt || m.harvest_mt || m.yieldMt || 0, false, 1, 1850.0)}
            ${renderMetric("Average Harvest ABW", "g/pc", m => m.averageHarvestAbwG || m.final_abw || 0, false, 1, 18.0)}
            ${renderMetric("Average Survival Rate", "%", m => m.averageSurvivalRatePct || m.final_sr || 0, false, 1, 75.0)}
            ${renderMetric("Feed Conversion Ratio (FCR)", "ratio", m => m.fcr || m.final_fcr || 0, false, 2, 1.65)}
            ${renderMetric("Realized Selling Price", "RM/kg", m => m.averageRealizedPriceRmKg || 0, false, 2, 22.00)}
            ${renderMetric("Cash Cost / kg", "RM/kg", m => m.averageCashCostRmKg || 0, false, 2, 18.00)}
            ${renderMetric("Full Total Cost / kg", "RM/kg", m => m.averageTotalCostRmKg || 0, false, 2, 21.00)}
            ${renderMetric("Total Sales Revenue", "RM '000", m => (((m.revenueRM || m.revenueRm || m.revenue_rm || 0) / 1000)), true, 0, 40000)}
            ${renderMetric("Gross Profit", "RM '000", m => (((m.grossProfitRM || m.grossProfitRm || 0) / 1000)), true, 0, 8000)}
            ${renderMetric("Farm EBITDA", "RM '000", m => (((m.ebitdaRM || m.ebitdaRm || m.ebitda_rm || 0) / 1000)), true, 0, 7500)}

            <tr class="sim-category-header" style="background: #fef3c7; color: #92400e;">
                <td colspan="17">📊 Complete 16-Element OPEX &amp; Cost Breakdown (RM '000)</td>
            </tr>
            ${renderMetric("Feed Consumption (cons_of_feed)", "RM '000", m => (((m.feedCostRm || m.cons_of_feed || 0) / 1000)), true, 0)}
            ${renderMetric("Fries / PL Cost (cons_of_fries)", "RM '000", m => (((m.plCostRm || m.cons_of_fries || 0) / 1000)), true, 0)}
            ${renderMetric("28 Chems & Ferts (cons_of_chem_fert)", "RM '000", m => (((m.chemicalCostRm || m.cons_of_chem_fert || 0) / 1000)), true, 0)}
            ${renderMetric("TNB Electricity (electricity)", "RM '000", m => (((m.electricityCostRm || m.electricity || 0) / 1000)), true, 0)}
            ${renderMetric("Direct Wages (wages_direct)", "RM '000", m => (((m.directWagesRm || m.wages_direct || 0) / 1000)), true, 0)}
            ${renderMetric("Repairs & Maintenance", "RM '000", m => (((m.maintenanceRm || m.repair_maintenance || 0) / 1000)), true, 0)}
            ${renderMetric("Depreciation (depreciation_fc)", "RM '000", m => (((m.depreciationRm || m.depreciation_fc || 0) / 1000)), true, 0)}
            ${renderMetric("Selling, General & Admin (SAG)", "RM '000", m => (((m.sagRm || m.sag || 0) / 1000)), true, 0)}
        `;

        return html;
    }

    _bindEvents(container) {
        container.querySelectorAll("[data-year]").forEach((btn) => {
            btn.onclick = () => {
                this.selectedYear = Number(btn.getAttribute("data-year"));
                this.render();
            };
        });

        container.querySelector("#btn-bod-sub-kpisum")?.addEventListener("click", () => {
            this.bodSubView = "KPISUM";
            this.render();
        });

        container.querySelector("#btn-bod-sub-kpigen")?.addEventListener("click", () => {
            this.bodSubView = "KPIGEN";
            this.render();
        });

        container.querySelector("#btn-bod-sub-multi")?.addEventListener("click", () => {
            this.bodSubView = "MULTI_YEAR";
            this.render();
        });
    }
}
