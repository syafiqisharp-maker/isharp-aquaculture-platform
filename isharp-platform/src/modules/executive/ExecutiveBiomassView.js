/**
 * iSHARP DBMS 2.0 — Executive Production & Biomass Intelligence
 * Modular controller managing cohort filters, harvest readiness evaluation,
 * and live commercial production analytics for executive management.
 * 
 * Clean Coding Standard: Controller delegates HTML generation to templates
 * and canvas rendering to dedicated chart modules.
 */

import { HarvestRepository } from "../../infrastructure/repositories/harvestRepository.js";
import { classifyHarvestReadiness, projectHarvestForecast, aggregate12MonthMovingHarvest } from "../../domain/biometrics.js";
import { Toast } from "../../components/Toast.js";
import { getExecutiveBiomassHtml, renderPipelineRowsHtml } from "./templates/executiveBiomassTemplate.js";
import { drawMinimalistHarvestChart } from "./charts/MinimalistHarvestChart.js";

const CACHE_KEY = "isharp_exec_biomass_cache_v4";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5-minute session cache

export class ExecutiveBiomassView {
    /**
     * @param {string} [containerId="exec-production-container"] 
     * @param {object} [gridMapRef=null] Reference to PondGridMap for drawer triggers
     */
    constructor(containerId = "exec-production-container", gridMapRef = null) {
        this.container = document.getElementById(containerId);
        this.gridMap = gridMapRef;

        this.cohortFilter = "ALL";       // 'ALL', 'VAN', 'MON'
        this.pipelineFilter = "ALL";     // 'ALL', 'OPTIMUM', 'MINIMUM', 'ALERT', 'FORECAST'
        
        this.rawDailyHarvests = [];
        this.rawSalesRecords = [];
        this.rawPipelinePonds = [];

        this.evaluatedPonds = [];
        this.forecast14d = { candidatePonds: [], totalProjectedBiomassTons: 0, optimumPondsCount: 0, minimumPondsCount: 0 };
        this.aggregated12m = null;

        this.isLoading = true;
        this._chartObserver = null;
        this._boundResize = null;

        if (this.container) {
            this.renderSkeleton();
            this.loadData();
        }
    }

    renderSkeleton() {
        this.container.innerHTML = `
            <div class="sleek-card" style="padding: 2.5rem; text-align: center; color: #64748b;">
                <div class="spinner-sm" style="margin: 0 auto 0.75rem auto;"></div>
                <div style="font-weight: 600; font-size: 0.9rem; color: #0f172a;">Loading Executive Production &amp; Biomass Intelligence...</div>
                <div style="font-size: 0.75rem; color: #94a3b8; margin-top: 0.25rem;">Querying live samplings, harvest records, and buyer packout ledgers across 9 modules</div>
            </div>
        `;
    }

    async loadData(forceRefresh = false) {
        this.isLoading = true;

        // 1. Instant display from sessionStorage cache if available
        if (!forceRefresh) {
            try {
                const cachedStr = sessionStorage.getItem(CACHE_KEY);
                if (cachedStr) {
                    const cached = JSON.parse(cachedStr);
                    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
                        this.rawDailyHarvests = cached.dailyHarvests || [];
                        this.rawSalesRecords = cached.salesRecords || [];
                        this.rawPipelinePonds = cached.pipelinePonds || [];
                        this.processEvaluations();
                        this.render();
                        this.bindEvents();
                        this.drawMinimalistChart();
                        this.isLoading = false;
                        this.refreshInBackground(CACHE_KEY);
                        return;
                    }
                }
            } catch (cacheErr) {
                console.warn("Could not read executive biomass cache:", cacheErr);
            }
        }

