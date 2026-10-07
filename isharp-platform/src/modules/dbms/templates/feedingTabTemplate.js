/**
 * iSHARP DBMS 2.0 — Feeding Tab HTML Template (Tab 4)
 * Dual Tables: Supervisor Daily Feeding Logbook & Official Cumulative SAP Feed Usage.
 */

export function getFeedingTabHtml() {
    return `
    <div id="tab-feeding" class="tab-pane" role="tabpanel">
        <!-- Table 1: Supervisor Daily Feeding Data -->
        <div class="card panel-card mb-4">
            <div class="card-header flex-between">
                <div>
                    <h3>Supervisor Daily Feeding Data</h3>
                    <span class="card-sub">Daily field feeding records entered by pond supervisors (daily_pond_records)</span>
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
                        <tr><td colspan="8" class="text-center text-muted">No daily feeding logs loaded yet. Paste from Excel or select a pond.</td></tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Table 2: Cumulative Feed Usage (SAP Ledger) -->
        <div class="card panel-card">
            <div class="card-header flex-between">
                <div>
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <h3>Cumulative Feed Usage (SAP Ledger)</h3>
                        <span id="snap-sap-total-feed" class="font-mono font-bold" style="font-size: 0.85rem; padding: 2px 8px; background: rgba(34, 197, 94, 0.1); color: #16a34a; border: 1px solid rgba(34, 197, 94, 0.25); border-radius: 4px;">0 kg</span>
                    </div>
                    <span class="card-sub">Feed consumption labeled by SAPFeedName, SapPostDate, and amount with cumulative usage (GrowoutPondFeedSAP)</span>
                </div>
            </div>
            <div class="table-responsive">
                <table class="data-table" id="table-sap-feed">
                    <thead>
                        <tr>
                            <th>Post Date</th>
                            <th>Feed Brand Name</th>
                            <th>Amount (kg)</th>
                            <th>Cumulative Feed (kg)</th>
                            <th>Order No</th>
                            <th>Movement Type</th>
                        </tr>
                    </thead>
                    <tbody id="tbody-sap-feed">
                        <tr><td colspan="6" class="text-center text-muted">Loading SAP feed usage ledger...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
    `;
}
