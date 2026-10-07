/**
 * iSHARP DBMS 2.0 & Field Operations — Water Quality Optimum Parameters & Thresholds
 * Single Source of Truth (SSOT) for all water chemistry and edge IoT telemetry limits.
 * Covers both marine shrimp culture standards and specific farm operational rules.
 */

export const WATER_QUALITY_THRESHOLDS = Object.freeze({
    // --- REAL-TIME EDGE IOT TELEMETRY ---
    DO: {
        OPTIMAL_MIN: 4.0,       // > 4.0 ppm is Optimal (Normal)
        CAUTION_LOW: 3.0,       // 3.0 to 4.0 ppm is Warning (Caution)
        CRITICAL_LOW: 3.0,      // < 3.0 ppm is Danger / Critical Hypoxia
        WEEKLY_DROP_ALERT: -0.40,
        unit: "mg/L",
        label: "DO",
        fullName: "Dissolved Oxygen",
        targetText: "> 4.0 mg/L"
    },
    PH: {
        OPTIMAL_MIN: 7.50,      // 7.50 to 8.30 is Optimal
        OPTIMAL_MAX: 8.30,
        CAUTION_LOW: 7.00,      // 7.00 - 7.49 is Warning
        CAUTION_HIGH: 8.70,     // 8.31 - 8.70 is Warning
        CRITICAL_LOW: 7.00,     // < 7.00 is Acid Stress Alert
        CRITICAL_HIGH: 8.70,    // > 8.70 is Alkaline Stress Alert
        unit: "pH",
        label: "pH",
        fullName: "Water pH Level",
        targetText: "7.5–8.3 pH"
    },
    PH_SWING: {
        MAX_SAFE_SWING: 1.0,    // <= 1.0 delta/day is Safe
        SEVERE_SWING: 1.5,      // >= 1.5 delta/day is Critical Danger
        WEEKLY_BLOOM_RISE: 0.30,
        WEEKLY_CRASH_DROP: -0.30,
        unit: "Δ pH/day",
        label: "pH Swing",
        fullName: "Diurnal pH Swing",
        targetText: "≤ 1.0 Δ/day"
    },
    WATER_TEMP: {
        OPTIMAL_MIN: 28.0,      // 28.0 - 32.0 °C is Optimal
        OPTIMAL_MAX: 32.0,
        CAUTION_LOW: 26.0,      // 26.0 - 27.9 °C is Warning
        CAUTION_HIGH: 33.0,     // 32.1 - 33.0 °C is Warning
        CRITICAL_LOW: 26.0,     // < 26.0 °C is Chill Alert
        CRITICAL_HIGH: 33.0,    // >= 33.0 °C is Thermal Stress Alert
        MAX_SAFE_SWING: 3.0,
        WEEKLY_COOLING: -1.2,
        WEEKLY_WARMING: 1.2,
        unit: "°C",
        label: "Temp",
        fullName: "Water Temperature",
        targetText: "28–32 °C"
    },

    // --- LABORATORY WATER CHEMISTRY (WET LAB / PERIODIC SAMPLING) ---
    SALINITY: {
        OPTIMAL_MIN: 15.0,      // 15.0 to 35.0 ppt is Optimal
        OPTIMAL_MAX: 35.0,
        CAUTION_LOW_MIN: 10.0,  // 10.0 to 14.9 ppt is Warning
        CAUTION_HIGH_MAX: 37.9, // 35.1 to 37.9 ppt is Warning
        CRITICAL_LOW: 10.0,     // < 10.0 ppt is Danger
        CRITICAL_HIGH: 38.0,    // >= 38.0 ppt is Danger
        unit: "ppt",
        label: "Sal",
        fullName: "Salinity",
        targetText: "15–35 ppt"
    },
    AMMONIA: {
        OPTIMAL_MAX: 1.0,       // < 1.0 mg/L is Optimal
        CAUTION_MAX: 2.0,       // 1.0 to 1.99 mg/L is Warning
        CRITICAL_MIN: 2.0,      // >= 2.0 mg/L is Danger
        unit: "mg/L",
        label: "NH₃",
        fullName: "Total Ammonia Nitrogen",
        targetText: "< 1.0 mg/L"
    },
    NITRITE: {
        OPTIMAL_MAX: 0.50,      // <= 0.50 mg/L is Optimal
        CAUTION_MAX: 1.00,      // 0.51 to 1.00 mg/L is Warning
        CRITICAL_MIN: 1.00,     // > 1.00 mg/L is Danger
        unit: "mg/L",
        label: "NO₂⁻",
        fullName: "Nitrite",
        targetText: "≤ 0.5 mg/L"
    },
    ALKALINITY: {
        OPTIMAL_MIN: 100.0,     // 100 to 160 mg/L is Optimal
        OPTIMAL_MAX: 160.0,
        CAUTION_LOW: 80.0,      // 80 to 99 mg/L is Warning
        CAUTION_HIGH: 180.0,    // 161 to 180 mg/L is Warning
        CRITICAL_LOW: 80.0,     // < 80 mg/L is Danger (unbuffered crash risk)
        CRITICAL_HIGH: 180.0,   // > 180 mg/L is Danger
        unit: "mg/L",
        label: "Alk",
        fullName: "Total Alkalinity",
        targetText: "100–160 mg/L"
    },
    CALCIUM: {
        OPTIMAL_MIN: 200.0,     // >= 200 mg/L is Optimal
        CAUTION_LOW: 150.0,     // 150 to 199 mg/L is Warning
        CRITICAL_LOW: 150.0,    // < 150 mg/L is Danger (molting soft shell)
        unit: "mg/L",
        label: "Ca",
        fullName: "Calcium",
        targetText: "> 200 mg/L"
    },
    MAGNESIUM: {
        OPTIMAL_MIN: 600.0,     // >= 600 mg/L is Optimal
        CAUTION_LOW: 450.0,     // 450 to 599 mg/L is Warning
        CRITICAL_LOW: 450.0,    // < 450 mg/L is Danger
        unit: "mg/L",
        label: "Mg",
        fullName: "Magnesium",
        targetText: "> 600 mg/L"
    },
    CAMG_RATIO: {
        OPTIMAL_MIN: 2.5,       // 1 : 2.5 to 3.5 is Optimal
        OPTIMAL_MAX: 3.5,
        CAUTION_LOW: 2.0,       // 1 : 2.0 to 2.49 is Warning
        CAUTION_HIGH: 4.0,      // 1 : 3.51 to 4.0 is Warning
        CRITICAL_LOW: 2.0,      // < 1 : 2.0 is Danger
        CRITICAL_HIGH: 4.0,     // > 1 : 4.0 is Danger
        unit: "ratio",
        label: "Ca:Mg",
        fullName: "Calcium to Magnesium Ratio",
        targetText: "1 : 2.5–3.5"
    },
    TURBIDITY: {
        OPTIMAL_MAX: 30.0,      // <= 30 NTU is Optimal
        CAUTION_MAX: 45.0,      // 30.1 to 45.0 NTU is Warning
        CRITICAL_MIN: 45.0,     // > 45.0 NTU is Danger (bloom die-off / silt)
        unit: "NTU",
        label: "Turb",
        fullName: "Turbidity",
        targetText: "< 30 NTU"
    },

    // --- METEOROLOGICAL STATION THRESHOLDS ---
    LUX: {
        OVERCAST: 20000
    },
    RAINFALL: {
        CRITICAL_DAILY: 40.0,
        CAUTION_DAILY: 20.0,
        CRITICAL_7DAY: 120.0,
        CAUTION_7DAY: 100.0
    }
});

