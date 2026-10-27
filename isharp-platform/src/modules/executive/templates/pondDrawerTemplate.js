/**
 * iSHARP DBMS 2.0 — Executive Pond Detail Drawer Template
 * Generates slide-out drawer markup for pond biosecurity, sampling metrics,
 * daily preparation milestones, and issue logs.
 * 
 * Clean Coding Standard: Pure HTML template functions.
 */

import { calculateDOC, buildPondProgressTimeline } from "../../../domain/biometrics.js";
import { formatNumber } from "../../../utils/formatters.js";

/**
 * Generates drawer HTML markup.
 * @param {object} params
 * @param {string} params.pondCode
 * @param {object|null} params.cycle
 * @param {Array<object>} [params.issues]
 * @param {number} [params.idleDays]
 * @param {boolean} [params.isProd]
 * @param {object|null} [params.dailyProgress]
 * @param {object|null} [params.pondData]
 * @returns {string}
 */
export function getDrawerHtml({ pondCode, cycle, issues = [], idleDays = 0, isProd = false, dailyProgress = null, pondData = null }) {
    const isNewStock = pondData?.syncState === "NEWLY_STOCKED_EXCEL";
    const isMidHarvest = pondData?.syncState === "HARVESTED_MIDWEEK_EXCEL";
    const progressLabel = pondData?.progressLabel || (isProd ? "Culture" : "Idle");
    const progressDays = pondData?.progressDays ?? idleDays;

    const docText = isProd
        ? (cycle && cycle.stck_date ? `${calculateDOC(cycle.stck_date, cycle.date_close)} DOC` : (isNewStock ? `${progressDays} DOC` : "—"))
        : `${progressDays} Days ${progressDays > 30 ? "⚠️ (>30d)" : ""}`;

    // Sub-title logic
    const subTitle = cycle 
        ? `Cycle Index: ${cycle.pond_index} • Stage: ${progressLabel}`
        : `Physical Pond • Progress: ${progressLabel} (${progressDays}d)`;

    // Build timeline model from domain helper
    const timeline = buildPondProgressTimeline(dailyProgress, cycle, pondData);

    return `
        <div class="drawer-header">
            <div>
                <div class="drawer-pond-title">Pond ${pondCode}</div>
                <div class="drawer-pond-sub">${subTitle}</div>
            </div>
            <button type="button" class="drawer-close-btn" id="btn-close-drawer">✕</button>
        </div>

        <div class="drawer-body">

            <!-- Mid-Week Sync Callout Banner -->
            ${isNewStock ? `
                <div class="drawer-sync-alert sync-alert-stocked">
                    <div style="font-weight: 800; font-size: 0.82rem; display: flex; align-items: center; gap: 0.4rem; color: #065f46;">
                        <span>🌱 Newly Stocked on ${dailyProgress?.stocking_date || 'Recent'} (${progressDays} DOC)</span>
                    </div>
                    <div style="font-size: 0.72rem; color: #047857; margin-top: 0.25rem; line-height: 1.35;">
                        Reported via Daily Status tracker. Species variety (VAN/MON) and full stocking batch telemetry will link automatically following Friday's Access DBMS sync.
                    </div>
                </div>
            ` : isMidHarvest ? `
                <div class="drawer-sync-alert sync-alert-harvested">
                    <div style="font-weight: 800; font-size: 0.82rem; display: flex; align-items: center; gap: 0.4rem; color: #92400e;">
                        <span>🚜 Harvested Mid-Week (${dailyProgress?.last_harvest_date || 'Recent'})</span>
                    </div>
                    <div style="font-size: 0.72rem; color: #b45309; margin-top: 0.25rem; line-height: 1.35;">
                        Pond transition to <strong>${progressLabel} (${progressDays}d)</strong> active in Daily Tracker. The previous cycle is pending formal termination in Friday's DBMS sync.
                    </div>
                </div>
            ` : ""}

            <!-- Quick Stat Grid -->
            <div class="drawer-stat-grid">
                <div class="drawer-stat-box">
                    <div class="drawer-stat-lbl">${isProd ? "Culture Age" : "Progress Stage"}</div>
                    <div class="drawer-stat-val" style="${!isProd && progressDays > 30 ? "color: #b45309; font-weight: 800;" : ""}">
                        ${isProd ? docText : `${progressLabel} (${progressDays}d)`}
                    </div>
                </div>
                <div class="drawer-stat-box">
                    <div class="drawer-stat-lbl">Species / Badge</div>
                    <div class="drawer-stat-val">${isProd ? (isNewStock ? "NEW (Pending)" : (cycle?.stck_species || "P. VANNAMEI")) : progressLabel}</div>
                </div>
                <div class="drawer-stat-box">
                    <div class="drawer-stat-lbl">Stocking Date</div>
                    <div class="drawer-stat-val" style="font-size: 0.95rem;">
                        ${isProd ? (cycle?.stck_date || dailyProgress?.stocking_date || "—") : "—"}
                    </div>
                </div>
                <div class="drawer-stat-box">
                    <div class="drawer-stat-lbl">Stocked Pieces</div>
                    <div class="drawer-stat-val" style="font-size: 1.05rem;">
                        ${isProd && cycle && cycle.stck_total ? formatNumber(cycle.stck_total) : (isNewStock ? "Pending Sync" : "—")}
                    </div>
                </div>
            </div>

            <!-- Daily Preparation & Progress Milestones (Compact Vertical Timeline matching hand sketch) -->
            ${timeline.hasAnyDate ? `
                <div class="drawer-section">
                    <div class="drawer-section-title">
                        <span>🗓️ Preparation &amp; Progress Timeline</span>
                        <span style="font-size: 0.7rem; color: #0284c7; font-weight: 700; background: #e0f2fe; padding: 0.1rem 0.45rem; border-radius: 4px;">
                            ${dailyProgress?.excel_as_of_date ? `As of ${dailyProgress.excel_as_of_date}` : "Daily Tracker"}
                        </span>
                    </div>

                    ${timeline.totalTurnaroundDays !== null ? `
                        <div class="v-tl-summary-banner">
                            <span>⏱️ <strong>${timeline.isStocked ? "Turnaround (Harvest → Stocking):" : "Elapsed Since Harvest:"}</strong></span>
                            <span class="v-tl-summary-days">${timeline.totalTurnaroundDays} days</span>
                        </div>
                    ` : ""}

                    <div class="compact-v-timeline">
                        ${timeline.steps.map((step, idx) => {
                            const isLast = idx === timeline.steps.length - 1;
                            return `
                                <div class="v-tl-item ${step.status}" data-step-key="${step.key}">
                                    <!-- Left Column: Event Name + Date underneath (Matching user sketch) -->
                                    <div class="v-tl-left">
                                        <div class="v-tl-title">${step.label}</div>
                                        <div class="v-tl-date">${step.date || "Pending"}</div>
                                    </div>

                                    <!-- Center Column: Node Circle Dot + Vertical Line Segment down to next node -->
                                    <div class="v-tl-center">
                                        <div class="v-tl-dot ${step.status}"></div>
                                        ${!isLast ? `<div class="v-tl-line ${step.segmentDone ? 'done' : 'pending'}"></div>` : ""}
                                    </div>

                                    <!-- Right Column: Status Tag at Node + Elapsed Days alongside the Line Segment -->
                                    <div class="v-tl-right">
                                        <div class="v-tl-node-meta">
                                            ${step.nodeBadge ? `<span class="v-tl-badge ${step.nodeBadgeClass || ''}">${step.nodeBadge}</span>` : ""}
                                        </div>
                                        ${!isLast ? `
                                            <div class="v-tl-segment-days ${step.segmentDays !== null ? 'has-days' : ''}">
                                                ${step.segmentLabel || ""}
                                            </div>
                                        ` : ""}
                                    </div>
                                </div>
                            `;
                        }).join("")}
                    </div>
                </div>
            ` : ""}

            <!-- Biometrics Sampling Preview (for active/established culture ponds) -->
            ${isProd && !isNewStock ? `
                <div class="drawer-section">
                    <div class="drawer-section-title">
                        <span>📊 Latest Growth Biometrics</span>
                    </div>
                    <div id="drawer-sampling-container" style="padding: 0.5rem; text-align: center; color: #64748b; font-size: 0.8rem;">
                        <span>Loading sampling history...</span>
                    </div>
                </div>
            ` : ""}

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
