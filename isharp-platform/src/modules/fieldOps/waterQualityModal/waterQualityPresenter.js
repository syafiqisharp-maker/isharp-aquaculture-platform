/**
 * iSHARP DBMS 2.0 & Field Operations — Water Quality Table Presenter
 * Pure view-model transformation and RFC-4180 CSV export data builder.
 * Follows SSOT water quality limits and formatting contracts.
 */

import { getWaterQualityColorClass } from "../../../domain/waterQualityLimit.js";

/**
 * Transforms raw database lab_water_quality records into formatted UI table row objects.
 * @param {Array<object>} records Raw database records
 * @returns {Array<object>} Formatted view-models
 */
export function presentWaterQualityRecords(records) {
    if (!Array.isArray(records)) return [];

    return records.map(r => {
        const salClass = getWaterQualityColorClass("salinity", r.salinity_ppt);
        const alkClass = getWaterQualityColorClass("alkalinity", r.alkalinity);
        const nh3Class = getWaterQualityColorClass("ammonia", r.ammonia);
        const no2Class = getWaterQualityColorClass("nitrite", r.nitrite);
        const caClass = getWaterQualityColorClass("calcium", r.calcium);
        const mgClass = getWaterQualityColorClass("magnesium", r.magnesium);

        const rowRatioMultiplier = (r.calcium && r.magnesium && r.calcium > 0)
            ? (r.magnesium / r.calcium)
            : null;
        const ratioText = rowRatioMultiplier !== null
            ? `1 : ${rowRatioMultiplier.toFixed(1)}`
            : "—";
        const ratioClass = getWaterQualityColorClass("camg_ratio", rowRatioMultiplier);
        const turbClass = getWaterQualityColorClass("turbidity", r.turbidity);

        return {
            logDate: r.log_date || "—",
            doc: r.doc !== null && r.doc !== undefined ? r.doc : "—",
            salinity: r.salinity_ppt !== null && r.salinity_ppt !== undefined ? r.salinity_ppt : "—",
            salClass,
            alkalinity: r.alkalinity !== null && r.alkalinity !== undefined ? r.alkalinity : "—",
            alkClass,
            ammonia: r.ammonia !== null && r.ammonia !== undefined ? r.ammonia : "—",
            nh3Class,
            nitrite: r.nitrite !== null && r.nitrite !== undefined ? r.nitrite : "—",
            no2Class,
            calcium: r.calcium !== null && r.calcium !== undefined ? Math.round(r.calcium) : "—",
            caClass,
            magnesium: r.magnesium !== null && r.magnesium !== undefined ? Math.round(r.magnesium) : "—",
            mgClass,
            ratioText,
            ratioClass,
            turbidity: r.turbidity !== null && r.turbidity !== undefined ? r.turbidity : "—",
            turbClass
        };
    });
}

/**
 * Builds RFC-4180 CSV export headers and data rows.
 * @param {string} pondLabel 
 * @param {Array<object>} records Raw database records
 * @returns {{ filename: string, headers: Array<string>, rows: Array<Array<any>> }}
 */
export function buildWaterQualityCsvData(pondLabel, records) {
    const safeLabel = (pondLabel || "Pond").replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `Pond_${safeLabel}_Water_Quality_History.csv`;

    const headers = [
        "Date",
        "DOC",
        "Salinity (ppt)",
        "Alkalinity (mg/L)",
        "Ammonia (mg/L)",
        "Nitrite (mg/L)",
        "Calcium (mg/L)",
        "Magnesium (mg/L)",
        "Ca : Mg Ratio",
        "Turbidity (NTU)"
    ];

    const rows = (records || []).map(r => {
        const ratioMultiplier = (r.calcium && r.magnesium && r.calcium > 0)
            ? (r.magnesium / r.calcium)
            : null;
        const ratioText = ratioMultiplier !== null
            ? `1 : ${ratioMultiplier.toFixed(1)}`
            : "";

        return [
            r.log_date || "",
            r.doc !== null && r.doc !== undefined ? r.doc : "",
            r.salinity_ppt !== null && r.salinity_ppt !== undefined ? r.salinity_ppt : "",
            r.alkalinity !== null && r.alkalinity !== undefined ? r.alkalinity : "",
            r.ammonia !== null && r.ammonia !== undefined ? r.ammonia : "",
            r.nitrite !== null && r.nitrite !== undefined ? r.nitrite : "",
            r.calcium !== null && r.calcium !== undefined ? Math.round(r.calcium) : "",
            r.magnesium !== null && r.magnesium !== undefined ? Math.round(r.magnesium) : "",
            ratioText,
            r.turbidity !== null && r.turbidity !== undefined ? r.turbidity : ""
        ];
    });

    return { filename, headers, rows };
}
