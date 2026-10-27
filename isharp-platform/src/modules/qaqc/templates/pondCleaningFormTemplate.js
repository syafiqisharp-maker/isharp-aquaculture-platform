/**
 * iSHARP QA/QC Inspection Portal — Mobile-First Pond Cleaning Form Template
 */

import { QAQC_INSPECTORS, QAQC_REQUESTORS } from "../../../domain/qaqcWhatsAppFormatter.js";

export function renderPondCleaningForm() {
    return `
        <div class="qaqc-form-wrapper mobile-optimized">
            
            <!-- Compact Navigation Bar -->
            <div class="qaqc-nav-bar">
                <button type="button" class="btn-qaqc-back" id="btn-qaqc-back-to-hub">
                    &larr; Hub
                </button>
                <div class="qaqc-nav-center-title">
                    <span class="qaqc-title-mini">🧹 Pond Cleaning</span>
                </div>
                <button type="button" class="btn-qaqc-portal-return" data-nav-view="portal">
                    &larr; Portal
                </button>
            </div>

            <!-- Main Form Column -->
            <div class="qaqc-form-layout">
                
                <!-- PRIMARY ENTRY COLUMN -->
                <div class="qaqc-col-entry">
                    
                    <!-- 1. Cascading 3-Step Pond Selector (Compact Mobile Row) -->
                    <div class="qaqc-card-panel compact-panel">
                        <div class="qaqc-panel-header-mini">
                            <span class="qaqc-badge-step">1</span>
                            <span class="qaqc-panel-label">SELECT POND</span>
                        </div>
                        
                        <div class="qaqc-cascading-row">
                            <!-- Module Picker -->
                            <div class="qaqc-field-cell">
                                <label for="select-qaqc-module" class="qaqc-label-micro">MODULE</label>
                                <select id="select-qaqc-module" class="qaqc-select-touch">
                                    <option value="">--</option>
                                </select>
                            </div>

                            <!-- Row Picker -->
                            <div class="qaqc-field-cell">
                                <label for="select-qaqc-row" class="qaqc-label-micro">ROW</label>
                                <select id="select-qaqc-row" class="qaqc-select-touch" disabled>
                                    <option value="">--</option>
                                </select>
                            </div>

                            <!-- Pond Picker -->
                            <div class="qaqc-field-cell">
                                <label for="select-qaqc-pond" class="qaqc-label-micro">POND</label>
                                <select id="select-qaqc-pond" class="qaqc-select-touch" disabled>
                                    <option value="">--</option>
                                </select>
                            </div>
                        </div>

                        <!-- Idle Days from Start of Cycle (from pond_event_date) -->
                        <div id="qaqc-pond-context-bar" class="qaqc-idle-strip hidden">
                            <span class="qaqc-idle-badge">
                                <span id="ctx-idle-days" class="qaqc-idle-num">0</span>
                                <span class="qaqc-idle-unit">days idle</span>
                            </span>
                        </div>
                    </div>

                    <!-- 2. Inspection Parameters (Date, Requestor, Inspector, Team) -->
                    <div class="qaqc-card-panel compact-panel">
                        <div class="qaqc-panel-header-mini">
                            <span class="qaqc-badge-step">2</span>
                            <span class="qaqc-panel-label">INSPECTION PARAMETERS</span>
                        </div>

                        <!-- Date & Requestor Row -->
                        <div class="qaqc-meta-flex">
                            <!-- Date Input -->
                            <div class="qaqc-field-group flex-1">
                                <label for="input-qaqc-date" class="qaqc-label-micro">Date</label>
                                <input type="date" id="input-qaqc-date" class="qaqc-input-touch" />
                                <span class="qaqc-preview-day" id="preview-formatted-date">--</span>
                            </div>

                            <!-- Requestor Autofill Input -->
                            <div class="qaqc-field-group flex-1">
                                <label for="input-qaqc-requestor" class="qaqc-label-micro">Requestor</label>
                                <input 
                                    type="text" 
                                    id="input-qaqc-requestor" 
                                    list="qaqc-requestor-list" 
                                    class="qaqc-input-touch" 
                                    autocomplete="off" 
                                />
                                <datalist id="qaqc-requestor-list">
                                    ${QAQC_REQUESTORS.map(name => `<option value="${name}"></option>`).join("\n                                    ")}
                                </datalist>
                            </div>
                        </div>

                        <!-- Inspector Quick-Tap Buttons -->
                        <div class="qaqc-inspector-row">
                            <label class="qaqc-label-micro">Inspector</label>
                            <div class="qaqc-inspector-chips-group" id="qaqc-inspector-chips">
                                ${QAQC_INSPECTORS.map((insp, i) => `<button type="button" class="qaqc-inspector-chip${i === 0 ? " active" : ""}" data-inspector="${insp}">${insp}</button>`).join("\n                                ")}
                            </div>
                            <input type="hidden" id="input-qaqc-inspector" value="${QAQC_INSPECTORS[0]}" />
                        </div>

                        <!-- Team Chips -->
                        <div class="qaqc-team-row">
                            <label class="qaqc-label-micro">Cleaning Team</label>
                            <div class="qaqc-team-chips-group" id="qaqc-team-chips">
                                <button type="button" class="qaqc-team-chip" data-team="Int 1">Int 1</button>
                                <button type="button" class="qaqc-team-chip active" data-team="Int 2">Int 2</button>
                                <button type="button" class="qaqc-team-chip" data-team="Int 3">Int 3</button>
                                <button type="button" class="qaqc-team-chip" data-team="Ext 1">Ext 1</button>
                                <button type="button" class="qaqc-team-chip" data-team="Ext 2">Ext 2</button>
                                <button type="button" class="qaqc-team-chip" data-team="PO">PO</button>
                            </div>
                            <input type="hidden" id="input-qaqc-team" value="Int 2" />
                        </div>
                    </div>

                    <!-- 3. The 4 Checklist Items (Touch Toggles) -->
                    <div class="qaqc-card-panel compact-panel">
                        <div class="qaqc-panel-header-mini flex-between">
                            <div class="flex-align-center gap-2">
                                <span class="qaqc-badge-step">3</span>
                                <span class="qaqc-panel-label">CHECKLIST</span>
                            </div>
                            <!-- 1-Tap Quick Pass Button -->
                            <button type="button" class="btn-all-pass-touch" id="btn-qaqc-all-pass">
                                ⚡ All Pass ✅
                            </button>
                        </div>

                        <div class="qaqc-chk-mobile-list">
                            
                            <!-- 1. Lining -->
                            <div class="qaqc-chk-touch-card" data-item="lining">
                                <div class="qaqc-chk-name-row">
                                    <span class="qaqc-chk-title">1. Lining</span>
                                    <span class="qaqc-state-pill pass" id="badge-chk-lining">✅ Pass</span>
                                </div>
                                <div class="qaqc-btn-pair">
                                    <button type="button" class="qaqc-toggle-touch pass active" data-toggle="lining" data-val="true">✅ Pass</button>
                                    <button type="button" class="qaqc-toggle-touch fail" data-toggle="lining" data-val="false">❌ Fail</button>
                                </div>
                            </div>

                            <!-- 2. Sump -->
                            <div class="qaqc-chk-touch-card" data-item="sump">
                                <div class="qaqc-chk-name-row">
                                    <span class="qaqc-chk-title">2. Sump</span>
                                    <span class="qaqc-state-pill pass" id="badge-chk-sump">✅ Pass</span>
                                </div>
                                <div class="qaqc-btn-pair">
                                    <button type="button" class="qaqc-toggle-touch pass active" data-toggle="sump" data-val="true">✅ Pass</button>
                                    <button type="button" class="qaqc-toggle-touch fail" data-toggle="sump" data-val="false">❌ Fail</button>
                                </div>
                            </div>

                            <!-- 3. PWA & autofeeder -->
                            <div class="qaqc-chk-touch-card" data-item="pwa">
                                <div class="qaqc-chk-name-row">
                                    <span class="qaqc-chk-title">3. PWA &amp; Autofeeder</span>
                                    <span class="qaqc-state-pill pass" id="badge-chk-pwa">✅ Pass</span>
                                </div>
                                <div class="qaqc-btn-pair">
                                    <button type="button" class="qaqc-toggle-touch pass active" data-toggle="pwa" data-val="true">✅ Pass</button>
                                    <button type="button" class="qaqc-toggle-touch fail" data-toggle="pwa" data-val="false">❌ Fail</button>
                                </div>
                            </div>

                            <!-- 4. Jetty -->
                            <div class="qaqc-chk-touch-card" data-item="jetty">
                                <div class="qaqc-chk-name-row">
                                    <span class="qaqc-chk-title">4. Jetty</span>
                                    <span class="qaqc-state-pill pass" id="badge-chk-jetty">✅ Pass</span>
                                </div>
                                <div class="qaqc-btn-pair">
                                    <button type="button" class="qaqc-toggle-touch pass active" data-toggle="jetty" data-val="true">✅ Pass</button>
                                    <button type="button" class="qaqc-toggle-touch fail" data-toggle="jetty" data-val="false">❌ Fail</button>
                                </div>
                            </div>

                        </div>
                    </div>

                    <!-- 4. Defect Remarks -->
                    <div class="qaqc-card-panel compact-panel" id="qaqc-defect-panel">
                        <div class="qaqc-panel-header-mini">
                            <span class="qaqc-badge-step">4</span>
                            <span class="qaqc-panel-label">DEFECT NOTES / REWORK</span>
                        </div>

                        <div class="qaqc-preset-remarks">
                            <button type="button" class="qaqc-chip-mini" data-remark="Sludge remnant at sump">Sludge at sump</button>
                            <button type="button" class="qaqc-chip-mini" data-remark="Liner patch required">Liner patch</button>
                            <button type="button" class="qaqc-chip-mini" data-remark="Barnacles on floater">Barnacles on PWA</button>
                            <button type="button" class="qaqc-chip-mini" data-remark="Algae on jetty">Algae on jetty</button>
                        </div>

                        <textarea id="input-qaqc-remarks" class="qaqc-textarea-touch" rows="2" placeholder="Defect notes (optional)..."></textarea>
                    </div>

                </div>

                <!-- SECONDARY COLUMN: WhatsApp Preview & History -->
                <div class="qaqc-col-output">
                    
                    <!-- WhatsApp Preview Card -->
                    <div class="qaqc-card-panel compact-panel">
                        <div class="qaqc-panel-header-mini flex-between">
                            <span class="qaqc-badge-wa">WHATSAPP PREVIEW</span>
                            <button type="button" class="qaqc-btn-toggle-wa" id="btn-toggle-wa-preview">Hide &and;</button>
                        </div>

                        <div class="qaqc-wa-bubble-preview" id="qaqc-wa-bubble-box">
                            <pre id="qaqc-wa-message-text" class="qaqc-wa-pre">Loading preview...</pre>
                        </div>

                        <!-- Action Buttons in Desktop & Tablet View -->
                        <div class="qaqc-desktop-actions">
                            <button type="button" class="btn-qaqc-primary" id="btn-qaqc-save">
                                💾 Save Inspection
                            </button>
                            <button type="button" class="btn-qaqc-copy" id="btn-qaqc-copy-wa">
                                📋 Copy WhatsApp Message
                            </button>
                            <a id="btn-qaqc-share-wa" class="btn-qaqc-whatsapp" target="_blank" rel="noopener noreferrer">
                                📲 Open in WhatsApp
                            </a>
                        </div>
                    </div>

                    <!-- History Logbook -->
                    <div class="qaqc-card-panel compact-panel">
                        <div class="qaqc-panel-header-mini">
                            <span class="qaqc-panel-label">RECENT INSPECTIONS</span>
                        </div>
                        <div id="qaqc-history-container" class="qaqc-history-box">
                            <p class="qaqc-empty-hint">Select a pond to view history.</p>
                        </div>
                    </div>

                </div>

            </div>

            <!-- STICKY MOBILE BOTTOM SAVE BAR (Ensures 1-Tap Thumb Access) -->
            <div class="qaqc-mobile-bottom-dock">
                <button type="button" class="btn-dock-save" id="btn-dock-save">
                    💾 Save
                </button>
                <button type="button" class="btn-dock-copy" id="btn-dock-copy">
                    📋 Copy WA
                </button>
                <a id="btn-dock-share-wa" class="btn-dock-wa" target="_blank" rel="noopener noreferrer" title="Open WhatsApp">
                    📲 WA
                </a>
            </div>

        </div>
    `;
}
