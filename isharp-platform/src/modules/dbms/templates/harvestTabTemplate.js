/**
 * iSHARP DBMS 2.0 — Harvest Tab HTML Template (Tab 7)
 * Harvest Plan, Harvest Events, Catch Biometrics, and Commercial Buyer Grading Packout.
 */

export function getHarvestTabHtml() {
    return `
    <div id="tab-harvest" class="tab-pane" role="tabpanel">
        <!-- Harvest KPI Summary Cards -->
        <div class="kpi-grid mb-3" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
            <div class="kpi-card glass-card" style="padding: 1rem; border-radius: 8px;">
                <span class="kpi-label" style="font-size: 0.76rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700;">Total Harvest Weight</span>
                <span id="stat-harvest-weight" class="font-mono font-bold text-success" style="font-size: 1.4rem; display: block; margin-top: 0.3rem;">—</span>
                <span class="kpi-sub" style="font-size: 0.72rem; color: var(--text-muted);">Cumulative partial & final</span>
            </div>
            <div class="kpi-card glass-card" style="padding: 1rem; border-radius: 8px;">
                <span class="kpi-label" style="font-size: 0.76rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700;">Net Sales Revenue</span>
                <span id="stat-harvest-revenue" class="font-mono font-bold text-success" style="font-size: 1.4rem; display: block; margin-top: 0.3rem;">—</span>
                <span class="kpi-sub" style="font-size: 0.72rem; color: var(--text-muted);">Total buyer transactions</span>
            </div>
            <div class="kpi-card glass-card" style="padding: 1rem; border-radius: 8px;">
                <span class="kpi-label" style="font-size: 0.76rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700;">Weighted Mean ABW</span>
                <span id="stat-harvest-abw" class="font-mono font-bold" style="font-size: 1.4rem; display: block; margin-top: 0.3rem; color: var(--aero-sky-600);">—</span>
                <span class="kpi-sub" style="font-size: 0.72rem; color: var(--text-muted);">Harvest size specification</span>
            </div>
        </div>

        <div class="card panel-card mb-4">
            <!-- 1. Harvest Plan (First Table in Harvest Records card) -->
            <div class="card-header flex-between">
                <div>
                    <h3>Harvest Plan</h3>
                    <span class="card-sub">Harvest planning targets, expected biomass, and planned ABW (GrowoutPondHarvestPlan)</span>
                </div>
            </div>
            <div class="table-responsive">
                <table class="data-table" id="table-harvest-plan">
                    <thead>
                        <tr>
                            <th>Planned Date</th>
                            <th>Plan Status</th>
                            <th>Expected Biomass (kg)</th>
                            <th>Expected ABW (g)</th>
                            <th>Harvest Time</th>
                            <th>Delivery Time</th>
                            <th>Team</th>
                        </tr>
                    </thead>
                    <tbody id="tbody-harvest-plan">
                        <tr><td colspan="7" class="text-center text-muted">No harvest plan scheduled yet for this cycle.</td></tr>
                    </tbody>
                </table>
            </div>

            <!-- 2. Actual Harvest Events -->
            <div class="divider mt-4"></div>
            <div class="card-header flex-between mt-3">
                <div>
                    <h4>Harvest Events (Actual)</h4>
                    <span class="card-sub">Field harvest run logs and catch biometrics (GrowoutPondHarvestDaily)</span>
                </div>
                <button class="btn-action btn-secondary" onclick="app.openExcelModal('harvest')" id="btn-add-harvest-event">
                    📋 + Add / Paste Harvest Events
                </button>
            </div>
            <div class="table-responsive">
                <table class="data-table" id="table-harvest">
                    <thead>
                        <tr>
                            <th>Harvest Date</th>
                            <th>Type</th>
                            <th>Weight (kg)</th>
                            <th>ABW (g)</th>
                            <th>Total Pieces</th>
                            <th>Method</th>
                            <th>Gross Revenue (RM)</th>
                        </tr>
                    </thead>
                    <tbody id="tbody-harvest">
                        <tr><td colspan="7" class="text-center text-muted">No harvest events recorded yet for this cycle.</td></tr>
                    </tbody>
                </table>
            </div>

            <!-- 3. Commercial Buyer Grading & Sales -->
            <div class="divider mt-4"></div>
            <div class="card-header flex-between mt-3">
                <div>
                    <h4>Commercial Buyer Grading & Sales (<code>GrowoutPondHarvestSales</code>)</h4>
                    <span class="card-sub">Buyer sales weight breakdown, grade specifications, and pricing</span>
                </div>
            </div>
            <div class="table-responsive">
                <table class="data-table" id="table-harvest-sales">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Buyer Name</th>
                            <th>ABW (g)</th>
                            <th>Good Wgt (kg)</th>
                            <th>Good Price</th>
                            <th>2nd Grade (kg)</th>
                            <th>Small (kg)</th>
                            <th>Below (kg)</th>
                            <th>Rubbish (kg)</th>
                            <th>Total Net Sales (RM)</th>
                        </tr>
                    </thead>
                    <tbody id="tbody-harvest-sales">
                        <tr><td colspan="10" class="text-center text-muted">No commercial sales grading logged for this cycle.</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
    `;
}
