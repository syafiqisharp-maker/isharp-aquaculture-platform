/**
 * iSHARP DBMS 2.0 — Feeding Tab HTML Template (Tab 4)
 * Daily Feeding & Feed Inventory Records.
 */

export function getFeedingTabHtml() {
    return `
    <div id="tab-feeding" class="tab-pane" role="tabpanel">
        <div class="card panel-card">
            <div class="card-header flex-between">
                <div>
                    <h3>Daily Feeding & Feed Inventory Records</h3>
                    <span class="card-sub">Daily field feeding log and SAP movement ledger</span>
                </div>
                <div class="btn-group">
                    <button class="btn-action btn-secondary" onclick="app.openExcelModal('feed')">
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                            <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                        </svg>
                        <span>Paste Excel Feed Sheet</span>
                    </button>
                </div>
            </div>
            <div class="table-responsive">
                <table class="data-table" id="table-feed">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Shift</th>
                            <th>Daily Total Feed (kg)</th>
                            <th>Tray Remnant %</th>
                            <th>Water Level (cm)</th>
                            <th>Water Colour Swatch</th>
                            <th>Mortality (kg)</th>
                            <th>Remarks</th>
                        </tr>
                    </thead>
                    <tbody id="tbody-feed">
                        <tr><td colspan="8" class="text-center text-muted">No daily feeding logs loaded yet. Paste from Excel or enter records.</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
    `;
}
