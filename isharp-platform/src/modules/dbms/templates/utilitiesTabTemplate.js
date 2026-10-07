/**
 * iSHARP DBMS 2.0 — Utilities Tab HTML Template (Tab 10)
 * Database Utilities, CSV Exporter, Cloud Integrity Verification, and Cache Reset.
 */

export function getUtilitiesTabHtml() {
    return `
    <div id="tab-utilities" class="tab-pane" role="tabpanel">
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
