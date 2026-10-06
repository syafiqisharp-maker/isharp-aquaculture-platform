/**
 * iSHARP DBMS 2.0 — Field Operations: Daily Records Presentation Templates
 * Pure presentation templates for Logbook Breadcrumbs, Cycle Metrics, Desktop Table,
 * and Mobile Timeline Cards. Separates view structure from controller logic.
 */

import { formatLocalDateDisplay, getWaterColourMeta } from "./dailyRecordsConstants.js";

/**
 * Top breadcrumb navigation and pond identity header
 */
export function renderNavBar({ pondLabel, cycleNo, doc }) {
    return `
        <div class="daily-nav-bar flex-between" style="background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 1); border-radius: 16px; padding: 0.85rem 1.4rem; box-shadow: 0 4px 20px rgba(2, 132, 199, 0.08); flex-wrap: wrap; gap: 0.75rem;">
            <div class="btn-group" style="display: flex; align-items: center; gap: 0.75rem;">
                <button type="button" id="btn-daily-back-pond" class="btn-action btn-secondary" style="font-size: 0.8rem; font-weight: 700; padding: 0.4rem 0.85rem;">
                    <span class="btn-text-full">← Back to Pond View</span>
                    <span class="btn-text-short">← Pond View</span>
                </button>
                <button type="button" id="btn-daily-back-map" class="btn-action btn-secondary" style="font-size: 0.8rem; font-weight: 700; padding: 0.4rem 0.85rem;">
                    <span class="btn-text-full">🗺️ Back to 24-Pond Map</span>
                    <span class="btn-text-short">🗺️ Back to Map</span>
                </button>
            </div>

            <div style="display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
                <span style="font-size: 0.78rem; font-weight: 800; background: #e0f2fe; color: #0284c7; padding: 0.25rem 0.65rem; border-radius: 999px;">
                    Pond ${pondLabel}
                </span>
                <span style="font-size: 0.78rem; font-weight: 800; background: #dcfce7; color: #166534; padding: 0.25rem 0.65rem; border-radius: 999px;">
                    Cycle ${cycleNo}
                </span>
                <span style="font-size: 0.78rem; font-weight: 800; background: #f1f5f9; color: #475569; padding: 0.25rem 0.65rem; border-radius: 999px;">
                    DOC ${doc || '—'}
                </span>
            </div>
        </div>
    `;
}

/**
 * Cycle metrics summary grid (Feed, Tray %, Minerals, Probiotics, Mortalities)
 */
