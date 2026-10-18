/**
 * iSHARP DBMS 2.0 — Weekly Rolling Operational & MRP Table (Phase 5)
 * 156-Week & 36-Month Procurement & Operations Console.
 * Itemizes PLs by genetic line, SAP Feed SKUs, 28 Chemicals/Fertilizers, and TNB Power.
 */

import { simulationStore } from "../../state/simulationStore.js";

export class WeeklyRollingTable {
    constructor(containerId = "sim-mrp-table-container") {
        this.containerId = containerId;
        this.viewMode = "MONTHLY"; // "MONTHLY" or "WEEKLY"
    }

    render() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        const simResult = simulationStore.simulationResult;
        if (!simResult || !simResult.weeklyMatrix) {
            container.innerHTML = `
                <div style="text-align: center; padding: 3rem; color: #64748b;">
                    No simulation data available. Click "Auto-Optimize Schedule" to generate plan.
                </div>
            `;
            return;
        }

        const weeklyMatrix = simResult.weeklyMatrix;
        const monthlyMatrix = simResult.monthlyMatrix || [];
        const isMonthly = this.viewMode === "MONTHLY";
        const columns = isMonthly ? monthlyMatrix : weeklyMatrix;

        container.innerHTML = `
            <!-- Table Toolbar -->
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 0.75rem;">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <span style="font-size: 0.78rem; font-weight: 800; color: #0c4a6e;">Time Resolution:</span>
                    <button type="button" class="btn-sim-tab ${isMonthly ? "active-tab" : ""}" id="btn-mrp-toggle-monthly">
                        <span>36 Months</span>
                    </button>
                    <button type="button" class="btn-sim-tab ${!isMonthly ? "active-tab" : ""}" id="btn-mrp-toggle-weekly">
                        <span>156 Weeks</span>
                    </button>
                </div>

                <div style="font-size: 0.72rem; color: #64748b; font-weight: 600;">
                    ${isMonthly ? "36 Monthly Columns (2026–2028)" : "156 Weekly Operational Columns"} • MRP Items Itemized
                </div>
            </div>

            <!-- Scrollable Table -->
            <div class="sim-table-wrapper">
                <table class="sim-data-table">
                    <thead>
                        <tr>
                            <th class="sim-sticky-col">MRP &amp; Operational Metrics</th>
                            <th>Unit</th>
                            ${columns.map((c) => `
                                <th>${isMonthly ? `${c.monthName || "M" + c.month} '${String(c.year).slice(-2)}` : `W${c.weekIndex}`}</th>
                            `).join("")}
                        </tr>
                    </thead>
                    <tbody>
                        ${this._renderTableBody(columns, isMonthly)}
                    </tbody>
                </table>
            </div>
        `;

