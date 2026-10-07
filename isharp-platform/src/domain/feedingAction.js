/**
 * iSHARP DBMS 2.0 — Feeding Action Plan Domain Rules
 * Ported from WQS DashBoard Module1 (Single Source of Truth)
 * Evaluates real-time water quality and weather metrics to dictate feeding directives.
 */

import {
    WATER_QUALITY_THRESHOLDS,
    evaluateAbnormalWqParameters as evaluateAbnormalWqParamsSSOT,
    evaluateParameterStatus
} from "./waterQualityLimit.js";

// Re-export for backwards compatibility across existing callers
export { WATER_QUALITY_THRESHOLDS };
export const evaluateAbnormalWqParameters = evaluateAbnormalWqParamsSSOT;

export const FEEDING_THRESHOLDS = Object.freeze({
    DO: {
        CRITICAL_LOW: WATER_QUALITY_THRESHOLDS.DO.CRITICAL_LOW,   // 3.0 ppm (Danger)
        CAUTION_LOW: WATER_QUALITY_THRESHOLDS.DO.OPTIMAL_MIN,     // 4.0 ppm (Warning <= 4.0)
        OPTIMAL_MIN: WATER_QUALITY_THRESHOLDS.DO.OPTIMAL_MIN,     // > 4.0 ppm is Optimal
        WEEKLY_DROP_ALERT: WATER_QUALITY_THRESHOLDS.DO.WEEKLY_DROP_ALERT
    },
    PH: {
        MAX_SAFE_SWING: WATER_QUALITY_THRESHOLDS.PH_SWING.MAX_SAFE_SWING, // 1.0 Δ pH/day
        SEVERE_SWING: WATER_QUALITY_THRESHOLDS.PH_SWING.SEVERE_SWING,     // 1.5 Δ pH/day
        WEEKLY_BLOOM_RISE: WATER_QUALITY_THRESHOLDS.PH_SWING.WEEKLY_BLOOM_RISE,
        WEEKLY_CRASH_DROP: WATER_QUALITY_THRESHOLDS.PH_SWING.WEEKLY_CRASH_DROP
    },
    WATER_TEMP: {
        STRESS_HIGH: WATER_QUALITY_THRESHOLDS.WATER_TEMP.CRITICAL_HIGH,   // 33.0 °C
        STRESS_LOW: WATER_QUALITY_THRESHOLDS.WATER_TEMP.CRITICAL_LOW,     // 26.0 °C
        MAX_SAFE_SWING: WATER_QUALITY_THRESHOLDS.WATER_TEMP.MAX_SAFE_SWING,
        WEEKLY_COOLING: WATER_QUALITY_THRESHOLDS.WATER_TEMP.WEEKLY_COOLING,
        WEEKLY_WARMING: WATER_QUALITY_THRESHOLDS.WATER_TEMP.WEEKLY_WARMING
    },
    LUX: {
        OVERCAST: WATER_QUALITY_THRESHOLDS.LUX.OVERCAST
    },
    RAINFALL: {
        CRITICAL_DAILY: WATER_QUALITY_THRESHOLDS.RAINFALL.CRITICAL_DAILY,
        CAUTION_DAILY: WATER_QUALITY_THRESHOLDS.RAINFALL.CAUTION_DAILY,
        CRITICAL_7DAY: WATER_QUALITY_THRESHOLDS.RAINFALL.CRITICAL_7DAY,
        CAUTION_7DAY: WATER_QUALITY_THRESHOLDS.RAINFALL.CAUTION_7DAY
    }
});

/**
 * Evaluates feeding recommendation & compiles "Why?" reason diagnostics
 * @param {object} params
 * @param {number} [params.doMin]
 * @param {number} [params.doCurrent]
 * @param {number} [params.phDelta]
 * @param {number} [params.tempMax]
 * @param {number} [params.tempDelta]
 * @param {number} [params.rainToday]
 * @param {number} [params.rain7d]
 * @param {number} [params.luxVal]
 * @param {number} [params.weeklyDoDelta]
 * @param {number} [params.weeklyPhDelta]
 * @param {boolean} [params.isIdle]
 * @returns {object} { level, badgeText, badgeClass, color, bannerIcon, title, reasons }
 */
