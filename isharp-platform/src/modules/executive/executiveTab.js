/**
 * iSHARP DBMS 2.0 — Executive View Module
 * Executive Dashboard featuring 216-Pond Farm Map and Production Analytics.
 */

import { appState } from "../../state/appState.js";
import { PondGridMap } from "./PondGridMap.js";
import { ExecutiveBiomassView } from "./ExecutiveBiomassView.js";
import { ManagementCalloutModal } from "../../components/ManagementCalloutModal.js";
import { Toast } from "../../components/Toast.js";

export class ExecutiveView {
    constructor(containerId = "view-executive") {
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        this.render();
        this.bindEvents();

        // Initialize 216-Pond Interactive Farm Grid Map
        this.gridMap = new PondGridMap("exec-map-container");

        // Initialize Executive Production & Biomass Intelligence
        this.biomassView = new ExecutiveBiomassView("exec-production-container", this.gridMap);

        // Listen for cycles change to update KPI strip
        appState.subscribe("cyclesLoaded", (cycles) => this.updateKPIs(cycles));
    }


    render() {
        this.container.innerHTML = `
            <div class="executive-view-layout">
                
                <!-- Floating 180° Orientation Flip Button for Mobile -->
                <button class="btn-exec-flip" id="btn-exec-flip-orientation" type="button" aria-label="Flip landscape 180 degrees" title="Flip landscape view 180°">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
                    </svg>
                    <span>Flip 180°</span>
                </button>

                <!-- Executive Header Bar -->
                <header class="exec-header">
                    <div class="exec-header-left">
                        <button class="btn-portal-back" type="button" data-nav-view="portal" title="Return to Portal Landing Page">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="19" y1="12" x2="5" y2="12"></line>
                                <polyline points="12 19 5 12 12 5"></polyline>
                            </svg>
                            <span>Back to Portal</span>
                        </button>
                        
                        <div>
                            <div class="exec-header-title">Executive &amp; Biosecurity Dashboard</div>
                            <div class="exec-header-sub">Blue Archipelago Berhad • Setiu Farm (216 Commercial Ponds)</div>
                        </div>
                    </div>

                    <div class="exec-header-right" style="display: flex; gap: 0.6rem;">
                        <button class="btn-action btn-secondary" id="btn-exec-mgmt-callout" type="button" style="font-weight: 700; font-size: 0.82rem; padding: 0.45rem 1rem; border-color: #38bdf8; color: #0284c7;" title="Open Weekly Management Info Audit & WhatsApp Callout">
                            <span>📋 Weekly Mgmt Callout</span>
                        </button>
                        <button class="btn-action btn-secondary" type="button" data-nav-view="field-ops" style="font-weight: 700; font-size: 0.82rem; padding: 0.45rem 1rem;">
                            <span>Field Operations ➔</span>
                        </button>
                        <button class="btn-action btn-secondary" type="button" data-nav-view="dbms" style="font-weight: 700; font-size: 0.82rem; padding: 0.45rem 1rem;">
                            <span>Go to Operations DBMS →</span>
                        </button>
                    </div>
                </header>

                <!-- Executive Content Body -->
                <main class="exec-content-body">
                    
                    <!-- KPI Quick Strip -->
                    <section class="exec-kpi-strip" aria-label="Executive KPIs">
                        <div class="exec-kpi-card">
                            <div class="exec-kpi-title">Active Production Ponds</div>
                            <div class="exec-kpi-num" id="exec-kpi-active" style="color: #059669;">137 <span style="font-size: 0.9rem; color: #64748b; font-weight: 500;">/ 216</span></div>
                            <div class="exec-kpi-sub">Culturing across 9 Modules</div>
                        </div>

                        <div class="exec-kpi-card">
                            <div class="exec-kpi-title">Ponds in Preparation / Idle</div>
                            <div class="exec-kpi-num" id="exec-kpi-idle" style="color: #0284c7;">71 <span style="font-size: 0.9rem; color: #64748b; font-weight: 500;">Ponds</span></div>
                            <div class="exec-kpi-sub">Drying, liming &amp; nursery prep</div>
                        </div>

                        <div class="exec-kpi-card">
                            <div class="exec-kpi-title">Species Under Culture</div>
                            <div class="exec-kpi-num" style="color: #0e7490; font-size: 1.35rem;">VAN &amp; MON</div>
                            <div class="exec-kpi-sub">P. vannamei &amp; P. monodon</div>
                        </div>

                        <div class="exec-kpi-card">
                            <div class="exec-kpi-title">Pathogen Biosecurity</div>
                            <div class="exec-kpi-num" id="exec-kpi-health" style="color: #d97706;">Live Monitoring</div>
                            <div class="exec-kpi-sub">Supabase Lab Telemetry Active</div>
                        </div>

                        <div class="exec-kpi-card" id="card-exec-kpi-mgmt" style="cursor: pointer;" title="Click to view weekly management info compliance">
                            <div class="exec-kpi-title" style="display: flex; justify-content: space-between; align-items: center;">
                                <span>Management Info</span>
                                <span style="font-size: 0.68rem; background: #e0f2fe; color: #0369a1; padding: 0.1rem 0.4rem; border-radius: 4px; font-weight: 700;">Audit</span>
                            </div>
                            <div class="exec-kpi-num" id="exec-kpi-mgmt" style="color: #0284c7; font-size: 1.35rem;">Audit Callout</div>
                            <div class="exec-kpi-sub">Staff, Aerators &amp; Inventory</div>
                        </div>
                    </section>

                    <!-- SECTION 1: 216-POND INTERACTIVE FARM MAP -->
                    <section class="exec-section-panel" id="exec-farm-map-section">
                        <div class="exec-section-header">
                            <div class="exec-section-title">
                                <span>🗺️ 216-Pond Farm Biosecurity Map</span>
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
        const btnFlip = this.container.querySelector("#btn-exec-flip-orientation");
        if (btnFlip) {
            btnFlip.addEventListener("click", () => {
                this.container.classList.toggle("exec-flipped");
                const isFlipped = this.container.classList.contains("exec-flipped");
                Toast.info(isFlipped ? "Flipped view 180°" : "Reset orientation view");
            });
        }

        const btnCallout = this.container.querySelector("#btn-exec-mgmt-callout");
        if (btnCallout) {
            btnCallout.addEventListener("click", () => {
                ManagementCalloutModal.open({ initialModule: "ALL" });
            });
        }

        const cardMgmt = this.container.querySelector("#card-exec-kpi-mgmt");
        if (cardMgmt) {
            cardMgmt.addEventListener("click", () => {
                ManagementCalloutModal.open({ initialModule: "ALL" });
            });
        }

        // Initialize natural touch & gesture scrolling for mobile horizontal view
        this.initMobileTouchScroll();
    }

    /**
     * Provides fluid touch, drag, and momentum scrolling when the Executive Dashboard
     * is displayed in mobile virtual landscape (90° / 270° CSS rotation).
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
            const isFlipped = this.container.classList.contains("exec-flipped");

            if (!isPortrait && !isFlipped) {
                // In unrotated physical landscape, native browser scrolling handles touches natively
                return;
            }

            const curX = e.touches[0].clientX;
            const curY = e.touches[0].clientY;
            const curTime = performance.now();
            const dt = Math.max(curTime - lastTime, 8);

            const dx = curX - lastX;
            const dy = curY - lastY;

            let deltaScroll = 0;
            if (isPortrait) {
                // Virtual landscape (default 270° counter-clockwise, or 90° when flipped):
                // Dragging along physical X axis maps directly to visual vertical scroll
                if (Math.abs(dx) >= Math.abs(dy)) {
                    deltaScroll = isFlipped ? -dx : dx;
                } else {
                    deltaScroll = isFlipped ? dy : -dy;
                }
            } else if (isFlipped) {
                // Physical landscape held upside-down (180° rotation)
                deltaScroll = -dy;
            }

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
