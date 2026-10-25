/**
 * iSHARP QA/QC Inspection Portal — 6-Section Hub Template (Clean 2-Column Grid)
 * English-Only, Zero-Clutter Mobile Launcher
 */

export function renderQaqcHub() {
    return `
        <div class="qaqc-hub-wrapper">
            <!-- Sleek Compact Header -->
            <div class="qaqc-hub-topbar">
                <div>
                    <h1 class="qaqc-topbar-title">QA/QC Field Inspections</h1>
                    <span class="qaqc-topbar-farm">Setiu Shrimp Farm</span>
                </div>
                <button type="button" class="btn-qaqc-portal-pill" data-nav-view="portal" aria-label="Return to Portal">
                    &larr; Portal
                </button>
            </div>

            <!-- Clean 2-Column Grid (Fits Mobile Screen) -->
            <div class="qaqc-grid-clean">
                
                <!-- 1. Pond Cleaning (Active) -->
                <div class="qaqc-tile qaqc-tile-active" id="btn-qaqc-sec-cleaning" role="button" tabindex="0">
                    <div class="qaqc-tile-top">
                        <div class="qaqc-tile-icon orb-cleaning">🧹</div>
                        <span class="qaqc-badge-active">Active</span>
                    </div>
                    <h2 class="qaqc-tile-title">1. Pond Cleaning</h2>
                    <div class="qaqc-tile-footer">
                        <span class="btn-tile-open">Open &rarr;</span>
                    </div>
                </div>

                <!-- 2. Stocking Readiness -->
                <div class="qaqc-tile qaqc-tile-queued" id="btn-qaqc-sec-readiness" role="button" tabindex="0">
                    <div class="qaqc-tile-top">
                        <div class="qaqc-tile-icon qaqc-bento-icon-queued">💧</div>
                        <span class="qaqc-badge-upcoming">Upcoming</span>
                    </div>
                    <h2 class="qaqc-tile-title">2. Stocking Readiness</h2>
                </div>

                <!-- 3. Stocking Event -->
                <div class="qaqc-tile qaqc-tile-queued" id="btn-qaqc-sec-stocking" role="button" tabindex="0">
                    <div class="qaqc-tile-top">
                        <div class="qaqc-tile-icon qaqc-bento-icon-queued">🦐</div>
                        <span class="qaqc-badge-upcoming">Upcoming</span>
                    </div>
                    <h2 class="qaqc-tile-title">3. Stocking Event</h2>
                </div>

                <!-- 4. Mortality Report -->
                <div class="qaqc-tile qaqc-tile-queued" id="btn-qaqc-sec-mortality" role="button" tabindex="0">
                    <div class="qaqc-tile-top">
                        <div class="qaqc-tile-icon qaqc-bento-icon-queued">⚠️</div>
                        <span class="qaqc-badge-upcoming">Upcoming</span>
                    </div>
                    <h2 class="qaqc-tile-title">4. Mortality Report</h2>
                </div>

                <!-- 5. Pre-Harvest -->
                <div class="qaqc-tile qaqc-tile-queued" id="btn-qaqc-sec-preharvest" role="button" tabindex="0">
                    <div class="qaqc-tile-top">
                        <div class="qaqc-tile-icon qaqc-bento-icon-queued">⚖️</div>
                        <span class="qaqc-badge-upcoming">Upcoming</span>
                    </div>
                    <h2 class="qaqc-tile-title">5. Pre-Harvest</h2>
                </div>

                <!-- 6. Post-Harvest -->
                <div class="qaqc-tile qaqc-tile-queued" id="btn-qaqc-sec-postharvest" role="button" tabindex="0">
                    <div class="qaqc-tile-top">
                        <div class="qaqc-tile-icon qaqc-bento-icon-queued">🏁</div>
                        <span class="qaqc-badge-upcoming">Upcoming</span>
                    </div>
                    <h2 class="qaqc-tile-title">6. Post-Harvest</h2>
                </div>

            </div>
        </div>
    `;
}
