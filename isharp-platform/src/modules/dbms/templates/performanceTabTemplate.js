/**
 * iSHARP DBMS 2.0 — Performance Tab HTML Template (Tab 6)
 * Growth Trajectory Canvas & Efficiency KPIs.
 */

export function getPerformanceTabHtml() {
    return `
    <div id="tab-performance" class="tab-pane" role="tabpanel">
        <div class="panel-layout">
            <!-- Growth Chart Canvas -->
            <div class="card panel-card" style="flex: 2;">
                <div class="card-header flex-between">
                    <div>
                        <h3>Shrimp Growth Trajectory (ABW Curve)</h3>
                        <span class="card-sub">Actual ABW vs Farm Target Strategy Curve</span>
                    </div>
                    <div class="chart-legend">
                        <span class="legend-item"><span class="legend-dot dot-actual"></span> Actual Growth</span>
                        <span class="legend-item"><span class="legend-dot dot-target"></span> Target Strategy</span>
                    </div>
                </div>
                <div class="chart-container" id="chart-growth-container">
                    <canvas id="growthChart" width="800" height="350"></canvas>
                </div>
            </div>

            <!-- Performance KPI Cards -->
            <div class="side-column" style="flex: 1;">
                <div class="card panel-card">
                    <div class="card-header">
                        <h3>Efficiency KPIs</h3>
                    </div>
                    <div class="kpi-stack">
                        <div class="kpi-card">
                            <span class="kpi-label">Average Daily Gain (ADG)</span>
                            <span id="kpi-adg" class="kpi-val font-mono">—</span>
                            <span id="kpi-adg-sub" class="kpi-sub text-success">Awaiting sampling data</span>
                        </div>
                        <div class="kpi-card">
                            <span class="kpi-label">Cumulative FCR</span>
                            <span id="kpi-fcr" class="kpi-val font-mono">—</span>
                            <span id="kpi-fcr-sub" class="kpi-sub text-success">Requires sampling & feed logs</span>
                        </div>
                        <div class="kpi-card">
                            <span class="kpi-label">Estimated Current Biomass</span>
                            <span id="kpi-biomass" class="kpi-val font-mono">—</span>
                            <span id="kpi-biomass-sub" class="kpi-sub">Pending biometrics</span>
                        </div>
                        <div class="kpi-card">
                            <span class="kpi-label">Projected Harvest DOC</span>
                            <span id="kpi-proj-doc" class="kpi-val font-mono">DOC 95</span>
                            <span id="kpi-proj-doc-sub" class="kpi-sub">Target weight: 25.0 g</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `;
}
