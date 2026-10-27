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
                <!-- Row 1 / Primary: Pond Progress Filter (7 Core Lifecycle & Preparation States) -->
                <div class="farm-filter-row" style="width: 100%; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.75rem; margin-bottom: 0.65rem; padding-bottom: 0.65rem; border-bottom: 1px dashed #cbd5e1;">
                    <div class="farm-filter-group" id="filter-group-pond-progress">
                        <span class="farm-filter-label" style="color: #0f172a; font-weight: 800;">Pond Progress:</span>
                        <button type="button" class="farm-filter-btn active" data-filter-type="progress" data-filter-val="ALL">
                            All <span class="filter-count-badge" data-count-key="ALL">216</span>
                        </button>
                        <button type="button" class="farm-filter-btn" data-filter-type="progress" data-filter-val="CULTURE" style="color: #059669; font-weight: 700;">
                            🌱 Culture <span class="filter-count-badge" data-count-key="CULTURE">0</span>
                        </button>
                        <button type="button" class="farm-filter-btn" data-filter-type="progress" data-filter-val="READY" style="color: #0891b2; font-weight: 700;">
                            ✨ Ready <span class="filter-count-badge" data-count-key="READY">0</span>
                        </button>
                        <button type="button" class="farm-filter-btn" data-filter-type="progress" data-filter-val="WATER_CULTURE" style="color: #0284c7; font-weight: 700;">
                            💧 Water Culture <span class="filter-count-badge" data-count-key="WATER_CULTURE">0</span>
                        </button>
                        <button type="button" class="farm-filter-btn" data-filter-type="progress" data-filter-val="REPAIRED" style="color: #4f46e5; font-weight: 700;">
                            🔧 Repaired <span class="filter-count-badge" data-count-key="REPAIRED">0</span>
                        </button>
                        <button type="button" class="farm-filter-btn" data-filter-type="progress" data-filter-val="CLEANED" style="color: #d97706; font-weight: 700;">
                            🧹 Cleaned <span class="filter-count-badge" data-count-key="CLEANED">0</span>
                        </button>
                        <button type="button" class="farm-filter-btn" data-filter-type="progress" data-filter-val="CLEANING" style="color: #ea580c; font-weight: 700;">
                            🚜 Cleaning <span class="filter-count-badge" data-count-key="CLEANING">0</span>
                        </button>
                        <button type="button" class="farm-filter-btn" data-filter-type="progress" data-filter-val="IDLE" style="color: #64748b; font-weight: 700;">
                            ⚪ Idle <span class="filter-count-badge" data-count-key="IDLE">0</span>
                        </button>
                    </div>

                    <!-- Right Controls: Search & Refresh -->
                    <div class="farm-filter-group" style="margin-left: auto;">
                        <input type="text" id="map-pond-search" class="farm-search-input" placeholder="Search pond (e.g. 04.08.02)..." />
                        <button type="button" id="btn-map-refresh" class="farm-filter-btn" title="Refresh live farm data from Supabase Cloud">
                            <span>🔄 Refresh</span>
                        </button>
                    </div>
                </div>

                <!-- Row 2: Secondary Culture Filters (Species, Biosecurity, Culture Stage) -->
                <div class="farm-filter-row" style="width: 100%; display: flex; flex-wrap: wrap; align-items: center; gap: 1rem;">
                    <div class="farm-filter-group" id="filter-group-species">
                        <span class="farm-filter-label">Species:</span>
                        <button type="button" class="farm-filter-btn active" data-filter-type="species" data-filter-val="ALL">All</button>
                        <button type="button" class="farm-filter-btn" data-filter-type="species" data-filter-val="VAN">VAN</button>
                        <button type="button" class="farm-filter-btn" data-filter-type="species" data-filter-val="MON">MON</button>
                    </div>

                    <div class="farm-filter-group" id="filter-group-health">
                        <span class="farm-filter-label">Biosecurity:</span>
                        <button type="button" class="farm-filter-btn active" data-filter-type="health" data-filter-val="ALL">All</button>
                        <button type="button" class="farm-filter-btn" data-filter-type="health" data-filter-val="RED" style="color: #b91c1c;">🔴 Red Alert</button>
                        <button type="button" class="farm-filter-btn" data-filter-type="health" data-filter-val="YELLOW" style="color: #b45309;">🟡 Warning</button>
                        <button type="button" class="farm-filter-btn" data-filter-type="health" data-filter-val="GREEN" style="color: #15803d;">🟢 Clean</button>
                        <button type="button" class="farm-filter-btn" data-filter-type="health" data-filter-val="IDLE">⚪ Non-Culture</button>
                    </div>

                    <div class="farm-filter-group" id="filter-group-stage">
                        <span class="farm-filter-label">Culture Stage:</span>
                        <button type="button" class="farm-filter-btn active" data-filter-type="stage" data-filter-val="ALL">All</button>
                        <button type="button" class="farm-filter-btn" data-filter-type="stage" data-filter-val="EARLY">Early (&lt;30)</button>
                        <button type="button" class="farm-filter-btn" data-filter-type="stage" data-filter-val="MID">Mid (30–70)</button>
                        <button type="button" class="farm-filter-btn" data-filter-type="stage" data-filter-val="FINISHING">Finishing (&gt;70)</button>
                    </div>
                </div>
            </div>

            <!-- 216-Pond Farm Grid Container -->
            <div class="farm-grid-container" id="farm-grid-mount">
                <div style="padding: 2.5rem; text-align: center; color: #64748b;">
                    <div class="spinner-sm" style="margin: 0 auto 0.75rem auto;"></div>
                    <span>Loading live farm telemetry &amp; daily progress across all 9 modules...</span>
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
    const isNewStock = pondData.syncState === "NEWLY_STOCKED_EXCEL";
    const isMidHarvest = pondData.syncState === "HARVESTED_MIDWEEK_EXCEL";
    const syncBadgeHtml = isNewStock
        ? `<span class="pond-sync-badge sync-new" title="Newly Stocked (Daily Tracker) — Pending Friday DBMS Sync">NEW</span>`
        : isMidHarvest
            ? `<span class="pond-sync-badge sync-harvest" title="Harvested Mid-Week — Pending Friday DBMS Closeout">HV</span>`
            : "";

    return `
        <div class="pond-tile ${pondData.cssClass}" 
             data-pond="${pondData.pondCode}"
             data-index="${pondData.pondIndex || ''}"
             data-species="${pondData.speciesCode}"
             data-health="${pondData.health}"
             data-stage="${pondData.stageCode}"
             data-progress="${pondData.progressState || 'IDLE'}"
             data-sync-state="${pondData.syncState || 'SYNCED'}"
             data-doc="${pondData.doc}">
            
            <div class="pond-tile-top">
                <span class="pond-tile-id">${pStr}</span>
                <div style="display: flex; align-items: center; gap: 3px;">
                    ${syncBadgeHtml}
                    <span class="pond-badge-indicator" title="${pondData.healthDescription}"></span>
                </div>
            </div>

            <div class="pond-tile-doc" title="${pondData.healthDescription}">${pondData.docDisplay}</div>

            <div class="pond-tile-bottom">
                <span class="pond-species-badge ${pondData.speciesBadgeClass}" title="${pondData.progressLabel || pondData.speciesLabel}">${pondData.progressBadgeText || pondData.speciesLabel}</span>
            </div>
        </div>
    `;
}