export function renderMetricsSummaryGrid({
    stckDateStr,
    areaHa,
    totalFeedKg,
    recordsCount,
    avgTrayRemnant,
    usageSummary,
    totalMortalitiesKg
}) {
    return `
        <div class="daily-metrics-summary-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem;">
            
            <div style="background: rgba(255, 255, 255, 0.95); border: 1px solid #e2e8f0; border-radius: 14px; padding: 0.9rem 1.1rem; box-shadow: 0 2px 10px rgba(0,0,0,0.03);">
                <span style="font-size: 0.72rem; font-weight: 700; color: #64748b; text-transform: uppercase;">Stocking Date</span>
                <div style="font-size: 1.15rem; font-weight: 800; color: #0f172a; margin-top: 0.2rem;">${stckDateStr}</div>
                <span style="font-size: 0.72rem; color: #0284c7; font-weight: 600;">Area: ${areaHa} Ha</span>
            </div>

            <div style="background: rgba(255, 255, 255, 0.95); border: 1px solid #e2e8f0; border-radius: 14px; padding: 0.9rem 1.1rem; box-shadow: 0 2px 10px rgba(0,0,0,0.03);">
                <span style="font-size: 0.72rem; font-weight: 700; color: #64748b; text-transform: uppercase;">Total Cumulative Feed</span>
                <div style="font-size: 1.15rem; font-weight: 800; color: #0369a1; margin-top: 0.2rem;">${totalFeedKg.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg</div>
                <span style="font-size: 0.72rem; color: #64748b;">${recordsCount} logged days</span>
            </div>

            <div style="background: rgba(255, 255, 255, 0.95); border: 1px solid #e2e8f0; border-radius: 14px; padding: 0.9rem 1.1rem; box-shadow: 0 2px 10px rgba(0,0,0,0.03);">
                <span style="font-size: 0.72rem; font-weight: 700; color: #64748b; text-transform: uppercase;">Avg Tray Remnant</span>
                <div style="font-size: 1.15rem; font-weight: 800; color: ${avgTrayRemnant <= 10 ? '#15803d' : avgTrayRemnant <= 20 ? '#b45309' : '#b91c1c'}; margin-top: 0.2rem;">
                    ${avgTrayRemnant}%
                </div>
                <span style="font-size: 0.72rem; color: #64748b;">Target: &lt; 10%</span>
            </div>

            <div style="background: rgba(255, 255, 255, 0.95); border: 1px solid #e2e8f0; border-radius: 14px; padding: 0.9rem 1.1rem; box-shadow: 0 2px 10px rgba(0,0,0,0.03);">
                <span style="font-size: 0.72rem; font-weight: 700; color: #64748b; text-transform: uppercase;">Total Minerals Applied</span>
                <div style="font-size: 1.15rem; font-weight: 800; color: #0369a1; margin-top: 0.2rem;">
                    ${usageSummary.totalMineralKg.toLocaleString()} kg
                </div>
                <span style="font-size: 0.72rem; color: #64748b;">${usageSummary.minerals.length} distinct mineral types</span>
            </div>

            <div style="background: rgba(255, 255, 255, 0.95); border: 1px solid #e2e8f0; border-radius: 14px; padding: 0.9rem 1.1rem; box-shadow: 0 2px 10px rgba(0,0,0,0.03);">
                <span style="font-size: 0.72rem; font-weight: 700; color: #64748b; text-transform: uppercase;">Total Probiotics Applied</span>
                <div style="font-size: 1.15rem; font-weight: 800; color: #92400e; margin-top: 0.2rem;">
                    ${usageSummary.totalProbioticL.toLocaleString()} L
                </div>
                <span style="font-size: 0.72rem; color: #64748b;">${usageSummary.probiotics.length} distinct products</span>
            </div>

            <div style="background: rgba(255, 255, 255, 0.95); border: 1px solid #e2e8f0; border-radius: 14px; padding: 0.9rem 1.1rem; box-shadow: 0 2px 10px rgba(0,0,0,0.03);">
                <span style="font-size: 0.72rem; font-weight: 700; color: #64748b; text-transform: uppercase;">Total Mortalities</span>
                <div style="font-size: 1.15rem; font-weight: 800; color: ${totalMortalitiesKg > 0 ? '#b91c1c' : '#15803d'}; margin-top: 0.2rem;">
                    ${totalMortalitiesKg.toFixed(1)} kg
                </div>
                <span style="font-size: 0.72rem; color: #64748b;">Observed / scooped</span>
            </div>

        </div>
    `;
}

/**
 * Single desktop table row
 */
