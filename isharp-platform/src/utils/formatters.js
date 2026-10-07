/**
 * iSHARP DBMS 2.0 — Centralized Data & Display Formatters
 * Pure functions for timezone-safe date transformations, numeric formatting,
 * aquaculture weight metrics, and financial currency presentation.
 * 
 * Clean Coding Standard: Zero DOM manipulation, 100% pure & testable.
 */

/**
 * Returns YYYY-MM-DD in local time without UTC offset skew.
 * @param {Date|string} [d=new Date()]
 * @returns {string} e.g. "2026-10-06"
 */
export function getLocalDateStr(d = new Date()) {
    const dt = (d instanceof Date) ? d : new Date(d);
    if (isNaN(dt.getTime())) return "";
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const day = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

/**
 * Parses YYYY-MM-DD safely into a local Date object without timezone shifts.
 * @param {string|Date} str
 * @returns {Date}
 */
export function parseLocalDate(str) {
    if (!str) return new Date();
    if (str instanceof Date) return new Date(str.getFullYear(), str.getMonth(), str.getDate());
    const parts = String(str).split("T")[0].split("-").map(Number);
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
        return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    return new Date(str);
}

/**
 * Formats YYYY-MM-DD to "DD Mon" (e.g. "06 Oct") safely.
 * @param {string|Date} dateStr
 * @returns {string}
 */
export function formatLocalDateDisplay(dateStr) {
    if (!dateStr) return "—";
    const d = parseLocalDate(dateStr);
    return isNaN(d.getTime()) ? String(dateStr) : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

/**
 * Formats YYYY-MM-DD to "DD Mon YYYY" (e.g. "06 Oct 2026").
 * @param {string|Date} dateStr
 * @returns {string}
 */
export function formatDateFull(dateStr) {
    if (!dateStr) return "—";
    const d = parseLocalDate(dateStr);
    return isNaN(d.getTime()) ? String(dateStr) : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Formats a numeric value with commas and fixed decimals.
 * @param {number|string} val
 * @param {number} [decimals=0]
 * @param {string} [fallback="0"]
 * @returns {string} e.g. "1,234.5"
 */
export function formatNumber(val, decimals = 0, fallback = "0") {
    const num = parseFloat(val);
    if (isNaN(num)) return fallback;
    return num.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

/**
 * Formats weight in kilograms (kg) with comma separation.
 * @param {number|string} val
 * @param {number} [decimals=0]
 * @returns {string} e.g. "1,450 kg"
 */
export function formatKg(val, decimals = 0) {
    const num = parseFloat(val);
    if (isNaN(num) || num === 0) return "0 kg";
    return `${formatNumber(num, decimals)} kg`;
}

/**
 * Formats biomass in metric tons (Tons) with 1 decimal place.
 * @param {number|string} valKg Weight in kilograms
 * @param {number} [decimals=1]
 * @returns {string} e.g. "14.5 Tons"
 */
export function formatTons(valKg, decimals = 1) {
    const num = parseFloat(valKg);
    if (isNaN(num) || num === 0) return "0.0 Tons";
    const tons = num / 1000;
    return `${formatNumber(tons, decimals)} Tons`;
}

/**
 * Formats shrimp counts into integer pieces (pcs).
 * @param {number|string} val
 * @returns {string} e.g. "120,000 pcs"
 */
export function formatPieces(val) {
    const num = parseInt(val, 10);
    if (isNaN(num) || num <= 0) return "—";
    return `${num.toLocaleString("en-US")} pcs`;
}

/**
 * Formats a currency amount into MYR (Ringgit Malaysia).
 * @param {number|string} val
 * @param {number} [decimals=2]
 * @returns {string} e.g. "RM 14,250.00"
 */
export function formatCurrency(val, decimals = 2) {
    const num = parseFloat(val);
    if (isNaN(num)) return "RM 0.00";
    return `RM ${formatNumber(num, decimals)}`;
}

/**
 * Formats a percentage value.
 * @param {number|string} val 0-100 percentage
 * @param {number} [decimals=1]
 * @returns {string} e.g. "85.2%"
 */
export function formatPercent(val, decimals = 1) {
    const num = parseFloat(val);
    if (isNaN(num)) return "0%";
    return `${formatNumber(num, decimals)}%`;
}
