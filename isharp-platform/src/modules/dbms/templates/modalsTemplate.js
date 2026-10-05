/**
 * iSHARP DBMS 2.0 — Modals HTML Template
 * Contains Universal Excel Paste Modal, Cycle Termination Modal, and Cycle Revive Modal.
 */

export function getModalsHtml() {
    return `
    <!-- UNIVERSAL EXCEL COPY-PASTE MODAL -->
    <div id="modal-excel-paste" class="modal-backdrop hidden" role="dialog" aria-modal="true">
        <div class="modal-dialog">
            <div class="modal-header">
                <div class="modal-title-cluster">
                    <h3 id="excel-modal-title">📋 Paste Excel Spreadsheet Data</h3>
                    <span id="excel-modal-subtitle" class="modal-subtitle">Paste rows copied directly from Excel (Ctrl + V)</span>
                </div>
                <button id="btn-modal-close-icon" class="modal-close" type="button" title="Close (Esc)">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group mb-3">
                    <label for="excel-target-category" style="font-weight: 700; font-size: 0.82rem; margin-bottom: 0.35rem; display: block;">Target Data Domain:</label>
                    <select id="excel-target-category" class="form-control" style="background: #fff; border: 1px solid #bae6fd; font-weight: 600; padding: 0.4rem 0.6rem; border-radius: 6px; width: 100%;">
                        <option value="sampling">Weekly Sampling (Date, DOC, ABW, Survival, Biomass)</option>
                        <option value="feed">Daily Feed Log (Date, Shift, Feed kg, Tray Remnant %)</option>
                        <option value="issues">Laboratory Issues (Date, Category, Pathogen, Flag, Note)</option>
                        <option value="harvest">Harvest Events (Date, Type, Weight kg, ABW g, Revenue)</option>
                    </select>
                </div>
                <div class="form-group mb-3">
                    <label for="excel-paste-textarea" style="font-weight: 700; font-size: 0.82rem; margin-bottom: 0.35rem; display: block;">Paste Spreadsheet Rows Here:</label>
                    <textarea id="excel-paste-textarea" class="form-control font-mono" rows="4" placeholder="Select cells in Excel, press Ctrl+C, then click here and press Ctrl+V..." style="background: #fff; border: 1px solid #bae6fd; font-size: 0.82rem; padding: 0.5rem; border-radius: 6px; width: 100%;"></textarea>
                </div>
                <div id="excel-preview-container" class="preview-area">
                    <div class="flex-between mb-2" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
                        <span class="preview-count" style="font-size: 0.78rem; font-weight: 600;"><strong id="excel-parsed-count">0</strong> rows recognized</span>
                        <span id="excel-parse-status" class="status-valid">Ready to commit</span>
                    </div>
                    <div class="table-responsive" style="max-height: 180px; overflow-y: auto;">
                        <table class="aero-table preview-table" id="table-excel-preview">
                            <thead id="thead-excel-preview"></thead>
                            <tbody id="tbody-excel-preview"></tbody>
                        </table>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button id="btn-close-excel-modal" class="btn-action btn-secondary" type="button" style="background: #fff; border: 1px solid #cbd5e1; color: var(--text-primary); font-weight: 600;">⬅ Back to Dashboard</button>
                <button id="btn-commit-excel" class="btn-action btn-save" type="button">💾 Commit to Supabase</button>
            </div>
        </div>
    </div>

    <!-- TERMINATE POND CYCLE MODAL -->
    <div id="modal-terminate-options" class="modal-backdrop hidden" role="dialog" aria-modal="true">
        <div class="modal-dialog" style="max-width: 560px;">
            <div class="modal-header" style="background: linear-gradient(180deg, #fef2f2 0%, #fee2e2 100%); border-bottom: 1px solid #fecaca;">
                <div class="modal-title-cluster">
                    <h3 style="color: #991b1b; display: flex; align-items: center; gap: 0.5rem;">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                        </svg>
                        Harvest &amp; Terminate Cycle
                    </h3>
                    <span class="modal-subtitle" style="color: #b91c1c;">Finalize cycle <strong id="terminate-modal-pond-index" class="font-mono">—</strong></span>
                </div>
                <button id="btn-close-terminate-icon" class="modal-close" type="button" title="Close (Esc)">&times;</button>
            </div>
            <div class="modal-body" style="padding: 1.5rem;">
                <div class="form-group mb-3">
                    <label for="terminate-date-input" style="font-weight: 700; font-size: 0.82rem; margin-bottom: 0.35rem; display: block;">Harvest Close Date:</label>
                    <input type="date" id="terminate-date-input" class="form-control font-mono" style="border: 1px solid #cbd5e1; padding: 0.45rem 0.6rem; border-radius: 6px; width: 100%;">
                </div>
                <div class="form-group mb-3">
                    <label for="terminate-status-select" style="font-weight: 700; font-size: 0.82rem; margin-bottom: 0.35rem; display: block;">Harvest Conclusion Reason:</label>
                    <select id="terminate-status-select" class="form-control" style="border: 1px solid #cbd5e1; padding: 0.45rem 0.6rem; border-radius: 6px; width: 100%;">
                        <option value="NORMAL HARVEST" selected>NORMAL HARVEST (Full Target Growth Achieved)</option>
                        <option value="EMERGENCY HARVEST">EMERGENCY HARVEST (Water Quality / Biosecurity Event)</option>
                        <option value="DISEASE OUTBREAK">DISEASE OUTBREAK (Pathology Intervention)</option>
                        <option value="MARKET OPPORTUNITY">MARKET OPPORTUNITY (Favorable Commercial Gate Pricing)</option>
                    </select>
                </div>
                
                <div class="form-group mb-3" style="border: 1px solid #fed7aa; background: #fff7ed; padding: 0.9rem; border-radius: 8px;">
                    <label style="font-weight: 700; font-size: 0.84rem; color: #9a3412; margin-bottom: 0.5rem; display: block;">Rollover Policy:</label>
                    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                        <label style="display: flex; align-items: flex-start; gap: 0.5rem; font-size: 0.82rem; cursor: pointer; color: #1e293b;">
                            <input type="radio" name="radio-rollover-mode" id="radio-rollover-yes" checked style="margin-top: 2px;">
                            <div>
                                <strong>Terminate &amp; Auto-Rollover (+1 Cycle)</strong>
                                <span style="display: block; font-size: 0.74rem; color: #64748b;">Closes this cycle and automatically initializes next cycle in IDLE status (if next cycle already exists, duplicates are safely prevented).</span>
                            </div>
                        </label>
                        <label style="display: flex; align-items: flex-start; gap: 0.5rem; font-size: 0.82rem; cursor: pointer; color: #1e293b;">
                            <input type="radio" name="radio-rollover-mode" id="radio-rollover-no" style="margin-top: 2px;">
                            <div>
                                <strong>Terminate Only (Do Not Create Next Cycle)</strong>
                                <span style="display: block; font-size: 0.74rem; color: #64748b;">Closes this cycle and marks pond as Harvested. No new cycle is generated (ideal for pond maintenance or manual cycle creation later).</span>
                            </div>
                        </label>
                    </div>
                </div>
            </div>
            <div class="modal-footer" style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 0.85rem 1.5rem; display: flex; justify-content: flex-end; gap: 0.65rem;">
                <button id="btn-cancel-terminate-modal" class="btn-action btn-secondary" type="button" style="background: #fff; border: 1px solid #cbd5e1; color: var(--text-primary); font-weight: 600;">
                    Cancel
                </button>
                <button id="btn-confirm-terminate-execution" class="btn-action btn-danger" type="button" style="font-weight: 700;">
                    Confirm Termination
                </button>
            </div>
        </div>
    </div>

    <!-- REVIVE POND CYCLE MODAL -->
    <div id="modal-revive-cycle" class="modal-backdrop hidden" role="dialog" aria-modal="true">
        <div class="modal-dialog" style="max-width: 600px;">
            <div class="modal-header" style="background: linear-gradient(180deg, #ecfdf5 0%, #d1fae5 100%); border-bottom: 1px solid #a7f3d0;">
                <div class="modal-title-cluster">
                    <h3 style="color: #065f46; display: flex; align-items: center; gap: 0.5rem;">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="1 4 1 10 7 10"></polyline>
                            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                        </svg>
                        Revive Pond Cycle
                    </h3>
                    <span class="modal-subtitle" style="color: #047857;">Reopen closed cycle <strong id="revive-modal-pond-index">—</strong> back to active PRODUCTION</span>
                </div>
                <button id="btn-close-revive-modal-icon" class="modal-close" type="button" title="Close (Esc)">&times;</button>
            </div>
            <div class="modal-body" style="padding: 1.5rem;">
                <div class="glass-card mb-3" style="background: rgba(240, 253, 244, 0.7); border: 1px solid #bbf7d0; padding: 0.9rem 1.15rem; border-radius: 8px;">
                    <div style="font-size: 0.85rem; color: #1e293b; line-height: 1.5;">
                        You are about to revive <strong id="revive-modal-pond-name">this pond</strong>. This will:
                        <ul style="margin: 0.4rem 0 0.4rem 1.25rem; font-size: 0.8rem; color: #334155;">
                            <li>Reopen cycle <code id="revive-modal-cycle-code" class="font-bold" style="color: #059669;">—</code> to <strong>PRODUCTION</strong> (ACTiVE).</li>
                            <li>Clear the closed harvest date and termination lock.</li>
                        </ul>
                        When this pond was terminated, subsequent cycle <strong id="revive-modal-next-cycle" class="font-mono font-bold" style="color: #0284c7;">—</strong> was automatically created in IDLE status.
                    </div>
                </div>

                <div style="font-weight: 700; font-size: 0.84rem; color: #0f172a; margin-bottom: 0.75rem;">
                    Please select your preferred action for the newly spawned cycle:
                </div>

                <div style="display: flex; flex-direction: column; gap: 0.85rem;">
                    <!-- Option 1: Revive and Delete Next Cycle -->
                    <div class="revive-option-card" id="option-card-delete" style="border: 2px solid #10b981; border-radius: 8px; padding: 1rem; background: #ffffff; box-shadow: 0 2px 6px rgba(16, 185, 129, 0.1);">
                        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 0.5rem; flex-wrap: wrap;">
                            <div style="font-weight: 700; font-size: 0.9rem; color: #065f46;">
                                🗑️ Option 1: Revive &amp; Delete Next Cycle (<span class="revive-next-code font-mono">—</span>)
                            </div>
                            <span style="background: #dcfce7; color: #15803d; font-size: 0.68rem; font-weight: 700; padding: 2px 6px; border-radius: 4px;">Recommended for Accidental Termination</span>
                        </div>
                        <p style="font-size: 0.78rem; color: #475569; margin: 0.4rem 0 0.75rem 0; line-height: 1.4;">
                            Reopens the current cycle as active and <strong>permanently deletes</strong> the empty newly-spawned cycle (<span class="revive-next-code font-mono">—</span>) from the database so cycle numbers remain sequential.
                        </p>
                        <div style="text-align: right;">
                            <button type="button" id="btn-confirm-revive-delete" class="btn-action" style="background: linear-gradient(180deg, #10b981 0%, #059669 100%); color: #fff; font-weight: 700; padding: 0.45rem 1.1rem; font-size: 0.82rem; border-radius: 6px; border: 1px solid #34d399; box-shadow: 0 2px 8px rgba(16, 185, 129, 0.35);">
                                Revive &amp; Delete <span class="revive-next-code font-mono">—</span>
                            </button>
                        </div>
                    </div>

                    <!-- Option 2: Revive and Keep Next Cycle -->
                    <div class="revive-option-card" id="option-card-keep" style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 1rem; background: #f8fafc;">
                        <div style="font-weight: 700; font-size: 0.9rem; color: #334155;">
                            📦 Option 2: Revive &amp; Keep Next Cycle (<span class="revive-next-code font-mono">—</span>)
                        </div>
                        <p style="font-size: 0.78rem; color: #64748b; margin: 0.4rem 0 0.75rem 0; line-height: 1.4;">
                            Reopens the current cycle as active, but <strong>keeps</strong> the newly-spawned cycle (<span class="revive-next-code font-mono">—</span>) in the database in IDLE status for future use.
                        </p>
                        <div style="text-align: right;">
                            <button type="button" id="btn-confirm-revive-keep" class="btn-action btn-secondary" style="font-weight: 600; padding: 0.45rem 1.1rem; font-size: 0.82rem; border-radius: 6px; background: #fff; border: 1px solid #94a3b8; color: #334155;">
                                Revive &amp; Keep Both Cycles
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-footer" style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 0.85rem 1.5rem;">
                <button id="btn-close-revive-modal" class="btn-action btn-secondary" type="button" style="background: #fff; border: 1px solid #cbd5e1; color: var(--text-primary); font-weight: 600;">
                    Cancel (Keep Cycle Closed)
                </button>
            </div>
        </div>
    </div>
    `;
}
