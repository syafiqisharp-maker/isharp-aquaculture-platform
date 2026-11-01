/**
 * iSHARP DBMS 2.0 — Executive View Module
 * Executive Dashboard featuring 216-Pond Farm Map and Production Analytics.
 */

import { appState } from "../../state/appState.js";
import { PondGridMap } from "./PondGridMap.js";
import { ExecutiveBiomassView } from "./ExecutiveBiomassView.js";
import { ManagementCalloutModal } from "../../components/ManagementCalloutModal.js";
import { Toast } from "../../components/Toast.js";
import { ExecutiveMetricModal } from "./ExecutiveMetricModal.js";
import { ExecutiveMetricsPresenter, METRIC_TYPES, formatNumber, formatMonthLabel } from "./ExecutiveMetricsPresenter.js";
import { PondRepository } from "../../infrastructure/repositories/pondRepository.js";
import { HarvestRepository } from "../../infrastructure/repositories/harvestRepository.js";
import { SamplingRepository } from "../../infrastructure/repositories/samplingRepository.js";

export class ExecutiveView {
    constructor(containerId = "view-executive") {
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        this.rawDailyHarvests = [];
        this.rawSalesRecords = [];
        this.rawStockingBatches = [];
        this.rawOperationalCycles = [];
        this.rawSamplings = [];

        this.render();
        this.bindEvents();

        // Initialize 216-Pond Interactive Farm Grid Map
        this.gridMap = new PondGridMap("exec-map-container");

        // Initialize Executive Production & Biomass Intelligence
        this.biomassView = new ExecutiveBiomassView("exec-production-container", this.gridMap);

        // Listen for cycles change to update KPI strip
        appState.subscribe("cyclesLoaded", (cycles) => this.updateKPIs(cycles));

        // Load farm harvest and stocking metrics asynchronously
        this.loadExecutiveMetrics();
    }


