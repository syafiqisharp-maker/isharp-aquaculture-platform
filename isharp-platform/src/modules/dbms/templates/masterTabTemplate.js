/**
 * iSHARP DBMS 2.0 — Master Tab HTML Template (Tab 1)
 * Bento KPI summary, Pond Preparation Milestones, and Paddlewheel Aeration Inventory.
 */

export function getMasterTabHtml() {
    return `
    <div id="tab-master" class="tab-pane active" role="tabpanel">
        
        <!-- Bento KPI Snapshots Grid (5 Cards) -->
        <div class="bento-kpi-grid">
            <div class="bento-kpi-card">
                <div class="bento-card-top">
                    <span class="bento-card-title">Species / Line</span>
                    <span class="bento-card-icon">🧬</span>
                </div>
                <div id="badge-species" class="bento-card-val" style="font-size:1.15rem; color:#0f172a;">P. VANNAMEi</div>
                <div id="badge-genetic" class="bento-card-foot">Standard Line</div>
            </div>

            <div class="bento-kpi-card">
                <div class="bento-card-top">
                    <span class="bento-card-title">Stocked Fry</span>
                    <span class="bento-card-icon">🦐</span>
                </div>
                <div id="snap-stocked-pcs" class="bento-card-val">—</div>
                <div id="snap-stocked-foot" class="bento-card-foot">Gross PL count</div>
            </div>

            <div class="bento-kpi-card">
                <div class="bento-card-top">
                    <span class="bento-card-title">Average Body Wt</span>
                    <span class="bento-card-icon">⚖️</span>
                </div>
                <div id="snap-latest-abw" class="bento-card-val">—</div>
                <div id="snap-abw-foot" class="bento-card-foot">Latest biometrics</div>
            </div>

            <div class="bento-kpi-card">
                <div class="bento-card-top">
                    <span class="bento-card-title">Cumulative Feed</span>
                    <span class="bento-card-icon">🌾</span>
                </div>
                <div id="snap-total-feed" class="bento-card-val">—</div>
                <div id="snap-feed-foot" class="bento-card-foot">Cumulative feed</div>
            </div>

            <div class="bento-kpi-card">
                <div class="bento-card-top">
                    <span class="bento-card-title">Harvest Biomass</span>
                    <span class="bento-card-icon">🚜</span>
                </div>
                <div id="snap-total-harvest" class="bento-card-val">—</div>
                <div id="snap-harvest-foot" class="bento-card-foot">Status: IN CULTURE</div>
            </div>
        </div>
        <span id="snap-cycle-status" style="display:none;">PRODUCTION</span>

        <!-- Secondary Section: Preparation Dates & Paddlewheel Aeration -->
        <div class="panel-layout master-details-layout">
            
            <!-- Left: Pond Preparation Date -->
            <div class="card panel-card pond-prep-card">
                <div class="card-header flex-between">
                    <div>
                        <h3>Pond Preparation Date</h3>
                        <span class="card-sub">Cycle preparation dates from dry-out to stocking</span>
                    </div>
                    <button id="btn-save-master" class="btn-action btn-save" title="Save Master cycle data to cloud">
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                            <polyline points="17 21 17 13 7 13 7 21"></polyline>
                            <polyline points="7 3 7 8 15 8"></polyline>
                        </svg>
                        <span>Save Changes</span>
                    </button>
                </div>
                <div class="form-grid-3">
                    <div class="form-group">
                        <label for="input-date-cycle">Cycle Start Date</label>
                        <input type="date" id="input-date-cycle" class="form-control">
                    </div>
                    <div class="form-group">
                        <label for="input-date-cleaning">Pond Cleaning Date</label>
                        <input type="date" id="input-date-cleaning" class="form-control">
                    </div>
                    <div class="form-group">
                        <label for="input-date-repair">Liner Repair Date</label>
                        <input type="date" id="input-date-repair" class="form-control">
                    </div>
                    <div class="form-group">
                        <label for="input-date-filling">Water Filling Date</label>
                        <input type="date" id="input-date-filling" class="form-control">
                    </div>
                    <div class="form-group">
                        <label for="input-date-culture">Water Culture Start</label>
                        <input type="date" id="input-date-culture" class="form-control">
                    </div>
                    <div class="form-group">
                        <label for="input-date-babybox">Baby Box Setup Date</label>
                        <input type="date" id="input-date-babybox" class="form-control">
                    </div>
                    <div class="form-group">
                        <label for="input-date-qaqc">Lab QA/QC Approval Date</label>
                        <input type="date" id="input-date-qaqc" class="form-control">
                    </div>
                    <div class="form-group">
                        <label for="input-date-ready">Pond Ready Date</label>
                        <input type="date" id="input-date-ready" class="form-control">
                    </div>
                    <div class="form-group">
                        <label for="input-date-plan-stock">Target Stocking Date</label>
                        <input type="date" id="input-date-plan-stock" class="form-control">
                    </div>
                </div>

                <div class="divider"></div>

                <!-- Idle Days & Status -->
                <div class="form-grid-3">
                    <div class="form-group">
                        <label for="input-idle-days">Idle Days (Dry Period)</label>
                        <input type="number" id="input-idle-days" class="form-control font-mono" placeholder="0">
                    </div>
                    <div class="form-group">
                        <label for="input-idle-status">Idle Status</label>
                        <select id="input-idle-status" class="form-control">
                            <option value="NORMAL">NORMAL</option>
                            <option value="EXTENDED IDLE">EXTENDED IDLE</option>
                            <option value="EARTHEN MAINTENANCE">EARTHEN MAINTENANCE</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="input-water-type">Water Type</label>
                        <select id="input-water-type" class="form-control">
                            <option value="SEA WATER">SEA WATER</option>
                            <option value="BRACKISH">BRACKISH</option>
                            <option value="RESERVOIR BLEND">RESERVOIR BLEND</option>
                        </select>
                    </div>
                </div>
            </div>

            <!-- Right: Multi-Model Aeration HP Box -->
            <div class="card panel-card paddlewheel-card highlight-border">
                <div class="card-header flex-between">
                    <div>
                        <h3>Paddlewheel Inventory (PWA)</h3>
                        <span class="card-sub">Pond paddlewheel aeration configuration</span>
                    </div>
                    <button id="btn-save-aerators" class="btn-action btn-save" title="Save Paddlewheel inventory to cloud">
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                            <polyline points="17 21 17 13 7 13 7 21"></polyline>
                            <polyline points="7 3 7 8 15 8"></polyline>
                        </svg>
                        <span>Save Changes</span>
                    </button>
                </div>
                <div class="aerator-grid">
                    <div class="aerator-row">
                        <div class="aerator-label">
                            <span class="hp-spec">1.0 HP Paddlewheels</span>
                            <small>[1 HP] Nursery / small ponds</small>
                        </div>
                        <div class="stepper-cluster aero-stepper-group">
                            <button type="button" class="btn-stepper" onclick="const i=document.getElementById('aerator-1hp-units'); i.value=Math.max(0, (+i.value||0)-1); i.dispatchEvent(new Event('input', {bubbles:true})); i.dispatchEvent(new Event('change', {bubbles:true}));" title="Decrease 1.0 HP Aerators">−</button>
                            <input type="number" id="aerator-1hp-units" class="form-control font-mono text-center" min="0" value="0">
                            <button type="button" class="btn-stepper" onclick="const i=document.getElementById('aerator-1hp-units'); i.value=(+i.value||0)+1; i.dispatchEvent(new Event('input', {bubbles:true})); i.dispatchEvent(new Event('change', {bubbles:true}));" title="Increase 1.0 HP Aerators">+</button>
                            <span class="unit-sub">units</span>
                        </div>
                    </div>
                    <div class="aerator-row">
                        <div class="aerator-label">
                            <span class="hp-spec">2.0 HP Paddlewheels</span>
                            <small>[2 HP] Standard high-flow</small>
                        </div>
                        <div class="stepper-cluster aero-stepper-group">
                            <button type="button" class="btn-stepper" onclick="const i=document.getElementById('aerator-2hp-units'); i.value=Math.max(0, (+i.value||0)-1); i.dispatchEvent(new Event('input', {bubbles:true})); i.dispatchEvent(new Event('change', {bubbles:true}));" title="Decrease 2.0 HP Aerators">−</button>
                            <input type="number" id="aerator-2hp-units" class="form-control font-mono text-center" min="0" value="0">
                            <button type="button" class="btn-stepper" onclick="const i=document.getElementById('aerator-2hp-units'); i.value=(+i.value||0)+1; i.dispatchEvent(new Event('input', {bubbles:true})); i.dispatchEvent(new Event('change', {bubbles:true}));" title="Increase 2.0 HP Aerators">+</button>
                            <span class="unit-sub">units</span>
                        </div>
                    </div>
                    <div class="aerator-row">
                        <div class="aerator-label">
                            <span class="hp-spec">4.0 HP Paddlewheels</span>
                            <small>Heavy central aerators</small>
                        </div>
                        <div class="stepper-cluster aero-stepper-group">
                            <button type="button" class="btn-stepper" onclick="const i=document.getElementById('aerator-4hp-units'); i.value=Math.max(0, (+i.value||0)-1); i.dispatchEvent(new Event('input', {bubbles:true})); i.dispatchEvent(new Event('change', {bubbles:true}));" title="Decrease 4.0 HP Aerators">−</button>
                            <input type="number" id="aerator-4hp-units" class="form-control font-mono text-center" min="0" value="0">
                            <button type="button" class="btn-stepper" onclick="const i=document.getElementById('aerator-4hp-units'); i.value=(+i.value||0)+1; i.dispatchEvent(new Event('input', {bubbles:true})); i.dispatchEvent(new Event('change', {bubbles:true}));" title="Increase 4.0 HP Aerators">+</button>
                            <span class="unit-sub">units</span>
                        </div>
                    </div>
                </div>
                <div class="aerator-card-footer">
                    <div class="hp-badge">
                        <span id="summary-total-active-hp" class="hp-number">0.0</span>
                        <span class="hp-unit">Total PWA HP</span>
                    </div>
                </div>
            </div>

        </div>
    </div>
    `;
}
