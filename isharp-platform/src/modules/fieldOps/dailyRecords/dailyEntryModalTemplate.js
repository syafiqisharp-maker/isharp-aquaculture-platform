/**
 * iSHARP DBMS 2.0 — Field Operations: Daily Entry Sheet Modal Template
 * Generates interactive mobile modal markup for rapid field logging:
 * - Sequential pond switcher bar
 * - Tactile steppers (-5, -1, +1, +5) for feed and water level
 * - Consumption check tray remnant chips (0%, 5%, 10%, 15%, 25%)
 * - 3D Spherical water colour selection grid
 * - Dynamic mineral and probiotic application sections
 * 
 * Clean Coding Standard: Pure HTML template generator.
 */

import { calculateDOC } from "../../../domain/biometrics.js";
import {
    STANDARD_MINERALS,
    STANDARD_PROBIOTICS,
    WATER_COLOUR_OPTIONS
} from "./dailyRecordsConstants.js";

/**
 * Generates the modal HTML markup for daily pond logging.
 * @param {object} pond
 * @param {Array} [activePondsList=[]]
 * @param {boolean} [isModalOnlyMode=false]
 * @returns {string}
 */
export function renderDailyEntryModalMarkup(pond, activePondsList = [], isModalOnlyMode = false) {
    const pondLabel = pond ? (pond.pond || pond.pond_index || "Pond") : "Pond";
    const doc = pond && pond.stck_date ? calculateDOC(pond.stck_date, pond.date_close) : "—";

    return `
        <div id="modal-daily-entry" class="modal-backdrop-aero hidden" style="display: none !important;">
            <form id="form-daily-record" class="modal-sheet-aero" novalidate style="margin: 0;">
                
                <!-- Modal Sheet Header with Pond Title & Close -->
                <div class="modal-sheet-header">
                    <div>
                        <div class="modal-sheet-title">
                            <span style="font-size: 1.25rem;">⚡</span>
                            <span id="modal-entry-title">Pond ${pondLabel} — Daily Log</span>
                        </div>
                        <span id="modal-entry-subtitle" style="font-size: 0.72rem; color: #64748b; margin-left: 28px; display: block;"></span>
                    </div>
                    <button type="button" id="btn-close-entry-modal" class="aero-btn aero-btn-secondary" style="padding: 4px 12px; min-height: 32px; font-size: 0.78rem;">
                        ✕ Close
                    </button>
                </div>

                <!-- Autocomplete Datalists -->
                <datalist id="minerals-autocomplete">
                    ${STANDARD_MINERALS.map(m => `<option value="${m}"></option>`).join("")}
                </datalist>
                <datalist id="probiotics-autocomplete">
                    ${STANDARD_PROBIOTICS.map(p => `<option value="${p}"></option>`).join("")}
                </datalist>

                <!-- Modal Sheet Body (Scrollable) -->
                <div class="modal-sheet-body">

                    <!-- Sequential Pond Switcher Bar (When multiple active ponds exist in module) -->
                    ${(activePondsList && activePondsList.length > 1) ? (() => {
                        const currIdx = activePondsList.findIndex(p =>
                            (p.pond_index && p.pond_index === pond?.pond_index) ||
                            (p.pond && p.pond === pond?.pond)
                        );
                        const displayIdx = currIdx >= 0 ? currIdx + 1 : 1;
                        return `
                            <div id="modal-pond-switcher-bar" style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; background: rgba(224, 242, 254, 0.75); border: 1.5px solid #bae6fd; border-radius: 14px; padding: 0.45rem 0.75rem; flex-shrink: 0;">
                                <button type="button" id="btn-modal-prev-pond" class="btn-modal-pond-nav aero-btn aero-btn-secondary" style="padding: 0.35rem 0.65rem; font-size: 0.76rem; min-height: 32px;">
                                    ◀ Prev
                                </button>
                                <div style="text-align: center; flex: 1; min-width: 0; padding: 0 0.35rem;">
                                    <div id="modal-switcher-pond-title" style="font-family: 'Space Grotesk', monospace; font-size: 0.92rem; font-weight: 900; color: #0284c7; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                        Pond ${pondLabel} · DOC ${doc || '—'}
                                    </div>
                                    <div id="modal-switcher-pond-subtitle" style="font-size: 0.7rem; font-weight: 700; color: #475569; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                        Active Pond ${displayIdx} of ${activePondsList.length}${isModalOnlyMode ? ` · <button type="button" id="btn-modal-open-full-book" style="background: none; border: none; color: #0284c7; font-weight: 800; font-size: 0.7rem; text-decoration: underline; cursor: pointer; padding: 0;">📖 Full Book</button>` : ''}
                                    </div>
                                </div>
                                <button type="button" id="btn-modal-next-pond" class="btn-modal-pond-nav aero-btn aero-btn-secondary" style="padding: 0.35rem 0.65rem; font-size: 0.76rem; min-height: 32px;">
                                    Next ▶
                                </button>
                            </div>
                        `;
                    })() : ''}

                    <!-- Smart Yesterday Carry-Forward Banner -->
                    <div id="carry-forward-badge" style="display: none; background: rgba(224, 242, 254, 0.75); border: 1.5px solid #bae6fd; border-radius: 12px; padding: 8px 12px; font-size: 0.75rem; color: #0369a1; font-weight: 700; align-items: center; justify-content: space-between; gap: 6px; flex-shrink: 0;">
                        <span id="carry-forward-text">↺ Pre-filled from yesterday (tap steppers to adjust)</span>
                        <span style="font-size: 0.66rem; background: #dcfce7; color: #15803d; padding: 0.15rem 0.55rem; border-radius: 999px; font-weight: 800; white-space: nowrap;">Smart Fill</span>
                    </div>

                    <!-- Date & DOC Selector -->
                    <div class="form-aero-section" style="padding: 0.85rem 1.1rem;">
                        <div style="display: grid; grid-template-columns: 1fr 125px; gap: 0.85rem; align-items: center;">
                            <div>
                                <label style="font-size: 0.76rem; font-weight: 800; color: var(--aero-deep-ocean); display: block; margin-bottom: 0.25rem;">
                                    📅 Record Date
                                </label>
                                <input type="date" id="input-entry-date" class="form-control" style="font-size: 0.9rem; font-weight: 700; padding: 0.45rem 0.75rem; border-radius: 10px; border: 1.5px solid #cbd5e1; width: 100%; box-sizing: border-box;" required />
                            </div>
                            <div style="text-align: center; background: rgba(240, 249, 255, 0.8); border: 1px solid #bae6fd; border-radius: 10px; padding: 0.4rem 0.5rem;">
                                <span style="font-size: 0.68rem; font-weight: 700; color: #64748b; display: block;">Culture Age</span>
                                <div id="modal-calc-doc" style="font-family: 'Space Grotesk', monospace; font-size: 1.15rem; font-weight: 800; color: #0284c7; margin-top: 0.1rem;">
                                    DOC —
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 1. FEED TODAY (KG) WITH TACTILE CONVEX STEPPERS -->
                    <div class="form-aero-section">
                        <div class="form-section-label">
                            <span>🦐 Daily Feed (kg)</span>
                            <span id="feed-yesterday-hint" style="color: var(--aero-cerulean); font-size: 0.72rem; font-weight: 700;">Tap steppers to adjust</span>
                        </div>
                        <input type="number" id="input-feed-kg" class="aero-num-input" step="0.1" min="0" placeholder="0.0" />
                        <div class="stepper-row">
                            <button type="button" class="aero-stepper-btn btn-feed-stepper" data-step="-5">-5</button>
                            <button type="button" class="aero-stepper-btn btn-feed-stepper" data-step="-1">-1</button>
                            <button type="button" class="aero-stepper-btn btn-feed-stepper" data-step="1">+1</button>
                            <button type="button" class="aero-stepper-btn btn-feed-stepper" data-step="5">+5</button>
                        </div>
                    </div>

                    <!-- 2. TRAY REMNANT LEFTOVER (%) WITH TACTILE CHIPS -->
                    <div class="form-aero-section">
                        <div class="form-section-label">
                            <span>🍽️ Tray Remnant Leftover (%)</span>
                            <span style="color: var(--aero-cerulean); font-size: 0.72rem; font-weight: 700;">Consumption assessment</span>
                        </div>
                        <input type="number" id="input-tray-pct" class="aero-num-input" step="1" min="0" max="100" placeholder="0" />
                        <div class="stepper-row">
                            <button type="button" class="aero-stepper-btn btn-tray-chip" data-pct="0">0%</button>
                            <button type="button" class="aero-stepper-btn btn-tray-chip" data-pct="5">5%</button>
                            <button type="button" class="aero-stepper-btn btn-tray-chip" data-pct="10">10%</button>
                            <button type="button" class="aero-stepper-btn btn-tray-chip" data-pct="15">15%</button>
                            <button type="button" class="aero-stepper-btn btn-tray-chip" data-pct="25">25%</button>
                        </div>
                    </div>

                    <!-- 3. WATER LEVEL (CM) WITH TACTILE STEPPERS -->
                    <div class="form-aero-section">
                        <div class="form-section-label">
                            <span>🌊 Water Level / Depth (cm)</span>
                            <span style="color: var(--aero-cerulean); font-size: 0.72rem; font-weight: 700;">Target: 110 cm</span>
                        </div>
                        <input type="number" id="input-water-level" class="aero-num-input" step="1" min="0" placeholder="110" />
                        <div class="stepper-row">
                            <button type="button" class="aero-stepper-btn btn-water-stepper" data-step="-5">-5</button>
                            <button type="button" class="aero-stepper-btn btn-water-stepper" data-step="-2">-2</button>
                            <button type="button" class="aero-stepper-btn btn-water-stepper" data-step="2">+2</button>
                            <button type="button" class="aero-stepper-btn btn-water-stepper" data-step="5">+5</button>
                        </div>
                    </div>

                    <!-- 4. WATER COLOUR 3D SPHERICAL SELECTION -->
                    <div class="form-aero-section">
                        <div class="form-section-label">
                            <span>🎨 Water Colour Tone</span>
                            <span id="selected-water-colour-label" style="color: var(--aero-cerulean); font-size: 0.72rem; font-weight: 700;">Light Green (Healthy Diatom)</span>
                        </div>
                        <input type="hidden" id="input-water-colour" value="Light Green (Healthy Diatom)" />
                        <div class="water-colour-palette" id="water-colour-swatches">
                            ${WATER_COLOUR_OPTIONS.map((o, idx) => `
                                <div class="water-swatch-card ${idx === 0 ? 'selected' : ''}" data-val="${o.value}">
                                    <div class="water-sphere" style="background: ${o.orbBg}; border-color: ${o.orbBorder};"></div>
                                    <span class="swatch-name">${o.label}</span>
                                </div>
                            `).join("")}
                        </div>
                    </div>

                    <!-- 5. DAILY MORTALITY IN KG -->
                    <div class="form-aero-section">
                        <div class="form-section-label">
                            <span>⚠️ Scooped Mortality (kg)</span>
                            <span style="color: var(--aero-ink-subtle); font-size: 0.72rem; font-weight: 700;">Kilograms only</span>
                        </div>
                        <input type="number" id="input-mortality" class="aero-num-input" min="0" step="0.1" placeholder="0.0" />
                    </div>

                    <!-- 6. OBSERVATIONS & REMARKS -->
                    <div class="form-aero-section">
                        <div class="form-section-label">
                            <span>📝 Daily Observations &amp; Remarks</span>
                        </div>
                        <input type="text" id="input-remarks" class="form-control" placeholder="e.g. Shrimp active on trays, liming after rain..." style="width: 100%; font-size: 0.88rem; padding: 0.65rem 0.85rem; border-radius: 10px; border: 1.5px solid #cbd5e1; box-sizing: border-box;" />
                    </div>

                    <!-- 7. PROGRESSIVE DISCLOSURE: OPTIONAL TREATMENTS BAR -->
                    <div class="optional-sections-toggle-bar" style="display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap; background: rgba(248, 250, 252, 0.8); padding: 0.55rem 0.8rem; border-radius: 12px; border: 1px dashed #cbd5e1;">
                        <span style="font-size: 0.72rem; font-weight: 800; color: #64748b; text-transform: uppercase;">Optional Treatments:</span>
                        <button type="button" id="btn-toggle-minerals-sec" class="quick-toggle-pill">🧪 + Minerals</button>
                        <button type="button" id="btn-toggle-probiotics-sec" class="quick-toggle-pill">🦠 + Probiotics</button>
                    </div>

                    <!-- SECTION A: MINERALS APPLIED (Collapsible) -->
                    <div id="section-minerals-card" class="form-aero-section" style="display: none; border-left: 4px solid #0284c7;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.65rem;">
                            <div style="font-weight: 800; color: #0284c7; font-size: 0.85rem; display: flex; align-items: center; gap: 0.4rem;">
                                <span>🧪 Minerals Applied</span>
                            </div>
                            <button type="button" id="btn-add-mineral-row" class="aero-btn aero-btn-secondary" style="font-size: 0.74rem; padding: 3px 10px; min-height: 28px;">
                                + Add Item
                            </button>
                        </div>
                        <div id="mineral-rows-container" style="display: flex; flex-direction: column; gap: 0.5rem;"></div>
                    </div>

                    <!-- SECTION B: PROBIOTICS & FERMENTS (Collapsible) -->
                    <div id="section-probiotics-card" class="form-aero-section" style="display: none; border-left: 4px solid #d97706;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.65rem;">
                            <div style="font-weight: 800; color: #92400e; font-size: 0.85rem; display: flex; align-items: center; gap: 0.4rem;">
                                <span>🦠 Probiotics &amp; Fermentation</span>
                            </div>
                            <button type="button" id="btn-add-probiotic-row" class="aero-btn aero-btn-secondary" style="font-size: 0.74rem; padding: 3px 10px; min-height: 28px;">
                                + Add Product
                            </button>
                        </div>
                        <div id="probiotic-rows-container" style="display: flex; flex-direction: column; gap: 0.5rem;"></div>
                    </div>

                </div>

                <!-- Modal Sheet Footer (Sticky Dock) -->
                <div class="modal-sheet-footer">
                    <button type="button" id="btn-delete-entry" class="aero-btn" style="background: #fee2e2; border: 1.5px solid #fca5a5; color: #b91c1c; font-weight: 800; padding: 0.55rem 0.85rem; display: none;">
                        🗑️ Delete
                    </button>
                    <button type="button" id="btn-cancel-modal" class="aero-btn aero-btn-secondary" style="flex: 1;">
                        Cancel
                    </button>
                    <button type="submit" id="btn-save-record" class="aero-btn aero-btn-primary" style="flex: 2;">
                        💾 Save
                    </button>
                    ${(activePondsList && activePondsList.length > 1) ? `
                        <button type="button" id="btn-save-and-next" class="aero-btn aero-btn-primary" style="flex: 2;">
                            ⚡ Save &amp; Next ➔
                        </button>
                    ` : ''}
                </div>

            </form>
        </div>
    `;
}
