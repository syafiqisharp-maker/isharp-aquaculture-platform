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
import {
    getExecutiveBiomassHtml,
    renderPipelineRowsHtml,
    renderPipelineFooterHtml,
    filterPondsForPipeline,
    renderCommercialPackoutCardHtml,
    renderPerformanceLedgerSectionHtml
} from "./templates/executiveBiomassTemplate.js";
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
        this.packoutSpeciesFilter = null; // 'ALL', 'VAN', 'MON' or null (synced with cohort)
        this.sortKey = "abw";            // 'pond', 'species', 'classification', 'abw', 'doc', 'biomassKg', 'adg', 'awg', 'issueFlag', 'action'
        this.sortDirection = "desc";     // 'asc', 'desc'

        // Audited Commercial Ledger State
        this.ledgerTimeHorizon = "ALL";  // 'ALL' (12M Rolling) or 'YTD' (Current Calendar Year)
        this.ledgerHideEmpty = false;
        this.ledgerSortKey = "month";
        this.ledgerSortDirection = "desc";
        
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
                awg: p.awg,
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
            evaluatedPonds: this.sortEvaluatedPonds(this.evaluatedPonds),
            forecast14d: this.forecast14d,
            aggregated12m: this.aggregated12m,
            packoutSpeciesFilter: this.packoutSpeciesFilter,
            ledgerTimeHorizon: this.ledgerTimeHorizon,
            hideEmptyMonths: this.ledgerHideEmpty,
            ledgerSortKey: this.ledgerSortKey,
            ledgerSortDirection: this.ledgerSortDirection
        });
        this.updateSortHeaderIndicators();
    }

    sortEvaluatedPonds(ponds = []) {
        if (!this.sortKey || !this.sortDirection) return ponds;
        const dir = this.sortDirection === "asc" ? 1 : -1;
        const key = this.sortKey;

        return ponds.slice().sort((a, b) => {
            let valA, valB;
            if (key === "pond") {
                valA = a.pond || "";
                valB = b.pond || "";
                return dir * valA.localeCompare(valB, undefined, { numeric: true });
            } else if (key === "species") {
                valA = a.species || "";
                valB = b.species || "";
                return dir * valA.localeCompare(valB);
            } else if (key === "classification") {
                const rank = { ALERT: 3, OPTIMUM: 2, MINIMUM: 1, GROWING: 0, NO_DATA: -1 };
                valA = rank[a.classification?.category] ?? 0;
                valB = rank[b.classification?.category] ?? 0;
                return dir * (valA - valB);
            } else if (key === "abw") {
                valA = Number(a.abw) || 0;
                valB = Number(b.abw) || 0;
                return dir * (valA - valB);
            } else if (key === "doc") {
                valA = Number(a.doc) || 0;
                valB = Number(b.doc) || 0;
                return dir * (valA - valB);
            } else if (key === "biomassKg") {
                valA = Number(a.biomassKg) || 0;
                valB = Number(b.biomassKg) || 0;
                return dir * (valA - valB);
            } else if (key === "adg") {
                valA = Number(a.adg) || 0;
                valB = Number(b.adg) || 0;
                return dir * (valA - valB);
            } else if (key === "awg") {
                valA = Number(a.awg) || 0;
                valB = Number(b.awg) || 0;
                return dir * (valA - valB);
            } else if (key === "issueFlag") {
                const rank = { RED: 3, YELLOW: 2, GREEN: 1 };
                valA = rank[a.issueFlag] ?? 0;
                valB = rank[b.issueFlag] ?? 0;
                return dir * (valA - valB);
            } else if (key === "action") {
                valA = a.classification?.actionText || "";
                valB = b.classification?.actionText || "";
                return dir * valA.localeCompare(valB);
            }
            return 0;
        });
    }

    renderPipelineRows() {
        const sorted = this.sortEvaluatedPonds(this.evaluatedPonds);
        return renderPipelineRowsHtml(sorted, this.pipelineFilter, this.forecast14d);
    }

    renderPipelineFooter() {
        const sorted = this.sortEvaluatedPonds(this.evaluatedPonds);
        const filtered = filterPondsForPipeline(sorted, this.pipelineFilter, this.forecast14d);
        return renderPipelineFooterHtml(filtered);
    }

    refreshPipelineTable() {
        const tbody = this.container.querySelector("#exec-pipeline-tbody");
        if (tbody) {
            tbody.innerHTML = this.renderPipelineRows();
            this.bindActionGateTriggers();
        }
        const tfoot = this.container.querySelector("#exec-pipeline-tfoot");
        if (tfoot) {
            tfoot.innerHTML = this.renderPipelineFooter();
        }
        this.updateSortHeaderIndicators();
    }

    updateSortHeaderIndicators() {
        if (!this.container) return;
        const headers = this.container.querySelectorAll(".exec-pipeline-table th[data-sort-key]");
        headers.forEach(th => {
            const key = th.getAttribute("data-sort-key");
            const indicator = th.querySelector(".sort-indicator");
            if (indicator) {
                if (key === this.sortKey) {
                    indicator.textContent = this.sortDirection === "asc" ? "▲" : "▼";
                    indicator.style.color = "#0284c7";
                } else {
                    indicator.textContent = "↕";
                    indicator.style.color = "#94a3b8";
                }
            }
        });
    }

    bindEvents() {
        if (!this.container) return;

        // Pipeline Segmented Tabs
        const tabBtns = this.container.querySelectorAll(".tab-pill");
        tabBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                const t = btn.getAttribute("data-tab");
                if (t && t !== this.pipelineFilter) {
                    this.pipelineFilter = t;
                    this.refreshPipelineTable();
                    tabBtns.forEach(b => b.classList.remove("active"));
                    btn.classList.add("active");
                }
            });
        });

        // Banner Shortcut for Missing Survival Rate
        const btnShowMissing = this.container.querySelector(".btn-show-missing-surv");
        if (btnShowMissing) {
            btnShowMissing.addEventListener("click", () => {
                this.pipelineFilter = "MISSING_SURV";
                this.refreshPipelineTable();
                const allTabBtns = this.container.querySelectorAll(".tab-pill");
                allTabBtns.forEach(b => {
                    if (b.getAttribute("data-tab") === "MISSING_SURV") {
                        b.classList.add("active");
                    } else {
                        b.classList.remove("active");
                    }
                });
            });
        }

        // Sortable Table Headers
        const sortHeaders = this.container.querySelectorAll(".exec-pipeline-table th[data-sort-key]");
        sortHeaders.forEach(th => {
            th.addEventListener("click", () => {
                const key = th.getAttribute("data-sort-key");
                if (this.sortKey === key) {
                    this.sortDirection = this.sortDirection === "asc" ? "desc" : "asc";
                } else {
                    this.sortKey = key;
                    this.sortDirection = (key === "pond" || key === "species") ? "asc" : "desc";
                }
                this.refreshPipelineTable();
            });
        });

        // Expandable Policy & Decision Criteria Drawer Toggle
        const btnTogglePolicy = this.container.querySelector("#btn-toggle-harvest-policy");
        const policyDrawer = this.container.querySelector("#exec-harvest-policy-drawer");
        if (btnTogglePolicy && policyDrawer) {
            btnTogglePolicy.addEventListener("click", () => {
                const isHidden = policyDrawer.style.display === "none";
                policyDrawer.style.display = isHidden ? "block" : "none";
                const icon = btnTogglePolicy.querySelector(".policy-toggle-icon");
                const text = btnTogglePolicy.querySelector(".policy-toggle-text");
                if (icon) icon.textContent = isHidden ? "▲" : "▼";
                if (text) text.textContent = isHidden ? "Hide Decision Rules" : "View Decision Gate Criteria";
            });
        }

        // Action Gate Buttons
        this.bindActionGateTriggers();

        // Packout Species Switcher Buttons
        this.bindPackoutEvents();

        // Audited Commercial Ledger Events
        this.bindLedgerEvents();

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

    bindPackoutEvents() {
        if (!this.container) return;
        const packoutBtns = this.container.querySelectorAll(".btn-packout-species");
        packoutBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                const sp = btn.getAttribute("data-packout-species") || "ALL";
                this.packoutSpeciesFilter = sp;
                const packoutCard = this.container.querySelector("#card-commercial-packout");
                if (packoutCard) {
                    const agg = this.aggregated12m;
                    const activePackoutSpecies = this.packoutSpeciesFilter || (this.cohortFilter === "MON" ? "MON" : (this.cohortFilter === "VAN" ? "VAN" : "ALL"));
                    const activePackout = agg?.packoutBySpecies?.[activePackoutSpecies] || agg?.packoutSummary || { goodPct: 0, secondPct: 0, smallPct: 0, rejectPct: 0 };
                    const activeBuyersData = agg?.topBuyersBySpecies?.[activePackoutSpecies] || { buyers: agg?.topBuyers || [], top3ConcentrationPct: agg?.top3BuyerConcentration || 0 };

                    packoutCard.outerHTML = renderCommercialPackoutCardHtml({
                        packout: activePackout,
                        topBuyers: activeBuyersData.buyers || [],
                        currentSpecies: activePackoutSpecies,
                        top3Concentration: activeBuyersData.top3ConcentrationPct || 0
                    });
                    this.bindPackoutEvents();
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

    refreshLedgerSection() {
        if (!this.container) return;
        const ledgerContainer = this.container.querySelector("#exec-ledger-container");
        if (!ledgerContainer) return;

        const agg = this.aggregated12m || { monthlyBuckets: [], totals: {} };
        ledgerContainer.innerHTML = renderPerformanceLedgerSectionHtml({
            buckets: agg.monthlyBuckets || [],
            totals: agg.totals || {},
            cohortFilter: this.cohortFilter,
            ledgerTimeHorizon: this.ledgerTimeHorizon,
            hideEmptyMonths: this.ledgerHideEmpty,
            sortKey: this.ledgerSortKey,
            sortDirection: this.ledgerSortDirection
        });
        this.bindLedgerEvents();
    }

    bindLedgerEvents() {
        if (!this.container) return;

        // Horizon toggle buttons (12M Rolling vs YTD)
        const horizonBtns = this.container.querySelectorAll(".btn-ledger-horizon");
        horizonBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                const h = btn.getAttribute("data-horizon") || "ALL";
                if (h !== this.ledgerTimeHorizon) {
                    this.ledgerTimeHorizon = h;
                    this.refreshLedgerSection();
                }
            });
        });

        // Hide empty months checkbox
        const chkHide = this.container.querySelector("#chk-ledger-hide-empty");
        if (chkHide) {
            chkHide.addEventListener("change", e => {
                this.ledgerHideEmpty = e.target.checked;
                this.refreshLedgerSection();
            });
        }

        // Ledger sortable headers
        const sortHeaders = this.container.querySelectorAll(".exec-ledger-table th[data-ledger-sort]");
        sortHeaders.forEach(th => {
            th.addEventListener("click", () => {
                const key = th.getAttribute("data-ledger-sort");
                if (this.ledgerSortKey === key) {
                    this.ledgerSortDirection = this.ledgerSortDirection === "asc" ? "desc" : "asc";
                } else {
                    this.ledgerSortKey = key;
                    this.ledgerSortDirection = (key === "month" || key === "tonnage" || key === "grossRevenue" || key === "vanTons" || key === "monTons") ? "desc" : "asc";
                }
                this.refreshLedgerSection();
            });
        });

        // Export CSV button
        const btnExport = this.container.querySelector("#btn-export-exec-ledger");
        if (btnExport) {
            btnExport.addEventListener("click", () => this.exportToCSV());
        }
    }

    exportToCSV() {
        const rawBuckets = this.aggregated12m?.monthlyBuckets || [];
        if (rawBuckets.length === 0) {
            Toast.info("No ledger data available to export.");
            return;
        }

        const currentYear = new Date().getFullYear();
        let buckets = rawBuckets.slice();
        if (this.ledgerTimeHorizon === "YTD") {
            buckets = buckets.filter(b => b.month && String(b.month).startsWith(String(currentYear)));
        }
        if (this.ledgerHideEmpty) {
            buckets = buckets.filter(b => ((b.tonnage || 0) > 0 || (b.grossRevenue || 0) > 0 || (b.runs || 0) > 0));
        }

        const dir = this.ledgerSortDirection === "asc" ? 1 : -1;
        buckets.sort((a, b) => {
            if (this.ledgerSortKey === "month") return dir * String(a.month).localeCompare(String(b.month));
            if (this.ledgerSortKey === "tonnage") return dir * ((a.tonnage || 0) - (b.tonnage || 0));
            if (this.ledgerSortKey === "runs") return dir * ((a.runs || 0) - (b.runs || 0));
            if (this.ledgerSortKey === "grossRevenue") return dir * ((a.grossRevenue || 0) - (b.grossRevenue || 0));
            if (this.ledgerSortKey === "vanTons") return dir * ((a.vanTons || 0) - (b.vanTons || 0));
            if (this.ledgerSortKey === "vanAbw") return dir * ((a.vanAbw || 0) - (b.vanAbw || 0));
            if (this.ledgerSortKey === "vanPricePerKg") return dir * ((a.vanPricePerKg || 0) - (b.vanPricePerKg || 0));
            if (this.ledgerSortKey === "monTons") return dir * ((a.monTons || 0) - (b.monTons || 0));
            if (this.ledgerSortKey === "monAbw") return dir * ((a.monAbw || 0) - (b.monAbw || 0));
            if (this.ledgerSortKey === "monPricePerKg") return dir * ((a.monPricePerKg || 0) - (b.monPricePerKg || 0));
            return 0;
        });

        const headers = [
            "Month",
            "Harvest (MT)",
            "MoM Change (%)",
            "Termination (MT)",
            "Partial Harvest (MT)",
            "Harvest Events",
            "Gross Revenue (RM)",
            "VAN (MT)",
            "VAN Share (%)",
            "VAN Avg ABW (g)",
            "VAN Min ABW (g)",
            "VAN Max ABW (g)",
            "VAN Price (RM/kg)",
            "MON (MT)",
            "MON Share (%)",
            "MON Avg ABW (g)",
            "MON Min ABW (g)",
            "MON Max ABW (g)",
            "MON Price (RM/kg)"
        ];

        const rows = buckets.map(b => [
            b.month,
            (b.tonnage || 0).toFixed(1),
            b.momDeltaPct !== null ? b.momDeltaPct : "",
            (b.terminationTons || 0).toFixed(1),
            (b.partialTons || 0).toFixed(1),
            b.runs || 0,
            b.grossRevenue || 0,
            (b.vanTons || 0).toFixed(1),
            b.vanSharePct || 0,
            b.vanAbw > 0 ? b.vanAbw.toFixed(2) : "",
            b.vanMinAbw > 0 ? b.vanMinAbw.toFixed(1) : "",
            b.vanMaxAbw > 0 ? b.vanMaxAbw.toFixed(1) : "",
            b.vanPricePerKg > 0 ? b.vanPricePerKg.toFixed(2) : "",
            (b.monTons || 0).toFixed(1),
            b.monSharePct || 0,
            b.monAbw > 0 ? b.monAbw.toFixed(2) : "",
            b.monMinAbw > 0 ? b.monMinAbw.toFixed(1) : "",
            b.monMaxAbw > 0 ? b.monMaxAbw.toFixed(1) : "",
            b.monPricePerKg > 0 ? b.monPricePerKg.toFixed(2) : ""
        ]);

        // Calculate Totals row for CSV
        const totWeightKg = buckets.reduce((sum, b) => sum + (b.weightKg || 0), 0);
        const totTons = Math.round(totWeightKg / 100) / 10;
        const totRev = buckets.reduce((sum, b) => sum + (b.grossRevenue || 0), 0);
        const totVanTons = Math.round(buckets.reduce((sum, b) => sum + (b.vanTons || 0), 0) * 10) / 10;
        const totMonTons = Math.round(buckets.reduce((sum, b) => sum + (b.monTons || 0), 0) * 10) / 10;
        const totVanPct = totTons > 0 ? Math.round((totVanTons / totTons) * 1000) / 10 : 0;
        const totMonPct = totTons > 0 ? Math.round((totMonTons / totTons) * 1000) / 10 : 0;
        const totTermTons = Math.round(buckets.reduce((sum, b) => sum + (b.terminationTons || 0), 0) * 10) / 10;
        const totPartTons = Math.round(buckets.reduce((sum, b) => sum + (b.partialTons || 0), 0) * 10) / 10;
        const totRuns = buckets.reduce((sum, b) => sum + (b.runs || 0), 0);

        let vRev = 0, vWgt = 0, mRev = 0, mWgt = 0;
        buckets.forEach(b => {
            if (b.vanPricePerKg > 0 && b.vanTons > 0) { const kg = b.vanTons * 1000; vRev += b.vanPricePerKg * kg; vWgt += kg; }
            if (b.monPricePerKg > 0 && b.monTons > 0) { const kg = b.monTons * 1000; mRev += b.monPricePerKg * kg; mWgt += kg; }
        });
        const wVanPrc = vWgt > 0 ? (vRev / vWgt).toFixed(2) : "";
        const wMonPrc = mWgt > 0 ? (mRev / mWgt).toFixed(2) : "";

        // Species ABWs and ranges across exported rows
        const vanWeightKg = buckets.reduce((sum, b) => sum + ((b.vanTons || 0) * 1000), 0);
        const vanAbwSum = buckets.reduce((sum, b) => sum + ((b.vanAbw || 0) * ((b.vanTons || 0) * 1000)), 0);
        const totVanAbw = vanWeightKg > 0 ? (vanAbwSum / vanWeightKg).toFixed(2) : "";
        const vanMins = buckets.map(b => b.vanMinAbw).filter(v => v > 0);
        const totVanMin = vanMins.length ? Math.min(...vanMins).toFixed(1) : "";
        const vanMaxs = buckets.map(b => b.vanMaxAbw).filter(v => v > 0);
        const totVanMax = vanMaxs.length ? Math.max(...vanMaxs).toFixed(1) : "";

        const monWeightKg = buckets.reduce((sum, b) => sum + ((b.monTons || 0) * 1000), 0);
        const monAbwSum = buckets.reduce((sum, b) => sum + ((b.monAbw || 0) * ((b.monTons || 0) * 1000)), 0);
        const totMonAbw = monWeightKg > 0 ? (monAbwSum / monWeightKg).toFixed(2) : "";
        const monMins = buckets.map(b => b.monMinAbw).filter(m => m > 0);
        const totMonMin = monMins.length ? Math.min(...monMins).toFixed(1) : "";
        const monMaxs = buckets.map(b => b.monMaxAbw).filter(m => m > 0);
        const totMonMax = monMaxs.length ? Math.max(...monMaxs).toFixed(1) : "";

        rows.push([
            `FINANCE TOTAL (${buckets.length} Mos)`,
            totTons.toFixed(1),
            "",
            totTermTons.toFixed(1),
            totPartTons.toFixed(1),
            totRuns,
            totRev,
            totVanTons.toFixed(1),
            totVanPct,
            totVanAbw,
            totVanMin,
            totVanMax,
            wVanPrc,
            totMonTons.toFixed(1),
            totMonPct,
            totMonAbw,
            totMonMin,
            totMonMax,
            wMonPrc
        ]);

        const csvContent = "data:text/csv;charset=utf-8," 
            + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");

        const horizonTag = this.ledgerTimeHorizon === "YTD" ? `${currentYear}_ytd` : "12m_rolling";
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `isharp_finance_harvest_ledger_${horizonTag}_${this.cohortFilter.toLowerCase()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        Toast.success("Finance Harvest & Revenue Ledger downloaded.");
    }
}
