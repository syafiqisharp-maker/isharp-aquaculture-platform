/**
 * iSHARP DBMS 2.0 — CSV Exporter Utility
 * Generates RFC-4180 compliant CSV files with UTF-8 BOM for seamless Microsoft Excel compatibility.
 */

/**
 * Escapes a single CSV value according to RFC-4180 specifications.
 * Strings with commas, double quotes, or newlines are enclosed in double quotes.
 * Null and undefined values are rendered as empty strings.
 * @param {any} val 
 * @returns {string}
 */
export function escapeCsvCell(val) {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

/**
 * Converts headers and row arrays into a UTF-8 BOM CSV string.
 * @param {Array<string>} headers 
 * @param {Array<Array<any>>} rows 
 * @returns {string}
 */
export function buildCsvString(headers, rows) {
    const headerLine = headers.map(escapeCsvCell).join(",");
    const rowLines = rows.map(r => r.map(escapeCsvCell).join(","));
    return "\uFEFF" + [headerLine, ...rowLines].join("\r\n");
}

/**
 * Triggers a browser download for tabular data as a CSV file.
 * @param {string} filename 
 * @param {Array<string>} headers 
 * @param {Array<Array<any>>} rows 
 */
export function downloadCsv(filename, headers, rows) {
    const csvContent = buildCsvString(headers, rows);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
