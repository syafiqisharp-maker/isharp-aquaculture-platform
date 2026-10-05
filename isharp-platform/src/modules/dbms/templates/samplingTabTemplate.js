/**
 * iSHARP DBMS 2.0 — Sampling Tab HTML Template (Tab 5)
 * Weekly Biometric Sampling & WQS Telemetry Convergence.
 */

export function getSamplingTabHtml() {
    return `
    <div id="tab-sampling" class="tab-pane" role="tabpanel">
        <div class="card panel-card">
            <div class="card-header flex-between">
                <div>
                    <h3>Weekly Biometric Sampling & Telemetry Convergence</h3>
                    <span class="card-sub">Cast net growth measurements converged with 7-day WQS sensor readings</span>
                </div>
                <div class="btn-group">
                    <button class="btn-action btn-secondary" onclick="app.openExcelModal('sampling')">
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                            <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                        </svg>
                        <span>Paste Excel Sampling</span>
                    </button>
                </div>
            </div>
            <div class="table-responsive">
                <table class="data-table" id="table-sampling">
                    <thead>
                        <tr>
                            <th>Sample Date</th>
                            <th>DOC</th>
                            <th>ABW (g)</th>
                            <th>AWG (g/wk)</th>
                            <th>Survival %</th>
                            <th>Biomass (kg)</th>
                            <th>Feed Total (kg)</th>
                            <th>Avg DO (WQS)</th>
                            <th>Avg pH (WQS)</th>
                            <th>Avg Temp (WQS)</th>
                        </tr>
                    </thead>
                    <tbody id="tbody-sampling">
                        <tr><td colspan="10" class="text-center text-muted">Loading weekly sampling records...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
    `;
}