        this._bindEvents(container);
    }

    _renderTableBody(columns, isMonthly) {
        let html = "";

        // 1. Biological Production
        html += `
            <tr class="sim-table-cat-row">
                <td colspan="${columns.length + 2}">🦐 Biological Culture &amp; Harvest Production</td>
            </tr>
            ${this._renderRow("Active Growout Ponds", "ponds", columns, c => c.activePondsCount || 0, 0)}
            ${this._renderRow("Ponds Stocked", "ponds", columns, c => c.stockedPondsCount || 0, 0)}
            ${this._renderRow("Ponds Harvested", "ponds", columns, c => c.harvestedPondsCount || 0, 0)}
            ${this._renderRow("Harvest Volume", "MT", columns, c => c.harvestYieldMt || 0, 1)}
            ${this._renderRow("Harvest ABW", "g/pc", columns, c => c.averageHarvestAbwG || 0, 1)}
            ${this._renderRow("Survival Rate", "%", columns, c => c.averageSurvivalRatePct || 0, 1)}
            ${this._renderRow("Feed Conversion Ratio (FCR)", "ratio", columns, c => c.fcr || 0, 2)}
        `;

        // 2. Post-Larvae Demand
        html += `
            <tr class="sim-table-cat-row">
                <td colspan="${columns.length + 2}">🧬 Post-Larvae (PL) Hatchery Demand by Genetic Line</td>
            </tr>
            ${this._renderRow("Total PL Demand", "M pcs", columns, c => (c.plDemandMpcs || {}).total || 0, 2)}
            ${this._renderRow("SPF Line PLs", "M pcs", columns, c => (c.plDemandMpcs || {}).spf || 0, 2)}
            ${this._renderRow("SPR Line (Golden/FireDragon)", "M pcs", columns, c => (c.plDemandMpcs || {}).spr || 0, 2)}
            ${this._renderRow("SPT Line (SyAqua)", "M pcs", columns, c => (c.plDemandMpcs || {}).spt || 0, 2)}
            ${this._renderRow("Monodon Line (CP Thai/Moana)", "M pcs", columns, c => (c.plDemandMpcs || {}).monodon || 0, 2)}
        `;

        // 3. SAP Feed SKU Requirements
        html += `
            <tr class="sim-table-cat-row">
                <td colspan="${columns.length + 2}">🌾 SAP Feed SKU Requirements (Metric Tons)</td>
            </tr>
            ${this._renderRow("Total Feed Demand", "MT", columns, c => (c.feedDemandMt || {}).total || 0, 1)}
            ${this._renderRow("Starter #1 (0.8–1.2mm)", "MT", columns, c => (c.feedDemandMt || {}).starter1 || 0, 1)}
            ${this._renderRow("Starter #2 (1.5mm)", "MT", columns, c => (c.feedDemandMt || {}).starter2 || 0, 1)}
            ${this._renderRow("Grower #3 (2.0mm)", "MT", columns, c => (c.feedDemandMt || {}).grower3 || 0, 1)}
            ${this._renderRow("Finisher #4 (2.3mm)", "MT", columns, c => (c.feedDemandMt || {}).finisher4 || 0, 1)}
            ${this._renderRow("Monodon High-Protein Feed", "MT", columns, c => (c.feedDemandMt || {}).monodonFeed || 0, 1)}
        `;

        // 4. 28 Chemicals & Fertilizers MRP Breakdown
        html += `
            <tr class="sim-table-cat-row">
                <td colspan="${columns.length + 2}">🧪 28-Chemical &amp; Fertilizer Pond Preparation &amp; Treatment MRP</td>
            </tr>
            ${this._renderRow("Agricultural Dolomite", "25kg bags", columns, c => (c.chemicalMrp || {}).dolomiteBags || 0, 0)}
            ${this._renderRow("Calcium Hypochlorite Gas", "kg", columns, c => (c.chemicalMrp || {}).gasChlorineKg || 0, 0)}
            ${this._renderRow("Calcium Hypochlorite Powder 70%", "kg", columns, c => (c.chemicalMrp || {}).powderChlorineKg || 0, 0)}
            ${this._renderRow("Calcium Carbonate CaCO3", "25kg bags", columns, c => (c.chemicalMrp || {}).caco3Bags || 0, 0)}
            ${this._renderRow("Hydrated Lime Ca(OH)2", "25kg bags", columns, c => (c.chemicalMrp || {}).caoh2Bags || 0, 0)}
            ${this._renderRow("Grain Pellet Fertilizer", "50kg bags", columns, c => (c.chemicalMrp || {}).grainPelletBags || 0, 0)}
            ${this._renderRow("Rice Bran", "50kg bags", columns, c => (c.chemicalMrp || {}).riceBranBags || 0, 0)}
            ${this._renderRow("Molasses (Carbon Source)", "kg", columns, c => (c.chemicalMrp || {}).molassesKg || 0, 0)}
            ${this._renderRow("Tea Seed Cake (Saponin)", "kg", columns, c => (c.chemicalMrp || {}).teaSeedCakeKg || 0, 0)}
            ${this._renderRow("Urea (Nitrogen)", "50kg bags", columns, c => (c.chemicalMrp || {}).ureaBags || 0, 0)}
            ${this._renderRow("Triple Superphosphate (TSP)", "50kg bags", columns, c => (c.chemicalMrp || {}).tspBags || 0, 0)}
            ${this._renderRow("Povidone Iodine (PVP-I)", "Liters", columns, c => (c.chemicalMrp || {}).pvpiLiters || 0, 1)}
            ${this._renderRow("Copper Sulfate (CuSO4)", "kg", columns, c => (c.chemicalMrp || {}).cuso4Kg || 0, 1)}
            ${this._renderRow("Benzalkonium Chloride (BKC)", "Liters", columns, c => (c.chemicalMrp || {}).bkcLiters || 0, 1)}
            ${this._renderRow("Effective Microorganisms (EM)", "Liters", columns, c => (c.chemicalMrp || {}).emProbioticLiters || 0, 0)}
            ${this._renderRow("Super Biotic Probiotic", "kg", columns, c => (c.chemicalMrp || {}).superBioticKg || 0, 1)}
            ${this._renderRow("Hydrochloric Acid (HCl)", "Liters", columns, c => (c.chemicalMrp || {}).hclLiters || 0, 0)}
        `;

        // 5. Utilities & Electricity
        html += `
            <tr class="sim-table-cat-row">
                <td colspan="${columns.length + 2}">⚡ Utilities &amp; TNB Electricity Accounting Driver</td>
            </tr>
            ${this._renderRow("Active Pond-Days", "days", columns, c => c.activePondDays || 0, 0)}
            ${this._renderRow("Electricity Consumption", "kWh", columns, c => (c.activePondDays || 0) * 190.8, 0)}
            ${this._renderRow("TNB Power Cost", "RM", columns, c => (c.activePondDays || 0) * 95.40, 0)}
        `;

        return html;
    }

    _renderRow(label, unit, columns, extractor, decimals = 0) {
        return `
            <tr>
                <td class="sim-sticky-col">${label}</td>
                <td style="color: #64748b; font-weight: 600;">${unit}</td>
                ${columns.map((c) => {
                    const raw = extractor(c);
                    const val = Number(raw) || 0;
                    const formatted = val === 0 ? "-" : val.toLocaleString("en-MY", {
                        minimumFractionDigits: decimals,
                        maximumFractionDigits: decimals
                    });
                    return `<td style="text-align: right;">${formatted}</td>`;
                }).join("")}
            </tr>
        `;
    }

    _bindEvents(container) {
        const btnMonthly = container.querySelector("#btn-mrp-toggle-monthly");
        const btnWeekly = container.querySelector("#btn-mrp-toggle-weekly");

        if (btnMonthly) {
            btnMonthly.onclick = () => {
                this.viewMode = "MONTHLY";
                this.render();
            };
        }

        if (btnWeekly) {
            btnWeekly.onclick = () => {
                this.viewMode = "WEEKLY";
                this.render();
            };
        }
    }
}
