/**
 * iSHARP DBMS 2.0 — Staff & Remarks Tab HTML Template (Tab 9)
 * Assigned Pond Personnel & Operational Logbook Remarks (Single-Column Layout).
 */

export function getStaffTabHtml() {
    return `
    <div id="tab-staff" class="tab-pane" role="tabpanel">
        <div class="panel-layout" style="display: flex; flex-direction: column; gap: 1.25rem;">
            <!-- Single Column Top: Assigned Pond Personnel -->
            <div class="card panel-card" style="width: 100%;">
                <div class="card-header flex-between" style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h3>Assigned Pond Personnel</h3>
                        <span class="card-sub">Cycle crew allocation &amp; harvest target incentive tracking</span>
                    </div>
                    <span class="badge" id="staff-cycle-badge" style="background: rgba(2, 132, 199, 0.1); color: #0284c7; border: 1px solid #bae6fd; font-size: 0.72rem; padding: 0.25rem 0.6rem; border-radius: 999px; font-weight: 700;">No Cycle Selected</span>
                </div>

                <div class="alert-info-glass" style="font-size: 0.75rem; color: #475569; background: rgba(240, 249, 255, 0.85); border: 1px solid #bae6fd; border-radius: 8px; padding: 0.5rem 0.75rem; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.4rem;">
                    <span style="font-size: 1rem;">💡</span>
                    <span>Enter the staff's <strong>Employee ID</strong> (e.g. <code>0042</code>, <code>1157</code>, <code>1216</code>). The system looks up their official name automatically.</span>
                </div>

                <!-- Staff ID Entry Grid -->
                <div class="staff-allocation-form" style="display: flex; flex-direction: column; gap: 0.6rem;">
                    
                    <!-- 1. Asst Manager (PM) -->
                    <div class="staff-entry-row" style="display: grid; grid-template-columns: 120px 105px 1fr; gap: 0.5rem; align-items: center;">
                        <label style="font-size: 0.75rem; font-weight: 700; color: #334155; margin: 0;">👔 Asst Manager</label>
                        <input type="text" id="input-pm-id" list="staff-directory-datalist" class="form-control" placeholder="ID (e.g. 0042)" style="font-size: 0.8rem; font-weight: 700; text-align: center; letter-spacing: 0.05em;">
                        <input type="text" id="input-pm-name" class="form-control" placeholder="Asst Manager Name will appear" readonly style="background: rgba(248, 250, 252, 0.85); font-size: 0.8rem; color: #0f172a; font-weight: 600;">
                    </div>

                    <!-- 2. Field Supervisor (SV) -->
                    <div class="staff-entry-row" style="display: grid; grid-template-columns: 120px 105px 1fr; gap: 0.5rem; align-items: center;">
                        <label style="font-size: 0.75rem; font-weight: 700; color: #334155; margin: 0;">📋 Supervisor</label>
                        <input type="text" id="input-sv-id" list="staff-directory-datalist" class="form-control" placeholder="ID (e.g. 1157)" style="font-size: 0.8rem; font-weight: 700; text-align: center; letter-spacing: 0.05em;">
                        <input type="text" id="input-sv-name" class="form-control" placeholder="Supervisor Name will appear" readonly style="background: rgba(248, 250, 252, 0.85); font-size: 0.8rem; color: #0f172a; font-weight: 600;">
                    </div>

                    <!-- 3. Row Leader (RL) -->
                    <div class="staff-entry-row" style="display: grid; grid-template-columns: 120px 105px 1fr; gap: 0.5rem; align-items: center;">
                        <label style="font-size: 0.75rem; font-weight: 700; color: #334155; margin: 0;">🚜 Row Leader</label>
                        <input type="text" id="input-rl-id" list="staff-directory-datalist" class="form-control" placeholder="ID (e.g. 1120)" style="font-size: 0.8rem; font-weight: 700; text-align: center; letter-spacing: 0.05em;">
                        <input type="text" id="input-rl-name" class="form-control" placeholder="Row Leader Name will appear" readonly style="background: rgba(248, 250, 252, 0.85); font-size: 0.8rem; color: #0f172a; font-weight: 600;">
                    </div>

                    <!-- 4. Primary Operator (PO) -->
                    <div class="staff-entry-row" style="display: grid; grid-template-columns: 120px 105px 1fr; gap: 0.5rem; align-items: center;">
                        <label style="font-size: 0.75rem; font-weight: 700; color: #334155; margin: 0;">🦐 Primary Operator</label>
                        <input type="text" id="input-po-id" list="staff-directory-datalist" class="form-control" placeholder="ID (e.g. 1216)" style="font-size: 0.8rem; font-weight: 700; text-align: center; letter-spacing: 0.05em;">
                        <input type="text" id="input-po-name" class="form-control" placeholder="Primary Operator Name will appear" readonly style="background: rgba(248, 250, 252, 0.85); font-size: 0.8rem; color: #0f172a; font-weight: 600;">
                    </div>

                    <!-- 5. Support Operator -->
                    <div class="staff-entry-row" style="display: grid; grid-template-columns: 120px 105px 1fr; gap: 0.5rem; align-items: center;">
                        <label style="font-size: 0.75rem; font-weight: 700; color: #334155; margin: 0;">🛠️ Support Operator</label>
                        <input type="text" id="input-support-id" list="staff-directory-datalist" class="form-control" placeholder="ID (e.g. 2057)" style="font-size: 0.8rem; font-weight: 700; text-align: center; letter-spacing: 0.05em;">
                        <input type="text" id="input-support-name" class="form-control" placeholder="Support Operator Name will appear" readonly style="background: rgba(248, 250, 252, 0.85); font-size: 0.8rem; color: #0f172a; font-weight: 600;">
                    </div>

                </div>

                <!-- Form Actions: Save Button & Reset -->
                <div class="staff-actions-bar" style="margin-top: 1rem; padding-top: 0.75rem; border-top: 1px solid rgba(226, 232, 240, 0.8); display: flex; justify-content: space-between; align-items: center;">
                    <button type="button" id="btn-reset-staff" class="btn-action btn-secondary" style="font-size: 0.78rem; padding: 0.4rem 0.8rem;">
                        <span>🔄 Clear Form</span>
                    </button>
                    <button type="button" id="btn-save-staff" class="btn-action btn-primary" style="font-size: 0.82rem; font-weight: 700; padding: 0.45rem 1.25rem; display: flex; align-items: center; gap: 0.4rem;">
                        <span>💾 Save Personnel Allocation</span>
                    </button>
                </div>

                <!-- HTML5 Datalist for autocomplete -->
                <datalist id="staff-directory-datalist"></datalist>
            </div>

            <!-- Single Column Middle: Initiative / Special Trials (Trial Tracking) -->
            <div class="card panel-card" style="width: 100%;">
                <div class="card-header flex-between" style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h3>🧪 Initiative &amp; Special Trials (<code>GrowoutPondMaster</code>)</h3>
                        <span class="card-sub">Record experimental trials, novel probiotics, density studies, or hardware tests for this cycle</span>
                    </div>
                    <button type="button" id="btn-save-initiatives" class="btn-action btn-primary" style="font-size: 0.82rem; font-weight: 700; padding: 0.45rem 1.25rem; display: flex; align-items: center; gap: 0.4rem;">
                        <span>💾 Save Initiatives</span>
                    </button>
                </div>

                <div class="alert-info-glass" style="font-size: 0.75rem; color: #475569; background: rgba(240, 249, 255, 0.85); border: 1px solid #bae6fd; border-radius: 8px; padding: 0.5rem 0.75rem; margin-bottom: 0.85rem; display: flex; align-items: center; gap: 0.4rem;">
                    <span style="font-size: 1rem;">💡</span>
                    <span>Document trial titles here (e.g., <em>"New Bio-Rem Probiotic Test"</em>, <em>"Low Density 60 PL/m²"</em>, <em>"High-Efficiency 2HP Aerator"</em>) to preserve complete experimental history for this pond.</span>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 0.85rem;">
                    <!-- Dynamic Initiatives Container -->
                    <div class="form-group" style="grid-column: 1 / -1;">
                        <label style="font-size: 0.76rem; font-weight: 700; color: #334155; margin-bottom: 0.35rem; display: block;">
                            🔬 Initiatives & Special Trials
                        </label>
                        <div id="initiative-list-container" style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 0.75rem;">
                            <!-- Dynamic initiative inputs will be rendered here -->
                        </div>
                        <button type="button" id="btn-add-initiative" class="btn-action btn-secondary" style="font-size: 0.75rem; padding: 0.25rem 0.75rem; border-radius: 4px; display: inline-flex; align-items: center; gap: 0.2rem;">
                            <span>➕ Add Initiative</span>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Single Column Bottom: Operational Logbook & Remarks -->
            <div class="card panel-card" style="width: 100%;">
                <div class="card-header flex-between">
                    <div>
                        <h3>Operational Logbook &amp; Remarks (<code>GrowoutPondNote</code>)</h3>
                        <span class="card-sub">Historical field observations, treatments, and supervisor notes</span>
                    </div>
                </div>
                <div class="notes-feed mb-3" id="notes-feed-container" style="max-height: 250px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.5rem;">
                    <!-- Dynamically populated from pond_notes -->
                </div>
                <textarea id="textarea-notes" class="form-control" rows="4" placeholder="Enter daily observation remarks, water quality anomalies, or feeding adjustments..."></textarea>
            </div>
        </div>
    </div>
    `;
}
