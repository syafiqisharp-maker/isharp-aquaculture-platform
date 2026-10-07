/**
 * iSHARP DBMS 2.0 — Field Operations: Management Entry Page Template
 * Generates structured layout markup for:
 * - Breadcrumbs & Navigation Bar
 * - Autocomplete Datalist for Staff ID Lookup
 * - Section 1: Assigned Pond Personnel (PM, SV, RL, PO, Support)
 * - Section 2: Active Paddlewheels Steppers (1.0 HP & 2.0 HP)
 * - Section 3: Feeding Hardware & Pond Infrastructure (Trays, Autofeeders, Hut, Notes)
 * - Bottom Action Bar
 * 
 * Clean Coding Standard: Pure HTML template generator.
 */

/**
 * Generates the HTML layout for the Management Entry Page.
 * @param {object} params
 * @param {string} params.pondLabel
 * @param {object} params.pond
 * @param {number|string} params.doc
 * @param {number} params.initialTotalHP
 * @param {number} params.initialDensity
 * @param {number} params.u1
 * @param {number} params.u2
 * @param {Array<object>} params.staffList
 * @param {Array<object>} params.pondsList
 * @returns {string}
 */
export function getManagementEntryHtml({
    pondLabel,
    pond,
    doc,
    initialTotalHP,
    initialDensity,
    u1,
    u2,
    staffList = [],
    pondsList = []
}) {
    const currIdx = (pondsList && pondsList.length > 0) ? pondsList.findIndex(p =>
        (p.pond_index && p.pond_index === pond?.pond_index) ||
        (p.pond && p.pond === pond?.pond)
    ) : -1;
    const displayIdx = currIdx >= 0 ? currIdx + 1 : 1;
    const totalPonds = pondsList?.length || 0;

    return `
        <div class="management-page-wrapper mgmt-entry-wrapper" style="padding: 1.25rem 2rem; max-width: 1080px; margin: 0 auto; display: flex; flex-direction: column; gap: 1.25rem;">
            
            <!-- Breadcrumbs & Navigation Bar -->
            <div class="mgmt-nav-bar flex-between" style="border-radius: 16px; padding: 0.85rem 1.4rem; flex-wrap: wrap; gap: 0.75rem;">
                <div class="mgmt-nav-actions" style="display: flex; align-items: center; gap: 0.75rem;">
                    <button type="button" id="btn-mgmt-back-pond" class="btn-action btn-secondary" style="font-size: 0.8rem; font-weight: 700; padding: 0.4rem 0.85rem;">
                        <span class="btn-text-full">← Back to Pond View</span>
                        <span class="btn-text-short">← Pond View</span>
                    </button>
                    <button type="button" id="btn-mgmt-back-map" class="btn-action btn-secondary" style="font-size: 0.8rem; font-weight: 700; padding: 0.4rem 0.85rem;">
                        <span class="btn-text-full">🗺️ Back to 24-Pond Map</span>
                        <span class="btn-text-short">🗺️ Back to Map</span>
                    </button>
                </div>

                <div style="display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
                    <span style="font-size: 0.76rem; font-weight: 800; background: #e0f2fe; color: #0284c7; padding: 0.25rem 0.65rem; border-radius: 999px;">
                        Pond ${pondLabel}
                    </span>
                    <span style="font-size: 0.76rem; font-weight: 800; background: #dcfce7; color: #166534; padding: 0.25rem 0.65rem; border-radius: 999px;">
                        Cycle ${pond.cycle_no || (pond.pond_index ? pond.pond_index.split(".")[1] : '—')}
                    </span>
                    <span style="font-size: 0.76rem; font-weight: 800; background: #f1f5f9; color: #475569; padding: 0.25rem 0.65rem; border-radius: 999px;">
                        DOC ${doc || '—'}
                    </span>
                </div>
            </div>

            <!-- Sequential Pond Switcher Bar (when module ponds exist) -->
            ${totalPonds > 1 ? `
            <div id="mgmt-pond-switcher-bar" style="display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; background: rgba(224, 242, 254, 0.85); border: 1.5px solid #bae6fd; border-radius: 14px; padding: 0.55rem 1rem; box-shadow: 0 2px 10px rgba(2, 132, 199, 0.08);">
                <button type="button" id="btn-mgmt-prev-pond" class="btn-action btn-secondary" style="font-size: 0.82rem; font-weight: 800; padding: 0.45rem 1rem; min-height: 38px; display: inline-flex; align-items: center; gap: 4px;">
                    <span>◀ Prev Pond</span>
                </button>
                <div style="text-align: center; flex: 1; min-width: 0; padding: 0 0.5rem;">
                    <div style="font-family: 'Space Grotesk', monospace; font-size: 1.02rem; font-weight: 900; color: #0284c7; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        Pond ${pondLabel} · Cycle ${pond.cycle_no || (pond.pond_index ? pond.pond_index.split(".")[1] : '—')}
                    </div>
                    <div style="font-size: 0.72rem; font-weight: 700; color: #475569;">
                        Module Pond ${displayIdx} of ${totalPonds}
                    </div>
                </div>
                <button type="button" id="btn-mgmt-next-pond" class="btn-action btn-secondary" style="font-size: 0.82rem; font-weight: 800; padding: 0.45rem 1rem; min-height: 38px; display: inline-flex; align-items: center; gap: 4px;">
                    <span>Next Pond ▶</span>
                </button>
            </div>
            ` : ''}

            <!-- Smart Carry-Forward Banner (Auto-filled from previous cycle) -->
            <div id="mgmt-carry-forward-badge" style="display: none; background: rgba(224, 242, 254, 0.95); border: 1.5px solid #bae6fd; border-radius: 12px; padding: 0.65rem 1rem; font-size: 0.8rem; color: #0369a1; font-weight: 700; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap;">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <span style="font-size: 1.1rem;">↺</span>
                    <span id="mgmt-carry-forward-text">Auto-filled personnel from previous cycle (Edit any role if changed, then Save)</span>
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <span id="mgmt-carry-badge-pill" style="font-size: 0.7rem; background: #dcfce7; color: #15803d; padding: 0.2rem 0.6rem; border-radius: 999px; font-weight: 800; white-space: nowrap;">
                        Prior Cycle Preset
                    </span>
                    <button type="button" id="btn-mgmt-clear-autofill" class="btn-action btn-secondary" style="font-size: 0.72rem; padding: 0.2rem 0.55rem; min-height: 28px;">
                        Clear
                    </button>
                </div>
            </div>

            <!-- Page Header Title -->
            <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.65rem; flex-wrap: wrap; gap: 0.5rem;">
                <div>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span style="font-size: 1.5rem;">📝</span>
                        <h1 style="margin: 0; font-size: 1.4rem; font-weight: 900; color: #0f172a;">
                            Management &amp; Personnel Entry
                        </h1>
                    </div>
                </div>
            </div>

            <!-- Autocomplete Datalist for Staff ID Lookup -->
            <datalist id="mgmt-staff-datalist">
                ${staffList.map(s => `<option value="${s.staff_no}">${s.staff_name} (${s.staff_position || 'Staff'})</option>`).join("")}
            </datalist>

            <!-- SECTION 1: ASSIGNED POND PERSONNEL -->
            <section class="glass-card" style="background: rgba(255, 255, 255, 0.9); border: 1px solid #e2e8f0; border-radius: 16px; padding: 1.4rem; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.6rem; flex-wrap: wrap; gap: 0.5rem;">
                    <div>
                        <h2 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: #0284c7; display: flex; align-items: center; gap: 0.45rem;">
                            <span>👥 Assigned Pond Personnel</span>
                        </h2>
                    </div>
                    <div id="mgmt-copy-prev-container" style="display: none;">
                        <button type="button" id="btn-copy-prev-pond" class="btn-action btn-secondary" style="font-size: 0.75rem; font-weight: 700; padding: 0.3rem 0.75rem; border-radius: 8px; display: inline-flex; align-items: center; gap: 4px;">
                            <span>📋 Copy from Previous Pond</span>
                        </button>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr; gap: 0.85rem;">
                    
                    <!-- Asst Manager (PM) -->
                    <div class="mgmt-staff-row" style="display: grid; grid-template-columns: 140px 130px 1fr; gap: 0.85rem; align-items: center; background: #f8fafc; padding: 0.65rem 0.9rem; border-radius: 10px; border: 1px solid #e2e8f0;">
                        <label style="font-size: 0.82rem; font-weight: 700; color: #334155; margin: 0;">👔 Asst Manager</label>
                        <input type="text" id="mgmt-pm-id" list="mgmt-staff-datalist" class="form-control" placeholder="ID" title="Enter 4-digit staff ID (e.g. 0042)" maxlength="6" value="${pond.pm_staff_no || ''}" style="font-size: 0.85rem; font-weight: 700; text-align: center; background: #ffffff;">
                        <input type="text" id="mgmt-pm-name" class="form-control" placeholder="Asst Manager Name (Auto-resolved)" readonly style="background: rgba(241, 245, 249, 0.8); font-size: 0.84rem; color: #0f172a; font-weight: 600;">
                    </div>

                    <!-- Supervisor (SV) -->
                    <div class="mgmt-staff-row" style="display: grid; grid-template-columns: 140px 130px 1fr; gap: 0.85rem; align-items: center; background: #f8fafc; padding: 0.65rem 0.9rem; border-radius: 10px; border: 1px solid #e2e8f0;">
                        <label style="font-size: 0.82rem; font-weight: 700; color: #334155; margin: 0;">📋 Supervisor</label>
                        <input type="text" id="mgmt-sv-id" list="mgmt-staff-datalist" class="form-control" placeholder="ID" title="Enter 4-digit staff ID (e.g. 1157)" maxlength="6" value="${pond.sv_staff_no || ''}" style="font-size: 0.85rem; font-weight: 700; text-align: center; background: #ffffff;">
                        <input type="text" id="mgmt-sv-name" class="form-control" placeholder="Supervisor Name (Auto-resolved)" readonly style="background: rgba(241, 245, 249, 0.8); font-size: 0.84rem; color: #0f172a; font-weight: 600;">
                    </div>

                    <!-- Row Leader (RL) -->
                    <div class="mgmt-staff-row" style="display: grid; grid-template-columns: 140px 130px 1fr; gap: 0.85rem; align-items: center; background: #f8fafc; padding: 0.65rem 0.9rem; border-radius: 10px; border: 1px solid #e2e8f0;">
                        <label style="font-size: 0.82rem; font-weight: 700; color: #334155; margin: 0;">🚜 Row Leader</label>
                        <input type="text" id="mgmt-rl-id" list="mgmt-staff-datalist" class="form-control" placeholder="ID" title="Enter 4-digit staff ID (e.g. 1120)" maxlength="6" value="${pond.rl_staff_no || ''}" style="font-size: 0.85rem; font-weight: 700; text-align: center; background: #ffffff;">
                        <input type="text" id="mgmt-rl-name" class="form-control" placeholder="Row Leader Name (Auto-resolved)" readonly style="background: rgba(241, 245, 249, 0.8); font-size: 0.84rem; color: #0f172a; font-weight: 600;">
                    </div>

                    <!-- Pond Operator (PO) -->
                    <div class="mgmt-staff-row" style="display: grid; grid-template-columns: 140px 130px 1fr; gap: 0.85rem; align-items: center; background: #f8fafc; padding: 0.65rem 0.9rem; border-radius: 10px; border: 1px solid #e2e8f0;">
                        <label style="font-size: 0.82rem; font-weight: 700; color: #334155; margin: 0;">🦐 Pond Operator</label>
                        <input type="text" id="mgmt-po-id" list="mgmt-staff-datalist" class="form-control" placeholder="ID" title="Enter 4-digit staff ID (e.g. 1216)" maxlength="6" value="${pond.po_staff_no || ''}" style="font-size: 0.85rem; font-weight: 700; text-align: center; background: #ffffff;">
                        <input type="text" id="mgmt-po-name" class="form-control" placeholder="Operator Name (Auto-resolved)" readonly style="background: rgba(241, 245, 249, 0.8); font-size: 0.84rem; color: #0f172a; font-weight: 600;">
                    </div>

                    <!-- Support Operator -->
                    <div class="mgmt-staff-row" style="display: grid; grid-template-columns: 140px 130px 1fr; gap: 0.85rem; align-items: center; background: #f8fafc; padding: 0.65rem 0.9rem; border-radius: 10px; border: 1px solid #e2e8f0;">
                        <label style="font-size: 0.82rem; font-weight: 700; color: #334155; margin: 0;">🛠️ Support Operator</label>
                        <input type="text" id="mgmt-support-id" list="mgmt-staff-datalist" class="form-control" placeholder="ID" title="Enter 4-digit staff ID (e.g. 2057)" maxlength="6" value="${pond.support_staff_no || ''}" style="font-size: 0.85rem; font-weight: 700; text-align: center; background: #ffffff;">
                        <input type="text" id="mgmt-support-name" class="form-control" placeholder="Support Name (Auto-resolved)" readonly style="background: rgba(241, 245, 249, 0.8); font-size: 0.84rem; color: #0f172a; font-weight: 600;">
                    </div>

                </div>
            </section>

            <!-- SECTION 2: ACTIVE PADDLEWHEELS (1.0 HP & 2.0 HP ONLY) -->
            <section class="glass-card" style="background: rgba(255, 255, 255, 0.9); border: 1px solid #e2e8f0; border-radius: 16px; padding: 1.4rem; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.6rem; flex-wrap: wrap; gap: 0.5rem;">
                    <div>
                        <h2 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: #0284c7; display: flex; align-items: center; gap: 0.45rem;">
                            <span>⚡ Active Paddlewheels</span>
                        </h2>
                    </div>
                    <div id="mgmt-aeration-badge" style="font-size: 0.82rem; font-weight: 800; color: #0284c7; background: #e0f2fe; border: 1px solid #bae6fd; padding: 0.35rem 0.85rem; border-radius: 8px;">
                        Total: ${initialTotalHP} HP (${initialDensity} HP/Ha)
                    </div>
                </div>

                <div class="mgmt-paddlewheels-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                    <div class="form-group" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1rem; text-align: center;">
                        <label style="font-size: 0.84rem; font-weight: 800; color: #1e293b; display: block; margin-bottom: 0.5rem;">
                            1.0 HP Paddlewheels
                        </label>
                        <div style="display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
                            <button type="button" class="stepper-btn btn-stepper-sub" data-target="mgmt-input-1hp" aria-label="Decrease 1.0 HP aerator">−</button>
                            <input type="number" id="mgmt-input-1hp" class="form-control" min="0" max="25" value="${u1}" style="font-size: 1.25rem; font-weight: 900; text-align: center; width: 75px; margin: 0; color: #0369a1; background: #ffffff;">
                            <button type="button" class="stepper-btn btn-stepper-add" data-target="mgmt-input-1hp" aria-label="Increase 1.0 HP aerator">+</button>
                        </div>
                    </div>

                    <div class="form-group" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1rem; text-align: center;">
                        <label style="font-size: 0.84rem; font-weight: 800; color: #1e293b; display: block; margin-bottom: 0.5rem;">
                            2.0 HP Paddlewheels
                        </label>
                        <div style="display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
                            <button type="button" class="stepper-btn btn-stepper-sub" data-target="mgmt-input-2hp" aria-label="Decrease 2.0 HP aerator">−</button>
                            <input type="number" id="mgmt-input-2hp" class="form-control" min="0" max="25" value="${u2}" style="font-size: 1.25rem; font-weight: 900; text-align: center; width: 75px; margin: 0; color: #0369a1; background: #ffffff;">
                            <button type="button" class="stepper-btn btn-stepper-add" data-target="mgmt-input-2hp" aria-label="Increase 2.0 HP aerator">+</button>
                        </div>
                    </div>
                </div>
            </section>

            <!-- SECTION 3: FEEDING HARDWARE & POND CONDITION -->
            <section class="glass-card" style="background: rgba(255, 255, 255, 0.9); border: 1px solid #e2e8f0; border-radius: 16px; padding: 1.4rem; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.6rem;">
                    <div>
                        <h2 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: #0284c7; display: flex; align-items: center; gap: 0.45rem;">
                            <span>🛠️ Feeding Hardware &amp; Pond Infrastructure</span>
                        </h2>
                    </div>
                </div>

                <div class="mgmt-hardware-grid" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; margin-bottom: 1.25rem;">
                    <div class="form-group" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 0.75rem; text-align: center;">
                        <label style="font-size: 0.78rem; font-weight: 700; color: #334155; margin-bottom: 0.45rem; display: block;">
                            🍽️ Feeding Trays
                        </label>
                        <div style="display: flex; align-items: center; justify-content: center; gap: 0.4rem;">
                            <button type="button" class="stepper-btn btn-stepper-sub" data-target="mgmt-input-tray" style="min-width: 38px; height: 38px; font-size: 1.1rem;">−</button>
                            <input type="number" id="mgmt-input-tray" class="form-control" min="0" max="20" placeholder="0" style="font-size: 1.05rem; font-weight: 800; text-align: center; width: 60px; margin: 0;">
                            <button type="button" class="stepper-btn btn-stepper-add" data-target="mgmt-input-tray" style="min-width: 38px; height: 38px; font-size: 1.1rem;">+</button>
                        </div>
                    </div>

                    <div class="form-group" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 0.75rem; text-align: center;">
                        <label style="font-size: 0.78rem; font-weight: 700; color: #334155; margin-bottom: 0.45rem; display: block;">
                            🤖 Autofeeders Installed
                        </label>
                        <div style="display: flex; align-items: center; justify-content: center; gap: 0.4rem;">
                            <button type="button" class="stepper-btn btn-stepper-sub" data-target="mgmt-input-feeder" style="min-width: 38px; height: 38px; font-size: 1.1rem;">−</button>
                            <input type="number" id="mgmt-input-feeder" class="form-control" min="0" max="10" placeholder="0" style="font-size: 1.05rem; font-weight: 800; text-align: center; width: 60px; margin: 0;">
                            <button type="button" class="stepper-btn btn-stepper-add" data-target="mgmt-input-feeder" style="min-width: 38px; height: 38px; font-size: 1.1rem;">+</button>
                        </div>
                    </div>

                    <div class="form-group" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 0.75rem;">
                        <label style="font-size: 0.78rem; font-weight: 700; color: #334155; margin-bottom: 0.45rem; display: block; text-align: center;">
                            🛖 Pond Hut Condition
                        </label>
                        <select id="mgmt-select-hut" class="form-control" style="font-size: 0.85rem; font-weight: 700; width: 100%;">
                            <option value="OK">🟢 OK (Good Condition)</option>
                            <option value="Need Repair">🟡 Need Repair (Minor Issues)</option>
                            <option value="Urgent Repair">🔴 Urgent Repair (Damaged)</option>
                        </select>
                    </div>
                </div>

                <div class="form-group">
                    <label style="font-size: 0.78rem; font-weight: 700; color: #334155; margin-bottom: 0.35rem; display: block;">
                        📝 Field Supervisor Notes / Operational Remarks
                    </label>
                    <textarea id="mgmt-textarea-notes" class="form-control" rows="3" placeholder="Enter notes regarding shrimp behavior, aeration adjustments, feeding response, or pond maintenance..." style="font-size: 0.84rem; resize: vertical;"></textarea>
                </div>
            </section>

            <!-- BOTTOM ACTION BAR -->
            <div class="mgmt-action-bar mgmt-sticky-bottom-bar" style="display: flex; justify-content: flex-end; align-items: center; gap: 0.75rem; padding: 1rem 0; border-top: 1px solid #e2e8f0; flex-wrap: wrap;">
                <button type="button" id="btn-mgmt-cancel" class="btn-action btn-secondary" style="font-size: 0.85rem; font-weight: 700; padding: 0.55rem 1.4rem;">
                    <span>Cancel</span>
                </button>
                <button type="button" id="btn-mgmt-save" class="btn-action btn-secondary" style="font-size: 0.88rem; font-weight: 800; padding: 0.6rem 1.4rem; display: flex; align-items: center; gap: 0.45rem;">
                    <span>💾 Save</span>
                </button>
                ${totalPonds > 1 ? `
                <button type="button" id="btn-mgmt-save-next" class="btn-action btn-primary" style="font-size: 0.9rem; font-weight: 800; padding: 0.6rem 1.6rem; display: flex; align-items: center; gap: 0.45rem; background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);">
                    <span>💾 Save &amp; Next Pond ▶</span>
                </button>
                ` : ''}
            </div>

        </div>
    `;
}