/**
 * Evaluates any water quality parameter value against the Single Source of Truth.
 * @param {string} paramKey - Key such as 'do', 'ph', 'salinity', 'ammonia', 'nitrite', 'alkalinity', 'calcium', 'magnesium', 'turbidity', 'water_temp', 'ph_swing'
 * @param {number|string|null} rawValue - Parameter numeric value
 * @returns {{ status: 'optimal' | 'warning' | 'alert' | 'unknown', message: string, label: string, unit: string, targetText: string }}
 */
export function evaluateParameterStatus(paramKey, rawValue) {
    if (rawValue === null || rawValue === undefined || rawValue === "" || rawValue === "--" || rawValue === "—") {
        return { status: "unknown", message: "No reading", label: paramKey, unit: "", targetText: "" };
    }

    const val = parseFloat(rawValue);
    if (isNaN(val)) {
        return { status: "unknown", message: "Invalid reading", label: paramKey, unit: "", targetText: "" };
    }

    const key = String(paramKey).toLowerCase();

    // 1. Dissolved Oxygen (DO)
    if (key === "do" || key === "do_ppm") {
        const cfg = WATER_QUALITY_THRESHOLDS.DO;
        if (val < cfg.CRITICAL_LOW) {
            return { status: "alert", message: `Hypoxia alert (${val.toFixed(1)} < ${cfg.CRITICAL_LOW} ${cfg.unit})`, label: cfg.label, unit: cfg.unit, targetText: cfg.targetText };
        }
        if (val <= cfg.OPTIMAL_MIN) {
            return { status: "warning", message: `Borderline DO (${val.toFixed(1)} ${cfg.unit})`, label: cfg.label, unit: cfg.unit, targetText: cfg.targetText };
        }
        return { status: "optimal", message: `Optimal DO (${val.toFixed(1)} ${cfg.unit})`, label: cfg.label, unit: cfg.unit, targetText: cfg.targetText };
    }

    // 2. Water pH
    if (key === "ph") {
        const cfg = WATER_QUALITY_THRESHOLDS.PH;
        if (val < cfg.CRITICAL_LOW) {
            return { status: "alert", message: `Acid stress (${val.toFixed(2)} < ${cfg.CRITICAL_LOW})`, label: cfg.label, unit: cfg.unit, targetText: cfg.targetText };
        }
        if (val > cfg.CRITICAL_HIGH) {
            return { status: "alert", message: `Alkaline stress (${val.toFixed(2)} > ${cfg.CRITICAL_HIGH})`, label: cfg.label, unit: cfg.unit, targetText: cfg.targetText };
        }
        if (val < cfg.OPTIMAL_MIN || val > cfg.OPTIMAL_MAX) {
            return { status: "warning", message: `Sub-optimal pH (${val.toFixed(2)})`, label: cfg.label, unit: cfg.unit, targetText: cfg.targetText };
        }
        return { status: "optimal", message: `Optimal pH (${val.toFixed(2)})`, label: cfg.label, unit: cfg.unit, targetText: cfg.targetText };
    }

    // 3. pH Diurnal Swing
    if (key === "ph_swing" || key === "phdelta") {
        const cfg = WATER_QUALITY_THRESHOLDS.PH_SWING;
        if (val >= cfg.SEVERE_SWING) {
            return { status: "alert", message: `Severe pH swing (Δ ${val.toFixed(2)} ≥ ${cfg.SEVERE_SWING})`, label: cfg.label, unit: cfg.unit, targetText: cfg.targetText };
        }
        if (val > cfg.MAX_SAFE_SWING) {
            return { status: "warning", message: `High pH swing (Δ ${val.toFixed(2)} > ${cfg.MAX_SAFE_SWING})`, label: cfg.label, unit: cfg.unit, targetText: cfg.targetText };
        }
        return { status: "optimal", message: `Safe pH swing (Δ ${val.toFixed(2)})`, label: cfg.label, unit: cfg.unit, targetText: cfg.targetText };
    }

    // 4. Salinity
    if (key === "salinity" || key === "salinity_ppt" || key === "sal") {
        const cfg = WATER_QUALITY_THRESHOLDS.SALINITY;
        if (val < cfg.CRITICAL_LOW) {
            return { status: "alert", message: `Critical low salinity (${val.toFixed(1)} < ${cfg.CRITICAL_LOW} ${cfg.unit})`, label: cfg.label, unit: cfg.unit, targetText: cfg.targetText };
        }
        if (val >= cfg.CRITICAL_HIGH) {
            return { status: "alert", message: `Critical high salinity (${val.toFixed(1)} ≥ ${cfg.CRITICAL_HIGH} ${cfg.unit})`, label: cfg.label, unit: cfg.unit, targetText: cfg.targetText };
        }
        if (val < cfg.OPTIMAL_MIN || val > cfg.OPTIMAL_MAX) {
            return { status: "warning", message: `Borderline salinity (${val.toFixed(1)} ${cfg.unit})`, label: cfg.label, unit: cfg.unit, targetText: cfg.targetText };
        }
        return { status: "optimal", message: `Optimal salinity (${val.toFixed(1)} ${cfg.unit})`, label: cfg.label, unit: cfg.unit, targetText: cfg.targetText };
    }

    // 5. Ammonia (NH3)
    if (key === "ammonia" || key === "nh3") {
        const cfg = WATER_QUALITY_THRESHOLDS.AMMONIA;
        if (val >= cfg.CRITICAL_MIN) {
            return { status: "alert", message: `Toxic Ammonia (${val.toFixed(2)} ≥ ${cfg.CRITICAL_MIN} ${cfg.unit})`, label: cfg.label, unit: cfg.unit, targetText: cfg.targetText };
        }
        if (val >= cfg.OPTIMAL_MAX) {
            return { status: "warning", message: `Elevated Ammonia (${val.toFixed(2)} ${cfg.unit})`, label: cfg.label, unit: cfg.unit, targetText: cfg.targetText };
        }
        return { status: "optimal", message: `Optimal Ammonia (${val.toFixed(2)} ${cfg.unit})`, label: cfg.label, unit: cfg.unit, targetText: cfg.targetText };
    }

    // 6. Nitrite (NO2-)
    if (key === "nitrite" || key === "no2") {
        const cfg = WATER_QUALITY_THRESHOLDS.NITRITE;
        if (val > cfg.CRITICAL_MIN) {
            return { status: "alert", message: `High Nitrite (${val.toFixed(2)} > ${cfg.CRITICAL_MIN} ${cfg.unit})`, label: cfg.label, unit: cfg.unit, targetText: cfg.targetText };
        }
        if (val > cfg.OPTIMAL_MAX) {
            return { status: "warning", message: `Elevated Nitrite (${val.toFixed(2)} ${cfg.unit})`, label: cfg.label, unit: cfg.unit, targetText: cfg.targetText };
        }
        return { status: "optimal", message: `Safe Nitrite (${val.toFixed(2)} ${cfg.unit})`, label: cfg.label, unit: cfg.unit, targetText: cfg.targetText };
    }

    // 7. Alkalinity
    if (key === "alkalinity" || key === "alk") {
        const cfg = WATER_QUALITY_THRESHOLDS.ALKALINITY;
        if (val < cfg.CRITICAL_LOW) {
            return { status: "alert", message: `Severely low alkalinity (${Math.round(val)} < ${cfg.CRITICAL_LOW} ${cfg.unit})`, label: cfg.label, unit: cfg.unit, targetText: cfg.targetText };
        }
        if (val > cfg.CRITICAL_HIGH) {
            return { status: "alert", message: `Excessive alkalinity (${Math.round(val)} > ${cfg.CRITICAL_HIGH} ${cfg.unit})`, label: cfg.label, unit: cfg.unit, targetText: cfg.targetText };
        }
        if (val < cfg.OPTIMAL_MIN || val > cfg.OPTIMAL_MAX) {
            return { status: "warning", message: `Sub-optimal alkalinity (${Math.round(val)} ${cfg.unit})`, label: cfg.label, unit: cfg.unit, targetText: cfg.targetText };
        }
        return { status: "optimal", message: `Optimal alkalinity (${Math.round(val)} ${cfg.unit})`, label: cfg.label, unit: cfg.unit, targetText: cfg.targetText };
    }

    // 8. Calcium
    if (key === "calcium" || key === "ca") {
        const cfg = WATER_QUALITY_THRESHOLDS.CALCIUM;
        if (val < cfg.CRITICAL_LOW) {
            return { status: "alert", message: `Low Calcium (${Math.round(val)} < ${cfg.CRITICAL_LOW} ${cfg.unit})`, label: cfg.label, unit: cfg.unit, targetText: cfg.targetText };
        }
        if (val < cfg.OPTIMAL_MIN) {
            return { status: "warning", message: `Borderline Calcium (${Math.round(val)} ${cfg.unit})`, label: cfg.label, unit: cfg.unit, targetText: cfg.targetText };
        }
        return { status: "optimal", message: `Optimal Calcium (${Math.round(val)} ${cfg.unit})`, label: cfg.label, unit: cfg.unit, targetText: cfg.targetText };
    }

    // 9. Magnesium
    if (key === "magnesium" || key === "mg") {
        const cfg = WATER_QUALITY_THRESHOLDS.MAGNESIUM;
        if (val < cfg.CRITICAL_LOW) {
            return { status: "alert", message: `Low Magnesium (${Math.round(val)} < ${cfg.CRITICAL_LOW} ${cfg.unit})`, label: cfg.label, unit: cfg.unit, targetText: cfg.targetText };
        }
        if (val < cfg.OPTIMAL_MIN) {
            return { status: "warning", message: `Borderline Magnesium (${Math.round(val)} ${cfg.unit})`, label: cfg.label, unit: cfg.unit, targetText: cfg.targetText };
        }
        return { status: "optimal", message: `Optimal Magnesium (${Math.round(val)} ${cfg.unit})`, label: cfg.label, unit: cfg.unit, targetText: cfg.targetText };
    }

    // 10. Turbidity
    if (key === "turbidity" || key === "turb") {
        const cfg = WATER_QUALITY_THRESHOLDS.TURBIDITY;
        if (val > cfg.CRITICAL_MIN) {
            return { status: "alert", message: `Excessive Turbidity (${val.toFixed(1)} > ${cfg.CRITICAL_MIN} ${cfg.unit})`, label: cfg.label, unit: cfg.unit, targetText: cfg.targetText };
        }
        if (val > cfg.OPTIMAL_MAX) {
            return { status: "warning", message: `Elevated Turbidity (${val.toFixed(1)} ${cfg.unit})`, label: cfg.label, unit: cfg.unit, targetText: cfg.targetText };
        }
        return { status: "optimal", message: `Optimal Turbidity (${val.toFixed(1)} ${cfg.unit})`, label: cfg.label, unit: cfg.unit, targetText: cfg.targetText };
    }

    // 11. Water Temperature
    if (key === "water_temp" || key === "temp" || key === "water_temp_c") {
        const cfg = WATER_QUALITY_THRESHOLDS.WATER_TEMP;
        if (val >= cfg.CRITICAL_HIGH) {
            return { status: "alert", message: `Thermal stress (${val.toFixed(1)} ≥ ${cfg.CRITICAL_HIGH} ${cfg.unit})`, label: cfg.label, unit: cfg.unit, targetText: cfg.targetText };
        }
        if (val < cfg.CRITICAL_LOW) {
            return { status: "alert", message: `Cold water stress (${val.toFixed(1)} < ${cfg.CRITICAL_LOW} ${cfg.unit})`, label: cfg.label, unit: cfg.unit, targetText: cfg.targetText };
        }
        if (val < cfg.OPTIMAL_MIN || val > cfg.OPTIMAL_MAX) {
            return { status: "warning", message: `Sub-optimal temperature (${val.toFixed(1)} ${cfg.unit})`, label: cfg.label, unit: cfg.unit, targetText: cfg.targetText };
        }
        return { status: "optimal", message: `Optimal temperature (${val.toFixed(1)} ${cfg.unit})`, label: cfg.label, unit: cfg.unit, targetText: cfg.targetText };
    }

    return { status: "unknown", message: "Unrecognized parameter", label: paramKey, unit: "", targetText: "" };
}

