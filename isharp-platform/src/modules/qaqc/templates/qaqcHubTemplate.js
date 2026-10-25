/**
 * iSHARP QA/QC Inspection Portal — 6-Section Hub Template (Frutiger Aero Bento Layout)
 * Mobile-First, 2-Column Responsive Bento, High Sunlight Contrast & Live Telemetry
 */

export function renderQaqcHub(data = {}) {
    const candidateCount = data.candidateCount ?? "--";

    return `
        <div class="qaqc-hub-wrapper">
            
            <!-- Compact Mobile App Bar -->
            <div class="qaqc-hub-topbar">
                <div class="qaqc-topbar-left">
                    <span class="qaqc-gateway-chip">QA/QC GATEWAY</span>
                    <h1 class="qaqc-topbar-title">Field Inspections</h1>
                    <span class="qaqc-topbar-farm">Setiu Shrimp Farm &bull; Digital Standard</span>
                </div>
                <button type="button" class="btn-qaqc-portal-pill" data-nav-view="portal" aria-label="Return to Portal">
                    &larr; Portal
                </button>
            </div>

            <!-- Bento Dashboard Container -->
            <div class="qaqc-bento-dashboard">
                
                <!-- 1. HERO CARD: POND CLEANING (ACTIVE & PRIMARY) -->
                <div class="qaqc-hero-card" id="btn-qaqc-sec-cleaning" role="button" tabindex="0">
                    <div class="qaqc-hero-top">
                        <div class="qaqc-hero-icon-orb orb-cleaning">
                            <span class="qaqc-orb-emoji">🧹</span>
                        </div>
                        <div class="qaqc-hero-badge-group">
                            <span class="qaqc-phase-chip">PHASE 1 &bull; TURNAROUND</span>
                            <span class="qaqc-status-pill pill-active">🟢 ACTIVE</span>
                        </div>
                    </div>

                    <div class="qaqc-hero-content">
                        <h2 class="qaqc-hero-title">1. Pond Cleaning Inspection</h2>
                        <p class="qaqc-hero-desc">Lining, Central Sump, PWA &amp; Autofeeder, Jetty verification with 1-tap WhatsApp broadcast.</p>
                        
                        <!-- Live Telemetry Strip -->
                        <div class="qaqc-hero-metric-bar">
                            <div class="qaqc-metric-chip">
                                <span class="qaqc-metric-val" id="qaqc-stat-pond-count">${candidateCount}</span>
                                <span class="qaqc-metric-label">Ponds in Turnaround</span>
                            </div>
                            <div class="qaqc-check-pill-group">
                                <span class="qaqc-mini-tag">Lining</span>
                                <span class="qaqc-mini-tag">Sump</span>
                                <span class="qaqc-mini-tag">PWA</span>
                                <span class="qaqc-mini-tag">Jetty</span>
                            </div>
                        </div>
                    </div>

                    <div class="qaqc-hero-action">
                        <div class="btn-hero-launch">
                            <span>Buka Borang &bull; Start Inspection</span>
                            <span class="hero-arrow">&rarr;</span>
                        </div>
                    </div>
                </div>

                <!-- 2-COLUMN COMPACT BENTO GRID FOR SECTIONS 2 TO 6 -->
                <div class="qaqc-bento-grid-2col">
                    
                    <!-- 2. POND STOCKING READINESS -->
                    <div class="qaqc-bento-card qaqc-card-queued" id="btn-qaqc-sec-readiness" role="button" tabindex="0">
                        <div class="qaqc-bento-header">
                            <div class="qaqc-bento-icon orb-upcoming">💧</div>
                            <span class="qaqc-status-pill pill-upcoming">SOON</span>
                        </div>
                        <div class="qaqc-bento-body">
                            <span class="qaqc-card-phase">Phase 2 &bull; Pre-Stock</span>
                            <h3 class="qaqc-bento-title">2. Stocking Readiness</h3>
                            <p class="qaqc-bento-meta">GCS Fill, Water Culture &amp; Biosecurity</p>
                        </div>
                        <div class="qaqc-bento-footer">
                            <span class="qaqc-lock-badge">🔒 Phase 2</span>
                        </div>
                    </div>

                    <!-- 3. STOCKING EVENT INSPECTION -->
                    <div class="qaqc-bento-card qaqc-card-queued" id="btn-qaqc-sec-stocking" role="button" tabindex="0">
                        <div class="qaqc-bento-header">
                            <div class="qaqc-bento-icon orb-upcoming">🦐</div>
                            <span class="qaqc-status-pill pill-upcoming">SOON</span>
                        </div>
                        <div class="qaqc-bento-body">
                            <span class="qaqc-card-phase">Phase 3 &bull; Stocking Day</span>
                            <h3 class="qaqc-bento-title">3. Stocking Event</h3>
                            <p class="qaqc-bento-meta">Hatchery QC, Acclimation &amp; Stress Test</p>
                        </div>
                        <div class="qaqc-bento-footer">
                            <span class="qaqc-lock-badge">🔒 Phase 2</span>
                        </div>
                    </div>

                    <!-- 4. MORTALITY REPORT -->
                    <div class="qaqc-bento-card qaqc-card-queued" id="btn-qaqc-sec-mortality" role="button" tabindex="0">
                        <div class="qaqc-bento-header">
                            <div class="qaqc-bento-icon orb-upcoming">⚠️</div>
                            <span class="qaqc-status-pill pill-upcoming">SOON</span>
                        </div>
                        <div class="qaqc-bento-body">
                            <span class="qaqc-card-phase">Phase 4 &bull; Culture</span>
                            <h3 class="qaqc-bento-title">4. Mortality Report</h3>
                            <p class="qaqc-bento-meta">Daily Count, Biomass Loss &amp; Pathology</p>
                        </div>
                        <div class="qaqc-bento-footer">
                            <span class="qaqc-lock-badge">🔒 Phase 2</span>
                        </div>
                    </div>

                    <!-- 5. PRE-HARVEST INSPECTION -->
                    <div class="qaqc-bento-card qaqc-card-queued" id="btn-qaqc-sec-preharvest" role="button" tabindex="0">
                        <div class="qaqc-bento-header">
                            <div class="qaqc-bento-icon orb-upcoming">⚖️</div>
                            <span class="qaqc-status-pill pill-upcoming">SOON</span>
                        </div>
                        <div class="qaqc-bento-body">
                            <span class="qaqc-card-phase">Phase 5 &bull; Pre-Harvest</span>
                            <h3 class="qaqc-bento-title">5. Pre-Harvest</h3>
                            <p class="qaqc-bento-meta">Molt Stage, Gut Fullness &amp; Flavor QC</p>
                        </div>
                        <div class="qaqc-bento-footer">
                            <span class="qaqc-lock-badge">🔒 Phase 2</span>
                        </div>
                    </div>

                    <!-- 6. POST-HARVEST AUDIT -->
                    <div class="qaqc-bento-card qaqc-card-queued qaqc-bento-span-mobile" id="btn-qaqc-sec-postharvest" role="button" tabindex="0">
                        <div class="qaqc-bento-header">
                            <div class="qaqc-bento-icon orb-upcoming">🏁</div>
                            <span class="qaqc-status-pill pill-upcoming">SOON</span>
                        </div>
                        <div class="qaqc-bento-body">
                            <span class="qaqc-card-phase">Phase 6 &bull; Cycle Close</span>
                            <h3 class="qaqc-bento-title">6. Post-Harvest Audit</h3>
                            <p class="qaqc-bento-meta">Actual Yield Reconciliation &amp; Liner Audit</p>
                        </div>
                        <div class="qaqc-bento-footer">
                            <span class="qaqc-lock-badge">🔒 Phase 2</span>
                        </div>
                    </div>

                </div>

            </div>
        </div>
    `;
}
