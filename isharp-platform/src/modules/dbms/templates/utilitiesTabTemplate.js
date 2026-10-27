/**
 * iSHARP DBMS 2.0 — Utilities Tab HTML Template (Tab 10)
 * Database Utilities, CSV Exporter, Cloud Integrity Verification, and Cache Reset.
 */

export function getUtilitiesTabHtml() {
    return `
    <div id="tab-utilities" class="tab-pane" role="tabpanel">
        
        <!-- =============================================================== -->
        <!-- POND EBITDA CALCULATOR (Audited Unit-Economics Model)          -->
        <!-- =============================================================== -->
        <div class="calc-card">
            <div class="calc-header">
                <div class="calc-title">
                    <h3>💰 Pond EBITDA Calculator</h3>
                    <p class="calc-subtitle">
                        Empirically calibrated from past 12-month audited cycle financials (<code>growout_pond_finance</code>).
                        Calculates expected gross revenue, cash operating costs, and net EBITDA range across species and size bands.
                    </p>
                </div>
                <div id="calc-auth-badge" style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; font-weight: 700; background: #e0f2fe; color: #0369a1; padding: 0.4rem 0.8rem; border-radius: 6px; border: 1px solid #bae6fd;">
                    <span>🔒</span>
                    <span id="calc-auth-status-text">Audited Finance Active</span>
                </div>
            </div>

            <!-- Input Fields Grid -->
            <form id="form-ebitda-calculator" onsubmit="return false;">
                <div class="calc-grid">
                    <!-- 1. Species -->
                    <div class="calc-field">
                        <label for="calc-ebitda-species">Species</label>
                        <select id="calc-ebitda-species" class="form-select">
                            <option value="VANNAMEI" selected>L. vannamei (Whiteleg)</option>
                            <option value="MONODON">P. monodon (Black Tiger)</option>
                        </select>
                        <span class="field-hint">Root species biological profile</span>
                    </div>

                    <!-- 2. Target DOC -->
                    <div class="calc-field">
                        <label for="calc-ebitda-doc">Days of Culture (DOC)</label>
                        <input type="number" id="calc-ebitda-doc" class="form-input" value="90" min="15" max="240" step="1" required>
                        <span class="field-hint">Active pond culture duration</span>
                    </div>

                    <!-- 3. Expected Harvest (kg) -->
                    <div class="calc-field">
                        <label for="calc-ebitda-tonnage">Expected Harvest (kg)</label>
                        <input type="number" id="calc-ebitda-tonnage" class="form-input" value="3500" min="100" max="50000" step="50" required>
                        <span class="field-hint">Total crop final biomass (kg)</span>
                    </div>

                    <!-- 4. Total Feed (kg) -->
                    <div class="calc-field">
                        <label for="calc-ebitda-feed">Total Feed (kg)</label>
                        <input type="number" id="calc-ebitda-feed" class="form-input" value="5250" min="0" max="100000" step="10" required>
                        <span class="field-hint">Cumulative feed consumed</span>
                    </div>

                    <!-- 5. Harvest ABW (g) -->
                    <div class="calc-field">
                        <label for="calc-ebitda-abw">Average Body Weight (g)</label>
                        <input type="number" id="calc-ebitda-abw" class="form-input" value="16.5" min="4.0" max="70.0" step="0.1" required>
                        <span class="field-hint">Final harvest ABW per tail</span>
                    </div>

                    <!-- 6. Stocked PL (pcs, optional) -->
                    <div class="calc-field">
                        <label for="calc-ebitda-pl">Stocked PL (pcs) <span style="font-weight: 400; text-transform: none; color: #64748b;">(Optional)</span></label>
                        <input type="number" id="calc-ebitda-pl" class="form-input" placeholder="e.g. 400000" min="10000" max="2000000" step="1000">
                        <span class="field-hint">Blank = use historical fry cost/kg</span>
                    </div>
                </div>

                <div class="calc-actions">
                    <button id="btn-calc-ebitda" type="button" class="btn-primary-calc">⚡ Calculate Pond EBITDA</button>
                    <button id="btn-reset-ebitda" type="button" class="btn-action btn-secondary">🔄 Reset</button>
                    <span id="calc-loading-indicator" style="display: none; font-size: 0.85rem; color: #0284c7; font-weight: 600;">
                        ⏳ Querying audited 12-month finance ledger...
                    </span>
                </div>
            </form>

            <!-- Results Display Container -->
            <div id="calc-ebitda-results" style="display: none;">
                <!-- Populated dynamically via UtilitiesTab.renderEbitdaResults() -->
            </div>
        </div>

        <div class="card panel-card">
            <div class="card-header">
                <div>
                    <h3>📥 Data Exporter &amp; System Diagnostics</h3>
                </div>
            </div>

            <!-- Group A: Pond Operations -->
            <div style="margin-top: 1.25rem;">
                <h4 style="font-size: 0.95rem; font-weight: 700; color: #0284c7; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.5rem;">
                    <span>🚜</span> Pond Operations
                </h4>
                <div class="utilities-grid">
                    <!-- 1. Active Ponds Master List -->
                    <div class="util-box">
                        <h4>📋 Active Ponds Master List (~291 Ponds)</h4>
                        <button id="btn-export-active-ponds" class="btn-action btn-secondary">⬇ Download Master List</button>
                    </div>

                    <!-- 2. Live Operational Ponds -->
                    <div class="util-box">
                        <h4>🦐 Live Operational Ponds</h4>
                        <button id="btn-export-operational-ponds" class="btn-action btn-secondary">⬇ Download Operational Ponds</button>
                    </div>

                    <!-- 3. Harvest Data (Past 24 Months) -->
                    <div class="util-box">
                        <h4>🚜 Harvest Data (Past 24 Months)</h4>
                        <button id="btn-export-year-harvests" class="btn-action btn-secondary">⬇ Download Harvest Data</button>
                    </div>

                    <!-- 4. Stocking Data (Past 24 Months) -->
                    <div class="util-box">
                        <h4>📦 Stocking Data (Past 24 Months)</h4>
                        <button id="btn-export-year-stocking" class="btn-action btn-secondary">⬇ Download Stocking Data</button>
                    </div>
                </div>
            </div>

            <!-- Group B: Feed, Health & Turnaround -->
            <div style="margin-top: 1.75rem;">
                <h4 style="font-size: 0.95rem; font-weight: 700; color: #059669; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.5rem;">
                    <span>🌾</span> Feed, Health &amp; Maintenance
                </h4>
                <div class="utilities-grid">
                    <!-- 5. Cumulative Feed & FCR -->
                    <div class="util-box">
                        <h4>🌾 Cumulative Feed &amp; FCR Summary</h4>
                        <button id="btn-export-feed-fcr" class="btn-action btn-secondary">⬇ Download Feed &amp; FCR</button>
                    </div>

                    <!-- 6. Active Disease & PCR Register -->
                    <div class="util-box">
                        <h4>🔬 Disease &amp; PCR Data</h4>
                        <button id="btn-export-disease-register" class="btn-action btn-secondary">⬇ Download Disease Data</button>
                    </div>

                    <!-- 7. Turnaround & Idle Days -->
                    <div class="util-box">
                        <h4>⏳ Pond Turnaround &amp; Idle Days</h4>
                        <button id="btn-export-idle-analysis" class="btn-action btn-secondary">⬇ Download Turnaround Days</button>
                    </div>

                    <!-- Current Pond Biometrics CSV -->
                    <div class="util-box">
                        <h4>📄 Current Pond Biometrics</h4>
                        <button id="btn-export-cycle-csv" class="btn-action btn-secondary">⬇ Download Current Pond</button>
                    </div>
                </div>
            </div>

            <!-- Group C: Diagnostics & System Utilities -->
            <div style="margin-top: 1.75rem;">
                <h4 style="font-size: 0.95rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.5rem;">
                    <span>⚙️</span> System Diagnostics
                </h4>
                <div class="utilities-grid">
                    <div class="util-box">
                        <h4>🔄 Sync Access Archive</h4>
                        <p>Compare Supabase cloud records against legacy Microsoft Access snapshot.</p>
                        <button id="btn-verify-sync" class="btn-action btn-secondary">Verify Cloud Integrity</button>
                    </div>
                    <div class="util-box">
                        <h4>🧹 Cache &amp; State Reset</h4>
                        <p>Clear client filter state and reload active pond cache directly from Supabase.</p>
                        <button id="btn-flush-cache" class="btn-action btn-secondary">Flush Cache &amp; Reload</button>
                    </div>
                </div>
            </div>

        </div>
    </div>
    `;
}