/**
 * Returns CSS state class for telemetry pills ('telemetry-optimal', 'telemetry-warning', 'telemetry-alert', or '').
 * @param {string} paramKey 
 * @param {number|null} value 
 * @returns {string}
 */
export function getTelemetryHealthState(paramKey, value) {
    if (value === null || value === undefined || isNaN(parseFloat(value))) return "";
    const evaluation = evaluateParameterStatus(paramKey, value);
    if (evaluation.status === "optimal") return "telemetry-optimal";
    if (evaluation.status === "warning") return "telemetry-warning";
    if (evaluation.status === "alert") return "telemetry-alert";
    return "";
}

/**
 * Evaluates water chemistry record and extracts parameters that are currently OUT of optimal range.
 * If all parameters are optimal or no data exists, returns empty array [].
 * @param {object|null} labRecord - Record from lab_water_quality
 * @returns {Array<{ parameter: string, value: string, severity: 'warning' | 'alert', message: string }>}
 */
export function evaluateAbnormalWqParameters(labRecord) {
    if (!labRecord || typeof labRecord !== "object") return [];

    const anomalies = [];

    const check = (key, rawVal, formatVal) => {
        if (rawVal === null || rawVal === undefined) return;
        const ev = evaluateParameterStatus(key, rawVal);
        if (ev.status === "warning" || ev.status === "alert") {
            anomalies.push({
                parameter: ev.label,
                value: formatVal(rawVal),
                severity: ev.status,
                message: ev.message
            });
        }
    };

    check("alkalinity", labRecord.alkalinity, v => `${Math.round(v)}`);
    check("ammonia", labRecord.ammonia, v => parseFloat(v).toFixed(2));
    check("nitrite", labRecord.nitrite, v => parseFloat(v).toFixed(2));
    check("salinity", labRecord.salinity_ppt, v => parseFloat(v).toFixed(1));
    check("calcium", labRecord.calcium, v => `${Math.round(v)}`);
    check("magnesium", labRecord.magnesium, v => `${Math.round(v)}`);
    check("turbidity", labRecord.turbidity, v => parseFloat(v).toFixed(1));

    return anomalies;
}

