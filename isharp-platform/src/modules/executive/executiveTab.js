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
        this.rawDailyProgress = [];
        this.isMobilePortraitMode = false;

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
                        <button class="btn-action btn-secondary btn-exec-rotate-view" id="btn-exec-rotate-view" type="button" aria-pressed="false" title="Switch to Portrait View">
                            <span class="rotate-icon">📱</span>
                            <span class="rotate-label">Portrait</span>
                        </button>
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
                    
                    <!-- KPI Quick Strip (8 Interactive Hero Cards) -->
                    <section class="exec-kpi-strip" aria-label="Executive KPIs">
                        <!-- 1. Active Production Ponds -->
                        <div class="exec-kpi-card" data-metric="ACTIVE_PONDS" role="button" tabindex="0" title="Click to view Active Production Ponds breakdown &amp; timeline">
                            <span class="exec-kpi-hint">↗</span>
                            <div class="exec-kpi-title">Active Production Ponds</div>
                            <div class="exec-kpi-num" id="exec-kpi-active" style="color: #059669;">122 <span class="unit">/ 216</span></div>
                            <div class="exec-kpi-sub">Culturing across 9 Modules</div>
                        </div>

                        <!-- 2. Ponds in Prep & Empty -->
                        <div class="exec-kpi-card" data-metric="PREP_IDLE" role="button" tabindex="0" title="Click to view Preparation &amp; Empty Ponds breakdown">
                            <span class="exec-kpi-hint">↗</span>
                            <div class="exec-kpi-title">Ponds in Prep &amp; Empty</div>
                            <div class="exec-kpi-num" id="exec-kpi-idle" style="color: #0284c7;">94 <span class="unit">Ponds</span></div>
                            <div class="exec-kpi-sub">38 in preparation (5 ready) • 56 empty</div>
                        </div>

                        <!-- 3. Shrimp Growth & Survival -->
                        <div class="exec-kpi-card" data-metric="BIOSECURITY" role="button" tabindex="0" title="Click to view Shrimp Health, Growth &amp; Survival performance">
                            <span class="exec-kpi-hint">↗</span>
                            <div class="exec-kpi-title">Shrimp Growth &amp; Survival</div>
                            <div class="exec-kpi-num" id="exec-kpi-health" style="color: #059669;">—</div>
                            <div class="exec-kpi-sub" id="exec-kpi-health-sub">Evaluating active crops...</div>
                        </div>

                        <!-- 4. Total Harvest (This Year) -->
                        <div class="exec-kpi-card" data-metric="HARVEST" role="button" tabindex="0" title="Click to view 2026 Harvest Output &amp; Logs">
                            <span class="exec-kpi-hint">↗</span>
                            <div class="exec-kpi-title">Total Harvest (This Year)</div>
                            <div class="exec-kpi-num" id="exec-kpi-harvest" style="color: #059669;">— <span class="unit">MT</span></div>
                            <div class="exec-kpi-sub" id="exec-kpi-harvest-sub">Loading harvest ledgers...</div>
                        </div>

                        <!-- 5. Total Stocking (This Year) -->
                        <div class="exec-kpi-card" data-metric="STOCKING" role="button" tabindex="0" title="Click to view 2026 Stocking Batches &amp; Volume">
                            <span class="exec-kpi-hint">↗</span>
                            <div class="exec-kpi-title">Total Stocking (This Year)</div>
                            <div class="exec-kpi-num" id="exec-kpi-stocking" style="color: #0284c7;">— <span class="unit">M Fry</span></div>
                            <div class="exec-kpi-sub" id="exec-kpi-stocking-sub">Loading stocking batches...</div>
                        </div>

                        <!-- 6. Species & Hatchery Breakdown -->
                        <div class="exec-kpi-card" data-metric="SPECIES_COMP" role="button" tabindex="0" title="Click to view Hatchery Portfolio, Species Allocation &amp; Genetics">
                            <span class="exec-kpi-hint">↗</span>
                            <div class="exec-kpi-title">Species &amp; Hatchery Breakdown</div>
                            <div class="exec-kpi-num" id="exec-kpi-species" style="font-size: 1.45rem;">—</div>
                            <div class="exec-kpi-bar">
                                <div class="exec-kpi-bar-van" id="exec-kpi-bar-van" style="width: 50%;"></div>
                                <div class="exec-kpi-bar-mon" id="exec-kpi-bar-mon" style="width: 50%;"></div>
                            </div>
                            <div class="exec-kpi-sub" id="exec-kpi-species-sub">Evaluating active crops...</div>
                        </div>

                        <!-- 7. Shrimp Age & Culture Stages -->
                        <div class="exec-kpi-card" data-metric="DOC_COMP" role="button" tabindex="0" title="Click to view Age Distribution &amp; Culture Stages">
                            <span class="exec-kpi-hint">↗</span>
                            <div class="exec-kpi-title">Shrimp Age &amp; Culture Stages</div>
                            <div class="exec-kpi-num" id="exec-kpi-doc" style="font-size: 1.15rem; letter-spacing: -0.02em; white-space: nowrap;">—</div>
                            <div class="exec-kpi-stage-bar" id="exec-kpi-bar-stage">
                                <div class="exec-kpi-bar-early" id="exec-kpi-bar-early" style="width: 25%;" title="Early Stage"></div>
                                <div class="exec-kpi-bar-mid" id="exec-kpi-bar-mid" style="width: 50%;" title="Mid Growout"></div>
                                <div class="exec-kpi-bar-fin" id="exec-kpi-bar-fin" style="width: 25%;" title="Finishing Stage"></div>
                            </div>
                        </div>

                        <!-- 8. Pond Equipment & Assets (Placeholder) -->
                        <div class="exec-kpi-card" data-metric="EQUIPMENT_INVENTORY" role="button" tabindex="0" title="Click to view Pond Equipment &amp; Inventory (In Development)">
                            <span class="exec-kpi-hint">⚙️</span>
                            <div class="exec-kpi-title">Pond Equipment &amp; Assets</div>
                            <div class="exec-kpi-num" id="exec-kpi-inventory" style="font-size: 1.22rem; color: #475569; display: flex; align-items: center; justify-content: space-between;">
                                <span>Equipment Tracker</span>
                                <span class="drilldown-badge" style="background: #f1f5f9; color: #64748b; font-size: 0.65rem; padding: 0.15rem 0.45rem; border-radius: 4px; font-weight: 700;">Coming Soon</span>
                            </div>
                            <div class="exec-kpi-sub" id="exec-kpi-inventory-sub">Paddlewheels, pond huts, auto-feeders &amp; feed trays</div>
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
                    <section class="exec-section-panel exec-section-collapsible is-collapsed" id="exec-production-section">
                        <div class="exec-section-header exec-collapsible-header" id="header-exec-production" role="button" tabindex="0" aria-expanded="false" aria-controls="exec-production-container" title="Click to expand/collapse Executive Production &amp; Biomass Intelligence">
                            <div class="exec-section-title">
                                <span class="exec-collapse-chevron" aria-hidden="true">▶</span>
                                <span>📈 Executive Production &amp; Biomass Intelligence</span>
                                <span class="exec-collapse-badge">12M Ledger &amp; Harvest Pipeline</span>
                            </div>
                            <div class="exec-section-actions">
                                <button type="button" class="btn-section-toggle" id="btn-toggle-exec-production" aria-hidden="true" tabindex="-1">
                                    <span class="toggle-text">Expand</span>
                                    <span class="toggle-arrow">▾</span>
                                </button>
                            </div>
                        </div>
                        <div class="exec-section-body exec-collapsible-body" id="exec-production-container">
                            <div class="placeholder-box">
                                <div class="placeholder-icon">📊</div>
                                <div class="placeholder-title">Executive Biomass &amp; Capacity Analytics (Phase 3)</div>
                                <p class="placeholder-desc">
                                    Live current crop biomass tonnage, culture stage distribution (Early, Mid, Finishing), and upcoming harvest pipeline based on active production ponds.
                                </p>
                            </div>
                        </div>
                    </section>

                    <!-- SECTION 3: HATCHERY REALIZED HARVEST PERFORMANCE -->
                    <section class="exec-section-panel exec-section-collapsible is-collapsed" id="exec-hatchery-perf-section">
                        <div class="exec-section-header exec-collapsible-header" id="header-exec-hatchery" role="button" tabindex="0" aria-expanded="false" aria-controls="exec-hatchery-perf-container" title="Click to expand/collapse Hatchery Harvest Performance">
                            <div class="exec-section-title">
                                <span class="exec-collapse-chevron" aria-hidden="true">▶</span>
                                <span>🧬 2026 Realized Harvest Performance by Hatchery</span>
                                <span style="font-size: 0.72rem; background: #e0f2fe; color: #0369a1; padding: 0.2rem 0.6rem; border-radius: 9999px; font-weight: 700;">Final SR % &amp; ADG • Min / Avg / Max</span>
                            </div>
                            <div class="exec-section-actions">
                                <a href="#/executive-detail?metric=SPECIES_COMP" class="btn-action btn-secondary" style="font-size: 0.76rem; padding: 0.35rem 0.75rem; text-decoration: none; display: inline-flex; align-items: center; gap: 0.35rem;" title="Explore Hatchery Allocations, Genetic Lines &amp; Module Zoning" id="link-hatchery-portfolio">
                                    <span>Hatchery &amp; Species Portfolio</span>
                                    <span>➔</span>
                                </a>
                                <button type="button" class="btn-section-toggle" id="btn-toggle-exec-hatchery" aria-hidden="true" tabindex="-1">
                                    <span class="toggle-text">Expand</span>
                                    <span class="toggle-arrow">▾</span>
                                </button>
                            </div>
                        </div>
                        <div class="exec-section-body exec-collapsible-body" id="exec-hatchery-perf-container">
                            <div class="sleek-card" style="padding: 2rem; text-align: center; color: #64748b;">
                                <div class="spinner-sm" style="margin: 0 auto 0.75rem auto;"></div>
                                <div style="font-weight: 600; font-size: 0.88rem; color: #0f172a;">Analyzing 2026 Completed Pond Harvests by Hatchery...</div>
                                <div style="font-size: 0.75rem; color: #94a3b8; margin-top: 0.25rem;">Correlating historical stocking batches with final harvested biomass, SR % and ADG</div>
                            </div>
                        </div>
                    </section>

                    <!-- SECTION 4: BUSINESS PLAN TARGET (PLACEHOLDER AS REQUESTED) -->
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
        const btnRotate = this.container.querySelector("#btn-exec-rotate-view");
        if (btnRotate) {
            btnRotate.addEventListener("click", () => {
                this.toggleMobileOrientation();
            });
        }

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
                if (metric === "EQUIPMENT_INVENTORY") {
                    this.showEquipmentInventoryNotice();
                    return;
                }
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

        // Collapsible Sections (Executive Production & Hatchery Harvest Performance)
        this.initCollapsibleSections();
    }

    /**
     * Initializes interactive collapsible behaviour for secondary executive panels.
     * Panels default to collapsed to prevent visual clutter and scroll fatigue.
     */
    initCollapsibleSections() {
        const sections = [
            {
                sectionId: "exec-production-section",
                headerId: "header-exec-production",
                toggleBtnId: "btn-toggle-exec-production",
                onExpand: () => {
                    if (this.biomassView && typeof this.biomassView.drawMinimalistChart === "function") {
                        // Canvas needs redrawing after container becomes visible
                        requestAnimationFrame(() => this.biomassView.drawMinimalistChart());
                    }
                }
            },
            {
                sectionId: "exec-hatchery-perf-section",
                headerId: "header-exec-hatchery",
                toggleBtnId: "btn-toggle-exec-hatchery"
            }
        ];

        sections.forEach(({ sectionId, headerId, toggleBtnId, onExpand }) => {
            const sectionEl = this.container.querySelector(`#${sectionId}`);
            const headerEl = this.container.querySelector(`#${headerId}`);
            const toggleBtn = this.container.querySelector(`#${toggleBtnId}`);
            if (!sectionEl || !headerEl) return;

            const toggleSection = (e) => {
                // If user clicked inside an action link or button that isn't the toggle, don't collapse
                if (e && e.target && e.target.closest("a, .btn-action")) {
                    return;
                }

                const isCurrentlyCollapsed = sectionEl.classList.contains("is-collapsed");
                const nextCollapsed = !isCurrentlyCollapsed;

                sectionEl.classList.toggle("is-collapsed", nextCollapsed);
                headerEl.setAttribute("aria-expanded", String(!nextCollapsed));

                if (toggleBtn) {
                    const textEl = toggleBtn.querySelector(".toggle-text");
                    const arrowEl = toggleBtn.querySelector(".toggle-arrow");
                    if (textEl) textEl.textContent = nextCollapsed ? "Expand" : "Collapse";
                    if (arrowEl) arrowEl.textContent = nextCollapsed ? "▾" : "▴";
                }

                if (!nextCollapsed && typeof onExpand === "function") {
                    onExpand();
                }
            };

            headerEl.addEventListener("click", toggleSection);
            headerEl.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleSection(e);
                }
            });
        });

        // Isolate action link clicks from header collapse toggle
        const hatcheryLink = this.container.querySelector("#link-hatchery-portfolio");
        if (hatcheryLink) {
            hatcheryLink.addEventListener("click", (e) => {
                e.stopPropagation();
            });
        }
    }

    /**
     * Displays an informative preview modal for the upcoming Pond Equipment & Assets Inventory tracker.
     */
    showEquipmentInventoryNotice() {
        const existing = document.getElementById("inventory-placeholder-modal");
        if (existing) existing.remove();

        const modal = document.createElement("div");
        modal.id = "inventory-placeholder-modal";
        modal.className = "exec-modal-backdrop active";
        modal.setAttribute("role", "dialog");
        modal.setAttribute("aria-modal", "true");
        modal.innerHTML = `
            <div class="exec-modal-container" style="max-width: 520px; padding: 1.75rem; background: #ffffff; border-radius: 12px; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                    <div style="display: flex; align-items: center; gap: 0.65rem;">
                        <span style="font-size: 1.6rem;">⚙️</span>
                        <div>
                            <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: #0f172a;">Pond Equipment &amp; Assets</h3>
                            <div style="font-size: 0.78rem; color: #64748b; margin-top: 0.15rem;">Farm Infrastructure &amp; Machinery Inventory</div>
                        </div>
                    </div>
                    <button type="button" id="btn-close-inv-modal" aria-label="Close" style="border: none; background: none; font-size: 1.35rem; color: #94a3b8; cursor: pointer; padding: 0.2rem 0.5rem; line-height: 1;">&times;</button>
                </div>
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1.15rem; margin-bottom: 1.25rem; font-size: 0.85rem; line-height: 1.55; color: #334155;">
                    <p style="margin: 0 0 0.75rem 0; font-weight: 700; color: #0284c7;">
                        🚧 Module In Preparation
                    </p>
                    <p style="margin: 0 0 0.75rem 0;">
                        This card will track physical pond equipment and infrastructure status across all 216 ponds:
                    </p>
                    <ul style="margin: 0; padding-left: 1.25rem; color: #475569;">
                        <li><strong>Paddlewheel Aeration:</strong> Active paddlewheels &amp; HP per pond</li>
                        <li><strong>Pond Huts:</strong> Operational, maintenance, or unassigned status</li>
                        <li><strong>Feed Management:</strong> Feed trays and automated feeder counts</li>
                    </ul>
                </div>
                <div style="display: flex; justify-content: flex-end;">
                    <button type="button" class="btn-detail-refresh" id="btn-dismiss-inv-modal" style="padding: 0.5rem 1.25rem; border-radius: 6px; font-weight: 700; cursor: pointer;">Got It</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const close = () => modal.remove();
        modal.querySelector("#btn-close-inv-modal")?.addEventListener("click", close);
        modal.querySelector("#btn-dismiss-inv-modal")?.addEventListener("click", close);
        modal.addEventListener("click", (e) => {
            if (e.target === modal) close();
        });
    }

    /**
     * Gathers unified operational data bundle for drilldown modal.
     * @returns {object}
     */
    getDataBundle() {
        const gridDailyProgress = this.gridMap && this.gridMap.dailyProgressMap ? Array.from(this.gridMap.dailyProgressMap.values()) : [];
        return {
            activePonds: this.gridMap ? (this.gridMap.allEvaluatedPonds || []) : [],
            activeCycles: this.gridMap && this.gridMap.activeCycleMap ? Array.from(this.gridMap.activeCycleMap.values()) : [],
            dailyProgress: gridDailyProgress.length > 0 ? gridDailyProgress : (this.rawDailyProgress || []),
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
            const [harvestRes, stockingBatches, opCycles, samplings, dailyProgress] = await Promise.all([
                HarvestRepository.get12MonthHarvestData(12),
                PondRepository.get12MonthStockingBatches(12),
                PondRepository.get12MonthOperationalCycles(12),
                SamplingRepository.getRecentSamplings(1500),
                PondRepository.getDailyPondProgress()
            ]);

            this.rawDailyHarvests = harvestRes?.dailyHarvests || [];
            this.rawSalesRecords = harvestRes?.salesRecords || [];
            this.rawStockingBatches = stockingBatches || [];
            this.rawOperationalCycles = opCycles || [];
            this.rawSamplings = samplings || [];
            this.rawDailyProgress = dailyProgress || [];

            // 1. Update Total Harvest Card (Biomass MT + Harvested Ponds for YTD & MTD)
            const harvestAgg = ExecutiveMetricsPresenter.aggregateMonthlyHarvest(
                this.rawDailyHarvests,
                this.rawSalesRecords,
                new Date(),
                this.rawDailyProgress,
                this.rawOperationalCycles
            );
            const elHarv = document.getElementById("exec-kpi-harvest");
            const elHarvSub = document.getElementById("exec-kpi-harvest-sub");
            if (elHarv) {
                elHarv.innerHTML = `${formatNumber(harvestAgg.ytdTonnage, 1)} <span class="unit">Tonnes</span> <span class="unit" style="opacity:0.65;">•</span> ${formatNumber(harvestAgg.ytdPonds)} <span class="unit">Ponds</span>`;
            }
            if (elHarvSub) {
                const curMonthName = formatMonthLabel(harvestAgg.currentMonthKey).split(" ")[0];
                const pendingNote = harvestAgg.mtdPendingPonds > 0 ? ` incl. ${harvestAgg.mtdPendingPonds} mid-week` : "";
                elHarvSub.textContent = `This month (${curMonthName}): ${formatNumber(harvestAgg.mtdTonnage, 1)} T (${formatNumber(harvestAgg.mtdPonds)} ponds${pendingNote}) • VAN ${formatNumber(harvestAgg.ytdVanTonnage, 1)} T / MON ${formatNumber(harvestAgg.ytdMonTonnage, 1)} T`;
            }

            // 2. Update Total Stocking Card (Fry Volume M + Stocked Ponds for YTD & MTD)
            const stockAgg = ExecutiveMetricsPresenter.aggregateMonthlyStocking(
                this.rawStockingBatches,
                new Date(),
                this.rawDailyProgress,
                this.rawOperationalCycles
            );
            const elStock = document.getElementById("exec-kpi-stocking");
            const elStockSub = document.getElementById("exec-kpi-stocking-sub");
            if (elStock) {
                elStock.innerHTML = `${formatNumber(stockAgg.ytdMillion, 2)} <span class="unit">M Fry</span> <span class="unit" style="opacity:0.65;">•</span> ${formatNumber(stockAgg.ytdPonds)} <span class="unit">Ponds</span>`;
            }
            if (elStockSub) {
                const curMonthName = formatMonthLabel(stockAgg.currentMonthKey).split(" ")[0];
                const pendingNote = stockAgg.mtdPendingPonds > 0 ? ` incl. ${stockAgg.mtdPendingPonds} mid-week` : "";
                elStockSub.textContent = `This month (${curMonthName}): ${formatNumber(stockAgg.mtdMillion, 2)}M (${formatNumber(stockAgg.mtdPonds)} ponds${pendingNote}) • VAN ${formatNumber(stockAgg.ytdVanMillion, 2)}M / MON ${formatNumber(stockAgg.ytdMonMillion, 2)}M`;
            }

            // 3. Render 2026 Realized Harvest Performance by Hatchery (Final SR % & ADG)
            const spIntel = ExecutiveMetricsPresenter.aggregateSpeciesAndHatcheryIntelligence(
                this.getDataBundle(),
                { scope: "YTD", chartMode: "PONDS" }
            );

            const hatcheryPerfContainer = document.getElementById("exec-hatchery-perf-container");
            if (hatcheryPerfContainer) {
                hatcheryPerfContainer.innerHTML = ExecutiveMetricsPresenter.renderHatcheryHarvestPerformanceGrid(spIntel, { isDashboard: true });
            }

            // 4. Enrich Hatchery & Species Intelligence Hero Card Subtitle
            const elSpeciesSub = document.getElementById("exec-kpi-species-sub");
            if (elSpeciesSub && spIntel) {
                const totalHatcheries = (spIntel.vanHatcheries || []).length + (spIntel.monHatcheries || []).length;
                const topVanH = spIntel.fullYtdStats?.topVanHatchery?.source || "";
                const topMonH = spIntel.fullYtdStats?.topMonHatchery?.source || "";
                const leadText = (topVanH && topMonH) ? ` (Lead: ${topVanH} & ${topMonH})` : "";
                const hatcherySummary = `${totalHatcheries} Hatcheries${leadText}`;
                elSpeciesSub.setAttribute("data-hatchery-text", hatcherySummary);

                const activeCulturing = (this.gridMap?.allEvaluatedPonds || []).filter(p => p.isActive || String(p.progressState || "").toUpperCase() === "CULTURE");
                const vanPonds = activeCulturing.filter(p => (p.species || "").toUpperCase() === "VAN").length;
                const monPonds = activeCulturing.filter(p => (p.species || "").toUpperCase() === "MON").length;
                const pondsDisplay = (vanPonds > 0 || monPonds > 0)
                    ? `${vanPonds} VAN • ${monPonds} MON Ponds • `
                    : "";
                elSpeciesSub.textContent = `${pondsDisplay}${hatcherySummary}`;
            }
        } catch (err) {
            console.warn("Could not load farm harvest/stocking metrics:", err);
            const hatcheryPerfContainer = document.getElementById("exec-hatchery-perf-container");
            if (hatcheryPerfContainer) {
                hatcheryPerfContainer.innerHTML = `
                    <div style="padding: 1.5rem; text-align: center; color: #94a3b8; font-size: 0.82rem;">
                        Unable to load hatchery harvest performance at this time.
                    </div>
                `;
            }
        }
    }

    /**
     * Toggles mobile view between automatic Virtual Landscape (270° rotated)
     * and upright Portrait mode.
     * @param {boolean} [forcePortrait] Optional explicit state
     */
    toggleMobileOrientation(forcePortrait) {
        if (!this.container) return;

        this.isMobilePortraitMode = typeof forcePortrait === "boolean"
            ? forcePortrait
            : !this.isMobilePortraitMode;

        this.container.classList.toggle("mobile-portrait-mode", this.isMobilePortraitMode);

        const btnRotate = this.container.querySelector("#btn-exec-rotate-view");
        if (btnRotate) {
            btnRotate.setAttribute("aria-pressed", String(this.isMobilePortraitMode));
            btnRotate.setAttribute(
                "title",
                this.isMobilePortraitMode ? "Switch to Landscape View" : "Switch to Portrait View"
            );
            const iconEl = btnRotate.querySelector(".rotate-icon");
            const labelEl = btnRotate.querySelector(".rotate-label");
            if (iconEl) iconEl.textContent = this.isMobilePortraitMode ? "🔄" : "📱";
            if (labelEl) labelEl.textContent = this.isMobilePortraitMode ? "Landscape" : "Portrait";
        }

        // Reset scroll positions cleanly on orientation switch
        const layoutEl = this.container.querySelector(".executive-view-layout");
        if (layoutEl) layoutEl.scrollTop = 0;
        if (typeof window !== "undefined" && typeof window.scrollTo === "function") {
            window.scrollTo(0, 0);
        }

        // Trigger resize so canvas charts in ExecutiveBiomassView re-measure and redraw
        if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
            requestAnimationFrame(() => {
                window.dispatchEvent(new Event("resize"));
            });
        }
    }

    /**
     * Checks whether the Executive Dashboard is currently rendered in 270° rotated
     * virtual landscape on a mobile portrait viewport.
     * @returns {boolean}
     */
    isMobileVirtualLandscape() {
        if (typeof window === "undefined") return false;
        const isPhysicalMobilePortrait = window.innerHeight > window.innerWidth && window.innerWidth <= 768;
        const isPortraitOverride = Boolean(
            this.isMobilePortraitMode ||
            (this.container && this.container.classList.contains("mobile-portrait-mode"))
        );
        return isPhysicalMobilePortrait && !isPortraitOverride;
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

            if (!this.isMobileVirtualLandscape()) {
                // In physical landscape or upright mobile portrait mode, native browser scrolling handles touches natively
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
            if (this.isMobileVirtualLandscape()) {
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
