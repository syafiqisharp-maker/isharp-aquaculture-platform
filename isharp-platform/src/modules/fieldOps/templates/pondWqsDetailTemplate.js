/**
 * iSHARP DBMS 2.0 — Field Operations: Pond WQS Operational Detail Template
 * Generates structured layout markup for:
 * - Pond Details & Weekly Biometrics
 * - Feeding Action Plan & Diagnostics
 * - High-Contrast Aero Sensor Telemetry Cards
 * - Weather Station Live Readings
 * - Personnel & Asset Status
 * 
 * Clean Coding Standard: Pure HTML template generator.
 */

import {
    WATER_QUALITY_THRESHOLDS,
    formatParameterTarget,
    evaluateParameterStatus
} from "../../../domain/waterQualityLimit.js";

/**
 * Generates the HTML layout for the Pond WQS Detail View.
 * @param {object} params
 * @returns {string}
 */
export function getPondWqsDetailHtml({
    pondLabel,
    pond,
    isIdle,
    doc,
    areaHa,
    evalResult,
    bannerColor,
    bannerBorder,
    weatherTime,
    airTemp,
    luxVal,
    rainToday,
    humidity,
    pressure,
    totalHP,
    aerationDensity,
    u1,
    u2,
    hasWqIot,
    rawDo,
    rawPh,
    rawTemp,
    labWq = null
}) {
    const hasLabWq = Boolean(labWq && labWq.log_date);
    const labDateStr = hasLabWq ? labWq.log_date : "Awaiting Lab Test";
    const labDocBadge = (hasLabWq && labWq.doc !== null && labWq.doc !== undefined)
        ? `<span style="font-size: 0.74rem; font-weight: 700; opacity: 0.9; margin-left: 0.25rem;">(DOC ${labWq.doc})</span>`
        : "";

    // Parameter evaluations from Single Source of Truth (waterQualityLimit.js)
    const salEval = evaluateParameterStatus("salinity", hasLabWq ? labWq.salinity_ppt : null);
    const labSalinity = (hasLabWq && labWq.salinity_ppt !== null) ? labWq.salinity_ppt : "—";
    const labSalColor = salEval.status === "alert" ? "#ef4444" : salEval.status === "warning" ? "#d97706" : "#072642";

    const alkEval = evaluateParameterStatus("alkalinity", hasLabWq ? labWq.alkalinity : null);
    const labAlkalinity = (hasLabWq && labWq.alkalinity !== null) ? labWq.alkalinity : "—";
    const labAlkColor = alkEval.status === "alert" ? "#ef4444" : alkEval.status === "warning" ? "#ea580c" : "#072642";

    const nh3Eval = evaluateParameterStatus("ammonia", hasLabWq ? labWq.ammonia : null);
    const labAmmonia = (hasLabWq && labWq.ammonia !== null) ? labWq.ammonia : "—";
    const labNh3Color = nh3Eval.status === "alert" ? "#ef4444" : nh3Eval.status === "warning" ? "#d97706" : "#072642";

    const no2Eval = evaluateParameterStatus("nitrite", hasLabWq ? labWq.nitrite : null);
    const labNitrite = (hasLabWq && labWq.nitrite !== null) ? labWq.nitrite : "—";
    const labNo2Color = no2Eval.status === "alert" ? "#ef4444" : no2Eval.status === "warning" ? "#d97706" : "#072642";

    const caEval = evaluateParameterStatus("calcium", hasLabWq ? labWq.calcium : null);
    const labCalcium = (hasLabWq && labWq.calcium !== null) ? Math.round(labWq.calcium) : "—";
    const labCaColor = caEval.status === "alert" ? "#ef4444" : caEval.status === "warning" ? "#d97706" : "#072642";

    const mgEval = evaluateParameterStatus("magnesium", hasLabWq ? labWq.magnesium : null);
    const labMagnesium = (hasLabWq && labWq.magnesium !== null) ? Math.round(labWq.magnesium) : "—";
    const labMgColor = mgEval.status === "alert" ? "#ef4444" : mgEval.status === "warning" ? "#d97706" : "#072642";

    const labRatio = (hasLabWq && labWq.calcium && labWq.magnesium && labWq.calcium > 0)
        ? `1 : ${(labWq.magnesium / labWq.calcium).toFixed(1)}`
        : "—";

    const turbEval = evaluateParameterStatus("turbidity", hasLabWq ? labWq.turbidity : null);
    const labTurbidity = (hasLabWq && labWq.turbidity !== null) ? labWq.turbidity : "—";
    const labTurbColor = turbEval.status === "alert" ? "#ef4444" : turbEval.status === "warning" ? "#d97706" : "#072642";
    return `
        <div class="pond-wqs-wrapper" style="padding: 1.25rem 2rem; max-width: 1200px; margin: 0 auto; display: flex; flex-direction: column; gap: 1.4rem;">
            
            <!-- Top Navigation & Pond Identity Bar -->
            <div class="wqs-nav-bar flex-between" style="border-radius: 16px; padding: 0.9rem 1.4rem; flex-wrap: wrap; gap: 0.75rem;">
                <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
                    <button type="button" id="btn-wqs-back" class="btn-action btn-secondary" style="font-size: 0.82rem; font-weight: 700; padding: 0.45rem 0.95rem; display: flex; align-items: center; gap: 0.4rem;">
                        <span class="btn-text-full">← Back to 24 Ponds</span>
                        <span class="btn-text-short">← Back to Map</span>
                    </button>
                    <div>
                        <div style="display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
                            <h1 style="margin: 0; font-size: 1.4rem; color: #0f172a; font-weight: 900;">Pond ${pondLabel}</h1>
                            <span style="font-size: 0.75rem; font-weight: 800; background: #e0f2fe; color: #0369a1; padding: 0.2rem 0.65rem; border-radius: 999px;">
                                Cycle ${pond.cycle_no || (pond.pond_index ? pond.pond_index.split(".")[1] : '—')}
                            </span>
                            <span style="font-size: 0.75rem; font-weight: 800; background: ${isIdle ? '#f1f5f9' : '#dcfce7'}; color: ${isIdle ? '#64748b' : '#15803d'}; padding: 0.2rem 0.65rem; border-radius: 999px;">
                                ${isIdle ? 'IDLE' : `DOC ${doc}`}
                            </span>
                        </div>
                        <span style="font-size: 0.78rem; color: #64748b;">
                            ${pond.stck_species || 'P. VANNAMEI'} · Line: ${pond.bs_line || 'Syaqua'} · Area: ${areaHa} Ha
                        </span>
                    </div>
                </div>

                <!-- Action Navigation Buttons: Daily Records & Management Entry -->
                <div class="wqs-nav-actions" style="display: flex; align-items: center; gap: 0.65rem;">
                    <button type="button" id="btn-open-daily-page" class="btn-action btn-primary" style="font-size: 0.86rem; font-weight: 800; padding: 0.52rem 1.3rem; display: flex; align-items: center; gap: 0.45rem; background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); box-shadow: 0 4px 14px rgba(2, 132, 199, 0.25);">
                        <span>📖 Daily Records</span>
                        <span style="font-size: 0.72rem; opacity: 0.85;">➔</span>
                    </button>
                    <button type="button" id="btn-open-mgmt-page" class="btn-action btn-secondary" style="font-size: 0.86rem; font-weight: 800; padding: 0.52rem 1.3rem; display: flex; align-items: center; gap: 0.45rem;">
                        <span class="btn-text-full">📝 Management Entry</span>
                        <span class="btn-text-short">📝 Management</span>
                        <span style="font-size: 0.72rem; opacity: 0.85;">➔</span>
                    </button>
                </div>
            </div>

            <!-- SECTION 1: POND DETAILS & RECENT SAMPLING RESULTS -->
            <section class="glass-card" style="padding: 1.3rem 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem; border-bottom: 1px solid rgba(255, 255, 255, 0.4); padding-bottom: 0.65rem;">
                    <div style="display: flex; align-items: center; gap: 0.6rem;">
                        <h2 style="margin: 0; font-size: 1.15rem; font-weight: 900; color: #072642; letter-spacing: -0.01em; text-shadow: 0 1px 2px rgba(255, 255, 255, 0.8);">Pond Details</h2>
                    </div>
                    <span id="wqs-sample-date" style="font-size: 0.78rem; font-weight: 800; color: #072642; text-shadow: 0 1px 2px rgba(255, 255, 255, 0.8);">Loading biometrics...</span>
                </div>

                <!-- Meta Info Bar: Species, Line, Stock Source, DOC -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.75rem; margin-bottom: 1.1rem; padding: 0.85rem 1.1rem; border-radius: 12px; border: 1px solid #cbd5e1; background: #ffffff;">
                    <div>
                        <span style="font-size: 0.72rem; color: #0369a1; font-weight: 800; text-transform: uppercase; letter-spacing: 0.03em; display: block;">Species</span>
                        <strong style="font-size: 0.9rem; color: #072642; font-weight: 900;">${pond.stck_species || 'P. VANNAMEI'}</strong>
                    </div>
                    <div>
                        <span style="font-size: 0.72rem; color: #0369a1; font-weight: 800; text-transform: uppercase; letter-spacing: 0.03em; display: block;">Breeding Line</span>
                        <strong style="font-size: 0.9rem; color: #072642; font-weight: 900;">${pond.bs_line || 'Syaqua'}</strong>
                    </div>
                    <div>
                        <span style="font-size: 0.72rem; color: #0369a1; font-weight: 800; text-transform: uppercase; letter-spacing: 0.03em; display: block;">Stock Date</span>
                        <strong style="font-size: 0.9rem; color: #072642; font-weight: 900;">${pond.stck_date || '—'}</strong>
                    </div>
                    <div>
                        <span style="font-size: 0.72rem; color: #0369a1; font-weight: 800; text-transform: uppercase; letter-spacing: 0.03em; display: block;">Culture Age</span>
                        <strong style="font-size: 0.9rem; color: #15803d; font-weight: 900;">${isIdle ? 'IDLE' : `DOC ${doc}`}</strong>
                    </div>
                </div>

                <!-- Recent Sampling Sub-grid -->
                <div id="wqs-sampling-grid" class="wqs-biometrics-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 0.75rem;">
                    <div class="wqs-metric-card">
                        <div style="font-size: 0.74rem; font-weight: 900; color: #0369a1; text-transform: uppercase; letter-spacing: 0.04em;">Sample ABW</div>
                        <div id="wqs-val-abw" style="font-size: 1.45rem; font-weight: 900; color: #072642; margin: 0.2rem 0; font-family: var(--font-mono, monospace);">—</div>
                        <div style="font-size: 0.7rem; color: #0f3d63; font-weight: 700;">Average Body Weight</div>
                    </div>
                    <div class="wqs-metric-card">
                        <div style="font-size: 0.74rem; font-weight: 900; color: #0369a1; text-transform: uppercase; letter-spacing: 0.04em;">Sample AWG</div>
                        <div id="wqs-val-awg" style="font-size: 1.45rem; font-weight: 900; color: #072642; margin: 0.2rem 0; font-family: var(--font-mono, monospace);">—</div>
                        <div style="font-size: 0.7rem; color: #0f3d63; font-weight: 700;">Weekly Growth</div>
                    </div>
                    <div class="wqs-metric-card">
                        <div style="font-size: 0.74rem; font-weight: 900; color: #0369a1; text-transform: uppercase; letter-spacing: 0.04em;">Survival Rate (SR)</div>
                        <div id="wqs-val-sr" style="font-size: 1.45rem; font-weight: 900; color: #15803d; margin: 0.2rem 0; font-family: var(--font-mono, monospace);">—</div>
                        <div style="font-size: 0.7rem; color: #0f3d63; font-weight: 700;">Estimated %</div>
                    </div>
                    <div class="wqs-metric-card">
                        <div style="font-size: 0.74rem; font-weight: 900; color: #0369a1; text-transform: uppercase; letter-spacing: 0.04em;">Biomass</div>
                        <div id="wqs-val-biomass" style="font-size: 1.45rem; font-weight: 900; color: #072642; margin: 0.2rem 0; font-family: var(--font-mono, monospace);">—</div>
                        <div style="font-size: 0.7rem; color: #0f3d63; font-weight: 700;">Estimated Total kg</div>
                    </div>
                    <div class="wqs-metric-card">
                        <div style="font-size: 0.74rem; font-weight: 900; color: #0369a1; text-transform: uppercase; letter-spacing: 0.04em;">Sample FCR</div>
                        <div id="wqs-val-fcr" style="font-size: 1.45rem; font-weight: 900; color: #072642; margin: 0.2rem 0; font-family: var(--font-mono, monospace);">—</div>
                        <div style="font-size: 0.7rem; color: #0f3d63; font-weight: 700;">Feed Conversion Ratio</div>
                    </div>
                </div>
            </section>

            <!-- SECTION: LABORATORY WATER CHEMISTRY (BENTO KPI GRID) -->
            <section class="glass-card" style="padding: 1.3rem 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem; border-bottom: 1px solid rgba(255, 255, 255, 0.4); padding-bottom: 0.65rem; flex-wrap: wrap; gap: 0.5rem;">
                    <div style="display: flex; align-items: center; gap: 0.6rem;">
                        <h2 style="margin: 0; font-size: 1.15rem; font-weight: 900; color: #072642; letter-spacing: -0.01em; display: flex; align-items: center; gap: 0.45rem; text-shadow: 0 1px 2px rgba(255, 255, 255, 0.8);">
                            <span>🧪</span> Laboratory Results
                        </h2>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span style="font-size: 0.82rem; font-weight: 800; background: ${hasLabWq ? 'rgba(239, 246, 255, 0.9)' : 'rgba(248, 250, 252, 0.8)'}; color: #072642; padding: 0.35rem 0.95rem; border-radius: 999px; border: 1.5px solid ${hasLabWq ? 'rgba(191, 219, 254, 0.9)' : 'rgba(203, 213, 225, 0.8)'}; box-shadow: 0 2px 8px rgba(2, 132, 199, 0.1); display: inline-flex; align-items: center; gap: 0.45rem;">
                            <span>📅</span> <span>Sample Date: <strong style="color: #0369a1; font-weight: 900;">${labDateStr}</strong></span>
                            ${labDocBadge}
                        </span>
                    </div>
                </div>

                <!-- Bento KPI Grid (8 Cards) -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 0.75rem;">
                    <div class="wqs-metric-card">
                        <div style="font-size: 0.76rem; font-weight: 900; color: #0369a1; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.25rem;">Salinity</div>
                        <div style="font-size: 1.45rem; font-weight: 900; color: ${labSalColor}; margin: 0.2rem 0; font-family: var(--font-mono, monospace);">
                            ${labSalinity} <span style="font-size: 0.75rem; font-weight: 800; color: #0f3d63;">ppt</span>
                        </div>
                        <div style="font-size: 0.7rem; color: #0f3d63; font-weight: 700;">Target: ${formatParameterTarget("salinity")}</div>
                    </div>

                    <div class="wqs-metric-card">
                        <div style="font-size: 0.76rem; font-weight: 900; color: #0369a1; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.25rem;">Alkalinity</div>
                        <div style="font-size: 1.45rem; font-weight: 900; color: ${labAlkColor}; margin: 0.2rem 0; font-family: var(--font-mono, monospace);">
                            ${labAlkalinity} <span style="font-size: 0.75rem; font-weight: 800; color: #0f3d63;">mg/L</span>
                        </div>
                        <div style="font-size: 0.7rem; color: #0f3d63; font-weight: 700;">Target: ${formatParameterTarget("alkalinity")}</div>
                    </div>

                    <div class="wqs-metric-card">
                        <div style="font-size: 0.76rem; font-weight: 900; color: #0369a1; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.25rem;">Ammonia (NH₃)</div>
                        <div style="font-size: 1.45rem; font-weight: 900; color: ${labNh3Color}; margin: 0.2rem 0; font-family: var(--font-mono, monospace);">
                            ${labAmmonia} <span style="font-size: 0.75rem; font-weight: 800; color: #0f3d63;">mg/L</span>
                        </div>
                        <div style="font-size: 0.7rem; color: #0f3d63; font-weight: 700;">Safe: ${formatParameterTarget("ammonia")}</div>
                    </div>

                    <div class="wqs-metric-card">
                        <div style="font-size: 0.76rem; font-weight: 900; color: #0369a1; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.25rem;">Nitrite (NO₂⁻)</div>
                        <div style="font-size: 1.45rem; font-weight: 900; color: ${labNo2Color}; margin: 0.2rem 0; font-family: var(--font-mono, monospace);">
                            ${labNitrite} <span style="font-size: 0.75rem; font-weight: 800; color: #0f3d63;">mg/L</span>
                        </div>
                        <div style="font-size: 0.7rem; color: #0f3d63; font-weight: 700;">Safe: ${formatParameterTarget("nitrite")}</div>
                    </div>

                    <div class="wqs-metric-card">
                        <div style="font-size: 0.76rem; font-weight: 900; color: #0369a1; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.25rem;">Calcium (Ca)</div>
                        <div style="font-size: 1.45rem; font-weight: 900; color: ${labCaColor}; margin: 0.2rem 0; font-family: var(--font-mono, monospace);">
                            ${labCalcium} <span style="font-size: 0.75rem; font-weight: 800; color: #0f3d63;">mg/L</span>
                        </div>
                        <div style="font-size: 0.7rem; color: #0f3d63; font-weight: 700;">Target: ${formatParameterTarget("calcium")}</div>
                    </div>

                    <div class="wqs-metric-card">
                        <div style="font-size: 0.76rem; font-weight: 900; color: #0369a1; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.25rem;">Magnesium (Mg)</div>
                        <div style="font-size: 1.45rem; font-weight: 900; color: ${labMgColor}; margin: 0.2rem 0; font-family: var(--font-mono, monospace);">
                            ${labMagnesium} <span style="font-size: 0.75rem; font-weight: 800; color: #0f3d63;">mg/L</span>
                        </div>
                        <div style="font-size: 0.7rem; color: #0f3d63; font-weight: 700;">Target: ${formatParameterTarget("magnesium")}</div>
                    </div>

                    <div class="wqs-metric-card">
                        <div style="font-size: 0.76rem; font-weight: 900; color: #0369a1; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.25rem;">Ca : Mg Ratio</div>
                        <div style="font-size: 1.45rem; font-weight: 900; color: #072642; margin: 0.2rem 0; font-family: var(--font-mono, monospace);">
                            ${labRatio}
                        </div>
                        <div style="font-size: 0.7rem; color: #0f3d63; font-weight: 700;">Target: ${formatParameterTarget("camg_ratio")}</div>
                    </div>

                    <div class="wqs-metric-card">
                        <div style="font-size: 0.76rem; font-weight: 900; color: #0369a1; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.25rem;">Turbidity</div>
                        <div style="font-size: 1.45rem; font-weight: 900; color: ${labTurbColor}; margin: 0.2rem 0; font-family: var(--font-mono, monospace);">
                            ${labTurbidity} <span style="font-size: 0.75rem; font-weight: 800; color: #0f3d63;">NTU</span>
                        </div>
                        <div style="font-size: 0.7rem; color: #0f3d63; font-weight: 700;">Target: ${formatParameterTarget("turbidity")}</div>
                    </div>
                </div>
            </section>

            <!-- SECTION 2: FEEDING ACTION PLAN (AERO HORIZON BANNER) -->
            <section class="feeding-horizon-banner">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                    <div style="display: flex; align-items: center; gap: 0.6rem;">
                        <span style="font-size: 1.6rem;">${evalResult.bannerIcon || '🦐'}</span>
                        <h3 class="banner-headline" style="margin: 0; font-size: 1.2rem; color: ${bannerColor}; font-weight: 900;">
                            Feeding Action Plan: Pond ${pondLabel}
                        </h3>
                    </div>
                    <span class="${evalResult.level === 'optimal' ? 'aero-badge-optimal' : 'badge'}" style="${evalResult.level === 'optimal' ? '' : `font-size: 0.82rem; font-weight: 800; padding: 0.35rem 0.85rem; border-radius: 999px; background: ${bannerBorder}; color: #ffffff;`}">
                        ${evalResult.badgeText}
                    </span>
                </div>

                <!-- "Why?" Diagnostics List -->
                <div style="display: flex; flex-direction: column; gap: 0.45rem; margin-top: 0.4rem;">
                    ${evalResult.reasons.map(r => `
                        <div style="display: flex; align-items: center; gap: 0.6rem; background: rgba(255, 255, 255, 0.8); border: 1px solid rgba(255, 255, 255, 0.95); border-radius: 10px; padding: 0.5rem 0.85rem; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
                            <span style="font-size: 1.1rem; line-height: 1;">${r.icon}</span>
                            <div style="font-size: 0.82rem; color: #072642;">
                                <strong>${r.headline}</strong>
                                ${r.desc ? `<span style="font-size: 0.74rem; color: #64748b; margin-left: 0.4rem;">— ${r.desc}</span>` : ''}
                            </div>
                        </div>
                    `).join("")}
                </div>
            </section>

            <!-- SECTION 3: TELEMETRY MATRIX (SENSOR CARDS) -->
            <div class="telemetry-grid-4">
                <!-- Card 1: Live Weather Station -->
                <div class="sensor-aero-card">
                    <div class="sensor-title-row">
                        <span style="display: flex; align-items: center; gap: 0.35rem;">
                            <span>☀️</span> Weather Station iSHARP
                        </span>
                        <span style="font-size: 0.7rem; font-weight: 800; color: #15803d; background: rgba(220, 252, 231, 0.9); padding: 0.15rem 0.5rem; border-radius: 999px; border: 1px solid rgba(187, 247, 208, 0.9);">● ONLINE (${weatherTime})</span>
                    </div>
                    <div class="sensor-big-val" style="color: #072642; font-family: var(--font-mono, monospace);">${airTemp.toFixed(1)} <span style="font-size: 0.9rem; font-weight: 700; color: #0f3d63;">°C</span></div>
                    <div style="font-size: 0.78rem; color: #0f3d63; font-weight: 600;">
                        Lux: <strong style="color: #072642;">${Math.round(luxVal).toLocaleString()}</strong> • Rain: <strong style="color: #072642;">${rainToday.toFixed(1)} mm</strong>
                    </div>
                </div>

                <!-- Card 2: Active Paddlewheels -->
                <div class="sensor-aero-card">
                    <div class="sensor-title-row">
                        <span style="display: flex; align-items: center; gap: 0.35rem;">
                            <span>⚡</span> Active Paddlewheels
                        </span>
                        <span class="aero-orb ${totalHP > 0 ? 'orb-emerald' : 'orb-idle'}"></span>
                    </div>
                    <div class="sensor-big-val" style="color: ${totalHP > 0 ? '#15803d' : '#64748b'}; font-family: var(--font-mono, monospace);">${totalHP.toFixed(1)} <span style="font-size: 0.9rem; font-weight: 700; color: #0f3d63;">HP</span></div>
                    <div style="font-size: 0.78rem; color: #0f3d63; font-weight: 600;">
                        Density: <strong style="color: #072642;">${aerationDensity} HP/Ha</strong> (${u1}× 1HP + ${u2}× 2HP)
                    </div>
                </div>

                <!-- Card 3: Pond IoT Node -->
                <div class="sensor-aero-card">
                    <div class="sensor-title-row">
                        <span style="display: flex; align-items: center; gap: 0.35rem;">
                            <span>📡</span> Pond IoT Node
                        </span>
                        <span class="aero-orb ${hasWqIot ? 'orb-emerald' : 'orb-amber'}"></span>
                    </div>
                    ${hasWqIot ? `
                        <div class="sensor-big-val" style="color: #072642; font-family: var(--font-mono, monospace);">${rawDo.toFixed(2)} <span style="font-size: 0.9rem; font-weight: 700; color: #0f3d63;">ppm</span></div>
                        <div style="font-size: 0.78rem; color: #0f3d63; font-weight: 600;">
                            pH: <strong style="color: #072642;">${rawPh.toFixed(2)}</strong> • Temp: <strong style="color: #072642;">${rawTemp.toFixed(1)} °C</strong>
                        </div>
                    ` : `
                        <div class="standby-housing-box" style="margin-top: 8px;">
                            <div class="pulse-standby-beacon" style="display: inline-flex; align-items: center; gap: 6px; font-size: 0.74rem; font-weight: 800; color: #0369a1; margin-bottom: 4px;">
                                <span>📡</span> Awaiting Sensor Deployment
                            </div>
                            <div style="font-size: 0.72rem; color: #475569; font-weight: 600;">
                                DO: <strong>--</strong> | pH: <strong>--</strong> | Temp: <strong>--</strong>
                            </div>
                        </div>
                    `}
                </div>
            </div>

            <!-- SECTION 4: WEATHER STATUS -->
            <section class="glass-card" style="padding: 1.3rem 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid rgba(255, 255, 255, 0.4); padding-bottom: 0.65rem;">
                    <div>
                        <h3 style="margin: 0; font-size: 1.15rem; color: #072642; font-weight: 900; letter-spacing: -0.01em; display: flex; align-items: center; gap: 0.45rem; text-shadow: 0 1px 2px rgba(255, 255, 255, 0.8);">
                            <span>☀️ Weather Station iSHARP</span>
                            <span style="font-size: 0.72rem; font-weight: 800; background: rgba(220, 252, 231, 0.9); color: #15803d; padding: 0.2rem 0.6rem; border-radius: 6px; border: 1px solid rgba(187, 247, 208, 0.9);">● ONLINE (${weatherTime})</span>
                        </h3>
                    </div>
                </div>

                <div class="wqs-weather-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 0.85rem;">
                    <div class="wqs-metric-card" style="text-align: left;">
                        <span style="font-size: 0.74rem; font-weight: 900; color: #0369a1; text-transform: uppercase; letter-spacing: 0.04em; display: block;">Solar Irradiance</span>
                        <div style="font-size: 1.35rem; font-weight: 900; color: #b45309; margin: 0.2rem 0; font-family: var(--font-mono, monospace);">
                            ${Math.round(luxVal).toLocaleString()} <span style="font-size: 0.75rem; font-weight: 800; color: #0f3d63;">Lux</span>
                        </div>
                        <span style="font-size: 0.7rem; color: #15803d; font-weight: 800;">
                            ${luxVal >= 70000 ? '☀️ High Photosynthesis' : (luxVal >= 30000 ? '⛅ Moderate Light' : '☁️ Overcast / Low Light')}
                        </span>
                    </div>

                    <div class="wqs-metric-card" style="text-align: left;">
                        <span style="font-size: 0.74rem; font-weight: 900; color: #0369a1; text-transform: uppercase; letter-spacing: 0.04em; display: block;">Rainfall (Today)</span>
                        <div style="font-size: 1.35rem; font-weight: 900; color: ${rainToday >= 20 ? '#dc2626' : '#0369a1'}; margin: 0.2rem 0; font-family: var(--font-mono, monospace);">
                            ${rainToday.toFixed(1)} <span style="font-size: 0.75rem; font-weight: 800; color: #0f3d63;">mm</span>
                        </div>
                        <span style="font-size: 0.7rem; color: ${rainToday === 0 ? '#15803d' : (rainToday < 20 ? '#b45309' : '#b91c1c')}; font-weight: 800;">
                            ${rainToday === 0 ? '🟢 No Rain Detected' : (rainToday < 20 ? '🟡 Light Rain' : '🔴 Heavy Rain Danger')}
                        </span>
                    </div>

                    <div class="wqs-metric-card" style="text-align: left;">
                        <span style="font-size: 0.74rem; font-weight: 900; color: #0369a1; text-transform: uppercase; letter-spacing: 0.04em; display: block;">Ambient Air Temp</span>
                        <div style="font-size: 1.35rem; font-weight: 900; color: #c2410c; margin: 0.2rem 0; font-family: var(--font-mono, monospace);">
                            ${airTemp.toFixed(1)} <span style="font-size: 0.75rem; font-weight: 800; color: #0f3d63;">°C</span>
                        </div>
                        <span style="font-size: 0.7rem; color: #0f3d63; font-weight: 700;">Meteorological sensor</span>
                    </div>

                    <div class="wqs-metric-card" style="text-align: left;">
                        <span style="font-size: 0.74rem; font-weight: 900; color: #0369a1; text-transform: uppercase; letter-spacing: 0.04em; display: block;">Relative Humidity</span>
                        <div style="font-size: 1.35rem; font-weight: 900; color: #0369a1; margin: 0.2rem 0; font-family: var(--font-mono, monospace);">
                            ${humidity.toFixed(1)} <span style="font-size: 0.75rem; font-weight: 800; color: #0f3d63;">%</span>
                        </div>
                        <span style="font-size: 0.7rem; color: #0f3d63; font-weight: 700;">Atmospheric moisture</span>
                    </div>

                    <div class="wqs-metric-card" style="text-align: left;">
                        <span style="font-size: 0.74rem; font-weight: 900; color: #0369a1; text-transform: uppercase; letter-spacing: 0.04em; display: block;">Barometric Pressure</span>
                        <div style="font-size: 1.35rem; font-weight: 900; color: #072642; margin: 0.2rem 0; font-family: var(--font-mono, monospace);">
                            ${pressure.toFixed(0)} <span style="font-size: 0.75rem; font-weight: 800; color: #0f3d63;">hPa</span>
                        </div>
                        <span style="font-size: 0.7rem; color: #0f3d63; font-weight: 700;">Sea level normalized</span>
                    </div>
                </div>
            </section>

            <!-- SECTION 5: CURRENT HARDWARE & ASSIGNED CREW PREVIEW -->
            <section class="glass-card" style="padding: 1.3rem 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid rgba(255, 255, 255, 0.4); padding-bottom: 0.65rem;">
                    <div>
                        <h3 style="margin: 0; font-size: 1.15rem; color: #072642; font-weight: 900; letter-spacing: -0.01em; text-shadow: 0 1px 2px rgba(255, 255, 255, 0.8);">
                            👥 Personnel &amp; Aset Status
                        </h3>
                        <span style="font-size: 0.76rem; color: #0f3d63; font-weight: 700; text-shadow: 0 1px 1px rgba(255, 255, 255, 0.8);">Sync with main database (DBMS, Supabase).</span>
                    </div>
                    <button type="button" id="btn-edit-hardware-crew" class="btn-action btn-secondary" style="font-size: 0.82rem; font-weight: 800; padding: 0.45rem 1rem;">
                        <span>Edit in Management Entry ➔</span>
                    </button>
                </div>

                <div class="wqs-crew-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.85rem;">
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0.75rem 1rem;">
                        <span style="font-size: 0.72rem; font-weight: 700; color: #64748b;">🦐 Pond Operator</span>
                        <div id="wqs-preview-po" style="font-size: 0.88rem; font-weight: 800; color: #0f172a; margin-top: 0.25rem;">Loading...</div>
                    </div>

                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0.75rem 1rem;">
                        <span style="font-size: 0.72rem; font-weight: 700; color: #64748b;">🚜 Row Leader</span>
                        <div id="wqs-preview-rl" style="font-size: 0.88rem; font-weight: 800; color: #0f172a; margin-top: 0.25rem;">Loading...</div>
                    </div>

                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0.75rem 1rem;">
                        <span style="font-size: 0.72rem; font-weight: 700; color: #64748b;">⚡ Paddlewheels (1HP / 2HP)</span>
                        <div id="wqs-preview-hp" style="font-size: 0.88rem; font-weight: 800; color: #0284c7; margin-top: 0.25rem;">
                            ${totalHP} HP (${aerationDensity} HP/Ha)
                        </div>
                        <span style="font-size: 0.68rem; color: #64748b;">1HP: ${u1} units | 2HP: ${u2} units</span>
                    </div>

                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0.75rem 1rem;">
                        <span style="font-size: 0.72rem; font-weight: 700; color: #64748b;">🛖 Pond Hut Condition</span>
                        <div id="wqs-preview-hut" style="font-size: 0.88rem; font-weight: 800; color: #166534; margin-top: 0.25rem;">Loading...</div>
                    </div>
                </div>
            </section>

        </div>
    `;
}
