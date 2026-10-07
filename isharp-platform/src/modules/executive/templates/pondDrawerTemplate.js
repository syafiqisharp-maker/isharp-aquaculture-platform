/**
 * iSHARP DBMS 2.0 — Executive Pond Detail Drawer Template
 * Generates slide-out drawer markup for pond biosecurity, sampling metrics, and issue logs.
 * 
 * Clean Coding Standard: Pure HTML template functions.
 */

import { calculateDOC } from "../../../domain/biometrics.js";
import { formatNumber } from "../../../utils/formatters.js";

/**
 * Generates drawer HTML markup.
 * @param {object} params
 * @returns {string}
 */
export function getDrawerHtml({ pondCode, cycle, issues = [], idleDays = 0, isProd = false }) {
    const docText = isProd
        ? (cycle && cycle.stck_date ? `${calculateDOC(cycle.stck_date, cycle.date_close)} DOC` : "—")
        : `${idleDays} Days ${idleDays > 30 ? "⚠️ (>30d)" : ""}`;

    return `
        <div class="drawer-header">
            <div>
                <div class="drawer-pond-title">Pond ${pondCode}</div>
                <div class="drawer-pond-sub">${cycle ? `Cycle Index: ${cycle.pond_index}` : "No active culture cycle"}</div>
            </div>
            <button type="button" class="drawer-close-btn" id="btn-close-drawer">✕</button>
        </div>

        <div class="drawer-body">
            <div class="drawer-stat-grid">
                <div class="drawer-stat-box">
                    <div class="drawer-stat-lbl">${isProd ? "Culture Age" : "Idle Duration"}</div>
                    <div class="drawer-stat-val" style="${!isProd && idleDays > 30 ? "color: #b45309; font-weight: 800;" : ""}">
                        ${docText}
                    </div>
                </div>
                <div class="drawer-stat-box">
                    <div class="drawer-stat-lbl">Species</div>
                    <div class="drawer-stat-val">${isProd && cycle ? (cycle.stck_species || "P. VANNAMEI") : "—"}</div>
                </div>
                <div class="drawer-stat-box">
                    <div class="drawer-stat-lbl">Stocking Date</div>
                    <div class="drawer-stat-val" style="font-size: 0.95rem;">${isProd && cycle && cycle.stck_date ? cycle.stck_date : "—"}</div>
                </div>
                <div class="drawer-stat-box">
                    <div class="drawer-stat-lbl">Stocked Pieces</div>
                    <div class="drawer-stat-val" style="font-size: 1.05rem;">${isProd && cycle && cycle.stck_total ? formatNumber(cycle.stck_total) : "—"}</div>
                </div>
            </div>

            <!-- Biometrics Sampling Preview -->
            <div class="drawer-section">
                <div class="drawer-section-title">
                    <span>📊 Latest Growth Biometrics</span>
                </div>
                <div id="drawer-sampling-container" style="padding: 0.5rem; text-align: center; color: #64748b; font-size: 0.8rem;">
                    <span>Loading sampling history...</span>
                </div>
            </div>

            <!-- Biosecurity & Pathology History -->
            <div class="drawer-section">
                <div class="drawer-section-title">
                    <span>🔬 Laboratory &amp; Pathogen Tests</span>
                    <span style="font-size: 0.72rem; color: #64748b; font-weight: 500;">(${issues.length} records)</span>
                </div>
                <div class="drawer-issues-list">
                    ${issues.length === 0 ? `
                        <div style="padding: 0.85rem; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; color: #166534; font-size: 0.78rem;">
                            🟢 <strong>Clean Biosecurity:</strong> No negative pathology or active pathogen alerts recorded for this cycle.
                        </div>
                    ` : issues.map(iss => {
                        const isRed = (iss.issue_flag || "").toUpperCase() === "RED" || (iss.pcr_result || "").toUpperCase() === "POSITIVE";
                        const isYellow = (iss.issue_flag || "").toUpperCase() === "YELLOW";
                        const css = isRed ? "risk-red" : isYellow ? "risk-yellow" : "";
                        return `
                            <div class="drawer-issue-item ${css}">
                                <div>
                                    <div style="font-weight: 800;">${iss.issue_status || "Pathology Test"} (${iss.issue_test || "PCR"})</div>
                                    <div style="font-size: 0.7rem; color: #64748b;">${iss.issue_date || "Recent"} • Grade: ${iss.issue_grade || "G0"}</div>
                                </div>
                                <div style="text-align: right;">
                                    <span class="status-badge ${isRed ? "status-close" : isYellow ? "status-idle" : "status-production"}">${iss.issue_flag || "OK"}</span>
                                    <div style="font-size: 0.7rem; font-weight: 700; margin-top: 0.2rem;">${iss.issue_note || "NEGATIVE"}</div>
                                </div>
                            </div>
                        `;
                    }).join("")}
                </div>
            </div>

        </div>

        <div class="drawer-footer">
            <button type="button" class="btn-open-dbms" id="btn-drawer-to-dbms" ${!cycle ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ""}>
                <span>⚙️ Open in DBMS View →</span>
            </button>
        </div>
    `;
}

/**
 * Generates sampling results HTML for inside the drawer.
 * @param {object} latest
 * @param {object} [cycle]
 * @returns {string}
 */
export function getDrawerSamplingHtml(latest, cycle) {
    if (!latest) {
        return `<div style="font-size: 0.76rem; color: #94a3b8; padding: 0.5rem;">No net-cast sampling data logged yet for this cycle.</div>`;
    }

    const abwVal = latest.smpl_abw ? `${parseFloat(latest.smpl_abw).toFixed(2)} g` : "—";
    const bmsVal = latest.smpl_bms ? `${Number(latest.smpl_bms).toLocaleString()} kg` : "—";
    const survVal = latest.smpl_srv ? `${parseFloat(latest.smpl_srv).toFixed(1)}%` : "—";
    const dateVal = latest.smpl_date || "Recent";

    return `
        <div class="drawer-stat-grid" style="margin-top: 0.25rem;">
            <div class="drawer-stat-box" style="background: #ffffff;">
                <div class="drawer-stat-lbl">Latest ABW</div>
                <div class="drawer-stat-val" style="color: #0284c7;">${abwVal}</div>
            </div>
            <div class="drawer-stat-box" style="background: #ffffff;">
                <div class="drawer-stat-lbl">Est. Biomass</div>
                <div class="drawer-stat-val" style="color: #059669;">${bmsVal}</div>
            </div>
            <div class="drawer-stat-box" style="background: #ffffff;">
                <div class="drawer-stat-lbl">Survival Rate (SR)</div>
                <div class="drawer-stat-val">${survVal}</div>
            </div>
            <div class="drawer-stat-box" style="background: #ffffff;">
                <div class="drawer-stat-lbl">Sample Date</div>
                <div class="drawer-stat-val" style="font-size: 0.88rem;">${dateVal}</div>
            </div>
        </div>
    `;
}
