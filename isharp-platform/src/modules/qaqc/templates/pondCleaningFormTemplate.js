/**
 * iSHARP QA/QC Inspection Portal — Pond Cleaning Inspection Form Template
 */

export function renderPondCleaningForm() {
    return `
        <div class="qaqc-form-wrapper">
            
            <!-- Top Navigation & Return Bar -->
            <div class="qaqc-nav-bar">
                <button type="button" class="btn-qaqc-back" id="btn-qaqc-back-to-hub">
                    &larr; Back to QA/QC Hub
                </button>
                <div class="qaqc-nav-right">
                    <button type="button" class="btn-qaqc-portal-return" data-nav-view="portal">
                        &larr; Back to Portal
                    </button>
                </div>
            </div>

            <!-- Page Title Header -->
            <div class="qaqc-form-header">
                <div class="qaqc-form-title-group">
                    <span class="qaqc-pill-badge">SECTION 1 &bull; POND TURNAROUND & BIOSECURITY</span>
                    <h1 class="qaqc-page-title">Pond Cleaning Inspection</h1>
                    <p class="qaqc-page-subtitle">
                        Standardized sign-off for pond dry-out, liner washing, sump desludging, and equipment sanitation.
                    </p>
                </div>
            </div>

            <!-- 2-Column Responsive Layout -->
            <div class="qaqc-form-layout">
                
                <!-- LEFT COLUMN: Data Entry & Checklist -->
                <div class="qaqc-col-entry">
                    
                    <!-- 1. Cascading 3-Step Drill-down Pond Selector -->
                    <div class="qaqc-card-panel">
                        <div class="qaqc-panel-header">
                            <span class="qaqc-step-badge">STEP 1</span>
                            <h3 class="qaqc-panel-title">Select Non-Production Pond</h3>
                            <span class="qaqc-hint-text">(Only IDLE, MAINTENANCE & PREPARATION ponds)</span>
                        </div>
                        
                        <div class="qaqc-cascading-grid">
                            <!-- 1.1 Module Picker -->
                            <div class="qaqc-field-group">
                                <label for="select-qaqc-module" class="qaqc-field-label">1. Module</label>
                                <select id="select-qaqc-module" class="qaqc-select-input">
                                    <option value="">Loading modules...</option>
                                </select>
                            </div>

                            <!-- 1.2 Row Picker -->
                            <div class="qaqc-field-group">
                                <label for="select-qaqc-row" class="qaqc-field-label">2. Row</label>
                                <select id="select-qaqc-row" class="qaqc-select-input" disabled>
                                    <option value="">Select Module first</option>
                                </select>
                            </div>

                            <!-- 1.3 Pond Picker -->
                            <div class="qaqc-field-group">
                                <label for="select-qaqc-pond" class="qaqc-field-label">3. Pond (Non-Production)</label>
                                <select id="select-qaqc-pond" class="qaqc-select-input" disabled>
                                    <option value="">Select Row first</option>
                                </select>
                            </div>
                        </div>

                        <!-- Resolved Pond Attribution Banner -->
                        <div id="qaqc-pond-context-bar" class="qaqc-context-bar hidden">
                            <div class="qaqc-ctx-item">
                                <span class="qaqc-ctx-label">Pond:</span>
                                <span class="qaqc-ctx-val highlight" id="ctx-pond-code">--</span>
                            </div>
                            <div class="qaqc-ctx-item">
                                <span class="qaqc-ctx-label">Cycle:</span>
                                <span class="qaqc-ctx-val" id="ctx-cycle-no">--</span>
                            </div>
                            <div class="qaqc-ctx-item">
                                <span class="qaqc-ctx-label">Pond Index:</span>
                                <span class="qaqc-ctx-val font-mono" id="ctx-pond-index">--</span>
                            </div>
                            <div class="qaqc-ctx-item">
                                <span class="qaqc-ctx-label">Current Status:</span>
                                <span class="qaqc-status-chip" id="ctx-pond-status">--</span>
                            </div>
                            <div class="qaqc-ctx-item">
                                <span class="qaqc-ctx-label">Dry Time:</span>
                                <span class="qaqc-ctx-val" id="ctx-idle-days">--</span>
                            </div>
                        </div>
                    </div>

                    <!-- 2. Inspection Metadata (Date, Inspector, Team) -->
                    <div class="qaqc-card-panel">
                        <div class="qaqc-panel-header">
                            <span class="qaqc-step-badge">STEP 2</span>
                            <h3 class="qaqc-panel-title">Inspection Parameters</h3>
                        </div>

                        <div class="qaqc-meta-grid">
                            <!-- Date Input -->
                            <div class="qaqc-field-group">
                                <label for="input-qaqc-date" class="qaqc-field-label">Inspection Date</label>
                                <input type="date" id="input-qaqc-date" class="qaqc-text-input" />
                                <span class="qaqc-sub-preview" id="preview-formatted-date">--</span>
                            </div>

                            <!-- Requestor / Inspector -->
                            <div class="qaqc-field-group">
                                <label for="input-qaqc-inspector" class="qaqc-field-label">Requestor / Inspector</label>
                                <input type="text" id="input-qaqc-inspector" class="qaqc-text-input" list="qaqc-staff-list" placeholder="e.g. Rosdi" value="Rosdi" />
                                <datalist id="qaqc-staff-list"></datalist>
                                <div class="qaqc-quick-chips">
                                    <button type="button" class="qaqc-chip-btn" data-set-inspector="Rosdi">Rosdi</button>
                                    <button type="button" class="qaqc-chip-btn" data-set-inspector="Mohd Azlie">Mohd Azlie</button>
                                    <button type="button" class="qaqc-chip-btn" data-set-inspector="Hairi Azha">Hairi Azha</button>
                                </div>
                            </div>
                        </div>

                        <!-- Cleaning Team Selection -->
                        <div class="qaqc-team-section">
                            <label class="qaqc-field-label">Cleaning Team</label>
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

                    <!-- 3. The 4 Standard Checklist Items -->
                    <div class="qaqc-card-panel">
                        <div class="qaqc-panel-header" style="justify-content: space-between;">
                            <div>
                                <span class="qaqc-step-badge">STEP 3</span>
                                <h3 class="qaqc-panel-title">Inspection Checklist</h3>
                            </div>
                            <!-- 1-Tap Quick Action -->
                            <button type="button" class="btn-all-pass" id="btn-qaqc-all-pass">
                                ⚡ All Pass ✅
                            </button>
                        </div>

                        <div class="qaqc-checklist-list">
                            
                            <!-- 1. Lining -->
                            <div class="qaqc-chk-item" data-item="lining">
                                <div class="qaqc-chk-info">
                                    <div class="qaqc-chk-title-row">
                                        <h4 class="qaqc-chk-title">1. Lining</h4>
                                        <span class="qaqc-item-state-badge pass" id="badge-chk-lining">Passed ✅</span>
                                    </div>
                                    <p class="qaqc-chk-desc">
                                        Brushed off sludge, algae, dead shrimp/fish/snail/barnacle (bottom, connector, side & bund lining).
                                    </p>
                                </div>
                                <div class="qaqc-chk-toggle-group">
                                    <button type="button" class="qaqc-toggle-btn pass active" data-toggle="lining" data-val="true">✅ Pass</button>
                                    <button type="button" class="qaqc-toggle-btn fail" data-toggle="lining" data-val="false">❌ Fail</button>
                                </div>
                            </div>

                            <!-- 2. Sump -->
                            <div class="qaqc-chk-item" data-item="sump">
                                <div class="qaqc-chk-info">
                                    <div class="qaqc-chk-title-row">
                                        <h4 class="qaqc-chk-title">2. Sump</h4>
                                        <span class="qaqc-item-state-badge pass" id="badge-chk-sump">Passed ✅</span>
                                    </div>
                                    <p class="qaqc-chk-desc">
                                        Clear from collected sludge, algae, dead shrimp/fish/snail, and all other rubbish/debris.
                                    </p>
                                </div>
                                <div class="qaqc-chk-toggle-group">
                                    <button type="button" class="qaqc-toggle-btn pass active" data-toggle="sump" data-val="true">✅ Pass</button>
                                    <button type="button" class="qaqc-toggle-btn fail" data-toggle="sump" data-val="false">❌ Fail</button>
                                </div>
                            </div>

                            <!-- 3. PWA & autofeeder -->
                            <div class="qaqc-chk-item" data-item="pwa">
                                <div class="qaqc-chk-info">
                                    <div class="qaqc-chk-title-row">
                                        <h4 class="qaqc-chk-title">3. PWA & autofeeder</h4>
                                        <span class="qaqc-item-state-badge pass" id="badge-chk-pwa">Passed ✅</span>
                                    </div>
                                    <p class="qaqc-chk-desc">
                                        Brushed off algae/barnacles on floaters & propellers, dead shrimp underneath cleared.
                                    </p>
                                </div>
                                <div class="qaqc-chk-toggle-group">
                                    <button type="button" class="qaqc-toggle-btn pass active" data-toggle="pwa" data-val="true">✅ Pass</button>
                                    <button type="button" class="qaqc-toggle-btn fail" data-toggle="pwa" data-val="false">❌ Fail</button>
                                </div>
                            </div>

                            <!-- 4. Jetty -->
                            <div class="qaqc-chk-item" data-item="jetty">
                                <div class="qaqc-chk-info">
                                    <div class="qaqc-chk-title-row">
                                        <h4 class="qaqc-chk-title">4. Jetty</h4>
                                        <span class="qaqc-item-state-badge pass" id="badge-chk-jetty">Passed ✅</span>
                                    </div>
                                    <p class="qaqc-chk-desc">
                                        Brushed off algae, dead shrimp/fish/snail/barnacle on walkways and supporting posts.
                                    </p>
                                </div>
                                <div class="qaqc-chk-toggle-group">
                                    <button type="button" class="qaqc-toggle-btn pass active" data-toggle="jetty" data-val="true">✅ Pass</button>
                                    <button type="button" class="qaqc-toggle-btn fail" data-toggle="jetty" data-val="false">❌ Fail</button>
                                </div>
                            </div>

                        </div>
                    </div>

                    <!-- 4. Defect / Rework Remarks (Optional / Promoted on Fail) -->
                    <div class="qaqc-card-panel" id="qaqc-defect-panel">
                        <div class="qaqc-panel-header">
                            <span class="qaqc-step-badge">STEP 4</span>
                            <h3 class="qaqc-panel-title">Defect Notes & Rework Instructions</h3>
                        </div>

                        <div class="qaqc-preset-remarks">
                            <button type="button" class="qaqc-remark-chip" data-remark="Sludge remnant at central sump">Sludge at sump</button>
                            <button type="button" class="qaqc-remark-chip" data-remark="Torn bund liner patch required">Liner patch needed</button>
                            <button type="button" class="qaqc-remark-chip" data-remark="Barnacles remain on paddlewheel floater">Barnacles on PWA</button>
                            <button type="button" class="qaqc-remark-chip" data-remark="Algae growth along jetty post">Algae on jetty</button>
                        </div>

                        <textarea id="input-qaqc-remarks" class="qaqc-textarea" rows="3" placeholder="Enter specific defect notes or leave empty if pristine..."></textarea>
                    </div>

                </div>

                <!-- RIGHT COLUMN: Real-Time WhatsApp Broadcast Engine & Logbook -->
                <div class="qaqc-col-output">
                    
                    <!-- Live WhatsApp Output Card -->
                    <div class="qaqc-card-panel qaqc-panel-sticky">
                        <div class="qaqc-panel-header">
                            <span class="qaqc-badge-wa">WHATSAPP LIVE PREVIEW</span>
                            <h3 class="qaqc-panel-title">Broadcast Output</h3>
                        </div>

                        <p class="qaqc-output-caption">
                            This message is auto-generated as you fill up the form. Click Save to commit to the database, then copy directly into your WhatsApp group.
                        </p>

                        <!-- Monospace WhatsApp Bubble Container -->
                        <div class="qaqc-wa-bubble-preview">
                            <pre id="qaqc-wa-message-text" class="qaqc-wa-pre">Loading preview...</pre>
                        </div>

                        <!-- Primary Action Buttons -->
                        <div class="qaqc-actions-stack">
                            <button type="button" class="btn-qaqc-primary" id="btn-qaqc-save">
                                💾 Save Inspection to Database
                            </button>
                            <button type="button" class="btn-qaqc-copy" id="btn-qaqc-copy-wa">
                                📋 Copy WhatsApp Message
                            </button>
                            <a id="btn-qaqc-share-wa" class="btn-qaqc-whatsapp" target="_blank" rel="noopener noreferrer">
                                📲 Open in WhatsApp
                            </a>
                        </div>
                    </div>

                    <!-- Recent Cleaning Logbook for Selected Pond -->
                    <div class="qaqc-card-panel" style="margin-top: 1.25rem;">
                        <div class="qaqc-panel-header">
                            <h3 class="qaqc-panel-title">Inspection History Logbook</h3>
                        </div>
                        <div id="qaqc-history-container" class="qaqc-history-box">
                            <p class="qaqc-empty-hint">Select a pond above to review historical cleaning sign-offs.</p>
                        </div>
                    </div>

                </div>

            </div>
        </div>
    `;
}
