/**
 * iSHARP DBMS 2.0 — Executive Production & Biomass Template
 * Pure HTML template generators for the Executive Biomass view:
 * - Cohort Focus Switcher
 * - 6-Tile Pastel KPI Grid
 * - Harvest Readiness Pipeline Table & Filter Pills
 * - 12-Month Performance Ledger & Packout Distribution
 * 
 * Clean Coding Standard: Pure template generator functions, zero side effects.
 */

/**
 * Filters evaluated ponds by pipeline category tab.
 * @param {Array<object>} evaluatedPonds
 * @param {string} pipelineFilter
 * @param {object} forecast14d
 * @returns {Array<object>}
 */
export function filterPondsForPipeline(evaluatedPonds = [], pipelineFilter = "ALL", forecast14d = {}) {
    if (pipelineFilter === "OPTIMUM") {
        return evaluatedPonds.filter(p => p.classification?.category === "OPTIMUM");
    } else if (pipelineFilter === "MINIMUM") {
        return evaluatedPonds.filter(p => p.classification?.category === "MINIMUM");
    } else if (pipelineFilter === "ALERT") {
        return evaluatedPonds.filter(p => p.classification?.category === "ALERT");
    } else if (pipelineFilter === "MISSING_SURV") {
        return evaluatedPonds.filter(p => !p.hasSurvSample);
    } else if (pipelineFilter === "FORECAST") {
        const candidatePonds = forecast14d?.candidatePonds || [];
        return candidatePonds.map(p => ({
            ...p,
            classification: {
                label: p.willBeOptimum ? "🌟 14d Optimum" : "🟡 14d Minimum",
                badgeType: p.willBeOptimum ? "emerald" : "amber",
                actionText: "Reserve Intake",
                reason: `Projected +${p.projectedAbw}g in 14d`,
                metricsDetail: `Projected +${p.projectedAbw}g in 14d • Day +14: ${p.projectedDoc || (p.doc + 14)}d`
            }
        }));
    } else {
        // ALL Harvestable
        return evaluatedPonds.filter(p => {
            const cat = p.classification?.category;
            return cat === "OPTIMUM" || cat === "MINIMUM" || cat === "ALERT";
        });
    }
}

/**
 * Generates table rows for the Harvest Readiness Pipeline
 * @param {Array<object>} evaluatedPonds
 * @param {string} pipelineFilter
 * @param {object} forecast14d
 * @returns {string}
 */
export function renderPipelineRowsHtml(evaluatedPonds = [], pipelineFilter = "ALL", forecast14d = {}) {
    const displayList = filterPondsForPipeline(evaluatedPonds, pipelineFilter, forecast14d);

    if (displayList.length === 0) {
        return `<tr><td colspan="10" style="padding: 1.5rem; text-align: center; color: #94a3b8;">No ponds match filter "${pipelineFilter}".</td></tr>`;
    }

    return displayList.slice(0, 30).map(p => {
        const cl = p.classification || {};
        const isOpt = cl.category === "OPTIMUM";
        const isMin = cl.category === "MINIMUM";
        const isAlert = cl.category === "ALERT";

        let badgeHtml = "";
        if (isOpt) {
            badgeHtml = `<span style="display: inline-flex; align-items: center; gap: 4px; padding: 0.15rem 0.45rem; border-radius: 9999px; font-size: 0.68rem; font-weight: 700; background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0;"><span style="width: 5px; height: 5px; border-radius: 50%; background: #10b981;"></span>${cl.label}</span>`;
        } else if (isMin) {
            badgeHtml = `<span style="display: inline-flex; align-items: center; gap: 4px; padding: 0.15rem 0.45rem; border-radius: 9999px; font-size: 0.68rem; font-weight: 700; background: #fff7ed; color: #9a3412; border: 1px solid #fed7aa;"><span style="width: 5px; height: 5px; border-radius: 50%; background: #f97316;"></span>${cl.label}</span>`;
        } else if (isAlert) {
            badgeHtml = `<span style="display: inline-flex; align-items: center; gap: 4px; padding: 0.15rem 0.45rem; border-radius: 9999px; font-size: 0.68rem; font-weight: 700; background: #fff1f2; color: #9f1239; border: 1px solid #fecdd3;"><span style="width: 5px; height: 5px; border-radius: 50%; background: #f43f5e;"></span>${cl.label}</span>`;
        } else {
            badgeHtml = `<span style="display: inline-flex; align-items: center; gap: 4px; padding: 0.15rem 0.45rem; border-radius: 9999px; font-size: 0.68rem; font-weight: 700; background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1;">${cl.label || "—"}</span>`;
        }

        const speciesBadge = p.species === "MON"
            ? `<span style="padding: 0.15rem 0.35rem; border-radius: 4px; font-size: 0.65rem; font-weight: 800; background: #fff7ed; color: #c2410c; border: 1px solid #ffedd5;">MON</span>`
            : `<span style="padding: 0.15rem 0.35rem; border-radius: 4px; font-size: 0.65rem; font-weight: 800; background: #f0f9ff; color: #0284c7; border: 1px solid #e0f2fe;">VAN</span>`;

        const biosecurityLabel = p.issueFlag === "RED"
            ? `<span style="color: #e11d48; font-weight: 700;">🔴 ${p.issueNote || "RED Flag"}</span>`
            : p.issueFlag === "YELLOW"
            ? `<span style="color: #d97706; font-weight: 600;">🟡 ${p.issueNote || "Warning"}</span>`
            : `<span style="color: #059669; font-weight: 600;">🟢 Clean</span>`;

        const biomassDisplay = (p.hasSurvSample && p.biomassKg > 0)
            ? `${p.biomassKg.toLocaleString()} kg`
            : `<span style="display: inline-flex; align-items: center; gap: 3px; color: #b45309; background: #fef3c7; padding: 0.1rem 0.35rem; border-radius: 4px; font-size: 0.65rem; font-weight: 700;" title="Survival rate missing in sampling (smpl_surv is null/0) — excluded from biomass calculations">⚠️ Missing SR</span>`;

        return `
            <tr class="pond-row" style="border-bottom: 1px solid #f8fafc; transition: background 0.15s ease;">
                <td style="padding: 0.6rem 1rem; font-weight: 800; color: #0f172a; font-family: ui-monospace, monospace;">${p.pond || "—"}</td>
                <td style="padding: 0.6rem 0.75rem;">${speciesBadge}</td>
                <td style="padding: 0.6rem 0.75rem;">
                    <div>${badgeHtml}</div>
                    <div style="font-size: 0.67rem; color: #475569; margin-top: 2px; line-height: 1.25;">
                        ${cl.metricsDetail || cl.reason || ""}
                    </div>
                </td>
                <td style="padding: 0.6rem 0.75rem; text-align: right; font-family: ui-monospace, monospace;">
                    <div style="font-weight: 700; color: #0f172a;">${p.abw > 0 ? p.abw.toFixed(2) + " g" : "—"}</div>
                    ${p.abw > 0 ? `<div style="font-size: 0.64rem; color: ${isOpt ? '#059669' : isMin ? '#c2410c' : '#64748b'};">${isOpt ? 'Prime Weight' : isMin ? 'Commercial' : (p.species === 'MON' ? 'Target: 25g+' : 'Target: 10g+')}</div>` : ''}
                </td>
                <td style="padding: 0.6rem 0.75rem; text-align: right; font-family: ui-monospace, monospace;">
                    <div style="color: #334155; font-weight: 600;">${p.doc > 0 ? p.doc + " d" : "—"}</div>
                    <div style="font-size: 0.64rem; color: #94a3b8;">${p.doc >= 80 ? 'Finishing' : p.doc >= 50 ? 'Mid-Grow' : 'Early'}</div>
                </td>
                <td style="padding: 0.6rem 0.75rem; text-align: right; font-weight: 700; color: #0284c7; font-family: ui-monospace, monospace;">${biomassDisplay}</td>
                <td style="padding: 0.6rem 0.75rem; text-align: right; font-family: ui-monospace, monospace;">
                    <div style="font-weight: 700; color: ${p.adg >= 0.20 ? '#059669' : p.adg >= 0.15 ? '#d97706' : '#e11d48'};">
                        ${p.adg > 0 ? p.adg.toFixed(2) + " g/d" : "—"}
                    </div>
                    <div style="font-size: 0.63rem; color: #94a3b8;">Cumulative</div>
                </td>
                <td style="padding: 0.6rem 0.75rem; text-align: right; font-family: ui-monospace, monospace;">
                    <div style="font-weight: 700; color: ${p.awg >= 0.20 ? '#059669' : p.awg >= 0.15 ? '#d97706' : '#e11d48'};">
                        ${p.awg > 0 ? p.awg.toFixed(2) + " g/d" : (p.adg > 0 ? p.adg.toFixed(2) + " g/d" : "—")}
                    </div>
                    <div style="font-size: 0.63rem; color: #64748b;">
                        ${p.weeklyGainG > 0 ? `+${p.weeklyGainG.toFixed(2)} g/wk` : (p.adg > 0 ? `+${(p.adg * 7).toFixed(2)} g/wk` : "—")}
                    </div>
                </td>
                <td style="padding: 0.6rem 0.75rem; font-size: 0.72rem;">
                    ${cl.ehpStatus === "TOLERANT_GOOD_GROWTH"
                        ? `<span style="display: inline-flex; align-items: center; gap: 3px; background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; padding: 0.1rem 0.4rem; border-radius: 4px; font-weight: 700;">🟢 EHP+ (Good Growth)</span>`
                        : cl.ehpStatus === "STUNTED"
                        ? `<span style="display: inline-flex; align-items: center; gap: 3px; background: #fff1f2; color: #b91c1c; border: 1px solid #fecaca; padding: 0.1rem 0.4rem; border-radius: 4px; font-weight: 700;">🚨 EHP Stunted</span>`
                        : cl.ehpStatus === "SLOWDOWN"
                        ? `<span style="display: inline-flex; align-items: center; gap: 3px; background: #fffbeb; color: #b45309; border: 1px solid #fde68a; padding: 0.1rem 0.4rem; border-radius: 4px; font-weight: 700;">⚠️ EHP Slowdown</span>`
                        : biosecurityLabel
                    }
                </td>
                <td style="padding: 0.6rem 1rem; text-align: right;">
                    <button type="button" class="btn-action-gate" data-pond="${p.pond}" data-index="${p.pondIndex}" style="padding: 0.25rem 0.6rem; font-size: 0.68rem; font-weight: 700; border-radius: 6px; border: 1px solid #cbd5e1; background: #ffffff; cursor: pointer; transition: all 0.15s ease;">
                        ${cl.actionText || "Details"}
                    </button>
                </td>
            </tr>
        `;
    }).join("");
}

