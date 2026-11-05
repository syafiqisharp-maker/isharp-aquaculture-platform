/**
 * iSHARP DBMS 2.0 — Laboratory Email Table Parser
 * Automatically extracts 5-day Rainfall, Dates, MDC Canal Level, AM Water Temp,
 * and Salinity from text or HTML copied directly from the daily laboratory email.
 */

export function parseLabEmailTable(input) {
    if (!input || typeof input !== "string") return null;

    let text = input.trim();
    if (!text) return null;

    // Handle HTML table input if copied from Outlook/Webmail as HTML
    if (text.includes("<table") || text.includes("<tr") || text.includes("<td")) {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, "text/html");
            const rows = Array.from(doc.querySelectorAll("tr"));
            if (rows.length > 0) {
                text = rows.map(r => {
                    const cells = Array.from(r.querySelectorAll("th, td"));
                    return cells.map(c => c.textContent.trim()).join("\t");
                }).join("\n");
            }
        } catch (e) {
            console.warn("HTML table parsing fallback to text:", e);
        }
    }

    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return null;

    const result = {
        dates: [],
        rainfall: [],
        mdc: null,
        amTemp: null,
        salinity: null
    };

    // Helper: formats date string into "DD-MMM" (e.g. 31/10/2026 -> 31-Oct, 1/11/2026 -> 01-Nov)
    const formatHeaderDate = (dStr) => {
        if (!dStr) return null;
        const clean = dStr.trim();
        const m = clean.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?$/);
        if (m) {
            const day = parseInt(m[1], 10);
            const monthNum = parseInt(m[2], 10) - 1;
            const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            if (monthNum >= 0 && monthNum < 12) {
                const dayPadded = day < 10 ? `0${day}` : `${day}`;
                return `${dayPadded}-${months[monthNum]}`;
            }
        }
        return clean;
    };

    // Step 1: Detect Dates Row
    for (const line of lines) {
        const tokens = line.split(/\t|,|\s{2,}/).map(t => t.trim()).filter(Boolean);
        const dateTokens = tokens.filter(t => /^\d{1,2}[\/\-]\d{1,2}([\/\-]\d{2,4})?$/.test(t));
        if (dateTokens.length >= 3) {
            result.dates = dateTokens.slice(-5).map(formatHeaderDate);
            break;
        }
    }

    // Fallback date finder if dates are prefixed with day names or labels
    if (result.dates.length === 0) {
        for (const line of lines) {
            const matches = line.match(/\b\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?\b/g);
            if (matches && matches.length >= 3) {
                result.dates = matches.slice(-5).map(formatHeaderDate);
                break;
            }
        }
    }

    // Step 2: Parse Numerical Data Rows
    let rainfall830am = [];
    let rainfall400pm = [];

    for (const line of lines) {
        const lower = line.toLowerCase();
        const tokens = line.split(/\t|,|\s{2,}/).map(t => t.trim()).filter(Boolean);

        // Total Rainfall row
        if (lower.includes("total rainfall")) {
            const numTokens = tokens.filter(t => /^\d+(\.\d+)?$/.test(t));
            if (numTokens.length > 0) {
                result.rainfall = numTokens.slice(-5).map(v => `${parseFloat(v).toFixed(2)}mm`);
            }
        }

        // Sub-rows fallback: Rainfall (8.30 am)
        if (lower.includes("rainfall") && (lower.includes("8.30") || lower.includes("am")) && !lower.includes("total")) {
            const numTokens = tokens.filter(t => /^\d+(\.\d+)?$/.test(t));
            if (numTokens.length > 0) {
                rainfall830am = numTokens.slice(-5).map(parseFloat);
            }
        }

        // Sub-rows fallback: Rainfall (4.00 pm)
        if (lower.includes("rainfall") && (lower.includes("4.00") || lower.includes("pm")) && !lower.includes("total")) {
            const numTokens = tokens.filter(t => /^\d+(\.\d+)?$/.test(t));
            if (numTokens.length > 0) {
                rainfall400pm = numTokens.slice(-5).map(parseFloat);
            }
        }

        // MDC (Main Drainage Canal)
        if (lower.includes("mdc")) {
            const numTokens = tokens.filter(t => /^\d+(\.\d+)?$/.test(t));
            if (numTokens.length > 0) {
                const latestVal = numTokens[numTokens.length - 1];
                result.mdc = `${latestVal} cm (standard <80cm)`;
            }
        }

        // Daily Ponds Water Temp AM
        if (lower.includes("daily ponds (am)") || lower.includes("daily ponds am") || (lower.includes("am") && lower.includes("temp"))) {
            const numTokens = tokens.filter(t => /^\d+(\.\d+)?$/.test(t));
            if (numTokens.length > 0) {
                const latestVal = numTokens[numTokens.length - 1];
                result.amTemp = `${parseFloat(latestVal).toFixed(2)}°C`;
            }
        }

        // Salinity (Daily Ponds Salinity or Pond 01.01.11)
        if (lower.includes("salinity") || lower.includes("01.01.11")) {
            const numTokens = tokens.filter(t => /^\d+(\.\d+)?$/.test(t));
            if (numTokens.length > 0) {
                const latestVal = numTokens[numTokens.length - 1];
                result.salinity = `${parseFloat(latestVal).toFixed(0)} ppt`;
            }
        }
    }

    // If Total Rainfall row was not found, sum 8.30am + 4.00pm
    if (result.rainfall.length === 0 && rainfall830am.length > 0) {
        result.rainfall = rainfall830am.map((v, i) => {
            const pm = (rainfall400pm[i] !== undefined) ? rainfall400pm[i] : 0;
            return `${(v + pm).toFixed(2)}mm`;
        });
    }

    // Invert arrays so newest date & reading is on the leftmost column (index 0), followed by past dates
    if (result.dates.length > 0) {
        result.dates.reverse();
    }
    if (result.rainfall.length > 0) {
        result.rainfall.reverse();
    }

    const hasData = result.dates.length > 0 || result.rainfall.length > 0 || result.mdc || result.amTemp || result.salinity;
    return hasData ? result : null;
}