/**
 * Formats standard display target string for a parameter from the Single Source of Truth.
 * @param {string} paramKey 
 * @returns {string}
 */
export function formatParameterTarget(paramKey) {
    const key = String(paramKey).toUpperCase();
    if (WATER_QUALITY_THRESHOLDS[key]?.targetText) {
        return WATER_QUALITY_THRESHOLDS[key].targetText;
    }
    const mapping = {
        DO_PPM: WATER_QUALITY_THRESHOLDS.DO.targetText,
        SAL: WATER_QUALITY_THRESHOLDS.SALINITY.targetText,
        SALINITY_PPT: WATER_QUALITY_THRESHOLDS.SALINITY.targetText,
        NH3: WATER_QUALITY_THRESHOLDS.AMMONIA.targetText,
        NO2: WATER_QUALITY_THRESHOLDS.NITRITE.targetText,
        ALK: WATER_QUALITY_THRESHOLDS.ALKALINITY.targetText,
        CA: WATER_QUALITY_THRESHOLDS.CALCIUM.targetText,
        MG: WATER_QUALITY_THRESHOLDS.MAGNESIUM.targetText,
        TURB: WATER_QUALITY_THRESHOLDS.TURBIDITY.targetText,
        WATER_TEMP_C: WATER_QUALITY_THRESHOLDS.WATER_TEMP.targetText
    };
    return mapping[key] || "—";
}
