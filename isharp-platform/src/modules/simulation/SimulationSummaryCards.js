/**
 * iSHARP DBMS 2.0 — Simulation Summary Cards (Phase 5)
 * Current-Year Spliced Hero Scoreboard (4 Spliced Hero Cards):
 * 1. Harvest Volume (LE = YTD Actual + Rolling Plan) vs BP & AC25
 * 2. Sales Revenue (LE = YTD Actual + Rolling Plan) vs BP & AC25
 * 3. Selling Price (RM/kg) & Farm EBITDA with Cash Cost & Total Feed MT
 * 4. Pond Utilisation (206 Ponds Capacity) Stk/Harv Turns vs BP
 * Plus Correlated Monte Carlo P10-P50-P90 Cashflow-at-Risk pill.
 */

import { simulationStore } from "../../state/simulationStore.js";

export class SimulationSummaryCards {
    constructor(containerId = "sim-kpi-strip-container") {
        this.containerId = containerId;
        this.activeYear = 2026;
    }

    setYear(year) {
        this.activeYear = Number(year) || 2026;
        this.render(simulationStore.simulationResult, simulationStore.monteCarloResult);
    }

    render(simulationResult = null, monteCarloResult = null) {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        if (!simulationResult) {
            container.innerHTML = `
                <div class="sim-empty-state-card" style="padding: 18px; text-align: center; background: #ffffff; border: 1px dashed #cbd5e1; border-radius: 8px; width: 100%;">
                    <div style="font-size: 14px; font-weight: 700; color: #1e293b;">⚡ Ready to Simulate</div>
                    <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Awaiting schedule execution or scenario baseline computation. Click "Re-Simulate" or adjust parameters.</div>
                </div>
            `;
            return;
        }

        const yr = this.activeYear || 2026;
        const monthlyMatrix = Array.isArray(simulationResult?.monthlyMatrix)
            ? simulationResult.monthlyMatrix.filter(m => m.year === yr)
            : [];
        const actualMonths = Array.isArray(simulationStore.actualMonths) ? simulationStore.actualMonths : [];
        const cutoffMonth = simulationStore.cutoffMonth || 8;

        // Compute YTD Actuals vs Rolling Forecast
        let ytdHarvestMt = 0;
        let ytdRevenueRm = 0;
        let ytdStockedPonds = 0;
        let ytdHarvestedPonds = 0;
        let ytdFeedKg = 0;

        let rollHarvestMt = 0;
        let rollRevenueRm = 0;
        let rollStockedPonds = 0;
        let rollHarvestedPonds = 0;
        let rollFeedKg = 0;

        let totalCashCostRm = 0;
        let totalFullCostRm = 0;
        let totalEbitdaRm = 0;
        let totalYieldKg = 0;

        for (let m = 1; m <= 12; m++) {
            const mData = monthlyMatrix.find(item => item.month === m);
            const aData = actualMonths.find(item => item.month === m);
            const isActual = yr === 2026 && m <= cutoffMonth && aData;

            if (isActual && aData) {
                const hMt = Number(aData.harvest_mt || aData.yieldMt || 0);
                const rev = Number(aData.revenue_rm || aData.revenueRM || 0);
                const feed = Number(aData.feed_kg || aData.feedKg || 0);
                const stk = Number(aData.stocked_ponds || aData.stockedPonds || 0);
                const hrv = Number(aData.harvested_ponds || aData.pondsHarvested || 0);
                const ebitda = Number(aData.ebitda_rm || aData.ebitdaRM || 0);
                const cashCost = Number(aData.cash_cost_rm || aData.cashCostRM || 0);
                const totalCost = Number(aData.totalCostRM || (cashCost > 0 ? cashCost * 1.15 : 0));

                ytdHarvestMt += hMt;
                ytdRevenueRm += rev;
                ytdStockedPonds += stk;
                ytdHarvestedPonds += hrv;
                ytdFeedKg += feed;

                totalYieldKg += hMt * 1000;
                totalEbitdaRm += ebitda;
                totalCashCostRm += cashCost;
                totalFullCostRm += totalCost;
            } else if (mData) {
                const hMt = Number(mData.yieldMt || mData.harvestYieldMt || 0);
                const rev = Number(mData.revenueRM || 0);
                const feed = Number(mData.feedKg || 0);
                const stk = Number(mData.stockedPonds || mData.stockedPondsCount || 0);
                const hrv = Number(mData.pondsHarvested || mData.harvestedPondsCount || 0);
                const ebitda = Number(mData.ebitdaRM || 0);
                const cashCost = Number(mData.cashCostRM || 0);
                const totalCost = Number(mData.totalCostRM || cashCost * 1.15);

                rollHarvestMt += hMt;
                rollRevenueRm += rev;
                rollStockedPonds += stk;
                rollHarvestedPonds += hrv;
                rollFeedKg += feed;

                totalYieldKg += hMt * 1000;
                totalEbitdaRm += ebitda;
                totalCashCostRm += cashCost;
                totalFullCostRm += totalCost;
            }
        }

        const kpis = simulationResult?.executiveKpis || {};
        if (totalYieldKg === 0 && kpis.totalHarvestMt) {
            rollHarvestMt = Number(kpis.totalHarvestMt);
            totalYieldKg = Number(kpis.totalHarvestMt) * 1000;
            totalEbitdaRm = Number(kpis.farmEbitdaRm || 0);
            totalCashCostRm = Number(kpis.averageCashCostRmKg || 0) * totalYieldKg;
            totalFullCostRm = Number(kpis.averageTotalCostRmKg || 0) * totalYieldKg;
            rollRevenueRm = totalYieldKg * Number(kpis.averageRealizedPriceRmKg || 0);
            rollStockedPonds = Math.round(Number(kpis.totalPondsCultured || 0));
            rollHarvestedPonds = Math.round(rollStockedPonds * 0.95);
            rollFeedKg = totalYieldKg * 1.62;
        }

        const leHarvestMt = ytdHarvestMt + rollHarvestMt;
        const leRevenueRm = ytdRevenueRm + rollRevenueRm;
        const leStockedPonds = ytdStockedPonds + rollStockedPonds;
        const leHarvestedPonds = ytdHarvestedPonds + rollHarvestedPonds;
        const totalFeedMt = (ytdFeedKg + rollFeedKg) / 1000;

        // Frozen BP & AC25 benchmarks from RPvf, iSharp.xlsx
        const bpVolumeMt = yr === 2026 ? 2229.0 : (yr === 2027 ? 2550.0 : 2700.0);
        const ac25VolumeMt = 1873.0;
        const volVarPct = bpVolumeMt > 0 ? (((leHarvestMt - bpVolumeMt) / bpVolumeMt) * 100) : 0;
        const volVarClass = volVarPct >= 0 ? "sim-variance-positive" : "sim-variance-negative";
        const volVarSign = volVarPct >= 0 ? "+" : "";

        const bpRevenueRm = yr === 2026 ? 48400000 : (yr === 2027 ? 54000000 : 58000000);
        const ac25RevenueRm = 42300000;
        const revVarPct = bpRevenueRm > 0 ? (((leRevenueRm - bpRevenueRm) / bpRevenueRm) * 100) : 0;
        const revVarClass = revVarPct >= 0 ? "sim-variance-positive" : "sim-variance-negative";
        const revVarSign = revVarPct >= 0 ? "+" : "";

        const avgPriceRmKg = totalYieldKg > 0 ? (leRevenueRm / totalYieldKg) : Number(kpis.averageRealizedPriceRmKg || 0);
        const cashCostRmKg = totalYieldKg > 0 ? (totalCashCostRm / totalYieldKg) : Number(kpis.averageCashCostRmKg || 0);
        const avgAbw = Number(kpis.averageHarvestAbwG || 0).toFixed(1);

        const ebitdaSign = totalEbitdaRm >= 0 ? "+RM " : "-RM ";
        const ebitdaFormatted = ebitdaSign + Math.abs(totalEbitdaRm / 1000000).toFixed(2) + "M";
        const ebitdaColor = totalEbitdaRm >= 0 ? "#059669" : "#dc2626";

        // Pond utilisation turns (206 farm capacity)
        const farmCapPonds = 206;
        const stkTurns = (leStockedPonds / farmCapPonds).toFixed(2);
        const hrvTurns = (leHarvestedPonds / farmCapPonds).toFixed(2);

        // Monte Carlo confidence badge
        let mcBadge = "";
        if (monteCarloResult && monteCarloResult.summary) {
            const p10 = Number(monteCarloResult.summary.ebitdaP10RM / 1000000).toFixed(2);
            const p50 = Number(monteCarloResult.summary.ebitdaP50RM / 1000000).toFixed(2);
            const p90 = Number(monteCarloResult.summary.ebitdaP90RM / 1000000).toFixed(2);
            mcBadge = `
                <div class="sim-monte-carlo-pill" title="Correlated Monte Carlo Risk Confidence Bands">
                    <span>🎲 P10: RM ${p10}M | P50: RM ${p50}M | P90: RM ${p90}M</span>
                </div>
            `;
        } else {
            mcBadge = `
                <div class="sim-monte-carlo-pill" title="Click 'Run Risk Analysis' to evaluate P10/P50/P90 correlated risk bands">
                    <span>🎲 Monte Carlo: Ready</span>
                </div>
            `;
        }

        container.innerHTML = `
            <div class="sim-hero-scoreboard">
                <!-- Card 1: Harvest Volume LE -->
                <div class="sim-hero-card" data-hero="volume">
                    <div class="sim-hero-card-header">
                        <span>${yr} HARVEST VOLUME (LE)</span>
                        <span class="${volVarClass}">${volVarSign}${volVarPct.toFixed(1)}% vs BP</span>
                    </div>
                    <div class="sim-hero-card-val" style="color: #0284c7;">
                        <span>${leHarvestMt.toLocaleString("en-MY", { maximumFractionDigits: 1 })}</span>
                        <span class="sim-kpi-unit">MT</span>
                    </div>
                    <div class="sim-hero-card-sub">
                        <span><strong style="color: #059669;">YTD: ${Math.round(ytdHarvestMt)}t</strong> + <strong style="color: #0284c7;">Roll: ${Math.round(rollHarvestMt)}t</strong></span>
                        <span>BP: ${Math.round(bpVolumeMt)}t | AC25: ${Math.round(ac25VolumeMt)}t</span>
                    </div>
                </div>

                <!-- Card 2: Sales Revenue LE -->
                <div class="sim-hero-card" data-hero="revenue">
                    <div class="sim-hero-card-header">
                        <span>${yr} SALES REVENUE (LE)</span>
                        <span class="${revVarClass}">${revVarSign}${revVarPct.toFixed(1)}% vs BP</span>
                    </div>
                    <div class="sim-hero-card-val" style="color: #0369a1;">
                        <span>RM ${(leRevenueRm / 1000000).toFixed(2)}</span>
                        <span class="sim-kpi-unit">M</span>
                    </div>
                    <div class="sim-hero-card-sub">
                        <span><strong style="color: #059669;">YTD: ${(ytdRevenueRm / 1000000).toFixed(1)}M</strong> + <strong style="color: #0284c7;">Roll: ${(rollRevenueRm / 1000000).toFixed(1)}M</strong></span>
                        <span>BP: ${(bpRevenueRm / 1000000).toFixed(1)}M | AC25: ${(ac25RevenueRm / 1000000).toFixed(1)}M</span>
                    </div>
                </div>

                <!-- Card 3: Selling Price & Farm EBITDA -->
                <div class="sim-hero-card" data-hero="ebitda">
                    <div class="sim-hero-card-header">
                        <span>SELLING PRICE &amp; EBITDA</span>
                        <span style="color: #059669;">ABW: ${avgAbw}g</span>
                    </div>
                    <div class="sim-hero-card-val" style="display: flex; justify-content: space-between; align-items: baseline;">
                        <span style="color: #059669; font-size: 1.25rem;">
                            <span class="sim-kpi-unit">RM</span> ${avgPriceRmKg.toFixed(2)}<span class="sim-kpi-unit">/kg</span>
                        </span>
                        <span style="color: ${ebitdaColor}; font-size: 1rem; font-weight: 800;">${ebitdaFormatted}</span>
                    </div>
                    <div class="sim-hero-card-sub">
                        <span>Cash Cost: <strong>RM ${cashCostRmKg.toFixed(2)}/kg</strong></span>
                        <span>Feed: <strong style="color: #d97706;">${Math.round(totalFeedMt).toLocaleString()} MT</strong></span>
                    </div>
                </div>

                <!-- Card 4: Pond Utilisation -->
                <div class="sim-hero-card" data-hero="utilisation">
                    <div class="sim-hero-card-header">
                        <span>POND UTILISATION (${farmCapPonds} CAP)</span>
                        <span style="color: #0284c7;">${stkTurns}x Stk / ${hrvTurns}x Harv</span>
                    </div>
                    <div class="sim-hero-card-val" style="display: flex; justify-content: space-between; align-items: baseline;">
                        <span style="color: #0284c7; font-size: 1.25rem;">
                            ${leStockedPonds} <span class="sim-kpi-unit">Stk</span>
                        </span>
                        <span style="color: #059669; font-size: 1rem; font-weight: 800;">${leHarvestedPonds} Harv</span>
                    </div>
                    <div class="sim-hero-card-sub">
                        <span><strong style="color: #059669;">YTD: ${ytdStockedPonds}</strong> + <strong style="color: #0284c7;">Roll: ${rollStockedPonds}</strong></span>
                        <span>BP: 429 Stk / 434 Harv</span>
                    </div>
                    ${mcBadge}
                </div>
            </div>
        `;
    }
}