    render() {
        this.container.innerHTML = `
            <div class="executive-view-layout">
                
                <!-- Executive Header Bar -->
                <header class="exec-header">
                    <div class="exec-header-left">
                        <button class="btn-portal-back" type="button" data-nav-view="portal" title="Return to Portal Landing Page">
                            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="19" y1="12" x2="5" y2="12"></line>
                                <polyline points="12 19 5 12 12 5"></polyline>
                            </svg>
                            <span class="lbl-full">Back to Portal</span>
                            <span class="lbl-short">Portal</span>
                        </button>
                        
                        <div class="exec-title-group">
                            <div class="exec-header-title">
                                <span class="lbl-full">Executive &amp; Biosecurity Dashboard</span>
                                <span class="lbl-short">Executive Dashboard</span>
                            </div>
                            <div class="exec-header-sub">Blue Archipelago Berhad • Setiu Farm (216 Commercial Ponds)</div>
                        </div>
                    </div>

                    <div class="exec-header-right">
                        <button class="btn-action btn-secondary btn-header-callout" id="btn-exec-mgmt-callout" type="button" title="Open Weekly Management Info Audit & WhatsApp Callout">
                            <span class="lbl-full">📋 Weekly Mgmt Callout</span>
                            <span class="lbl-short">📋 Callout</span>
                        </button>
                        <button class="btn-action btn-secondary" type="button" data-nav-view="field-ops" title="Open Field Operations">
                            <span class="lbl-full">Field Operations ➔</span>
                            <span class="lbl-short">Field Ops ➔</span>
                        </button>
                        <button class="btn-action btn-secondary" type="button" data-nav-view="dbms" title="Open Operations DBMS">
                            <span class="lbl-full">Go to Operations DBMS →</span>
                            <span class="lbl-short">DBMS →</span>
                        </button>
                    </div>
                </header>

                <!-- Executive Content Body -->
                <main class="exec-content-body">
                    
                    <!-- KPI Quick Strip (7 Interactive Hero Cards) -->
                    <section class="exec-kpi-strip" aria-label="Executive KPIs">
                        <!-- 1. Active Production Ponds -->
                        <div class="exec-kpi-card" data-metric="ACTIVE_PONDS" role="button" tabindex="0" title="Click to view Active Production Ponds breakdown &amp; timeline">
                            <span class="exec-kpi-hint">↗</span>
                            <div class="exec-kpi-title">Active Production Ponds</div>
                            <div class="exec-kpi-num" id="exec-kpi-active" style="color: #059669;">137 <span class="unit">/ 216</span></div>
                            <div class="exec-kpi-sub">Culturing across 9 Modules</div>
                        </div>

                        <!-- 2. Ponds in Preparation / Idle -->
                        <div class="exec-kpi-card" data-metric="PREP_IDLE" role="button" tabindex="0" title="Click to view Turnaround &amp; Idle Ponds breakdown">
                            <span class="exec-kpi-hint">↗</span>
                            <div class="exec-kpi-title">Ponds in Preparation / Idle</div>
                            <div class="exec-kpi-num" id="exec-kpi-idle" style="color: #0284c7;">71 <span class="unit">Ponds</span></div>
                            <div class="exec-kpi-sub">Drying, liming &amp; nursery prep</div>
                        </div>

                        <!-- 3. Pathogen Biosecurity -->
                        <div class="exec-kpi-card" data-metric="BIOSECURITY" role="button" tabindex="0" title="Click to view Pathogen Biosecurity PCR Alerts &amp; timeline">
                            <span class="exec-kpi-hint">↗</span>
                            <div class="exec-kpi-title">Pathogen Biosecurity</div>
                            <div class="exec-kpi-num" id="exec-kpi-health" style="color: #d97706;">Live Monitoring</div>
                            <div class="exec-kpi-sub">Supabase Lab Telemetry Active</div>
                        </div>

                        <!-- 4. Total Harvest -->
                        <div class="exec-kpi-card" data-metric="HARVEST" role="button" tabindex="0" title="Click to view 12-Month Harvest Timeline &amp; Logs">
                            <span class="exec-kpi-hint">↗</span>
                            <div class="exec-kpi-title">Total Harvest</div>
                            <div class="exec-kpi-num" id="exec-kpi-harvest" style="color: #059669;">— <span class="unit">MT YTD</span></div>
                            <div class="exec-kpi-sub" id="exec-kpi-harvest-sub">Loading harvest ledgers...</div>
                        </div>

                        <!-- 5. Total Stocking + Fries -->
                        <div class="exec-kpi-card" data-metric="STOCKING" role="button" tabindex="0" title="Click to view 12-Month Stocking Timeline &amp; Batches">
                            <span class="exec-kpi-hint">↗</span>
                            <div class="exec-kpi-title">Total Stocking + Fries</div>
                            <div class="exec-kpi-num" id="exec-kpi-stocking" style="color: #0284c7;">— <span class="unit">M YTD</span></div>
                            <div class="exec-kpi-sub" id="exec-kpi-stocking-sub">Loading hatchery dispatches...</div>
                        </div>

                        <!-- 6. Percent of Species Composition -->
                        <div class="exec-kpi-card" data-metric="SPECIES_COMP" role="button" tabindex="0" title="Click to view Species Allocation &amp; Ponds">
                            <span class="exec-kpi-hint">↗</span>
                            <div class="exec-kpi-title">Species Composition</div>
                            <div class="exec-kpi-num" id="exec-kpi-species" style="font-size: 1.45rem;">—</div>
                            <div class="exec-kpi-bar">
                                <div class="exec-kpi-bar-van" id="exec-kpi-bar-van" style="width: 50%;"></div>
                                <div class="exec-kpi-bar-mon" id="exec-kpi-bar-mon" style="width: 50%;"></div>
                            </div>
                            <div class="exec-kpi-sub" id="exec-kpi-species-sub">Evaluating active crops...</div>
                        </div>

                        <!-- 7. Percent of DOC Composition based on Species -->
                        <div class="exec-kpi-card" data-metric="DOC_COMP" role="button" tabindex="0" title="Click to view DOC Stage Distribution &amp; Cohorts">
                            <span class="exec-kpi-hint">↗</span>
                            <div class="exec-kpi-title">DOC Composition by Species</div>
                            <div class="exec-kpi-num" id="exec-kpi-doc" style="font-size: 1.25rem;">—</div>
                            <div class="exec-kpi-sub" id="exec-kpi-doc-sub">Evaluating age cohorts...</div>
                        </div>
                    </section>

                    <!-- SECTION 1: 216-POND INTERACTIVE FARM MAP -->
                    <section class="exec-section-panel" id="exec-farm-map-section">
                        <div class="exec-section-header">
                            <div class="exec-section-title">
                                <span>🗺️ 216-Pond Farm Map</span>
                            </div>
                        </div>
                        <div class="exec-section-body" id="exec-map-container">
                            <div class="placeholder-box">
                                <div class="placeholder-icon">🗺️</div>
                                <div class="placeholder-title">216-Pond Farm Map Ready to Render (Phase 2)</div>
                                <p class="placeholder-desc">
                                    The 18-row × 12-pond grid will render here showing real-time <strong>DOC</strong>, species badge (<strong>VAN / MON</strong>), and cell color driven by laboratory PCR pathogen data (Green, Yellow, Red).
                                </p>
                            </div>
                        </div>
                    </section>

                    <!-- SECTION 2: EXECUTIVE PRODUCTION INTELLIGENCE -->
                    <section class="exec-section-panel" id="exec-production-section">
                        <div class="exec-section-header">
                            <div class="exec-section-title">
                                <span>📈 Executive Production &amp; Biomass Intelligence</span>
                            </div>
                        </div>
                        <div class="exec-section-body" id="exec-production-container">
                            <div class="placeholder-box">
                                <div class="placeholder-icon">📊</div>
                                <div class="placeholder-title">Executive Biomass &amp; Capacity Analytics (Phase 3)</div>
                                <p class="placeholder-desc">
                                    Live current crop biomass tonnage, culture stage distribution (Early, Mid, Finishing), and upcoming harvest pipeline based on active production ponds.
                                </p>
                            </div>
                        </div>
                    </section>

                    <!-- SECTION 3: BUSINESS PLAN TARGET (PLACEHOLDER AS REQUESTED) -->
                    <section class="exec-section-panel" id="exec-business-plan-section">
                        <div class="exec-section-header">
                            <div class="exec-section-title">
                                <span>🎯 Business Plan Target &amp; Trajectory</span>
                                <span style="font-size: 0.72rem; background: #fef3c7; color: #92400e; padding: 0.2rem 0.6rem; border-radius: 9999px; font-weight: 700;">Pending Business Plan Dataset</span>
                            </div>
                        </div>
                        <div class="exec-section-body">
                            <div class="placeholder-box" style="background: rgba(254, 243, 199, 0.2); border-color: rgba(245, 158, 11, 0.4);">
                                <div class="placeholder-icon">📁</div>
                                <div class="placeholder-title">Business Plan Target Dashboard Pending File</div>
                                <p class="placeholder-desc">
                                    This module is reserved for comparing actual farm biomass trajectory against the corporate business plan targets. We will activate this as soon as you find and supply the target metrics.
                                </p>
                            </div>
                        </div>
                    </section>

                </main>

            </div>
        `;
    }