export function evaluateFeedingAction(params = {}) {
    if (params.isIdle) {
        return {
            level: "idle",
            badgeText: "Idle / Preparation",
            badgeClass: "badge-idle",
            color: "#94a3b8",
            bannerIcon: "⚪",
            title: "POND IDLE — NO ACTIVE FEEDING",
            reasons: [{ icon: "⚪", headline: "Pond is currently unstocked or in preparation." }]
        };
    }

    const doMin = params.doMin !== undefined ? Number(params.doMin) : (params.doCurrent !== undefined ? Number(params.doCurrent) : 5.0);
    const doCurrent = params.doCurrent !== undefined ? Number(params.doCurrent) : doMin;
    const phDelta = params.phDelta !== undefined ? Number(params.phDelta) : 0.2;
    const tempMax = params.tempMax !== undefined ? Number(params.tempMax) : 30.0;
    const tempDelta = params.tempDelta !== undefined ? Number(params.tempDelta) : 1.2;
    const rainToday = Number(params.rainToday || 0);
    const rain7d = Number(params.rain7d || 0);
    const luxVal = params.luxVal !== undefined ? Number(params.luxVal) : 55000;
    const weeklyDoDelta = params.weeklyDoDelta !== undefined ? Number(params.weeklyDoDelta) : null;
    const weeklyPhDelta = params.weeklyPhDelta !== undefined ? Number(params.weeklyPhDelta) : null;

    const criticalReasons = [];
    const cautionReasons = [];

    // --- 1. CRITICAL TRIGGERS (REDUCE / CUT FEED) ---
    // A. Heavy Rainfall (>= 40mm today or >= 120mm 7-day)
    if (rainToday >= FEEDING_THRESHOLDS.RAINFALL.CRITICAL_DAILY || rain7d >= FEEDING_THRESHOLDS.RAINFALL.CRITICAL_7DAY) {
        const isDaily = rainToday >= FEEDING_THRESHOLDS.RAINFALL.CRITICAL_DAILY;
        criticalReasons.push({
            icon: "🌧️",
            headline: isDaily ? `Heavy Rain Alert (${rainToday.toFixed(1)} mm today ≥ 40.0 mm)` : `Severe 7-Day Cumulative Rain (${rain7d.toFixed(1)} mm ≥ 120.0 mm)`,
            desc: "Causes severe pond thermal & salinity stratification, plankton die-off, and rapid bottom DO drop.",
            tag: "Critical Trigger"
        });
    }

    // B. Critical Low DO (< 3.0 ppm)
    if (doMin < FEEDING_THRESHOLDS.DO.CRITICAL_LOW || doCurrent < FEEDING_THRESHOLDS.DO.CRITICAL_LOW) {
        const minVal = Math.min(doMin, doCurrent);
        criticalReasons.push({
            icon: "💧",
            headline: `Critical Low DO (${minVal.toFixed(2)} ppm < 3.0 ppm)`,
            desc: "Severe hypoxic stress suppresses shrimp digestion. Uneaten feed deteriorates pond bottom.",
            tag: "Critical Trigger"
        });
    }

    // C. Severe pH Swing (Delta >= 1.5)
    if (phDelta >= FEEDING_THRESHOLDS.PH.SEVERE_SWING) {
        criticalReasons.push({
            icon: "🧪",
            headline: `Severe pH Swing (Daily Δ ${phDelta.toFixed(2)} ≥ ${FEEDING_THRESHOLDS.PH.SEVERE_SWING})`,
            desc: "Extreme daily pH swing induces physiological shock and suppresses feeding response.",
            tag: "Critical Trigger"
        });
    }

    // D. Extreme Water Temperature (>= 33.0 °C)
    if (tempMax >= FEEDING_THRESHOLDS.WATER_TEMP.STRESS_HIGH) {
        criticalReasons.push({
            icon: "🌡️",
            headline: `Thermal Stress Threshold (${tempMax.toFixed(1)}°C ≥ 33.0°C)`,
            desc: "Exceeds shrimp metabolic comfort, sharply increasing oxygen demand while slowing digestion.",
            tag: "Critical Trigger"
        });
    }

    // --- 2. CAUTIONARY TRIGGERS (CAREFUL FEEDING) ---
    // A. Borderline DO Dip (3.0 - 4.0 ppm)
    if (doMin >= FEEDING_THRESHOLDS.DO.CRITICAL_LOW && doMin <= FEEDING_THRESHOLDS.DO.CAUTION_LOW) {
        cautionReasons.push({
            icon: "💧",
            headline: `Borderline Morning DO (${doMin.toFixed(2)} ppm ≤ 4.0 ppm)`,
            desc: "Dissolved oxygen dropped into 3.0–4.0 ppm warning band during early morning hours.",
            tag: "Caution Dip"
        });
    }

    // B. 7-Day DO Declining Trend
    if (weeklyDoDelta !== null && weeklyDoDelta <= FEEDING_THRESHOLDS.DO.WEEKLY_DROP_ALERT) {
        cautionReasons.push({
            icon: "📉",
            headline: `7-Day Declining DO Trend (${weeklyDoDelta.toFixed(2)} ppm / week)`,
            desc: "Sustained downward oxygen baseline indicates organic bottom sludge accumulation.",
            tag: "Weekly Trend"
        });
    }

    // C. Elevated Daily pH Swing (1.0 < Delta < 1.5)
    if (phDelta > FEEDING_THRESHOLDS.PH.MAX_SAFE_SWING && phDelta < FEEDING_THRESHOLDS.PH.SEVERE_SWING) {
        cautionReasons.push({
            icon: "🧪",
            headline: `High pH Swing (Daily Δ ${phDelta.toFixed(2)} > ${FEEDING_THRESHOLDS.PH.MAX_SAFE_SWING})`,
            desc: "Daily pH fluctuation exceeds safe 1.0 buffer limit, indicating active algal bloom photosynthesis swing.",
            tag: "Daily Fluctuation"
        });
    }

    // D. Moderate Daily Rain (20-40mm)
    if (rainToday >= FEEDING_THRESHOLDS.RAINFALL.CAUTION_DAILY && rainToday < FEEDING_THRESHOLDS.RAINFALL.CRITICAL_DAILY) {
        cautionReasons.push({
            icon: "🌧️",
            headline: `Moderate Rain Alert (${rainToday.toFixed(1)} mm today)`,
            desc: "Rainfall lowers surface water temperature and suppresses feeding response; monitor feed trays.",
            tag: "Weather Condition"
        });
    }

    // E. Low Sunlight / Overcast (< 20,000 lux)
    if (luxVal > 0 && luxVal < FEEDING_THRESHOLDS.LUX.OVERCAST) {
        cautionReasons.push({
            icon: "☁️",
            headline: `Low Sunlight / Overcast (${Math.round(luxVal).toLocaleString()} lux)`,
            desc: "Low solar irradiance reduces natural photosynthetic oxygen generation.",
            tag: "Weather Condition"
        });
    }

    // --- 3. FINAL DIRECTIVE & COLOR CODE ---
    if (criticalReasons.length > 0) {
        return {
            level: "critical",
            badgeText: "Reduce / Cut Feed",
            badgeClass: "badge-danger",
            color: "#ef4444",
            bannerIcon: "🚨",
            title: "REDUCE FEEDING — CRITICAL WATER QUALITY / WEATHER ALERT",
            reasons: [...criticalReasons, ...cautionReasons]
        };
    } else if (cautionReasons.length > 0) {
        return {
            level: "caution",
            badgeText: "Careful Feeding",
            badgeClass: "badge-warning",
            color: "#f59e0b",
            bannerIcon: "⚠️",
            title: "CAREFUL FEEDING — ADJUST RATION & MONITOR CLOSELY",
            reasons: cautionReasons
        };
    } else {
        return {
            level: "optimal",
            badgeText: "Normal Feed",
            badgeClass: "badge-good",
            color: "#10b981",
            bannerIcon: "🟢",
            title: "NORMAL FEEDING — OPTIMAL CONDITIONS",
            reasons: [{ icon: "✅", headline: "All Water Quality & Weather Parameters in Safe Optimal Ranges" }]
        };
    }
}