export function renderTableRow(row) {
    const { dateStr, doc, isToday, record, treatments } = row;
    const formattedDate = formatLocalDateDisplay(dateStr);

    const rowClass = isToday ? 'logbook-row is-today' : 'logbook-row';
    const docBadge = isToday
        ? `<span style="font-size: 0.72rem; font-weight: 800; background: #16a34a; color: #ffffff; padding: 0.15rem 0.5rem; border-radius: 999px;">DOC ${doc} (Today)</span>`
        : `<span style="font-size: 0.72rem; font-weight: 700; background: #e0f2fe; color: #0369a1; padding: 0.15rem 0.5rem; border-radius: 999px;">DOC ${doc}</span>`;

    const mineralsList = treatments.filter(t => t.category === 'MINERAL');
    const probioticsList = treatments.filter(t => t.category === 'PROBIOTIC');

    let mineralsBadges = '<span style="color: #64748b;">None</span>';
    if (mineralsList.length > 0) {
        mineralsBadges = `
            <div style="display: flex; flex-wrap: wrap; gap: 0.3rem;">
                ${mineralsList.map(m => `
                    <span style="font-size: 0.7rem; font-weight: 700; background: #e0f2fe; color: #0369a1; padding: 0.15rem 0.45rem; border-radius: 4px; border: 1px solid #bae6fd;">
                        ${m.item_name}: <strong>${m.amount} ${m.unit}</strong>
                    </span>
                `).join("")}
            </div>
        `;
    }

    let probioticsBadges = '<span style="color: #64748b;">None</span>';
    if (probioticsList.length > 0) {
        probioticsBadges = `
            <div style="display: flex; flex-wrap: wrap; gap: 0.3rem;">
                ${probioticsList.map(p => `
                    <span style="font-size: 0.7rem; font-weight: 700; background: #fef3c7; color: #92400e; padding: 0.15rem 0.45rem; border-radius: 4px; border: 1px solid #fde68a;">
                        ${p.item_name}: <strong>${p.amount} ${p.unit}</strong>
                    </span>
                `).join("")}
            </div>
        `;
    }

    if (!record && treatments.length === 0) {
        return `
            <tr class="${rowClass}" style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 0.65rem 0.85rem; font-weight: 700;">${docBadge}</td>
                <td style="padding: 0.65rem 0.85rem; color: #64748b; font-weight: 600;">${formattedDate}</td>
                <td style="padding: 0.65rem 0.85rem; color: #64748b;">—</td>
                <td style="padding: 0.65rem 0.85rem; color: #64748b;">—</td>
                <td style="padding: 0.65rem 0.85rem; color: #64748b;">—</td>
                <td style="padding: 0.65rem 0.85rem; color: #64748b;">—</td>
                <td style="padding: 0.65rem 0.85rem; color: #64748b;">—</td>
                <td style="padding: 0.65rem 0.85rem; color: #64748b;">—</td>
                <td style="padding: 0.65rem 0.85rem; color: #64748b;">—</td>
                <td style="padding: 0.65rem 0.85rem; color: #64748b; font-style: italic; font-size: 0.76rem;">No log recorded</td>
                <td style="padding: 0.65rem 0.85rem; text-align: center;">
                    <button type="button" class="btn-log-day btn-action btn-secondary" data-date="${dateStr}" style="font-size: 0.72rem; font-weight: 700; padding: 0.2rem 0.55rem;">
                        <span>+ Log</span>
                    </button>
                </td>
            </tr>
        `;
    }

    const feedText = (record && record.feed_kg !== null && record.feed_kg !== undefined) ? `${parseFloat(record.feed_kg).toFixed(1)} kg` : '0 kg';
    
    let remnantBadge = '—';
    if (record && record.feed_tray_remnant_pct !== null && record.feed_tray_remnant_pct !== undefined) {
        const pct = parseInt(record.feed_tray_remnant_pct, 10);
        let badgeBg = '#dcfce7';
        let badgeColor = '#15803d';
        if (pct > 20) {
            badgeBg = '#fee2e2';
            badgeColor = '#b91c1c';
        } else if (pct > 10) {
            badgeBg = '#fef3c7';
            badgeColor = '#b45309';
        }
        remnantBadge = `<span style="font-size: 0.72rem; font-weight: 700; background: ${badgeBg}; color: ${badgeColor}; padding: 0.15rem 0.45rem; border-radius: 4px;">${pct}%</span>`;
    }

    const waterLvl = (record && record.water_level_cm) ? `${record.water_level_cm} cm` : '—';
    
    let colourBadge = '—';
    if (record && record.water_colour) {
        const cMeta = getWaterColourMeta(record.water_colour);
        if (cMeta) {
            colourBadge = `<span style="display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.72rem; font-weight: 700; background: #f8fafc; color: #1e293b; padding: 0.18rem 0.5rem; border-radius: 6px; border: 1px solid #cbd5e1;"><span class="water-swatch-orb" style="width: 11px; height: 11px; background: ${cMeta.orbBg}; border-color: ${cMeta.orbBorder};"></span><span>${cMeta.label}</span></span>`;
        } else {
            colourBadge = `<span style="font-size: 0.72rem; font-weight: 600; background: #f1f5f9; color: #334155; padding: 0.15rem 0.45rem; border-radius: 4px; border: 1px solid #e2e8f0;">${record.water_colour}</span>`;
        }
    }

    const mortKg = (record && record.mortality_kg !== undefined && record.mortality_kg !== null)
        ? parseFloat(record.mortality_kg)
        : ((record && record.mortality_count) ? parseFloat(record.mortality_count) : 0);
    const mortBadge = mortKg > 0 
        ? `<span style="font-size: 0.72rem; font-weight: 800; background: #fee2e2; color: #b91c1c; padding: 0.15rem 0.45rem; border-radius: 4px;">${mortKg.toFixed(1)} kg</span>`
        : `<span style="color: #64748b;">0</span>`;

    const remarksText = (record && record.remarks) ? record.remarks : '—';

    return `
        <tr class="${rowClass}" style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 0.65rem 0.85rem; font-weight: 700;">${docBadge}</td>
            <td style="padding: 0.65rem 0.85rem; font-weight: 700; color: #0f172a;">${formattedDate}</td>
            <td style="padding: 0.65rem 0.85rem; font-weight: 800; color: #0369a1;">${feedText}</td>
            <td style="padding: 0.65rem 0.85rem;">${remnantBadge}</td>
            <td style="padding: 0.65rem 0.85rem; color: #475569; font-weight: 600;">${waterLvl}</td>
            <td style="padding: 0.65rem 0.85rem;">${colourBadge}</td>
            <td class="cell-wrap" style="padding: 0.65rem 0.85rem;">${mineralsBadges}</td>
            <td class="cell-wrap" style="padding: 0.65rem 0.85rem;">${probioticsBadges}</td>
            <td style="padding: 0.65rem 0.85rem;">${mortBadge}</td>
            <td style="padding: 0.65rem 0.85rem; color: #475569; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${remarksText}">
                ${remarksText}
            </td>
            <td style="padding: 0.65rem 0.85rem; text-align: center;">
                <button type="button" class="btn-edit-record btn-action btn-secondary" data-date="${dateStr}" style="font-size: 0.72rem; font-weight: 700; padding: 0.2rem 0.55rem;">
                    <span>✏️ Edit</span>
                </button>
            </td>
        </tr>
    `;
}