/**
 * Generates summary footer row for the filtered pipeline ponds.
 * @param {Array<object>} displayList
 * @returns {string}
 */
export function renderPipelineFooterHtml(displayList = []) {
    if (!displayList || displayList.length === 0) return "";
    const count = displayList.length;
    const totalBiomassKg = displayList.reduce((acc, p) => acc + (p.hasSurvSample ? (Number(p.biomassKg) || 0) : 0), 0);
    const totalBiomassTons = (totalBiomassKg / 1000).toFixed(1);
    const validAbwList = displayList.filter(p => Number(p.abw) > 0);
    const meanAbw = validAbwList.length > 0
        ? (validAbwList.reduce((acc, p) => acc + Number(p.abw), 0) / validAbwList.length).toFixed(1)
        : "—";
    const validAdgList = displayList.filter(p => Number(p.adg) > 0);
    const meanAdg = validAdgList.length > 0
        ? (validAdgList.reduce((acc, p) => acc + Number(p.adg), 0) / validAdgList.length).toFixed(2)
        : "—";
    const validAwgList = displayList.filter(p => Number(p.awg) > 0);
    const meanAwg = validAwgList.length > 0
        ? (validAwgList.reduce((acc, p) => acc + Number(p.awg), 0) / validAwgList.length).toFixed(2)
        : "—";

    return `
        <tr style="background: #f8fafc; font-weight: 700; border-top: 2px solid #cbd5e1; font-size: 0.74rem; color: #0f172a;">
            <td style="padding: 0.65rem 1rem;">Total: ${count} Ponds</td>
            <td style="padding: 0.65rem 0.75rem;">—</td>
            <td style="padding: 0.65rem 0.75rem; color: #64748b;">Cohort Summary</td>
            <td style="padding: 0.65rem 0.75rem; text-align: right; font-family: ui-monospace, monospace;">Avg: ${meanAbw} g</td>
            <td style="padding: 0.65rem 0.75rem; text-align: right; color: #64748b;">—</td>
            <td style="padding: 0.65rem 0.75rem; text-align: right; font-weight: 800; color: #0284c7; font-family: ui-monospace, monospace;">${totalBiomassTons} Tons</td>
            <td style="padding: 0.65rem 0.75rem; text-align: right; font-family: ui-monospace, monospace; color: #059669;">Avg: ${meanAdg} g/d</td>
            <td style="padding: 0.65rem 0.75rem; text-align: right; font-family: ui-monospace, monospace; color: #059669;">Avg: ${meanAwg} g/d</td>
            <td style="padding: 0.65rem 0.75rem; color: #64748b;">—</td>
            <td style="padding: 0.65rem 1rem; text-align: right; color: #64748b;">—</td>
        </tr>
    `;
}

/**
 * Renders the Commercial Quality Packout and Off-Taker Intelligence Card
 * @param {object} params
 * @param {object} params.packout
 * @param {Array<object>} params.topBuyers
 * @param {string} [params.currentSpecies="ALL"]
 * @param {number} [params.top3Concentration=0]
 * @returns {string}
 */