/**
 * Calculates the next calendar day string in "DD-MMM" format (e.g. 04-Nov -> 05-Nov, 31-Oct -> 01-Nov).
 */
export function getNextDayLabel(dateStr) {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthsLower = months.map(m => m.toLowerCase());

    if (dateStr && typeof dateStr === "string") {
        const trimmed = dateStr.trim();
        // Match "04-Nov" or "4-Nov" or "04-Nov-2026" or "04/Nov"
        const dMmmMatch = trimmed.match(/^(\d{1,2})[-/ ]([a-zA-Z]{3})(?:[-/ ]\d{2,4})?$/);
        if (dMmmMatch) {
            const day = parseInt(dMmmMatch[1], 10);
            const mIdx = monthsLower.indexOf(dMmmMatch[2].toLowerCase());
            if (mIdx !== -1) {
                const year = new Date().getFullYear();
                const d = new Date(year, mIdx, day);
                d.setDate(d.getDate() + 1);
                const nextDay = String(d.getDate()).padStart(2, "0");
                const nextMonth = months[d.getMonth()];
                return `${nextDay}-${nextMonth}`;
            }
        }

        // Match "04/11" or "04/11/2026" or "4/11/2026"
        const dNumMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})(?:[-/](\d{2,4}))?$/);
        if (dNumMatch) {
            const day = parseInt(dNumMatch[1], 10);
            const month = parseInt(dNumMatch[2], 10) - 1;
            const year = dNumMatch[3] ? parseInt(dNumMatch[3], 10) : new Date().getFullYear();
            const d = new Date(year, month, day);
            d.setDate(d.getDate() + 1);
            const nextDay = String(d.getDate()).padStart(2, "0");
            const nextMonth = months[d.getMonth()];
            return `${nextDay}-${nextMonth}`;
        }
    }

    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = months[now.getMonth()];
    return `${day}-${month}`;
}