    bindEvents() {
        // [data-nav-view] is handled globally by ViewRouter
        const btnCallout = this.container.querySelector("#btn-exec-mgmt-callout");
        if (btnCallout) {
            btnCallout.addEventListener("click", () => {
                ManagementCalloutModal.open({ initialModule: "ALL" });
            });
        }

        // Bind Navigation to Dedicated Executive Metric Detail Page on Hero KPI Cards
        const cards = this.container.querySelectorAll(".exec-kpi-card[data-metric]");
        cards.forEach(card => {
            const handleTrigger = () => {
                const metric = card.getAttribute("data-metric");
                if (metric) {
                    window.location.hash = `#/executive-detail?metric=${metric}`;
                }
            };

            card.addEventListener("click", handleTrigger);
            card.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleTrigger();
                }
            });
        });

        // Initialize natural touch & gesture scrolling for mobile horizontal view
        this.initMobileTouchScroll();
    }

    /**
     * Gathers unified operational data bundle for drilldown modal.
     * @returns {object}
     */
    getDataBundle() {
        return {
            activePonds: this.gridMap ? (this.gridMap.allEvaluatedPonds || []) : [],
            activeCycles: this.gridMap && this.gridMap.activeCycleMap ? Array.from(this.gridMap.activeCycleMap.values()) : [],
            dailyProgress: this.gridMap && this.gridMap.dailyProgressMap ? Array.from(this.gridMap.dailyProgressMap.values()) : [],
            issues: this.gridMap ? (this.gridMap.issues || []) : [],
            dailyHarvests: this.rawDailyHarvests || [],
            salesRecords: this.rawSalesRecords || [],
            stockingBatches: this.rawStockingBatches || [],
            operationalCycles: this.rawOperationalCycles || [],
            samplings: this.rawSamplings || []
        };
    }

    /**
     * Loads 12-month farm harvest logs and stocking batches to populate executive cards.
     */
    async loadExecutiveMetrics() {
        try {
            const [harvestRes, stockingBatches, opCycles, samplings] = await Promise.all([
                HarvestRepository.get12MonthHarvestData(12),
                PondRepository.get12MonthStockingBatches(12),
                PondRepository.get12MonthOperationalCycles(12),
                SamplingRepository.getRecentSamplings(1500)
            ]);

            this.rawDailyHarvests = harvestRes?.dailyHarvests || [];
            this.rawSalesRecords = harvestRes?.salesRecords || [];
            this.rawStockingBatches = stockingBatches || [];
            this.rawOperationalCycles = opCycles || [];
            this.rawSamplings = samplings || [];

            // 1. Update Total Harvest Card
            const harvestAgg = ExecutiveMetricsPresenter.aggregateMonthlyHarvest(this.rawDailyHarvests, this.rawSalesRecords);
            const elHarv = document.getElementById("exec-kpi-harvest");
            const elHarvSub = document.getElementById("exec-kpi-harvest-sub");
            if (elHarv) {
                elHarv.innerHTML = `${formatNumber(harvestAgg.ytdTonnage, 1)} <span class="unit">MT YTD</span>`;
            }
            if (elHarvSub) {
                const curMonthName = formatMonthLabel(harvestAgg.currentMonthKey).split(" ")[0];
                elHarvSub.textContent = `${formatNumber(harvestAgg.mtdTonnage, 1)} MT in ${curMonthName} • ${formatNumber(harvestAgg.rolling12Tonnage, 1)} MT 12M`;
            }

            // 2. Update Total Stocking Card
            const stockAgg = ExecutiveMetricsPresenter.aggregateMonthlyStocking(this.rawStockingBatches);
            const elStock = document.getElementById("exec-kpi-stocking");
            const elStockSub = document.getElementById("exec-kpi-stocking-sub");
            if (elStock) {
                elStock.innerHTML = `${formatNumber(stockAgg.ytdMillion, 2)} <span class="unit">M YTD</span>`;
            }
            if (elStockSub) {
                const curMonthName = formatMonthLabel(stockAgg.currentMonthKey).split(" ")[0];
                elStockSub.textContent = `${formatNumber(stockAgg.mtdMillion, 2)}M in ${curMonthName} • ${formatNumber(stockAgg.ytdBatches)} Batches`;
            }
        } catch (err) {
            console.warn("Could not load farm harvest/stocking metrics:", err);
        }
    }

    /**
     * Provides fluid touch, drag, and momentum scrolling when the Executive Dashboard
     * is displayed in mobile virtual landscape (270° CSS rotation).
     */
    initMobileTouchScroll() {
        const layoutEl = this.container.querySelector(".executive-view-layout");
        if (!layoutEl) return;

        let isTouching = false;
        let isDragging = false;
        let lastX = 0;
        let lastY = 0;
        let lastTime = 0;
        let velocity = 0;
        let animId = null;

        const stopInertia = () => {
            if (animId) {
                cancelAnimationFrame(animId);
                animId = null;
            }
            velocity = 0;
        };

        layoutEl.addEventListener("touchstart", (e) => {
            if (e.touches.length !== 1) return;
            if (e.target.closest("input, select, textarea, button")) return;

            stopInertia();
            isTouching = true;
            isDragging = false;
            window.__isDraggingExecMap = false;
            lastX = e.touches[0].clientX;
            lastY = e.touches[0].clientY;
            lastTime = performance.now();
        }, { passive: true });

        layoutEl.addEventListener("touchmove", (e) => {
            if (!isTouching || e.touches.length !== 1) return;

            const isPortrait = window.innerHeight > window.innerWidth && window.innerWidth <= 768;
            if (!isPortrait) {
                // In physical landscape, native browser scrolling handles touches natively
                return;
            }

            const curX = e.touches[0].clientX;
            const curY = e.touches[0].clientY;
            const curTime = performance.now();
            const dt = Math.max(curTime - lastTime, 8);

            const dx = curX - lastX;
            const dy = curY - lastY;

            // Virtual landscape (270° counter-clockwise):
            // Dragging along physical X axis maps directly to visual vertical scroll
            const deltaScroll = Math.abs(dx) >= Math.abs(dy) ? dx : -dy;

            if (!isDragging && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
                isDragging = true;
                window.__isDraggingExecMap = true;
            }

            if (isDragging && deltaScroll !== 0) {
                layoutEl.scrollTop -= deltaScroll;
                velocity = deltaScroll / dt;
            }

            lastX = curX;
            lastY = curY;
            lastTime = curTime;
        }, { passive: true });

        const endTouch = () => {
            if (!isTouching) return;
            isTouching = false;

            if (isDragging) {
                // Keep dragging flag briefly to suppress accidental tap on pond tile
                setTimeout(() => {
                    window.__isDraggingExecMap = false;
                }, 80);

                if (Math.abs(velocity) > 0.08) {
                    const runInertia = () => {
                        if (Math.abs(velocity) < 0.02) {
                            animId = null;
                            return;
                        }
                        layoutEl.scrollTop -= velocity * 16;
                        velocity *= 0.94; // friction decay
                        animId = requestAnimationFrame(runInertia);
                    };
                    animId = requestAnimationFrame(runInertia);
                }
            } else {
                window.__isDraggingExecMap = false;
            }
            isDragging = false;
        };

        layoutEl.addEventListener("touchend", endTouch, { passive: true });
        layoutEl.addEventListener("touchcancel", endTouch, { passive: true });

        // Wheel event support for desktop trackpads/mice on rotated container
        layoutEl.addEventListener("wheel", (e) => {
            const isPortrait = window.innerHeight > window.innerWidth && window.innerWidth <= 768;
            if (isPortrait) {
                const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
                if (delta) {
                    layoutEl.scrollTop += delta;
                }
            }
        }, { passive: true });
    }

    updateKPIs(cycles) {
        // PondGridMap evaluates all 216 farm grid ponds and is the authoritative source of truth.
        if (this.gridMap && this.gridMap.activeCycleMap && this.gridMap.activeCycleMap.size > 0) {
            return;
        }
        if (!cycles || cycles.length === 0) return;

        const inProd = cycles.filter(c => (c.pond_status || '').toUpperCase() === 'PRODUCTION');
        const idle = cycles.filter(c => (c.pond_status || '').toUpperCase() === 'IDLE');

        const activeEl = document.getElementById("exec-kpi-active");
        if (activeEl) {
            activeEl.innerHTML = `${inProd.length} <span style="font-size: 0.9rem; color: #64748b; font-weight: 500;">/ 216</span>`;
        }

        const idleEl = document.getElementById("exec-kpi-idle");
        if (idleEl) {
            idleEl.innerHTML = `${idle.length} <span style="font-size: 0.9rem; color: #64748b; font-weight: 500;">Ponds</span>`;
        }
    }
}
