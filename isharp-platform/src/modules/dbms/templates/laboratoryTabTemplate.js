/**
 * iSHARP DBMS 2.0 — Laboratory Tab HTML Template (Tab 2)
 * Comprehensive Water Chemistry Telemetry & Biosecurity/Disease Pathology.
 */

export function getLaboratoryTabHtml() {
    return `
    <div id="tab-laboratory" class="tab-pane" role="tabpanel">
        <!-- Section 1: Water Chemistry & Mineral Telemetry -->
        <div class="card panel-card" style="margin-bottom: 1.5rem;">
            <div class="card-header flex-between">
                <div>
                    <h3 style="display: flex; align-items: center; gap: 0.5rem;">
                        <span>🧪</span> Laboratory Water Chemistry &amp; Mineral Balance
                    </h3>
                    <span class="card-sub">Quantitative analytical testing: Salinity, Alkalinity, Nitrogen metabolites, and Ca:Mg ratios</span>
                </div>
                <div class="flex-center" style="gap: 0.5rem;">
                    <span id="badge-lab-latest-date" class="status-badge status-idle">Last Sample: —</span>
                    <span id="badge-lab-wq-count" class="status-badge status-production">0 Records</span>
                </div>
            </div>

            <!-- KPI Metric Grid -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 0.75rem; margin-bottom: 1.25rem;">
                <div class="kpi-card">
                    <span class="kpi-label">Salinity</span>
                    <span class="kpi-val" id="kpi-lab-salinity">—</span>
                    <span class="kpi-sub">Target: 15–30 ppt</span>
                </div>
                <div class="kpi-card">
                    <span class="kpi-label">Alkalinity</span>
                    <span class="kpi-val" id="kpi-lab-alkalinity">—</span>
                    <span class="kpi-sub">Target: 100–160 mg/L</span>
                </div>
                <div class="kpi-card">
                    <span class="kpi-label">Ammonia (NH₃)</span>
                    <span class="kpi-val" id="kpi-lab-ammonia">—</span>
                    <span class="kpi-sub">Safe: &le; 0.5 mg/L</span>
                </div>
                <div class="kpi-card">
                    <span class="kpi-label">Nitrite (NO₂⁻)</span>
                    <span class="kpi-val" id="kpi-lab-nitrite">—</span>
                    <span class="kpi-sub">Safe: &le; 1.0 mg/L</span>
                </div>
                <div class="kpi-card">
                    <span class="kpi-label">Calcium (Ca)</span>
                    <span class="kpi-val" id="kpi-lab-calcium">—</span>
                    <span class="kpi-sub">Target: &gt; 200 mg/L</span>
                </div>
                <div class="kpi-card">
                    <span class="kpi-label">Magnesium (Mg)</span>
                    <span class="kpi-val" id="kpi-lab-magnesium">—</span>
                    <span class="kpi-sub">Target: &gt; 600 mg/L</span>
                </div>
                <div class="kpi-card">
                    <span class="kpi-label">Ca : Mg Ratio</span>
                    <span class="kpi-val" id="kpi-lab-camg-ratio">—</span>
                    <span class="kpi-sub">Target: 1 : 2.5–3.5</span>
                </div>
                <div class="kpi-card">
                    <span class="kpi-label">Turbidity</span>
                    <span class="kpi-val" id="kpi-lab-turbidity">—</span>
                    <span class="kpi-sub">NTU</span>
                </div>
            </div>

            <!-- Historical Lab Tests Data Table -->
            <div class="table-responsive" style="max-height: 380px; overflow-y: auto;">
                <table class="data-table" id="table-lab-wq">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>DOC</th>
                            <th>Salinity (ppt)</th>
                            <th>Alkalinity (mg/L)</th>
                            <th>Ammonia (mg/L)</th>
                            <th>Nitrite (mg/L)</th>
                            <th>Calcium (mg/L)</th>
                            <th>Magnesium (mg/L)</th>
                            <th>Ca : Mg Ratio</th>
                            <th>Turbidity (NTU)</th>
                        </tr>
                    </thead>
                    <tbody id="tbody-lab-wq">
                        <tr><td colspan="10" class="text-center text-muted" style="padding: 1.5rem;">Select a pond to view laboratory water quality records.</td></tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Section 2: Biosecurity & Disease Pathology Logbook -->
        <div class="card panel-card">
            <div class="card-header flex-between">
                <div>
                    <h3 style="display: flex; align-items: center; gap: 0.5rem;">
                        <span>🔬</span> Biosecurity &amp; Disease Pathology Logbook
                    </h3>
                    <span class="card-sub">Laboratory PCR pathogen tests, microscopy findings, and quarantine flags</span>
                </div>
                <button id="btn-add-lab-record" class="btn-action btn-secondary">
                    + Add / Paste Lab Record
                </button>
            </div>
            <div class="table-responsive">
                <table class="data-table" id="table-issues">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Category</th>
                            <th>Pathogen / Status</th>
                            <th>Test Method</th>
                            <th>Flag Alert</th>
                            <th>Grade</th>
                            <th>Result / Note</th>
                            <th>Remarks</th>
                        </tr>
                    </thead>
                    <tbody id="tbody-issues">
                        <tr><td colspan="8" class="text-center text-muted" style="padding: 1.5rem;">No pathology issues recorded for this cycle (Pond is clean).</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
    `;
}
