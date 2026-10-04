/**
 * iSHARP DBMS 2.0 — Executive Production & Biomass Intelligence
 * Nordic Sleek Pastel Executive Theme
 * 
 * Provides live harvest decision gates, 14-day plant intake forecast,
 * 12-month rolling biomass, size distribution bands, packout quality, and commercial financial yield.
 */

import { HarvestRepository } from "../../infrastructure/repositories/harvestRepository.js";
import { classifyHarvestReadiness, projectHarvestForecast, aggregate12MonthMovingHarvest } from "../../domain/biometrics.js";
import { appState } from "../../state/appState.js";
import { Toast } from "../../components/Toast.js";

export class ExecutiveBiomassView {
    /**
     * @param {string} containerId 
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
        const CACHE_KEY = "isharp_exec_biomass_cache_v4";
        const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

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
                        // Still perform subtle background refresh
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
                        <div style="font-size: 0.78rem; color: #64748b; margin-top: 0.5rem;">${err.message || 'Please check network connectivity.'}</div>
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

        const agg = this.aggregated12m || { monthlyBuckets: [], totals: {}, packoutSummary: {}, topBuyers: [] };
        const buckets = agg.monthlyBuckets || [];
        const packout = agg.packoutSummary || { goodPct: 0, secondPct: 0, smallPct: 0, rejectPct: 0 };
        const topBuyers = agg.topBuyers || [];

        // KPI Counts
        const optimumList = this.evaluatedPonds.filter(p => p.classification.category === 'OPTIMUM');
        const minimumList = this.evaluatedPonds.filter(p => p.classification.category === 'MINIMUM');
        const watchList = this.evaluatedPonds.filter(p => p.classification.subCategory === 'WATCH');
        const forcedAlertList = this.evaluatedPonds.filter(p => p.classification.category === 'ALERT');

        const optimumTons = Math.round(optimumList.reduce((acc, p) => acc + (p.biomassKg || 0), 0) / 100) / 10;
        const minimumTons = Math.round(minimumList.reduce((acc, p) => acc + (p.biomassKg || 0), 0) / 100) / 10;
        const standingBiomassTons = Math.round(this.evaluatedPonds.reduce((acc, p) => acc + (p.biomassKg || 0), 0) / 100) / 10;
        const activePondsCount = this.evaluatedPonds.length;

        this.container.innerHTML = `
            <div class="executive-biomass-wrapper" style="display: flex; flex-direction: column; gap: 1.5rem;">
                
                <!-- TOP EXECUTIVE CONTROLS & COHORT SWITCHER -->
                <div class="sleek-card" style="padding: 1.15rem 1.4rem; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 1rem;">
                    <div>
                        <div style="display: flex; align-items: center; gap: 0.6rem;">
                            <span style="width: 8px; height: 8px; border-radius: 50%; background-color: #10b981; display: inline-block;"></span>
                            <span style="font-weight: 800; font-size: 1.05rem; color: #0f172a; letter-spacing: -0.01em;">Executive Production &amp; Biomass Intelligence</span>
                            <span class="status-badge status-production" style="font-size: 0.68rem; padding: 0.15rem 0.5rem;">LIVE COHORT</span>
                        </div>
                        <div style="font-size: 0.75rem; color: #64748b; margin-top: 0.2rem;">
                            Setiu 216-Pond Facility • Live Decision Gate &amp; Rolling 12-Month Performance
                        </div>
                    </div>

                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <span style="font-size: 0.74rem; font-weight: 600; color: #64748b;">Cohort Focus:</span>
                        <div class="exec-cohort-pills" style="display: inline-flex; background: #f1f5f9; padding: 3px; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 0.75rem;">
                            <button type="button" class="btn-cohort ${this.cohortFilter === 'ALL' ? 'active' : ''}" data-cohort="ALL" style="padding: 0.3rem 0.8rem; border-radius: 6px; font-weight: 600; border: none; cursor: pointer; transition: all 0.15s ease;">Combined Farm</button>
                            <button type="button" class="btn-cohort ${this.cohortFilter === 'VAN' ? 'active' : ''}" data-cohort="VAN" style="padding: 0.3rem 0.8rem; border-radius: 6px; font-weight: 600; border: none; cursor: pointer; transition: all 0.15s ease;">Vannamei (VAN)</button>
                            <button type="button" class="btn-cohort ${this.cohortFilter === 'MON' ? 'active' : ''}" data-cohort="MON" style="padding: 0.3rem 0.8rem; border-radius: 6px; font-weight: 600; border: none; cursor: pointer; transition: all 0.15s ease;">Monodon (MON)</button>
                        </div>
                    </div>
                </div>

                <!-- SECTION 1: 6-TILE SLEEK PASTEL KPI STRIP -->
                <div class="exec-kpi-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.9rem;">
                    
                    <!-- Tile 1: Optimum Harvest Ready -->
                    <div class="sleek-card sleek-kpi" style="padding: 1rem 1.15rem; background: linear-gradient(180deg, #ffffff 65%, #ecfdf5 100%); border-color: #d1fae5;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-size: 0.68rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em;">Optimum Ready</span>
                            <span style="display: inline-flex; align-items: center; gap: 4px; padding: 0.15rem 0.45rem; border-radius: 9999px; font-size: 0.65rem; font-weight: 700; background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0;">
                                <span style="width: 5px; height: 5px; border-radius: 50%; background: #10b981;"></span>
                                Premium
                            </span>
                        </div>
                        <div style="margin-top: 0.4rem; display: flex; align-items: baseline; gap: 0.4rem;">
                            <span style="font-size: 1.65rem; font-weight: 800; color: #0f172a; font-family: ui-monospace, monospace;">${optimumList.length}</span>
                            <span style="font-size: 0.75rem; color: #64748b; font-weight: 600;">Ponds</span>
                        </div>
                        <div style="margin-top: 0.35rem; padding-top: 0.4rem; border-top: 1px solid #f1f5f9; display: flex; justify-content: space-between; font-size: 0.72rem;">
                            <span style="color: #64748b;">Volume:</span>
                            <span style="font-weight: 700; color: #047857; font-family: ui-monospace, monospace;">${optimumTons.toLocaleString()} Tons</span>
                        </div>
                    </div>

                    <!-- Tile 2: Minimum Harvest Ready -->
                    <div class="sleek-card sleek-kpi" style="padding: 1rem 1.15rem; background: linear-gradient(180deg, #ffffff 65%, #fff7ed 100%); border-color: #ffedd5;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-size: 0.68rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em;">Minimum Ready</span>
                            <span style="display: inline-flex; align-items: center; gap: 4px; padding: 0.15rem 0.45rem; border-radius: 9999px; font-size: 0.65rem; font-weight: 700; background: #fff7ed; color: #9a3412; border: 1px solid #fed7aa;">
                                <span style="width: 5px; height: 5px; border-radius: 50%; background: #f97316;"></span>
                                Eligible
                            </span>
                        </div>
                        <div style="margin-top: 0.4rem; display: flex; align-items: baseline; gap: 0.4rem;">
                            <span style="font-size: 1.65rem; font-weight: 800; color: #0f172a; font-family: ui-monospace, monospace;">${minimumList.length}</span>
                            <span style="font-size: 0.75rem; color: #64748b; font-weight: 600;">Ponds</span>
                        </div>
                        <div style="margin-top: 0.35rem; padding-top: 0.4rem; border-top: 1px solid #f1f5f9; display: flex; justify-content: space-between; font-size: 0.72rem;">
                            <span style="color: #64748b;">Buffer:</span>
                            <span style="font-weight: 700; color: #c2410c; font-family: ui-monospace, monospace;">${minimumTons.toLocaleString()} Tons</span>
                        </div>
                    </div>

                    <!-- Tile 3: 14-Day Forward Forecast -->
                    <div class="sleek-card sleek-kpi" style="padding: 1rem 1.15rem; background: linear-gradient(180deg, #ffffff 65%, #f5f3ff 100%); border-color: #ede9fe;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-size: 0.68rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em;">14d Forward Intake</span>
                            <span style="display: inline-flex; align-items: center; gap: 4px; padding: 0.15rem 0.45rem; border-radius: 9999px; font-size: 0.65rem; font-weight: 700; background: #f5f3ff; color: #5b21b6; border: 1px solid #ddd6fe;">
                                <span style="width: 5px; height: 5px; border-radius: 50%; background: #8b5cf6;"></span>
                                Plant
                            </span>
                        </div>
                        <div style="margin-top: 0.4rem; display: flex; align-items: baseline; gap: 0.4rem;">
                            <span style="font-size: 1.65rem; font-weight: 800; color: #0f172a; font-family: ui-monospace, monospace;">${this.forecast14d.candidatePonds.length}</span>
                            <span style="font-size: 0.75rem; color: #64748b; font-weight: 600;">Incoming</span>
                        </div>
                        <div style="margin-top: 0.35rem; padding-top: 0.4rem; border-top: 1px solid #f1f5f9; display: flex; justify-content: space-between; font-size: 0.72rem;">
                            <span style="color: #64748b;">Projected:</span>
                            <span style="font-weight: 700; color: #6d28d9; font-family: ui-monospace, monospace;">+${this.forecast14d.totalProjectedBiomassTons.toLocaleString()} Tons</span>
                        </div>
                    </div>

                    <!-- Tile 4: Slow Growth Watch -->
                    <div class="sleek-card sleek-kpi" style="padding: 1rem 1.15rem; background: linear-gradient(180deg, #ffffff 65%, #fefce8 100%); border-color: #fef08a;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-size: 0.68rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em;">Growth Watch</span>
                            <span style="display: inline-flex; align-items: center; gap: 4px; padding: 0.15rem 0.45rem; border-radius: 9999px; font-size: 0.65rem; font-weight: 700; background: #fefce8; color: #854d0e; border: 1px solid #fef08a;">
                                <span style="width: 5px; height: 5px; border-radius: 50%; background: #eab308;"></span>
                                Pre-Alert
                            </span>
                        </div>
                        <div style="margin-top: 0.4rem; display: flex; align-items: baseline; gap: 0.4rem;">
                            <span style="font-size: 1.65rem; font-weight: 800; color: #0f172a; font-family: ui-monospace, monospace;">${watchList.length}</span>
                            <span style="font-size: 0.75rem; color: #64748b; font-weight: 600;">Ponds</span>
                        </div>
                        <div style="margin-top: 0.35rem; padding-top: 0.4rem; border-top: 1px solid #f1f5f9; display: flex; justify-content: space-between; font-size: 0.72rem;">
                            <span style="color: #64748b;">Criteria:</span>
                            <span style="font-weight: 700; color: #a16207;">DOC 70+ (ADG &lt;0.15)</span>
                        </div>
                    </div>

                    <!-- Tile 5: Forced / Emergency Action -->
                    <div class="sleek-card sleek-kpi" style="padding: 1rem 1.15rem; background: linear-gradient(180deg, #ffffff 65%, #fff1f2 100%); border-color: #ffe4e6;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-size: 0.68rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em;">Forced / Alert</span>
                            <span style="display: inline-flex; align-items: center; gap: 4px; padding: 0.15rem 0.45rem; border-radius: 9999px; font-size: 0.65rem; font-weight: 700; background: #fff1f2; color: #9f1239; border: 1px solid #fecdd3;">
                                <span style="width: 5px; height: 5px; border-radius: 50%; background: #f43f5e;"></span>
                                Action
                            </span>
                        </div>
                        <div style="margin-top: 0.4rem; display: flex; align-items: baseline; gap: 0.4rem;">
                            <span style="font-size: 1.65rem; font-weight: 800; color: #0f172a; font-family: ui-monospace, monospace;">${forcedAlertList.length}</span>
                            <span style="font-size: 0.75rem; color: #64748b; font-weight: 600;">Ponds</span>
                        </div>
                        <div style="margin-top: 0.35rem; padding-top: 0.4rem; border-top: 1px solid #f1f5f9; display: flex; justify-content: space-between; font-size: 0.72rem;">
                            <span style="color: #64748b;">Trigger:</span>
                            <span style="font-weight: 700; color: #be123c;">Stunted / Red Issue</span>
                        </div>
                    </div>

                    <!-- Tile 6: Live Standing Crop -->
                    <div class="sleek-card sleek-kpi" style="padding: 1rem 1.15rem; background: linear-gradient(180deg, #ffffff 65%, #f0f9ff 100%); border-color: #e0f2fe;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-size: 0.68rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em;">Live Standing Crop</span>
                            <span style="display: inline-flex; align-items: center; gap: 4px; padding: 0.15rem 0.45rem; border-radius: 9999px; font-size: 0.65rem; font-weight: 700; background: #f0f9ff; color: #0369a1; border: 1px solid #bae6fd;">
                                <span style="width: 5px; height: 5px; border-radius: 50%; background: #0284c7;"></span>
                                Farm
                            </span>
                        </div>
                        <div style="margin-top: 0.4rem; display: flex; align-items: baseline; gap: 0.4rem;">
                            <span style="font-size: 1.65rem; font-weight: 800; color: #0f172a; font-family: ui-monospace, monospace;">${standingBiomassTons.toLocaleString()}</span>
                            <span style="font-size: 0.75rem; color: #64748b; font-weight: 600;">Tons</span>
                        </div>
                        <div style="margin-top: 0.35rem; padding-top: 0.4rem; border-top: 1px solid #f1f5f9; display: flex; justify-content: space-between; font-size: 0.72rem;">
                            <span style="color: #64748b;">Active Ponds:</span>
                            <span style="font-weight: 700; color: #0284c7; font-family: ui-monospace, monospace;">${activePondsCount} / 216</span>
                        </div>
                    </div>

                </div>

                <!-- SECTION 2: SLEEK HARVEST DECISION PIPELINE (TABLE / ACTION GATE) -->
                <div class="sleek-card" style="overflow: hidden;">
                    <div style="padding: 1rem 1.25rem; border-bottom: 1px solid #e2e8f0; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.75rem; background: #f8fafc;">
                        <div>
                            <div style="font-size: 0.88rem; font-weight: 800; color: #0f172a;">Harvest Readiness Pipeline &amp; Action Gate</div>
                            <div style="font-size: 0.72rem; color: #64748b;">Real-time eligibility based on biometric weight, culture age, and biosecurity lab clearance</div>
                        </div>

                        <!-- Segmented Pill Selector -->
                        <div class="exec-pipeline-tabs" style="display: flex; gap: 4px; background: #ffffff; padding: 3px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 0.75rem;">
                            <button type="button" class="tab-pill ${this.pipelineFilter === 'ALL' ? 'active' : ''}" data-tab="ALL" style="padding: 0.3rem 0.75rem; border-radius: 6px; font-weight: 600; border: none; cursor: pointer;">All Ready (${optimumList.length + minimumList.length})</button>
                            <button type="button" class="tab-pill ${this.pipelineFilter === 'OPTIMUM' ? 'active' : ''}" data-tab="OPTIMUM" style="padding: 0.3rem 0.75rem; border-radius: 6px; font-weight: 600; border: none; cursor: pointer;">Optimum (${optimumList.length})</button>
                            <button type="button" class="tab-pill ${this.pipelineFilter === 'MINIMUM' ? 'active' : ''}" data-tab="MINIMUM" style="padding: 0.3rem 0.75rem; border-radius: 6px; font-weight: 600; border: none; cursor: pointer;">Minimum (${minimumList.length})</button>
                            <button type="button" class="tab-pill ${this.pipelineFilter === 'ALERT' ? 'active' : ''}" data-tab="ALERT" style="padding: 0.3rem 0.75rem; border-radius: 6px; font-weight: 600; border: none; cursor: pointer;">Forced &amp; Alert (${forcedAlertList.length})</button>
                            <button type="button" class="tab-pill ${this.pipelineFilter === 'FORECAST' ? 'active' : ''}" data-tab="FORECAST" style="padding: 0.3rem 0.75rem; border-radius: 6px; font-weight: 600; border: none; cursor: pointer;">14d Forecast (${this.forecast14d.candidatePonds.length})</button>
                        </div>
                    </div>

                    <div style="overflow-x: auto;">
                        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.78rem;">
                            <thead style="background: #f8fafc; font-size: 0.7rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid #e2e8f0;">
                                <tr>
                                    <th style="padding: 0.65rem 1rem;">Pond</th>
                                    <th style="padding: 0.65rem 0.75rem;">Species</th>
                                    <th style="padding: 0.65rem 0.75rem;">Classification</th>
                                    <th style="padding: 0.65rem 0.75rem; text-align: right;">Latest ABW</th>
                                    <th style="padding: 0.65rem 0.75rem; text-align: right;">Age (DOC)</th>
                                    <th style="padding: 0.65rem 0.75rem; text-align: right;">Est. Biomass</th>
                                    <th style="padding: 0.65rem 0.75rem; text-align: right;">Growth Pace</th>
                                    <th style="padding: 0.65rem 0.75rem;">Biosecurity</th>
                                    <th style="padding: 0.65rem 1rem; text-align: right;">Action Gate</th>
                                </tr>
                            </thead>
                            <tbody id="exec-pipeline-tbody" style="divide-y: 1px solid #f1f5f9; background: #ffffff;">
                                ${this.renderPipelineRows()}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- SECTION 3: 12-MONTH MOVING PERFORMANCE (CANVAS DUAL CHARTS + PACKOUT QUALITY) -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem;">
                    
                    <!-- Left: Minimalist Pastel Chart -->
                    <div class="sleek-card" style="padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem; grid-column: span 2;">
                        <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 0.75rem;">
                            <div>
                                <div style="font-size: 0.88rem; font-weight: 800; color: #0f172a;">12-Month Moving Biomass &amp; Commercial Yield</div>
                                <div style="font-size: 0.72rem; color: #64748b;">Continuous 12-month rolling biomass (Tons) and verified commercial gross revenue (RM)</div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 1rem; font-size: 0.72rem; font-weight: 600;">
                                <span style="display: inline-flex; align-items: center; gap: 5px; color: #475569;">
                                    <span style="width: 10px; height: 10px; border-radius: 2px; background: #bae6fd;"></span> Biomass (Tons)
                                </span>
                                <span style="display: inline-flex; align-items: center; gap: 5px; color: #475569;">
                                    <span style="width: 12px; height: 2px; background: #059669;"></span> Gross Revenue (RM)
                                </span>
                            </div>
                        </div>

                        <div style="position: relative; width: 100%; height: 260px; background: #f8fafc; border-radius: 8px; border: 1px solid #f1f5f9; padding: 0.5rem; box-sizing: border-box;">
                            <canvas id="canvas-exec-pastel-biomass" style="width: 100%; height: 100%;"></canvas>
                        </div>
                    </div>

                    <!-- Right: Commercial Packout Quality & Top Off-Takers -->
                    <div class="sleek-card" style="padding: 1.25rem; display: flex; flex-direction: column; justify-content: space-between; gap: 1.2rem;">
                        <div style="display: flex; flex-direction: column; gap: 0.9rem;">
                            <div>
                                <div style="font-size: 0.88rem; font-weight: 800; color: #0f172a;">Commercial Quality Packout</div>
                                <div style="font-size: 0.72rem; color: #64748b;">12-Month grading distribution from buyer sales packout</div>
                            </div>

                            <div style="display: flex; flex-direction: column; gap: 0.65rem; font-size: 0.74rem;">
                                <div>
                                    <div style="display: flex; justify-content: space-between; font-weight: 600; margin-bottom: 0.25rem;">
                                        <span style="color: #065f46;">Prime Good Grade</span>
                                        <span style="font-weight: 700; font-family: ui-monospace, monospace;">${packout.goodPct}%</span>
                                    </div>
                                    <div style="width: 100%; background: #f1f5f9; border-radius: 9999px; height: 7px; overflow: hidden;">
                                        <div style="width: ${packout.goodPct}%; background: #34d399; height: 100%; border-radius: 9999px;"></div>
                                    </div>
                                </div>

                                <div>
                                    <div style="display: flex; justify-content: space-between; font-weight: 600; margin-bottom: 0.25rem;">
                                        <span style="color: #0369a1;">2nd Grade</span>
                                        <span style="font-weight: 700; font-family: ui-monospace, monospace;">${packout.secondPct}%</span>
                                    </div>
                                    <div style="width: 100%; background: #f1f5f9; border-radius: 9999px; height: 7px; overflow: hidden;">
                                        <div style="width: ${packout.secondPct}%; background: #38bdf8; height: 100%; border-radius: 9999px;"></div>
                                    </div>
                                </div>

                                <div>
                                    <div style="display: flex; justify-content: space-between; font-weight: 600; margin-bottom: 0.25rem;">
                                        <span style="color: #9a3412;">Small Grade</span>
                                        <span style="font-weight: 700; font-family: ui-monospace, monospace;">${packout.smallPct}%</span>
                                    </div>
                                    <div style="width: 100%; background: #f1f5f9; border-radius: 9999px; height: 7px; overflow: hidden;">
                                        <div style="width: ${packout.smallPct}%; background: #fb923c; height: 100%; border-radius: 9999px;"></div>
                                    </div>
                                </div>

                                <div>
                                    <div style="display: flex; justify-content: space-between; font-weight: 600; margin-bottom: 0.25rem;">
                                        <span style="color: #9f1239;">Below / Rejects</span>
                                        <span style="font-weight: 700; font-family: ui-monospace, monospace;">${packout.rejectPct}%</span>
                                    </div>
                                    <div style="width: 100%; background: #f1f5f9; border-radius: 9999px; height: 7px; overflow: hidden;">
                                        <div style="width: ${packout.rejectPct}%; background: #f43f5e; height: 100%; border-radius: 9999px;"></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Top Off-Takers -->
                        <div style="padding-top: 0.75rem; border-top: 1px solid #f1f5f9;">
                            <div style="font-size: 0.68rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.4rem;">Top Commercial Off-Takers</div>
                            <div style="display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.74rem;">
                                ${topBuyers.length === 0 ? '<div style="color: #94a3b8;">No buyer records in range</div>' : topBuyers.map(b => `
                                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.2rem 0;">
                                        <span style="font-weight: 600; color: #1e293b;">${b.buyer} <span style="font-size: 0.65rem; font-weight: 800; padding: 0.05rem 0.3rem; border-radius: 4px; ${b.species === 'MON' ? 'background:#fff7ed;color:#c2410c;' : (b.species === 'VAN' ? 'background:#f0f9ff;color:#0284c7;' : 'background:#f1f5f9;color:#64748b;')}">${b.species === 'UNK' ? 'N/A' : b.species}</span></span>
                                        <span style="font-family: ui-monospace, monospace; color: #475569; font-weight: 600;">${b.pctShare}% • RM ${b.avgPrice.toFixed(2)}/kg</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>

                </div>

                <!-- SECTION 4: 12-MONTH HISTORICAL PERFORMANCE LEDGER TABLE -->
                <div class="sleek-card" style="overflow: hidden;">
                    <div style="padding: 1rem 1.25rem; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; background: #f8fafc;">
                        <div>
                            <div style="font-size: 0.88rem; font-weight: 800; color: #0f172a;">12-Month Performance Ledger</div>
                            <div style="font-size: 0.72rem; color: #64748b;">Monthly harvest biomass, average sizing, buyer gross revenue, and realized price per kg shown separately for Vannamei and Monodon</div>
                        </div>
                        <button type="button" id="btn-export-exec-ledger" class="btn-action btn-secondary" style="padding: 0.35rem 0.85rem; font-size: 0.75rem; font-weight: 700;">
                            <span>📥 Export CSV</span>
                        </button>
                    </div>

                    <div style="overflow-x: auto;">
                        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.76rem; font-family: ui-monospace, monospace;">
                            <thead style="background: #f8fafc; font-size: 0.68rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid #e2e8f0;">
                                <tr>
                                    <th style="padding: 0.6rem 1rem;">Month</th>
                                    <th style="padding: 0.6rem 0.75rem; text-align: right;">Harvest (Tons)</th>
                                    <th style="padding: 0.6rem 0.75rem; text-align: center;">Runs</th>
                                    <th style="padding: 0.6rem 0.75rem; text-align: right;">Weighted ABW</th>
                                    <th style="padding: 0.6rem 0.75rem; text-align: center;">Size Range</th>
                                    <th style="padding: 0.6rem 0.75rem; text-align: right;">Gross Revenue</th>
                                    <th style="padding: 0.6rem 0.75rem; text-align: right; color: #0369a1;">VAN RM/kg</th>
                                    <th style="padding: 0.6rem 1rem; text-align: right; color: #c2410c;">MON RM/kg</th>
                                </tr>
                            </thead>
                            <tbody style="divide-y: 1px solid #f1f5f9; background: #ffffff;">
                                ${buckets.length === 0 ? `
                                    <tr><td colspan="8" style="padding: 1.5rem; text-align: center; color: #94a3b8;">No harvest records found for selected period.</td></tr>
                                ` : buckets.map(b => `
                                    <tr class="pond-row" style="border-bottom: 1px solid #f8fafc;">
                                        <td style="padding: 0.55rem 1rem; font-weight: 700; color: #0f172a;">${b.month}</td>
                                        <td style="padding: 0.55rem 0.75rem; text-align: right; font-weight: 700; color: #0284c7;">${b.tonnage.toLocaleString(undefined, { minimumFractionDigits: 1 })} T</td>
                                        <td style="padding: 0.55rem 0.75rem; text-align: center; color: #64748b;">${b.runs}</td>
                                        <td style="padding: 0.55rem 0.75rem; text-align: right; font-weight: 700; color: #0f172a;">${b.weightedAbw > 0 ? b.weightedAbw.toFixed(2) + ' g' : '—'}</td>
                                        <td style="padding: 0.55rem 0.75rem; text-align: center; color: #64748b;">${b.minAbw > 0 ? b.minAbw.toFixed(1) + ' – ' + b.maxAbw.toFixed(1) + ' g' : '—'}</td>
                                        <td style="padding: 0.55rem 0.75rem; text-align: right; font-weight: 700; color: #0f172a;">${b.grossRevenue > 0 ? 'RM ' + b.grossRevenue.toLocaleString() : 'RM 0'}</td>
                                        <td style="padding: 0.55rem 0.75rem; text-align: right; font-weight: 700; color: #0369a1;">${b.vanPricePerKg > 0 ? 'RM ' + b.vanPricePerKg.toFixed(2) : '—'}</td>
                                        <td style="padding: 0.55rem 1rem; text-align: right; font-weight: 700; color: #c2410c;">${b.monPricePerKg > 0 ? 'RM ' + b.monPricePerKg.toFixed(2) : '—'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        `;
    }

    renderPipelineRows() {
        let displayList = [];

        if (this.pipelineFilter === 'OPTIMUM') {
            displayList = this.evaluatedPonds.filter(p => p.classification.category === 'OPTIMUM');
        } else if (this.pipelineFilter === 'MINIMUM') {
            displayList = this.evaluatedPonds.filter(p => p.classification.category === 'MINIMUM');
        } else if (this.pipelineFilter === 'ALERT') {
            displayList = this.evaluatedPonds.filter(p => p.classification.category === 'ALERT');
        } else if (this.pipelineFilter === 'FORECAST') {
            displayList = this.forecast14d.candidatePonds.map(p => ({
                ...p,
                classification: {
                    label: p.willBeOptimum ? '🌟 14d Optimum' : '🟡 14d Minimum',
                    badgeType: p.willBeOptimum ? 'emerald' : 'amber',
                    actionText: 'Reserve Intake',
                    reason: `Projected +${p.projectedAbw}g in 14d`
                }
            }));
        } else {
            // ALL Harvestable
            displayList = this.evaluatedPonds.filter(p => p.classification.category === 'OPTIMUM' || p.classification.category === 'MINIMUM' || p.classification.category === 'ALERT');
        }

        if (displayList.length === 0) {
            return `<tr><td colspan="9" style="padding: 1.5rem; text-align: center; color: #94a3b8;">No ponds match filter "${this.pipelineFilter}".</td></tr>`;
        }

        return displayList.slice(0, 30).map(p => {
            const cl = p.classification || {};
            const isOpt = cl.category === 'OPTIMUM';
            const isMin = cl.category === 'MINIMUM';
            const isAlert = cl.category === 'ALERT';

            let badgeHtml = '';
            if (isOpt) {
                badgeHtml = `<span style="display: inline-flex; align-items: center; gap: 4px; padding: 0.15rem 0.45rem; border-radius: 9999px; font-size: 0.68rem; font-weight: 700; background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0;"><span style="width: 5px; height: 5px; border-radius: 50%; background: #10b981;"></span>${cl.label}</span>`;
            } else if (isMin) {
                badgeHtml = `<span style="display: inline-flex; align-items: center; gap: 4px; padding: 0.15rem 0.45rem; border-radius: 9999px; font-size: 0.68rem; font-weight: 700; background: #fff7ed; color: #9a3412; border: 1px solid #fed7aa;"><span style="width: 5px; height: 5px; border-radius: 50%; background: #f97316;"></span>${cl.label}</span>`;
            } else if (isAlert) {
                badgeHtml = `<span style="display: inline-flex; align-items: center; gap: 4px; padding: 0.15rem 0.45rem; border-radius: 9999px; font-size: 0.68rem; font-weight: 700; background: #fff1f2; color: #9f1239; border: 1px solid #fecdd3;"><span style="width: 5px; height: 5px; border-radius: 50%; background: #f43f5e;"></span>${cl.label}</span>`;
            } else {
                badgeHtml = `<span style="display: inline-flex; align-items: center; gap: 4px; padding: 0.15rem 0.45rem; border-radius: 9999px; font-size: 0.68rem; font-weight: 700; background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1;">${cl.label}</span>`;
            }

            const speciesBadge = p.species === 'MON'
                ? `<span style="padding: 0.15rem 0.35rem; border-radius: 4px; font-size: 0.65rem; font-weight: 800; background: #fff7ed; color: #c2410c; border: 1px solid #ffedd5;">MON</span>`
                : `<span style="padding: 0.15rem 0.35rem; border-radius: 4px; font-size: 0.65rem; font-weight: 800; background: #f0f9ff; color: #0284c7; border: 1px solid #e0f2fe;">VAN</span>`;

            const biosecurityLabel = p.issueFlag === 'RED'
                ? `<span style="color: #e11d48; font-weight: 700;">🔴 ${p.issueNote || 'RED Flag'}</span>`
                : p.issueFlag === 'YELLOW'
                ? `<span style="color: #d97706; font-weight: 600;">🟡 Warning</span>`
                : `<span style="color: #059669; font-weight: 600;">🟢 Clean</span>`;

            return `
                <tr class="pond-row" style="border-bottom: 1px solid #f8fafc; transition: background 0.15s ease;">
                    <td style="padding: 0.6rem 1rem; font-weight: 800; color: #0f172a; font-family: ui-monospace, monospace;">${p.pond || '—'}</td>
                    <td style="padding: 0.6rem 0.75rem;">${speciesBadge}</td>
                    <td style="padding: 0.6rem 0.75rem;">${badgeHtml}</td>
                    <td style="padding: 0.6rem 0.75rem; text-align: right; font-weight: 700; color: #0f172a; font-family: ui-monospace, monospace;">${p.abw > 0 ? p.abw.toFixed(2) + ' g' : '—'}</td>
                    <td style="padding: 0.6rem 0.75rem; text-align: right; color: #64748b; font-family: ui-monospace, monospace;">${p.doc > 0 ? p.doc + ' d' : '—'}</td>
                    <td style="padding: 0.6rem 0.75rem; text-align: right; font-weight: 700; color: #0284c7; font-family: ui-monospace, monospace;">${p.biomassKg > 0 ? p.biomassKg.toLocaleString() + ' kg' : '—'}</td>
                    <td style="padding: 0.6rem 0.75rem; text-align: right; color: #059669; font-weight: 600; font-family: ui-monospace, monospace;">${p.adg > 0 ? p.adg.toFixed(2) + ' g/d' : '—'}</td>
                    <td style="padding: 0.6rem 0.75rem; font-size: 0.72rem;">${biosecurityLabel}</td>
                    <td style="padding: 0.6rem 1rem; text-align: right;">
                        <button type="button" class="btn-action-gate" data-pond="${p.pond}" data-index="${p.pondIndex}" style="padding: 0.25rem 0.6rem; font-size: 0.68rem; font-weight: 700; border-radius: 6px; border: 1px solid #cbd5e1; background: #ffffff; cursor: pointer; transition: all 0.15s ease;">
                            ${cl.actionText || 'Details'}
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
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

        // Action Gate Buttons (open detail drawer if gridMapRef available or trigger toast)
        this.bindActionGateTriggers();

        // Export CSV button
        const btnExport = this.container.querySelector("#btn-export-exec-ledger");
        if (btnExport) {
            btnExport.addEventListener("click", () => this.exportToCSV());
        }

        // Window resize for chart responsiveness
        if (this._chartObserver) this._chartObserver.disconnect();
        const chartHost = this.container.querySelector("#canvas-exec-pastel-biomass");
        if (chartHost && chartHost.parentElement && typeof ResizeObserver !== "undefined") {
            this._chartObserver = new ResizeObserver(() => this.drawMinimalistChart());
            this._chartObserver.observe(chartHost.parentElement);
        }
        window.removeEventListener("resize", this._boundResize);
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
        if (!canvas || !canvas.parentElement) return;

        const ctx = canvas.getContext("2d");
        const w = canvas.parentElement.clientWidth;
        const h = canvas.parentElement.clientHeight;
        if (!w || !h) return; // container hidden (tab not active); ResizeObserver redraws once visible

        canvas.width = w * window.devicePixelRatio;
        canvas.height = h * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

        const buckets = (this.aggregated12m && this.aggregated12m.monthlyBuckets) ? this.aggregated12m.monthlyBuckets : [];
        if (buckets.length === 0) {
            ctx.fillStyle = "#94a3b8";
            ctx.font = "12px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("No historical harvest data available for chart", w / 2, h / 2);
            return;
        }

        // Take full 12 rolling months for comprehensive executive performance review
        const displayBuckets = buckets.slice(-12);

        const tonsArr = displayBuckets.map(b => b.tonnage);
        const revArr = displayBuckets.map(b => b.grossRevenue / 1000000); // In Millions RM

        const maxTons = Math.max(10, Math.ceil(Math.max(...tonsArr) / 50) * 50);
        const maxRev = Math.max(1, Math.ceil(Math.max(...revArr)));

        const padding = { left: 45, right: 35, top: 25, bottom: 30 };
        const plotW = w - padding.left - padding.right;
        const plotH = h - padding.top - padding.bottom;

        ctx.clearRect(0, 0, w, h);

        // Subtle Hairline Gridlines
        ctx.strokeStyle = "rgba(226, 232, 240, 0.8)";
        ctx.lineWidth = 1;
        for (let i = 0; i <= 3; i++) {
            const y = padding.top + (plotH / 3) * i;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(w - padding.right, y);
            ctx.stroke();

            const val = Math.round(maxTons - (maxTons / 3) * i);
            ctx.fillStyle = "#94a3b8";
            ctx.font = "10px ui-monospace, monospace";
            ctx.textAlign = "right";
            ctx.fillText(val + " T", padding.left - 8, y + 3);
        }

        const barW = Math.max(8, (plotW / displayBuckets.length) * 0.44);
        const stepX = plotW / displayBuckets.length;

        // Draw Soft Sky Pastel Bars (Biomass)
        displayBuckets.forEach((b, idx) => {
            const x = padding.left + stepX * idx + (stepX - barW) / 2;
            const barH = maxTons > 0 ? (b.tonnage / maxTons) * plotH : 0;
            const y = padding.top + (plotH - barH);

            if (b.tonnage > 0) {
                ctx.fillStyle = "#bae6fd"; // Soft pastel sky
                ctx.beginPath();
                if (typeof ctx.roundRect === 'function') {
                    ctx.roundRect(x, y, barW, barH, [3, 3, 0, 0]);
                } else {
                    ctx.rect(x, y, barW, barH);
                }
                ctx.fill();
            }

            // Month Label (e.g. 11/25, 12/25, 01/26 ... 10/26)
            ctx.fillStyle = "#64748b";
            ctx.font = "500 10px ui-monospace, monospace";
            ctx.textAlign = "center";
            const parts = (b.month || '').split('-');
            const monthLabel = parts.length === 2 ? `${parts[1]}/${parts[0].slice(2)}` : b.month;
            ctx.fillText(monthLabel, x + barW / 2, h - 10);
        });

        // Draw Smooth Emerald Revenue Line
        ctx.beginPath();
        ctx.strokeStyle = "#059669";
        ctx.lineWidth = 2.2;
        let lineStarted = false;
        displayBuckets.forEach((b, idx) => {
            const x = padding.left + stepX * idx + stepX / 2;
            const normRev = maxRev > 0 ? revArr[idx] / maxRev : 0;
            const y = padding.top + (plotH - (normRev * plotH));
            if (!lineStarted) {
                ctx.moveTo(x, y);
                lineStarted = true;
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();

        // Draw Revenue Points
        displayBuckets.forEach((b, idx) => {
            const x = padding.left + stepX * idx + stepX / 2;
            const normRev = maxRev > 0 ? revArr[idx] / maxRev : 0;
            const y = padding.top + (plotH - (normRev * plotH));

            ctx.beginPath();
            ctx.arc(x, y, 3.5, 0, Math.PI * 2);
            ctx.fillStyle = "#ffffff";
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = "#059669";
            ctx.stroke();
        });
    }

    exportToCSV() {
        const buckets = (this.aggregated12m && this.aggregated12m.monthlyBuckets) ? this.aggregated12m.monthlyBuckets : [];
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
