/**
 * iSHARP QA/QC Inspection Portal — 6-Section Hub Template
 */

export function renderQaqcHub() {
    return `
        <div class="qaqc-hub-container">
            <!-- Hub Header Banner -->
            <div class="qaqc-hub-banner">
                <div class="qaqc-hub-title-group">
                    <span class="qaqc-badge-pill">FIELD QA/QC & BIOSECURITY GATEWAY</span>
                    <h1 class="qaqc-hub-title">Quality Assurance & Inspection Portal</h1>
                    <p class="qaqc-hub-subtitle">
                        Standardized field inspections, automated cycle attribution, and instant WhatsApp broadcasting for Blue Archipelago Setiu Farm.
                    </p>
                </div>
            </div>

            <!-- 6-Section Card Grid -->
            <div class="qaqc-sections-grid">
                
                <!-- 1. POND CLEANING (ACTIVE & FULLY DEVELOPED) -->
                <div class="qaqc-section-card qaqc-card-active" id="btn-qaqc-sec-cleaning" role="button" tabindex="0">
                    <div class="qaqc-card-header">
                        <div class="qaqc-card-icon-orb orb-cleaning">
                            <span class="qaqc-orb-emoji">🧹</span>
                        </div>
                        <span class="qaqc-status-pill pill-active">ACTIVE FORM</span>
                    </div>
                    <div class="qaqc-card-body">
                        <h2 class="qaqc-card-title">1. Pond Cleaning</h2>
                        <p class="qaqc-card-desc">
                            Post-harvest turnaround inspection. Verifies high-pressure lining wash, central sump sludge clearance, PWA & autofeeders, and jetty cleanliness.
                        </p>
                    </div>
                    <div class="qaqc-card-footer">
                        <span class="qaqc-btn-text">Open Inspection Form &rarr;</span>
                    </div>
                </div>

                <!-- 2. POND STOCKING READINESS (UPCOMING) -->
                <div class="qaqc-section-card qaqc-card-disabled" id="btn-qaqc-sec-readiness">
                    <div class="qaqc-card-header">
                        <div class="qaqc-card-icon-orb orb-upcoming">
                            <span class="qaqc-orb-emoji">💧</span>
                        </div>
                        <span class="qaqc-status-pill pill-upcoming">SECTION 2</span>
                    </div>
                    <div class="qaqc-card-body">
                        <h2 class="qaqc-card-title">2. Pond Stocking Readiness</h2>
                        <p class="qaqc-card-desc">
                            GCS water pumping level, booster disinfection, Secchi disk transparency, chemical clearance, and pre-stocking readiness sign-off.
                        </p>
                    </div>
                    <div class="qaqc-card-footer">
                        <span class="qaqc-badge-lock">🔒 In Development</span>
                    </div>
                </div>

                <!-- 3. STOCKING EVENT INSPECTION (UPCOMING) -->
                <div class="qaqc-section-card qaqc-card-disabled" id="btn-qaqc-sec-stocking">
                    <div class="qaqc-card-header">
                        <div class="qaqc-card-icon-orb orb-upcoming">
                            <span class="qaqc-orb-emoji">🦐</span>
                        </div>
                        <span class="qaqc-status-pill pill-upcoming">SECTION 3</span>
                    </div>
                    <div class="qaqc-card-body">
                        <h2 class="qaqc-card-title">3. Stocking Event Inspection</h2>
                        <p class="qaqc-card-desc">
                            Hatchery batch provenance, multi-tank mixing warnings, Formalin stress survival %, 0 ppt test, PCR confirmation, and acclimation check.
                        </p>
                    </div>
                    <div class="qaqc-card-footer">
                        <span class="qaqc-badge-lock">🔒 In Development</span>
                    </div>
                </div>

                <!-- 4. MORTALITY REPORT (UPCOMING) -->
                <div class="qaqc-section-card qaqc-card-disabled" id="btn-qaqc-sec-mortality">
                    <div class="qaqc-card-header">
                        <div class="qaqc-card-icon-orb orb-upcoming">
                            <span class="qaqc-orb-emoji">⚠️</span>
                        </div>
                        <span class="qaqc-status-pill pill-upcoming">SECTION 4</span>
                    </div>
                    <div class="qaqc-card-body">
                        <h2 class="qaqc-card-title">4. Mortality Report</h2>
                        <p class="qaqc-card-desc">
                            Field mortality weighed in kilograms (kg), observed physical pathologies, pathogen agar plating escalation, and quarantine locks.
                        </p>
                    </div>
                    <div class="qaqc-card-footer">
                        <span class="qaqc-badge-lock">🔒 In Development</span>
                    </div>
                </div>

                <!-- 5. PRE-HARVEST INSPECTION (UPCOMING) -->
                <div class="qaqc-section-card qaqc-card-disabled" id="btn-qaqc-sec-preharvest">
                    <div class="qaqc-card-header">
                        <div class="qaqc-card-icon-orb orb-upcoming">
                            <span class="qaqc-orb-emoji">⚖️</span>
                        </div>
                        <span class="qaqc-status-pill pill-upcoming">SECTION 5</span>
                    </div>
                    <div class="qaqc-card-body">
                        <h2 class="qaqc-card-title">5. Pre-Harvest Inspection</h2>
                        <p class="qaqc-card-desc">
                            Pre-harvest net cast sampling ABW, inter-molt vs soft-shell percentage, muddy taste/odor sensory checks, and withdrawal clearance.
                        </p>
                    </div>
                    <div class="qaqc-card-footer">
                        <span class="qaqc-badge-lock">🔒 In Development</span>
                    </div>
                </div>

                <!-- 6. POST-HARVEST AUDIT (UPCOMING) -->
                <div class="qaqc-section-card qaqc-card-disabled" id="btn-qaqc-sec-postharvest">
                    <div class="qaqc-card-header">
                        <div class="qaqc-card-icon-orb orb-upcoming">
                            <span class="qaqc-orb-emoji">🏁</span>
                        </div>
                        <span class="qaqc-status-pill pill-upcoming">SECTION 6</span>
                    </div>
                    <div class="qaqc-card-body">
                        <h2 class="qaqc-card-title">6. Post-Harvest Audit</h2>
                        <p class="qaqc-card-desc">
                            Final biomass reconciliation, commercial buyer grading packout, pond bottom sludge assessment, and turnaround countdown.
                        </p>
                    </div>
                    <div class="qaqc-card-footer">
                        <span class="qaqc-badge-lock">🔒 In Development</span>
                    </div>
                </div>

            </div>
        </div>
    `;
}
