/**
 * iSHARP DBMS 2.0 — Lifecycle Tab HTML Template (Tab 8)
 * Active Cycle Status, Rollover & Termination Triggers, Custom Cycle Registration, and Physical Pond Registry.
 */

export function getLifecycleTabHtml() {
    return `
    <div id="tab-lifecycle" class="tab-pane" role="tabpanel">
        <div class="panel-layout" style="display: flex; flex-direction: column; gap: 1.25rem;">
            
            <!-- 1. Active Cycle Status & Action Center -->
            <div class="card panel-card">
                <div class="card-header flex-between">
                    <div>
                        <h3>Pond Cycle Status & Operational Actions</h3>
                        <span class="card-sub">Current life stage, harvesting triggers, and cycle reversal</span>
                    </div>
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                        <span id="lifecycle-status-badge" class="status-badge status-production">PRODUCTION</span>
                        <span id="lifecycle-active-badge" class="status-badge status-production">ACTIVE</span>
                    </div>
                </div>

                <div class="banner-grid mb-3" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.75rem; background: rgba(240, 249, 255, 0.6); padding: 1rem; border-radius: 8px; border: 1px solid #bae6fd;">
                    <div>
                        <span style="font-size: 0.7rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Current Cycle</span>
                        <div id="lifecycle-current-index" class="font-mono font-bold" style="font-size: 1.05rem; color: #0284c7;">—</div>
                    </div>
                    <div>
                        <span style="font-size: 0.7rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Physical Pond</span>
                        <div id="lifecycle-current-pond" class="font-mono font-bold" style="font-size: 1.05rem;">—</div>
                    </div>
                    <div>
                        <span style="font-size: 0.7rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Days of Culture</span>
                        <div id="lifecycle-doc-val" class="font-mono font-bold text-success" style="font-size: 1.05rem;">—</div>
                    </div>
                    <div>
                        <span style="font-size: 0.7rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Stocking Date</span>
                        <div id="lifecycle-stock-date" class="font-mono font-semibold" style="font-size: 0.92rem;">—</div>
                    </div>
                    <div>
                        <span style="font-size: 0.7rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Harvest / Close</span>
                        <div id="lifecycle-close-date" class="font-mono font-semibold" style="font-size: 0.92rem;">—</div>
                    </div>
                    <div>
                        <span style="font-size: 0.7rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Area Size</span>
                        <div id="lifecycle-area-val" class="font-mono font-semibold" style="font-size: 0.92rem;">—</div>
                    </div>
                </div>

                <!-- Action Drawer Callout -->
                <div class="callout-card" id="lifecycle-callout-card" style="margin-top: 0.5rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;">
                    <div class="callout-content">
                        <h4 id="lifecycle-callout-title" style="margin: 0 0 0.25rem 0;">Cycle Termination & Harvesting Control</h4>
                        <p id="lifecycle-callout-desc" style="margin: 0; font-size: 0.82rem; color: var(--text-muted);">
                            Choose <strong>Terminate & Rollover</strong> to auto-spawn the next cycle in IDLE, or <strong>Terminate Only</strong> to close the pond without spawning a new cycle.
                        </p>
                    </div>
                    <div class="btn-group" style="display: flex; gap: 0.65rem; align-items: center; flex-wrap: wrap;">
                        <button id="btn-lifecycle-terminate-rollover" class="btn-action btn-danger" type="button" style="padding: 0.5rem 1.1rem; font-size: 0.84rem;">
                            🏁 Terminate & Rollover (+1 Cycle)
                        </button>
                        <button id="btn-lifecycle-terminate-only" class="btn-action btn-secondary" type="button" style="padding: 0.5rem 1rem; font-size: 0.84rem; background: #fff; border: 1px solid #cbd5e1; color: #475569; font-weight: 600;">
                            🛑 Terminate Only (No Rollover)
                        </button>
                        <button id="btn-lifecycle-revive-action" class="btn-action btn-revive-cycle" type="button" style="display: none; padding: 0.5rem 1.25rem; font-size: 0.84rem;">
                            🔄 Revive Back Cycle
                        </button>
                    </div>
                </div>
            </div>

            <!-- 2. Manual Custom Cycle Registration Form -->
            <div class="card panel-card" id="card-manual-cycle-registration">
                <div class="card-header">
                    <h3>➕ Manual Cycle Registration (Custom Pond & Cycle)</h3>
                    <span class="card-sub">Create a new production or idle cycle with customizable pond code and cycle sequence</span>
                </div>
                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1.25rem;">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem;">
                        <div class="form-group">
                            <label for="select-create-pond" style="font-weight: 700; font-size: 0.8rem; margin-bottom: 0.35rem; display: block;">Physical Pond:</label>
                            <select id="select-create-pond" class="form-control" style="background: #fff; border: 1px solid #cbd5e1; padding: 0.45rem; border-radius: 6px; width: 100%;">
                                <option value="">Loading ponds...</option>
                            </select>
                        </div>
                        <div class="form-group" id="wrap-create-custom-pond" style="display: none;">
                            <label for="input-create-custom-pond" style="font-weight: 700; font-size: 0.8rem; margin-bottom: 0.35rem; display: block;">New Pond Code (e.g. 01.01.05):</label>
                            <input type="text" id="input-create-custom-pond" class="form-control font-mono" placeholder="01.01.05" style="border: 1px solid #cbd5e1; padding: 0.45rem; border-radius: 6px; width: 100%;">
                        </div>
                        <div class="form-group">
                            <label for="input-create-cycle-no" style="font-weight: 700; font-size: 0.8rem; margin-bottom: 0.35rem; display: block;">Cycle Number:</label>
                            <input type="number" id="input-create-cycle-no" class="form-control font-mono font-bold" min="1" max="99" value="1" style="border: 1px solid #cbd5e1; padding: 0.45rem; border-radius: 6px; width: 100%;">
                            <small id="hint-create-cycle-suggestion" style="font-size: 0.72rem; color: #64748b; display: block; margin-top: 0.25rem;">Select a pond to view suggested next cycle.</small>
                        </div>
                        <div class="form-group">
                            <label for="select-create-status" style="font-weight: 700; font-size: 0.8rem; margin-bottom: 0.35rem; display: block;">Initial Cycle Status:</label>
                            <select id="select-create-status" class="form-control" style="background: #fff; border: 1px solid #cbd5e1; padding: 0.45rem; border-radius: 6px; width: 100%;">
                                <option value="IDLE" selected>IDLE (Resting / Sun Drying / Empty)</option>
                                <option value="PREPARATION">PREPARATION (Liner repair / Filling / Liming / QAQC)</option>
                                <option value="PRODUCTION">PRODUCTION (Active Shrimp Stock)</option>
                                <option value="RESERVOIR">RESERVOIR (Water Holding / Treatment)</option>
                                <option value="MAINTENANCE">MAINTENANCE (Major civil / mechanical overhaul)</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="input-create-area" style="font-weight: 700; font-size: 0.8rem; margin-bottom: 0.35rem; display: block;">Pond Area (ha):</label>
                            <input type="number" step="0.01" id="input-create-area" class="form-control font-mono" value="0.50" style="border: 1px solid #cbd5e1; padding: 0.45rem; border-radius: 6px; width: 100%;">
                        </div>
                        <div class="form-group">
                            <label for="input-create-stock-date" style="font-weight: 700; font-size: 0.8rem; margin-bottom: 0.35rem; display: block;">Target / Plan Stocking Date:</label>
                            <input type="date" id="input-create-stock-date" class="form-control font-mono" style="border: 1px solid #cbd5e1; padding: 0.45rem; border-radius: 6px; width: 100%;">
                        </div>
                    </div>
                    <div style="margin-top: 1rem; text-align: right;">
                        <button type="button" id="btn-submit-create-cycle" class="btn-action btn-save" style="font-weight: 700; padding: 0.55rem 1.4rem;">
                            🚀 Initialize &amp; Register Pond Cycle
                        </button>
                    </div>
                </div>
            </div>

            <!-- 3. Physical Pond Cycle Registry & History -->
            <div class="card panel-card">
                <div class="card-header flex-between">
                    <div>
                        <h3 id="registry-pond-title">Cycle Registry & History — Pond</h3>
                        <span class="card-sub">All historical and active cycles recorded for this physical pond asset</span>
                    </div>
                </div>
                <div class="table-responsive">
                    <table class="data-table" id="table-cycle-registry">
                        <thead>
                            <tr>
                                <th>Cycle</th>
                                <th>Pond Index</th>
                                <th>Pond Status</th>
                                <th>State</th>
                                <th>Stocking Date</th>
                                <th>Closed Date</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="tbody-cycle-registry">
                            <tr><td colspan="7" class="text-center text-muted" style="padding: 1.5rem;">Loading cycle history...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    </div>
    `;
}
