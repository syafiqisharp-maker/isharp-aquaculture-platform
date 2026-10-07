/**
 * iSHARP DBMS 2.0 — 216-Pond Farm Grid Cell & Toolbar Template
 * HTML template generators for the 216-pond interactive matrix.
 * 
 * Clean Coding Standard: Pure template functions.
 */

/**
 * Generates the farm map toolbar and mounting layout.
 * @returns {string}
 */
export function getFarmMapShellHtml() {
    return `
        <div class="farm-map-wrapper">
            
            <!-- Filter & Control Toolbar -->
            <div class="farm-map-toolbar">
                <!-- Left: Filters -->
                <div class="farm-filter-group">
                    <span class="farm-filter-label">Species:</span>
                    <button type="button" class="farm-filter-btn active" data-filter-type="species" data-filter-val="ALL">All</button>
                    <button type="button" class="farm-filter-btn" data-filter-type="species" data-filter-val="VAN">VAN</button>
                    <button type="button" class="farm-filter-btn" data-filter-type="species" data-filter-val="MON">MON</button>
                </div>

                <div class="farm-filter-group">
                    <span class="farm-filter-label">Biosecurity:</span>
                    <button type="button" class="farm-filter-btn active" data-filter-type="health" data-filter-val="ALL">All</button>
                    <button type="button" class="farm-filter-btn" data-filter-type="health" data-filter-val="RED" style="color: #b91c1c;">🔴 Red Alert</button>
                    <button type="button" class="farm-filter-btn" data-filter-type="health" data-filter-val="YELLOW" style="color: #b45309;">🟡 Warning</button>
                    <button type="button" class="farm-filter-btn" data-filter-type="health" data-filter-val="GREEN" style="color: #15803d;">🟢 Clean</button>
                    <button type="button" class="farm-filter-btn" data-filter-type="health" data-filter-val="IDLE">⚪ Idle</button>
                </div>

                <div class="farm-filter-group">
                    <span class="farm-filter-label">Stage:</span>
                    <button type="button" class="farm-filter-btn active" data-filter-type="stage" data-filter-val="ALL">All</button>
                    <button type="button" class="farm-filter-btn" data-filter-type="stage" data-filter-val="EARLY">Early (&lt;30)</button>
                    <button type="button" class="farm-filter-btn" data-filter-type="stage" data-filter-val="MID">Mid (30–70)</button>
                    <button type="button" class="farm-filter-btn" data-filter-type="stage" data-filter-val="FINISHING">Finishing (&gt;70)</button>
                </div>

                <!-- Right: Search & Refresh -->
                <div class="farm-filter-group" style="margin-left: auto;">
                    <input type="text" id="map-pond-search" class="farm-search-input" placeholder="Search pond (e.g. 04.08.02)..." />
                    <button type="button" id="btn-map-refresh" class="farm-filter-btn" title="Refresh live farm data from Supabase">
                        <span>🔄 Refresh</span>
                    </button>
                </div>
            </div>

            <!-- 216-Pond Farm Grid Container -->
            <div class="farm-grid-container" id="farm-grid-mount">
                <div style="padding: 2.5rem; text-align: center; color: #64748b;">
                    <div class="spinner-sm" style="margin: 0 auto 0.75rem auto;"></div>
                    <span>Loading live farm telemetry across all 9 modules...</span>
                </div>
            </div>

        </div>
    `;
}

/**
 * Generates an individual pond tile HTML cell.
 * @param {object} pondData
 * @param {string} pStr
 * @returns {string}
 */
export function renderPondTileHtml(pondData, pStr) {
    return `
        <div class="pond-tile ${pondData.cssClass}" 
             data-pond="${pondData.pondCode}"
             data-index="${pondData.pondIndex}"
             data-species="${pondData.speciesCode}"
             data-health="${pondData.health}"
             data-stage="${pondData.stageCode}"
             data-doc="${pondData.doc}">
            
            <div class="pond-tile-top">
                <span class="pond-tile-id">${pStr}</span>
                <span class="pond-badge-indicator" title="${pondData.healthDescription}"></span>
            </div>

            <div class="pond-tile-doc">${pondData.docDisplay}</div>

            <div class="pond-tile-bottom">
                <span class="pond-species-badge ${pondData.speciesBadgeClass}">${pondData.speciesLabel}</span>
            </div>
        </div>
    `;
}
