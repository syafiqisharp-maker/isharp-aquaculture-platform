/**
 * iSHARP DBMS 2.0 — Utilities Tab HTML Template (Tab 10)
 * Database Utilities, CSV Exporter, Cloud Integrity Verification, and Cache Reset.
 */

export function getUtilitiesTabHtml() {
    return `
    <div id="tab-utilities" class="tab-pane" role="tabpanel">
        <div class="card panel-card">
            <div class="card-header">
                <h3>Database Utilities & System Diagnostics</h3>
                <span class="card-sub">Administrative export tools, cloud integrity verification, and cache diagnostics</span>
            </div>
            <div class="utilities-grid">
                <div class="util-box">
                    <h4>📥 Export Cycle Data</h4>
                    <p>Download complete sampling, feeding, and water quality records as CSV.</p>
                    <button class="btn-action btn-secondary" onclick="app.exportCycleCsv()">Export to CSV</button>
                </div>
                <div class="util-box">
                    <h4>🔄 Sync Access Archive</h4>
                    <p>Compare Supabase cloud records against legacy Microsoft Access snapshot.</p>
                    <button class="btn-action btn-secondary" onclick="app.verifySyncStatus()">Verify Cloud Integrity</button>
                </div>
                <div class="util-box">
                    <h4>🧹 Cache &amp; State Reset</h4>
                    <p>Clear client filter state and reload active pond cache directly from Supabase.</p>
                    <button class="btn-action btn-secondary" onclick="window.location.reload()">Flush Cache &amp; Reload</button>
                </div>
            </div>
        </div>
    </div>
    `;
}
