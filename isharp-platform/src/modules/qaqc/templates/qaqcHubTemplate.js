/**
 * iSHARP QA/QC Inspection Portal — 6-Section Hub Template (Mobile-First)
 */

export function renderQaqcHub() {
    return `
        <div class="qaqc-hub-container">
            <!-- Compact Mobile-Friendly Header -->
            <div class="qaqc-hub-banner">
                <div class="qaqc-hub-title-group">
                    <span class="qaqc-badge-pill">QA/QC GATEWAY</span>
                    <h1 class="qaqc-hub-title">Field Inspections</h1>
                    <p class="qaqc-hub-subtitle">Setiu Shrimp Farm &bull; Digital QA/QC &amp; WhatsApp Sync</p>
                </div>
                <button type="button" class="btn-qaqc-portal-return" data-nav-view="portal">
                    &larr; Portal
                </button>
            </div>

            <!-- 6-Section Clean Card Grid -->
            <div class="qaqc-sections-grid">
                
                <!-- 1. POND CLEANING (ACTIVE) -->
                <div class="qaqc-section-card qaqc-card-active" id="btn-qaqc-sec-cleaning" role="button" tabindex="0">
                    <div class="qaqc-card-header">
                        <div class="qaqc-card-icon-orb orb-cleaning">
                            <span class="qaqc-orb-emoji">🧹</span>
                        </div>
                        <span class="qaqc-status-pill pill-active">ACTIVE</span>
                    </div>
                    <div class="qaqc-card-body">
                        <h2 class="qaqc-card-title">1. Pond Cleaning</h2>
                        <span class="qaqc-card-subtag">Lining, Sump, PWA, Jetty</span>
                    </div>
                    <div class="qaqc-card-footer">
                        <span class="qaqc-btn-text">Open Form &rarr;</span>
                    </div>
                </div>

                <!-- 2. POND STOCKING READINESS (UPCOMING) -->
                <div class="qaqc-section-card qaqc-card-disabled" id="btn-qaqc-sec-readiness">
                    <div class="qaqc-card-header">
                        <div class="qaqc-card-icon-orb orb-upcoming">
                            <span class="qaqc-orb-emoji">💧</span>
                        </div>
                        <span class="qaqc-status-pill pill-upcoming">SOON</span>
                    </div>
                    <div class="qaqc-card-body">
                        <h2 class="qaqc-card-title">2. Stocking Readiness</h2>
                        <span class="qaqc-card-subtag">GCS Fill, Water Culture</span>
                    </div>
                    <div class="qaqc-card-footer">
                        <span class="qaqc-badge-lock">🔒 Upcoming</span>
                    </div>
                </div>

                <!-- 3. STOCKING EVENT INSPECTION (UPCOMING) -->
                <div class="qaqc-section-card qaqc-card-disabled" id="btn-qaqc-sec-stocking">
                    <div class="qaqc-card-header">
                        <div class="qaqc-card-icon-orb orb-upcoming">
                            <span class="qaqc-orb-emoji">🦐</span>
                        </div>
                        <span class="qaqc-status-pill pill-upcoming">SOON</span>
                    </div>
                    <div class="qaqc-card-body">
                        <h2 class="qaqc-card-title">3. Stocking Event</h2>
                        <span class="qaqc-card-subtag">Hatchery QC, Stress Test</span>
                    </div>
                    <div class="qaqc-card-footer">
                        <span class="qaqc-badge-lock">🔒 Upcoming</span>
                    </div>
                </div>

                <!-- 4. MORTALITY REPORT (UPCOMING) -->
                <div class="qaqc-section-card qaqc-card-disabled" id="btn-qaqc-sec-mortality">
                    <div class="qaqc-card-header">
                        <div class="qaqc-card-icon-orb orb-upcoming">
                            <span class="qaqc-orb-emoji">⚠️</span>
                        </div>
                        <span class="qaqc-status-pill pill-upcoming">SOON</span>
                    </div>
                    <div class="qaqc-card-body">
                        <h2 class="qaqc-card-title">4. Mortality Report</h2>
                        <span class="qaqc-card-subtag">Daily kg, Symptoms</span>
                    </div>
                    <div class="qaqc-card-footer">
                        <span class="qaqc-badge-lock">🔒 Upcoming</span>
                    </div>
                </div>

                <!-- 5. PRE-HARVEST INSPECTION (UPCOMING) -->
                <div class="qaqc-section-card qaqc-card-disabled" id="btn-qaqc-sec-preharvest">
                    <div class="qaqc-card-header">
                        <div class="qaqc-card-icon-orb orb-upcoming">
                            <span class="qaqc-orb-emoji">⚖️</span>
                        </div>
                        <span class="qaqc-status-pill pill-upcoming">SOON</span>
                    </div>
                    <div class="qaqc-card-body">
                        <h2 class="qaqc-card-title">5. Pre-Harvest</h2>
                        <span class="qaqc-card-subtag">Molt Stage, Flavor Test</span>
                    </div>
                    <div class="qaqc-card-footer">
                        <span class="qaqc-badge-lock">🔒 Upcoming</span>
                    </div>
                </div>

                <!-- 6. POST-HARVEST AUDIT (UPCOMING) -->
                <div class="qaqc-section-card qaqc-card-disabled" id="btn-qaqc-sec-postharvest">
                    <div class="qaqc-card-header">
                        <div class="qaqc-card-icon-orb orb-upcoming">
                            <span class="qaqc-orb-emoji">🏁</span>
                        </div>
                        <span class="qaqc-status-pill pill-upcoming">SOON</span>
                    </div>
                    <div class="qaqc-card-body">
                        <h2 class="qaqc-card-title">6. Post-Harvest</h2>
                        <span class="qaqc-card-subtag">Yield Audit, Liner Check</span>
                    </div>
                    <div class="qaqc-card-footer">
                        <span class="qaqc-badge-lock">🔒 Upcoming</span>
                    </div>
                </div>

            </div>
        </div>
    `;
}