export function renderCommercialPackoutCardHtml({
    packout = {},
    topBuyers = [],
    currentSpecies = "ALL",
    top3Concentration = 0
}) {
    const p = packout || { goodPct: 0, secondPct: 0, smallPct: 0, rejectPct: 0 };
    const goodTons = p.goodTons || ((p.goodKg || 0) / 1000).toFixed(1);
    const secTons = p.secondTons || ((p.secondKg || 0) / 1000).toFixed(1);
    const smallTons = p.smallTons || ((p.smallKg || 0) / 1000).toFixed(1);
    const rejectTons = p.rejectTons || ((p.rejectKg || 0) / 1000).toFixed(1);
    const totalTons = p.totalTons || ((p.totalKg || 0) / 1000).toFixed(1);
    const downgradeLossRm = p.downgradeLossRm || 0;

    // Target benchmark for Prime Good Grade
    const isGoodTargetMet = (p.goodPct || 0) >= 75.0;
    const isSmallElevated = (p.smallPct || 0) > 15.0;
    const isRejectElevated = (p.rejectPct || 0) > 2.0;

    return `
        <div id="card-commercial-packout" class="sleek-card" style="padding: 1.25rem; display: flex; flex-direction: column; justify-content: space-between; gap: 1.1rem;">
            <div style="display: flex; flex-direction: column; gap: 0.9rem;">
                <!-- Header with Species Switcher -->
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; flex-wrap: wrap;">
                    <div>
                        <div style="font-size: 0.88rem; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 6px;">
                            <span>Commercial Quality Packout</span>
                            <span style="font-size: 0.65rem; font-weight: 700; padding: 0.1rem 0.4rem; border-radius: 4px; background: #e0f2fe; color: #0369a1;">${p.ytdYear || 2026} YTD</span>
                        </div>
                        <div style="font-size: 0.70rem; color: #64748b; margin-top: 2px;">
                            ${p.ytdYear || 2026} Year-to-Date grading & buyer off-taker sales (${totalTons} MT Total)
                        </div>
                    </div>
                    <div class="segmented-control" style="display: inline-flex; background: #f1f5f9; padding: 2px; border-radius: 6px; border: 1px solid #e2e8f0;">
                        <button type="button" class="btn-packout-species ${currentSpecies === 'ALL' ? 'active' : ''}" data-packout-species="ALL" style="padding: 0.2rem 0.55rem; font-size: 0.68rem; font-weight: 700; border-radius: 4px; border: none; cursor: pointer; transition: all 0.15s ease; ${currentSpecies === 'ALL' ? 'background: #0284c7; color: #ffffff; box-shadow: 0 1px 2px rgba(0,0,0,0.05);' : 'background: transparent; color: #64748b;'}">All</button>
                        <button type="button" class="btn-packout-species ${currentSpecies === 'VAN' ? 'active' : ''}" data-packout-species="VAN" style="padding: 0.2rem 0.55rem; font-size: 0.68rem; font-weight: 700; border-radius: 4px; border: none; cursor: pointer; transition: all 0.15s ease; ${currentSpecies === 'VAN' ? 'background: #0284c7; color: #ffffff; box-shadow: 0 1px 2px rgba(0,0,0,0.05);' : 'background: transparent; color: #64748b;'}">Vannamei</button>
                        <button type="button" class="btn-packout-species ${currentSpecies === 'MON' ? 'active' : ''}" data-packout-species="MON" style="padding: 0.2rem 0.55rem; font-size: 0.68rem; font-weight: 700; border-radius: 4px; border: none; cursor: pointer; transition: all 0.15s ease; ${currentSpecies === 'MON' ? 'background: #c2410c; color: #ffffff; box-shadow: 0 1px 2px rgba(0,0,0,0.05);' : 'background: transparent; color: #64748b;'}">Monodon</button>
                    </div>
                </div>

                <!-- 100% Proportional Stacked Bar -->
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.68rem; color: #64748b; margin-bottom: 0.35rem; font-weight: 600;">
                        <span>Packout Composition (100%)</span>
                        <span>Target: ≥ 75% Prime</span>
                    </div>
                    <div style="width: 100%; height: 11px; background: #e2e8f0; border-radius: 9999px; overflow: hidden; display: flex; box-shadow: inset 0 1px 2px rgba(0,0,0,0.05);" title="Prime: ${p.goodPct}% | 2nd: ${p.secondPct}% | Small: ${p.smallPct}% | Rejects: ${p.rejectPct}%">
                        <div style="width: ${p.goodPct}%; background: #10b981; height: 100%; transition: width 0.3s ease;" title="Prime Good Grade: ${p.goodPct}% (${goodTons} MT)"></div>
                        <div style="width: ${p.secondPct}%; background: #38bdf8; height: 100%; transition: width 0.3s ease;" title="2nd Grade: ${p.secondPct}% (${secTons} MT)"></div>
                        <div style="width: ${p.smallPct}%; background: #fb923c; height: 100%; transition: width 0.3s ease;" title="Small Grade: ${p.smallPct}% (${smallTons} MT)"></div>
                        <div style="width: ${p.rejectPct}%; background: #f43f5e; height: 100%; transition: width 0.3s ease;" title="Below / Rejects: ${p.rejectPct}% (${rejectTons} MT)"></div>
                    </div>
                </div>

                <!-- 4-Grid Grade Cards -->
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem; font-size: 0.72rem;">
                    <!-- Prime Good Grade -->
                    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 0.45rem 0.6rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.2rem;">
                            <span style="font-weight: 700; color: #166534; display: flex; align-items: center; gap: 4px;">
                                <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #10b981;"></span>
                                Prime Good
                            </span>
                            <span style="font-size: 0.62rem; font-weight: 700; padding: 0.05rem 0.3rem; border-radius: 3px; ${isGoodTargetMet ? 'background: #dcfce7; color: #15803d;' : 'background: #fef3c7; color: #b45309;'}">
                                ${isGoodTargetMet ? '✓ Target Met' : '⚠️ < 75% Target'}
                            </span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: baseline;">
                            <span style="font-size: 0.92rem; font-weight: 800; color: #14532d; font-family: ui-monospace, monospace;">${p.goodPct}%</span>
                            <span style="color: #64748b; font-size: 0.66rem;">${goodTons} MT</span>
                        </div>
                    </div>

                    <!-- 2nd Grade -->
                    <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; padding: 0.45rem 0.6rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.2rem;">
                            <span style="font-weight: 700; color: #0369a1; display: flex; align-items: center; gap: 4px;">
                                <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #0284c7;"></span>
                                2nd Grade
                            </span>
                            <span style="font-size: 0.62rem; color: #64748b;">Soft / Broken</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: baseline;">
                            <span style="font-size: 0.92rem; font-weight: 800; color: #075985; font-family: ui-monospace, monospace;">${p.secondPct}%</span>
                            <span style="color: #64748b; font-size: 0.66rem;">${secTons} MT</span>
                        </div>
                    </div>

                    <!-- Small Grade -->
                    <div style="background: ${isSmallElevated ? '#fff7ed' : '#f8fafc'}; border: 1px solid ${isSmallElevated ? '#fed7aa' : '#e2e8f0'}; border-radius: 6px; padding: 0.45rem 0.6rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.2rem;">
                            <span style="font-weight: 700; color: #c2410c; display: flex; align-items: center; gap: 4px;">
                                <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #f59e0b;"></span>
                                Small Grade
                            </span>
                            ${isSmallElevated ? '<span style="font-size: 0.62rem; font-weight: 700; padding: 0.05rem 0.3rem; border-radius: 3px; background: #ffedd5; color: #9a3412;">⚠️ High >15%</span>' : '<span style="font-size: 0.62rem; color: #64748b;">Undersized</span>'}
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: baseline;">
                            <span style="font-size: 0.92rem; font-weight: 800; color: #9a3412; font-family: ui-monospace, monospace;">${p.smallPct}%</span>
                            <span style="color: #64748b; font-size: 0.66rem;">${smallTons} MT</span>
                        </div>
                    </div>

                    <!-- Below / Rejects -->
                    <div style="background: ${isRejectElevated ? '#fff1f2' : '#f8fafc'}; border: 1px solid ${isRejectElevated ? '#fecaca' : '#e2e8f0'}; border-radius: 6px; padding: 0.45rem 0.6rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.2rem;">
                            <span style="font-weight: 700; color: #be123c; display: flex; align-items: center; gap: 4px;">
                                <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #f43f5e;"></span>
                                Rejects
                            </span>
                            <span style="font-size: 0.62rem; color: #64748b;">Below / Rubbish</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: baseline;">
                            <span style="font-size: 0.92rem; font-weight: 800; color: #9f1239; font-family: ui-monospace, monospace;">${p.rejectPct}%</span>
                            <span style="color: #64748b; font-size: 0.66rem;">${rejectTons} MT</span>
                        </div>
                    </div>
                </div>

                <!-- Estimated Revenue Lost to Lower Grades Strip -->
                <div style="background: #fff1f2; border: 1px solid #ffe4e6; border-radius: 6px; padding: 0.55rem 0.75rem; display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.70rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="display: flex; align-items: center; gap: 6px; color: #9f1239; font-weight: 700;">
                            <span>📉</span>
                            <span>Estimated Revenue Lost to Lower Grades (${p.ytdYear || 2026} YTD)</span>
                        </div>
                        <div style="font-size: 0.88rem; font-weight: 800; font-family: ui-monospace, monospace; color: #be123c;">
                            ~RM ${(p.revenueLostRm || p.downgradeLossRm || 0).toLocaleString()}
                        </div>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.65rem; color: #64748b; border-top: 1px dashed #fecdd3; padding-top: 0.3rem;">
                        <span>Loss breakdown vs Prime price:</span>
                        <span style="font-family: ui-monospace, monospace; font-weight: 600;">
                            Small: <strong style="color: #c2410c;">RM ${(p.lossSmallRm || 0).toLocaleString()}</strong> • 
                            2nd Grade: <strong style="color: #0369a1;">RM ${(p.lossSecondRm || 0).toLocaleString()}</strong> • 
                            Rejects: <strong style="color: #be123c;">RM ${(p.lossRejectRm || 0).toLocaleString()}</strong>
                        </span>
                    </div>
                </div>
            </div>

            <!-- Top Off-Takers Section -->
            <div style="padding-top: 0.75rem; border-top: 1px solid #f1f5f9;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
                    <div style="font-size: 0.68rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.04em;">Top Commercial Off-Takers</div>
                    ${top3Concentration > 0 ? `<div style="font-size: 0.64rem; font-weight: 600; color: #64748b; background: #f8fafc; padding: 0.05rem 0.35rem; border-radius: 3px; border: 1px solid #e2e8f0;">Top 3 Buyers: <strong style="color: #0f172a;">${top3Concentration}%</strong> Rev</div>` : ''}
                </div>
                <div style="display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.74rem;">
                    ${topBuyers.length === 0 ? '<div style="color: #94a3b8; font-size: 0.72rem; padding: 0.4rem 0;">No buyer records found for this cohort</div>' : topBuyers.map(b => `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.25rem 0; border-bottom: 1px dashed #f1f5f9;">
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <span style="font-weight: 600; color: #1e293b;">${b.buyer}</span>
                                <span style="font-size: 0.65rem; font-weight: 800; padding: 0.05rem 0.3rem; border-radius: 4px; ${b.species === 'MON' ? 'background:#fff7ed;color:#c2410c;' : (b.species === 'VAN' ? 'background:#f0f9ff;color:#0284c7;' : 'background:#f1f5f9;color:#64748b;')}">${b.species === 'UNK' ? 'N/A' : b.species}</span>
                            </div>
                            <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end;">
                                <div style="font-family: ui-monospace, monospace; color: #0f172a; font-weight: 700; font-size: 0.73rem;">
                                    ${b.revenueSharePct || b.pctShare}% Rev • RM ${b.avgPrice.toFixed(2)}/kg
                                </div>
                                <div style="font-size: 0.63rem; color: #64748b; font-family: ui-monospace, monospace;">
                                    ${b.totalTons || ((b.totalWeight || 0)/1000).toFixed(1)} MT (${b.volumeSharePct || 0}% Vol)
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

/**
 * Renders the Business Intelligence redesigned 12-Month Performance Ledger section.
 * Includes executive KPI strip, horizon switcher (12M Rolling vs YTD), hide-empty filter,
 * sparkbars, species breakdown pills, harvest method, and grand audited totals footer.
 *
 * @param {object} params
 * @returns {string} HTML markup
 */
export function renderPerformanceLedgerSectionHtml({
    buckets = [],
    totals = {},
    cohortFilter = "ALL",
    ledgerTimeHorizon = "ALL",
    hideEmptyMonths = false,
    sortKey = "month",
    sortDirection = "desc"
}) {
    const currentYear = new Date().getFullYear();

    // 1. Filter by Time Horizon
    let displayed = (buckets || []).filter(b => {
        if (ledgerTimeHorizon === "YTD") {
            return b.month && String(b.month).startsWith(String(currentYear));
        }
        return true;
    });

    // 2. Filter empty/fallow months if requested
    if (hideEmptyMonths) {
        displayed = displayed.filter(b => ((b.tonnage || 0) > 0 || (b.grossRevenue || 0) > 0 || (b.runs || 0) > 0));
    }

    // 3. Sort displayed buckets
    const dir = sortDirection === "asc" ? 1 : -1;
    displayed = displayed.slice().sort((a, b) => {
        if (sortKey === "month") {
            return dir * String(a.month).localeCompare(String(b.month));
        } else if (sortKey === "tonnage") {
            return dir * ((a.tonnage || 0) - (b.tonnage || 0));
        } else if (sortKey === "abw") {
            return dir * ((a.weightedAbw || 0) - (b.weightedAbw || 0));
        } else if (sortKey === "runs") {
            return dir * ((a.runs || 0) - (b.runs || 0));
        } else if (sortKey === "grossRevenue") {
            return dir * ((a.grossRevenue || 0) - (b.grossRevenue || 0));
        } else if (sortKey === "vanTons") {
            return dir * ((a.vanTons || 0) - (b.vanTons || 0));
        } else if (sortKey === "vanAbw") {
            return dir * ((a.vanAbw || 0) - (b.vanAbw || 0));
        } else if (sortKey === "vanPricePerKg") {
            return dir * ((a.vanPricePerKg || 0) - (b.vanPricePerKg || 0));
        } else if (sortKey === "monTons") {
            return dir * ((a.monTons || 0) - (b.monTons || 0));
        } else if (sortKey === "monAbw") {
            return dir * ((a.monAbw || 0) - (b.monAbw || 0));
        } else if (sortKey === "monPricePerKg") {
            return dir * ((a.monPricePerKg || 0) - (b.monPricePerKg || 0));
        } else if (sortKey === "blendedPrice") {
            return dir * ((a.blendedPricePerKg || 0) - (b.blendedPricePerKg || 0));
        }
        return 0;
    });

    // 4. Calculate dynamic summary totals for displayed rows
    const displayedWeightKg = displayed.reduce((sum, b) => sum + (b.weightKg || 0), 0);
    const displayedTonnage = Math.round(displayedWeightKg / 100) / 10;
    const displayedGrossRevenue = displayed.reduce((sum, b) => sum + (b.grossRevenue || 0), 0);
    const displayedBlendedPrice = displayedWeightKg > 0 && displayedGrossRevenue > 0
        ? Math.round((displayedGrossRevenue / displayedWeightKg) * 100) / 100
        : 0;

    const displayedVanKg = displayed.reduce((sum, b) => sum + ((b.vanTons || 0) * 1000), 0);
    const displayedMonKg = displayed.reduce((sum, b) => sum + ((b.monTons || 0) * 1000), 0);
    const displayedVanTons = Math.round(displayedVanKg / 100) / 10;
    const displayedMonTons = Math.round(displayedMonKg / 100) / 10;

    const displayedVanPct = displayedWeightKg > 0 ? Math.round((displayedVanKg / displayedWeightKg) * 1000) / 10 : 0;
    const displayedMonPct = displayedWeightKg > 0 ? Math.round((displayedMonKg / displayedWeightKg) * 1000) / 10 : 0;

    const displayedTermTons = Math.round(displayed.reduce((sum, b) => sum + (b.terminationTons || 0), 0) * 10) / 10;
    const displayedPartTons = Math.round(displayed.reduce((sum, b) => sum + (b.partialTons || 0), 0) * 10) / 10;
    const displayedRuns = displayed.reduce((sum, b) => sum + (b.runs || 0), 0);

    const displayedWeightedAbw = displayedWeightKg > 0
        ? Math.round((displayed.reduce((sum, b) => sum + ((b.weightedAbw || 0) * (b.weightKg || 0)), 0) / displayedWeightKg) * 100) / 100
        : 0;

    // Empirical species weighted prices from displayed buckets
    let vanRev = 0, vanWgt = 0, monRev = 0, monWgt = 0;
    displayed.forEach(b => {
        if (b.vanPricePerKg > 0 && b.vanTons > 0) {
            const kg = b.vanTons * 1000;
            vanRev += b.vanPricePerKg * kg;
            vanWgt += kg;
        }
        if (b.monPricePerKg > 0 && b.monTons > 0) {
            const kg = b.monTons * 1000;
            monRev += b.monPricePerKg * kg;
            monWgt += kg;
        }
    });
    const weightedVanPrice = vanWgt > 0 ? Math.round((vanRev / vanWgt) * 100) / 100 : (totals.vanPricePerKg || 0);
    const weightedMonPrice = monWgt > 0 ? Math.round((monRev / monWgt) * 100) / 100 : (totals.monPricePerKg || 0);

    // Empirical species weighted ABWs and sizing ranges from displayed buckets
    const vanAbwWeightedSum = displayed.reduce((sum, b) => sum + ((b.vanAbw || 0) * ((b.vanTons || 0) * 1000)), 0);
    const displayedVanAbw = displayedVanKg > 0 ? Math.round((vanAbwWeightedSum / displayedVanKg) * 100) / 100 : 0;
    const vanMins = displayed.map(b => b.vanMinAbw).filter(v => v > 0);
    const displayedVanMin = vanMins.length ? Math.min(...vanMins) : 0;
    const vanMaxs = displayed.map(b => b.vanMaxAbw).filter(v => v > 0);
    const displayedVanMax = vanMaxs.length ? Math.max(...vanMaxs) : 0;

    const monAbwWeightedSum = displayed.reduce((sum, b) => sum + ((b.monAbw || 0) * ((b.monTons || 0) * 1000)), 0);
    const displayedMonAbw = displayedMonKg > 0 ? Math.round((monAbwWeightedSum / displayedMonKg) * 100) / 100 : 0;
    const monMins = displayed.map(b => b.monMinAbw).filter(m => m > 0);
    const displayedMonMin = monMins.length ? Math.min(...monMins) : 0;
    const monMaxs = displayed.map(b => b.monMaxAbw).filter(m => m > 0);
    const displayedMonMax = monMaxs.length ? Math.max(...monMaxs) : 0;

    const peakMonthlyTonnage = Math.max(...displayed.map(b => b.tonnage || 0), 1);
    const activeMonthsCount = displayed.filter(b => ((b.tonnage || 0) > 0 || (b.grossRevenue || 0) > 0)).length;

    // Helper for Month format "2026-10" -> "Oct 2026"
    const formatMonthName = mStr => {
        if (!mStr || mStr.length < 7) return mStr;
        const [y, m] = mStr.split("-");
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const mIdx = parseInt(m, 10) - 1;
        return `${monthNames[mIdx] || m} ${y}`;
    };

    const sortIndicator = key => {
        if (sortKey !== key) return `<span class="sort-indicator" style="color: #94a3b8; font-size: 0.65rem; margin-left: 3px;">↕</span>`;
        return `<span class="sort-indicator" style="color: #0284c7; font-size: 0.65rem; margin-left: 3px;">${sortDirection === 'asc' ? '▲' : '▼'}</span>`;
    };

    return `
        <div class="sleek-card exec-performance-ledger-card" id="exec-ledger-card" style="overflow: hidden;">
            <!-- HEADER BAR: TITLE, SUBTITLE & EXPORT -->
            <div style="padding: 1.1rem 1.3rem; border-bottom: 1px solid #e2e8f0; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 1rem; background: #ffffff;">
                <div>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span style="font-size: 0.95rem; font-weight: 800; color: #0f172a; letter-spacing: -0.01em;">Commercial Harvest &amp; Revenue Ledger</span>
                        <span class="status-badge" style="font-size: 0.65rem; padding: 0.12rem 0.5rem; background: #f0fdf4; color: #166534; font-weight: 700; border: 1px solid #bbf7d0;">FINANCE</span>
                    </div>
                    <div style="font-size: 0.73rem; color: #64748b; margin-top: 0.2rem;">
                        Monthly commercial harvest tonnage, species volume, average ABW, size ranges, and realized price per kg by species.
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                    <!-- HORIZON SEGMENTED CONTROLS -->
                    <div class="tab-pill-group" style="display: inline-flex; background: #f1f5f9; padding: 3px; border-radius: 8px; border: 1px solid #e2e8f0;">
                        <button type="button" class="btn-ledger-horizon ${ledgerTimeHorizon === 'ALL' ? 'active' : ''}" data-horizon="ALL" style="padding: 0.3rem 0.75rem; font-size: 0.72rem; font-weight: 700; border-radius: 6px; border: none; cursor: pointer; transition: all 0.15s ease; background: ${ledgerTimeHorizon === 'ALL' ? '#ffffff' : 'transparent'}; color: ${ledgerTimeHorizon === 'ALL' ? '#0f172a' : '#64748b'}; box-shadow: ${ledgerTimeHorizon === 'ALL' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'};">
                            12M Rolling
                        </button>
                        <button type="button" class="btn-ledger-horizon ${ledgerTimeHorizon === 'YTD' ? 'active' : ''}" data-horizon="YTD" style="padding: 0.3rem 0.75rem; font-size: 0.72rem; font-weight: 700; border-radius: 6px; border: none; cursor: pointer; transition: all 0.15s ease; background: ${ledgerTimeHorizon === 'YTD' ? '#ffffff' : 'transparent'}; color: ${ledgerTimeHorizon === 'YTD' ? '#0f172a' : '#64748b'}; box-shadow: ${ledgerTimeHorizon === 'YTD' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'};">
                            ${currentYear} YTD
                        </button>
                    </div>
                    <!-- HIDE EMPTY CHECKBOX -->
                    <label style="display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.72rem; font-weight: 600; color: #64748b; cursor: pointer; user-select: none;">
                        <input type="checkbox" id="chk-ledger-hide-empty" ${hideEmptyMonths ? 'checked' : ''} style="cursor: pointer; accent-color: #0284c7;">
                        Hide 0-Harvest Months
                    </label>
                    <!-- EXPORT CSV -->
                    <button type="button" id="btn-export-exec-ledger" class="btn-action btn-secondary" style="padding: 0.35rem 0.85rem; font-size: 0.75rem; font-weight: 700;">
                        <span>📥 Export Finance CSV</span>
                    </button>
                </div>
            </div>

            <!-- 4-TILE EXECUTIVE KPI SUMMARY STRIP -->
            <div style="padding: 1rem 1.3rem; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.85rem;">
                <!-- KPI 1: Volume -->
                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.75rem 0.9rem;">
                    <div style="font-size: 0.65rem; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.04em;">Harvested Biomass</div>
                    <div style="font-size: 1.35rem; font-weight: 800; color: #0284c7; font-family: ui-monospace, monospace; margin-top: 0.2rem;">
                        ${displayedTonnage.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MT
                    </div>
                    <div style="font-size: 0.68rem; color: #64748b; margin-top: 0.2rem;">
                        Monthly Peak: <strong style="color: #0f172a;">${peakMonthlyTonnage.toFixed(1)} MT</strong> • ${activeMonthsCount} Active Mos
                    </div>
                </div>

                <!-- KPI 2: Gross Revenue -->
                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.75rem 0.9rem;">
                    <div style="font-size: 0.65rem; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.04em;">Gross Revenue</div>
                    <div style="font-size: 1.35rem; font-weight: 800; color: #0f172a; font-family: ui-monospace, monospace; margin-top: 0.2rem;">
                        RM ${displayedGrossRevenue.toLocaleString()}
                    </div>
                    <div style="font-size: 0.68rem; color: #64748b; margin-top: 0.2rem;">
                        Avg <strong style="color: #0f172a;">RM ${Math.round(displayedGrossRevenue / Math.max(1, activeMonthsCount)).toLocaleString()}</strong> / active mo
                    </div>
                </div>

                <!-- KPI 3: Realized Species Pricing -->
                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.75rem 0.9rem;">
                    <div style="font-size: 0.65rem; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.04em;">Realized Species Pricing</div>
                    <div style="font-size: 1.15rem; font-weight: 800; font-family: ui-monospace, monospace; margin-top: 0.2rem; display: flex; align-items: baseline; gap: 0.4rem; flex-wrap: wrap;">
                        <span style="color: #0369a1;">VAN: RM ${weightedVanPrice > 0 ? weightedVanPrice.toFixed(2) : '—'}</span>
                        <span style="color: #cbd5e1; font-weight: 400;">|</span>
                        <span style="color: #c2410c;">MON: RM ${weightedMonPrice > 0 ? weightedMonPrice.toFixed(2) : '—'}</span>
                    </div>
                    <div style="font-size: 0.68rem; color: #64748b; margin-top: 0.2rem;">
                        Weighted sales realization per kg from buyer settlement ledger
                    </div>
                </div>

                <!-- KPI 4: Species Volume Split -->
                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.75rem 0.9rem;">
                    <div style="font-size: 0.65rem; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.04em;">Species Portfolio Mix</div>
                    <div style="font-size: 1.35rem; font-weight: 800; color: #0f172a; font-family: ui-monospace, monospace; margin-top: 0.2rem;">
                        ${displayedVanPct}% <span style="font-size: 0.85rem; color: #0369a1;">VAN</span> | ${displayedMonPct}% <span style="font-size: 0.85rem; color: #c2410c;">MON</span>
                    </div>
                    <div style="font-size: 0.68rem; color: #64748b; margin-top: 0.2rem;">
                        ${displayedVanTons.toFixed(1)} MT Vannamei • ${displayedMonTons.toFixed(1)} MT Monodon
                    </div>
                </div>
            </div>

            <!-- TABLE AREA -->
            <div style="overflow-x: auto;">
                <table class="exec-ledger-table" style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.76rem; font-family: ui-monospace, monospace;">
                    <thead style="background: #f8fafc; font-size: 0.68rem; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 2px solid #cbd5e1;">
                        <tr style="border-bottom: 1px solid #e2e8f0;">
                            <th rowspan="2" style="padding: 0.65rem 0.85rem; cursor: pointer; user-select: none; vertical-align: middle;" data-ledger-sort="month">
                                Month ${sortIndicator("month")}
                            </th>
                            <th rowspan="2" style="padding: 0.65rem 0.75rem; text-align: right; cursor: pointer; user-select: none; vertical-align: middle;" data-ledger-sort="tonnage">
                                Total (MT) ${sortIndicator("tonnage")}
                            </th>
                            <th rowspan="2" style="padding: 0.65rem 0.75rem; text-align: center; vertical-align: middle;">
                                Harvest Method
                            </th>
                            <th rowspan="2" style="padding: 0.65rem 0.5rem; text-align: center; cursor: pointer; user-select: none; vertical-align: middle;" data-ledger-sort="runs">
                                Events ${sortIndicator("runs")}
                            </th>
                            <th rowspan="2" style="padding: 0.65rem 0.75rem; text-align: right; cursor: pointer; user-select: none; vertical-align: middle;" data-ledger-sort="grossRevenue">
                                Gross Rev (RM) ${sortIndicator("grossRevenue")}
                            </th>
                            <th colspan="4" style="padding: 0.5rem 0.75rem; text-align: center; background: #f0f9ff; color: #0369a1; border-left: 1px solid #bae6fd; border-right: 1px solid #bae6fd; font-weight: 800; letter-spacing: 0.05em;">
                                L. VANNAMEI (WHITE SHRIMP)
                            </th>
                            <th colspan="4" style="padding: 0.5rem 0.75rem; text-align: center; background: #fff7ed; color: #c2410c; border-left: 1px solid #fed7aa; font-weight: 800; letter-spacing: 0.05em;">
                                P. MONODON (TIGER PRAWN)
                            </th>
                        </tr>
                        <tr style="font-size: 0.64rem;">
                            <!-- VAN columns -->
                            <th style="padding: 0.4rem 0.6rem; text-align: right; background: #f0f9ff; color: #0369a1; border-left: 1px solid #bae6fd; cursor: pointer; user-select: none;" data-ledger-sort="vanTons">
                                VAN (MT) ${sortIndicator("vanTons")}
                            </th>
                            <th style="padding: 0.4rem 0.6rem; text-align: right; background: #f0f9ff; color: #0369a1; cursor: pointer; user-select: none;" data-ledger-sort="vanAbw">
                                Avg ABW ${sortIndicator("vanAbw")}
                            </th>
                            <th style="padding: 0.4rem 0.6rem; text-align: center; background: #f0f9ff; color: #0369a1;">
                                Range (g)
                            </th>
                            <th style="padding: 0.4rem 0.6rem; text-align: right; background: #f0f9ff; color: #0369a1; border-right: 1px solid #bae6fd; cursor: pointer; user-select: none;" data-ledger-sort="vanPricePerKg">
                                RM / kg ${sortIndicator("vanPricePerKg")}
                            </th>

                            <!-- MON columns -->
                            <th style="padding: 0.4rem 0.6rem; text-align: right; background: #fff7ed; color: #c2410c; border-left: 1px solid #fed7aa; cursor: pointer; user-select: none;" data-ledger-sort="monTons">
                                MON (MT) ${sortIndicator("monTons")}
                            </th>
                            <th style="padding: 0.4rem 0.6rem; text-align: right; background: #fff7ed; color: #c2410c; cursor: pointer; user-select: none;" data-ledger-sort="monAbw">
                                Avg ABW ${sortIndicator("monAbw")}
                            </th>
                            <th style="padding: 0.4rem 0.6rem; text-align: center; background: #fff7ed; color: #c2410c;">
                                Range (g)
                            </th>
                            <th style="padding: 0.4rem 0.75rem; text-align: right; background: #fff7ed; color: #c2410c; cursor: pointer; user-select: none;" data-ledger-sort="monPricePerKg">
                                RM / kg ${sortIndicator("monPricePerKg")}
                            </th>
                        </tr>
                    </thead>
                    <tbody style="divide-y: 1px solid #f1f5f9; background: #ffffff;">
                        ${displayed.length === 0 ? `
                            <tr><td colspan="13" style="padding: 2rem; text-align: center; color: #94a3b8;">No harvest records found for selected period.</td></tr>
                        ` : displayed.map(b => {
                            const isYtd = b.month && String(b.month).startsWith(String(currentYear));
                            const sparkPct = peakMonthlyTonnage > 0 ? Math.min(100, Math.round(((b.tonnage || 0) / peakMonthlyTonnage) * 100)) : 0;
                            return `
                                <tr class="pond-row" style="border-bottom: 1px solid #f1f5f9; transition: background-color 0.1s ease;">
                                    <!-- 1. Month & MoM Change -->
                                    <td style="padding: 0.6rem 0.85rem;">
                                        <div style="display: flex; align-items: baseline; gap: 0.4rem;">
                                            <span style="font-weight: 800; color: #0f172a; font-size: 0.78rem;">${formatMonthName(b.month)}</span>
                                            ${isYtd ? `<span style="font-size: 0.6rem; font-weight: 700; padding: 0.05rem 0.3rem; border-radius: 4px; background: #e0f2fe; color: #0369a1;">YTD</span>` : ''}
                                        </div>
                                        <div style="font-size: 0.65rem; margin-top: 0.15rem;">
                                            ${b.momDeltaPct !== null 
                                                ? (b.momDeltaPct > 0 
                                                    ? `<span style="color: #059669; font-weight: 700;">▲ +${b.momDeltaPct}% MoM</span>` 
                                                    : (b.momDeltaPct < 0 
                                                        ? `<span style="color: #dc2626; font-weight: 700;">▼ ${b.momDeltaPct}% MoM</span>` 
                                                        : `<span style="color: #64748b;">0.0% MoM</span>`))
                                                : `<span style="color: #94a3b8;">Base month</span>`}
                                        </div>
                                    </td>

                                    <!-- 2. Total Harvest Volume & Sparkbar -->
                                    <td style="padding: 0.6rem 0.75rem; text-align: right;">
                                        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 3px;">
                                            <span style="font-weight: 800; color: #0284c7; font-size: 0.8rem;">
                                                ${(b.tonnage || 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MT
                                            </span>
                                            <div style="width: 50px; height: 4px; background: #f1f5f9; border-radius: 2px; overflow: hidden;" title="${sparkPct}% of peak month">
                                                <div style="width: ${sparkPct}%; height: 100%; background: #0284c7; border-radius: 2px;"></div>
                                            </div>
                                        </div>
                                    </td>

                                    <!-- 3. Harvest Method -->
                                    <td style="padding: 0.6rem 0.75rem; text-align: center;">
                                        ${(b.tonnage || 0) > 0 ? `
                                            <div style="font-size: 0.68rem; color: #334155; white-space: nowrap;">
                                                <span style="font-weight: 700; color: #0f172a;">${(b.terminationTons || 0).toFixed(1)} MT</span> Final
                                                ${(b.partialTons || 0) > 0 ? `
                                                    • <span style="font-weight: 700; color: #b45309; padding: 0.08rem 0.3rem; border-radius: 4px; background: #fef3c7; border: 1px solid #fde68a;">
                                                        +${(b.partialTons || 0).toFixed(1)} MT Partial
                                                    </span>
                                                ` : ''}
                                            </div>
                                        ` : `<span style="color: #94a3b8;">—</span>`}
                                    </td>

                                    <!-- 4. Harvest Events -->
                                    <td style="padding: 0.6rem 0.5rem; text-align: center; color: #475569; font-weight: 600;">
                                        ${b.runs || 0}
                                    </td>

                                    <!-- 5. Gross Revenue -->
                                    <td style="padding: 0.6rem 0.75rem; text-align: right; font-weight: 700; color: #0f172a;">
                                        ${b.grossRevenue > 0 ? 'RM ' + b.grossRevenue.toLocaleString() : 'RM 0'}
                                    </td>

                                    <!-- 6. VAN (MT) & Share -->
                                    <td style="padding: 0.6rem 0.6rem; text-align: right; background: #f0f9ff40; border-left: 1px solid #e0f2fe;">
                                        ${(b.vanTons || 0) > 0 ? `
                                            <span style="font-weight: 700; color: #0369a1;">${(b.vanTons || 0).toFixed(1)} MT</span>
                                            <div style="font-size: 0.62rem; color: #0284c7;">(${b.vanSharePct || 0}%)</div>
                                        ` : `<span style="color: #94a3b8;">—</span>`}
                                    </td>

                                    <!-- 7. VAN Avg ABW -->
                                    <td style="padding: 0.6rem 0.6rem; text-align: right; background: #f0f9ff40; font-weight: 700; color: #0f172a;">
                                        ${b.vanAbw > 0 ? b.vanAbw.toFixed(2) + ' g' : '—'}
                                    </td>

                                    <!-- 8. VAN Range (g) -->
                                    <td style="padding: 0.6rem 0.6rem; text-align: center; background: #f0f9ff40; color: #64748b; font-size: 0.7rem; white-space: nowrap;">
                                        ${b.vanMinAbw > 0 ? b.vanMinAbw.toFixed(1) + ' – ' + b.vanMaxAbw.toFixed(1) + ' g' : '—'}
                                    </td>

                                    <!-- 9. VAN RM/kg -->
                                    <td style="padding: 0.6rem 0.6rem; text-align: right; background: #f0f9ff40; border-right: 1px solid #e0f2fe; font-weight: 700; color: #0369a1;">
                                        ${b.vanPricePerKg > 0 ? 'RM ' + b.vanPricePerKg.toFixed(2) : '—'}
                                    </td>

                                    <!-- 10. MON (MT) & Share -->
                                    <td style="padding: 0.6rem 0.6rem; text-align: right; background: #fff7ed40; border-left: 1px solid #ffedd5;">
                                        ${(b.monTons || 0) > 0 ? `
                                            <span style="font-weight: 700; color: #c2410c;">${(b.monTons || 0).toFixed(1)} MT</span>
                                            <div style="font-size: 0.62rem; color: #ea580c;">(${b.monSharePct || 0}%)</div>
                                        ` : `<span style="color: #94a3b8;">—</span>`}
                                    </td>

                                    <!-- 11. MON Avg ABW -->
                                    <td style="padding: 0.6rem 0.6rem; text-align: right; background: #fff7ed40; font-weight: 700; color: #0f172a;">
                                        ${b.monAbw > 0 ? b.monAbw.toFixed(2) + ' g' : '—'}
                                    </td>

                                    <!-- 12. MON Range (g) -->
                                    <td style="padding: 0.6rem 0.6rem; text-align: center; background: #fff7ed40; color: #64748b; font-size: 0.7rem; white-space: nowrap;">
                                        ${b.monMinAbw > 0 ? b.monMinAbw.toFixed(1) + ' – ' + b.monMaxAbw.toFixed(1) + ' g' : '—'}
                                    </td>

                                    <!-- 13. MON RM/kg -->
                                    <td style="padding: 0.6rem 0.75rem; text-align: right; background: #fff7ed40; font-weight: 700; color: #c2410c;">
                                        ${b.monPricePerKg > 0 ? 'RM ' + b.monPricePerKg.toFixed(2) : '—'}
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                    <tfoot id="exec-ledger-tfoot" style="background: #f8fafc; font-weight: 800; border-top: 2px solid #cbd5e1; border-bottom: 2px solid #cbd5e1; font-size: 0.74rem;">
                        <tr>
                            <td style="padding: 0.75rem 0.85rem; color: #0f172a;">
                                <div>FINANCE TOTAL / AVG</div>
                                <div style="font-size: 0.64rem; color: #64748b; font-weight: 600;">${displayed.length} Months (${activeMonthsCount} Active)</div>
                            </td>
                            <td style="padding: 0.75rem 0.75rem; text-align: right; color: #0284c7; font-size: 0.82rem;">
                                ${displayedTonnage.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MT
                            </td>
                            <td style="padding: 0.75rem 0.75rem; text-align: center; color: #475569; font-size: 0.68rem; white-space: nowrap;">
                                ${displayedTermTons.toFixed(1)} MT Final • ${displayedPartTons.toFixed(1)} MT Partial
                            </td>
                            <td style="padding: 0.75rem 0.5rem; text-align: center; color: #475569;">
                                ${displayedRuns}
                            </td>
                            <td style="padding: 0.75rem 0.75rem; text-align: right; color: #0f172a; font-size: 0.82rem;">
                                RM ${displayedGrossRevenue.toLocaleString()}
                            </td>
                            <!-- VAN TOTALS -->
                            <td style="padding: 0.75rem 0.6rem; text-align: right; background: #f0f9ff80; border-left: 1px solid #bae6fd;">
                                <div style="color: #0369a1; font-size: 0.8rem;">${displayedVanTons.toFixed(1)} MT</div>
                                <div style="font-size: 0.62rem; color: #0284c7;">(${displayedVanPct}%)</div>
                            </td>
                            <td style="padding: 0.75rem 0.6rem; text-align: right; background: #f0f9ff80; color: #0f172a; font-size: 0.8rem;">
                                ${displayedVanAbw > 0 ? displayedVanAbw.toFixed(2) + ' g' : '—'}
                            </td>
                            <td style="padding: 0.75rem 0.6rem; text-align: center; background: #f0f9ff80; color: #64748b; font-size: 0.7rem; white-space: nowrap;">
                                ${displayedVanMin > 0 ? displayedVanMin.toFixed(1) + ' – ' + displayedVanMax.toFixed(1) + ' g' : '—'}
                            </td>
                            <td style="padding: 0.75rem 0.6rem; text-align: right; background: #f0f9ff80; border-right: 1px solid #bae6fd; color: #0369a1; font-size: 0.8rem;">
                                ${weightedVanPrice > 0 ? 'RM ' + weightedVanPrice.toFixed(2) : '—'}
                            </td>
                            <!-- MON TOTALS -->
                            <td style="padding: 0.75rem 0.6rem; text-align: right; background: #fff7ed80; border-left: 1px solid #fed7aa;">
                                <div style="color: #c2410c; font-size: 0.8rem;">${displayedMonTons.toFixed(1)} MT</div>
                                <div style="font-size: 0.62rem; color: #ea580c;">(${displayedMonPct}%)</div>
                            </td>
                            <td style="padding: 0.75rem 0.6rem; text-align: right; background: #fff7ed80; color: #0f172a; font-size: 0.8rem;">
                                ${displayedMonAbw > 0 ? displayedMonAbw.toFixed(2) + ' g' : '—'}
                            </td>
                            <td style="padding: 0.75rem 0.6rem; text-align: center; background: #fff7ed80; color: #64748b; font-size: 0.7rem; white-space: nowrap;">
                                ${displayedMonMin > 0 ? displayedMonMin.toFixed(1) + ' – ' + displayedMonMax.toFixed(1) + ' g' : '—'}
                            </td>
                            <td style="padding: 0.75rem 0.75rem; text-align: right; background: #fff7ed80; color: #c2410c; font-size: 0.8rem;">
                                ${weightedMonPrice > 0 ? 'RM ' + weightedMonPrice.toFixed(2) : '—'}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    `;
}

/**
 * Generates the full HTML markup for Executive Biomass & Production Intelligence view.
 * @param {object} params
 * @returns {string}
 */
export function getExecutiveBiomassHtml({
    cohortFilter = "ALL",
    pipelineFilter = "ALL",
    evaluatedPonds = [],
    forecast14d = { candidatePonds: [], totalProjectedBiomassTons: 0 },
    aggregated12m = null,
    packoutSpeciesFilter = null,
    ledgerTimeHorizon = "ALL",
    hideEmptyMonths = false,
    ledgerSortKey = "month",
    ledgerSortDirection = "desc"
}) {
    const agg = aggregated12m || { monthlyBuckets: [], totals: {}, packoutSummary: {}, topBuyers: [] };
    const buckets = agg.monthlyBuckets || [];
    const activePackoutSpecies = packoutSpeciesFilter || (cohortFilter === "MON" ? "MON" : (cohortFilter === "VAN" ? "VAN" : "ALL"));
    const activePackout = agg.packoutBySpecies?.[activePackoutSpecies] || agg.packoutSummary || { goodPct: 0, secondPct: 0, smallPct: 0, rejectPct: 0 };
    const activeBuyersData = agg.topBuyersBySpecies?.[activePackoutSpecies] || { buyers: agg.topBuyers || [], top3ConcentrationPct: agg.top3BuyerConcentration || 0 };
    const packout = activePackout;
    const topBuyers = activeBuyersData.buyers || [];
    const top3Concentration = activeBuyersData.top3ConcentrationPct || 0;

    // KPI Counts
    const optimumList = evaluatedPonds.filter(p => p.classification?.category === "OPTIMUM");
    const minimumList = evaluatedPonds.filter(p => p.classification?.category === "MINIMUM");
    const watchList = evaluatedPonds.filter(p => p.classification?.subCategory === "WATCH");
    const forcedAlertList = evaluatedPonds.filter(p => p.classification?.category === "ALERT");
    const missingSurvList = evaluatedPonds.filter(p => !p.hasSurvSample);

    const optimumTons = Math.round(optimumList.reduce((acc, p) => acc + (p.biomassKg || 0), 0) / 100) / 10;
    const minimumTons = Math.round(minimumList.reduce((acc, p) => acc + (p.biomassKg || 0), 0) / 100) / 10;
    const currentBiomassTons = Math.round(evaluatedPonds.reduce((acc, p) => acc + (p.biomassKg || 0), 0) / 100) / 10;
    const activePondsCount = evaluatedPonds.length;

    return `
        <div class="executive-biomass-wrapper" style="display: flex; flex-direction: column; gap: 1.5rem;">
            
            <!-- TOP EXECUTIVE CONTROLS & HEADER -->
            <div class="sleek-card" style="padding: 1.15rem 1.4rem; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 1rem;">
                <div>
                    <div style="display: flex; align-items: center; gap: 0.6rem;">
                        <span style="width: 8px; height: 8px; border-radius: 50%; background-color: #10b981; display: inline-block;"></span>
                        <span style="font-weight: 800; font-size: 1.05rem; color: #0f172a; letter-spacing: -0.01em;">Executive Production &amp; Biomass Intelligence</span>
                        <span class="status-badge status-production" style="font-size: 0.68rem; padding: 0.15rem 0.5rem;">LIVE OPERATIONS</span>
                    </div>
                    <div style="font-size: 0.75rem; color: #64748b; margin-top: 0.2rem;">
                        Setiu 216-Pond Facility • Live Decision Gate &amp; 12-Month Commercial Performance
                    </div>
                </div>

                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <div style="font-size: 0.72rem; color: #64748b; font-weight: 600; background: #f8fafc; padding: 0.35rem 0.75rem; border-radius: 6px; border: 1px solid #e2e8f0;">
                        Facility Scope: <strong style="color: #0f172a;">216 Ponds Full Farm Overview</strong>
                    </div>
                </div>
            </div>

            ${missingSurvList.length > 0 ? `
                <!-- DATA REPAIR AUDIT BANNER -->
                <div class="sleek-card" style="padding: 0.9rem 1.25rem; background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); border: 1px solid #fde68a; border-left: 4px solid #f59e0b; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 0.75rem;">
                    <div style="display: flex; align-items: center; gap: 0.65rem;">
                        <span style="font-size: 1.25rem;">⚠️</span>
                        <div>
                            <div style="font-weight: 800; font-size: 0.85rem; color: #92400e;">Data Repair Required: ${missingSurvList.length} Active Ponds Lack Survival Rate (smpl_surv)</div>
                            <div style="font-size: 0.73rem; color: #78350f; margin-top: 0.15rem;">Zero fake survival rate applied. These ponds are strictly excluded from standing crop biomass (${currentBiomassTons.toLocaleString()} T) until sampling is logged.</div>
                        </div>
                    </div>
                    <button type="button" class="tab-pill btn-show-missing-surv" data-tab="MISSING_SURV" style="padding: 0.35rem 0.85rem; font-size: 0.74rem; font-weight: 700; background: #ffffff; color: #b45309; border: 1px solid #f59e0b; border-radius: 6px; cursor: pointer; transition: all 0.15s ease;">
                        🔍 View ${missingSurvList.length} Ponds Requiring SR
                    </button>
                </div>
            ` : ''}

            <!-- SECTION 1: 6-TILE SLEEK PASTEL KPI STRIP -->
            <div class="exec-kpi-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.9rem;">
                
                <!-- Tile 1: Optimum Harvest Ready -->
                <div class="sleek-card sleek-kpi" style="padding: 1rem 1.15rem; background: linear-gradient(180deg, #ffffff 65%, #ecfdf5 100%); border-color: #d1fae5;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 0.68rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em;">Optimum Ready</span>
                        <span style="display: inline-flex; align-items: center; gap: 4px; padding: 0.15rem 0.45rem; border-radius: 9999px; font-size: 0.65rem; font-weight: 700; background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0;">
                            <span style="width: 5px; height: 5px; border-radius: 50%; background: #10b981;"></span>
                            Premium
                        </span>
                    </div>
                    <div style="margin-top: 0.4rem; display: flex; align-items: baseline; gap: 0.4rem;">
                        <span style="font-size: 1.65rem; font-weight: 800; color: #0f172a; font-family: ui-monospace, monospace;">${optimumList.length}</span>
                        <span style="font-size: 0.75rem; color: #64748b; font-weight: 600;">Ponds</span>
                    </div>
                    <div style="margin-top: 0.35rem; padding-top: 0.4rem; border-top: 1px solid #f1f5f9; display: flex; justify-content: space-between; font-size: 0.72rem;">
                        <span style="color: #64748b;">Volume:</span>
                        <span style="font-weight: 700; color: #047857; font-family: ui-monospace, monospace;">${optimumTons.toLocaleString()} Tons</span>
                    </div>
                </div>

                <!-- Tile 2: Minimum Harvest Ready -->
                <div class="sleek-card sleek-kpi" style="padding: 1rem 1.15rem; background: linear-gradient(180deg, #ffffff 65%, #fff7ed 100%); border-color: #ffedd5;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 0.68rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em;">Minimum Ready</span>
                        <span style="display: inline-flex; align-items: center; gap: 4px; padding: 0.15rem 0.45rem; border-radius: 9999px; font-size: 0.65rem; font-weight: 700; background: #fff7ed; color: #9a3412; border: 1px solid #fed7aa;">
                            <span style="width: 5px; height: 5px; border-radius: 50%; background: #f97316;"></span>
                            Eligible
                        </span>
                    </div>
                    <div style="margin-top: 0.4rem; display: flex; align-items: baseline; gap: 0.4rem;">
                        <span style="font-size: 1.65rem; font-weight: 800; color: #0f172a; font-family: ui-monospace, monospace;">${minimumList.length}</span>
                        <span style="font-size: 0.75rem; color: #64748b; font-weight: 600;">Ponds</span>
                    </div>
                    <div style="margin-top: 0.35rem; padding-top: 0.4rem; border-top: 1px solid #f1f5f9; display: flex; justify-content: space-between; font-size: 0.72rem;">
                        <span style="color: #64748b;">Buffer:</span>
                        <span style="font-weight: 700; color: #c2410c; font-family: ui-monospace, monospace;">${minimumTons.toLocaleString()} Tons</span>
                    </div>
                </div>

                <!-- Tile 3: 14-Day Forward Forecast -->
                <div class="sleek-card sleek-kpi" style="padding: 1rem 1.15rem; background: linear-gradient(180deg, #ffffff 65%, #f5f3ff 100%); border-color: #ede9fe;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 0.68rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em;">14d Forward Intake</span>
                        <span style="display: inline-flex; align-items: center; gap: 4px; padding: 0.15rem 0.45rem; border-radius: 9999px; font-size: 0.65rem; font-weight: 700; background: #f5f3ff; color: #5b21b6; border: 1px solid #ddd6fe;">
                            <span style="width: 5px; height: 5px; border-radius: 50%; background: #8b5cf6;"></span>
                            Plant
                        </span>
                    </div>
                    <div style="margin-top: 0.4rem; display: flex; align-items: baseline; gap: 0.4rem;">
                        <span style="font-size: 1.65rem; font-weight: 800; color: #0f172a; font-family: ui-monospace, monospace;">${forecast14d.candidatePonds?.length || 0}</span>
                        <span style="font-size: 0.75rem; color: #64748b; font-weight: 600;">Incoming</span>
                    </div>
                    <div style="margin-top: 0.35rem; padding-top: 0.4rem; border-top: 1px solid #f1f5f9; display: flex; justify-content: space-between; font-size: 0.72rem;">
                        <span style="color: #64748b;">Projected:</span>
                        <span style="font-weight: 700; color: #6d28d9; font-family: ui-monospace, monospace;">+${(forecast14d.totalProjectedBiomassTons || 0).toLocaleString()} Tons</span>
                    </div>
                </div>

                <!-- Tile 4: Slow Growth Watch -->
                <div class="sleek-card sleek-kpi" style="padding: 1rem 1.15rem; background: linear-gradient(180deg, #ffffff 65%, #fefce8 100%); border-color: #fef08a;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 0.68rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em;">Growth Watch</span>
                        <span style="display: inline-flex; align-items: center; gap: 4px; padding: 0.15rem 0.45rem; border-radius: 9999px; font-size: 0.65rem; font-weight: 700; background: #fefce8; color: #854d0e; border: 1px solid #fef08a;">
                            <span style="width: 5px; height: 5px; border-radius: 50%; background: #eab308;"></span>
                            Pre-Alert
                        </span>
                    </div>
                    <div style="margin-top: 0.4rem; display: flex; align-items: baseline; gap: 0.4rem;">
                        <span style="font-size: 1.65rem; font-weight: 800; color: #0f172a; font-family: ui-monospace, monospace;">${watchList.length}</span>
                        <span style="font-size: 0.75rem; color: #64748b; font-weight: 600;">Ponds</span>
                    </div>
                    <div style="margin-top: 0.35rem; padding-top: 0.4rem; border-top: 1px solid #f1f5f9; display: flex; justify-content: space-between; font-size: 0.72rem;">
                        <span style="color: #64748b;">Criteria:</span>
                        <span style="font-weight: 700; color: #a16207;">DOC 70+ (ADG &lt;0.15)</span>
                    </div>
                </div>

                <!-- Tile 5: Forced / Emergency Action -->
                <div class="sleek-card sleek-kpi" style="padding: 1rem 1.15rem; background: linear-gradient(180deg, #ffffff 65%, #fff1f2 100%); border-color: #ffe4e6;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 0.68rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em;">Forced / Alert</span>
                        <span style="display: inline-flex; align-items: center; gap: 4px; padding: 0.15rem 0.45rem; border-radius: 9999px; font-size: 0.65rem; font-weight: 700; background: #fff1f2; color: #9f1239; border: 1px solid #fecdd3;">
                            <span style="width: 5px; height: 5px; border-radius: 50%; background: #f43f5e;"></span>
                            Action
                        </span>
                    </div>
                    <div style="margin-top: 0.4rem; display: flex; align-items: baseline; gap: 0.4rem;">
                        <span style="font-size: 1.65rem; font-weight: 800; color: #0f172a; font-family: ui-monospace, monospace;">${forcedAlertList.length}</span>
                        <span style="font-size: 0.75rem; color: #64748b; font-weight: 600;">Ponds</span>
                    </div>
                    <div style="margin-top: 0.35rem; padding-top: 0.4rem; border-top: 1px solid #f1f5f9; display: flex; justify-content: space-between; font-size: 0.72rem;">
                        <span style="color: #64748b;">Trigger:</span>
                        <span style="font-weight: 700; color: #be123c;">Stunted / Red Issue</span>
                    </div>
                </div>

                <!-- Tile 6: Live Current Crop -->
                <div class="sleek-card sleek-kpi" style="padding: 1rem 1.15rem; background: linear-gradient(180deg, #ffffff 65%, #f0f9ff 100%); border-color: #e0f2fe;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 0.68rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em;">Live Current Crop</span>
                        <span style="display: inline-flex; align-items: center; gap: 4px; padding: 0.15rem 0.45rem; border-radius: 9999px; font-size: 0.65rem; font-weight: 700; background: #f0f9ff; color: #0369a1; border: 1px solid #bae6fd;">
                            <span style="width: 5px; height: 5px; border-radius: 50%; background: #0284c7;"></span>
                            Farm
                        </span>
                    </div>
                    <div style="margin-top: 0.4rem; display: flex; align-items: baseline; gap: 0.4rem;">
                        <span style="font-size: 1.65rem; font-weight: 800; color: #0f172a; font-family: ui-monospace, monospace;">${currentBiomassTons.toLocaleString()}</span>
                        <span style="font-size: 0.75rem; color: #64748b; font-weight: 600;">Tons</span>
                    </div>
                    <div style="margin-top: 0.35rem; padding-top: 0.4rem; border-top: 1px solid #f1f5f9; display: flex; justify-content: space-between; font-size: 0.72rem;">
                        <span style="color: #64748b;">Active Ponds:</span>
                        <span style="font-weight: 700; color: #0284c7; font-family: ui-monospace, monospace;">${activePondsCount} / 216</span>
                    </div>
                </div>

            </div>

            <!-- SECTION 2: SLEEK HARVEST DECISION PIPELINE (TABLE / ACTION GATE) -->
            <div class="sleek-card" style="overflow: hidden;">
                <div style="padding: 1rem 1.25rem; border-bottom: 1px solid #e2e8f0; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.75rem; background: #f8fafc;">
                    <div>
                        <div style="font-size: 0.88rem; font-weight: 800; color: #0f172a;">Harvest Readiness Pipeline &amp; Action Gate</div>
                        <div style="font-size: 0.72rem; color: #64748b; margin-top: 2px;">Real-time eligibility based on biometric weight, culture age, and biosecurity lab clearance</div>
                        <!-- Policy Disclosure Button -->
                        <button type="button" id="btn-toggle-harvest-policy" style="display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.22rem 0.6rem; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.72rem; font-weight: 700; color: #334155; cursor: pointer; margin-top: 0.4rem; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">
                            <span>📋</span>
                            <span class="policy-toggle-text">View Decision Gate Criteria</span>
                            <span class="policy-toggle-icon">▼</span>
                        </button>
                    </div>

                    <!-- Segmented Pill Selector -->
                    <div class="exec-pipeline-tabs" style="display: flex; gap: 4px; background: #ffffff; padding: 3px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 0.75rem;">
                        <button type="button" class="tab-pill ${pipelineFilter === 'ALL' ? 'active' : ''}" data-tab="ALL" style="padding: 0.3rem 0.75rem; border-radius: 6px; font-weight: 600; border: none; cursor: pointer;">All Ready (${optimumList.length + minimumList.length})</button>
                        <button type="button" class="tab-pill ${pipelineFilter === 'OPTIMUM' ? 'active' : ''}" data-tab="OPTIMUM" style="padding: 0.3rem 0.75rem; border-radius: 6px; font-weight: 600; border: none; cursor: pointer;">Optimum (${optimumList.length})</button>
                        <button type="button" class="tab-pill ${pipelineFilter === 'MINIMUM' ? 'active' : ''}" data-tab="MINIMUM" style="padding: 0.3rem 0.75rem; border-radius: 6px; font-weight: 600; border: none; cursor: pointer;">Minimum (${minimumList.length})</button>
                        <button type="button" class="tab-pill ${pipelineFilter === 'ALERT' ? 'active' : ''}" data-tab="ALERT" style="padding: 0.3rem 0.75rem; border-radius: 6px; font-weight: 600; border: none; cursor: pointer;">Forced &amp; Alert (${forcedAlertList.length})</button>
                        <button type="button" class="tab-pill ${pipelineFilter === 'FORECAST' ? 'active' : ''}" data-tab="FORECAST" style="padding: 0.3rem 0.75rem; border-radius: 6px; font-weight: 600; border: none; cursor: pointer;">14d Forecast (${forecast14d.candidatePonds?.length || 0})</button>
                        ${missingSurvList.length > 0 ? `
                        <button type="button" class="tab-pill ${pipelineFilter === 'MISSING_SURV' ? 'active' : ''}" data-tab="MISSING_SURV" style="padding: 0.3rem 0.75rem; border-radius: 6px; font-weight: 700; border: none; cursor: pointer; color: #b45309; background: ${pipelineFilter === 'MISSING_SURV' ? '#fef3c7' : '#fffbeb'}; border: 1px solid #fde68a;">⚠️ Missing SR (${missingSurvList.length})</button>` : ''}
                    </div>
                </div>

                <!-- Expandable Policy & Decision Criteria Drawer -->
                <div id="exec-harvest-policy-drawer" style="display: none; padding: 1rem 1.25rem; background: #f8fafc; border-bottom: 1px solid #e2e8f0; font-size: 0.74rem;">
                    <div style="font-weight: 800; color: #0f172a; margin-bottom: 0.65rem; font-size: 0.82rem; display: flex; align-items: center; gap: 0.4rem;">
                        <span>📋 Single Source of Truth: COO Harvest Decision Gate &amp; Pathogen Policy</span>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.85rem;">
                        <div style="background: #ffffff; border: 1px solid #dcfce7; border-left: 3px solid #10b981; border-radius: 6px; padding: 0.75rem;">
                            <div style="font-weight: 800; color: #065f46; margin-bottom: 0.25rem;">🌟 Optimum Harvest</div>
                            <div style="color: #475569; line-height: 1.4;">Prime market processing weight.<br>• <strong>VAN</strong>: ABW ≥ 16.0g<br>• <strong>MON</strong>: ABW ≥ 30.0g</div>
                        </div>
                        <div style="background: #ffffff; border: 1px solid #ffedd5; border-left: 3px solid #f97316; border-radius: 6px; padding: 0.75rem;">
                            <div style="font-weight: 800; color: #9a3412; margin-bottom: 0.25rem;">🟡 Minimum Commercial</div>
                            <div style="color: #475569; line-height: 1.4;">Commercial thinning &amp; liquidation window.<br>• <strong>VAN</strong>: ABW ≥ 10.0g<br>• <strong>MON</strong>: ABW ≥ 25.0g</div>
                        </div>
                        <div style="background: #ffffff; border: 1px solid #fee2e2; border-left: 3px solid #ef4444; border-radius: 6px; padding: 0.75rem;">
                            <div style="font-weight: 800; color: #991b1b; margin-bottom: 0.25rem;">🚨 Forced Harvest (Stunted)</div>
                            <div style="color: #475569; line-height: 1.4;">Terminated to stop FCR feed loss.<br>• <strong>VAN</strong>: DOC ≥ 80d &amp; ABW &lt; 10.0g<br>• <strong>MON</strong>: DOC ≥ 120d &amp; ABW &lt; 25.0g</div>
                        </div>
                        <div style="background: #ffffff; border: 1px solid #ffe4e6; border-left: 3px solid #f43f5e; border-radius: 6px; padding: 0.75rem;">
                            <div style="font-weight: 800; color: #9f1239; margin-bottom: 0.25rem;">☣️ Emergency (Acute Virus)</div>
                            <div style="color: #475569; line-height: 1.4;">Immediate salvage before mortality.<br>• <strong>WSSV, EMS/AHPND, IMNV</strong><br>• Liquidatable: VAN ≥ 8g, MON ≥ 18g</div>
                        </div>
                        <div style="background: #ffffff; border: 1px solid #fef3c7; border-left: 3px solid #f59e0b; border-radius: 6px; padding: 0.75rem;">
                            <div style="font-weight: 800; color: #92400e; margin-bottom: 0.25rem;">⚠️ Growth Watch &amp; EHP</div>
                            <div style="color: #475569; line-height: 1.4;">Stalled pace near harvest DOC.<br>• <strong>VAN</strong>: DOC ≥ 70d &amp; ADG &lt; 0.15g/d<br>• <strong>MON</strong>: DOC ≥ 110d &amp; ADG &lt; 0.18g/d<br>• <em>EHP with good growth is allowed to continue</em></div>
                        </div>
                    </div>
                </div>

                <div style="overflow-x: auto;">
                    <table class="exec-pipeline-table" style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.78rem;">
                        <thead style="background: #f8fafc; font-size: 0.7rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid #e2e8f0;">
                            <tr>
                                <th data-sort-key="pond" style="padding: 0.65rem 1rem; cursor: pointer; user-select: none;" title="Sort by Pond Code">Pond <span class="sort-indicator">↕</span></th>
                                <th data-sort-key="species" style="padding: 0.65rem 0.75rem; cursor: pointer; user-select: none;" title="Sort by Species">Species <span class="sort-indicator">↕</span></th>
                                <th data-sort-key="classification" style="padding: 0.65rem 0.75rem; cursor: pointer; user-select: none;" title="Sort by Classification Urgency">Classification &amp; Reason <span class="sort-indicator">↕</span></th>
                                <th data-sort-key="abw" style="padding: 0.65rem 0.75rem; text-align: right; cursor: pointer; user-select: none;" title="Sort by Latest Weight">Latest ABW <span class="sort-indicator">↕</span></th>
                                <th data-sort-key="doc" style="padding: 0.65rem 0.75rem; text-align: right; cursor: pointer; user-select: none;" title="Sort by Culture Age (DOC)">Age (DOC) <span class="sort-indicator">↕</span></th>
                                <th data-sort-key="biomassKg" style="padding: 0.65rem 0.75rem; text-align: right; cursor: pointer; user-select: none;" title="Sort by Estimated Biomass">Est. Biomass <span class="sort-indicator">↕</span></th>
                                <th data-sort-key="adg" style="padding: 0.65rem 0.75rem; text-align: right; cursor: pointer; user-select: none;" title="Cumulative Average Daily Growth (ABW / DOC)">ADG (g/d) <span class="sort-indicator">↕</span></th>
                                <th data-sort-key="awg" style="padding: 0.65rem 0.75rem; text-align: right; cursor: pointer; user-select: none;" title="Recent Weekly Gain Pace (Weight Delta / Days)">AWG (g/d) <span class="sort-indicator">↕</span></th>
                                <th data-sort-key="issueFlag" style="padding: 0.65rem 0.75rem; cursor: pointer; user-select: none;" title="Sort by Biosecurity Lab Status">Biosecurity <span class="sort-indicator">↕</span></th>
                                <th data-sort-key="action" style="padding: 0.65rem 1rem; text-align: right; cursor: pointer; user-select: none;" title="Sort by Action Gate Priority">Action Gate <span class="sort-indicator">↕</span></th>
                            </tr>
                        </thead>
                        <tbody id="exec-pipeline-tbody" style="divide-y: 1px solid #f1f5f9; background: #ffffff;">
                            ${renderPipelineRowsHtml(evaluatedPonds, pipelineFilter, forecast14d)}
                        </tbody>
                        <tfoot id="exec-pipeline-tfoot">
                            ${renderPipelineFooterHtml(filterPondsForPipeline(evaluatedPonds, pipelineFilter, forecast14d))}
                        </tfoot>
                    </table>
                </div>
            </div>

            <!-- SECTION 3: 12-MONTH MOVING PERFORMANCE (CANVAS DUAL CHARTS + PACKOUT QUALITY) -->
            <div class="exec-biomass-analytics-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem;">
                
                <!-- Left: Minimalist Pastel Chart -->
                <div class="sleek-card" style="padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem; grid-column: span 2;">
                    <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 0.75rem;">
                        <div>
                            <div style="font-size: 0.88rem; font-weight: 800; color: #0f172a;">12-Month Moving Biomass &amp; Commercial Yield</div>
                            <div style="font-size: 0.72rem; color: #64748b;">Continuous 12-month rolling biomass (Tons) and verified commercial gross revenue (RM)</div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 1rem; font-size: 0.72rem; font-weight: 600;">
                            <span style="display: inline-flex; align-items: center; gap: 5px; color: #475569;">
                                <span style="width: 10px; height: 10px; border-radius: 2px; background: #bae6fd;"></span> Biomass (Tons)
                            </span>
                            <span style="display: inline-flex; align-items: center; gap: 5px; color: #475569;">
                                <span style="width: 12px; height: 2px; background: #059669;"></span> Gross Revenue (RM)
                            </span>
                        </div>
                    </div>

                    <div style="position: relative; width: 100%; height: 260px; background: #f8fafc; border-radius: 8px; border: 1px solid #f1f5f9; padding: 0.5rem; box-sizing: border-box;">
                        <canvas id="canvas-exec-pastel-biomass" style="width: 100%; height: 100%;"></canvas>
                    </div>
                </div>

                <!-- Right: Commercial Packout Quality & Top Off-Takers -->
                ${renderCommercialPackoutCardHtml({
                    packout: activePackout,
                    topBuyers: activeBuyersData.buyers || [],
                    currentSpecies: activePackoutSpecies,
                    top3Concentration: activeBuyersData.top3ConcentrationPct || 0
                })}

            </div>

            <!-- SECTION 4: 12-MONTH HISTORICAL PERFORMANCE LEDGER TABLE (BI REDESIGNED) -->
            <div id="exec-ledger-container">
                ${renderPerformanceLedgerSectionHtml({
                    buckets,
                    totals: agg.totals || {},
                    cohortFilter,
                    ledgerTimeHorizon,
                    hideEmptyMonths,
                    sortKey: ledgerSortKey,
                    sortDirection: ledgerSortDirection
                })}
            </div>

        </div>
    `;
}