/**
 * Single mobile timeline card
 */
export function renderMobileCard(row) {
    const { dateStr, doc, isToday, record, treatments } = row;
    const formattedDate = formatLocalDateDisplay(dateStr);

    const docBadge = isToday
        ? `<span style="font-size: 0.76rem; font-weight: 900; background: #15803d; color: #ffffff; padding: 0.2rem 0.55rem; border-radius: 6px;">DOC ${doc || '—'} · TODAY</span>`
        : `<span style="font-size: 0.76rem; font-weight: 800; background: #e0f2fe; color: #0284c7; padding: 0.2rem 0.55rem; border-radius: 6px;">DOC ${doc || '—'}</span>`;

    let remnantBadge = '—';
    if (record && record.feed_tray_remnant_pct !== null && record.feed_tray_remnant_pct !== undefined) {
        const pct = parseInt(record.feed_tray_remnant_pct, 10);
        let badgeBg = '#dcfce7';
        let badgeColor = '#15803d';
        if (pct > 20) {
            badgeBg = '#fee2e2';
            badgeColor = '#b91c1c';
        } else if (pct > 10) {
            badgeBg = '#fef3c7';
            badgeColor = '#b45309';
        }
        remnantBadge = `<span style="font-size: 0.75rem; font-weight: 800; background: ${badgeBg}; color: ${badgeColor}; padding: 0.15rem 0.45rem; border-radius: 4px;">${pct}%</span>`;
    }

    const feedText = (record && record.feed_kg) ? `${parseFloat(record.feed_kg).toFixed(1)} kg` : '—';
    const waterLvl = (record && record.water_level_cm) ? `${record.water_level_cm} cm` : '—';
    const mortKg = (record && record.mortality_kg !== undefined && record.mortality_kg !== null)
        ? parseFloat(record.mortality_kg)
        : ((record && record.mortality_count) ? parseFloat(record.mortality_count) : 0);
    const remarksText = (record && record.remarks) ? record.remarks : '';

    return `
        <div class="daily-mobile-card" style="background: ${isToday ? '#f0fdf4' : '#ffffff'}; border: 1.5px solid ${isToday ? '#86efac' : '#e2e8f0'}; border-radius: 12px; padding: 0.85rem 1rem; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.65rem;">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    ${docBadge}
                    <strong style="font-size: 0.88rem; color: #0f172a;">${formattedDate}</strong>
                </div>
                ${record ? `
                    <button type="button" class="btn-edit-record btn-action btn-secondary" data-date="${dateStr}" style="font-size: 0.76rem; font-weight: 700; padding: 0.35rem 0.85rem; border-radius: 8px;">
                        <span>✏️ Edit</span>
                    </button>
                ` : `
                    <button type="button" class="btn-log-day btn-action btn-primary" data-date="${dateStr}" style="font-size: 0.76rem; font-weight: 800; padding: 0.35rem 0.95rem; border-radius: 8px;">
                        <span>➕ Log</span>
                    </button>
                `}
            </div>

            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.45rem; background: ${isToday ? '#ffffff' : '#f8fafc'}; padding: 0.55rem 0.75rem; border-radius: 8px; border: 1px solid #e2e8f0; text-align: center;">
                <div>
                    <span style="font-size: 0.68rem; color: #64748b; font-weight: 700; display: block;">Feed</span>
                    <strong style="font-size: 0.88rem; color: #0369a1;">${feedText}</strong>
                </div>
                <div>
                    <span style="font-size: 0.68rem; color: #64748b; font-weight: 700; display: block;">Tray Left</span>
                    <div style="margin-top: 0.15rem;">${remnantBadge}</div>
                </div>
                <div>
                    <span style="font-size: 0.68rem; color: #64748b; font-weight: 700; display: block;">Water Lvl</span>
                    <strong style="font-size: 0.88rem; color: #334155;">${waterLvl}</strong>
                </div>
            </div>

            ${(mortKg > 0 || remarksText || (treatments && treatments.length > 0)) ? `
                <div style="margin-top: 0.5rem; display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.75rem;">
                    ${mortKg > 0 ? `<div style="color: #b91c1c; font-weight: 700;">⚠️ Mortality: ${mortKg.toFixed(1)} kg</div>` : ''}
                    ${(treatments && treatments.length > 0) ? `
                        <div style="display: flex; gap: 0.35rem; flex-wrap: wrap;">
                            ${treatments.map(t => `<span style="background: #f1f5f9; padding: 0.1rem 0.4rem; border-radius: 4px; font-weight: 600; color: #334155;">${t.category === 'MINERAL' ? '🧪' : '🦠'} ${t.item_name} (${t.amount_used} ${t.unit})</span>`).join('')}
                        </div>
                    ` : ''}
                    ${remarksText ? `<div style="color: #64748b; font-style: italic;">“${remarksText}”</div>` : ''}
                </div>
            ` : ''}
        </div>
    `;
}
