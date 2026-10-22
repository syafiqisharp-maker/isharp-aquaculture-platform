/**
 * iSHARP QA/QC Inspection Module — WhatsApp Formatter & Domain Helpers
 * Pure domain logic (zero DOM dependencies, 100% testable in isolation).
 */

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Formats a Date object or YYYY-MM-DD string into 'DD/MM/YYYY (Day)'
 * e.g. '2026-10-20' -> '20/10/2026 (Tue)'
 * @param {string|Date} dateVal 
 * @returns {string}
 */
export function formatDateWithDay(dateVal) {
    if (!dateVal) return "";
    let d;
    if (typeof dateVal === "string") {
        const parts = dateVal.split("-");
        if (parts.length === 3) {
            d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        } else {
            d = new Date(dateVal);
        }
    } else {
        d = dateVal;
    }

    if (isNaN(d.getTime())) return "";

    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    const dayName = DAY_NAMES[d.getDay()];

    return `${day}/${month}/${year} (${dayName})`;
}

/**
 * Formats a pond identifier into the raw 6-digit code used in WhatsApp
 * e.g. '01.01.07' -> '010107', '09.18.03' -> '091803'
 * @param {string} pondStr 
 * @returns {string}
 */
export function formatRawPondCode(pondStr) {
    if (!pondStr) return "";
    const digits = pondStr.replace(/\D/g, "");
    if (digits.length === 6) return digits;
    return pondStr.trim();
}

/**
 * Builds a 3-level hierarchical tree of non-production candidate ponds
 * Structure: { [modl]: { [row_no]: [ { pond, pond_index, status, cycle_no, ... } ] } }
 * @param {Array<Object>} cycles 
 * @returns {Object}
 */
export function buildHierarchicalPondTree(cycles = []) {
    const nonProduction = cycles.filter(c => {
        const status = (c.pond_status || "").toUpperCase();
        return status !== "PRODUCTION";
    });

    const tree = {};

    nonProduction.forEach(cycle => {
        const modl = String(cycle.modl || "").padStart(2, "0");
        const rowNo = String(cycle.row_no || "").padStart(2, "0");
        if (!modl || !rowNo) return;

        if (!tree[modl]) tree[modl] = {};
        if (!tree[modl][rowNo]) tree[modl][rowNo] = [];

        tree[modl][rowNo].push({
            pond: cycle.pond,
            pond_index: cycle.pond_index,
            pond_status: cycle.pond_status || "IDLE",
            cycle_no: cycle.cycle_no || null,
            crop_no: cycle.crop_no || null,
            area: cycle.area || 0.5,
            idle_days: cycle.idle_days || 0
        });
    });

    // Sort ponds by pond string in each row
    Object.keys(tree).forEach(m => {
        Object.keys(tree[m]).forEach(r => {
            tree[m][r].sort((a, b) => a.pond.localeCompare(b.pond));
        });
    });

    return tree;
}

/**
 * Generates the standardized WhatsApp broadcast message for Pond Cleaning
 * Matches the official farm QA/QC broadcast format.
 * 
 * @param {Object} params
 * @param {string|Date} params.date - Date of inspection
 * @param {string} params.requestor - Inspector / requestor name (e.g. 'Rosdi')
 * @param {string} params.team - Cleaning team (e.g. 'Int2', 'PO 1')
 * @param {string} [params.location] - Location (e.g. 'Module 01')
 * @param {string} params.pond - Pond string (e.g. '01.01.07' or '010107')
 * @param {string} params.status - 'PASSED' or 'FAILED'
 * @param {Object} [params.checklist] - { lining: bool, sump: bool, pwa_autofeeder: bool, jetty: bool }
 * @param {string} [params.remarks] - Defect remarks if failed or notes
 * @returns {string}
 */
export function generateCleaningWhatsAppText({
    date,
    requestor,
    team,
    location = "",
    pond,
    status = "PASSED",
    checklist = { lining: true, sump: true, pwa_autofeeder: true, jetty: true },
    remarks = ""
}) {
    const formattedDate = formatDateWithDay(date);
    const rawPond = formatRawPondCode(pond);
    const isPassed = status === "PASSED";
    const statusSymbol = isPassed ? "Passed ✅" : "Failed ❌";

    const chkLining = checklist.lining ? "✅" : "❌";
    const chkSump = checklist.sump ? "✅" : "❌";
    const chkPwa = checklist.pwa_autofeeder ? "✅" : "❌";
    const chkJetty = checklist.jetty ? "✅" : "❌";

    let message = `*Pond cleaning Inspection*\n\n`;
    message += `Date: ${formattedDate}\n`;
    message += `Requestor: ${requestor || "-"}\n`;
    message += `Team: ${team || "-"}\n`;
    message += `Location: ${location || ""}\n\n`;

    message += `▶️ ${rawPond} - ${statusSymbol}\n`;
    message += `* Lining ${chkLining}\n`;
    message += `* Sump ${chkSump}\n`;
    message += `* PWA & autofeeder ${chkPwa}\n`;
    message += `* Jetty ${chkJetty}\n`;

    if (!isPassed && remarks && remarks.trim()) {
        message += `\n*Defect / Rework Note:*\n${remarks.trim()}\n`;
    }

    message += `\nPlease proceed repair if required prior to disinfection after minimum of 3 days sundrying.\n`;
    message += `For failed inspection continue cleaning especially for failed item(s) & request for re-inspection. Escalate any related issue for problematic pond.\n\n`;

    message += `Cleaning standard;\n`;
    message += `* Lining - brushed off sludge, algae, dead shrimp/fish/snail/barnacle (bottom, connector and side/bund lining)\n`;
    message += `* Sump - clear from collected sludge, algae, dead shrimp/fish/snail, other rubbish not\n`;
    message += `* PWA & autofeeder - brushed off algae/barnacle on floater & propeller, dead shrimp under\n`;
    message += `* Jetty - brushed off algae, dead shrimp/fish/snail/barnacle`;

    return message;
}