        // 2. Fresh fetch from Supabase
        try {
            const [harvestRes, pipelineRes] = await Promise.all([
                HarvestRepository.get12MonthHarvestData(12),
                HarvestRepository.getLiveHarvestPipeline()
            ]);

            this.rawDailyHarvests = harvestRes.dailyHarvests || [];
            this.rawSalesRecords = harvestRes.salesRecords || [];
            this.rawPipelinePonds = pipelineRes || [];

            // Store in cache
            try {
                sessionStorage.setItem(CACHE_KEY, JSON.stringify({
                    timestamp: Date.now(),
                    dailyHarvests: this.rawDailyHarvests,
                    salesRecords: this.rawSalesRecords,
                    pipelinePonds: this.rawPipelinePonds
                }));
            } catch (e) {
                console.warn("Could not write to sessionStorage cache:", e);
            }

            this.processEvaluations();
            this.render();
            this.bindEvents();
            this.drawMinimalistChart();
        } catch (err) {
            console.error("Error loading executive biomass intelligence:", err);
            if (this.container) {
                this.container.innerHTML = `
                    <div class="sleek-card" style="padding: 2rem; text-align: center; color: #e11d48;">
                        <div style="font-weight: 700;">Could not synchronize executive production analytics.</div>
                        <div style="font-size: 0.78rem; color: #64748b; margin-top: 0.5rem;">${err.message || "Please check network connectivity."}</div>
                        <button type="button" id="btn-retry-exec-biomass" class="btn-action btn-secondary" style="margin-top: 1rem; padding: 0.4rem 1rem; font-weight: 700;">
                            <span>🔄 Retry Sync</span>
                        </button>
                    </div>
                `;
                const btnRetry = this.container.querySelector("#btn-retry-exec-biomass");
                if (btnRetry) btnRetry.addEventListener("click", () => this.loadData(true));
            }
        } finally {
            this.isLoading = false;
        }
    }

    async refreshInBackground(cacheKey) {
        try {
            const [harvestRes, pipelineRes] = await Promise.all([
                HarvestRepository.get12MonthHarvestData(12),
                HarvestRepository.getLiveHarvestPipeline()
            ]);
            if (harvestRes.dailyHarvests?.length > 0 || pipelineRes?.length > 0) {
                this.rawDailyHarvests = harvestRes.dailyHarvests || [];
                this.rawSalesRecords = harvestRes.salesRecords || [];
                this.rawPipelinePonds = pipelineRes || [];
                try {
                    sessionStorage.setItem(cacheKey, JSON.stringify({
                        timestamp: Date.now(),
                        dailyHarvests: this.rawDailyHarvests,
                        salesRecords: this.rawSalesRecords,
                        pipelinePonds: this.rawPipelinePonds
                    }));
                } catch (e) {}
            }
        } catch (err) {
            console.warn("Background refresh failed, continuing with cached snapshot", err);
        }
    }

    processEvaluations() {
        // 1. Evaluate harvest readiness for all active ponds
        this.evaluatedPonds = (this.rawPipelinePonds || []).map(p => {
            const classification = classifyHarvestReadiness({
                species: p.species,
                abw: p.abw,
                doc: p.doc,
                adg: p.adg,
                issueFlag: p.issueFlag,
                issueNote: p.issueNote
            });
            return {
                ...p,
                classification
            };
        });

        // 2. Project 14-day forward intake forecast
        this.forecast14d = projectHarvestForecast(this.rawPipelinePonds, 14);

        // 3. Aggregate 12-month moving data with current cohort filter
        this.aggregated12m = aggregate12MonthMovingHarvest(this.rawDailyHarvests, this.rawSalesRecords, this.cohortFilter);
    }

    render() {
        if (!this.container) return;

        this.container.innerHTML = getExecutiveBiomassHtml({
            cohortFilter: this.cohortFilter,
            pipelineFilter: this.pipelineFilter,
            evaluatedPonds: this.evaluatedPonds,
            forecast14d: this.forecast14d,
            aggregated12m: this.aggregated12m
        });
    }

    renderPipelineRows() {
        return renderPipelineRowsHtml(this.evaluatedPonds, this.pipelineFilter, this.forecast14d);
    }

    bindEvents() {
        if (!this.container) return;

        // Cohort Switcher (Combined / VAN / MON)
        const cohortBtns = this.container.querySelectorAll(".btn-cohort");
        cohortBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                const c = btn.getAttribute("data-cohort");
                if (c && c !== this.cohortFilter) {
                    this.cohortFilter = c;
                    this.processEvaluations();
                    this.render();
                    this.bindEvents();
                    this.drawMinimalistChart();
                }
            });
        });

        // Pipeline Segmented Tabs
        const tabBtns = this.container.querySelectorAll(".tab-pill");
        tabBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                const t = btn.getAttribute("data-tab");
                if (t && t !== this.pipelineFilter) {
                    this.pipelineFilter = t;
                    const tbody = this.container.querySelector("#exec-pipeline-tbody");
                    if (tbody) {
                        tbody.innerHTML = this.renderPipelineRows();
                        this.bindActionGateTriggers();
                    }
                    tabBtns.forEach(b => b.classList.remove("active"));
                    btn.classList.add("active");
                }
            });
        });

        // Action Gate Buttons
        this.bindActionGateTriggers();

        // Export CSV button
        const btnExport = this.container.querySelector("#btn-export-exec-ledger");
        if (btnExport) {
            btnExport.addEventListener("click", () => this.exportToCSV());
        }

        // Window resize observer for canvas chart responsiveness
        if (this._chartObserver) this._chartObserver.disconnect();
        const chartHost = this.container.querySelector("#canvas-exec-pastel-biomass");
        if (chartHost && chartHost.parentElement && typeof ResizeObserver !== "undefined") {
            this._chartObserver = new ResizeObserver(() => this.drawMinimalistChart());
            this._chartObserver.observe(chartHost.parentElement);
        }
        if (this._boundResize) window.removeEventListener("resize", this._boundResize);
        this._boundResize = () => this.drawMinimalistChart();
        window.addEventListener("resize", this._boundResize);
    }

    bindActionGateTriggers() {
        const actionBtns = this.container.querySelectorAll(".btn-action-gate");
        actionBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                const pondCode = btn.getAttribute("data-pond");
                const pondIndex = btn.getAttribute("data-index");
                if (this.gridMap && typeof this.gridMap.openDrawer === "function") {
                    this.gridMap.openDrawer(pondCode, pondIndex);
                } else {
                    Toast.info(`Pond ${pondCode} selected. Open Farm Map for complete telemetry drawer.`);
                }
            });
        });
    }

    drawMinimalistChart() {
        const canvas = document.getElementById("canvas-exec-pastel-biomass");
        if (!canvas) return;
        const buckets = this.aggregated12m?.monthlyBuckets || [];
        drawMinimalistHarvestChart(canvas, buckets);
    }

    exportToCSV() {
        const buckets = this.aggregated12m?.monthlyBuckets || [];
        if (buckets.length === 0) {
            Toast.info("No ledger data available to export.");
            return;
        }

        const headers = ["Month", "Harvest (Tons)", "Total Runs", "Weighted ABW (g)", "Min ABW (g)", "Max ABW (g)", "Gross Revenue (RM)", "VAN Price (RM/kg)", "MON Price (RM/kg)", "VAN Tons", "MON Tons"];
        const rows = buckets.map(b => [
            b.month,
            b.tonnage,
            b.runs,
            b.weightedAbw,
            b.minAbw,
            b.maxAbw,
            b.grossRevenue,
            b.vanPricePerKg,
            b.monPricePerKg,
            b.vanTons,
            b.monTons
        ]);

        const csvContent = "data:text/csv;charset=utf-8," 
            + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `isharp_12m_executive_harvest_ledger_${this.cohortFilter.toLowerCase()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        Toast.success("12-Month Performance Ledger downloaded.");
    }
}
